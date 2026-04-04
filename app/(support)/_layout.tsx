import { Stack, Redirect } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { isSupportStaffRole } from "@/lib/supportStaffRoles";

export default function SupportLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  if (!isAuthenticated || !user || !isSupportStaffRole(user.role)) {
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
