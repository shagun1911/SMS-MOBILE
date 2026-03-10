import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { useStudentAuthStore } from "@/store/studentAuthStore";
import studentApi from "@/lib/studentApi";
import api from "@/lib/api";

export default function StudentDashboard() {
  const router = useRouter();
  const { student, logout } = useStudentAuthStore();
  const [fees, setFees] = useState<any>(null);
  const [homework, setHomework] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [fRes, hRes, rRes] = await Promise.all([
          studentApi.get("/fees/student/me"),
          studentApi.get("/homework/student"),
          studentApi.get("/exams/student/results"),
        ]);
        setFees(fRes.data.data);
        setHomework(hRes.data.data ?? []);
        setResults(rRes.data.data ?? []);
      } catch (_) {}
      finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!student?.schoolCode) return;
        const res = await studentApi.get(`/schools/public/${student.schoolCode}`);
        const data = res.data?.data ?? res.data;
        if (!cancelled && data?.logo) {
          setSchoolLogo(data.logo as string);
        }
      } catch {
        // ignore logo errors here
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingHw = homework.filter((h: any) => new Date(h.dueDate) >= new Date());
  const dueAmount = fees?.dueAmount ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {schoolLogo && (
            <Image source={{ uri: schoolLogo }} style={styles.schoolLogo} />
          )}
          <View>
            <Text style={styles.welcome}>Welcome back, {student?.firstName}!</Text>
            <Text style={styles.role}>
              Class {student?.class} — Section {student?.section} · {student?.schoolName}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            logout();
            router.replace("/");
          }}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        <TouchableOpacity style={styles.card} onPress={() => router.push("/(student)/homework")}>
          <Text style={styles.cardLabel}>Pending Homework</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#4f46e5" />
          ) : (
            <Text style={styles.cardValue}>{pendingHw.length}</Text>
          )}
          <Text style={styles.cardMeta}>assignments due</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => router.push("/(student)/fees")}>
          <Text style={styles.cardLabel}>Fee Due</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#4f46e5" />
          ) : (
            <Text style={[styles.cardValue, dueAmount > 0 && styles.cardValueDue]}>
              ₹{dueAmount.toLocaleString()}
            </Text>
          )}
          <Text style={styles.cardMeta}>{dueAmount > 0 ? "pending" : "all clear"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => router.push("/(student)/marks")}>
          <Text style={styles.cardLabel}>Results</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#4f46e5" />
          ) : (
            <Text style={styles.cardValue}>{results.length}</Text>
          )}
          <Text style={styles.cardMeta}>results available</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickRow}>
        <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(student)/homework")}>
          <Text style={styles.quickText}>Homework</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(student)/fees")}>
          <Text style={styles.quickText}>My Fees</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(student)/marks")}>
          <Text style={styles.quickText}>Marks</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(student)/timetable")}>
          <Text style={styles.quickText}>Timetable</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Recent Homework</Text>
      {loading ? (
        <ActivityIndicator style={{ marginVertical: 24 }} color="#4f46e5" />
      ) : pendingHw.length === 0 ? (
        <Text style={styles.empty}>No pending homework.</Text>
      ) : (
        <View style={styles.list}>
          {pendingHw.slice(0, 5).map((hw: any) => (
            <View key={hw._id} style={styles.listItem}>
              <Text style={styles.listTitle}>{hw.title}</Text>
              <Text style={styles.listMeta}>
                {hw.subject} · Due {new Date(hw.dueDate).toLocaleDateString()}
              </Text>
            </View>
          ))}
          <TouchableOpacity onPress={() => router.push("/(student)/homework")}>
            <Text style={styles.link}>View all →</Text>
          </TouchableOpacity>
        </View>
      )}

      {dueAmount > 0 && (
        <View style={styles.alert}>
          <Text style={styles.alertTitle}>Fee payment pending</Text>
          <Text style={styles.alertText}>
            You have ₹{dueAmount.toLocaleString()} in pending fees. Contact the school office.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  schoolLogo: { width: 52, height: 52, borderRadius: 12, marginRight: 4, borderWidth: 1, borderColor: "#e2e8f0" },
  welcome: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  role: { fontSize: 14, color: "#64748b", marginTop: 2 },
  logoutBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },
  logoutText: { fontSize: 13, fontWeight: "600", color: "#4f46e5" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  card: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardLabel: { fontSize: 12, color: "#64748b", marginBottom: 4 },
  cardValue: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  cardValueDue: { color: "#dc2626" },
  cardMeta: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  quickBtn: {
    backgroundColor: "#eef2ff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  quickText: { fontSize: 13, fontWeight: "600", color: "#4f46e5" },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a", marginBottom: 12 },
  empty: { color: "#94a3b8", paddingVertical: 16 },
  list: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  listItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  listTitle: { fontWeight: "600", color: "#0f172a" },
  listMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  link: { color: "#4f46e5", marginTop: 12, fontWeight: "500" },
  alert: { backgroundColor: "#fef2f2", borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: "#fecaca" },
  alertTitle: { fontWeight: "600", color: "#b91c1c" },
  alertText: { fontSize: 14, color: "#dc2626", marginTop: 4 },
});
