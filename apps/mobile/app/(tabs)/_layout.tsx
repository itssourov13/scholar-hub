import { Tabs, useRouter } from "expo-router";
import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "@/i18n";
import { Txt } from "@/components/ui";
import { colors, gradients, shadow } from "@/theme";

type IoniconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; labelKey: Parameters<ReturnType<typeof useT>>[0]; icon: IoniconName }[] = [
  { name: "index", labelKey: "tab.home", icon: "home" },
  { name: "scholarships", labelKey: "tab.discover", icon: "compass" },
  { name: "guides", labelKey: "tab.guides", icon: "book" },
  { name: "profile", labelKey: "tab.profile", icon: "person" },
];

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

/** Custom bottom bar: 4 tabs split around a floating teal Mentor FAB. */
function TabBar({ state, navigation }: TabBarProps) {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const routeIndex = (name: string) => state.routes.findIndex((r) => r.name === name);

  const item = (cfg: (typeof TABS)[number]) => {
    const idx = routeIndex(cfg.name);
    const focused = state.index === idx;
    const color = focused ? colors.teal600 : colors.ink400;
    return (
      <Pressable
        key={cfg.name}
        className="flex-1 items-center gap-0.5"
        onPress={() => {
          const route = state.routes[idx];
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
      >
        <Ionicons name={focused ? cfg.icon : (`${cfg.icon}-outline` as IoniconName)} size={24} color={color} />
        <Txt weight="semibold" className={focused ? "text-teal-600" : "text-ink-400"} style={{ fontSize: 10.5 }}>
          {t(cfg.labelKey)}
        </Txt>
      </Pressable>
    );
  };

  return (
    <View>
      {/* Floating Mentor FAB */}
      <Pressable
        onPress={() => router.push("/chat")}
        style={[
          shadow.teal,
          {
            position: "absolute",
            left: "50%",
            marginLeft: -30,
            bottom: insets.bottom + 26,
            zIndex: 10,
          },
        ]}
      >
        <LinearGradient
          colors={gradients.fab}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 4,
            borderColor: colors.bgBody,
          }}
        >
          <Ionicons name="sparkles" size={26} color={colors.white} />
        </LinearGradient>
      </Pressable>

      <View
        style={[
          shadow.md,
          {
            flexDirection: "row",
            alignItems: "flex-start",
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.sand200,
            paddingTop: 9,
            paddingBottom: insets.bottom + 8,
            paddingHorizontal: 10,
          },
        ]}
      >
        {item(TABS[0])}
        {item(TABS[1])}
        <View style={{ width: 60 }} />
        {item(TABS[2])}
        {item(TABS[3])}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...(props as unknown as TabBarProps)} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bgBody } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="scholarships" />
      <Tabs.Screen name="guides" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
