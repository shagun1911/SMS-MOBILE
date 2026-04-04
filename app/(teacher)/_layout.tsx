import { Stack, Redirect } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

export default function TeacherLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (isAuthenticated && user && user.role !== "teacher") {
      logout();
    }
  }, [isAuthenticated, user, logout]);

  if (!isAuthenticated || !user || user.role !== "teacher") {
    return <Redirect href="/" />;
  }

  // Same UI as localhost: no green "Dashboard" header, no tabs – card-based only.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
