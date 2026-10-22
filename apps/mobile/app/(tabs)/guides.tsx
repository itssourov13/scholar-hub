import { View, ScrollView, Pressable, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import type { Guide } from "@scholarhub/shared";
import { useApi } from "@/lib/api";
import { useRateAppEngagement } from "@/lib/rate-app";
import { useT } from "@/i18n";
import { Txt } from "@/components/ui";
import { colors, gradients, shadow, tintFor } from "@/theme";

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  scholarships: "earth-outline",
  applications: "documents-outline",
  destinations: "flag-outline",
  visa: "airplane-outline",
  test: "school-outline",
};

function iconFor(category: string | null): keyof typeof Ionicons.glyphMap {
  return CATEGORY_ICON[(category ?? "").toLowerCase()] ?? "book-outline";
}

function GuideCard({ guide, onPress }: { guide: Guide; onPress: () => void }) {
  const t = useT();
  const [a, b] = tintFor(guide.slug);
  return (
    <Pressable onPress={onPress} style={shadow.sm} className="bg-surface border border-sand-200 rounded-[18px] overflow-hidden mb-3.5">
      {guide.cover_image_url ? (
        <Image source={{ uri: guide.cover_image_url }} style={{ height: 128, width: "100%", backgroundColor: colors.sand100 }} resizeMode="cover" />
      ) : (
        <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 96, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={iconFor(guide.category)} size={34} color="rgba(255,255,255,0.9)" />
        </LinearGradient>
      )}
      <View className="p-4">
        <View className="flex-row items-center justify-between">
          {guide.category ? (
            <View className="bg-teal-100 rounded-full px-2.5 py-1">
              <Txt weight="bold" className="text-teal-700 text-[10px] uppercase" style={{ letterSpacing: 0.5 }}>{guide.category}</Txt>
            </View>
          ) : <View />}
          {guide.faqs && guide.faqs.length > 0 ? (
            <Txt weight="semibold" className="text-ink-400 text-[11px]">{guide.faqs.length} {t("guides.faqs")}</Txt>
          ) : null}
        </View>
        <Txt font="display" weight="semibold" className="text-ink-900 text-base leading-[21px] mt-2.5">{guide.title}</Txt>
        {guide.description ? (
          <Txt className="text-ink-500 text-[13px] leading-[19px] mt-1.5" numberOfLines={2}>{guide.description}</Txt>
        ) : null}
        <View className="flex-row items-center gap-1.5 mt-3">
          <Txt weight="bold" className="text-teal-600 text-[13px]">{t("guides.readMore")}</Txt>
          <Ionicons name="arrow-forward" size={14} color={colors.teal600} />
        </View>
      </View>
    </Pressable>
  );
}

export default function Guides() {
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useRateAppEngagement();

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["guides"], queryFn: () => api.getGuides() });
  const guides = data?.guides ?? [];

  return (
    <View className="flex-1 bg-body">
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <LinearGradient
          colors={gradients.guides}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + 20, paddingBottom: 26, paddingHorizontal: 20 }}
        >
          <Txt weight="bold" className="text-teal-200 text-[11px] uppercase" style={{ letterSpacing: 1.2 }}>{t("guides.knowledgeHub")}</Txt>
          <Txt font="display" weight="semibold" className="text-white text-[26px] leading-[30px] mt-2">{t("guides.title")}</Txt>
          <Txt className="text-white/80 text-[13.5px] leading-[20px] mt-2">{t("guides.subtitle")}</Txt>
        </LinearGradient>

        <View className="px-[18px] pt-4">
          {isLoading ? (
            <ActivityIndicator color={colors.teal500} className="mt-10" />
          ) : isError ? (
            <View className="items-center mt-8">
              <Ionicons name="cloud-offline-outline" size={38} color={colors.ink400} />
              <Txt className="text-ink-500 text-center mt-3">{t("guides.loadError")}</Txt>
              <Pressable onPress={() => refetch()} className="mt-4 bg-teal-500 rounded-full px-5 py-2.5">
                <Txt weight="bold" className="text-white text-sm">{t("common.retry")}</Txt>
              </Pressable>
            </View>
          ) : (
            guides.map((g) => (
              <GuideCard
                key={g.slug}
                guide={g}
                onPress={() => router.push(`/guide/${g.slug}`)}
              />
            ))
          )}

          {/* Ask mentor CTA */}
          <Pressable
            onPress={() => router.push("/chat")}
            className="mt-1.5 bg-surface border border-sand-200 rounded-[18px] p-5 items-center"
          >
            <Txt font="display" weight="semibold" className="text-ink-900 text-lg text-center">{t("guides.askTitle")}</Txt>
            <Txt className="text-ink-500 text-[13px] leading-[19px] text-center mt-1.5">{t("guides.askSub")}</Txt>
            <View className="flex-row items-center gap-2 bg-teal-500 rounded-full px-5 py-3 mt-3.5">
              <Ionicons name="sparkles" size={16} color={colors.white} />
              <Txt weight="bold" className="text-white text-sm">{t("guides.talkMentor")}</Txt>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
