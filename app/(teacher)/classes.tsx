import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import api from "@/lib/api";

export default function TeacherClassesScreen() {
  const router = useRouter();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/classes");
        setClasses(res.data.data ?? []);
      } catch (_) {}
      finally {
        setLoading(false);
      }
    })();
  }, []);

  const openClass = async (cls: any) => {
    setSelected(cls);
    setStudentsLoading(true);
    try {
      const res = await api.get(`/classes/${cls._id}/students`);
      setStudents(res.data.data ?? []);
    } catch (_) {
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  const sec = (cls: any) => cls.section ?? cls.sections?.[0] ?? "A";

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      </SafeAreaView>
    );
  }

  if (classes.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No classes yet</Text>
          <Text style={styles.emptySub}>Your school admin will add classes.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>My Classes</Text>
        <Text style={styles.subtitle}>Tap a class to view students</Text>
        {classes.map((cls) => (
          <TouchableOpacity
            key={cls._id}
            style={styles.card}
            onPress={() => openClass(cls)}
            activeOpacity={0.7}
          >
            <Text style={styles.cardTitle}>
              Class {cls.className} – {sec(cls)}
            </Text>
            {cls.roomNumber ? (
              <Text style={styles.cardMeta}>Room {cls.roomNumber}</Text>
            ) : null}
            <Text style={styles.cardLink}>View students →</Text>
          </TouchableOpacity>
        ))}

        <Modal visible={!!selected} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selected ? `Class ${selected.className} – ${sec(selected)}` : ""}
                </Text>
                <TouchableOpacity onPress={() => { setSelected(null); setStudents([]); }}>
                  <Text style={styles.modalClose}>Close</Text>
                </TouchableOpacity>
              </View>
              {studentsLoading ? (
                <ActivityIndicator style={{ marginVertical: 24 }} color="#059669" />
              ) : (
                <FlatList
                  data={students}
                  keyExtractor={(s) => s._id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.studentRow}
                      activeOpacity={0.7}
                      onPress={() => {
                        if (!selected) return;
                        const cn = selected.className;
                        const sc = sec(selected);
                        setSelected(null);
                        router.push({
                          pathname: "/(teacher)/student/[studentId]",
                          params: {
                            studentId: item._id,
                            className: String(cn),
                            section: sc,
                          },
                        });
                      }}
                    >
                      <Text style={styles.studentName}>
                        {item.firstName} {item.lastName}
                      </Text>
                      <Text style={styles.studentMeta}>
                        Roll {item.rollNumber ?? "—"} · Adm {item.admissionNumber}
                      </Text>
                      <Text style={styles.studentLink}>View profile →</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyList}>No students in this class.</Text>
                  }
                />
              )}
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#64748b" },
  emptySub: { fontSize: 14, color: "#94a3b8", marginTop: 8 },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  cardMeta: { fontSize: 12, color: "#64748b", marginTop: 4 },
  cardLink: { fontSize: 13, color: "#059669", marginTop: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    padding: 20,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  modalClose: { fontSize: 16, color: "#059669", fontWeight: "600" },
  studentRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  studentName: { fontWeight: "600", color: "#0f172a" },
  studentMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  studentLink: { fontSize: 13, color: "#059669", marginTop: 6, fontWeight: "600" },
  emptyList: { color: "#94a3b8", paddingVertical: 24, textAlign: "center" },
});
