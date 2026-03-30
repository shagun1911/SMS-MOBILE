import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import studentApi from "@/lib/studentApi";

function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return iso;
  }
}

export default function StudentAttendanceScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await studentApi.get("/student-notifications");
    const raw = res.data?.data ?? res.data ?? [];
    const list = Array.isArray(raw) ? raw : [];
    setItems(list.filter((n: any) => String(n?.type ?? "") === "attendance_absent"));
  }, []);

  useEffect(() => {
    load()
      .catch((e: any) => {
        setError(e?.response?.data?.message ?? e?.message ?? "Could not load.");
      })
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Could not load.");
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Attendance</Text>
        <Text style={styles.sub}>
          When a teacher marks you absent, you will see it below. Present days are not listed.
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#db2777" />
          </View>
        ) : error ? (
          <View style={styles.bannerErr}>
            <Text style={styles.bannerErrText}>{error}</Text>
          </View>
        ) : !items.length ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>✓</Text>
            <Text style={styles.emptyTitle}>No absence records</Text>
            <Text style={styles.emptySub}>You have not been marked absent recently.</Text>
          </View>
        ) : (
          items.map((n) => (
            <View key={String(n._id)} style={styles.card}>
              <Text style={styles.cardTitle}>{String(n.title ?? "Attendance")}</Text>
              <Text style={styles.cardBody}>{String(n.message ?? "")}</Text>
              <Text style={styles.cardMeta}>{formatWhen(String(n.createdAt ?? ""))}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  backRow: { marginBottom: 12, alignSelf: "flex-start" },
  backText: { fontSize: 15, fontWeight: "600", color: "#4f46e5" },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  sub: { fontSize: 13, color: "#64748b", lineHeight: 18, marginBottom: 20 },
  center: { paddingVertical: 48, alignItems: "center" },
  bannerErr: {
    backgroundColor: "#fef2f2",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  bannerErrText: { color: "#b91c1c", fontSize: 14 },
  emptyCard: {
    backgroundColor: "#f0fdf4",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  emptyIcon: { fontSize: 40, marginBottom: 8, color: "#16a34a" },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#166534" },
  emptySub: { fontSize: 13, color: "#15803d", marginTop: 6, textAlign: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fbcfe8",
    borderLeftWidth: 4,
    borderLeftColor: "#db2777",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  cardBody: { fontSize: 13, color: "#475569", marginTop: 6, lineHeight: 18 },
  cardMeta: { fontSize: 11, color: "#94a3b8", marginTop: 10 },
});
