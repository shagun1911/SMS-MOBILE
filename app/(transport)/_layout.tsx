import { Stack, Redirect } from "expo-router";
import { useAuthStore } from "@/store/authStore";

export default function TransportLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  if (!isAuthenticated || !user || user.role !== "transport_manager") {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}

