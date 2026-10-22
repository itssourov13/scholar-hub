import { useState } from "react";
import { View, ScrollView, Pressable, Image, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Markdown from "react-native-markdown-display";
import { useQuery } from "@tanstack/react-query";
import type { Guide } from "@scholarhub/shared";
import { useApi } from "@/lib/api";
import { useRateAppEngagement } from "@/lib/rate-app";
import { useT } from "@/i18n";
import { Txt } from "@/components/ui";
import { colors, fonts } from "@/theme";

const md = {
  body: { fontFamily: fonts.bengali, fontSize: 15, lineHeight: 25, color: colors.ink700 },
  heading1: { fontFamily: fonts.bengaliSemibold, fontSize: 22, lineHeight: 30, color: colors.ink900, marginTop: 18, marginBottom: 6 },
  heading2: { fontFamily: fonts.bengaliSemibold, fontSize: 19, lineHeight: 26, color: colors.ink900, marginTop: 16, marginBottom: 6 },
  heading3: { fontFamily: fonts.bengaliSemibold, fontSize: 16, lineHeight: 23, color: colors.ink900, marginTop: 12, marginBottom: 4 },
  strong: { fontFamily: fonts.bengaliBold, color: colors.ink900 },
  link: { color: colors.teal600, textDecorationLine: "underline" as const },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 3 },
  blockquote: { backgroundColor: colors.teal100, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderLeftWidth: 3, borderLeftColor: colors.teal500 },
  code_inline: { backgroundColor: colors.sand100, borderRadius: 6, paddingHorizontal: 4, fontFamily: "monospace" as const },
  hr: { backgroundColor: colors.sand200, height: 1, marginVertical: 16 },
  table: { borderColor: colors.sand200, borderRadius: 8 },
  th: { fontFamily: fonts.bengaliSemibold, padding: 6 },
  td: { padding: 6, borderColor: colors.sand200 },
};

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((v) => !v)} className="bg-surface border border-sand-200 rounded-2xl px-4 py-3.5 mb-2.5">
      <View className="flex-row items-center gap-3">
        <Txt weight="semibold" className="flex-1 text-ink-900 text-[14.5px] leading-5">{q}</Txt>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.ink400} />
      </View>
      {open ? <Txt className="text-ink-600 text-[13.5px] leading-[21px] mt-2.5">{a}</Txt> : null}
    </Pressable>
  );
}

export default function GuideDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useRateAppEngagement();

  // Fetched by slug directly rather than found in the ["guides"] list: that
  // list is CDN-cached for 5 minutes, so a guide published moments ago —
  // exactly the case when this screen was opened from its own push
  // notification — could still 404 there. The list query stays around only
  // to populate "related guides" below.
  const { data, isLoading } = useQuery({
    queryKey: ["guide", slug],
    queryFn: () => api.getGuide(slug!),
    enabled: !!slug,
    retry: false,
  });
  const guide: Guide | undefined = data?.guide;

  const { data: listData } = useQuery({ queryKey: ["guides"], queryFn: () => api.getGuides() });
  const related = (listData?.guides ?? []).filter((g) => g.slug !== slug && g.category === guide?.category).slice(0, 3);

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color={colors.teal500} />
      </View>
    );
  }
  if (!guide) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center px-8">
        <Txt className="text-ink-500 text-center">{t("guide.notFound")}</Txt>
      </SafeAreaView>
    );
  }

  const updated = guide.updated_at
    ? new Date(guide.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <View className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        {/* Back button over cover */}
        <View style={{ paddingTop: insets.top + 8 }} className="px-4 pb-2 bg-surface">
          <Pressable onPress={() => router.back()} className="w-[38px] h-[38px] rounded-full bg-sand-100 items-center justify-center">
            <Ionicons name="arrow-back" size={20} color={colors.ink900} />
          </Pressable>
        </View>

        {guide.cover_image_url ? (
          <Image source={{ uri: guide.cover_image_url }} style={{ width: "100%", aspectRatio: 16 / 9 }} resizeMode="cover" />
        ) : null}

        <View className="px-5 pt-4">
          <View className="flex-row items-center gap-2">
            {guide.category ? (
              <View className="bg-teal-100 rounded-full px-2.5 py-1">
                <Txt weight="bold" className="text-teal-700 text-[10px] uppercase" style={{ letterSpacing: 0.5 }}>{guide.category}</Txt>
              </View>
            ) : null}
            {updated ? <Txt className="text-ink-400 text-[11px]">{t("guide.updated")} {updated}</Txt> : null}
          </View>

          <Txt font="display" weight="bold" className="text-ink-900 text-[26px] leading-[32px] mt-3">{guide.title}</Txt>
          {guide.intro ? <Txt className="text-ink-600 text-[15px] leading-[23px] mt-3">{guide.intro}</Txt> : null}

          {guide.tags && guide.tags.length > 0 ? (
            <View className="flex-row flex-wrap gap-2 mt-4">
              {guide.tags.map((tag, i) => (
                <View key={i} className="bg-sand-100 rounded-full px-3 py-1.5">
                  <Txt weight="medium" className="text-ink-600 text-[11px]">{tag}</Txt>
                </View>
              ))}
            </View>
          ) : null}

          {guide.content ? (
            <View className="mt-4">
              <Markdown style={md} onLinkPress={(url) => { Linking.openURL(url); return false; }}>
                {guide.content}
              </Markdown>
            </View>
          ) : null}

          {/* FAQs */}
          {guide.faqs && guide.faqs.length > 0 ? (
            <View className="mt-6">
              <View className="flex-row items-center justify-between mb-3">
                <Txt font="display" weight="semibold" className="text-ink-900 text-lg">{t("guide.faqTitle")}</Txt>
                <View className="bg-teal-100 rounded-full px-2.5 py-0.5">
                  <Txt weight="bold" className="text-teal-700 text-xs">{guide.faqs.length}</Txt>
                </View>
              </View>
              {guide.faqs.map((f, i) => (
                <Faq key={i} q={f.question} a={f.answer} />
              ))}
            </View>
          ) : null}

          {/* Ask mentor CTA */}
          <Pressable
            onPress={() => router.push("/chat")}
            className="mt-4 rounded-[18px] p-5"
            style={{ backgroundColor: colors.ink900 }}
          >
            <Txt font="display" weight="semibold" className="text-white text-base">{t("guide.askMentor")}</Txt>
            <Txt className="text-white/70 text-[13px] leading-[19px] mt-1.5">{t("guide.askMentorSub")}</Txt>
            <View className="flex-row items-center gap-1.5 mt-3">
              <Ionicons name="sparkles" size={15} color={colors.teal500} />
              <Txt weight="bold" className="text-teal-200 text-[13px]">{t("guides.talkMentor")}</Txt>
            </View>
          </Pressable>

          {/* Related */}
          {related.length > 0 ? (
            <View className="mt-6">
              <Txt weight="bold" className="text-ink-400 text-[11px] uppercase mb-2.5" style={{ letterSpacing: 0.6 }}>{t("guide.related")}</Txt>
              {related.map((g) => (
                <Pressable
                  key={g.slug}
                  onPress={() => router.push(`/guide/${g.slug}`)}
                  className="flex-row items-center gap-2 bg-surface border border-sand-200 rounded-2xl p-3.5 mb-2.5"
                >
                  <Txt weight="semibold" className="flex-1 text-ink-800 text-sm leading-[19px]" numberOfLines={2}>{g.title}</Txt>
                  <Ionicons name="arrow-forward" size={16} color={colors.teal600} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
