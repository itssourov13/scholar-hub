import { useState } from "react";
import { View, ScrollView, ActivityIndicator, Pressable, Linking } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { RequiredDocuments } from "@scholarhub/shared";
import { useApi } from "@/lib/api";
import { useT } from "@/i18n";
import { useBookmarks } from "@/lib/bookmarks";
import { isExpired } from "@/lib/deadline";
import { useRateAppEngagement } from "@/lib/rate-app";
import { Txt, Button, Card } from "@/components/ui";
import { CoverArt } from "@/components/CoverArt";
import { colors } from "@/theme";

/** Split a free-text summary into list items on newlines / bullets. */
function toList(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n|(?:^|\s)[•\-*]\s+/g)
    .map((s) => s.replace(/^[•\-*]\s*/, "").trim())
    .filter((s) => s.length > 0);
}

function Stat({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  return (
    <View className="flex-1 bg-body border border-sand-200 rounded-[14px] p-3 items-center">
      <Ionicons name={icon} size={18} color={colors.teal600} />
      <Txt weight="bold" className="text-ink-900 text-[13px] mt-1.5 text-center" numberOfLines={1}>{value}</Txt>
    </View>
  );
}

function BulletSection({
  title,
  text,
  icon,
  tint,
}: {
  title: string;
  text: string | null | undefined;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
}) {
  const items = toList(text);
  if (items.length === 0) return null;
  return (
    <View className="mt-[22px]">
      <Txt weight="bold" className="text-teal-600 text-xs uppercase" style={{ letterSpacing: 0.7 }}>{title}</Txt>
      <View className="mt-2 gap-2.5">
        {items.map((it, i) => (
          <View key={i} className="flex-row gap-2.5">
            <Ionicons name={icon} size={17} color={tint} style={{ marginTop: 2 }} />
            <Txt className="text-ink-700 text-[14px] leading-[21px] flex-1">{it}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

function DocList({ title, items, tone }: { title: string; items: string[]; tone: "teal" | "coral" }) {
  if (items.length === 0) return null;
  const dot = tone === "teal" ? colors.teal500 : colors.coral500;
  return (
    <View className="mb-3">
      <Txt weight="bold" className="text-ink-400 text-xs uppercase tracking-wide mb-2">{title}</Txt>
      {items.map((doc, i) => (
        <View key={i} className="flex-row gap-2.5 mb-1.5">
          <Ionicons name="checkmark-circle" size={18} color={dot} style={{ marginTop: 1 }} />
          <Txt className="text-ink-800 flex-1 leading-5">{doc}</Txt>
        </View>
      ))}
    </View>
  );
}

export default function ScholarshipDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { has, toggle } = useBookmarks();
  useRateAppEngagement();
  const [docs, setDocs] = useState<RequiredDocuments | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["scholarship", id],
    queryFn: () => api.getScholarship(id),
    enabled: !!id,
  });

  const docsMutation = useMutation({
    mutationFn: () => api.getScholarshipDocuments(id),
    onSuccess: (res) => setDocs(res.documents),
  });

  const s = data?.scholarship;
  const bookmarked = !!id && has(id);

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color={colors.teal500} />
      </View>
    );
  }
  if (isError || !s) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center px-8">
        <Txt className="text-ink-500 text-center">{t("detail.notFound")}</Txt>
        <View className="mt-4 w-40">
          <Button label={t("common.close")} variant="outline" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const upcoming = s.is_live === false;
  const closed = !upcoming && isExpired(s.deadline);
  const deadlineLabel = upcoming
    ? s.opening_note
      ? `${t("discover.opensPrefix")} ${s.opening_note}`
      : t("discover.openingSoon")
    : closed
      ? s.deadline
        ? `${t("discover.closed")} · ${s.deadline}`
        : t("discover.closed")
      : s.deadline
        ? `${t("detail.deadlineLabel")} ${s.deadline}`
        : t("detail.rolling");

  return (
    <View className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <CoverArt uri={s.thumbnail_url} tintKey={s.id} style={{ height: 210 + insets.top, paddingTop: insets.top }}>
          <Ionicons name="business-outline" size={64} color="rgba(255,255,255,0.35)" style={{ position: "absolute", right: 20, top: insets.top + 40 }} />
          <View className="flex-1 justify-between p-4">
            <View className="flex-row justify-between">
              <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-full bg-white/95 items-center justify-center">
                <Ionicons name="arrow-back" size={20} color={colors.ink900} />
              </Pressable>
              <Pressable onPress={() => toggle(s.id)} className="w-10 h-10 rounded-full bg-white/95 items-center justify-center">
                <Ionicons name={bookmarked ? "bookmark" : "bookmark-outline"} size={20} color={colors.teal600} />
              </Pressable>
            </View>
            <View className="flex-row">
              <View className="bg-white/95 rounded-full px-2.5 py-1">
                <Txt weight="bold" className={upcoming ? "text-teal-700 text-[11px]" : "text-coral-700 text-[11px]"}>{deadlineLabel}</Txt>
              </View>
            </View>
          </View>
        </CoverArt>

        <View className="px-5 pt-5">
          {s.country ? (
            <Txt weight="bold" className="text-ink-400 text-[10px] uppercase" style={{ letterSpacing: 0.8 }}>{s.country}</Txt>
          ) : null}
          <Txt font="display" weight="semibold" className="text-ink-900 text-2xl leading-[30px] mt-1.5">{s.title}</Txt>

          <View className="flex-row gap-2.5 mt-4">
            <Stat icon="cash-outline" value={s.funding_type ?? "—"} />
            <Stat icon="school-outline" value={s.degree_level ?? "—"} />
            <Stat icon="calendar-outline" value={s.deadline ?? t("detail.rolling")} />
          </View>

          {/* About */}
          {(s.ai_summary || s.raw_description) ? (
            <View className="mt-6">
              <Txt weight="bold" className="text-teal-600 text-xs uppercase" style={{ letterSpacing: 0.7 }}>{t("detail.about")}</Txt>
              <Txt className="text-ink-700 text-[14.5px] leading-[24px] mt-2">{s.ai_summary ?? s.raw_description}</Txt>
            </View>
          ) : null}

          <BulletSection title={t("detail.eligibility")} text={s.eligibility_summary} icon="checkmark-circle" tint={colors.teal500} />
          <BulletSection title={t("detail.benefits")} text={s.tips} icon="gift-outline" tint={colors.coral500} />

          {/* AI document checklist */}
          <View className="mt-6">
            <Txt weight="bold" className="text-teal-600 text-xs uppercase" style={{ letterSpacing: 0.7 }}>{t("detail.requiredDocuments")}</Txt>
            <View className="mt-2.5">
              {docs ? (
                <Card className="p-4">
                  <DocList tone="teal" title={t("detail.coreDocuments")} items={docs.core} />
                  <DocList tone="coral" title={t("detail.additionalDocuments")} items={docs.additional} />
                  {docs.note ? (
                    <View className="flex-row gap-2 mt-1 bg-teal-100 rounded-xl p-3">
                      <Ionicons name="bulb-outline" size={16} color={colors.teal700} />
                      <Txt className="text-teal-800 text-sm flex-1 leading-5">{docs.note}</Txt>
                    </View>
                  ) : null}
                </Card>
              ) : docsMutation.isError ? (
                <Txt className="text-coral-700">{t("detail.docsError")}</Txt>
              ) : (
                <Button
                  label={t("detail.generateDocs")}
                  variant="outline"
                  icon={<Ionicons name="document-text-outline" size={18} color={colors.teal700} />}
                  loading={docsMutation.isPending}
                  onPress={() => docsMutation.mutate()}
                />
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky apply bar */}
      <View
        style={{ paddingBottom: insets.bottom + 14 }}
        className="flex-row gap-3 px-5 pt-3.5 bg-surface border-t border-sand-200"
      >
        <Pressable
          onPress={() => toggle(s.id)}
          className="w-[52px] border border-sand-300 rounded-[15px] items-center justify-center"
        >
          <Ionicons name={bookmarked ? "bookmark" : "bookmark-outline"} size={22} color={colors.teal600} />
        </Pressable>
        {s.official_url ? (
          <View className="flex-1">
            <Button
              label={t("detail.applyNow")}
              icon={<Ionicons name="open-outline" size={18} color={colors.white} />}
              onPress={() => Linking.openURL(s.official_url as string)}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}
