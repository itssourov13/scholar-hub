import { type ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

/** Page wrapper: warm body background + safe-area padding. */
export function Screen({
  children,
  edges = ["bottom"],
  className = "",
}: {
  children: ReactNode;
  edges?: Edge[];
  className?: string;
}) {
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-body">
      <View className={`flex-1 ${className}`}>{children}</View>
    </SafeAreaView>
  );
}
