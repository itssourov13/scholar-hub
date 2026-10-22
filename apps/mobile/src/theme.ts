/**
 * Design tokens ported from the web app (apps/web/src/app/globals.css).
 * Light, warm theme: sand surfaces, teal primary, coral accent.
 * Use `colors` in JS (StatusBar, tab bar, icons, ActivityIndicator) and the
 * matching Tailwind names (bg-teal-500, text-ink-900, …) in className.
 */
export const colors = {
  // Ink (text)
  ink900: "#1b1b1b",
  ink800: "#2a2a2a",
  ink700: "#3d3d3d",
  ink500: "#5e5e5e",
  ink400: "#9aa8b8",
  ink300: "#b8c4d0",

  // Surface / neutral (sand)
  sand50: "#faf9f7",
  sand100: "#f4f1ed",
  sand200: "#e8e3db",
  sand300: "#d4cfc7",

  // Brand — teal
  teal100: "#e0f5f4",
  teal200: "#b0e5e3",
  teal500: "#0f8f8d",
  teal600: "#0c7b79",
  teal700: "#0a6d6b",
  teal800: "#074e4d",

  // Brand — coral
  coral100: "#fdeee9",
  coral400: "#f08a68",
  coral500: "#e06e48",
  coral700: "#b14a2a",

  // Semantic
  bgBody: "#f8f8f7",
  surface: "#ffffff",
  border: "#e8e3db",
  white: "#ffffff",
} as const;

/**
 * Font families. Each weight is its own loaded family (React Native doesn't
 * synthesize weights reliably for custom fonts). The typography components in
 * ui/Text pick the right family per variant + language.
 */
export const fonts = {
  // Display — Fraunces (serif headings)
  displaySemibold: "Fraunces_600SemiBold",
  displayBold: "Fraunces_700Bold",
  // Body — Manrope
  body: "Manrope_400Regular",
  bodyMedium: "Manrope_500Medium",
  bodySemibold: "Manrope_600SemiBold",
  bodyBold: "Manrope_700Bold",
  // Bengali — Hind Siliguri
  bengali: "HindSiliguri_400Regular",
  bengaliMedium: "HindSiliguri_500Medium",
  bengaliSemibold: "HindSiliguri_600SemiBold",
  bengaliBold: "HindSiliguri_700Bold",
} as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/**
 * Brand gradient pairs (top-left → bottom-right) for LinearGradient. Ported from
 * the Claude Design spec so surfaces read identically to the mockup.
 */
export const gradients = {
  hero: ["#0f8f8d", "#074e4d"] as const, // teal hero cards
  heroSoft: ["#0f8f8d", "#0a6d6b"] as const,
  guides: ["#074e4d", "#0a6d6b"] as const, // guides header
  profile: ["#0f8f8d", "#074e4d"] as const, // profile header
  avatar: ["#f08a68", "#e06e48"] as const, // coral initials avatar
  fab: ["#0f8f8d", "#074e4d"] as const,
  signin: ["#e0f5f4", "#f8f8f7", "#fdeee9"] as const, // sign-in backdrop
} as const;

/**
 * Deterministic per-scholarship gradient tints for card/detail headers when no
 * `thumbnail_url` exists (the design mockup used only gradients). Hash the id so
 * the same scholarship always gets the same colour.
 */
export const tints = [
  ["#e8a0b0", "#c86a80"], // pink
  ["#d8b26a", "#b0863c"], // gold
  ["#7fa8c9", "#4a6f92"], // blue
  ["#4bb0ad", "#0a6d6b"], // teal
  ["#d98a6a", "#b14a2a"], // rust
  ["#6ab0a0", "#2c7d6a"], // green
  ["#8a7fc9", "#544a92"], // purple
  ["#c2504a", "#8a2f2f"], // red
] as const;

export function tintFor(key: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return tints[h % tints.length];
}

/** Soft elevation matching the web's --shadow-sm/md (cool-tinted). */
export const shadow = {
  sm: {
    shadowColor: "#0f2234",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: "#0f2234",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 5,
  },
  teal: {
    shadowColor: "#0f8f8d",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 6,
  },
} as const;
