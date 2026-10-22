import { Pressable, ActivityIndicator, View, type PressableProps } from "react-native";
import { Txt } from "./Text";
import { colors, shadow } from "@/theme";

type Variant = "primary" | "coral" | "outline" | "ghost";
type Size = "md" | "lg";

const bg: Record<Variant, string> = {
  primary: "bg-teal-500",
  coral: "bg-coral-500",
  outline: "bg-surface border border-sand-300",
  ghost: "bg-transparent",
};
const fg: Record<Variant, string> = {
  primary: "text-white",
  coral: "text-white",
  outline: "text-teal-700",
  ghost: "text-teal-700",
};
const pad: Record<Size, string> = { md: "py-3 px-5", lg: "py-4 px-6" };

export interface ButtonProps extends Omit<PressableProps, "children"> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Optional leading node (e.g. an icon). */
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

/** Pill button matching the web's teal CTA language. */
export function Button({
  label,
  variant = "primary",
  size = "lg",
  loading,
  icon,
  fullWidth = true,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const elevated = variant === "primary" || variant === "coral";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={[elevated ? shadow.teal : undefined, style as object]}
      className={[
        "rounded-full flex-row items-center justify-center gap-2 active:opacity-90",
        bg[variant],
        pad[size],
        fullWidth ? "w-full" : "self-start",
        disabled || loading ? "opacity-60" : "",
      ].join(" ")}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" || variant === "ghost" ? colors.teal700 : colors.white} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Txt weight="semibold" className={`${fg[variant]} text-base`}>
            {label}
          </Txt>
        </>
      )}
    </Pressable>
  );
}
