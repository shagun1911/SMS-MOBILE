import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import api from "@/lib/api";

type BusLiveItem = {
  busId: string;
  busNumber: string;
  latitude: number | null;
  longitude: number | null;
  updatedAt: string | null;
  updatedByRole: "driver" | "conductor" | null;
  isOnline: boolean;
};

const REFRESH_MS = 8000;

function toRoleLabel(role: BusLiveItem["updatedByRole"]): string {
  if (role === "driver") return "Driver";
  if (role === "conductor") return "Conductor";
  return "Unknown";
}

function isValidCoord(n: unknown, min: number, max: number): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
}

function agoText(updatedAt: string | null): string {
  if (!updatedAt) return "No update yet";
  const delta = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000));
  if (delta < 5) return "just now";
  if (delta < 60) return `${delta}s ago`;
  const min = Math.floor(delta / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

export default function TransportManagerBusListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<BusLiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BusLiveItem | null>(null);

  const fetchItems = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setRefreshing(true);
      setError(null);
      const res = await api.get("/transport/buses/active");
      const data = res.data?.data ?? res.data ?? [];
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Unable to fetch bus activity.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems(false);
    const t = setInterval(() => void fetchItems(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [fetchItems]);

  const selectedMapUrl = useMemo(() => {
    if (!selected) return null;
    if (!isValidCoord(selected.latitude, -90, 90) || !isValidCoord(selected.longitude, -180, 180)) {
      return null;
    }
    return `https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`;
  }, [selected]);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Bus Live Status</Text>
        <TouchableOpacity onPress={() => void fetchItems(true)} style={styles.refreshBtn} disabled={refreshing}>
          <Text style={styles.refreshText}>{refreshing ? "..." : "Refresh"}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>No active buses found.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {items.map((bus) => {
            const hasLocation =
              isValidCoord(bus.latitude, -90, 90) && isValidCoord(bus.longitude, -180, 180);
            const canView = bus.isOnline && hasLocation;
            return (
              <View key={bus.busId} style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.busNumber}>{bus.busNumber}</Text>
                  <View style={[styles.badge, bus.isOnline ? styles.online : styles.offline]}>
                    <Text style={styles.badgeText}>{bus.isOnline ? "Online" : "Offline"}</Text>
                  </View>
                </View>
                <Text style={styles.meta}>Last updated {agoText(bus.updatedAt)}</Text>
                {!bus.isOnline && <Text style={styles.offlineHint}>Bus not active</Text>}
                <TouchableOpacity
                  style={[styles.viewBtn, !canView && styles.viewBtnDisabled]}
                  disabled={!canView}
                  onPress={() => setSelected(bus)}
                >
                  <Text style={styles.viewBtnText}>View Location</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalBg} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {selected ? (
              <>
                <Text style={styles.modalTitle}>Bus {selected.busNumber}</Text>
                <Text style={styles.modalLine}>Latitude: {selected.latitude ?? "N/A"}</Text>
                <Text style={styles.modalLine}>Longitude: {selected.longitude ?? "N/A"}</Text>
                <Text style={styles.modalLine}>Updated by: {toRoleLabel(selected.updatedByRole)}</Text>
                <Text style={styles.modalLine}>Last updated: {agoText(selected.updatedAt)}</Text>
                <TouchableOpacity
                  style={[styles.mapBtn, !selectedMapUrl && styles.viewBtnDisabled]}
                  disabled={!selectedMapUrl}
                  onPress={() => selectedMapUrl && Linking.openURL(selectedMapUrl)}
                >
                  <Text style={styles.mapBtnText}>Open in Google Maps</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  backBtn: { paddingVertical: 8, paddingHorizontal: 10 },
  backText: { color: "#334155", fontWeight: "600" },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  refreshBtn: { paddingVertical: 8, paddingHorizontal: 10 },
  refreshText: { color: "#2563eb", fontWeight: "600" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  errorText: { color: "#b91c1c", textAlign: "center" },
  empty: { color: "#64748b" },
  listContent: { padding: 14, gap: 10, paddingBottom: 26 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  busNumber: { fontSize: 18, fontWeight: "700", color: "#111827" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  online: { backgroundColor: "#dcfce7" },
  offline: { backgroundColor: "#fee2e2" },
  badgeText: { fontSize: 12, fontWeight: "700", color: "#1f2937" },
  meta: { marginTop: 6, color: "#64748b", fontSize: 13 },
  offlineHint: { marginTop: 4, color: "#b91c1c", fontSize: 12, fontWeight: "600" },
  viewBtn: {
    marginTop: 10,
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  viewBtnDisabled: { opacity: 0.45 },
  viewBtnText: { color: "#fff", fontWeight: "700" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    gap: 6,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  modalLine: { color: "#334155", fontSize: 14 },
  mapBtn: {
    marginTop: 12,
    backgroundColor: "#16a34a",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  mapBtnText: { color: "#fff", fontWeight: "700" },
});
