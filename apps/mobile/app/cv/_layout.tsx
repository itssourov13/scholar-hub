import { Stack } from "expo-router";
import { colors } from "@/theme";

export default function CvLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgBody } }} />;
}
