import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import studentApi from "@/lib/studentApi";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useRegisterScreenRefresh } from "@/hooks/useRegisterScreenRefresh";

export default function StudentMarksScreen() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadResults = useCallback(async () => {
    const res = await studentApi.get("/exams/student/results");
    setResults(res.data.data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadResults();
      } catch (_) {
      } finally {
        setLoading(false);
      }
    })();
  }, [loadResults]);

  const pullReload = useCallback(async () => {
    try {
      await loadResults();
    } catch (_) {}
  }, [loadResults]);
  useRegisterScreenRefresh(pullReload);

  const gradeColor = (grade: string) => {
    if (!grade) return "#64748b";
    const g = grade.toUpperCase();
    if (g.startsWith("A")) return "#15803d";
    if (g.startsWith("B")) return "#1d4ed8";
    if (g.startsWith("C")) return "#ca8a04";
    return "#b91c1c";
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <RefreshableScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>My Results</Text>
      <Text style={styles.subtitle}>Exam results and subject-wise performance</Text>

      {results.length === 0 ? (
        <Text style={styles.empty}>No results available yet. Results will appear here once exams are graded.</Text>
      ) : (
        results.map((result: any) => (
          <View key={result._id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.examName}>{result.examId?.title || "Exam"}</Text>
                <Text style={styles.examType}>{result.examId?.type || ""}</Text>
              </View>
              <View style={styles.gradeBox}>
                <Text style={styles.percentage}>{result.percentage?.toFixed(1)}%</Text>
                <View style={[styles.gradeBadge, { backgroundColor: gradeColor(result.grade) + "20" }]}>
                  <Text style={[styles.gradeText, { color: gradeColor(result.grade) }]}>
                    Grade: {result.grade || "—"}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(result.percentage || 0, 100)}%` },
                ]}
              />
            </View>
            {Array.isArray(result.subjects) && result.subjects.length > 0 && (
              <View style={styles.table}>
                {result.subjects.map((s: any, i: number) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={styles.tableSubject}>{s.subject}</Text>
                    <Text style={styles.tableMarks}>
                      {s.obtainedMarks} / {s.maxMarks}
                    </Text>
                    <Text style={styles.tablePct}>
                      {s.maxMarks > 0 ? ((s.obtainedMarks / s.maxMarks) * 100).toFixed(0) : 0}%
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))
      )}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 20 },
  empty: { color: "#64748b", paddingVertical: 24 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  examName: { fontWeight: "600", color: "#0f172a", fontSize: 16 },
  examType: { fontSize: 12, color: "#64748b", marginTop: 2 },
  gradeBox: { alignItems: "flex-end" },
  percentage: { fontSize: 20, fontWeight: "700", color: "#4f46e5" },
  gradeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 4 },
  gradeText: { fontWeight: "600", fontSize: 12 },
  progressBar: { height: 6, backgroundColor: "#e2e8f0", borderRadius: 3, overflow: "hidden", marginBottom: 12 },
  progressFill: { height: "100%", backgroundColor: "#4f46e5", borderRadius: 3 },
  table: { borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  tableRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f8fafc" },
  tableSubject: { flex: 1, color: "#475569" },
  tableMarks: { width: 70, textAlign: "right", fontWeight: "500", color: "#0f172a" },
  tablePct: { width: 44, textAlign: "right", color: "#64748b", fontSize: 13 },
});
