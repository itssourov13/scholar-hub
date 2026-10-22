import { useEffect, useRef, useState } from "react";
import { View, ScrollView, Pressable, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import type { RoadmapMilestone, RoadmapNote } from "@scholarhub/shared";
import { useApi } from "@/lib/api";
import { useSignedInQuery } from "@/lib/query";
import { useLang, useT } from "@/i18n";
import { Txt } from "@/components/ui";
import { colors, shadow } from "@/theme";
import {
  ROADMAP_KEY,
  STAGE_COLORS,
  activeIndex,
  connectorFill,
  fill,
  nodeLook,
  pick,
  readinessView,
  stageOf,
  useJourney,
} from "@/lib/roadmap";

/** The horizontal readiness bar, built exactly like the Home one so the number
 *  reads as the same metric it always was. */
function ReadinessBar({ value }: { value: number }) {
  return (
    <View className="h-2 rounded-full bg-sand-100 mt-3 overflow-hidden">
      <LinearGradient
        colors={[colors.teal500, colors.coral400]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: "100%", width: `${Math.max(value, 4)}%`, borderRadius: 999 }}
      />
    </View>
  );
}

function Header() {
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const { data } = useJourney();
  const [openBreakdown, setOpenBreakdown] = useState(false);
  if (!data) return null;

  const view = readinessView(data);

  return (
    <View>
      <Txt font="display" weight="bold" className="text-ink-900 text-[22px]">
        {t("roadmap.title")}
      </Txt>

      {view.kind === "score" ? (
        <>
          <View className="flex-row items-end gap-1.5 mt-2">
            <Txt font="display" weight="bold" className="text-ink-900 text-[42px] leading-[46px]">
              {view.score}
            </Txt>
            <Txt weight="bold" className="text-ink-500 text-base mb-1.5">%</Txt>
            <Txt className="text-ink-400 text-[13px] mb-2 ml-0.5">{t("roadmap.ready")}</Txt>
          </View>
          <ReadinessBar value={view.score} />
          {data.confidence < 80 && data.highest_weight_unknown ? (
            <Txt className="text-ink-400 text-xs mt-2">
              {fill(t("roadmap.sharpen"), {
                field: t(`roadmap.input.${data.highest_weight_unknown}` as never) ?? "",
              })}
            </Txt>
          ) : null}
          <Pressable onPress={() => setOpenBreakdown((open) => !open)} className="mt-3 self-start">
            <View className="flex-row items-center gap-1">
              <Txt weight="bold" className="text-teal-700 text-[13px]">
                {t("roadmap.whyThisScore")}
              </Txt>
              <Ionicons
                name={openBreakdown ? "chevron-up" : "chevron-down"}
                size={14}
                color={colors.teal700}
              />
            </View>
          </Pressable>
        </>
      ) : (
        // No number the server can stand behind yet. A prompt, not an empty bar:
        // an empty progress bar beside a message reads as "you scored zero".
        <Pressable
          onPress={() => router.push("/profile-edit")}
          className="bg-coral-100 rounded-[18px] p-4 mt-3"
        >
          <Txt weight="bold" className="text-coral-700 text-[14px] leading-5">
            {view.kind !== "unlock"
              ? t("roadmap.setupBody")
              : // Name the field that is actually missing. Saying "add your degree
                // and CGPA" to somebody who has both — which is most of the people
                // in this state — reads as broken.
                data.highest_weight_unknown
                ? fill(t("roadmap.unlockScoreField"), {
                    field: t(`roadmap.input.${data.highest_weight_unknown}` as never),
                  })
                : t("roadmap.unlockScore")}
          </Txt>
          <View className="flex-row items-center gap-1.5 mt-2">
            <Txt weight="bold" className="text-coral-700 text-[13px]">
              {t("roadmap.unlockScoreCta")}
            </Txt>
            <Ionicons name="arrow-forward" size={14} color={colors.coral700} />
          </View>
        </Pressable>
      )}

      {openBreakdown ? (
        <View style={shadow.sm} className="bg-surface border border-sand-200 rounded-[18px] p-4 mt-3">
          {data.score_breakdown.pillars.map((pillar) => (
            <View key={pillar.pillar} className="mb-3 last:mb-0">
              <View className="flex-row items-center justify-between">
                <Txt weight="semibold" className="text-ink-700 text-[13px]">
                  {t(`roadmap.pillar.${pillar.pillar}` as never) ?? pillar.pillar}
                </Txt>
                <Txt className="text-ink-400 text-xs">
                  {pillar.known
                    ? fill(t("roadmap.pointsOf"), {
                        earned: pillar.earned,
                        available: pillar.available,
                      })
                    : t("roadmap.notEnoughInfo")}
                </Txt>
              </View>
              <View className="h-1.5 rounded-full bg-sand-100 mt-1.5 overflow-hidden">
                <View
                  style={{
                    height: "100%",
                    width: `${(pillar.earned / Math.max(pillar.available, 1)) * 100}%`,
                    backgroundColor: pillar.known ? colors.teal500 : colors.sand300,
                    borderRadius: 999,
                  }}
                />
              </View>
              <Txt className="text-ink-400 text-[11px] mt-1">{pick(pillar.detail, lang)}</Txt>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Strengths are informational; weaknesses navigate to the step that fixes them,
 *  which is why they carry an arrow as well as a colour. */
function Notes({ notes, tone }: { notes: RoadmapNote[]; tone: "teal" | "coral" }) {
  const { lang } = useLang();
  const router = useRouter();
  if (notes.length === 0) return null;
  const teal = tone === "teal";

  return (
    <View className="flex-row flex-wrap gap-2 mt-3">
      {notes.map((note) => {
        const body = (
          <View
            className={`flex-row items-center gap-1.5 rounded-full px-3 py-2 ${
              teal ? "bg-teal-100" : "bg-coral-100"
            }`}
          >
            <Ionicons
              name={teal ? "checkmark" : "arrow-forward"}
              size={13}
              color={teal ? colors.teal700 : colors.coral700}
            />
            <Txt
              weight="semibold"
              className={`text-[12.5px] ${teal ? "text-teal-700" : "text-coral-700"}`}
            >
              {pick(note.text, lang)}
            </Txt>
          </View>
        );
        return teal || !note.milestone_key ? (
          <View key={note.key}>{body}</View>
        ) : (
          <Pressable key={note.key} onPress={() => router.push(`/roadmap/milestone/${note.milestone_key}`)}>
            {body}
          </Pressable>
        );
      })}
    </View>
  );
}

function Node({
  milestone,
  fillFraction,
  isLast,
}: {
  milestone: RoadmapMilestone;
  fillFraction: number;
  isLast: boolean;
}) {
  const look = nodeLook(milestone.state);
  const [from, to] = STAGE_COLORS[stageOf(milestone)];

  return (
    <View className="flex-row">
      {/* Rail: the node plus the connector below it. Cards never span this
          column, so the line stays unbroken and needs no measuring. */}
      <View className="w-9 items-center">
        <View
          style={[
            {
              width: 30,
              height: 30,
              borderRadius: 999,
              backgroundColor: look.bg,
              alignItems: "center",
              justifyContent: "center",
            },
            look.border
              ? { borderWidth: 2, borderColor: look.border, borderStyle: look.dashed ? "dashed" : "solid" }
              : null,
            look.glow ? shadow.teal : null,
          ]}
        >
          <Ionicons name={look.icon} size={look.icon === "ellipse" ? 10 : 15} color={look.iconColor} />
        </View>
        {!isLast ? (
          <View
            style={{
              width: 3,
              flex: 1,
              minHeight: 28,
              borderRadius: 999,
              backgroundColor: colors.sand200,
              marginTop: 4,
              overflow: "hidden",
            }}
          >
            {fillFraction > 0 ? (
              <LinearGradient
                colors={[from, to]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ height: `${fillFraction * 100}%`, borderRadius: 999 }}
              />
            ) : null}
          </View>
        ) : null}
      </View>

      <MilestoneCard milestone={milestone} />
    </View>
  );
}

function MilestoneCard({ milestone }: { milestone: RoadmapMilestone }) {
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const locked = milestone.state === "locked";
  const active = milestone.state === "active";

  return (
    <Pressable
      onPress={() => router.push(`/roadmap/milestone/${milestone.key}`)}
      accessibilityRole="button"
      accessibilityLabel={`${pick(milestone.title, lang)} — ${
        t(`roadmap.state.${milestone.state}` as never) ?? milestone.state
      }`}
      accessibilityState={{ disabled: locked, checked: milestone.state === "done" }}
      style={locked ? undefined : shadow.sm}
      className={`flex-1 mb-3 rounded-[18px] p-3.5 border ${
        locked ? "bg-sand-50 border-sand-200" : "bg-surface border-sand-200"
      }`}
    >
      {active ? (
        <View className="bg-coral-100 rounded-full px-2.5 py-1 self-start mb-2">
          <Txt weight="bold" className="text-coral-700 text-[10.5px] uppercase" style={{ letterSpacing: 0.6 }}>
            {t("roadmap.youAreHere")}
          </Txt>
        </View>
      ) : null}

      <Txt
        weight="bold"
        className={`text-[14.5px] leading-[19px] ${locked ? "text-ink-500" : "text-ink-900"}`}
      >
        {pick(milestone.title, lang)}
      </Txt>

      <View className="flex-row items-center gap-2 mt-2">
        <View className="bg-sand-100 rounded-full px-2 py-0.5">
          <Txt className="text-ink-500 text-[11px]">
            {fill(t("roadmap.dueBy"), { date: milestone.due_by })}
          </Txt>
        </View>
        {milestone.target_count && milestone.progress !== null ? (
          <Txt className="text-ink-400 text-[11px]">
            {milestone.progress}/{milestone.target_count}
          </Txt>
        ) : null}
        {milestone.projected_gain > 0 ? (
          <Txt weight="bold" className="text-teal-600 text-[11px]">
            +{milestone.projected_gain}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

/** The dark card is already this app's language for "this is AI" — the Home
 *  mentor teaser uses exactly this treatment, so the roadmap borrows it rather
 *  than inventing a second one. */
function MentorCard() {
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const { data } = useJourney();
  if (!data?.next_action) return null;

  const view = readinessView(data);
  const next = data.milestones.find((m) => m.key === data.next_action?.key);

  return (
    <Pressable
      onPress={() => router.push(`/roadmap/milestone/${data.next_action?.key}`)}
      style={[shadow.md, { backgroundColor: colors.ink900 }]}
      className="rounded-[20px] p-[18px] mt-2"
    >
      <View className="flex-row items-center gap-2">
        <Ionicons name="sparkles" size={16} color={colors.teal500} />
        <Txt weight="bold" className="text-teal-500 text-[11px] uppercase" style={{ letterSpacing: 1 }}>
          {t("roadmap.mentorNext")}
        </Txt>
      </View>
      <Txt font="display" weight="semibold" className="text-white text-[17px] leading-[23px] mt-2">
        {next ? pick(next.title, lang) : pick(data.mentor, lang)}
      </Txt>
      <View className="flex-row items-center gap-1.5 mt-2.5">
        <Txt weight="bold" className="text-teal-200 text-[13px]">
          {view.kind === "score" && view.lift
            ? fill(t("roadmap.lift"), { from: view.lift.from, to: view.lift.to })
            : data.next_action.evidence_label
              ? fill(t("roadmap.noLift"), { evidence: pick(data.next_action.evidence_label, lang) })
              : t("roadmap.openStep")}
        </Txt>
        <Ionicons name="arrow-forward" size={14} color={colors.teal200} />
      </View>
    </Pressable>
  );
}

// ── Onboarding wizard ───────────────────────────────────────────────────────

const DEGREES = ["bachelor", "master", "phd"] as const;
const COUNTRIES = ["Germany", "Canada", "USA", "United Kingdom", "Japan", "Other"] as const;
const TERMS = ["spring", "summer", "fall", "winter"] as const;
const ENGLISH = ["not_started", "preparing", "booked", "scored", "waived"] as const;
const DOC_KEYS = ["passport", "transcripts", "sop", "cv"] as const;

const STEP_COUNT = 4;

function OptionCard({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={shadow.sm}
      className={`rounded-[16px] px-4 py-3.5 mb-2.5 border-2 ${
        selected ? "bg-teal-100 border-teal-500" : "bg-surface border-transparent"
      }`}
    >
      <Txt weight="semibold" className={`text-[14px] ${selected ? "text-teal-700" : "text-ink-700"}`}>
        {label}
      </Txt>
    </Pressable>
  );
}

function Wizard() {
  const t = useT();
  const api = useApi();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [degree, setDegree] = useState<string | null>(null);
  const [cgpa, setCgpa] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [term, setTerm] = useState<string | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear() + 1);
  const [english, setEnglish] = useState<string | null>(null);
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api.updateProfile({
        // Degree and CGPA are the readiness gate. Collecting them here is what
        // makes finishing the wizard produce an actual number instead of one
        // more prompt.
        target_degree: degree,
        cgpa: cgpa.trim() === "" ? null : Number(cgpa),
        target_country: country === "Other" ? null : country,
        target_intake_term: term,
        target_intake_year: year,
        english_test_status: english,
        docs,
        roadmap_onboarded_at: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ROADMAP_KEY });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    // Without this the finish button is a dead end: the request fails, the
    // spinner stops, and the student is left on the same screen with no idea
    // why. Surface the reason and let them retry.
    onError: (err: unknown) => {
      const detail = __DEV__ && err instanceof Error ? ` (${err.message})` : "";
      setError(t("roadmap.wizSaveFailed") + detail);
    },
  });

  const next = () => {
    setError(null);
    if (step === 0) {
      if (!degree) return setError(t("roadmap.wizRequired"));
      const value = Number(cgpa);
      // Empty is allowed — a student who genuinely doesn't know it yet should not
      // be blocked — but a number we cannot read as a CGPA is worth catching here
      // rather than silently scoring as unknown later.
      if (cgpa.trim() !== "" && (!Number.isFinite(value) || value <= 0 || value > 5)) {
        return setError(t("roadmap.wizCgpaInvalid"));
      }
    }
    if (step === 1 && (!country || !term)) return setError(t("roadmap.wizRequired"));
    if (step === 2 && !english) return setError(t("roadmap.wizRequired"));
    if (step === STEP_COUNT - 1) return void save.mutate();
    setStep(step + 1);
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={[colors.teal100, colors.bgBody, colors.coral100]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="flex-row gap-1.5 mb-5">
          {Array.from({ length: STEP_COUNT }, (_, i) => i).map((i) => (
            <View
              key={i}
              style={{
                height: 4,
                flex: 1,
                borderRadius: 999,
                backgroundColor: i <= step ? colors.teal500 : colors.sand300,
              }}
            />
          ))}
        </View>

        <Txt className="text-ink-400 text-xs">{fill(t("roadmap.wizStep"), { n: step + 1 })}</Txt>
        <Txt font="display" weight="bold" className="text-ink-900 text-[23px] leading-[29px] mt-1 mb-4">
          {t(`roadmap.wizTitle${step + 1}` as never)}
        </Txt>

        {step === 0 ? (
          <>
            {DEGREES.map((d) => (
              <OptionCard
                key={d}
                label={t(`roadmap.degree.${d}` as never)}
                selected={degree === d}
                onPress={() => setDegree(d)}
              />
            ))}
            <Txt weight="semibold" className="text-ink-700 text-[13px] mt-3 mb-2">
              {t("roadmap.wizCgpa")}
            </Txt>
            <View style={shadow.sm} className="bg-surface rounded-[16px] px-4 py-1">
              <TextInput
                value={cgpa}
                onChangeText={setCgpa}
                keyboardType="decimal-pad"
                placeholder={t("roadmap.wizCgpaPlaceholder")}
                placeholderTextColor={colors.ink300}
                style={{ paddingVertical: 12, fontSize: 15, color: colors.ink900 }}
              />
            </View>
            <Txt className="text-ink-400 text-[11.5px] mt-1.5">{t("roadmap.wizCgpaHint")}</Txt>
          </>
        ) : null}

        {step === 1 ? (
          <>
            {COUNTRIES.map((c) => (
              <OptionCard key={c} label={c} selected={country === c} onPress={() => setCountry(c)} />
            ))}
            <Txt weight="semibold" className="text-ink-700 text-[13px] mt-3 mb-2">
              {t("roadmap.wizIntake")}
            </Txt>
            <View className="flex-row flex-wrap gap-2">
              {TERMS.map((tm) => (
                <Pressable
                  key={tm}
                  onPress={() => setTerm(tm)}
                  className={`rounded-full px-4 py-2.5 border-2 ${
                    term === tm ? "bg-teal-100 border-teal-500" : "bg-surface border-transparent"
                  }`}
                >
                  <Txt
                    weight="semibold"
                    className={`text-[13px] ${term === tm ? "text-teal-700" : "text-ink-700"}`}
                  >
                    {t(`roadmap.term.${tm}` as never)}
                  </Txt>
                </Pressable>
              ))}
            </View>
            <View className="flex-row items-center gap-3 mt-3">
              <Pressable onPress={() => setYear(year - 1)} className="bg-surface rounded-full p-2.5">
                <Ionicons name="remove" size={16} color={colors.ink700} />
              </Pressable>
              <Txt weight="bold" className="text-ink-900 text-base">{year}</Txt>
              <Pressable onPress={() => setYear(year + 1)} className="bg-surface rounded-full p-2.5">
                <Ionicons name="add" size={16} color={colors.ink700} />
              </Pressable>
            </View>
          </>
        ) : null}

        {step === 2
          ? ENGLISH.map((e) => (
              <OptionCard
                key={e}
                label={t(`roadmap.english.${e}` as never)}
                selected={english === e}
                onPress={() => setEnglish(e)}
              />
            ))
          : null}

        {step === 3
          ? DOC_KEYS.map((key) => (
              <View key={key} className="bg-surface rounded-[16px] p-3.5 mb-2.5" style={shadow.sm}>
                <Txt weight="semibold" className="text-ink-900 text-[14px] mb-2">
                  {t(`roadmap.doc.${key}` as never)}
                </Txt>
                <View className="flex-row gap-2">
                  {(["missing", "in_progress", "ready"] as const).map((status) => (
                    <Pressable
                      key={status}
                      onPress={() => setDocs({ ...docs, [key]: status })}
                      className={`rounded-full px-3 py-2 border ${
                        docs[key] === status
                          ? "bg-teal-100 border-teal-500"
                          : "bg-sand-50 border-sand-200"
                      }`}
                    >
                      <Txt
                        className={`text-[12px] ${
                          docs[key] === status ? "text-teal-700" : "text-ink-500"
                        }`}
                      >
                        {t(`roadmap.docStatus.${status}` as never)}
                      </Txt>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))
          : null}

        {error ? <Txt className="text-coral-700 text-[12.5px] mt-2">{error}</Txt> : null}

        <View className="flex-row gap-2.5 mt-5">
          {step > 0 ? (
            <Pressable
              onPress={() => setStep(step - 1)}
              className="bg-surface border border-sand-200 rounded-full px-5 py-3.5"
            >
              <Txt weight="bold" className="text-ink-700 text-sm">{t("roadmap.wizBack")}</Txt>
            </Pressable>
          ) : null}
          <Pressable
            onPress={next}
            disabled={save.isPending}
            className="flex-1 bg-teal-500 rounded-full px-5 py-3.5 items-center"
          >
            <Txt weight="bold" className="text-white text-sm">
              {save.isPending
                ? t("roadmap.wizSaving")
                : step === STEP_COUNT - 1
                  ? t("roadmap.wizFinish")
                  : t("roadmap.wizNext")}
            </Txt>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function RoadmapScreen() {
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const api = useApi();
  const { data, isLoading, isError, refetch, groups } = useJourney();
  const { data: profile, isPending: profileLoading } = useSignedInQuery({
    queryKey: ["profile"],
    queryFn: () => api.getProfile(),
  });

  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});

  // Bring the active node into view once, after the first render with data.
  useEffect(() => {
    if (!data) return;
    const index = activeIndex(data.milestones);
    const key = data.milestones[index]?.key;
    const y = key ? offsets.current[key] : undefined;
    if (y !== undefined && y > 220) {
      const timer = setTimeout(() => scrollRef.current?.scrollTo({ y: y - 140, animated: true }), 350);
      return () => clearTimeout(timer);
    }
  }, [data]);

  const onboarded = profile?.profile?.roadmap_onboarded_at ?? null;

  // Decide wizard-vs-journey only once the profile has landed. The roadmap query
  // can resolve first, and flashing the wizard at somebody who already finished
  // it is worse than a spinner.
  if (profileLoading) {
    return (
      <SafeAreaView className="flex-1 bg-body" edges={["top"]}>
        <ActivityIndicator color={colors.teal500} className="mt-20" />
      </SafeAreaView>
    );
  }

  if (!onboarded) {
    return (
      <SafeAreaView className="flex-1 bg-body" edges={["top"]}>
        <View className="flex-row items-center gap-3 px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="w-[38px] h-[38px] rounded-full bg-surface border border-sand-200 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={20} color={colors.ink900} />
          </Pressable>
          <Txt font="display" weight="semibold" className="text-ink-900 text-xl">
            {t("roadmap.setupTitle")}
          </Txt>
        </View>
        <Wizard />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-body" edges={["top"]}>
      <LinearGradient
        colors={[colors.teal100, colors.bgBody, colors.coral100]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="w-[38px] h-[38px] rounded-full bg-surface border border-sand-200 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink900} />
        </Pressable>
        <View className="flex-1" />
        <Pressable
          onPress={() => router.push("/profile-edit")}
          className="w-[38px] h-[38px] rounded-full bg-surface border border-sand-200 items-center justify-center"
        >
          <Ionicons name="create-outline" size={19} color={colors.ink700} />
        </Pressable>
      </View>

      {isLoading ? (
        <View className="items-center pt-24">
          <ActivityIndicator color={colors.teal500} />
          <Txt className="text-ink-400 text-[13px] mt-3">{t("roadmap.loading")}</Txt>
        </View>
      ) : isError || !data ? (
        <View className="items-center px-8 pt-20">
          <Ionicons name="cloud-offline-outline" size={38} color={colors.ink300} />
          <Txt className="text-ink-500 text-[13px] text-center mt-3">{t("roadmap.loadError")}</Txt>
          <Pressable onPress={() => refetch()} className="bg-teal-500 rounded-full px-5 py-3 mt-4">
            <Txt weight="bold" className="text-white text-sm">{t("common.retry")}</Txt>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <Header />
          <Notes notes={data.strengths} tone="teal" />
          <Notes notes={data.weaknesses} tone="coral" />

          {data.feasibility !== "on-track" ? (
            <View
              className={`rounded-[18px] p-4 mt-4 ${
                data.feasibility === "tight" ? "bg-coral-100" : ""
              }`}
              style={data.feasibility === "not-feasible" ? { backgroundColor: colors.ink900 } : undefined}
            >
              <Txt
                weight="semibold"
                className={`text-[13.5px] leading-5 ${
                  data.feasibility === "tight" ? "text-coral-700" : "text-white"
                }`}
              >
                {data.feasibility === "tight"
                  ? t("roadmap.feasibleTight")
                  : data.suggested_intake
                    ? fill(t("roadmap.feasibleNo"), {
                        term: t(`roadmap.term.${data.suggested_intake.term}` as never),
                        year: data.suggested_intake.year,
                      })
                    : t("roadmap.feasibleTight")}
              </Txt>
            </View>
          ) : null}

          <MentorCard />

          {groups.map((group) => (
            <View key={group.stage} className="mt-6">
              <View className="flex-row items-center gap-2 mb-3">
                <Txt
                  weight="bold"
                  className="text-ink-400 text-[11px] uppercase"
                  style={{ letterSpacing: 1 }}
                >
                  {t(`roadmap.stage.${group.stage}` as never)}
                </Txt>
                <View className="bg-sand-100 rounded-full px-2 py-0.5">
                  <Txt className="text-ink-500 text-[10.5px]">
                    {fill(t("roadmap.stageCount"), {
                      done: group.done,
                      total: group.items.length,
                    })}
                  </Txt>
                </View>
              </View>

              {group.items.map((milestone) => {
                const index = data.milestones.findIndex((m) => m.key === milestone.key);
                return (
                  <View
                    key={milestone.key}
                    onLayout={(event) => {
                      offsets.current[milestone.key] = event.nativeEvent.layout.y;
                    }}
                  >
                    <Node
                      milestone={milestone}
                      fillFraction={connectorFill(data.milestones, index)}
                      isLast={milestone.key === group.items[group.items.length - 1].key}
                    />
                  </View>
                );
              })}
            </View>
          ))}

          {data.narration_status !== "ready" ? (
            <Txt className="text-ink-300 text-[11px] text-center mt-6">
              {pick(data.mentor, lang)}
            </Txt>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
