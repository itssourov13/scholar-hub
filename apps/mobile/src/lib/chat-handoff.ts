/**
 * One-shot handoff of the session picked on the chat history screen.
 *
 * The history screen navigates back to the already-mounted chat screen, and
 * expo-router's dismissTo/POP_TO does not deliver fresh params to a mounted
 * route — so the chat screen consumes the picked id from here on focus.
 */
let pendingSessionId: string | null = null;

export function setPendingChatSession(id: string) {
  pendingSessionId = id;
}

export function consumePendingChatSession(): string | null {
  const id = pendingSessionId;
  pendingSessionId = null;
  return id;
}

/**
 * A question to ask the moment the chat screen opens, used by the roadmap so
 * "Ask the mentor about this step" arrives with the question already sent
 * instead of dropping the student on an empty chat to retype the context.
 *
 * Same one-shot contract as the session above: consuming it clears it, so a
 * re-focus (backgrounding the app, returning from history) will not re-send.
 */
let pendingPrompt: string | null = null;

export function setPendingChatPrompt(text: string) {
  pendingPrompt = text;
}

export function consumePendingChatPrompt(): string | null {
  const text = pendingPrompt;
  pendingPrompt = null;
  return text;
}
