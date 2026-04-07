import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import api from "@/lib/api";
import { localCalendarYmd } from "@/lib/localYmd";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";

type RoleFilter = "all" | "bus_driver" | "conductor";
type CrewStatus = "present" | "absent" | "pending";
type CrewUser = {
  _id: string;
  name: string;
  role: "bus_driver" | "conductor";
  status: CrewStatus;
  totalAbsentCount: number;
};

export default function TransportAttendanceScreen() {
  const router = useRouter();
  const [date, setDate] = useState(localCalendarYmd());
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [users, setUsers] = useState<CrewUser[]>([]);
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [isFinal, setIsFinal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const roleParam = roleFilter === "all" ? undefined : roleFilter;
      const res = await api.get("/transport-attendance", {
        params: { date, role: roleParam, search: search.trim() || undefined },
      });
      const payload = res.data?.data ?? {};
      const list: CrewUser[] = Array.isArray(payload.users) ? payload.users : [];
      setUsers(list);
      setIsFinal(Boolean(payload.isFinal));
      const next: Record<string, boolean> = {};
      for (const u of list) if (u.status === "present") next[u._id] = true;
      setMarks(next);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Could not load attendance.");
      setUsers([]);
      setMarks({});
      setIsFinal(false);
    } finally {
      setLoading(false);
    }
  }, [date, roleFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => users, [users]);
  const selectedPresentIds = useMemo(
    () => Object.entries(marks).filter(([, v]) => v).map(([id]) => id),
    [marks]
  );

  const onSave = async () => {
    try {
      setSaving(true);
      await api.post("/transport-attendance/save", { date, presentUserIds: selectedPresentIds });
      await load();
      Alert.alert("Saved", "Draft attendance saved.");
    } catch (e: any) {
      Alert.alert("Save failed", e?.response?.data?.message ?? "Could not save draft.");
    } finally {
      setSaving(false);
    }
  };

  const onFinalize = async () => {
    Alert.alert(
      "Final submit attendance?",
      "Unmarked crew members will be marked absent for this date and cannot be changed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Final submit",
          style: "destructive",
          onPress: async () => {
            try {
              setFinalizing(true);
              await api.post("/transport-attendance/final-submit", {
                date,
                presentUserIds: selectedPresentIds,
              });
              await load();
              Alert.alert("Done", "Attendance finalized.");
            } catch (e: any) {
              Alert.alert("Final submit failed", e?.response?.data?.message ?? "Could not finalize.");
            } finally {
              setFinalizing(false);
            }
          },
        },
      ]
    );
  };

  const prevDate = () => {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() - 1);
    setDate(localCalendarYmd(d));
  };
  const nextDate = () => {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + 1);
    const next = localCalendarYmd(d);
    if (next <= localCalendarYmd()) setDate(next);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <RefreshableScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Attendance Management</Text>

        <View style={styles.dateRow}>
          <TouchableOpacity onPress={prevDate} style={styles.dateBtn}><Text>‹</Text></TouchableOpacity>
          <Text style={styles.dateText}>{date}</Text>
          <TouchableOpacity onPress={nextDate} style={styles.dateBtn}><Text>›</Text></TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          {(["all", "bus_driver", "conductor"] as RoleFilter[]).map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.filterBtn, roleFilter === r && styles.filterBtnActive]}
              onPress={() => setRoleFilter(r)}
            >
              <Text style={[styles.filterText, roleFilter === r && styles.filterTextActive]}>
                {r === "all" ? "All" : r === "bus_driver" ? "Drivers" : "Conductors"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name"
          placeholderTextColor="#94a3b8"
          style={styles.search}
        />

        {loading ? (
          <View style={styles.center}><ActivityIndicator color="#4f46e5" /></View>
        ) : err ? (
          <Text style={styles.err}>{err}</Text>
        ) : (
          <>
            {visible.map((u) => {
              const present = Boolean(marks[u._id]);
              return (
                <View key={u._id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{u.name}</Text>
                    <Text style={styles.meta}>
                      {u.role === "bus_driver" ? "Driver" : "Conductor"} · Total absents {u.totalAbsentCount ?? 0}
                    </Text>
                    <Text style={styles.meta}>
                      Today: {u.status === "pending" ? "Unmarked" : u.status === "present" ? "Present" : "Absent"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    disabled={isFinal}
                    onPress={() => setMarks((p) => ({ ...p, [u._id]: !present }))}
                    style={[styles.toggle, present && styles.toggleOn, isFinal && styles.disabled]}
                  >
                    <Text style={[styles.toggleText, present && styles.toggleTextOn]}>
                      {present ? "Present" : "Unmarked"}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, (saving || isFinal) && styles.disabled]}
            onPress={onSave}
            disabled={saving || isFinal || finalizing}
          >
            <Text style={styles.actionText}>{saving ? "Saving..." : "Save Changes"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtnFinal, (finalizing || isFinal) && styles.disabled]}
            onPress={onFinalize}
            disabled={saving || isFinal || finalizing}
          >
            <Text style={styles.actionText}>{isFinal ? "Finalized" : finalizing ? "Submitting..." : "Final Submit"}</Text>
          </TouchableOpacity>
        </View>
      </RefreshableScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  back: { marginBottom: 8 },
  backText: { color: "#4f46e5", fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginBottom: 10 },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 12 },
  dateBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  dateText: { fontWeight: "700", color: "#0f172a" },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  filterBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#cbd5e1" },
  filterBtnActive: { backgroundColor: "#4f46e5", borderColor: "#4f46e5" },
  filterText: { fontSize: 12, color: "#334155", fontWeight: "600" },
  filterTextActive: { color: "#fff" },
  search: { borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  center: { paddingVertical: 28, alignItems: "center" },
  err: { color: "#b91c1c" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 10 },
  name: { fontSize: 15, color: "#0f172a", fontWeight: "700" },
  meta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  toggle: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f8fafc" },
  toggleOn: { borderColor: "#16a34a", backgroundColor: "#dcfce7" },
  toggleText: { fontSize: 12, color: "#475569", fontWeight: "700" },
  toggleTextOn: { color: "#166534" },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  actionBtn: { flex: 1, borderRadius: 10, backgroundColor: "#4f46e5", alignItems: "center", paddingVertical: 12 },
  actionBtnFinal: { flex: 1, borderRadius: 10, backgroundColor: "#b45309", alignItems: "center", paddingVertical: 12 },
  actionText: { color: "#fff", fontWeight: "700" },
  disabled: { opacity: 0.5 },
});
