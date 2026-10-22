import { useEffect, useState } from "react";
import { View, ScrollView, TextInput, Pressable, KeyboardAvoidingView, ActivityIndicator, Linking, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CVData, CVTemplateId, EducationEntry, ExperienceEntry, SkillGroup } from "@scholarhub/shared";
import { useApi } from "@/lib/api";
import { useSignedInQuery } from "@/lib/query";
import { useRateAppEngagement } from "@/lib/rate-app";
import { useT } from "@/i18n";
import { API_BASE } from "@/lib/config";
import { Txt, Button } from "@/components/ui";
import { CvPreview } from "@/components/CvPreview";
import { colors } from "@/theme";

const TEMPLATES: CVTemplateId[] = ["classic", "modern", "europass", "photo"];
const EMPTY_EDU: EducationEntry = { institution: "", degree: "", field: "", location: "", startDate: "", endDate: "", gpa: "", details: "" };
const EMPTY_EXP: ExperienceEntry = { role: "", organization: "", location: "", startDate: "", endDate: "", description: "" };
const EMPTY_SKILL: SkillGroup = { category: "", items: "" };

function Field({ label, value, onChange, multiline, keyboardType }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; keyboardType?: "default" | "url" }) {
  return (
    <View className="mb-3">
      <Txt weight="semibold" className="text-ink-600 text-[12px] mb-1">{label}</Txt>
      <TextInput
        className="bg-surface border border-sand-200 text-ink-900 rounded-xl px-3.5 py-2.5"
        style={{ fontFamily: "Manrope_400Regular", fontSize: 14, minHeight: multiline ? 72 : undefined, textAlignVertical: multiline ? "top" : "center" }}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={keyboardType === "url" ? "none" : "sentences"}
        placeholderTextColor={colors.ink400}
      />
    </View>
  );
}

function SectionHeader({ title, onAdd, addLabel }: { title: string; onAdd?: () => void; addLabel?: string }) {
  return (
    <View className="flex-row items-center justify-between mt-6 mb-3">
      <Txt font="display" weight="semibold" className="text-ink-900 text-[17px]">{title}</Txt>
      {onAdd ? (
        <Pressable onPress={onAdd} className="flex-row items-center gap-1 bg-teal-100 rounded-full px-3 py-1.5">
          <Ionicons name="add" size={15} color={colors.teal600} />
          <Txt weight="bold" className="text-teal-700 text-xs">{addLabel}</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

function EntryCard({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <View className="bg-body border border-sand-200 rounded-2xl p-3.5 mb-3">
      <View className="items-end -mt-1 -mr-1 mb-1">
        <Pressable hitSlop={8} onPress={onRemove}><Ionicons name="close-circle" size={20} color={colors.ink300} /></Pressable>
      </View>
      {children}
    </View>
  );
}

export default function CvEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  useRateAppEngagement();

  const { data, isLoading, isError } = useSignedInQuery({ queryKey: ["cv", id], queryFn: () => api.getCv(id), enabled: !!id });

  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<CVTemplateId>("classic");
  const [cv, setCv] = useState<CVData | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    if (!data?.cv) return;
    setTitle(data.cv.title);
    setTemplate(data.cv.template);
    setCv(data.cv.data);
  }, [data]);

  const setField = (k: keyof CVData) => (v: string) => setCv((c) => (c ? { ...c, [k]: v } : c));
  const updArr = <K extends "education" | "workExperience" | "skills">(key: K, i: number, patch: Partial<CVData[K][number]>) =>
    setCv((c) => (c ? { ...c, [key]: c[key].map((e, idx) => (idx === i ? { ...e, ...patch } : e)) } : c));
  const addArr = <K extends "education" | "workExperience" | "skills">(key: K, empty: CVData[K][number]) =>
    setCv((c) => (c ? { ...c, [key]: [...c[key], empty] } : c));
  const removeArr = <K extends "education" | "workExperience" | "skills">(key: K, i: number) =>
    setCv((c) => (c ? { ...c, [key]: c[key].filter((_, idx) => idx !== i) } : c));

  const save = useMutation({
    mutationFn: () => {
      if (!cv) throw new Error("no data");
      return api.updateCv(id, { title: title.trim() || "Untitled CV", template, data: cv });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cvs"] });
      qc.invalidateQueries({ queryKey: ["cv", id] });
      router.back();
    },
  });

  const del = useMutation({
    mutationFn: () => api.deleteCv(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cvs"] });
      router.back();
    },
  });

  if (isLoading) {
    return <View className="flex-1 bg-body items-center justify-center"><ActivityIndicator color={colors.teal500} /></View>;
  }
  if (isError || !cv) {
    return (
      <SafeAreaView className="flex-1 bg-body items-center justify-center px-8">
        <Txt className="text-ink-500 text-center">{t("cv.cvNotFound")}</Txt>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-body" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => router.back()} className="w-[38px] h-[38px] rounded-full bg-surface border border-sand-200 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color={colors.ink900} />
        </Pressable>
        <Txt font="display" weight="semibold" className="text-ink-900 text-lg flex-1" numberOfLines={1}>{title || t("cv.untitled")}</Txt>
        <Pressable
          onPress={() => setMode((m) => (m === "edit" ? "preview" : "edit"))}
          className="flex-row items-center gap-1 border border-sand-300 rounded-full px-3 py-2"
        >
          <Ionicons name={mode === "edit" ? "eye-outline" : "create-outline"} size={15} color={colors.teal600} />
          <Txt weight="bold" className="text-teal-700 text-[12.5px]">{mode === "edit" ? t("cv.preview") : t("cv.edit")}</Txt>
        </Pressable>
        <Pressable onPress={() => save.mutate()} disabled={save.isPending} className="bg-teal-500 rounded-full px-4 py-2">
          {save.isPending ? <ActivityIndicator color={colors.white} size="small" /> : <Txt weight="bold" className="text-white text-sm">{t("common.save")}</Txt>}
        </Pressable>
      </View>

      {mode === "preview" ? (
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          <CvPreview data={cv} />
          <Pressable onPress={() => Linking.openURL(`${API_BASE}/cv-builder`)} className="flex-row items-center justify-center gap-1.5 mt-4 py-2">
            <Ionicons name="open-outline" size={15} color={colors.teal600} />
            <Txt weight="semibold" className="text-teal-600 text-[13px]">{t("cv.openWeb")}</Txt>
          </Pressable>
          <Txt className="text-ink-400 text-[12px] text-center mt-1 px-6 leading-[17px]">{t("cv.previewNote")}</Txt>
        </ScrollView>
      ) : (
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Field label={t("cv.cvTitle")} value={title} onChange={setTitle} />

          <Txt weight="semibold" className="text-ink-600 text-[12px] mb-1.5">{t("cv.template")}</Txt>
          <View className="flex-row flex-wrap gap-2 mb-2">
            {TEMPLATES.map((tp) => {
              const on = template === tp;
              return (
                <Pressable key={tp} onPress={() => setTemplate(tp)} className={on ? "bg-teal-500 rounded-full px-3.5 py-2" : "bg-surface border border-sand-200 rounded-full px-3.5 py-2"}>
                  <Txt weight="semibold" className={`capitalize text-[12.5px] ${on ? "text-white" : "text-ink-700"}`}>{tp}</Txt>
                </Pressable>
              );
            })}
          </View>

          <SectionHeader title={t("profile.sectionBasics")} />
          <Field label={t("cv.fullName")} value={cv.fullName} onChange={setField("fullName")} />
          <Field label={t("cv.headline")} value={cv.headline} onChange={setField("headline")} />
          <Field label={t("cv.email")} value={cv.email} onChange={setField("email")} keyboardType="url" />
          <Field label={t("cv.phone")} value={cv.phone} onChange={setField("phone")} />
          <Field label={t("cv.location")} value={cv.location} onChange={setField("location")} />
          <Field label={t("cv.website")} value={cv.website} onChange={setField("website")} keyboardType="url" />

          <SectionHeader title={t("cv.summary")} />
          <Field label={t("cv.researchInterests")} value={cv.researchInterests} onChange={setField("researchInterests")} multiline />
          <Field label={t("cv.summary")} value={cv.summary} onChange={setField("summary")} multiline />

          <SectionHeader title={t("cv.education")} onAdd={() => addArr("education", { ...EMPTY_EDU })} addLabel={t("cv.addEducation")} />
          {cv.education.map((e, i) => (
            <EntryCard key={i} onRemove={() => removeArr("education", i)}>
              <Field label={t("cv.institution")} value={e.institution} onChange={(v) => updArr("education", i, { institution: v })} />
              <Field label={t("cv.degree")} value={e.degree} onChange={(v) => updArr("education", i, { degree: v })} />
              <Field label={t("cv.fieldOfStudy")} value={e.field} onChange={(v) => updArr("education", i, { field: v })} />
              <View className="flex-row gap-2">
                <View className="flex-1"><Field label={t("cv.startDate")} value={e.startDate} onChange={(v) => updArr("education", i, { startDate: v })} /></View>
                <View className="flex-1"><Field label={t("cv.endDate")} value={e.endDate} onChange={(v) => updArr("education", i, { endDate: v })} /></View>
              </View>
              <Field label={t("cv.gpa")} value={e.gpa} onChange={(v) => updArr("education", i, { gpa: v })} />
            </EntryCard>
          ))}

          <SectionHeader title={t("cv.experience")} onAdd={() => addArr("workExperience", { ...EMPTY_EXP })} addLabel={t("cv.addExperience")} />
          {cv.workExperience.map((e, i) => (
            <EntryCard key={i} onRemove={() => removeArr("workExperience", i)}>
              <Field label={t("cv.role")} value={e.role} onChange={(v) => updArr("workExperience", i, { role: v })} />
              <Field label={t("cv.organization")} value={e.organization} onChange={(v) => updArr("workExperience", i, { organization: v })} />
              <View className="flex-row gap-2">
                <View className="flex-1"><Field label={t("cv.startDate")} value={e.startDate} onChange={(v) => updArr("workExperience", i, { startDate: v })} /></View>
                <View className="flex-1"><Field label={t("cv.endDate")} value={e.endDate} onChange={(v) => updArr("workExperience", i, { endDate: v })} /></View>
              </View>
              <Field label={t("cv.description")} value={e.description} onChange={(v) => updArr("workExperience", i, { description: v })} multiline />
            </EntryCard>
          ))}

          <SectionHeader title={t("cv.skills")} onAdd={() => addArr("skills", { ...EMPTY_SKILL })} addLabel={t("cv.addSkill")} />
          {cv.skills.map((s, i) => (
            <EntryCard key={i} onRemove={() => removeArr("skills", i)}>
              <Field label={t("cv.skillCategory")} value={s.category} onChange={(v) => updArr("skills", i, { category: v })} />
              <Field label={t("cv.skillItems")} value={s.items} onChange={(v) => updArr("skills", i, { items: v })} />
            </EntryCard>
          ))}

          {/* Advanced note */}
          <View className="bg-teal-100 rounded-2xl p-4 mt-6 flex-row gap-2.5">
            <Ionicons name="information-circle-outline" size={18} color={colors.teal700} style={{ marginTop: 1 }} />
            <Txt className="flex-1 text-teal-800 text-[13px] leading-[19px]">{t("cv.advancedNote")}</Txt>
          </View>
          <Pressable onPress={() => Linking.openURL(`${API_BASE}/cv-builder`)} className="flex-row items-center justify-center gap-1.5 mt-3 py-2">
            <Ionicons name="open-outline" size={15} color={colors.teal600} />
            <Txt weight="semibold" className="text-teal-600 text-[13px]">{t("cv.openWeb")}</Txt>
          </Pressable>

          <View className="mt-3">
            <Button label={t("common.save")} onPress={() => save.mutate()} loading={save.isPending} />
          </View>
          <Pressable
            onPress={() => Alert.alert(t("cv.deleteConfirm"), title, [
              { text: t("common.cancel"), style: "cancel" },
              { text: t("common.delete"), style: "destructive", onPress: () => del.mutate() },
            ])}
            className="flex-row items-center justify-center gap-2 py-4 mt-1"
          >
            <Ionicons name="trash-outline" size={17} color={colors.coral500} />
            <Txt weight="semibold" className="text-coral-700 text-sm">{t("common.delete")}</Txt>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
