import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, TextInput, Pressable, ScrollView, Keyboard, KeyboardAvoidingView, ActivityIndicator, Animated, StyleSheet, Image, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQueryClient } from "@tanstack/react-query";
import Markdown from "react-native-markdown-display";
import type { ChatMessage } from "@scholarhub/shared";
import { ApiError } from "@scholarhub/shared";
import { useApi } from "@/lib/api";
import { consumePendingChatPrompt, consumePendingChatSession } from "@/lib/chat-handoff";
import {
  ChatAttachError,
  formatChatAttachmentMessage,
  isChatImageMime,
  pickChatAttachment,
  type AttachIntent,
  type PendingAttachment,
} from "@/lib/chat-attach";
import { useRateAppEngagement } from "@/lib/rate-app";
import { useLang, useT } from "@/i18n";
import type { TranslationKey } from "@/i18n/translations";
import { Txt } from "@/components/ui";
import { colors, fonts, gradients, shadow } from "@/theme";

const SUGGESTIONS: TranslationKey[] = ["chat.suggest1", "chat.suggest2", "chat.suggest3", "chat.suggest4"];

const ATTACH_OPTIONS: {
  intent: AttachIntent;
  icon: keyof typeof Ionicons.glyphMap;
  title: TranslationKey;
  hint: TranslationKey;
}[] = [
  { intent: "cv", icon: "document-text-outline", title: "chat.attachCv", hint: "chat.attachCvHint" },
  { intent: "transcript", icon: "school-outline", title: "chat.attachTranscript", hint: "chat.attachTranscriptHint" },
  { intent: "letter", icon: "mail-open-outline", title: "chat.attachLetter", hint: "chat.attachLetterHint" },
  { intent: "screenshot", icon: "image-outline", title: "chat.attachShot", hint: "chat.attachShotHint" },
];

const ATTACH_PROMPT: Record<AttachIntent, TranslationKey> = {
  cv: "chat.attachPromptCv",
  transcript: "chat.attachPromptTranscript",
  letter: "chat.attachPromptLetter",
  screenshot: "chat.attachPromptShot",
};

const ATTACH_LABEL: Record<AttachIntent, TranslationKey> = {
  cv: "chat.attachCv",
  transcript: "chat.attachTranscript",
  letter: "chat.attachLetter",
  screenshot: "chat.attachShot",
};

function AttachSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (intent: AttachIntent) => void;
}) {
  const t = useT();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} accessibilityRole="button" accessibilityLabel={t("common.close")} />
      <View style={shadow.md} className="bg-surface rounded-t-[26px] absolute bottom-0 left-0 right-0 pt-3">
        <View className="items-center pb-1">
          <View className="w-10 h-1.5 rounded-full bg-sand-300" />
        </View>
        <View className="px-5 pt-2 pb-1">
          <Txt font="display" weight="semibold" className="text-ink-900 text-xl">{t("chat.attachTitle")}</Txt>
          <Txt className="text-ink-500 text-[13px] leading-[19px] mt-1.5">{t("chat.attachSheetSub")}</Txt>
        </View>
        <View className="px-3 pt-2 pb-1">
          {ATTACH_OPTIONS.map((opt) => (
            <Pressable
              key={opt.intent}
              onPress={() => onPick(opt.intent)}
              className="flex-row items-center gap-3 px-3 py-3 rounded-2xl active:bg-sand-100"
              accessibilityRole="button"
              accessibilityLabel={t(opt.title)}
            >
              <View className="w-11 h-11 rounded-2xl bg-teal-100 items-center justify-center">
                <Ionicons name={opt.icon} size={22} color={colors.teal700} />
              </View>
              <View className="flex-1">
                <Txt weight="semibold" className="text-ink-900 text-[15px]">{t(opt.title)}</Txt>
                <Txt className="text-ink-500 text-[12.5px] mt-0.5">{t(opt.hint)}</Txt>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.ink300} />
            </Pressable>
          ))}
        </View>
        <SafeAreaView edges={["bottom"]} className="px-5 pt-1 pb-3">
          <Pressable onPress={onClose} className="items-center py-3">
            <Txt weight="semibold" className="text-ink-500">{t("common.cancel")}</Txt>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/** Markdown styles for assistant bubbles, matching the Txt typography. */
function buildMarkdownStyles(lang: "en" | "bn") {
  const body = lang === "bn" ? fonts.bengali : fonts.body;
  const semibold = lang === "bn" ? fonts.bengaliSemibold : fonts.bodySemibold;
  const bold = lang === "bn" ? fonts.bengaliBold : fonts.bodyBold;
  return StyleSheet.create({
    body: { color: colors.ink800, fontSize: 14.5, lineHeight: 22, fontFamily: body },
    paragraph: { marginTop: 0, marginBottom: 6 },
    strong: { fontFamily: bold },
    heading1: { fontFamily: bold, fontSize: 17, lineHeight: 25, marginTop: 8, marginBottom: 4 },
    heading2: { fontFamily: bold, fontSize: 16, lineHeight: 24, marginTop: 8, marginBottom: 4 },
    heading3: { fontFamily: semibold, fontSize: 15, lineHeight: 23, marginTop: 6, marginBottom: 2 },
    heading4: { fontFamily: semibold, fontSize: 14.5, lineHeight: 22, marginTop: 6, marginBottom: 2 },
    heading5: { fontFamily: semibold, fontSize: 14.5, lineHeight: 22 },
    heading6: { fontFamily: semibold, fontSize: 14.5, lineHeight: 22 },
    bullet_list: { marginBottom: 6 },
    ordered_list: { marginBottom: 6 },
    list_item: { marginBottom: 3 },
    link: { color: colors.teal600, textDecorationLine: "underline" },
    blockquote: {
      backgroundColor: colors.sand100,
      borderLeftWidth: 3,
      borderLeftColor: colors.teal500,
      paddingLeft: 10,
      paddingVertical: 2,
      marginVertical: 4,
    },
    code_inline: { backgroundColor: colors.sand100, borderRadius: 4, fontSize: 13 },
    code_block: { backgroundColor: colors.sand100, borderColor: colors.sand200, borderRadius: 10, padding: 10, fontSize: 12.5, marginVertical: 4 },
    fence: { backgroundColor: colors.sand100, borderColor: colors.sand200, borderRadius: 10, padding: 10, fontSize: 12.5, marginVertical: 4 },
    table: { borderWidth: 1, borderColor: colors.sand200, borderRadius: 8, marginVertical: 6 },
    th: { padding: 7, fontFamily: semibold, fontSize: 12.5 },
    tr: { borderBottomWidth: 1, borderColor: colors.sand200, flexDirection: "row" },
    td: { padding: 7, fontSize: 12.5 },
    hr: { backgroundColor: colors.sand200, height: 1, marginVertical: 8 },
  });
}

/** How long each "working on it" label stays up before the next one, in ms. */
const THINK_STAGES: { key: TranslationKey; ms: number }[] = [
  { key: "chat.think1", ms: 1400 },
  { key: "chat.think2", ms: 2600 },
  { key: "chat.think3", ms: 3000 },
  { key: "chat.think4", ms: 3200 },
  { key: "chat.think5", ms: 4000 },
  { key: "chat.think6", ms: 0 },
];

/**
 * Replaces the empty assistant bubble while we wait for the first token.
 * Replies take 5-10s, so a bare "…" reads as a hang — narrate the work instead.
 */
function Thinking() {
  const t = useT();
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const hold = THINK_STAGES[idx].ms;
    if (!hold) return;
    const timer = setTimeout(() => {
      Animated.sequence([
        Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 220, delay: 60, useNativeDriver: true }),
      ]).start();
      setTimeout(() => setIdx((i) => Math.min(i + 1, THINK_STAGES.length - 1)), 240);
    }, hold);
    return () => clearTimeout(timer);
  }, [idx, fade]);

  return (
    <View className="flex-row items-center gap-2">
      <ActivityIndicator size="small" color={colors.teal500} />
      <Animated.View style={{ opacity: fade }}>
        <Txt className="text-ink-500 text-[14px] leading-[22px]">{t(THINK_STAGES[idx].key)}</Txt>
      </Animated.View>
    </View>
  );
}

export default function Chat() {
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  useRateAppEngagement();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  // `send` is redefined every render, and the focus effect below must not close
  // over a stale copy — keep the latest one reachable through a ref.
  const sendRef = useRef<(text: string, fresh?: boolean) => void>(() => {});

  // Hide the disclaimer while typing — screen space is scarce with the
  // keyboard up.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const status = t("chat.ready");

  const { lang } = useLang();
  const mdStyles = useMemo(() => buildMarkdownStyles(lang), [lang]);

  const loadSession = useCallback(
    async (id: string) => {
      setSessionId(id);
      setError(null);
      try {
        const res = await api.getChatMessages(id);
        setMessages(res.messages.map((m) => ({ role: m.role, content: m.content })));
      } catch {
        setError(t("chat.error"));
      }
    },
    [api, t],
  );

  // Deep links (e.g. notification taps) open the chat with ?sessionId=.
  useEffect(() => {
    const incoming = params.sessionId ?? null;
    if (incoming && incoming !== sessionId) loadSession(incoming);
  }, [params.sessionId, sessionId, loadSession]);

  // The history screen hands its pick over via the mailbox (see chat-handoff),
  // and the roadmap hands over a question to ask straight away.
  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingChatSession();
      if (pending && pending !== sessionId) loadSession(pending);
      const ask = consumePendingChatPrompt();
      if (ask) sendRef.current(ask, true);
    }, [sessionId, loadSession]),
  );

  function newChat() {
    setMessages([]);
    setSessionId(null);
    setError(null);
    setInput("");
    setAttachments([]);
    router.setParams({ sessionId: undefined });
  }

  function attachErrorMessage(err: unknown): string {
    if (err instanceof ChatAttachError) {
      if (err.code === "too-large") return t("chat.attachTooLarge");
      if (err.code === "too-many") return t("chat.attachTooMany");
      if (err.code === "unsupported") return t("chat.attachUnsupported");
      return t("chat.attachUnreadable");
    }
    return t("chat.attachUnreadable");
  }

  async function addAttachment(intent: AttachIntent) {
    setAttachOpen(false);
    setError(null);
    try {
      const next = await pickChatAttachment(intent);
      if (!next.length) return;
      setAttachments(next);
      setInput((current) => (current.trim() ? current : t(ATTACH_PROMPT[intent])));
    } catch (err) {
      setError(attachErrorMessage(err));
    }
  }

  function attachmentLimitMessage(err: ApiError): string {
    const scope = err.body?.scope;
    const reset = typeof err.body?.resetIn === "string" ? err.body.resetIn : "";
    const base =
      scope === "global"
        ? t("chat.attachLimitGlobal")
        : scope === "hourly"
          ? t("chat.attachLimitHourly")
          : t("chat.attachLimitDaily");
    return reset ? `${base} ${t("chat.attachLimitReset")} ${reset}.` : base;
  }

  /**
   * `fresh` starts a new thread rather than appending. The roadmap hands over a
   * question about one specific step, and threading that onto an unrelated
   * conversation would give the mentor misleading context.
   */
  async function send(text: string, fresh = false) {
    const files = fresh ? [] : attachments;
    const trimmed = text.trim();
    if ((!trimmed && files.length === 0) || streaming) return;
    setError(null);
    setInput("");
    setAttachments([]);
    const persistText = formatChatAttachmentMessage(
      trimmed,
      files.map((f) => f.name),
      files[0] ? t(ATTACH_PROMPT[files[0].intent]) : undefined,
    );
    const history: ChatMessage[] = [
      ...(fresh ? [] : messages),
      { role: "user", content: persistText },
    ];
    setMessages([...history, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      let activeSession = fresh ? null : sessionId;
      if (fresh) setSessionId(null);
      if (!activeSession) {
        const created = await api.createChatSession();
        activeSession = created.session.id;
        setSessionId(activeSession);
      }
      await api.streamChat(
        {
          messages: history,
          userMessage: persistText,
          sessionId: activeSession,
          ...(files.length
            ? { attachments: files.map((f) => ({ name: f.name, mimeType: f.mimeType, data: f.data })) }
            : {}),
        },
        {
          onToken: (token) => {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") next[next.length - 1] = { role: "assistant", content: last.content + token };
              return next;
            });
            scrollRef.current?.scrollToEnd({ animated: true });
          },
        },
      );
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
    } catch (err) {
      const is429 = err instanceof ApiError && err.status === 429;
      const attachmentQuota = is429 && err.body?.quota === "attachment";
      const attachAuth = err instanceof ApiError && err.status === 401 && files.length > 0;
      setMessages((prev) => {
        const next = [...prev];
        if (next[next.length - 1]?.content === "") next.pop();
        if ((is429 || attachAuth) && next[next.length - 1]?.role === "user") next.pop();
        return next;
      });
      if (is429) {
        setInput(trimmed);
        if (files.length) setAttachments(files);
        setError(attachmentQuota ? attachmentLimitMessage(err) : typeof err.body?.error === "string" ? err.body.error : err.message);
      } else if (attachAuth) {
        setInput(trimmed);
        setAttachments(files);
        setError(t("chat.attachSignIn"));
      } else {
        const msg =
          err instanceof ApiError
            ? typeof err.body?.error === "string" ? err.body.error : err.message
            : t("chat.error");
        setError(msg);
      }
    } finally {
      setStreaming(false);
    }
  }

  useEffect(() => {
    sendRef.current = send;
  });

  const showGreeting = messages.length === 0;

  return (
    <View className="flex-1 bg-body">
      {/* Header */}
      <SafeAreaView edges={["top"]} className="bg-surface border-b border-sand-200">
        <View className="flex-row items-center gap-3 px-4 py-2.5">
          <Pressable onPress={() => router.back()} className="w-[38px] h-[38px] rounded-full bg-sand-100 items-center justify-center">
            <Ionicons name="arrow-back" size={20} color={colors.ink900} />
          </Pressable>
          <LinearGradient
            colors={gradients.heroSoft}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="sparkles" size={20} color={colors.white} />
          </LinearGradient>
          <View className="flex-1">
            <Txt font="display" weight="semibold" className="text-ink-900 text-base">{t("chat.mentorName")}</Txt>
            <View className="flex-row items-center gap-1.5 mt-0.5">
              <View className="w-[7px] h-[7px] rounded-full bg-teal-500" />
              <Txt weight="semibold" className="text-ink-500 text-[11.5px] flex-1" numberOfLines={1}>{status}</Txt>
            </View>
          </View>
          <Pressable onPress={() => router.push("/chat/sessions")} className="w-[38px] h-[38px] rounded-full bg-sand-100 items-center justify-center">
            <Ionicons name="time-outline" size={20} color={colors.teal600} />
          </Pressable>
          <Pressable onPress={newChat} className="w-[38px] h-[38px] rounded-full bg-sand-100 items-center justify-center">
            <Ionicons name="create-outline" size={20} color={colors.teal600} />
          </Pressable>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView ref={scrollRef} className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16, gap: 11 }}>
          {showGreeting ? (
            <View className="self-start max-w-[88%] bg-surface border border-sand-200 rounded-[20px] rounded-bl-md px-4 py-3">
              <Txt className="text-ink-800 text-[14.5px] leading-[22px]">{t("chat.greeting")}</Txt>
            </View>
          ) : null}
          {messages.map((m, i) => (
            <View
              key={i}
              style={m.role === "assistant" ? { borderWidth: 1, borderColor: colors.sand200 } : undefined}
              className={
                m.role === "user"
                  ? "self-end bg-teal-500 rounded-[20px] rounded-br-md px-4 py-3 max-w-[86%]"
                  : "self-start bg-surface rounded-[20px] rounded-bl-md px-4 py-3 max-w-[88%]"
              }
            >
              {m.role === "user" ? (
                <Txt className="text-white text-[14.5px] leading-[22px]">{m.content || "…"}</Txt>
              ) : m.content ? (
                <Markdown style={mdStyles}>{m.content}</Markdown>
              ) : (
                <Thinking />
              )}
            </View>
          ))}
        </ScrollView>

        {error ? <Txt className="text-coral-700 px-4 pb-1 text-sm">{error}</Txt> : null}

        {attachments.length > 0 ? (
          <View className="px-4 pb-2">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {attachments.map((file) => (
                <View key={file.id} className="flex-row items-center bg-surface border border-sand-200 rounded-2xl pr-2 overflow-hidden">
                  {isChatImageMime(file.mimeType) ? (
                    <Image source={{ uri: file.uri }} style={{ width: 44, height: 44 }} />
                  ) : (
                    <View className="w-11 h-11 items-center justify-center bg-teal-100">
                      <Ionicons name="document-text" size={20} color={colors.teal700} />
                    </View>
                  )}
                  <Txt className="text-ink-700 text-[12px] px-2 max-w-[160px]" numberOfLines={1}>
                    {t(ATTACH_LABEL[file.intent])}
                  </Txt>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setAttachments((prev) => prev.filter((a) => a.id !== file.id))}
                    accessibilityLabel={t("common.delete")}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.ink400} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <Txt className="text-ink-400 text-[11px] mt-1.5">{t("chat.attachHint")}</Txt>
          </View>
        ) : null}

        {/* Suggestion chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 8, alignItems: "center" }}
        >
          {SUGGESTIONS.map((key) => (
            <Pressable
              key={key}
              onPress={() => send(t(key))}
              disabled={streaming}
              style={{ alignSelf: "center" }}
              className="bg-surface border border-sand-200 rounded-full px-3.5 py-2.5"
            >
              <Txt weight="semibold" className="text-ink-700 text-[12.5px]">{t(key)}</Txt>
            </Pressable>
          ))}
        </ScrollView>

        {/* Input */}
        {/* With the keyboard up, the nav-bar inset would stack on the keyboard
            padding and leave a dead gap under the input — drop it. */}
        <SafeAreaView edges={keyboardOpen ? [] : ["bottom"]} className="bg-surface border-t border-sand-200">
          <View className="flex-row items-end gap-2.5 px-4 py-2">
            <Pressable
              onPress={() => {
                if (streaming) return;
                Keyboard.dismiss();
                setAttachOpen(true);
              }}
              disabled={streaming}
              accessibilityRole="button"
              accessibilityLabel={t("chat.attach")}
              className="w-[46px] h-[46px] rounded-full bg-sand-100 items-center justify-center"
            >
              <Ionicons name="attach" size={22} color={streaming ? colors.ink300 : colors.teal600} />
            </Pressable>
            <TextInput
              className="flex-1 bg-body border border-sand-200 text-ink-900 rounded-full px-4 py-3 max-h-32"
              style={{ fontFamily: "Manrope_400Regular", fontSize: 14 }}
              placeholder={t("chat.placeholder")}
              placeholderTextColor={colors.ink400}
              value={input}
              onChangeText={setInput}
              multiline
            />
            <Pressable
              style={streaming ? undefined : shadow.teal}
              className={`rounded-full w-[46px] h-[46px] items-center justify-center ${streaming ? "bg-teal-200" : "bg-teal-500"}`}
              onPress={() => send(input)}
              disabled={streaming || (!input.trim() && attachments.length === 0)}
            >
              {streaming ? <ActivityIndicator color={colors.white} /> : <Ionicons name="arrow-up" size={22} color={colors.white} />}
            </Pressable>
          </View>
          {!keyboardOpen ? (
            <Txt className="text-ink-400 text-[10.5px] text-center pb-1.5 px-6">{t("chat.disclaimer")}</Txt>
          ) : null}
        </SafeAreaView>
      </KeyboardAvoidingView>
      <AttachSheet visible={attachOpen} onClose={() => setAttachOpen(false)} onPick={(intent) => void addAttachment(intent)} />
    </View>
  );
}
