import { useState } from "react";
import { View, ScrollView, TextInput, Pressable, KeyboardAvoidingView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Profile, ProfileUpdate } from "@scholarhub/shared";
import { useApi } from "@/lib/api";
import { useSignedInQuery } from "@/lib/query";
import { useT } from "@/i18n";
import type { TranslationKey } from "@/i18n/translations";
import { Txt, Button } from "@/components/ui";
import { colors } from "@/theme";

type FormState = {
  full_name: string;
  university: string;
  bsc_major: string;
  graduation_year: string;
  cgpa: string;
  target_degree: string;
  ielts_score: string;
  gre_gmat_score: string;
  preferred_countries: string;
  research_interests: string;
  work_experience: string;
  internships: string;
  published_papers: string;
  goals_notes: string;
  portfolio_url: string;
};

const DEGREES: { value: string; label: string }[] = [
  { value: "bachelors", label: "Bachelor's" },
  { value: "masters", label: "Master's" },
  { value: "phd", label: "PhD" },
  { value: "postdoc", label: "Postdoc" },
  { value: "any", label: "Any" },
];

/** Web + the roadmap wizard have historically written both singular and plural. */
function normalizeDegree(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/['’]s$/, "");
  if (key === "bachelor") return "bachelors";
  if (key === "master") return "masters";
  return raw.trim().toLowerCase();
}

function toForm(p: Profile, fallbackName = ""): FormState {
  const str = (v: unknown) => (v == null ? "" : String(v));
  return {
    full_name: str(p.full_name) || fallbackName,
    university: str(p.university),
    bsc_major: str(p.bsc_major),
    graduation_year: str(p.graduation_year),
    cgpa: str(p.cgpa),
    target_degree: normalizeDegree(str(p.target_degree)),
    ielts_score: str(p.ielts_score),
    gre_gmat_score: str(p.gre_gmat_score),
    preferred_countries: str(p.preferred_countries),
    research_interests: str(p.research_interests),
    work_experience: str(p.work_experience),
    internships: str(p.internships),
    published_papers: str(p.published_papers),
    goals_notes: str(p.goals_notes),
    portfolio_url: str(p.portfolio_url),
  };
}

function Field({
  label,
  value,
  onChange,
  multiline,
  keyboardType,
  optional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "url";
  optional?: boolean;
}) {
  const t = useT();
  return (
    <View className="mb-4">
      <Txt weight="semibold" className="text-ink-700 text-[13px] mb-1.5">
        {label}
        {optional ? <Txt className="text-ink-400 text-[11px]">  {t("common.optional")}</Txt> : null}
      </Txt>
      <TextInput
        className="bg-surface border border-sand-200 text-ink-900 rounded-xl px-3.5 py-3"
        style={{
          fontFamily: "Manrope_400Regular",
          fontSize: 14.5,
          color: colors.ink900,
          minHeight: multiline ? 84 : undefined,
          textAlignVertical: multiline ? "top" : "center",
        }}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={keyboardType ?? "default"}
        placeholderTextColor={colors.ink400}
        autoCapitalize={keyboardType === "url" ? "none" : "sentences"}
      />
    </View>
  );
}

function SectionTitle({ k }: { k: TranslationKey }) {
  const t = useT();
  return <Txt font="display" weight="semibold" className="text-ink-900 text-[17px] mt-2 mb-3">{t(k)}</Txt>;
}

export default function ProfileEdit() {
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useUser();
  const [edits, setEdits] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Always refetch on this screen so values saved on the website win over a
  // stale React Query cache (Roadmap also uses ["profile"]). Do not paint
  // TextInputs until that fetch settles — mounting them empty and filling
  // later is a well-known Android bug where the native field stays blank.
  const { data, isError, isFetchedAfterMount, refetch } = useSignedInQuery({
    queryKey: ["profile"],
    queryFn: () => api.getProfile(),
    staleTime: 0,
  });

  const fallbackName = user?.fullName ?? "";
  const serverForm = data?.profile ? toForm(data.profile, fallbackName) : null;
  const form = edits ?? serverForm;
  const ready = isFetchedAfterMount && form !== null;

  const set = (k: keyof FormState) => (v: string) =>
    setEdits((prev) => {
      const base = prev ?? serverForm;
      return base ? { ...base, [k]: v } : prev;
    });

  const save = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("Profile has not loaded yet");
      const update: ProfileUpdate = {
        full_name: form.full_name || null,
        university: form.university || null,
        bsc_major: form.bsc_major || null,
        graduation_year: form.graduation_year ? Number(form.graduation_year) : null,
        cgpa: form.cgpa ? Number(form.cgpa) : null,
        target_degree: form.target_degree || null,
        ielts_score: form.ielts_score || null,
        gre_gmat_score: form.gre_gmat_score || null,
        preferred_countries: form.preferred_countries || null,
        research_interests: form.research_interests || null,
        work_experience: form.work_experience || null,
        internships: form.internships || null,
        published_papers: form.published_papers || null,
        goals_notes: form.goals_notes || null,
        portfolio_url: form.portfolio_url || null,
      };
      return api.updateProfile(update);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      router.back();
    },
    onError: () => setError(t("profile.saveError")),
  });

  return (
    <SafeAreaView className="flex-1 bg-body" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => router.back()} className="w-[38px] h-[38px] rounded-full bg-surface border border-sand-200 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color={colors.ink900} />
        </Pressable>
        <Txt font="display" weight="semibold" className="text-ink-900 text-xl flex-1">{t("profile.edit")}</Txt>
        <Pressable
          onPress={() => save.mutate()}
          disabled={!ready || save.isPending}
          className="bg-teal-500 rounded-full px-4 py-2"
          style={{ opacity: !ready || save.isPending ? 0.6 : 1 }}
        >
          {save.isPending ? <ActivityIndicator color={colors.white} size="small" /> : <Txt weight="bold" className="text-white text-sm">{t("common.save")}</Txt>}
        </Pressable>
      </View>

      {isError && !serverForm ? (
        <View className="flex-1 items-center justify-center px-8">
          <Txt className="text-ink-500 text-center mb-4">{t("profile.loadError")}</Txt>
          <Button label={t("common.retry")} onPress={() => void refetch()} fullWidth={false} />
        </View>
      ) : !ready || !form ? (
        <ActivityIndicator color={colors.teal500} className="mt-10" />
      ) : (
        <KeyboardAvoidingView className="flex-1" behavior="padding">
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {error ? <Txt className="text-coral-700 text-sm mb-3">{error}</Txt> : null}

            <SectionTitle k="profile.sectionBasics" />
            <Field label={t("profile.name")} value={form.full_name} onChange={set("full_name")} />
            <Field label={t("profile.university")} value={form.university} onChange={set("university")} />
            <Field label={t("profile.major")} value={form.bsc_major} onChange={set("bsc_major")} />
            <Field label={t("profile.gradYear")} value={form.graduation_year} onChange={set("graduation_year")} keyboardType="numeric" />

            <SectionTitle k="profile.sectionAcademics" />
            <Field label={t("profile.cgpa")} value={form.cgpa} onChange={set("cgpa")} keyboardType="numeric" />
            <View className="mb-4">
              <Txt weight="semibold" className="text-ink-700 text-[13px] mb-1.5">{t("profile.targetDegreeLevel")}</Txt>
              <View className="flex-row flex-wrap gap-2">
                {DEGREES.map((d) => {
                  const on = form.target_degree === d.value;
                  return (
                    <Pressable
                      key={d.value}
                      onPress={() => set("target_degree")(on ? "" : d.value)}
                      className={on ? "bg-teal-500 rounded-full px-4 py-2.5" : "bg-surface border border-sand-200 rounded-full px-4 py-2.5"}
                    >
                      <Txt weight="semibold" className={on ? "text-white text-[13px]" : "text-ink-700 text-[13px]"}>{d.label}</Txt>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Field label={t("profile.ielts")} value={form.ielts_score} onChange={set("ielts_score")} optional />
            <Field label={t("profile.greGmat")} value={form.gre_gmat_score} onChange={set("gre_gmat_score")} optional />

            <SectionTitle k="profile.sectionGoals" />
            <Field label={t("profile.preferredCountries")} value={form.preferred_countries} onChange={set("preferred_countries")} />
            <Field label={t("profile.researchInterests")} value={form.research_interests} onChange={set("research_interests")} multiline />
            <Field label={t("profile.workExperience")} value={form.work_experience} onChange={set("work_experience")} multiline optional />
            <Field label={t("profile.internships")} value={form.internships} onChange={set("internships")} multiline optional />
            <Field label={t("profile.publishedPapers")} value={form.published_papers} onChange={set("published_papers")} multiline optional />
            <Field label={t("profile.goals")} value={form.goals_notes} onChange={set("goals_notes")} multiline optional />
            <Field label={t("profile.portfolio")} value={form.portfolio_url} onChange={set("portfolio_url")} keyboardType="url" optional />

            <View className="mt-2">
              <Button label={t("common.save")} onPress={() => save.mutate()} loading={save.isPending} disabled={!ready} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
