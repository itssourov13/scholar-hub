import { Image } from "react-native";

const LOGO = require("../../../assets/logo.png");

/** The ScholarHub brand mark (teal B + grad cap + road + pin). */
export function Logo({ size = 64 }: { size?: number }) {
  return <Image source={LOGO} style={{ width: size, height: size }} resizeMode="contain" />;
}
