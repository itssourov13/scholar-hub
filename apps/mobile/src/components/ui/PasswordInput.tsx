import { useState } from "react";
import { View, TextInput, Pressable, type TextInputProps, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useT } from "@/i18n";
import { colors, fonts } from "@/theme";

export interface PasswordInputProps extends Omit<TextInputProps, "secureTextEntry"> {
  /** Optional glyph rendered before the field (the sign-in screen's lock icon). */
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  /** Overrides the field shell so each screen keeps its own padding/shadow. */
  containerClassName?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Password field with a show/hide toggle. Masking is on by default and the eye
 * button never changes the value, only `secureTextEntry`, so autofill and
 * password managers behave the same as a plain masked input.
 */
export function PasswordInput({
  leadingIcon,
  containerClassName = "flex-row items-center gap-2.5 bg-surface border border-sand-200 rounded-2xl px-4 py-3.5",
  containerStyle,
  style,
  ...props
}: PasswordInputProps) {
  const t = useT();
  const [visible, setVisible] = useState(false);

  return (
    <View style={containerStyle} className={containerClassName}>
      {leadingIcon ? <Ionicons name={leadingIcon} size={19} color={colors.ink400} /> : null}
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        className="flex-1 text-ink-900 p-0"
        style={[{ fontFamily: fonts.body }, style]}
        secureTextEntry={!visible}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={visible ? t("auth.hidePassword") : t("auth.showPassword")}
        accessibilityState={{ selected: visible }}
      >
        <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={19} color={colors.ink400} />
      </Pressable>
    </View>
  );
}
