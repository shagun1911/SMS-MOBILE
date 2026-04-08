import "@/tasks/busBackgroundLocationTask";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ensurePushRegistered } from "@/lib/pushNotifications";
import { useAuthStore } from "@/store/authStore";
import { useStudentAuthStore } from "@/store/studentAuthStore";
import { GlobalRefreshProvider } from "@/contexts/GlobalRefreshContext";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const teacherAuth = useAuthStore((s) => s.isAuthenticated);
  const studentAuth = useStudentAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 150);
    return () => clearTimeout(t);
  }, []);

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
    <SafeAreaProvider>
      <GlobalRefreshProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </GlobalRefreshProvider>
    </SafeAreaProvider>
  );
}
