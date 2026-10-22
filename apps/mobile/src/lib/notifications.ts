import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { API_BASE } from "./config";
import { LANG_STORAGE } from "@/i18n";
import { translations, type Lang, type TranslationKey } from "@/i18n/translations";

/**
 * Notifications are server-pushed over FCM: the device registers its token with
 * /api/push/register and the backend fans out the moment a scholarship or guide
 * is published.
 *
 * The old on-device polling is kept only as a fallback for devices where FCM
 * registration fails (no Play Services, permission denied, Firebase misconfig).
 * Two rules keep the two paths from stepping on each other:
 *
 *   1. Once a push token registers, the polling task is torn down — otherwise
 *      every new scholarship would arrive twice.
 *   2. A check running in the foreground never posts a notification, it only
 *      moves the seen-id baseline. That is what used to dump the whole backlog
 *      into the tray the instant the app was opened.
 */
const TASK_NAME = "bp-content-check";
/**
 * Two channels, because they warrant different levels of interruption: a newly
 * published scholarship can wait in the shade, an application deadline three
 * days out should interrupt. Android won't let an app raise the importance of a
 * channel that already exists on a device, so these must stay separate.
 */
const CHANNEL_ID = "content";
const CHANNEL_DEADLINES = "deadlines";
const SEEN_SCHOLARSHIPS = "bp_seen_scholarships";
const SEEN_GUIDES = "bp_seen_guides";
/** "1" once FCM registration succeeded; disables the polling fallback. */
const PUSH_ACTIVE = "bp_push_active";
/** Last token handed to the server, so sign-out can retire the right one. */
const PUSH_TOKEN = "bp_push_token";

/** How the app shows notifications that arrive while it's foregrounded. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** The background task can't use React context, so it reads the persisted
 * language directly and translates from the raw dictionary. */
async function currentLang(): Promise<Lang> {
  const stored = await SecureStore.getItemAsync(LANG_STORAGE).catch(() => null);
  return stored === "bn" ? "bn" : "en";
}

function tr(key: TranslationKey, lang: Lang): string {
  return translations[key][lang];
}

async function loadSeen(key: string): Promise<Set<string> | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return null;
  }
}

async function saveSeen(key: string, ids: string[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(ids));
}

async function notify(title: string, body: string, url: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { url } },
    trigger: { channelId: CHANNEL_ID },
  });
}

type ContentItem = { id: string; title: string; url: string };

/**
 * Diff one content list against its stored baseline. With `notify: false` the
 * baseline is advanced silently — used on every app launch, and on first run so
 * a fresh install isn't blasted with the entire back catalogue.
 */
async function diffList(
  storageKey: string,
  items: ContentItem[],
  lang: Lang,
  keys: { one: TranslationKey; many: TranslationKey; manyBody: TranslationKey },
  listUrl: string,
  shouldNotify: boolean,
): Promise<void> {
  const seen = await loadSeen(storageKey);
  const ids = items.map((i) => i.id);
  if (seen === null) {
    await saveSeen(storageKey, ids);
    return;
  }
  const fresh = items.filter((i) => !seen.has(i.id));
  if (fresh.length === 0) return;

  if (shouldNotify) {
    if (fresh.length <= 3) {
      for (const item of fresh) {
        await notify(tr(keys.one, lang), item.title, item.url);
      }
    } else {
      await notify(tr(keys.many, lang), `${fresh.length} ${tr(keys.manyBody, lang)}`, listUrl);
    }
  }
  await saveSeen(storageKey, ids);
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** One poll of the public lists. Only notifies when explicitly asked to. */
export async function checkForNewContent(shouldNotify: boolean): Promise<void> {
  const lang = await currentLang();

  const scholarships = await fetchJson<{ scholarships: { id: string; title: string }[] }>(
    "/api/scholarships?status=published",
  );
  if (scholarships?.scholarships) {
    await diffList(
      SEEN_SCHOLARSHIPS,
      scholarships.scholarships.map((s) => ({ id: s.id, title: s.title, url: `/scholarship/${s.id}` })),
      lang,
      { one: "push.newScholarship", many: "push.newScholarships", manyBody: "push.newScholarshipsBody" },
      "/scholarships",
      shouldNotify,
    );
  }

  const guides = await fetchJson<{ guides: { slug: string; title: string }[] }>("/api/guides");
  if (guides?.guides) {
    await diffList(
      SEEN_GUIDES,
      guides.guides.map((g) => ({ id: g.slug, title: g.title, url: `/guide/${g.slug}` })),
      lang,
      { one: "push.newGuide", many: "push.newGuides", manyBody: "push.newGuidesBody" },
      "/guides",
      shouldNotify,
    );
  }
}

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    // Server push won the race since this task was scheduled; stand down rather
    // than duplicating whatever FCM has already delivered.
    if ((await AsyncStorage.getItem(PUSH_ACTIVE)) === "1") {
      return BackgroundTask.BackgroundTaskResult.Success;
    }
    await checkForNewContent(true);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

async function startPollingFallback(): Promise<void> {
  const status = await BackgroundTask.getStatusAsync().catch(() => null);
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
  // Floor of 60 min between checks; Android schedules the real cadence, and in
  // practice defers it heavily. Hence: fallback only.
  await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: 60 }).catch(() => {});
}

async function stopPollingFallback(): Promise<void> {
  const registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME).catch(() => false);
  if (registered) await BackgroundTask.unregisterTaskAsync(TASK_NAME).catch(() => {});
}

export interface PushRegistrar {
  registerPushToken(input: {
    token: string;
    platform: string;
    lang: string;
    appVersion?: string;
  }): Promise<unknown>;
  unregisterPushToken(input: { token: string }): Promise<unknown>;
}

/**
 * Ask the OS for a notification permission + FCM token and hand it to the
 * backend. Returns true when the device is set up for server push.
 */
async function registerDeviceToken(api: PushRegistrar, lang: Lang): Promise<boolean> {
  const permission = await Notifications.requestPermissionsAsync().catch(() => null);
  if (!permission?.granted) return false;

  let token: string;
  try {
    // On Android this is the raw FCM registration token, which requires
    // google-services.json to have been baked into the build.
    const devicePushToken = await Notifications.getDevicePushTokenAsync();
    token = String(devicePushToken.data);
  } catch {
    return false;
  }
  if (!token) return false;

  const payload = {
    token,
    platform: Platform.OS,
    lang,
    appVersion: Constants.expoConfig?.version ?? undefined,
  };
  // Profile webhook and Clerk JWT both lose a race on first sign-in.
  // Retrying here is the difference between "token registered this session"
  // and "this install is invisible to announcements until they reopen the app".
  let registered = false;
  for (let attempt = 0; attempt < 3 && !registered; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * attempt));
    try {
      await api.registerPushToken(payload);
      registered = true;
    } catch {
      /* try again */
    }
  }
  if (!registered) return false;

  await AsyncStorage.setItem(PUSH_TOKEN, token);
  return true;
}

/**
 * Call on app start (and whenever the language changes) once signed in.
 * Sets up the channel, registers for server push, and falls back to background
 * polling only if that didn't work out.
 */
export async function registerPushNotifications(api: PushRegistrar, lang: Lang): Promise<void> {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "New scholarships & guides",
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => {});

  await Notifications.setNotificationChannelAsync(CHANNEL_DEADLINES, {
    name: "Application deadlines",
    description: "Reminders before a saved scholarship closes",
    importance: Notifications.AndroidImportance.HIGH,
  }).catch(() => {});

  const pushReady = await registerDeviceToken(api, lang);
  await AsyncStorage.setItem(PUSH_ACTIVE, pushReady ? "1" : "0");

  if (pushReady) {
    await stopPollingFallback();
  } else {
    await startPollingFallback();
  }

  // Always silent: anything published while the app was closed is surfaced by
  // push (or by the in-app list), never as a burst of tray notifications at
  // launch. This only advances the baseline the fallback task diffs against.
  await checkForNewContent(false).catch(() => {});
}

/** Retire this device's token on sign-out so a shared phone stops receiving
 * the previous user's notifications. */
export async function unregisterPushNotifications(api: PushRegistrar): Promise<void> {
  const token = await AsyncStorage.getItem(PUSH_TOKEN).catch(() => null);
  if (token) {
    await api.unregisterPushToken({ token }).catch(() => {});
    await AsyncStorage.removeItem(PUSH_TOKEN).catch(() => {});
  }
  await AsyncStorage.setItem(PUSH_ACTIVE, "0").catch(() => {});
  await stopPollingFallback();
}

/**
 * Pull the deep link out of a notification. Local notifications put it at
 * `data.url`; a remote FCM message can nest it under `data.body` depending on
 * how the payload was assembled, so both shapes are accepted.
 */
export function notificationUrl(
  response: Notifications.NotificationResponse | null,
): string | null {
  const data = response?.notification.request.content.data as
    | Record<string, unknown>
    | undefined;
  if (!data) return null;

  if (typeof data.url === "string") return data.url;
  const nested = data.body;
  if (nested && typeof nested === "object" && typeof (nested as { url?: unknown }).url === "string") {
    return (nested as { url: string }).url;
  }
  return null;
}
