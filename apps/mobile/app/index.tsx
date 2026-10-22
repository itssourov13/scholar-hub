import { Redirect } from "expo-router";

// Entry point. The AuthGate in the root layout redirects to (auth) when signed
// out; signed-in users land on the tab bar.
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
