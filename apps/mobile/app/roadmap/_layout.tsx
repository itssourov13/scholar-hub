import { Stack } from "expo-router";
import { colors } from "@/theme";

export default function RoadmapLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgBody } }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="milestone/[key]" />
    </Stack>
  );
}
