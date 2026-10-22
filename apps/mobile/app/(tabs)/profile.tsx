import { View, ScrollView, Pressable, Alert, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useSignedInQuery } from "@/lib/query";
import { useApi } from "@/lib/api";
import { API_BASE } from "@/lib/config";
import { useLang, useT } from "@/i18n";
import { useBookmarks } from "@/lib/bookmarks";
import { unregisterPushNotifications } from "@/lib/notifications";
import { forceReviewSheet, openStoreListing, rateDebugSummary, useRateAppPrompt } from "@/lib/rate-app";
import { Txt } from "@/components/ui";
import { colors, gradients, shadow } from "@/theme";

type MenuIcon = keyof typeof Ionicons.glyphMap;

function MenuRow({
  icon,
  label,
  onPress,
  onLongPress,
  last,
}: {
  icon: MenuIcon;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className={`flex-row items-center gap-3 p-4 ${last ? "" : "border-b border-sand-100"}`}
    >
      <Ionicons name={icon} size={20} color={colors.teal600} />
      <Txt weight="semibold" className="flex-1 text-ink-900 text-[14.5px]">{label}</Txt>
      <Ionicons name="chevron-forward" size={17} color={colors.ink300} />
    </Pressable>
  );
}

export default function Profile() {
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang, setLang } = useLang();
  const { signOut } = useAuth();
  const { user } = useUser();
  const { count: bookmarkCount } = useBookmarks();
  useRateAppPrompt();

  const { data: dash } = useSignedInQuery({ queryKey: ["dashboard"], queryFn: () => api.getDashboard() });
  const { data: cvs } = useSignedInQuery({ queryKey: ["cvs"], queryFn: () => api.getCvs() });

  // Google Play requires in-app account deletion for apps with sign-in.
  // Clerk's user.delete() removes the account; the user.deleted webhook on the
  // backend purges profile, bookmarks, CVs and chat history.
  const confirmDeleteAccount = () => {
    Alert.alert(t("profile.deleteTitle"), t("profile.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await user?.delete();
          } catch {
            Alert.alert(t("profile.deleteFailed"));
          }
        },
      },
    ]);
  };

  const onRateApp = async () => {
    if (!(await openStoreListing())) Alert.alert(t("profile.rateAppFailed"));
  };

  // Hidden long-press: Play never reports whether it showed the review sheet, so
  // this is how we tell our own gating apart from Play staying silent.
  const onRateAppDebug = async () => {
    Alert.alert("Rating diagnostics", await rateDebugSummary(), [
      { text: t("common.close"), style: "cancel" },
      {
        text: "Force sheet",
        onPress: async () => {
          if (!(await forceReviewSheet())) Alert.alert("Play review API unavailable on this device.");
        },
      },
    ]);
  };

  const name = dash?.user.name || user?.fullName || t("profile.signedIn");
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const readiness = dash?.stats.readiness ?? 0;
  const initials = name
    .split(" ")
    .map((p) => p.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const langLabel = lang === "en" ? "বাংলা" : "EN";

  return (
    <View className="flex-1 bg-body">
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <LinearGradient
          colors={gradients.profile}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + 16, paddingBottom: 30, paddingHorizontal: 20, overflow: "hidden" }}
        >
          <View className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/[0.08]" />
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3.5 flex-1">
              <LinearGradient
                colors={gradients.avatar}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" }}
              >
                <Txt font="display" weight="bold" className="text-white text-2xl">{initials || "?"}</Txt>
              </LinearGradient>
              <View className="flex-1">
                <Txt font="display" weight="semibold" className="text-white text-xl" numberOfLines={1}>{name}</Txt>
                {email ? <Txt className="text-teal-200 text-[13px] mt-0.5" numberOfLines={1}>{email}</Txt> : null}
              </View>
            </View>
            <Pressable
              onPress={() => setLang(lang === "en" ? "bn" : "en")}
              className="flex-row items-center gap-1.5 bg-white/15 rounded-full px-3 py-2 ml-2"
            >
              <Ionicons name="globe-outline" size={14} color={colors.white} />
              <Txt weight="bold" className="text-white text-xs">{langLabel}</Txt>
            </Pressable>
          </View>

          <Pressable
            onPress={() => router.push("/profile-edit")}
            accessibilityRole="button"
            accessibilityLabel={t("profile.edit")}
            className="bg-white/[0.13] rounded-2xl p-3.5 mt-4"
          >
            <View className="flex-row items-center justify-between">
              <Txt weight="semibold" className="text-teal-100 text-xs">{t("profile.complete")}</Txt>
              <View className="flex-row items-center gap-1">
                <Txt font="display" weight="bold" className="text-white text-sm">{readiness}%</Txt>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
              </View>
            </View>
            <View className="h-[7px] rounded-full bg-white/20 mt-2 overflow-hidden">
              <View style={{ height: "100%", width: `${Math.max(readiness, 4)}%`, backgroundColor: colors.white, borderRadius: 999 }} />
            </View>
          </Pressable>
        </LinearGradient>

        <View className="px-[18px] pt-4">
          {/* Stat cards */}
          <View className="flex-row gap-3">
            <Pressable onPress={() => router.push("/bookmarks")} style={shadow.sm} className="flex-1 bg-surface border border-sand-200 rounded-2xl p-4">
              <Ionicons name="bookmark" size={22} color={colors.teal600} />
              <Txt font="display" weight="bold" className="text-ink-900 text-[22px] mt-2">{bookmarkCount}</Txt>
              <Txt className="text-ink-400 text-xs">{t("profile.saved")}</Txt>
            </Pressable>
            <Pressable onPress={() => router.push("/cv")} style={shadow.sm} className="flex-1 bg-surface border border-sand-200 rounded-2xl p-4">
              <Ionicons name="document-text" size={22} color={colors.coral500} />
              <Txt font="display" weight="bold" className="text-ink-900 text-[22px] mt-2">{cvs?.cvs.length ?? 0}</Txt>
              <Txt className="text-ink-400 text-xs">{t("profile.cvDrafts")}</Txt>
            </Pressable>
          </View>

          {/* Menu */}
          <View style={shadow.sm} className="bg-surface border border-sand-200 rounded-2xl mt-3.5 overflow-hidden">
            <MenuRow icon="create-outline" label={t("profile.edit")} onPress={() => router.push("/profile-edit")} />
            <MenuRow icon="bookmark-outline" label={t("profile.myBookmarks")} onPress={() => router.push("/bookmarks")} />
            <MenuRow icon="document-text-outline" label={t("profile.myCVs")} onPress={() => router.push("/cv")} />
            <MenuRow icon="notifications-outline" label={t("profile.notifications")} onPress={() => router.push("/notifications")} />
            <MenuRow icon="star-outline" label={t("profile.rateApp")} onPress={onRateApp} onLongPress={onRateAppDebug} />
            <MenuRow icon="globe-outline" label={t("profile.language")} onPress={() => setLang(lang === "en" ? "bn" : "en")} last />
          </View>

          {/* Legal */}
          <View style={shadow.sm} className="bg-surface border border-sand-200 rounded-2xl mt-3.5 overflow-hidden">
            <MenuRow icon="shield-checkmark-outline" label={t("profile.privacy")} onPress={() => Linking.openURL(`${API_BASE}/legal/privacy`)} />
            <MenuRow icon="document-outline" label={t("profile.terms")} onPress={() => Linking.openURL(`${API_BASE}/legal/terms`)} last />
          </View>

          {/* Sign out */}
          <Pressable
            onPress={async () => {
              // Retire the device token first — after signOut there's no Clerk
              // session left to authenticate the unregister call.
              await unregisterPushNotifications(api);
              await signOut();
            }}
            style={shadow.sm}
            className="bg-surface border border-sand-200 rounded-2xl p-4 mt-3.5 items-center"
          >
            <Txt weight="bold" className="text-coral-700 text-[14.5px]">{t("profile.signOut")}</Txt>
          </Pressable>

          {/* Delete account */}
          <Pressable onPress={confirmDeleteAccount} className="p-3 mt-1 items-center">
            <Txt weight="semibold" className="text-ink-400 text-[13px]">{t("profile.deleteAccount")}</Txt>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
