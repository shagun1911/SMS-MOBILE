import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import api from "@/lib/api";
import { CalendarView } from "@/components/CalendarView";
import { AttendanceLegend } from "@/components/AttendanceLegend";

type AttendanceRow = { date: string; status: "present" | "absent" };

export function MyAttendanceScreen() {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [totalAbsents, setTotalAbsents] = useState(0);
  const [monthlyAbsents, setMonthlyAbsents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get("/attendance/me", { params: { year, month: monthIndex + 1 } });
        const data = res.data?.data ?? {};
        setRows(Array.isArray(data.attendance) ? data.attendance : []);
        setTotalAbsents(Number(data.totalAbsents ?? 0));
        setMonthlyAbsents(Number(data.totalAbsentsThisMonth ?? 0));
      } catch (e: any) {
        setError(e?.response?.data?.message ?? "Could not load attendance.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [year, monthIndex]);

  const absentYmdSet = useMemo(
    () => new Set(rows.filter((r) => r.status === "absent").map((r) => r.date)),
    [rows]
  );
  const presentYmdSet = useMemo(
    () => new Set(rows.filter((r) => r.status === "present").map((r) => r.date)),
    [rows]
  );

  const onPrevMonth = () => {
    setMonthIndex((m) => {
      if (m === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  };
  const onNextMonth = () => {
    setMonthIndex((m) => {
      if (m === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Attendance</Text>
        <Text style={styles.sub}>Total absents this month: {monthlyAbsents}</Text>
        <Text style={styles.sub}>Total absents overall: {totalAbsents}</Text>
        <AttendanceLegend />
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#4f46e5" />
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <CalendarView
            year={year}
            monthIndex={monthIndex}
            absentYmdSet={absentYmdSet}
            presentYmdSet={presentYmdSet}
            onPrevMonth={onPrevMonth}
            onNextMonth={onNextMonth}
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
  sub: { fontSize: 13, color: "#475569", marginTop: 4 },
  center: { paddingVertical: 24, alignItems: "center" },
  error: { color: "#b91c1c", marginTop: 10 },
});
