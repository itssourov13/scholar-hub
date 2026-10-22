import { useState } from "react";
import { View, TextInput, KeyboardAvoidingView, ScrollView, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSignIn } from "@clerk/clerk-expo";
import { useLang, useT } from "@/i18n";
import { Txt, Button, Logo, PasswordInput } from "@/components/ui";
import { GoogleButton } from "@/components/GoogleButton";
import { colors, gradients, shadow } from "@/theme";

export default function SignIn() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const t = useT();
  const { lang, setLang } = useLang();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const langLabel = lang === "en" ? "বাংলা" : "EN";

  async function onSubmit() {
    if (!isLoaded || busy) return;
    setError(null);
    setBusy(true);
    try {
      const attempt = await signIn.create({ identifier: email.trim(), password });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/(tabs)");
      } else if (attempt.status === "needs_second_factor") {
        setError(t("auth.twoFactorUnsupported"));
      } else {
        setError(t("auth.signInFailed"));
      }
    } catch (err) {
      setError((err as { errors?: { message?: string }[] })?.errors?.[0]?.message ?? t("auth.signInFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <LinearGradient colors={gradients.signin} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView className="flex-1">
        <Pressable
          onPress={() => setLang(lang === "en" ? "bn" : "en")}
          // Absolute children ignore the SafeAreaView padding, so offset by the
          // status-bar inset explicitly.
          style={{ top: insets.top + 10 }}
          className="absolute right-5 z-10 flex-row items-center gap-1.5 bg-white/80 border border-sand-200 rounded-full px-3 py-2"
        >
          <Ionicons name="globe-outline" size={15} color={colors.ink700} />
          <Txt weight="bold" className="text-ink-700 text-xs">{langLabel}</Txt>
        </Pressable>

        <KeyboardAvoidingView className="flex-1" behavior="padding">
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 30 }} keyboardShouldPersistTaps="handled">
            {/* Brand */}
            <View className="flex-row items-center gap-3 mb-8">
              <View style={shadow.sm} className="w-14 h-14 rounded-[18px] bg-surface items-center justify-center p-2">
                <Logo size={40} />
              </View>
              <View>
                <Txt font="display" weight="bold" className="text-ink-900 text-[22px]">ScholarHub</Txt>
                <Txt weight="semibold" className="text-teal-600 text-xs mt-0.5">{t("auth.tagline")}</Txt>
              </View>
            </View>

            <Txt font="display" weight="bold" className="text-ink-900 text-[34px] leading-[38px]">{t("auth.heroTitle")}</Txt>
            <Txt className="text-ink-500 text-[15px] leading-[23px] mt-3">{t("auth.heroSub")}</Txt>

            <View className="gap-3 mt-7">
              <View style={shadow.sm} className="flex-row items-center gap-2.5 bg-surface border border-sand-200 rounded-2xl px-4 py-3.5">
                <Ionicons name="mail-outline" size={19} color={colors.ink400} />
                <TextInput
                  className="flex-1 text-ink-900 p-0"
                  style={{ fontFamily: "Manrope_400Regular", fontSize: 15 }}
                  placeholder={t("auth.email")}
                  placeholderTextColor={colors.ink400}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
              <PasswordInput
                containerStyle={shadow.sm}
                leadingIcon="lock-closed-outline"
                style={{ fontSize: 15 }}
                placeholder={t("auth.password")}
                placeholderTextColor={colors.ink400}
                value={password}
                onChangeText={setPassword}
              />

              {error ? <Txt className="text-coral-700 text-sm">{error}</Txt> : null}

              <Button label={t("auth.signIn")} onPress={onSubmit} loading={busy} />

              <View className="flex-row items-center gap-3 my-1">
                <View className="flex-1 h-px bg-sand-200" />
                <Txt className="text-ink-400 text-xs">{t("auth.orDivider")}</Txt>
                <View className="flex-1 h-px bg-sand-200" />
              </View>

              <GoogleButton onError={setError} />
            </View>

            <View className="flex-row justify-center mt-8">
              <Txt className="text-ink-500">{t("auth.noAccount")}</Txt>
              <Link href="/(auth)/sign-up" asChild>
                <Txt weight="bold" className="text-teal-600">{t("auth.signUp")}</Txt>
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
