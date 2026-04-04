import { Stack, Redirect } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { isCrewRole } from "@/lib/crewRoles";
import { CrewLiveLocationProvider } from "@/contexts/CrewLiveLocationContext";

export default function CrewLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  if (!isAuthenticated || !user || !isCrewRole(user.role)) {
    return <Redirect href="/" />;
  }

  return (
    <CrewLiveLocationProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </CrewLiveLocationProvider>
  );
}
