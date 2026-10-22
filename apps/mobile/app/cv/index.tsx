import { View, ScrollView, Pressable, Linking, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CVTemplateId } from "@scholarhub/shared";
import { useApi } from "@/lib/api";
import { useSignedInQuery } from "@/lib/query";
import { useRateAppEngagement } from "@/lib/rate-app";
import { useT } from "@/i18n";
import { API_BASE } from "@/lib/config";
import { Txt } from "@/components/ui";
import { colors, shadow } from "@/theme";

const CV_URL = `${API_BASE}/cv-builder`;

const TEMPLATES: { id: CVTemplateId; name: string; desc: string }[] = [
  { id: "classic", name: "Classic Academic", desc: "Traditional serif, centered header." },
  { id: "europass", name: "Europass CV", desc: "Standard EU format, left date column." },
  { id: "modern", name: "Modern Academic", desc: "Clean sans-serif with a teal rail." },
  { id: "photo", name: "Spotlight", desc: "Sans-serif with a headshot beside the header." },
];

function TemplatePreview() {
  return (
    <View className="h-[120px] bg-surface border-b border-sand-100 px-3 pt-2">
      <View className="h-1.5 w-[70%] bg-ink-900 rounded-sm self-center mt-1.5 mb-1" />
      <View className="h-[3px] w-1/2 bg-sand-300 rounded-sm self-center mb-2" />
      <View className="h-0.5 bg-teal-600 mb-1.5" />
      <View className="h-[3px] w-[90%] bg-sand-200 rounded-sm mb-1" />
      <View className="h-[3px] w-[80%] bg-sand-200 rounded-sm mb-2" />
      <View className="h-[3px] w-[40%] bg-teal-600 rounded-sm mb-1" />
      <View className="h-[3px] w-[95%] bg-sand-200 rounded-sm mb-1" />
      <View className="h-[3px] w-[85%] bg-sand-200 rounded-sm" />
    </View>
  );
}

export default function CvHub() {
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  useRateAppEngagement();

  const { data, isLoading } = useSignedInQuery({ queryKey: ["cvs"], queryFn: () => api.getCvs() });
  const cvs = data?.cvs ?? [];

  const create = useMutation({
    mutationFn: (template: CVTemplateId) => api.createCv({ template }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["cvs"] });
      router.push(`/cv/${res.cv.id}`);
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteCv(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cvs"] }),
  });

  return (
    <SafeAreaView className="flex-1 bg-body" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => router.back()} className="w-[38px] h-[38px] rounded-full bg-surface border border-sand-200 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color={colors.ink900} />
        </Pressable>
        <Txt font="display" weight="semibold" className="text-ink-900 text-xl flex-1">{t("cv.title")}</Txt>
        {create.isPending ? <ActivityIndicator color={colors.teal500} /> : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 6, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient colors={[colors.coral100, colors.bgBody]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 22, borderWidth: 1, borderColor: "#f3d9cf" }}>
          <View className="self-start bg-surface rounded-full px-3 py-1.5">
            <Txt weight="bold" className="text-coral-700 text-[11px] uppercase" style={{ letterSpacing: 1 }}>✦ CV Builder</Txt>
          </View>
          <Txt font="display" weight="semibold" className="text-ink-900 text-[27px] leading-[31px] mt-3.5">
            {t("cv.heroA")} <Txt font="display" weight="semibold" className="text-teal-600 text-[27px] italic">{t("cv.heroB")}</Txt>
          </Txt>
          <Txt className="text-ink-500 text-[13.5px] leading-[21px] mt-2.5">{t("cv.heroSub")}</Txt>
        </LinearGradient>

        {/* Actions */}
        <View className="gap-3 mt-4">
          <Pressable onPress={() => create.mutate("classic")} className="flex-row items-center gap-3 bg-surface border border-sand-200 rounded-2xl p-4">
            <View className="w-11 h-11 rounded-[13px] items-center justify-center bg-teal-100"><Ionicons name="add" size={23} color={colors.teal600} /></View>
            <View className="flex-1">
              <Txt weight="bold" className="text-ink-900 text-[15px]">{t("cv.create")}</Txt>
              <Txt className="text-ink-400 text-[12.5px] mt-0.5">{t("cv.createSub")}</Txt>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink300} />
          </Pressable>
          <Pressable onPress={() => router.push("/cv/analyze")} className="flex-row items-center gap-3 bg-surface border border-sand-200 rounded-2xl p-4">
            <View className="w-11 h-11 rounded-[13px] items-center justify-center bg-coral-100"><Ionicons name="sparkles" size={22} color={colors.coral500} /></View>
            <View className="flex-1">
              <Txt weight="bold" className="text-ink-900 text-[15px]">{t("cv.analyze")}</Txt>
              <Txt className="text-ink-400 text-[12.5px] mt-0.5">{t("cv.analyzeSub")}</Txt>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink300} />
          </Pressable>
        </View>

        {/* My CVs */}
        <View className="flex-row items-baseline justify-between mt-6 mb-3">
          <Txt font="display" weight="semibold" className="text-ink-900 text-[17px]">{t("cv.myList")}</Txt>
          {cvs.length > 0 ? <Txt className="text-ink-400 text-xs">{cvs.length}</Txt> : null}
        </View>
        {isLoading ? (
          <ActivityIndicator color={colors.teal500} className="mt-2" />
        ) : cvs.length === 0 ? (
          <Txt className="text-ink-400 text-[13px]">{t("cv.emptyList")}</Txt>
        ) : (
          cvs.map((cv) => (
            <Pressable
              key={cv.id}
              onPress={() => router.push(`/cv/${cv.id}`)}
              style={shadow.sm}
              className="flex-row items-center gap-3 bg-surface border border-sand-200 rounded-2xl p-3.5 mb-2.5"
            >
              <View className="w-10 h-10 rounded-xl bg-teal-100 items-center justify-center"><Ionicons name="document-text-outline" size={20} color={colors.teal600} /></View>
              <View className="flex-1">
                <Txt weight="bold" className="text-ink-900 text-sm" numberOfLines={1}>{cv.title || t("cv.untitled")}</Txt>
                <Txt className="text-ink-400 text-[11.5px] mt-0.5 capitalize">{cv.template}</Txt>
              </View>
              <Pressable
                hitSlop={10}
                onPress={() => Alert.alert(t("cv.deleteConfirm"), cv.title, [
                  { text: t("common.cancel"), style: "cancel" },
                  { text: t("common.delete"), style: "destructive", onPress: () => del.mutate(cv.id) },
                ])}
                className="p-1.5"
              >
                <Ionicons name="trash-outline" size={18} color={colors.coral500} />
              </Pressable>
            </Pressable>
          ))
        )}

        {/* Templates */}
        <Txt font="display" weight="semibold" className="text-ink-900 text-[17px] mt-6 mb-3">{t("cv.templates")}</Txt>
        <View className="flex-row flex-wrap justify-between">
          {TEMPLATES.map((c) => (
            <Pressable key={c.id} onPress={() => create.mutate(c.id)} className="bg-surface border border-sand-200 rounded-2xl overflow-hidden mb-3" style={{ width: "48.5%" }}>
              <TemplatePreview />
              <View className="p-3">
                <Txt weight="bold" className="text-ink-900 text-[13px]">{c.name}</Txt>
                <Txt className="text-ink-400 text-[11px] leading-[15px] mt-1" numberOfLines={2}>{c.desc}</Txt>
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable onPress={() => Linking.openURL(CV_URL)} className="flex-row items-center justify-center gap-1.5 mt-2 py-2">
          <Ionicons name="open-outline" size={15} color={colors.ink400} />
          <Txt className="text-ink-400 text-[13px]">{t("cv.openWeb")}</Txt>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
