import { View, ScrollView, Pressable, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useApi } from "@/lib/api";
import { useSignedInQuery } from "@/lib/query";
import { useT } from "@/i18n";
import { useBookmarks } from "@/lib/bookmarks";
import { useRateAppEngagement } from "@/lib/rate-app";
import { Txt } from "@/components/ui";
import { colors, shadow, tintFor } from "@/theme";

function Thumb({ uri, tintKey }: { uri?: string | null; tintKey: string }) {
  if (uri) return <Image source={{ uri }} style={{ width: 52, height: 52, borderRadius: 13 }} resizeMode="cover" />;
  const [a, b] = tintFor(tintKey);
  return (
    <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 52, height: 52, borderRadius: 13, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="business" size={22} color="rgba(255,255,255,0.92)" />
    </LinearGradient>
  );
}

export default function Bookmarks() {
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const { toggle } = useBookmarks();
  useRateAppEngagement();

  const { data, isLoading } = useSignedInQuery({ queryKey: ["dashboard"], queryFn: () => api.getDashboard() });
  const bookmarks = data?.bookmarks ?? [];

  return (
    <SafeAreaView className="flex-1 bg-body" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => router.back()} className="w-[38px] h-[38px] rounded-full bg-surface border border-sand-200 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color={colors.ink900} />
        </Pressable>
        <Txt font="display" weight="semibold" className="text-ink-900 text-xl">{t("bookmarks.title")}</Txt>
        {bookmarks.length > 0 ? (
          <View className="bg-teal-100 rounded-full px-2.5 py-0.5">
            <Txt weight="bold" className="text-teal-700 text-xs">{bookmarks.length}</Txt>
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.teal500} className="mt-10" />
      ) : bookmarks.length === 0 ? (
        <View className="items-center px-8 pt-20">
          <View className="w-[70px] h-[70px] rounded-[22px] bg-sand-100 items-center justify-center">
            <Ionicons name="bookmark-outline" size={34} color={colors.ink300} />
          </View>
          <Txt font="display" weight="semibold" className="text-ink-900 text-lg mt-4">{t("bookmarks.emptyTitle")}</Txt>
          <Txt className="text-ink-400 text-[13px] leading-5 text-center mt-1.5">{t("bookmarks.emptyBody")}</Txt>
          <Pressable onPress={() => router.push("/(tabs)/scholarships")} className="bg-teal-500 rounded-full px-5 py-3 mt-4">
            <Txt weight="bold" className="text-white text-sm">{t("bookmarks.browse")}</Txt>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
          {bookmarks.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => router.push(`/scholarship/${b.id}`)}
              style={shadow.sm}
              className="flex-row items-center gap-3 bg-surface border border-sand-200 rounded-2xl p-3 mb-2.5"
            >
              <Thumb uri={b.thumbnail_url} tintKey={b.id} />
              <View className="flex-1">
                <Txt weight="bold" className="text-ink-900 text-sm leading-[18px]" numberOfLines={2}>{b.title}</Txt>
                <Txt className="text-ink-400 text-xs mt-1">{[b.country, b.deadline].filter(Boolean).join(" · ")}</Txt>
              </View>
              <Pressable hitSlop={10} onPress={() => toggle(b.id)} className="p-1.5">
                <Ionicons name="bookmark" size={20} color={colors.teal600} />
              </Pressable>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
