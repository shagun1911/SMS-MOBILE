import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Platform } from "react-native";
import api from "@/lib/api";
import studentApi from "@/lib/studentApi";
import { useAuthStore } from "@/store/authStore";
import { useStudentAuthStore } from "@/store/studentAuthStore";

const PERMISSION_ASKED_KEY = "sms_notification_permission_asked";

let listenersAttached = false;

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

  messagingFactory().onMessage(async (remoteMessage) => {
    const title = remoteMessage.notification?.title ?? "Notification";
    const body = remoteMessage.notification?.body ?? "";
    Alert.alert(title, body);
  });

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
 * After login (or on cold start when session is restored): permission once, register FCM token on backend.
 * Requires a dev build with `google-services.json` / `GoogleService-Info.plist`; not available in Expo Go.
 */
export async function ensurePushRegistered(): Promise<void> {
  const messagingFactory = getMessagingModule();
  if (!messagingFactory) return;

  const staff = useAuthStore.getState();
  const stud = useStudentAuthStore.getState();
  const isStaff = Boolean(staff.isAuthenticated && staff.token);
  const isStudent = Boolean(stud.isAuthenticated && stud.token);
  if (!isStaff && !isStudent) return;

  attachListeners(messagingFactory);

  const asked = await AsyncStorage.getItem(PERMISSION_ASKED_KEY);
  if (!asked) {
    await messagingFactory().requestPermission();
    await AsyncStorage.setItem(PERMISSION_ASKED_KEY, "1");
  }

  const token = await messagingFactory().getToken();
  if (!token) return;

  if (isStaff) {
    await api.post("/auth/save-device-token", { token });
  } else {
    await studentApi.post("/auth/student/save-device-token", { token });
  }
}
