import { useEffect, useRef, useState, useCallback } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Location from "expo-location";
import { io, type Socket } from "socket.io-client";
import api from "@/lib/api";
import { SOCKET_BASE_URL } from "@/constants/env";
import { useAuthStore } from "@/store/authStore";
import { isCrewRole } from "@/lib/crewRoles";
import { BUS_LOCATION_TASK } from "@/tasks/busBackgroundLocationTask";

export type CrewLocationShareState = {
  hasBusAssignment: boolean | null;
  permission: Location.PermissionStatus | "unknown";
  /** False when manifest/permission blocks background task — live updates still work while app is open. */
  backgroundSharingEnabled: boolean;
  socketConnected: boolean;
  sharing: boolean;
  lastError: string | null;
};

/**
 * When `active` is true and user is crew with an assigned bus: connect Socket.IO,
 * stream foreground GPS, and start Expo background updates (if permitted).
 */
export function useCrewBusLiveLocation(active: boolean): CrewLocationShareState {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isCrew = !!user && isCrewRole(user.role);

  const [hasBusAssignment, setHasBusAssignment] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<CrewLocationShareState["permission"]>("unknown");
  const [backgroundSharingEnabled, setBackgroundSharingEnabled] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const cleanup = useCallback(async () => {
    watchRef.current?.remove();
    watchRef.current = null;
    socketRef.current?.removeAllListeners();
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSocketConnected(false);
    setSharing(false);
    try {
      const running = await Location.hasStartedLocationUpdatesAsync(BUS_LOCATION_TASK);
      if (running) {
        await Location.stopLocationUpdatesAsync(BUS_LOCATION_TASK);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!active || !isCrew || !token) {
      setHasBusAssignment(null);
      void cleanup();
      return;
    }

    let cancelled = false;

    (async () => {
      setLastError(null);
      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          setLastError("Location services (GPS) are disabled. Please enable them in your device settings.");
          return;
        }

        const res = await api.get("/auth/crew/bus-assignment");
        const bus = res.data?.data?.bus ?? res.data?.bus;
        if (cancelled) return;
        if (!bus) {
          setHasBusAssignment(false);
          await cleanup();
          return;
        }
        setHasBusAssignment(true);

        const fg = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        setPermission(fg.status);
        if (fg.status !== "granted") {
          setLastError("Location permission is required to share your bus position.");
          return;
        }

        setBackgroundSharingEnabled(false);
        try {
          const bg = await Location.requestBackgroundPermissionsAsync();
          if (cancelled) return;
          if (bg.status === "granted") {
            const started = await Location.hasStartedLocationUpdatesAsync(BUS_LOCATION_TASK);
            if (!started) {
              await Location.startLocationUpdatesAsync(BUS_LOCATION_TASK, {
                accuracy: Location.Accuracy.Highest,
                timeInterval: 8000,
                distanceInterval: 15,
                foregroundService: {
                  notificationTitle: "Bus location sharing",
                  notificationBody: "Students on your route can see live bus position.",
                },
                showsBackgroundLocationIndicator: true,
              });
            }
            if (!cancelled) setBackgroundSharingEnabled(true);
          }
        } catch {
          /* Missing ACCESS_BACKGROUND_LOCATION in APK, user chose “While using”, etc. — keep foreground + socket. */
          if (!cancelled) setBackgroundSharingEnabled(false);
        }

        const socket = io(SOCKET_BASE_URL, {
          path: "/socket.io",
          transports: ["polling", "websocket"],
          auth: { token },
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 15_000,
        });
        socketRef.current = socket;

        socket.on("connect", () => {
          if (!cancelled) {
            setSocketConnected(true);
            setLastError(null);
          }
        });
        socket.on("disconnect", () => {
          if (!cancelled) setSocketConnected(false);
        });
        socket.on("connect_error", (err) => {
          if (!cancelled) {
            setSocketConnected(false);
            // We don't set lastError here to make the experience seamless.
            // Socket.io will automatically try to reconnect, and HTTP fallbacks are still running.
            console.warn(`Socket connection issue: ${err.message}`);
          }
        });
        socket.on("bus:location:error", (payload: { message?: string }) => {
          if (payload?.message) setLastError(String(payload.message));
        });

        const emitLocation = async (coords: Location.LocationObjectCoords) => {
          const payload = {
            lat: coords.latitude,
            lng: coords.longitude,
            accuracy: coords.accuracy ?? undefined,
          };
          
          if (socketRef.current?.connected) {
            socketRef.current.emit("bus:location:update", payload);
          } else {
            // Fallback to HTTP if socket is disconnected to ensure coordinates get through
            try {
              await api.post("/auth/crew/bus-location", payload);
            } catch (e) {
              console.warn("HTTP location fallback failed", e);
            }
          }
        };

        try {
          watchRef.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Highest,
              timeInterval: 5000,
              distanceInterval: 10,
            },
            (loc) => {
              if (appState.current === "active") {
                emitLocation(loc.coords);
              }
            }
          );
        } catch (watchErr) {
          // If watchPosition fails (e.g., GPS turned off mid-way), fallback gracefully
          console.warn("Foreground watch failed:", watchErr);
          if (!lastError && !cancelled) {
            setLastError("Could not start active foreground location tracking. Check GPS settings.");
          }
        }

        // On some Android devices, getLastKnownPositionAsync can hang indefinitely if there is no cache.
        // We use a timeout to prevent it from blocking the 'sharing' state from activating.
        try {
          const last = await Promise.race([
            Location.getLastKnownPositionAsync(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
          ]).catch(() => null);

          if (last && !cancelled) {
            emitLocation(last.coords);
          }
        } catch (lastErr) {
          console.warn("Could not get last known position:", lastErr);
        }

        if (!cancelled) {
          setSharing(true);
          setLastError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Could not start location sharing.";
          setLastError(msg);
          await cleanup();
        }
      }
    })();

    return () => {
      cancelled = true;
      void cleanup();
    };
  }, [active, isCrew, token, cleanup]);

  return {
    hasBusAssignment,
    permission,
    backgroundSharingEnabled,
    socketConnected,
    sharing,
    lastError,
  };
}
