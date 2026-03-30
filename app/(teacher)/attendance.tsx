import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import api from "@/lib/api";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useRegisterScreenRefresh } from "@/hooks/useRegisterScreenRefresh";

function sectionLabel(cls: any): string {
  return cls.section ?? cls.sections?.[0] ?? "A";
}

export default function TeacherAttendanceClassesScreen() {
  const router = useRouter();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await api.get("/classes");
    setClasses(res.data.data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch {
        setClasses([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const pullReload = useCallback(async () => {
    try {
      await load();
    } catch {
      setClasses([]);
    }
  }, [load]);
  useRegisterScreenRefresh(pullReload);

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
          <Text style={styles.emptyTitle}>No classes</Text>
          <Text style={styles.emptySub}>You need at least one class to mark attendance.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <RefreshableScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Attendance</Text>
        <Text style={styles.subtitle}>Select a class to mark today’s attendance</Text>

        {classes.map((cls) => {
          const sec = sectionLabel(cls);
          const label = `Class ${cls.className} – ${sec}`;
          return (
            <TouchableOpacity
              key={cls._id}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() =>
                router.push({
                  pathname: "/(teacher)/attendance/[classId]",
                  params: {
                    classId: String(cls._id),
                    title: label,
                  },
                } as any)
              }
            >
              <Text style={styles.cardTitle}>{label}</Text>
              {cls.roomNumber ? <Text style={styles.cardMeta}>Room {cls.roomNumber}</Text> : null}
              <Text style={styles.cardLink}>Mark attendance →</Text>
            </TouchableOpacity>
          );
        })}
      </RefreshableScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  emptySub: { fontSize: 14, color: "#64748b", textAlign: "center" },
  backRow: { marginBottom: 12, alignSelf: "flex-start" },
  backText: { fontSize: 15, fontWeight: "600", color: "#4f46e5" },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginBottom: 6 },
  subtitle: { fontSize: 13, color: "#64748b", marginBottom: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  cardMeta: { fontSize: 12, color: "#64748b", marginTop: 4 },
  cardLink: { fontSize: 13, fontWeight: "600", color: "#059669", marginTop: 10 },
});
