import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image } from "react-native";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

export default function TeacherDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [classes, setClasses] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [hwLoading, setHwLoading] = useState(true);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, hRes, eRes] = await Promise.all([
          api.get("/classes"),
          api.get("/homework"),
          api.get("/exams"),
        ]);
        setClasses(cRes.data.data ?? []);
        setHomework(hRes.data.data ?? []);
        setExams(eRes.data.data ?? []);
      } catch (_) {}
      finally {
        setClassesLoading(false);
        setHwLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/schools/me");
        const data = res.data?.data ?? res.data;
        if (!cancelled && data?.logo) {
          setSchoolLogo(data.logo);
        }
      } catch {
        // ignore logo errors on dashboard header
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recentHw = homework.slice(0, 5);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {schoolLogo && (
            <Image source={{ uri: schoolLogo }} style={styles.schoolLogo} />
          )}
          <View>
            <Text style={styles.welcome}>Welcome, {user?.name}!</Text>
            <Text style={styles.role}>Teacher Portal</Text>
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
        <TouchableOpacity style={styles.card} onPress={() => router.push("/(teacher)/classes")}>
          <Text style={styles.cardLabel}>Classes</Text>
          {classesLoading ? (
            <ActivityIndicator size="small" color="#059669" />
          ) : (
            <Text style={styles.cardValue}>{(classes as any[]).length}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => router.push("/(teacher)/homework")}>
          <Text style={styles.cardLabel}>Homework</Text>
          {hwLoading ? (
            <ActivityIndicator size="small" color="#059669" />
          ) : (
            <Text style={styles.cardValue}>{(homework as any[]).length}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => router.push("/(teacher)/marks")}>
          <Text style={styles.cardLabel}>Exams</Text>
          <Text style={styles.cardValue}>{(exams as any[]).length}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickRow}>
        <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(teacher)/classes")}>
          <Text style={styles.quickText}>My Classes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(teacher)/homework")}>
          <Text style={styles.quickText}>Homework</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(teacher)/marks")}>
          <Text style={styles.quickText}>Enter Marks</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(teacher)/timetable")}>
          <Text style={styles.quickText}>Timetable</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Recent Homework</Text>
      {hwLoading ? (
        <ActivityIndicator style={{ marginVertical: 24 }} color="#059669" />
      ) : recentHw.length === 0 ? (
        <Text style={styles.empty}>No homework assigned yet.</Text>
      ) : (
        <View style={styles.list}>
          {recentHw.map((hw: any) => (
            <View key={hw._id} style={styles.listItem}>
              <Text style={styles.listTitle}>{hw.title}</Text>
              <Text style={styles.listMeta}>
                Class {hw.className}-{hw.section} · Due {new Date(hw.dueDate).toLocaleDateString()}
              </Text>
            </View>
          ))}
          <TouchableOpacity onPress={() => router.push("/(teacher)/homework")}>
            <Text style={styles.link}>View all →</Text>
          </TouchableOpacity>
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
  role: { fontSize: 14, color: "#64748b" },
  logoutBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  logoutText: { fontSize: 13, fontWeight: "600", color: "#b91c1c" },
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
  cardValue: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  quickBtn: {
    backgroundColor: "#ecfdf5",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  quickText: { fontSize: 13, fontWeight: "600", color: "#059669" },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a", marginBottom: 12 },
  empty: { color: "#94a3b8", paddingVertical: 16 },
  list: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  listItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  listTitle: { fontWeight: "600", color: "#0f172a" },
  listMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  link: { color: "#059669", marginTop: 12, fontWeight: "500" },
});
