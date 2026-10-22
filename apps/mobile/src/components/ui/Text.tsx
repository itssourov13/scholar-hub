import { Text, type TextProps, type StyleProp, type TextStyle } from "react-native";
import { useLang } from "@/i18n";
import { fonts } from "@/theme";

type FontKind = "display" | "body";
type Weight = "regular" | "medium" | "semibold" | "bold";

function resolveFamily(kind: FontKind, weight: Weight, lang: "en" | "bn"): string {
  // Bengali has no Fraunces/Manrope coverage — always Hind Siliguri.
  if (lang === "bn") {
    if (weight === "regular") return fonts.bengali;
    if (weight === "medium") return fonts.bengaliMedium;
    return weight === "bold" ? fonts.bengaliBold : fonts.bengaliSemibold;
  }
  if (kind === "display") {
    return weight === "bold" ? fonts.displayBold : fonts.displaySemibold;
  }
  if (weight === "regular") return fonts.body;
  if (weight === "medium") return fonts.bodyMedium;
  if (weight === "bold") return fonts.bodyBold;
  return fonts.bodySemibold;
}

export interface TxtProps extends TextProps {
  /** "display" = Fraunces serif (headings); "body" = Manrope. Default body. */
  font?: FontKind;
  weight?: Weight;
}

/**
 * The single typography primitive. Resolves the correct loaded font family from
 * `font` + `weight` + the active language, then lets className handle size/color.
 * Default text color is ink-900 unless overridden via className.
 */
export function Txt({ font = "body", weight = "regular", style, className, ...props }: TxtProps) {
  const { lang } = useLang();
  const family: StyleProp<TextStyle> = { fontFamily: resolveFamily(font, weight, lang) };
  return (
    <Text
      {...props}
      className={className ?? "text-ink-900"}
      style={[family, style]}
    />
  );
}
