import { useEffect, useState } from "react";
import { Pressable, ActivityIndicator } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { useSSO } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as Linking from "expo-linking";
import { Txt } from "./ui";
import { useT } from "@/i18n";
import { colors, shadow } from "@/theme";

// Required so the browser-based OAuth redirect can complete and dismiss.
WebBrowser.maybeCompleteAuthSession();

/** Warms up the in-app browser for a snappier OAuth hand-off (Android). */
function useWarmUpBrowser() {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export function GoogleButton({ onError }: { onError?: (msg: string) => void }) {
  useWarmUpBrowser();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function onPress() {
    if (busy) return;
    setBusy(true);
    // expo-web-browser's Android auth-session polyfill races "browser dismissed"
    // (app regained focus) against the redirect deep link; on some devices the
    // React Native "url" event never reaches JS, so the dismiss always wins and
    // startSSOFlow resolves with no session even though Clerk completed the
    // sign-in. The ExpoLinking native module still records the redirect from
    // onNewIntent, so poll getLinkingURL() and finish the nonce exchange
    // ourselves when that happens.
    const redirectUrl = AuthSession.makeRedirectUri();
    Linking.clearInitialURL();
    const captured = { url: null as string | null };
    const sub = Linking.addEventListener("url", (event) => {
      if (event.url.startsWith(redirectUrl)) captured.url = event.url;
    });
    try {
      const { createdSessionId, setActive, signIn, signUp, authSessionResult } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl,
      });
      let sessionId = createdSessionId;
      if (!sessionId && authSessionResult?.type !== "cancel" && signIn) {
        // The redirect can land a beat after the tab closes; keep looking for it
        // for a few seconds.
        for (let i = 0; i < 10 && !sessionId; i++) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          // Android normalizes "scholarhub://?x" to "scholarhub:?x", so match
          // on the scheme rather than the full redirect URL.
          const nativeUrl = Linking.getLinkingURL();
          const scheme = `${redirectUrl.split(":")[0]}:`;
          const url = captured.url ?? (nativeUrl?.startsWith(scheme) ? nativeUrl : null);
          if (!url) continue;
          const nonce = url.match(/[?&]rotating_token_nonce=([^&#]+)/)?.[1];
          try {
            await signIn.reload(nonce ? { rotatingTokenNonce: decodeURIComponent(nonce) } : undefined);
          } catch {
            continue;
          }
          if (signIn.firstFactorVerification.status === "transferable" && signUp) {
            await signUp.create({ transfer: true });
            sessionId = signUp.createdSessionId;
          } else {
            sessionId = signIn.createdSessionId;
          }
        }
      }
      if (sessionId && setActive) {
        await setActive({ session: sessionId });
        router.replace("/(tabs)");
      }
    } catch {
      onError?.(t("auth.signInFailed"));
    } finally {
      sub.remove();
      setBusy(false);
    }
  }

  return (
    <Pressable
      style={shadow.sm}
      className="bg-surface border border-sand-200 rounded-full py-4 flex-row items-center justify-center gap-2.5 active:opacity-90"
      onPress={onPress}
      disabled={busy}
    >
      {busy ? (
        <ActivityIndicator color={colors.ink700} />
      ) : (
        <>
          <FontAwesome name="google" size={18} color={colors.coral500} />
          <Txt weight="semibold" className="text-ink-800 text-base">
            {t("auth.google")}
          </Txt>
        </>
      )}
    </Pressable>
  );
}
