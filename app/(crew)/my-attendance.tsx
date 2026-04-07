import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { AttendanceMonthCalendar } from "@/components/AttendanceMonthCalendar";
import { ymdFromParts } from "@/lib/absentDates";

type Row = { date: string; status: "present" | "absent"; isFinal: boolean };

export default function CrewMyAttendanceScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthIndex, setMonthIndex] = useState(new Date().getMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [totalAbsents, setTotalAbsents] = useState(0);

  const load = useCallback(async () => {
    if (!user?._id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/transport-attendance/user/${encodeURIComponent(user._id)}`, {
        params: { year, month: monthIndex + 1 },
      });
      const data = res.data?.data ?? {};
      setRows(Array.isArray(data.attendance) ? data.attendance : []);
      setTotalAbsents(Number(data.user?.totalAbsentCount ?? 0));
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Could not load attendance.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?._id, year, monthIndex]);

  useEffect(() => {
    load();
  }, [load]);

  const absentYmdSet = useMemo(
    () => new Set(rows.filter((r) => r.status === "absent").map((r) => r.date)),
    [rows]
  );
  const presentYmdSet = useMemo(
    () => new Set(rows.filter((r) => r.status === "present").map((r) => r.date)),
    [rows]
  );

  const goPrevMonth = () => {
    setMonthIndex((m) => {
      if (m === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  };
  const goNextMonth = () => {
    setMonthIndex((m) => {
      if (m === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  };

  const todayYmd = ymdFromParts(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const absentToday = absentYmdSet.has(todayYmd);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Attendance</Text>
        <Text style={styles.sub}>Total absents: {totalAbsents}</Text>
        {absentToday ? (
          <View style={styles.alert}>
            <Text style={styles.alertTitle}>Attendance Alert</Text>
            <Text style={styles.alertText}>You have been marked absent today.</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}><ActivityIndicator color="#4f46e5" /></View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <AttendanceMonthCalendar
            year={year}
            monthIndex={monthIndex}
            absentYmdSet={absentYmdSet}
            presentYmdSet={presentYmdSet}
            onPrevMonth={goPrevMonth}
            onNextMonth={goNextMonth}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, padding: 16 },
  back: { marginBottom: 8 },
  backText: { color: "#4f46e5", fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  sub: { marginTop: 4, marginBottom: 10, color: "#475569", fontSize: 13 },
  center: { paddingVertical: 28, alignItems: "center" },
  error: { color: "#b91c1c" },
  alert: { backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  alertTitle: { color: "#b91c1c", fontWeight: "700" },
  alertText: { color: "#991b1b", fontSize: 12, marginTop: 2 },
});
