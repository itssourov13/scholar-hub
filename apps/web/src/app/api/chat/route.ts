import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sql } from "@/utils/db";
import { getClientIp, logRequest } from "@/lib/nim";
import { fetchOpenRouterChatWithFallback, getOpenRouterChatModels, OPENROUTER_FREE_PDF_PLUGIN } from "@/lib/openrouter";
import {
  ATTACHMENT_SYSTEM_NOTE,
  buildOpenRouterUserContent,
  DEFAULT_CHAT_ATTACHMENT_PROMPT,
  formatStoredUserMessage,
  parseChatAttachments,
} from "@/lib/chat-attachments";
import { checkChatAttachmentRateLimit, checkChatRateLimit, CHAT_ATTACHMENT_LIMITS, formatResetWindow, type ChatTier } from "@/lib/rate-limit";
import {
  buildProfileBlock,
  loadMentorProfile,
  loadScholarshipFacts,
  retrieveScholarshipContext,
} from "@/lib/mentor-context";
import { formatScholarshipFacts } from "@/lib/scholarship-facts";

const BASE_SYSTEM_PROMPT = `You are ScholarHub Mentor, an expert AI advisor for Bangladeshi students pursuing higher education and scholarships abroad. You have deep knowledge of:
- International scholarships (DAAD, Erasmus Mundus, Commonwealth, Chevening, Fulbright, etc.)
- University admission requirements and processes
- CGPA/GPA requirements, English proficiency tests (IELTS, TOEFL, Duolingo)
- Statement of Purpose, recommendation letters, and application strategies
- Country-specific study permit and visa processes

GROUNDING RULES — follow these strictly:
1. When a "VERIFIED SCHOLARSHIP DATA" block is present, it comes from the ScholarHub database and overrides anything you remember about that scholarship.
2. Report deadlines, funding amounts and eligibility from that block EXACTLY as written. Never round a date to a month, never give a range like "usually around May", and never say "typically" or "approximately" about a value that is stated there.
3. If a student asks about something not covered by the verified data, say plainly that ScholarHub does not list it, then answer from general knowledge and label it clearly as general guidance to confirm on the official website.
4. Never invent a deadline, award amount, or URL.

PERSONALISATION:
- When a "STUDENT PROFILE" block is present, tailor every answer to it. Compare their CGPA, test scores, major and target countries against the requirements you cite, and tell them concretely where they stand.
- Do not ask for information the profile already contains. If a field they need is listed as not filled in, mention it once and point them to their profile page.

Be concise, practical, and encouraging. Always cite specific scholarships or programs when relevant.`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_MSG_LENGTH = 8000;
const MAX_HISTORY = 12;
// Bangla costs ~2-4x the tokens of English for the same text, so a budget
// that's ample in English truncates Bangla replies mid-answer.
const MAX_OUTPUT_TOKENS = 4096;

// If the upstream goes silent mid-stream (connection stays open but no token
// arrives) for this long, give up rather than leaving the user staring at a
// frozen reply with no explanation. Chat never disables reasoning (unlike
// cv-analyze), and these OpenRouter models can spend 15-35s on invisible
// "thinking" tokens before the first visible content delta — this must stay
// safely above that or it will fire on perfectly healthy replies.
const STREAM_STALL_MS = 45_000;
// Cloudflare's origin proxy times out at 100s. Cap wall-clock time from the
// start of this request (RAG + generation) so the client gets a clean stop
// instead of a hung stream. Whatever was already streamed is kept.
const CF_ORIGIN_BUDGET_MS = 90_000;

class StreamStallError extends Error {}

/** Races a single `reader.read()` against a stall timeout that resets every chunk. */
function readWithTimeout<T>(
  reader: ReadableStreamDefaultReader<T>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<T>> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new StreamStallError("stream stalled")), timeoutMs);
  });
  return Promise.race([reader.read(), timeout]).finally(() => clearTimeout(timer));
}

type RateLimitErrorBody = {
  error: string;
  scope: "hourly" | "daily" | "global";
  resetMs: number;
  resetIn: string;
  signinRequired?: boolean;
  /** `attachment` = document reading only; text chat is still open. */
  quota?: "chat" | "attachment";
  remaining: { hourly: number; daily: number; global: number };
};

const rateLimitMessage = (
  scope: "hourly" | "daily" | "global",
  tier: ChatTier,
  resetMs: number,
): string => {
  const reset = formatResetWindow(resetMs);
  if (scope === "global") {
    return `ScholarHub Mentor is at capacity right now. Please retry in ${reset}.`;
  }
  if (tier === "anonymous") {
    return `You've reached the free trial limit. Sign in to keep chatting.`;
  }
  if (scope === "daily") {
    return `You've used your daily message limit. Resets in ${reset}.`;
  }
  return `You're sending messages a bit fast. Resets in ${reset}.`;
};

const attachmentRateLimitMessage = (
  scope: "hourly" | "daily" | "global",
  resetMs: number,
): string => {
  const reset = formatResetWindow(resetMs);
  if (scope === "global") {
    return "You can keep typing questions — document reading is paused today so the free mentor can stay online.";
  }
  const daily = CHAT_ATTACHMENT_LIMITS.user.daily;
  if (scope === "daily") {
    return `You can keep typing questions — document reading is limited to ${daily} per day. Resets in ${reset}.`;
  }
  return `You can keep typing questions — document reading is paused for a bit. Resets in ${reset}.`;
};

const json429 = (
  decision: { scope: "hourly" | "daily" | "global"; resetMs?: number; remaining: RateLimitErrorBody["remaining"] },
  error: string,
  extra?: { signinRequired?: boolean; quota?: "chat" | "attachment" },
) => {
  const errorBody: RateLimitErrorBody = {
    error,
    scope: decision.scope,
    resetMs: decision.resetMs ?? 0,
    resetIn: formatResetWindow(decision.resetMs ?? 0),
    signinRequired: extra?.signinRequired,
    quota: extra?.quota,
    remaining: decision.remaining,
  };
  return NextResponse.json(errorBody, {
    status: 429,
    headers: {
      "Retry-After": Math.ceil((decision.resetMs ?? 0) / 1000).toString(),
    },
  });
};

export async function POST(req: NextRequest) {
  const requestStartedAt = Date.now();
  const ip = getClientIp(req);

  // ── Server config sanity ──
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  // ── Parse + validate body ──
  let body: {
    messages?: { role: string; content: string }[];
    sessionId?: string;
    userMessage?: string;
    /** Set by the scholarship detail panel so its facts are grounded server-side. */
    scholarshipId?: string;
    attachments?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const userMessages = body.messages ?? [];
  if (!Array.isArray(userMessages) || userMessages.length === 0) {
    return NextResponse.json(
      { error: "messages array is required." },
      { status: 400 },
    );
  }

  if (userMessages.some((m) => typeof m.content === "string" && m.content.length > MAX_MSG_LENGTH)) {
    return NextResponse.json(
      { error: `Each message must be under ${MAX_MSG_LENGTH} characters.` },
      { status: 400 },
    );
  }

  // The scholarship panel sends its page context as a system message. Pull those
  // out so they can be merged into the single server-owned system prompt —
  // sending two competing system messages made the model pick one arbitrarily.
  const history = userMessages.filter((m) => m.role === "user" || m.role === "assistant");
  const clientContext = userMessages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n")
    .trim();

  const trimmedMessages = history.slice(-MAX_HISTORY).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const parsedAttachments = parseChatAttachments(body.attachments);
  if (!parsedAttachments.ok) {
    return NextResponse.json({ error: parsedAttachments.error }, { status: 400 });
  }
  const attachments = parsedAttachments.attachments;
  const multimodal = attachments.length > 0;

  const sessionId = body.sessionId ?? null;
  const anonKey = req.headers.get("x-anon-key");
  const { userId } = await auth();

  if (multimodal && !userId) {
    return NextResponse.json(
      { error: "Sign in to send a document. You can keep typing questions without signing in.", signinRequired: true },
      { status: 401 },
    );
  }

  let tier: ChatTier = "anonymous";
  let callerId: string;
  const profile = userId ? await loadMentorProfile(userId) : null;
  if (userId) {
    tier = profile?.role === "admin" ? "admin" : "user";
    callerId = userId;
  } else if (anonKey) {
    callerId = `anon:${anonKey}`;
  } else {
    callerId = `ip:${ip}`;
  }

  // ── Multi-window rate limit ──
  const decision = await checkChatRateLimit({ callerId, tier });
  if (!decision.allowed && decision.scope) {
    logRequest("chat.rate_limited", { tier, scope: decision.scope, callerId });
    return json429(
      { ...decision, scope: decision.scope },
      rateLimitMessage(decision.scope, tier, decision.resetMs ?? 0),
      {
        signinRequired: tier === "anonymous" && decision.scope !== "global",
        quota: "chat",
      },
    );
  }

  if (multimodal) {
    const attDecision = await checkChatAttachmentRateLimit({ callerId, tier });
    if (!attDecision.allowed && attDecision.scope) {
      logRequest("chat.attachment_rate_limited", { tier, scope: attDecision.scope, callerId });
      return json429(
        { ...attDecision, scope: attDecision.scope },
        attachmentRateLimitMessage(attDecision.scope, attDecision.resetMs ?? 0),
        { quota: "attachment" },
      );
    }
  }

  // ── Verify session ownership when a sessionId is supplied ──
  if (sessionId) {
    const rows = await sql`
      SELECT user_id, anon_key FROM chat_sessions WHERE id = ${sessionId} LIMIT 1
    `;
    const session = rows[0];

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    if (session.user_id) {
      if (!userId || userId !== session.user_id)
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    } else {
      if (session.anon_key !== anonKey)
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  let lastUserIdx = -1;
  for (let i = trimmedMessages.length - 1; i >= 0; i--) {
    if (trimmedMessages[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  if (multimodal && lastUserIdx >= 0 && !trimmedMessages[lastUserIdx].content.trim()) {
    trimmedMessages[lastUserIdx] = {
      ...trimmedMessages[lastUserIdx],
      content: DEFAULT_CHAT_ATTACHMENT_PROMPT,
    };
  }

  const lastUserMessage = [...trimmedMessages].reverse().find((m) => m.role === "user");
  const storedUserText = formatStoredUserMessage(
    body.userMessage ?? lastUserMessage?.content ?? "",
    attachments,
  );

  if (sessionId && storedUserText) {
    sql`
      INSERT INTO chat_messages (session_id, role, content)
      VALUES (${sessionId}, 'user', ${storedUserText})
    `.catch((err: unknown) => console.error("[chat] failed to save user message:", err));
  }

  // ── Profile context ──
  const profileBlock = buildProfileBlock(profile);

  // ── Scholarship context ──
  // Retrieval runs against the last user turn; when the request comes from a
  // scholarship detail page, that scholarship's facts are always included even
  // if the question ("Am I eligible?") carries no searchable keywords.
  let retrieved: { block: string; scholarshipIds: string[] } = { block: "", scholarshipIds: [] };
  try {
    const ragQuery = (lastUserMessage?.content ?? "").trim();
    if (ragQuery) {
      retrieved = await retrieveScholarshipContext(ragQuery, openRouterKey);
    }
  } catch (err) {
    logRequest("rag.context.error", { ip, error: String(err) });
  }

  let pinnedBlock = "";
  const pinnedId = UUID_PATTERN.test(body.scholarshipId ?? "") ? body.scholarshipId! : null;
  if (pinnedId && !retrieved.scholarshipIds.includes(pinnedId)) {
    try {
      const [pinned] = await loadScholarshipFacts([pinnedId]);
      if (pinned) {
        pinnedBlock = [
          "",
          "=== SCHOLARSHIP THE STUDENT IS CURRENTLY VIEWING (authoritative) ===",
          formatScholarshipFacts(pinned),
          "=== END ===",
        ].join("\n");
      }
    } catch (err) {
      logRequest("rag.pinned.error", { ip, error: String(err) });
    }
  }

  const contextBlock = `${pinnedBlock}${retrieved.block}`;

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    dateStyle: "full",
  }).format(new Date());

  const systemPrompt = [
    BASE_SYSTEM_PROMPT,
    `Today's date is ${today} (Asia/Dhaka). Use it when judging whether a deadline has passed.`,
    profileBlock,
    clientContext ? `PAGE CONTEXT PROVIDED BY THE APP:\n${clientContext}` : "",
    multimodal ? ATTACHMENT_SYSTEM_NOTE : "",
    contextBlock,
  ]
    .filter(Boolean)
    .join("\n\n");

  const openRouterMessages = trimmedMessages.map((m, i) =>
    multimodal && i === lastUserIdx && m.role === "user"
      ? { role: "user" as const, content: buildOpenRouterUserContent(m.content, attachments) }
      : { role: m.role, content: m.content },
  );

  const models = getOpenRouterChatModels({ multimodal });
  if (multimodal && models.length === 0) {
    return NextResponse.json(
      { error: "File reading is not configured on the server." },
      { status: 500 },
    );
  }

  // ── Live model call ──
  const hasPdf = attachments.some((a) => a.kind === "file");
  const chatPayload = {
    messages: [{ role: "system", content: systemPrompt }, ...openRouterMessages],
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.7,
    top_p: 0.95,
    stream: true,
    // Unlike cv-analyze, this used to be left on, which let these models spend
    // 15-35s (sometimes much more, per production logs) on invisible thinking
    // tokens before the first visible reply — the single biggest lever on
    // perceived chat latency. A mentor Q&A doesn't need deep multi-step
    // reasoning the way structured CV extraction does, so speed wins here.
    reasoning: { enabled: false },
    ...(hasPdf ? { plugins: [OPENROUTER_FREE_PDF_PLUGIN] } : {}),
  };

  let upstreamRes: Response;
  let upstreamModel = "";
  try {
    const result = await fetchOpenRouterChatWithFallback(chatPayload, {
      apiKey: openRouterKey,
      accept: "text/event-stream",
      models,
    });
    upstreamRes = result.response;
    upstreamModel = result.model;
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const upstreamStream = upstreamRes.body!;
  let fullAssistantContent = "";
  logRequest("chat.stream.start", { ip, tier, model: upstreamModel, multimodal });

  const readable = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ model: upstreamModel })}\n\n`),
      );

      const reader = upstreamStream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let stoppedEarly: "stalled" | "max_duration" | null = null;

      try {
        while (true) {
          const budgetLeft = CF_ORIGIN_BUDGET_MS - (Date.now() - requestStartedAt);
          if (budgetLeft <= 1_000) {
            stoppedEarly = "max_duration";
            break;
          }

          let read: ReadableStreamReadResult<Uint8Array>;
          try {
            read = await readWithTimeout(reader, Math.min(STREAM_STALL_MS, budgetLeft));
          } catch (err) {
            if (err instanceof StreamStallError) {
              stoppedEarly = "stalled";
              break;
            }
            throw err;
          }
          const { done, value } = read;
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") continue;
            if (!trimmed.startsWith("data:")) continue;

            const jsonStr = trimmed.slice(5).trim();
            let parsed: { choices?: { delta?: { content?: string } }[] };
            try {
              parsed = JSON.parse(jsonStr);
            } catch {
              continue;
            }

            const token = parsed?.choices?.[0]?.delta?.content;
            if (token) {
              fullAssistantContent += token;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ token })}\n\n`),
              );
            }
          }
        }

        if (stoppedEarly) {
          reader.cancel().catch(() => {});
          logRequest(stoppedEarly === "stalled" ? "chat.stream.stalled" : "chat.stream.max_duration", {
            ip,
            model: upstreamModel,
          });
          const message = fullAssistantContent
            ? "\n\n_The mentor's response was cut short — please try again if it looks incomplete._"
            : "The mentor stopped responding. Please try again.";
          fullAssistantContent += message;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ token: message })}\n\n`),
          );
        }

        if (sessionId && fullAssistantContent) {
          sql`
            INSERT INTO chat_messages (session_id, role, content)
            VALUES (${sessionId}, 'assistant', ${fullAssistantContent})
          `.catch((err: unknown) => console.error("[chat] failed to save assistant message:", err));

          if (storedUserText) {
            const title = storedUserText.slice(0, 60).trim();
            sql`
              UPDATE chat_sessions SET title = ${title}
              WHERE id = ${sessionId} AND title = 'New conversation'
            `.catch(() => {});
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: String(err) })}\n\n`,
          ),
        );
      } finally {
        logRequest("chat.stream.end", { ip, model: upstreamModel });
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
