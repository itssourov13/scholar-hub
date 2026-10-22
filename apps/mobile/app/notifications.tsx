import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApi } from "@/lib/api";
import { useSignedInQuery } from "@/lib/query";
import { useT } from "@/i18n";
import { Txt } from "@/components/ui";
import { colors } from "@/theme";

type Note = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconFg: string;
  title: string;
  body: string;
  href: Href;
};

export default function Notifications() {
  const api = useApi();
  const t = useT();
  const router = useRouter();

  const { data, isLoading } = useSignedInQuery({ queryKey: ["dashboard"], queryFn: () => api.getDashboard() });

  const notes: Note[] = [];
  if (data) {
    for (const s of data.bookmarksClosingSoon) {
      notes.push({
        id: `deadline-${s.id}`,
        icon: "flash",
        iconBg: colors.coral100,
        iconFg: colors.coral500,
        title: `${t("notif.deadlineTitle")}: ${s.title}`,
        body: s.deadline ? `${t("discover.closed")} · ${s.deadline}` : s.title,
        href: `/scholarship/${s.id}`,
      });
    }
    if (data.lastSession) {
      notes.push({
        id: "mentor",
        icon: "sparkles",
        iconBg: colors.teal100,
        iconFg: colors.teal600,
        title: t("notif.mentorTitle"),
        body: data.lastSession.preview ?? data.lastSession.title,
        href: "/chat",
      });
    }
    if (data.stats.newScholarshipsCount > 0) {
      notes.push({
        id: "new-sch",
        icon: "add-circle",
        iconBg: colors.teal100,
        iconFg: colors.teal600,
        title: `${data.stats.newScholarshipsCount} ${t("notif.newSchTitle")}`,
        body: t("notif.newSchBody"),
        href: "/(tabs)/scholarships",
      });
    }
    if (data.stats.readiness < 100) {
      notes.push({
        id: "profile",
        icon: "trophy",
        iconBg: colors.coral100,
        iconFg: colors.coral500,
        title: `${t("notif.profileTitle")} (${data.stats.readiness}%)`,
        body: t("notif.profileBody"),
        href: "/(tabs)/profile",
      });
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-body" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => router.back()} className="w-[38px] h-[38px] rounded-full bg-surface border border-sand-200 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color={colors.ink900} />
        </Pressable>
        <Txt font="display" weight="semibold" className="text-ink-900 text-xl">{t("notif.title")}</Txt>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.teal500} className="mt-10" />
      ) : notes.length === 0 ? (
        <View className="items-center px-8 pt-24">
          <View className="w-[70px] h-[70px] rounded-[22px] bg-sand-100 items-center justify-center">
            <Ionicons name="notifications-outline" size={34} color={colors.ink300} />
          </View>
          <Txt className="text-ink-400 text-center mt-4">{t("notif.empty")}</Txt>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 6 }} showsVerticalScrollIndicator={false}>
          {notes.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => router.push(n.href)}
              className="flex-row gap-3 bg-surface border border-sand-200 rounded-2xl p-3.5 mb-2.5"
            >
              <View className="w-[42px] h-[42px] rounded-xl items-center justify-center" style={{ backgroundColor: n.iconBg }}>
                <Ionicons name={n.icon} size={21} color={n.iconFg} />
              </View>
              <View className="flex-1">
                <Txt weight="bold" className="text-ink-900 text-sm" numberOfLines={2}>{n.title}</Txt>
                <Txt className="text-ink-500 text-[12.5px] leading-[18px] mt-1" numberOfLines={2}>{n.body}</Txt>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
