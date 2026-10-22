import { useMemo, useState } from "react";
import { View, FlatList, TextInput, Pressable, Modal, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import type { ScholarshipListItem } from "@scholarhub/shared";
import { useApi } from "@/lib/api";
import { useT } from "@/i18n";
import { useBookmarks } from "@/lib/bookmarks";
import { isClosingSoon, isExpired, isRecentlyClosed, sortByDeadline } from "@/lib/deadline";
import { useRateAppEngagement } from "@/lib/rate-app";
import { Txt, Button } from "@/components/ui";
import { CoverArt } from "@/components/CoverArt";
import { colors, shadow } from "@/theme";

type Facets = { country: Set<string>; funding: Set<string>; level: Set<string> };

function uniqueSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort();
}

const LEVEL_MAP: Record<string, string> = {
  bachelors: "Bachelors",
  masters: "Masters",
  phd: "PhD",
  postdoc: "Postdoc",
  any: "Any",
};

// Canonical order/subset shown in the Level filter.
const LEVEL_FILTER_ORDER = ["Any", "Bachelors", "Masters", "PhD"];

// Some records store combined values like "masters | phd" or "masters, phd"
// instead of a single enum value. Split those into their constituent levels
// so they can be matched against the (single-value) Level filter options —
// mirrors the same fix applied on the web app.
function normalizeLevels(raw: string | null): string[] {
  if (!raw) return [];
  const tokens = raw
    .toLowerCase()
    .split(/[|,/]|\band\b|\bor\b/i)
    .map((t) => t.trim())
    .filter(Boolean);
  const labels = tokens
    .map((tok) => LEVEL_MAP[tok])
    .filter((label): label is string => Boolean(label));
  if (labels.length) return Array.from(new Set(labels));
  const fallback = LEVEL_MAP[raw.toLowerCase().trim()] ?? raw;
  return [fallback];
}

function ScholarshipCard({
  item,
  closed,
  upcoming,
  onOpen,
}: {
  item: ScholarshipListItem;
  closed?: boolean;
  upcoming?: boolean;
  onOpen: () => void;
}) {
  const t = useT();
  const { has, toggle } = useBookmarks();
  const bookmarked = has(item.id);
  const closingSoon = !closed && !upcoming && isClosingSoon(item.deadline);
  const deadlineLabel = upcoming
    ? item.opening_note
      ? `${t("discover.opensPrefix")} ${item.opening_note}`
      : t("discover.openingSoon")
    : closed
      ? item.deadline
        ? `${t("discover.closed")} · ${item.deadline}`
        : t("discover.closed")
      : item.deadline
        ? `${t("detail.deadlineLabel")} ${item.deadline}`
        : t("detail.rolling");

  return (
    <Pressable
      onPress={onOpen}
      style={[shadow.sm, closed ? { opacity: 0.72 } : null]}
      className="bg-surface border border-sand-200 rounded-[20px] overflow-hidden mb-3.5"
    >
      <CoverArt uri={item.thumbnail_url} tintKey={item.id} style={{ height: 112, justifyContent: "flex-end", padding: 12 }}>
        <Ionicons name="business-outline" size={30} color="rgba(255,255,255,0.5)" style={{ position: "absolute", right: 14, top: 12 }} />
        <View className="flex-row">
          <View className="flex-row items-center gap-1 bg-white/95 rounded-full px-2.5 py-1">
            {closingSoon ? <Ionicons name="flash" size={12} color={colors.coral700} /> : null}
            <Txt weight="bold" className={upcoming ? "text-teal-700 text-[11px]" : "text-coral-700 text-[11px]"}>{deadlineLabel}</Txt>
          </View>
        </View>
        {!closed ? (
          <Pressable
            hitSlop={8}
            onPress={() => toggle(item.id)}
            className="absolute right-3 bottom-3 w-[34px] h-[34px] rounded-full bg-white/95 items-center justify-center"
          >
            <Ionicons name={bookmarked ? "bookmark" : "bookmark-outline"} size={18} color={colors.teal600} />
          </Pressable>
        ) : null}
      </CoverArt>
      <View className="p-3.5">
        {item.country ? (
          <Txt weight="bold" className="text-ink-400 text-[10px] uppercase" style={{ letterSpacing: 0.8 }}>{item.country}</Txt>
        ) : null}
        <Txt font="display" weight="semibold" className="text-ink-900 text-[16.5px] leading-[21px] mt-1.5">{item.title}</Txt>
        {(item.degree_level || item.funding_type) ? (
          <Txt className="text-ink-500 text-[12.5px] mt-1.5">
            {[item.degree_level, item.funding_type].filter(Boolean).join(" · ")}
          </Txt>
        ) : null}
        {item.tags && item.tags.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5 mt-2.5">
            {item.tags.slice(0, 3).map((tg, i) => (
              <View key={i} className="bg-sand-100 rounded-full px-2.5 py-1">
                <Txt weight="semibold" className="text-ink-700 text-[11px]">{tg}</Txt>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function FilterGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <View className="mb-5">
      <Txt weight="bold" className="text-ink-700 text-[13px] mb-3">{label}</Txt>
      <View className="flex-row flex-wrap gap-2.5">
        {options.map((opt) => {
          const on = selected.has(opt);
          return (
            <Pressable
              key={opt}
              onPress={() => onToggle(opt)}
              className={on ? "bg-teal-500 rounded-full px-4 py-2.5" : "bg-surface border border-sand-200 rounded-full px-4 py-2.5"}
            >
              <Txt weight="semibold" className={on ? "text-white text-[13px]" : "text-ink-700 text-[13px]"}>{opt}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function Scholarships() {
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [facets, setFacets] = useState<Facets>({ country: new Set(), funding: new Set(), level: new Set() });
  useRateAppEngagement();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["scholarships"],
    queryFn: () => api.getScholarships(),
  });

  const all = useMemo(() => data?.scholarships ?? [], [data]);
  const options = useMemo(
    () => ({
      country: uniqueSorted(all.map((s) => s.country)),
      funding: uniqueSorted(all.map((s) => s.funding_type)),
      level: (() => {
        const present = new Set(all.flatMap((s) => normalizeLevels(s.degree_level)));
        return LEVEL_FILTER_ORDER.filter((lvl) => present.has(lvl));
      })(),
    }),
    [all],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((s) => {
      const levelLabels = normalizeLevels(s.degree_level);
      return (
        (facets.country.size === 0 || (s.country && facets.country.has(s.country))) &&
        (facets.funding.size === 0 || (s.funding_type && facets.funding.has(s.funding_type))) &&
        (facets.level.size === 0 || levelLabels.some((l) => facets.level.has(l))) &&
        (!q || s.title.toLowerCase().includes(q) || (s.country ?? "").toLowerCase().includes(q))
      );
    });
  }, [all, facets, query]);

  // Mirror the web's buckets: live = is_live and deadline not passed;
  // upcoming = is_live false; recently closed = live but expired within ~90d.
  // Each bucket is then sorted by deadline (soonest first, flagship pinned
  // to top), matching the web app's default "Deadline" sort.
  const open = sortByDeadline(filtered.filter((s) => s.is_live !== false && !isExpired(s.deadline)));
  const upcoming = sortByDeadline(filtered.filter((s) => s.is_live === false));
  const closed = sortByDeadline(filtered.filter((s) => s.is_live !== false && isRecentlyClosed(s.deadline)));
  const activeCount = facets.country.size + facets.funding.size + facets.level.size;

  function toggle(key: keyof Facets, value: string) {
    setFacets((prev) => {
      const next = new Set(prev[key]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [key]: next };
    });
  }
  const clearAll = () => setFacets({ country: new Set(), funding: new Set(), level: new Set() });

  const header = (
    <View>
      <Txt font="display" weight="semibold" className="text-ink-900 text-[23px]">{t("discover.title")}</Txt>
      <View className="flex-row gap-2.5 mt-3.5">
        <View className="flex-1 flex-row items-center gap-2 bg-surface border border-sand-200 rounded-[14px] px-3.5 py-3">
          <Ionicons name="search-outline" size={18} color={colors.ink400} />
          <TextInput
            className="flex-1 text-ink-900 p-0"
            style={{ fontFamily: "Manrope_400Regular", fontSize: 14 }}
            placeholder={t("discover.searchPh")}
            placeholderTextColor={colors.ink400}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <Pressable
          onPress={() => setFilterOpen(true)}
          className="w-12 bg-teal-500 rounded-[14px] items-center justify-center"
        >
          <Ionicons name="options-outline" size={21} color={colors.white} />
          {activeCount > 0 ? (
            <View className="absolute -top-1.5 -right-1.5 min-w-[19px] h-[19px] px-1 rounded-full bg-coral-500 items-center justify-center">
              <Txt weight="bold" className="text-white text-[11px]">{activeCount}</Txt>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Totals up front — otherwise the "Open Now" count reads as the whole
          catalogue. */}
      <View className="flex-row gap-2.5 mt-4">
        <View className="flex-1 bg-surface border border-sand-200 rounded-[14px] py-2.5 items-center">
          <Txt font="display" weight="bold" className="text-ink-900 text-[18px]">{all.length}</Txt>
          <Txt className="text-ink-400 text-[11px] mt-0.5">{t("discover.tracked")}</Txt>
        </View>
        <View className="flex-1 bg-surface border border-sand-200 rounded-[14px] py-2.5 items-center">
          <Txt font="display" weight="bold" className="text-teal-600 text-[18px]">{open.length}</Txt>
          <Txt className="text-ink-400 text-[11px] mt-0.5">{t("discover.openNow")}</Txt>
        </View>
        <View className="flex-1 bg-surface border border-sand-200 rounded-[14px] py-2.5 items-center">
          <Txt font="display" weight="bold" className="text-coral-500 text-[18px]">{upcoming.length}</Txt>
          <Txt className="text-ink-400 text-[11px] mt-0.5">{t("discover.openingSoon")}</Txt>
        </View>
      </View>

      <View className="flex-row items-center gap-2 mt-4 mb-3">
        <View className="w-2 h-2 rounded-full bg-teal-500" />
        <Txt font="display" weight="semibold" className="text-ink-900 text-[15px]">{t("discover.openNow")}</Txt>
        <View className="bg-teal-100 rounded-full px-2 py-0.5">
          <Txt weight="bold" className="text-teal-700 text-[11px]">{open.length}</Txt>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-body items-center justify-center" edges={["top"]}>
        <ActivityIndicator color={colors.teal500} />
      </SafeAreaView>
    );
  }
  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-body items-center justify-center px-8" edges={["top"]}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.ink400} />
        <Txt className="text-ink-500 text-center mt-3">{t("discover.loadError")}</Txt>
        <View className="mt-4 w-40">
          <Button label={t("common.retry")} variant="outline" onPress={() => refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-body" edges={["top"]}>
      <FlatList
        data={open}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ScholarshipCard item={item} onOpen={() => router.push(`/scholarship/${item.id}`)} />
        )}
        contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.teal500} />}
        ListHeaderComponent={header}
        ListEmptyComponent={<Txt className="text-ink-400 text-center mt-6">{t("discover.empty")}</Txt>}
        ListFooterComponent={
          <View>
            {upcoming.length > 0 ? (
              <View className="mt-2">
                <View className="flex-row items-center gap-2 mb-3">
                  <View className="w-2 h-2 rounded-full bg-teal-300" />
                  <Txt font="display" weight="semibold" className="text-ink-900 text-[15px]">{t("discover.openingSoon")}</Txt>
                  <View className="bg-sand-100 rounded-full px-2 py-0.5">
                    <Txt weight="bold" className="text-ink-500 text-[11px]">{upcoming.length}</Txt>
                  </View>
                </View>
                {upcoming.map((item) => (
                  <ScholarshipCard key={item.id} item={item} upcoming onOpen={() => router.push(`/scholarship/${item.id}`)} />
                ))}
              </View>
            ) : null}
            {closed.length > 0 ? (
              <View className="mt-2">
                <View className="flex-row items-center gap-2 mb-3">
                  <View className="w-2 h-2 rounded-full bg-coral-400" />
                  <Txt font="display" weight="semibold" className="text-ink-900 text-[15px]">{t("discover.recentlyClosed")}</Txt>
                </View>
                {closed.map((item) => (
                  <ScholarshipCard key={item.id} item={item} closed onOpen={() => router.push(`/scholarship/${item.id}`)} />
                ))}
              </View>
            ) : null}
          </View>
        }
      />

      {/* Filter sheet */}
      <Modal visible={filterOpen} animationType="slide" transparent onRequestClose={() => setFilterOpen(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setFilterOpen(false)} />
        <View style={shadow.md} className="bg-body rounded-t-[26px] max-h-[80%] absolute bottom-0 left-0 right-0 pt-3">
          <View className="items-center pb-1">
            <View className="w-10 h-1.5 rounded-full bg-sand-300" />
          </View>
          <View className="flex-row items-center justify-between px-5 py-3">
            <Txt font="display" weight="semibold" className="text-ink-900 text-xl">{t("discover.filters")}</Txt>
            <Pressable onPress={clearAll}>
              <Txt weight="medium" className="text-ink-500">{t("discover.clear")}</Txt>
            </Pressable>
          </View>
          <ScrollView className="px-5">
            <FilterGroup label={t("discover.filterCountry")} options={options.country} selected={facets.country} onToggle={(v) => toggle("country", v)} />
            <FilterGroup label={t("discover.filterFunding")} options={options.funding} selected={facets.funding} onToggle={(v) => toggle("funding", v)} />
            <FilterGroup label={t("discover.filterDegree")} options={options.level} selected={facets.level} onToggle={(v) => toggle("level", v)} />
          </ScrollView>
          <SafeAreaView edges={["bottom"]} className="px-5 pt-2 pb-3">
            <Button label={`${t("discover.showResults")} (${filtered.length})`} onPress={() => setFilterOpen(false)} />
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
