import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { io, type Socket } from "socket.io-client";
import studentApi from "@/lib/studentApi";
import { useStudentAuthStore } from "@/store/studentAuthStore";
import { SOCKET_BASE_URL } from "@/constants/env";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useRegisterScreenRefresh } from "@/hooks/useRegisterScreenRefresh";
import BusMapPanel from "@/components/busTracking/BusMapPanel";
import type { BusTrackingLocation } from "@/components/busTracking/types";

const DEFAULT_STALE_MS = 120_000;

function ageMs(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Date.now() - t;
}

function isValidBusCoord(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function StudentBusTrackingScreen() {
  const router = useRouter();
  const token = useStudentAuthStore((s) => s.token);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usesTransport, setUsesTransport] = useState(false);
  const [busMeta, setBusMeta] = useState<{ busNumber?: string; routeName?: string } | null>(null);
  const [location, setLocation] = useState<BusTrackingLocation | null>(null);
  const [staleAfterMs, setStaleAfterMs] = useState(DEFAULT_STALE_MS);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const applyLocation = useCallback((loc: BusTrackingLocation) => {
    if (!isValidBusCoord(loc.lat, loc.lng)) return;
    setLocation(loc);
  }, []);

  const loadRest = useCallback(async () => {
    setError(null);
    const [meRes, locRes] = await Promise.all([
      studentApi.get("/auth/student/me"),
      studentApi.get("/auth/student/bus-location/latest"),
    ]);
    const me = meRes.data?.data ?? meRes.data;
    const locPayload = locRes.data?.data ?? locRes.data;
    setUsesTransport(me?.usesTransport === true);
    const b = me?.busId;
    if (b && typeof b === "object") {
      setBusMeta({
        busNumber: b.busNumber,
        routeName: b.routeName,
      });
    } else {
      setBusMeta(null);
    }
    if (typeof locPayload?.staleAfterMs === "number") {
      setStaleAfterMs(locPayload.staleAfterMs);
    }
    const loc = locPayload?.location;
    if (loc && isValidBusCoord(loc.lat, loc.lng)) {
      applyLocation({
        lat: loc.lat,
        lng: loc.lng,
        updatedAt: typeof loc.updatedAt === "string" ? loc.updatedAt : new Date().toISOString(),
        accuracy: typeof loc.accuracy === "number" ? loc.accuracy : undefined,
      });
    } else {
      setLocation(null);
    }
  }, [applyLocation]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await loadRest();
      } catch (e: unknown) {
        if (!cancelled) {
          const msg =
            e && typeof e === "object" && "response" in e
              ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
              : null;
          setError(msg || "Could not load bus information.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRest]);

  useEffect(() => {
    if (!token || !usesTransport) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
      return;
    }
    let socket: Socket;
    try {
      socket = io(SOCKET_BASE_URL, {
        path: "/socket.io",
        transports: ["websocket"],
        auth: { token },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 15_000,
        timeout: 20_000,
      });
    } catch {
      return;
    }
    socketRef.current = socket;

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    socket.on(
      "bus:location:sync",
      (payload: { location: BusTrackingLocation | null; staleAfterMs?: number; offline?: boolean }) => {
        if (typeof payload?.staleAfterMs === "number") {
          setStaleAfterMs(payload.staleAfterMs);
        }
        if (
          payload?.location &&
          isValidBusCoord(payload.location.lat, payload.location.lng)
        ) {
          applyLocation({
            lat: payload.location.lat,
            lng: payload.location.lng,
            updatedAt:
              typeof payload.location.updatedAt === "string"
                ? payload.location.updatedAt
                : new Date().toISOString(),
            accuracy:
              typeof payload.location.accuracy === "number" ? payload.location.accuracy : undefined,
          });
        }
      }
    );

    socket.on(
      "bus:location",
      (payload: { lat?: number; lng?: number; updatedAt?: string; accuracy?: number }) => {
        if (typeof payload?.lat !== "number" || typeof payload?.lng !== "number") return;
        applyLocation({
          lat: payload.lat,
          lng: payload.lng,
          updatedAt: payload.updatedAt || new Date().toISOString(),
          accuracy: payload.accuracy,
        });
      }
    );

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [token, usesTransport, applyLocation]);

  const pullReload = useCallback(async () => {
    try {
      await loadRest();
    } catch {
      /* ignore */
    }
  }, [loadRest]);
  useRegisterScreenRefresh(pullReload);

  const offline = !location || ageMs(location.updatedAt) > staleAfterMs;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backWrap}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Bus tracking</Text>
          <View style={{ width: 72 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.err}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!usesTransport) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <RefreshableScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backWrap}>
              <Text style={styles.back}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Bus tracking</Text>
            <View style={{ width: 72 }} />
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>School transport</Text>
            <Text style={styles.muted}>
              You are not registered for school bus transport. Contact the school office if you should be on a bus
              route.
            </Text>
          </View>
        </RefreshableScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backWrap}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Bus tracking</Text>
        <View style={{ width: 72 }} />
      </View>

      {busMeta ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {busMeta.busNumber ? `Bus ${busMeta.busNumber}` : "Your bus"}
            {busMeta.routeName ? ` · ${busMeta.routeName}` : ""}
          </Text>
        </View>
      ) : null}

      <View style={styles.statusRow}>
        <View style={[styles.dot, offline ? styles.dotOff : styles.dotOn]} />
        <Text style={styles.statusText}>
          {offline
            ? "Bus offline — waiting for driver location or GPS signal."
            : socketConnected
              ? "Live · connected"
              : "Reconnecting…"}
        </Text>
      </View>

      {Platform.OS === "web" ? (
        <View style={styles.webFallback}>
          <Text style={styles.muted}>Use the iOS or Android app for the full bus tracking view.</Text>
          {location ? (
            <Text style={styles.coords}>
              Last: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.mapSection}>
          <BusMapPanel location={location} offline={offline} />
        </View>
      )}

      {location ? (
        <View style={styles.footer}>
          <Text style={styles.footerHint}>Updated {formatUpdatedAt(location.updatedAt)}</Text>
        </View>
      ) : (
        <View style={styles.footer}>
          <Text style={styles.footerHint}>No location yet. When your driver shares GPS, the bus will appear here.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  backWrap: { width: 72 },
  back: { fontSize: 16, fontWeight: "600", color: "#0f766e" },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  err: { color: "#b91c1c", textAlign: "center" },
  card: {
    margin: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  muted: { fontSize: 14, color: "#64748b", lineHeight: 21 },
  metaRow: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#fff" },
  metaText: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "#fff",
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { backgroundColor: "#16a34a" },
  dotOff: { backgroundColor: "#94a3b8" },
  statusText: { fontSize: 13, color: "#475569", flex: 1 },
  webFallback: { flex: 1, padding: 24, justifyContent: "center" },
  coords: { marginTop: 12, fontSize: 14, color: "#0f172a" },
  footer: { padding: 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  footerHint: { fontSize: 12, color: "#64748b", textAlign: "center" },
  mapSection: { flex: 1, minHeight: 0 },
});
