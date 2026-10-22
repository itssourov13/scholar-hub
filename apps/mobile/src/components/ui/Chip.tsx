import { View, type ViewProps } from "react-native";
import { Txt } from "./Text";

type Tone = "neutral" | "teal" | "coral";

const toneBg: Record<Tone, string> = {
  neutral: "bg-sand-100",
  teal: "bg-teal-100",
  coral: "bg-coral-100",
};
const toneFg: Record<Tone, string> = {
  neutral: "text-ink-700",
  teal: "text-teal-700",
  coral: "text-coral-700",
};

/** Small pill for meta/tags (country, funding, deadline …). */
export function Chip({
  label,
  tone = "neutral",
  className,
  ...props
}: { label: string; tone?: Tone } & ViewProps) {
  return (
    <View className={`rounded-full px-3 py-1 ${toneBg[tone]} ${className ?? ""}`} {...props}>
      <Txt weight="medium" className={`text-xs ${toneFg[tone]}`}>
        {label}
      </Txt>
    </View>
  );
}
