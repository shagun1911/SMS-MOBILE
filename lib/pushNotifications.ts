import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import api from "@/lib/api";
import studentApi from "@/lib/studentApi";
import { useAuthStore } from "@/store/authStore";
import { useStudentAuthStore } from "@/store/studentAuthStore";

const PERMISSION_ASKED_KEY = "sms_notification_permission_asked";

let listenersAttached = false;

/**
 * Module-level callback set by _layout.tsx so the non-React pushNotifications
 * module can trigger the in-app banner (NotificationContext.notify).
 */
let _foregroundNotifCb: ((title: string, body: string) => void) | null = null;

export function setForegroundNotifyCallback(
  cb: ((title: string, body: string) => void) | null
) {
  _foregroundNotifCb = cb;
}

function getMessagingModule(): typeof import("@react-native-firebase/messaging").default | null {
  if (Platform.OS === "web") return null;
  try {
    // Native-only; fails in Expo Go or missing prebuild.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@react-native-firebase/messaging").default;
  } catch {
    return null;
  }
}

type MessagingFactory = NonNullable<ReturnType<typeof getMessagingModule>>;

function attachListeners(messagingFactory: MessagingFactory): void {
  if (listenersAttached) return;
  listenersAttached = true;

  // FOREGROUND: app is open — show the in-app LinkedIn-style banner.
  // The OS will NOT show a system notification when app is in foreground.
  messagingFactory().onMessage(async (remoteMessage) => {
    const title = remoteMessage.notification?.title ?? "Notification";
    const body = remoteMessage.notification?.body ?? "";
    if (_foregroundNotifCb) {
      _foregroundNotifCb(title, body);
    }
    // No Alert.alert fallback — if context not wired up yet, silently drop.
    // Background/quit-state notifications are handled natively by Firebase OS layer.
  });

  // FCM token refresh: re-register with backend.
  messagingFactory().onTokenRefresh(async (token) => {
    const staff = useAuthStore.getState();
    const stud = useStudentAuthStore.getState();
    try {
      if (staff.isAuthenticated && staff.token) {
        await api.post("/auth/save-device-token", { token });
      } else if (stud.isAuthenticated && stud.token) {
        await studentApi.post("/auth/student/save-device-token", { token });
      }
    } catch {
      /* ignore */
    }
  });
}

/**
 * Call after every login (or on cold start when session is restored).
 * - Requests notification permission on FIRST login (shows the OS dialog).
 * - Registers the FCM token with the backend.
 * - Attaches the foreground onMessage listener.
 *
 * Requires a dev build with google-services.json / GoogleService-Info.plist;
 * not available in Expo Go.
 */
export async function ensurePushRegistered(): Promise<void> {
  const messagingFactory = getMessagingModule();
  if (!messagingFactory) return;

  const staff = useAuthStore.getState();
  const stud = useStudentAuthStore.getState();
  const isStaff = Boolean(staff.isAuthenticated && staff.token);
  const isStudent = Boolean(stud.isAuthenticated && stud.token);
  if (!isStaff && !isStudent) return;

  // Attach listeners first (idempotent).
  attachListeners(messagingFactory);

  // Request permission — OS shows the system dialog ONLY if it hasn't been shown before.
  // Otherwise, it just returns the current status (Authorized/Denied).
  try {
    const status = await messagingFactory().requestPermission();
    const authorized =
      status === messagingFactory.AuthorizationStatus.AUTHORIZED ||
      status === messagingFactory.AuthorizationStatus.PROVISIONAL;

    if (!authorized) {
      console.log("[Push] Notification permission not granted.");
      return;
    }
  } catch (err) {
    console.error("[Push] Error requesting permission:", err);
    return;
  }

  // Register FCM token with backend.
  try {
    const token = await messagingFactory().getToken();
    if (!token) return;

    if (isStaff) {
      await api.post("/auth/save-device-token", { token });
      console.log("[Push] Registered staff token with backend.");
    } else if (isStudent) {
      await studentApi.post("/auth/student/save-device-token", { token });
      console.log("[Push] Registered student token with backend.");
    }
  } catch (err) {
    console.error("[Push] Failed to register token with backend:", err);
  }
}
