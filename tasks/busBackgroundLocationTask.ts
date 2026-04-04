/**
 * Must be imported from the app entry (root layout) so the task is registered before use.
 */
import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "@/constants/env";

export const BUS_LOCATION_TASK = "BUS_LIVE_LOCATION_V1";

const PERSIST_KEY = "sms-teacher-auth";

async function getCrewJwtFromPersist(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: string } };
    const t = parsed?.state?.token;
    return typeof t === "string" && t.length > 0 ? t : null;
  } catch {
    return null;
  }
}

TaskManager.defineTask(BUS_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] })?.locations;
  const loc = locations?.[0];
  if (!loc) return;
  const token = await getCrewJwtFromPersist();
  if (!token) return;
  try {
    await fetch(`${API_BASE_URL}/auth/crew/bus-location`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? undefined,
      }),
    });
  } catch {
    /* next background tick */
  }
});
