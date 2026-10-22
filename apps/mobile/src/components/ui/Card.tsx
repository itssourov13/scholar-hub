import { View, Pressable, type ViewProps, type PressableProps } from "react-native";
import { shadow } from "@/theme";

/** White surface card with soft elevation and 16px radius (web --radius-lg). */
export function Card({ className, style, ...props }: ViewProps) {
  return (
    <View
      style={[shadow.sm, style as object]}
      className={`bg-surface rounded-2xl border border-sand-200 ${className ?? ""}`}
      {...props}
    />
  );
}

/** Tappable variant of Card (e.g. list rows). */
export function PressableCard({ className, style, ...props }: PressableProps) {
  return (
    <Pressable
      style={[shadow.sm, style as object]}
      className={`bg-surface rounded-2xl border border-sand-200 active:opacity-90 ${
        typeof className === "string" ? className : ""
      }`}
      {...props}
    />
  );
}
