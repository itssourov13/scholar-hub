import { ImageBackground, View, type ViewStyle, type StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { tintFor } from "@/theme";

interface CoverArtProps {
  /** Real scholarship image; falls back to a deterministic gradient when absent. */
  uri?: string | null;
  /** Stable key (scholarship id) used to pick a consistent fallback gradient. */
  tintKey: string;
  style?: StyleProp<ViewStyle>;
  /** Darken the bottom for overlaid white text/pills. */
  scrim?: boolean;
  children?: React.ReactNode;
}

/**
 * The colourful card/detail header from the design. Renders the real
 * `thumbnail_url` when available, otherwise a per-scholarship gradient tint so
 * the grid still looks like the mockup. Overlays `children` (pills, buttons).
 */
export function CoverArt({ uri, tintKey, style, scrim = true, children }: CoverArtProps) {
  const [a, b] = tintFor(tintKey);

  const content = (
    <>
      {scrim ? (
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.34)"]}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        />
      ) : null}
      {children}
    </>
  );

  if (uri) {
    return (
      <ImageBackground source={{ uri }} style={style} imageStyle={{ resizeMode: "cover" }}>
        {content}
      </ImageBackground>
    );
  }

  return (
    <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      {content as React.ReactElement}
    </LinearGradient>
  );
}

/** Simple non-image gradient panel (hero cards, headers, avatars). */
export function Gradient({
  colors,
  style,
  children,
}: {
  colors: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      {children as React.ReactElement}
    </LinearGradient>
  );
}

/** A View placeholder to keep JSX tidy where a plain box is needed. */
export const Box = View;
