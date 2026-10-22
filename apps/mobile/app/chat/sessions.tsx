import { View, FlatList, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatSession } from "@scholarhub/shared";
import { useApi } from "@/lib/api";
import { setPendingChatSession } from "@/lib/chat-handoff";
import { useT } from "@/i18n";
import { Txt } from "@/components/ui";
import { colors, shadow } from "@/theme";

export default function Sessions() {
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["chat-sessions"],
    queryFn: () => api.getChatSessions(),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteChatSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chat-sessions"] }),
  });

  function open(session: ChatSession) {
    // dismissTo with params doesn't reach the mounted chat screen; hand the id
    // over via the module mailbox and just go back.
    setPendingChatSession(session.id);
    router.back();
  }

  const sessions = data?.sessions ?? [];

  return (
    <SafeAreaView className="flex-1 bg-body" edges={["bottom"]}>
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.teal500} />
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <View className="h-2.5" />}
          renderItem={({ item }) => (
            <Pressable
              style={shadow.sm}
              className="bg-surface border border-sand-200 rounded-2xl p-4 flex-row items-center gap-3 active:opacity-90"
              onPress={() => open(item)}
            >
              <View className="w-9 h-9 rounded-xl bg-teal-100 items-center justify-center">
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.teal600} />
              </View>
              <Txt weight="medium" className="text-ink-800 flex-1" numberOfLines={1}>
                {item.title}
              </Txt>
              <Pressable
                hitSlop={10}
                onPress={() =>
                  Alert.alert(t("chat.delete"), item.title, [
                    { text: t("common.cancel"), style: "cancel" },
                    { text: t("chat.delete"), style: "destructive", onPress: () => del.mutate(item.id) },
                  ])
                }
              >
                <Ionicons name="trash-outline" size={18} color={colors.coral500} />
              </Pressable>
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center mt-20">
              <Ionicons name="chatbubbles-outline" size={40} color={colors.ink400} />
              <Txt className="text-ink-400 text-center mt-3">{t("chat.noSessions")}</Txt>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
