import { Stack, Redirect } from "expo-router";
import { useAuthStore } from "@/store/authStore";

export default function TeacherLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
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
