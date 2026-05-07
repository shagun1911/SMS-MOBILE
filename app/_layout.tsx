import "@/tasks/busBackgroundLocationTask";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ensurePushRegistered, setForegroundNotifyCallback } from "@/lib/pushNotifications";
import { useAuthStore } from "@/store/authStore";
import { useStudentAuthStore } from "@/store/studentAuthStore";
import { GlobalRefreshProvider } from "@/contexts/GlobalRefreshContext";
import { NotificationProvider, useNotification } from "@/contexts/NotificationContext";
import InAppNotificationBanner from "@/components/InAppNotificationBanner";

/** Inner component so it can access NotificationContext via the hook. */
function AppShell() {
  const [ready, setReady] = useState(false);
  const teacherAuth = useAuthStore((s) => s.isAuthenticated);
  const studentAuth = useStudentAuthStore((s) => s.isAuthenticated);
  const { notify } = useNotification();

  // Wire the module-level callback so pushNotifications.ts can call notify().
  useEffect(() => {
    setForegroundNotifyCallback(notify);
    return () => setForegroundNotifyCallback(null);
  }, [notify]);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 150);
    return () => clearTimeout(t);
  }, []);

  // Register / refresh FCM token whenever auth state changes.
  useEffect(() => {
    if (!ready) return;
    if (!teacherAuth && !studentAuth) return;
    void ensurePushRegistered();
  }, [ready, teacherAuth, studentAuth]);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" }}>
        <ActivityIndicator size="large" color="#10b981" />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
      {/* LinkedIn-style in-app notification banner — rendered above all screens */}
      <InAppNotificationBanner />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GlobalRefreshProvider>
        <NotificationProvider>
          <AppShell />
        </NotificationProvider>
      </GlobalRefreshProvider>
    </SafeAreaProvider>
  );
}
