import { useEffect, useState } from "react";
import { View, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { File as FsFile } from "expo-file-system";
import { useMutation } from "@tanstack/react-query";
import type { CVAnalysis, SectionFeedback } from "@scholarhub/shared";
import { ApiError } from "@scholarhub/shared";
import { useApi } from "@/lib/api";
import { useRateAppEngagement } from "@/lib/rate-app";
import { useT } from "@/i18n";
import type { TranslationKey } from "@/i18n/translations";
import { Txt, Button } from "@/components/ui";
import { colors } from "@/theme";

/**
 * The backend is one long request; these staged labels give the wait a sense
 * of progress (mirrors the web analyzer). Each stage dwells at least `ms`,
 * the last one holds until the response lands.
 */
const STAGES: { label: TranslationKey; hint: TranslationKey; ms: number }[] = [
  { label: "cv.stageRead", hint: "cv.stageReadHint", ms: 2500 },
  { label: "cv.stageSections", hint: "cv.stageSectionsHint", ms: 4000 },
  { label: "cv.stageStructure", hint: "cv.stageStructureHint", ms: 5000 },
  { label: "cv.stageStrengths", hint: "cv.stageStrengthsHint", ms: 6000 },
  { label: "cv.stageReport", hint: "cv.stageReportHint", ms: 0 },
];

function AnalyzeProgress() {
  const t = useT();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (idx >= STAGES.length - 1) return;
    const timer = setTimeout(() => setIdx((i) => i + 1), STAGES[idx].ms);
    return () => clearTimeout(timer);
  }, [idx]);

  return (
    <View className="bg-surface border border-sand-200 rounded-3xl p-6 mt-6">
      {STAGES.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <View key={s.label} className={`flex-row gap-3 ${i < STAGES.length - 1 ? "mb-5" : ""}`}>
            <View className="w-6 items-center pt-0.5">
              {done ? (
                <Ionicons name="checkmark-circle" size={21} color={colors.teal500} />
              ) : active ? (
                <ActivityIndicator size="small" color={colors.teal500} />
              ) : (
                <View className="w-[17px] h-[17px] rounded-full border-2 border-sand-300 mt-0.5" />
              )}
            </View>
            <View className="flex-1">
              <Txt weight={active ? "bold" : "medium"} className={done || active ? "text-ink-900 text-[14.5px]" : "text-ink-400 text-[14.5px]"}>
                {t(s.label)}
              </Txt>
              {active ? <Txt className="text-ink-400 text-[12px] mt-0.5">{t(s.hint)}</Txt> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function scoreColor(score: number): string {
  if (score >= 75) return colors.teal500;
  if (score >= 50) return colors.coral400;
  return colors.coral500;
}

const RATING: Record<SectionFeedback["rating"], { label: string; color: string; bg: string }> = {
  strong: { label: "Strong", color: colors.teal700, bg: colors.teal100 },
  adequate: { label: "Adequate", color: colors.teal700, bg: colors.teal100 },
  "needs-work": { label: "Needs work", color: colors.coral700, bg: colors.coral100 },
  missing: { label: "Missing", color: colors.ink500, bg: colors.sand100 },
};

function ListBlock({ title, items, icon, tint }: { title: string; items: string[]; icon: keyof typeof Ionicons.glyphMap; tint: string }) {
  if (!items || items.length === 0) return null;
  return (
    <View className="mt-5">
      <Txt weight="bold" className="text-ink-900 text-[15px] mb-2.5">{title}</Txt>
      {items.map((it, i) => (
        <View key={i} className="flex-row gap-2.5 mb-2">
          <Ionicons name={icon} size={17} color={tint} style={{ marginTop: 1 }} />
          <Txt className="text-ink-700 text-[13.5px] leading-[20px] flex-1">{it}</Txt>
        </View>
      ))}
    </View>
  );
}

export default function CvAnalyze() {
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const [text, setText] = useState("");
  const [result, setResult] = useState<CVAnalysis | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useRateAppEngagement();

  const onDone = (res: { analysis: CVAnalysis; sourceName: string | null }) => {
    setResult(res.analysis);
    setSource(res.sourceName);
    setError(null);
  };
  // Surface the backend's specific message (bad file, too little text, AI
  // hiccup) instead of a generic one.
  const onFail = (err: unknown) => {
    console.log("[cv] analyze failed", err instanceof ApiError ? `${err.status} ${JSON.stringify(err.body)}` : String(err));
    setError(err instanceof ApiError && typeof err.body?.error === "string" ? err.body.error : t("cv.analyzeError"));
  };

  const analyzeText = useMutation({ mutationFn: () => api.analyzeCvText(text.trim()), onSuccess: onDone, onError: onFail });
  const analyzeFile = useMutation({ mutationFn: (form: FormData) => api.analyzeCvFile(form), onSuccess: onDone, onError: onFail });
  const busy = analyzeText.isPending || analyzeFile.isPending;

  async function pickFile() {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    const form = new FormData();
    // expo/fetch can't serialize RN's {uri,...} FormData parts (it throws
    // "Unsupported FormDataPart implementation"); hand it the file's bytes via
    // expo-file-system's File, which implements the Blob interface it expects.
    form.append("file", new FsFile(asset.uri) as unknown as Blob, asset.name);
    analyzeFile.mutate(form);
  }

  function reset() {
    setResult(null);
    setSource(null);
    setText("");
    setError(null);
  }

  return (
    <SafeAreaView className="flex-1 bg-body" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => router.back()} className="w-[38px] h-[38px] rounded-full bg-surface border border-sand-200 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color={colors.ink900} />
        </Pressable>
        <Txt font="display" weight="semibold" className="text-ink-900 text-xl">{t("cv.analyzeTitle")}</Txt>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 48 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {busy ? (
          <View>
            <Txt className="text-ink-500 text-center mt-4">{t("cv.analyzing")}</Txt>
            <AnalyzeProgress />
          </View>
        ) : result ? (
          <View>
            {/* Score */}
            <View className="items-center bg-surface border border-sand-200 rounded-3xl p-6">
              <View
                className="w-28 h-28 rounded-full items-center justify-center border-[6px]"
                style={{ borderColor: scoreColor(result.overallScore) }}
              >
                <Txt font="display" weight="bold" className="text-ink-900 text-4xl">{result.overallScore}</Txt>
                <Txt className="text-ink-400 text-[11px]">/ 100</Txt>
              </View>
              <Txt weight="bold" className="text-ink-700 text-sm mt-3">{t("cv.overallScore")}</Txt>
              {source ? <Txt className="text-ink-400 text-xs mt-1" numberOfLines={1}>{source}</Txt> : null}
              {result.summary ? <Txt className="text-ink-600 text-[13.5px] leading-[20px] text-center mt-3">{result.summary}</Txt> : null}
            </View>

            <ListBlock title={t("cv.strengths")} items={result.strengths} icon="checkmark-circle" tint={colors.teal500} />
            <ListBlock title={t("cv.weaknesses")} items={result.weaknesses} icon="alert-circle" tint={colors.coral500} />
            <ListBlock title={t("cv.actionItems")} items={result.actionItems} icon="arrow-forward-circle" tint={colors.teal600} />

            {result.missingSections?.length > 0 ? (
              <View className="mt-5">
                <Txt weight="bold" className="text-ink-900 text-[15px] mb-2.5">{t("cv.missingSections")}</Txt>
                <View className="flex-row flex-wrap gap-2">
                  {result.missingSections.map((m, i) => (
                    <View key={i} className="bg-coral-100 rounded-full px-3 py-1.5">
                      <Txt weight="semibold" className="text-coral-700 text-[12px]">{m}</Txt>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {result.sections?.length > 0 ? (
              <View className="mt-6">
                <Txt weight="bold" className="text-ink-900 text-[15px] mb-3">{t("cv.sectionBySection")}</Txt>
                {result.sections.map((s, i) => {
                  const r = RATING[s.rating] ?? RATING.adequate;
                  return (
                    <View key={i} className="bg-surface border border-sand-200 rounded-2xl p-4 mb-2.5">
                      <View className="flex-row items-center justify-between">
                        <Txt weight="bold" className="text-ink-900 text-[14px] flex-1" numberOfLines={1}>{s.name}</Txt>
                        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: r.bg }}>
                          <Txt weight="bold" className="text-[10.5px]" style={{ color: r.color }}>{r.label}</Txt>
                        </View>
                      </View>
                      {s.feedback ? <Txt className="text-ink-600 text-[13px] leading-[19px] mt-2">{s.feedback}</Txt> : null}
                      {s.suggestions?.map((sg, j) => (
                        <View key={j} className="flex-row gap-2 mt-2">
                          <Ionicons name="chevron-forward" size={13} color={colors.ink400} style={{ marginTop: 3 }} />
                          <Txt className="text-ink-500 text-[12.5px] leading-[18px] flex-1">{sg}</Txt>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            ) : null}

            <View className="gap-2.5 mt-6">
              <Button label={t("cv.buildBetter")} onPress={() => router.replace("/cv")} icon={<Ionicons name="document-text-outline" size={18} color={colors.white} />} />
              <Button label={t("cv.analyzeAnother")} variant="outline" onPress={reset} />
            </View>
          </View>
        ) : (
          <View>
            <Txt className="text-ink-600 text-[14px] leading-[21px]">{t("cv.analyzeIntro")}</Txt>

            <Pressable onPress={pickFile} className="items-center bg-surface border border-dashed border-sand-300 rounded-2xl p-7 mt-5">
              <View className="w-12 h-12 rounded-2xl bg-teal-100 items-center justify-center">
                <Ionicons name="cloud-upload-outline" size={26} color={colors.teal600} />
              </View>
              <Txt weight="bold" className="text-ink-900 text-[15px] mt-3">{t("cv.pickFile")}</Txt>
              <Txt className="text-ink-400 text-xs mt-1">PDF · DOCX · TXT</Txt>
            </Pressable>

            <Txt weight="semibold" className="text-ink-500 text-[13px] mt-6 mb-2">{t("cv.pasteInstead")}</Txt>
            <TextInput
              className="bg-surface border border-sand-200 text-ink-900 rounded-2xl px-4 py-3"
              style={{ fontFamily: "Manrope_400Regular", fontSize: 14, minHeight: 160, textAlignVertical: "top" }}
              placeholder={t("cv.pastePlaceholder")}
              placeholderTextColor={colors.ink400}
              value={text}
              onChangeText={setText}
              multiline
            />
            {error ? <Txt className="text-coral-700 text-sm mt-3">{error}</Txt> : null}
            <View className="mt-4">
              <Button label={t("cv.analyzeBtn")} onPress={() => analyzeText.mutate()} disabled={text.trim().length < 80} icon={<Ionicons name="sparkles" size={18} color={colors.white} />} />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
