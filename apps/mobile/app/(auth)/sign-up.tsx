import { useState } from "react";
import { View, TextInput, KeyboardAvoidingView, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { useSignUp } from "@clerk/clerk-expo";
import { useT } from "@/i18n";
import { Txt, Button, Logo, PasswordInput } from "@/components/ui";
import { GoogleButton } from "@/components/GoogleButton";
import { colors } from "@/theme";

const inputClass = "bg-surface border border-sand-200 text-ink-900 rounded-2xl px-4 py-4";
const passwordShellClass = "flex-row items-center gap-2.5 bg-surface border border-sand-200 rounded-2xl px-4 py-4";
const inputFont = { fontFamily: "Manrope_400Regular" };

export default function SignUp() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const t = useT();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSignUp() {
    if (!isLoaded || busy) return;
    setError(null);
    setBusy(true);
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err) {
      setError(
        (err as { errors?: { message?: string }[] })?.errors?.[0]?.message ?? t("auth.signUpFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    if (!isLoaded || busy) return;
    setError(null);
    setBusy(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setError(t("auth.signUpFailed"));
      }
    } catch (err) {
      setError(
        (err as { errors?: { message?: string }[] })?.errors?.[0]?.message ?? t("auth.signUpFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-body">
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }} keyboardShouldPersistTaps="handled">
          <View className="items-center mb-8">
            <Logo size={64} />
            <Txt font="display" weight="bold" className="text-ink-900 text-3xl mt-4">
              {t("auth.createAccount")}
            </Txt>
          </View>

          {!pendingVerification ? (
            <View className="gap-3">
              <TextInput
                className={inputClass}
                style={inputFont}
                placeholder={t("auth.email")}
                placeholderTextColor={colors.ink400}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <PasswordInput
                containerClassName={passwordShellClass}
                placeholder={t("auth.password")}
                placeholderTextColor={colors.ink400}
                value={password}
                onChangeText={setPassword}
              />
              {error ? <Txt className="text-coral-700 text-sm">{error}</Txt> : null}
              <Button label={t("auth.continue")} onPress={onSignUp} loading={busy} />

              <View className="flex-row items-center gap-3 my-1">
                <View className="flex-1 h-px bg-sand-200" />
                <Txt className="text-ink-400 text-xs">{t("auth.orDivider")}</Txt>
                <View className="flex-1 h-px bg-sand-200" />
              </View>

              <GoogleButton onError={setError} />

              <View className="flex-row justify-center mt-6">
                <Txt className="text-ink-500">{t("auth.haveAccount")}</Txt>
                <Link href="/(auth)/sign-in" asChild>
                  <Txt weight="semibold" className="text-teal-600">{t("auth.signIn")}</Txt>
                </Link>
              </View>
            </View>
          ) : (
            <View className="gap-3">
              <Txt className="text-ink-500 text-center">
                {t("auth.verifyPrompt")} {email}
              </Txt>
              <TextInput
                className={inputClass}
                style={inputFont}
                placeholder={t("auth.verifyCode")}
                placeholderTextColor={colors.ink400}
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
              />
              {error ? <Txt className="text-coral-700 text-sm">{error}</Txt> : null}
              <Button label={t("auth.verify")} onPress={onVerify} loading={busy} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
