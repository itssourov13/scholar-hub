import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLang, useT } from "@/i18n";
import { Txt } from "@/components/ui";
import { colors, shadow } from "@/theme";
import { setPendingChatPrompt } from "@/lib/chat-handoff";
import { fill, nodeLook, pick, useRoadmap, useUpdateMilestone } from "@/lib/roadmap";

export default function MilestoneScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const { data, isLoading } = useRoadmap();
  const update = useUpdateMilestone();

  const milestone = data?.milestones.find((m) => m.key === key);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-body" edges={["top"]}>
        <ActivityIndicator color={colors.teal500} className="mt-16" />
      </SafeAreaView>
    );
  }

  if (!milestone) {
    return (
      <SafeAreaView className="flex-1 bg-body" edges={["top"]}>
        <View className="items-center px-8 pt-24">
          <Ionicons name="help-circle-outline" size={38} color={colors.ink300} />
          <Txt className="text-ink-500 text-[13.5px] text-center mt-3">{t("roadmap.notFound")}</Txt>
          <Pressable onPress={() => router.back()} className="bg-teal-500 rounded-full px-5 py-3 mt-4">
            <Txt weight="bold" className="text-white text-sm">{t("roadmap.backToRoadmap")}</Txt>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const look = nodeLook(milestone.state);
  const isDone = milestone.status === "done";

  /** Where the primary action goes. A `guide` slug that has not been written yet
   *  lands on the guide screen's own not-found, so every step also offers the
   *  mentor as a second, always-working route. */
  /** Opens the mentor with the question already asked. Dropping the student on
   *  an empty chat makes them retype the context the app already knows. */
  const askMentor = () => {
    setPendingChatPrompt(fill(t("roadmap.mentorPrompt"), { title: pick(milestone.title, lang) }));
    router.push("/chat");
  };

  const openAction = () => {
    const action = milestone.action;
    switch (action.kind) {
      case "cv":
        return router.push("/cv");
      case "discover":
        return router.push("/(tabs)/scholarships");
      case "guide":
        return router.push(`/guide/${action.slug}`);
      case "mentor":
        return askMentor();
      case "form":
        return router.push("/profile-edit");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-body" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="w-[38px] h-[38px] rounded-full bg-surface border border-sand-200 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink900} />
        </Pressable>
        <View
          style={[
            {
              width: 26,
              height: 26,
              borderRadius: 999,
              backgroundColor: look.bg,
              alignItems: "center",
              justifyContent: "center",
            },
            look.border ? { borderWidth: 2, borderColor: look.border } : null,
          ]}
        >
          <Ionicons name={look.icon} size={look.icon === "ellipse" ? 9 : 13} color={look.iconColor} />
        </View>
        <Txt weight="semibold" className="text-ink-500 text-[12.5px]">
          {t(`roadmap.state.${milestone.state}` as never)}
        </Txt>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <Txt font="display" weight="bold" className="text-ink-900 text-[22px] leading-[28px]">
          {pick(milestone.title, lang)}
        </Txt>

        <View className="flex-row items-center gap-2 mt-3">
          <View className="bg-sand-100 rounded-full px-2.5 py-1">
            <Txt className="text-ink-500 text-[11.5px]">
              {fill(t("roadmap.dueBy"), { date: milestone.due_by })}
            </Txt>
          </View>
          <View className="bg-sand-100 rounded-full px-2.5 py-1">
            <Txt className="text-ink-500 text-[11.5px]">
              {fill(t("roadmap.etaDays"), { n: milestone.eta_days })}
            </Txt>
          </View>
          {milestone.projected_gain > 0 ? (
            <View className="bg-teal-100 rounded-full px-2.5 py-1">
              <Txt weight="bold" className="text-teal-700 text-[11.5px]">
                +{milestone.projected_gain}
              </Txt>
            </View>
          ) : null}
        </View>

        <Txt className="text-ink-700 text-[14px] leading-[21px] mt-4">
          {pick(milestone.description, lang)}
        </Txt>

        {pick(milestone.why, lang) !== pick(milestone.description, lang) ? (
          <View style={shadow.sm} className="bg-surface border border-sand-200 rounded-[18px] p-4 mt-4">
            <Txt
              weight="bold"
              className="text-teal-700 text-[11px] uppercase mb-2"
              style={{ letterSpacing: 0.8 }}
            >
              {t("roadmap.detailWhy")}
            </Txt>
            <Txt className="text-ink-700 text-[13.5px] leading-5">{pick(milestone.why, lang)}</Txt>
          </View>
        ) : null}

        {/* The honest bit: ticking a box does not move the score. If the stored
            proof is missing, say what would release the points instead of
            promising a lift. */}
        {milestone.evidence_label ? (
          <View className="bg-coral-100 rounded-[18px] p-4 mt-4">
            <Txt weight="semibold" className="text-coral-700 text-[13px] leading-5">
              {fill(t("roadmap.needsEvidence"), {
                evidence: pick(milestone.evidence_label, lang),
              })}
            </Txt>
          </View>
        ) : null}

        <Pressable
          onPress={openAction}
          style={shadow.teal}
          className="bg-teal-500 rounded-full px-5 py-4 mt-5 flex-row items-center justify-center gap-2"
        >
          <Txt weight="bold" className="text-white text-[14.5px]">
            {milestone.action.kind === "cv"
              ? t("roadmap.actionCv")
              : milestone.action.kind === "discover"
                ? t("roadmap.actionDiscover")
                : milestone.action.kind === "guide"
                  ? t("roadmap.actionGuide")
                  : milestone.action.kind === "mentor"
                    ? t("roadmap.actionMentor")
                    : t("roadmap.actionForm")}
          </Txt>
          <Ionicons name="arrow-forward" size={16} color={colors.white} />
        </Pressable>

        {/* When the step's own action already is the mentor, the primary button
            above covers it — a second identical button just reads as a bug. */}
        {milestone.action.kind !== "mentor" ? (
          <Pressable
            onPress={askMentor}
            className="border border-sand-200 bg-surface rounded-full px-5 py-3.5 mt-2.5 flex-row items-center justify-center gap-2"
          >
            <Ionicons name="sparkles" size={15} color={colors.teal600} />
            <Txt weight="bold" className="text-teal-700 text-[13.5px]">{t("roadmap.askMentor")}</Txt>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() =>
            update.mutate(
              { key: milestone.key, status: isDone ? "todo" : "done" },
              { onSuccess: () => router.back() },
            )
          }
          disabled={update.isPending}
          className="rounded-full px-5 py-3.5 mt-2.5 flex-row items-center justify-center gap-2"
        >
          <Ionicons
            name={isDone ? "close-circle-outline" : "checkmark-circle-outline"}
            size={17}
            color={colors.ink500}
          />
          <Txt weight="bold" className="text-ink-500 text-[13.5px]">
            {update.isPending
              ? t("roadmap.saving")
              : isDone
                ? t("roadmap.markUndone")
                : t("roadmap.markDone")}
          </Txt>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
