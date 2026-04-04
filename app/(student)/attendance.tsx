import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import studentApi from "@/lib/studentApi";
import { AttendanceMonthCalendar } from "@/components/AttendanceMonthCalendar";
import {
  absentYmdFromNotification,
  buildAbsentYmdSet,
  ymdFromParts,
} from "@/lib/absentDates";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useRegisterScreenRefresh } from "@/hooks/useRegisterScreenRefresh";

function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return iso;
  }
}

export default function StudentAttendanceScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialMonth = useMemo(() => {
    const n = new Date();
    return { year: n.getFullYear(), monthIndex: n.getMonth() };
  }, []);

  const [viewYear, setViewYear] = useState(initialMonth.year);
  const [viewMonthIndex, setViewMonthIndex] = useState(initialMonth.monthIndex);

  const load = useCallback(async () => {
    setError(null);
    const res = await studentApi.get("/student-notifications");
    const raw = res.data?.data ?? res.data ?? [];
    const list = Array.isArray(raw) ? raw : [];
    setItems(list.filter((n: any) => String(n?.type ?? "") === "attendance_absent"));
  }, []);

  useEffect(() => {
    load()
      .catch((e: any) => {
        setError(e?.response?.data?.message ?? e?.message ?? "Could not load.");
      })
      .finally(() => setLoading(false));
  }, [load]);

  const absentYmdSet = useMemo(() => buildAbsentYmdSet(items), [items]);

  /** Absence date (YYYY-MM-DD) must match today’s local date — notices are not kept after that day. */
  const noticeItems = useMemo(() => {
    const d = new Date();
    const todayYmd = ymdFromParts(d.getFullYear(), d.getMonth(), d.getDate());
    return items.filter((n) => absentYmdFromNotification(n) === todayYmd);
  }, [items]);

  const pullReload = useCallback(async () => {
    try {
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Could not load.");
    }
  }, [load]);
  useRegisterScreenRefresh(pullReload);

  const goPrevMonth = useCallback(() => {
    setViewMonthIndex((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const goNextMonth = useCallback(() => {
    setViewMonthIndex((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <RefreshableScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Attendance</Text>
        <Text style={styles.sub}>
          Days you were marked absent are highlighted on the calendar. Use the arrows to view other months.
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#db2777" />
          </View>
        ) : error ? (
          <View style={styles.bannerErr}>
            <Text style={styles.bannerErrText}>{error}</Text>
          </View>
        ) : (
          <>
            <AttendanceMonthCalendar
              year={viewYear}
              monthIndex={viewMonthIndex}
              absentYmdSet={absentYmdSet}
              onPrevMonth={goPrevMonth}
              onNextMonth={goNextMonth}
            />

            {items.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>✓</Text>
                <Text style={styles.emptyTitle}>No absence records</Text>
                <Text style={styles.emptySub}>You have not been marked absent in the records we have.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Notices</Text>
                <Text style={styles.sectionSub}>
                  Shown only on the calendar day you were marked absent (not on later days).
                </Text>
                {noticeItems.length === 0 ? (
                  <View style={styles.noticeEmpty}>
                    <Text style={styles.noticeEmptyText}>No absence notice for today.</Text>
                    <Text style={styles.noticeEmptySub}>
                      Past absences stay on the calendar above; this list is for today only.
                    </Text>
                  </View>
                ) : (
                  noticeItems.map((n) => (
                    <View key={String(n._id)} style={styles.card}>
                      <Text style={styles.cardTitle}>{String(n.title ?? "Attendance")}</Text>
                      <Text style={styles.cardBody}>{String(n.message ?? "")}</Text>
                      <Text style={styles.cardMeta}>{formatWhen(String(n.createdAt ?? ""))}</Text>
                    </View>
                  ))
                )}
              </>
            )}
          </>
        )}
      </RefreshableScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  backRow: { marginBottom: 12, alignSelf: "flex-start" },
  backText: { fontSize: 15, fontWeight: "600", color: "#4f46e5" },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  sub: { fontSize: 13, color: "#64748b", lineHeight: 18, marginBottom: 20 },
  center: { paddingVertical: 48, alignItems: "center" },
  bannerErr: {
    backgroundColor: "#fef2f2",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  bannerErrText: { color: "#b91c1c", fontSize: 14 },
  emptyCard: {
    backgroundColor: "#f0fdf4",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  emptyIcon: { fontSize: 40, marginBottom: 8, color: "#16a34a" },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#166534" },
  emptySub: { fontSize: 13, color: "#15803d", marginTop: 6, textAlign: "center" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  sectionSub: { fontSize: 12, color: "#94a3b8", marginBottom: 12 },
  noticeEmpty: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 8,
  },
  noticeEmptyText: { fontSize: 14, fontWeight: "600", color: "#475569" },
  noticeEmptySub: { fontSize: 12, color: "#94a3b8", marginTop: 6, lineHeight: 17 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fbcfe8",
    borderLeftWidth: 4,
    borderLeftColor: "#db2777",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  cardBody: { fontSize: 13, color: "#475569", marginTop: 6, lineHeight: 18 },
  cardMeta: { fontSize: 11, color: "#94a3b8", marginTop: 10 },
});
