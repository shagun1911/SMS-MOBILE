import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import api from "@/lib/api";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useRegisterScreenRefresh } from "@/hooks/useRegisterScreenRefresh";
import { userNotificationSalaryParams } from "@/lib/staffPortalConfig";

type Row = {
  _id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export default function CrewNotificationsScreen() {
  const router = useRouter();
  const optimisticReadIdsRef = useRef<Set<string>>(new Set());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const mergeReadState = useCallback((list: any[]): Row[] => {
    return list.map((n) => {
      const id = String(n._id);
      const serverRead = n.isRead === true || n.read === true;
      if (serverRead) optimisticReadIdsRef.current.delete(id);
      const read = serverRead || optimisticReadIdsRef.current.has(id);
      return {
        _id: id,
        title: String(n.title ?? "Salary"),
        message: String(n.message ?? ""),
        isRead: read,
        createdAt: String(n.createdAt ?? ""),
      };
    });
  }, []);

  const load = useCallback(async () => {
    const res = await api.get("/user-notifications", { params: userNotificationSalaryParams() });
    const raw = res.data?.data ?? res.data ?? [];
    const list = Array.isArray(raw) ? raw : [];
    setRows(mergeReadState(list));
  }, [mergeReadState]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await load();
      } catch (e: any) {
        setError(e?.response?.data?.message ?? "Could not load notifications.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const pullReload = useCallback(async () => {
    try {
      setError(null);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Could not refresh.");
    }
  }, [load]);
  useRegisterScreenRefresh(pullReload);

  const markAllRead = async () => {
    try {
      setMarkingAll(true);
      await api.patch("/user-notifications/read-all", {}, { params: userNotificationSalaryParams() });
      optimisticReadIdsRef.current.clear();
      setRows((prev) => prev.map((r) => ({ ...r, isRead: true })));
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message ?? "Could not mark all as read.");
      await load();
    } finally {
      setMarkingAll(false);
    }
  };

  const onTapRow = async (id: string) => {
    optimisticReadIdsRef.current.add(id);
    setRows((prev) => prev.map((r) => (r._id === id ? { ...r, isRead: true } : r)));
    try {
      await api.patch(`/user-notifications/${id}/read`);
    } catch {
      optimisticReadIdsRef.current.delete(id);
      try {
        await load();
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backWrap}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Salary notifications</Text>
        <View style={{ width: 72 }} />
      </View>

      <TouchableOpacity
        style={[styles.markAll, markingAll && { opacity: 0.6 }]}
        onPress={markAllRead}
        disabled={markingAll || rows.length === 0}
      >
        <Text style={styles.markAllText}>{markingAll ? "Updating…" : "Mark all as read"}</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#c2410c" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.err}>{error}</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No notifications</Text>
          <Text style={styles.emptySub}>Salary payment alerts will appear here.</Text>
        </View>
      ) : (
        <RefreshableScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {rows.map((row) => (
            <TouchableOpacity
              key={row._id}
              style={[styles.row, !row.isRead && styles.rowUnread]}
              activeOpacity={0.85}
              onPress={() => onTapRow(row._id)}
            >
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowMsg}>{row.message}</Text>
              <Text style={styles.rowDate}>
                {row.createdAt
                  ? new Date(row.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : ""}
              </Text>
              {!row.isRead ? <Text style={styles.unread}>Unread · tap to mark read</Text> : null}
            </TouchableOpacity>
          ))}
        </RefreshableScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
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
  back: { fontSize: 16, fontWeight: "600", color: "#c2410c" },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  markAll: {
    alignSelf: "flex-end",
    marginRight: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  markAllText: { fontSize: 14, fontWeight: "600", color: "#c2410c" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  err: { color: "#b91c1c", textAlign: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  emptySub: { fontSize: 14, color: "#64748b", marginTop: 8, textAlign: "center" },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 32 },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  rowUnread: { backgroundColor: "#fff7ed", borderColor: "#fed7aa" },
  rowTitle: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  rowMsg: { fontSize: 14, color: "#475569", marginTop: 6 },
  rowDate: { fontSize: 11, color: "#94a3b8", marginTop: 8 },
  unread: { fontSize: 12, color: "#c2410c", marginTop: 6, fontWeight: "600" },
});
