import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import api from "@/lib/api";

export default function TeacherMarksScreen() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/exams");
        setExams(res.data.data ?? []);
      } catch (_) {}
      finally {
        setLoading(false);
      }
    })();
  }, []);

  const upcoming = exams.filter(
    (e: any) => e.status === "scheduled" || e.status === "upcoming" || !e.status
  );
  const completed = exams.filter((e: any) => e.status === "completed");

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Exams & Marks</Text>
      <Text style={styles.subtitle}>Select an exam to enter marks or view results</Text>

      {exams.length === 0 ? (
        <Text style={styles.empty}>No exams created yet. Ask the admin to create an exam first.</Text>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Upcoming</Text>
              {upcoming.map((exam: any) => (
                <View key={exam._id} style={styles.card}>
                  <Text style={styles.cardBadge}>{exam.examType ?? exam.type ?? "Exam"}</Text>
                  <Text style={styles.cardTitle}>{exam.name ?? exam.title ?? "Examination"}</Text>
                  {exam.startDate && (
                    <Text style={styles.cardMeta}>
                      {new Date(exam.startDate).toLocaleDateString()}
                      {exam.endDate && ` – ${new Date(exam.endDate).toLocaleDateString()}`}
                    </Text>
                  )}
                  <Text style={styles.cardHint}>Enter marks and merit list from school admin dashboard.</Text>
                </View>
              ))}
            </>
          )}
          {completed.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Completed</Text>
              {completed.map((exam: any) => (
                <View key={exam._id} style={styles.card}>
                  <Text style={styles.cardBadge}>{exam.examType ?? exam.type ?? "Exam"}</Text>
                  <Text style={styles.cardTitle}>{exam.name ?? exam.title ?? "Examination"}</Text>
                  {exam.startDate && (
                    <Text style={styles.cardMeta}>{new Date(exam.startDate).toLocaleDateString()}</Text>
                  )}
                </View>
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 20 },
  empty: { color: "#64748b", paddingVertical: 24 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#475569", marginBottom: 12, marginTop: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardBadge: { fontSize: 11, color: "#7c3aed", marginBottom: 4 },
  cardTitle: { fontWeight: "600", color: "#0f172a" },
  cardMeta: { fontSize: 12, color: "#64748b", marginTop: 4 },
  cardHint: { fontSize: 12, color: "#94a3b8", marginTop: 8 },
});
