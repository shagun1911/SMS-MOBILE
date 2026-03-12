import { Stack, Redirect } from "expo-router";
import { useStudentAuthStore } from "@/store/studentAuthStore";

export default function StudentLayout() {
  const isAuthenticated = useStudentAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Redirect href="/" />;
  }

  // Same UI on web and native: no header bar, card-based dashboard only.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
