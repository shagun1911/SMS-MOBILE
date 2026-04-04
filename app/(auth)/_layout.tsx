import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="teacher-login" />
      <Stack.Screen name="student-login" />
      <Stack.Screen name="transport-login" />
      <Stack.Screen name="crew-login" />
      <Stack.Screen name="support-staff-login" />
    </Stack>
  );
}
