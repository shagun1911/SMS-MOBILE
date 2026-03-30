import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import api from "@/lib/api";
import { localCalendarYmd } from "@/lib/localYmd";

type DayStatus = {
  submitted: boolean;
  absentStudentIds: string[];
};

export default function TeacherAttendanceClassScreen() {
  const router = useRouter();
  const { classId, title } = useLocalSearchParams<{ classId: string; title?: string }>();
  const dateYmd = useMemo(() => localCalendarYmd(), []);

  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [dayStatus, setDayStatus] = useState<DayStatus | null>(null);
  const [loadingDay, setLoadingDay] = useState(true);
  /** Students marked absent for this session (only used when day not yet submitted). */
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headerTitle = title && String(title).length ? String(title) : "Attendance";

  const loadDay = useCallback(async () => {
    if (!classId) return;
    setLoadingDay(true);
    setError(null);
    try {
      const res = await api.get("/attendance/day", {
        params: { classId, date: dateYmd },
      });
      const payload = res.data?.data ?? res.data;
      const submitted = Boolean(payload?.submitted);
      const absent: string[] = Array.isArray(payload?.absentStudentIds)
        ? payload.absentStudentIds.map((x: unknown) => String(x))
        : [];
      setDayStatus({ submitted, absentStudentIds: absent });
      if (submitted) {
        setAbsentIds(new Set(absent));
      } else {
        setAbsentIds(new Set());
      }
    } catch (e: any) {
      setDayStatus(null);
      setError(e?.response?.data?.message ?? e?.message ?? "Could not load attendance status.");
    } finally {
      setLoadingDay(false);
    }
  }, [classId, dateYmd]);

  useEffect(() => {
    if (!classId) return;
    (async () => {
      setLoadingStudents(true);
      try {
        const res = await api.get(`/classes/${classId}/students`);
        setStudents(res.data.data ?? []);
      } catch {
        setStudents([]);
      } finally {
        setLoadingStudents(false);
      }
    })();
  }, [classId]);

  useEffect(() => {
    loadDay();
  }, [loadDay]);

  const alreadySubmitted = dayStatus?.submitted === true;
  const busy = loadingStudents || loadingDay;

  const toggleAbsent = (studentId: string) => {
    if (alreadySubmitted || submitting) return;
    setAbsentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const submit = async () => {
    if (!classId || alreadySubmitted || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/attendance", {
        classId,
        date: dateYmd,
        absentStudentIds: [...absentIds],
      });
      Alert.alert("Saved", "Attendance has been submitted.");
      await loadDay();
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.message ??
        (status === 409 ? "Attendance for this class and date was already submitted." : e?.message) ??
        "Submission failed.";
      setError(String(msg));
      if (status === 409) {
        await loadDay();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!classId) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.centered}>
          <Text style={styles.errText}>Missing class.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backText}>← Classes</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{headerTitle}</Text>
        <Text style={styles.dateLine}>{dateYmd}</Text>

        {busy ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.hint}>Loading…</Text>
          </View>
        ) : (
          <>
            {alreadySubmitted ? (
              <View style={styles.bannerInfo}>
                <Text style={styles.bannerInfoText}>
                  Attendance for this date is already submitted. Only absent students are stored.
                </Text>
              </View>
            ) : null}

            {error ? (
              <View style={styles.bannerErr}>
                <Text style={styles.bannerErrText}>{error}</Text>
              </View>
            ) : null}

            {!students.length ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No students in this class.</Text>
              </View>
            ) : (
              <>
                {students.map((s) => {
                  const sid = String(s._id);
                  const name =
                    [s.firstName, s.lastName]?.filter(Boolean).join(" ").trim() ||
                    s.name ||
                    "Student";
                  const isAbsent = absentIds.has(sid);
                  return (
                    <View key={sid} style={styles.row}>
                      <Text style={styles.studentName} numberOfLines={2}>
                        {name}
                      </Text>
                      <View style={styles.toggleGroup}>
                        <TouchableOpacity
                          style={[styles.pill, !isAbsent && styles.pillActiveOk]}
                          disabled={alreadySubmitted || submitting}
                          onPress={() => {
                            if (isAbsent) toggleAbsent(sid);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.pillText, !isAbsent && styles.pillTextActive]}>Present</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.pill, isAbsent && styles.pillActiveBad]}
                          disabled={alreadySubmitted || submitting}
                          onPress={() => {
                            if (!isAbsent) toggleAbsent(sid);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.pillText, isAbsent && styles.pillTextActiveBad]}>Absent</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                {!alreadySubmitted ? (
                  <TouchableOpacity
                    style={[styles.submitBtn, (!students.length || submitting) && styles.submitBtnDisabled]}
                    disabled={!students.length || submitting}
                    onPress={() => {
                      Alert.alert(
                        "Submit attendance",
                        `Mark ${absentIds.size} absent and everyone else present?`,
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Submit", style: "default", onPress: () => void submit() },
                        ]
                      );
                    }}
                    activeOpacity={0.85}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitBtnText}>Submit attendance</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  centerBlock: { paddingVertical: 48, alignItems: "center" },
  errText: { color: "#b91c1c", fontSize: 15 },
  backRow: { marginBottom: 12, alignSelf: "flex-start" },
  backText: { fontSize: 15, fontWeight: "600", color: "#4f46e5" },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  dateLine: { fontSize: 13, color: "#64748b", marginBottom: 16 },
  hint: { marginTop: 12, fontSize: 13, color: "#64748b" },
  bannerInfo: {
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  bannerInfoText: { color: "#1e40af", fontSize: 13, lineHeight: 18 },
  bannerErr: {
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  bannerErrText: { color: "#b91c1c", fontSize: 13 },
  emptyBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyText: { fontSize: 15, color: "#64748b" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  studentName: { flex: 1, fontSize: 15, fontWeight: "600", color: "#0f172a" },
  toggleGroup: { flexDirection: "row", gap: 8 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  pillActiveOk: { backgroundColor: "#dcfce7", borderColor: "#86efac" },
  pillActiveBad: { backgroundColor: "#fee2e2", borderColor: "#fecaca" },
  pillText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  pillTextActive: { color: "#166534" },
  pillTextActiveBad: { color: "#991b1b" },
  submitBtn: {
    marginTop: 20,
    backgroundColor: "#059669",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: { opacity: 0.55 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
