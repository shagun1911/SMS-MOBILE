import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useStudentAuthStore } from "@/store/studentAuthStore";
import studentApi from "@/lib/studentApi";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useRegisterScreenRefresh } from "@/hooks/useRegisterScreenRefresh";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DAY_NAME_TO_NUM: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export default function StudentTimetableScreen() {
  const student = useStudentAuthStore((s) => s.student);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTimetable = useCallback(async () => {
    if (!student?.class || !student?.section) {
      setTimetable([]);
      return;
    }
    const params = new URLSearchParams({
      className: String(student.class),
      section: String(student.section),
    });
    const res = await studentApi.get(`/timetable?${params.toString()}`);
    setTimetable(res.data.data ?? []);
  }, [student?.class, student?.section]);

  useEffect(() => {
    if (!student?.class || !student?.section) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        await loadTimetable();
      } catch (_) {
      } finally {
        setLoading(false);
      }
    })();
  }, [loadTimetable, student?.class, student?.section]);

  const pullReload = useCallback(async () => {
    try {
      await loadTimetable();
    } catch (_) {}
  }, [loadTimetable]);
  useRegisterScreenRefresh(pullReload);

  const getDay = (dayName: string) => {
    const n = DAY_NAME_TO_NUM[dayName];
    return timetable.find((t: any) => Number(t.dayOfWeek) === n);
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
      <Text style={styles.title}>Timetable</Text>
      <Text style={styles.subtitle}>
        Class {student?.class} — Section {student?.section}
      </Text>

      {timetable.length === 0 ? (
        <Text style={styles.empty}>Timetable not set yet for your class.</Text>
      ) : (
        DAYS.map((day) => {
          const dayData = getDay(day);
          if (!dayData?.slots?.length) return null;
          return (
            <View key={day} style={styles.dayCard}>
              <Text style={styles.dayTitle}>{day}</Text>
              <View style={styles.slots}>
                {dayData.slots.map((slot: any, i: number) => (
                  <View
                    key={i}
                    style={[
                      styles.slot,
                      slot.type === "lunch" && styles.slotLunch,
                    ]}
                  >
                    <Text style={styles.slotTime}>
                      {slot.startTime} – {slot.endTime}
                    </Text>
                    <Text style={styles.slotSubject}>
                      {slot.type === "lunch" ? "Lunch break" : slot.subject}
                    </Text>
                    {slot.teacherId?.name && (
                      <Text style={styles.slotTeacher}>{slot.teacherId.name}</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          );
        })
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
  dayCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dayTitle: { backgroundColor: "#eef2ff", padding: 12, fontWeight: "600", color: "#3730a3" },
  slots: { padding: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  slot: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 10,
    minWidth: 100,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  slotLunch: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  slotTime: { fontSize: 11, color: "#64748b" },
  slotSubject: { fontWeight: "600", color: "#0f172a", marginTop: 2 },
  slotTeacher: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
});
