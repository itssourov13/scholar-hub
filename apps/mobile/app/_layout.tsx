import "../global.css";

import { useEffect } from "react";
import { Stack, useRouter, useSegments, type Href } from "expo-router";
import * as Notifications from "expo-notifications";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { View, ActivityIndicator } from "react-native";
import { useFonts } from "expo-font";
import {
  HindSiliguri_400Regular,
  HindSiliguri_500Medium,
  HindSiliguri_600SemiBold,
  HindSiliguri_700Bold,
} from "@expo-google-fonts/hind-siliguri";
import {
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from "@expo-google-fonts/fraunces";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";

import { CLERK_PUBLISHABLE_KEY } from "@/lib/config";
import { tokenCache } from "@/lib/token-cache";
import { queryClient } from "@/lib/query";
import { ApiProvider, useApi } from "@/lib/api";
import { LangProvider, useLang } from "@/i18n";
import { notificationUrl, registerPushNotifications } from "@/lib/notifications";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

/** The cold-start notification tap must only navigate once per launch. */
let handledColdStartTap = false;

/**
 * Redirects between the (auth) and (tabs) route groups based on Clerk's
 * sign-in state. Renders a spinner until Clerk has loaded so we never flash the
 * wrong screen.
 */
function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const api = useApi();
  const { lang } = useLang();

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === "(auth)";

    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isLoaded, isSignedIn, segments, router]);

  // Push registration happens once signed in, so the permission prompt lands
  // after auth rather than on the sign-in screen. Re-runs on a language change
  // to keep the server sending copy in the language this device is using.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    registerPushNotifications(api, lang).catch(() => {});
  }, [isLoaded, isSignedIn, api, lang]);

  // Route notification taps, whether they cold-started the app or arrived while
  // it was already running.
  useEffect(() => {
    const openFromNotification = (resp: Notifications.NotificationResponse | null) => {
      const url = notificationUrl(resp);
      if (url) router.push(url as Href);
    };
    if (!handledColdStartTap) {
      handledColdStartTap = true;
      Notifications.getLastNotificationResponseAsync().then(openFromNotification).catch(() => {});
    }
    const sub = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    return () => sub.remove();
  }, [router]);

  if (!isLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-body">
        <ActivityIndicator color={colors.teal500} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgBody } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="scholarship/[id]" />
      <Stack.Screen name="guide/[slug]" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="cv" />
      <Stack.Screen name="roadmap" />
      <Stack.Screen name="profile-edit" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="bookmarks" />
    </Stack>
  );
}

/** Holds the splash screen until fonts + persisted language have loaded. */
function AppShell({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { ready: langReady } = useLang();
  const appReady = fontsLoaded && langReady;

  useEffect(() => {
    if (appReady) SplashScreen.hideAsync().catch(() => {});
  }, [appReady]);

  if (!appReady) return null;
  return <AuthGate />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    HindSiliguri_400Regular,
    HindSiliguri_500Medium,
    HindSiliguri_600SemiBold,
    HindSiliguri_700Bold,
  });

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <ApiProvider>
          <LangProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <SafeAreaProvider>
                <AppShell fontsLoaded={fontsLoaded} />
                <StatusBar style="dark" />
              </SafeAreaProvider>
            </GestureHandlerRootView>
          </LangProvider>
        </ApiProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
