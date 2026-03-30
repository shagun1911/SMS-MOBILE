import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "@/lib/api";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useRegisterScreenRefresh } from "@/hooks/useRegisterScreenRefresh";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** API stores dayOfWeek as 1 = Monday … 6 = Saturday */
const DAY_NAME_TO_NUM: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export default function TeacherTimetableScreen() {
  const [classes, setClasses] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  const classNames = useMemo(() => {
    const names = new Set<string>();
    for (const c of classes) {
      if (c?.className != null && c.className !== "") names.add(String(c.className));
    }
    return [...names].sort();
  }, [classes]);

  const sectionsForClass = useMemo(() => {
    if (!selectedClass) return [];
    const secs = classes
      .filter((c) => String(c.className) === selectedClass)
      .map((c) => String(c.section ?? "").trim())
      .filter(Boolean);
    return [...new Set(secs)].sort();
  }, [classes, selectedClass]);

  const selectedClassDoc = useMemo(() => {
    if (!selectedClass || !selectedSection) return null;
    const sec = String(selectedSection).trim().toUpperCase();
    return (
      classes.find(
        (c) =>
          String(c.className) === selectedClass &&
          String(c.section ?? "")
            .trim()
            .toUpperCase() === sec
      ) ?? null
    );
  }, [classes, selectedClass, selectedSection]);

  const loadClasses = useCallback(async () => {
    const res = await api.get("/classes");
    setClasses(res.data.data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadClasses();
      } catch (_) {
      } finally {
        setLoading(false);
      }
    })();
  }, [loadClasses]);

  const pullReload = useCallback(async () => {
    try {
      const res = await api.get("/classes");
      const list = res.data.data ?? [];
      setClasses(list);
      if (!selectedClass || !selectedSection) {
        setTimetable([]);
        setFetchError(null);
        return;
      }
      const secU = String(selectedSection).trim().toUpperCase();
      const doc = list.find(
        (c: any) =>
          String(c.className) === selectedClass &&
          String(c.section ?? "").trim().toUpperCase() === secU
      );
      if (!doc?._id) {
        setTimetable([]);
        return;
      }
      setFetchError(null);
      const tr = await api.get(
        `/timetable/class/${doc._id}?section=${encodeURIComponent(secU)}`
      );
      const payload = tr.data?.data;
      const days = payload?.days;
      setTimetable(Array.isArray(days) ? days : []);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        e?.message ??
        "Network error — check API URL (phone vs localhost).";
      setFetchError(msg);
      setTimetable([]);
    }
  }, [selectedClass, selectedSection]);
  useRegisterScreenRefresh(pullReload);

  useEffect(() => {
    if (!selectedClassDoc?._id || !selectedSection) {
      setTimetable([]);
      setFetchError(null);
      return;
    }
    const sec = String(selectedSection).trim().toUpperCase();
    let cancelled = false;
    (async () => {
      try {
        setFetchError(null);
        const res = await api.get(
          `/timetable/class/${selectedClassDoc._id}?section=${encodeURIComponent(sec)}`
        );
        if (cancelled) return;
        const payload = res.data?.data;
        const days = payload?.days;
        const list = Array.isArray(days) ? days : [];
        setTimetable(list);
      } catch (e: any) {
        if (cancelled) return;
        const msg =
          e?.response?.data?.message ??
          e?.message ??
          "Network error — check API URL (phone vs localhost).";
        setFetchError(msg);
        setTimetable([]);
        if (__DEV__) console.warn("[timetable]", e?.response?.data ?? e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedClassDoc?._id, selectedSection]);

  const getDay = (dayName: string) => {
    const n = DAY_NAME_TO_NUM[dayName];
    return timetable.find((t: any) => Number(t.dayOfWeek) === n);
  };

  const onSelectClass = (name: string) => {
    setSelectedClass(name);
    if (!name) {
      setSelectedSection("");
      return;
    }
    const secs = [
      ...new Set(
        classes
          .filter((c) => String(c.className) === name)
          .map((c) => String(c.section ?? "").trim())
          .filter(Boolean),
      ),
    ].sort();
    setSelectedSection(secs.length === 1 ? secs[0] : "");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <RefreshableScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Timetable</Text>
        <Text style={styles.subtitle}>Select class and section</Text>

        <View style={styles.pickerRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
            {classNames.map((name) => (
              <TouchableOpacity
                key={name}
                style={[styles.pickerChip, selectedClass === name && styles.pickerChipActive]}
                onPress={() => onSelectClass(name)}
              >
                <Text style={selectedClass === name ? styles.pickerChipTextActive : styles.pickerChipText}>
                  Class {name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {selectedClass ? (
          sectionsForClass.length > 0 ? (
            <View style={styles.pickerRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                {sectionsForClass.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.pickerChip, selectedSection === s && styles.pickerChipActive]}
                    onPress={() => setSelectedSection(s)}
                  >
                    <Text style={selectedSection === s ? styles.pickerChipTextActive : styles.pickerChipText}>
                      Sec {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : (
            <Text style={styles.hint}>No sections found for this class.</Text>
          )
        ) : null}

        {!selectedClass || !selectedSection ? (
          <Text style={styles.empty}>Select class and section to view timetable.</Text>
        ) : fetchError ? (
          <Text style={styles.error}>{fetchError}</Text>
        ) : timetable.length === 0 ? (
          <Text style={styles.empty}>No timetable for this class yet.</Text>
        ) : (
          <View style={styles.days}>
            {DAYS.map((day) => {
              const dayData = getDay(day);
              if (!dayData?.slots?.length) return null;
              return (
                <View key={day} style={styles.dayCard}>
                  <Text style={styles.dayTitle}>{day}</Text>
                  <View style={styles.slots}>
                    {dayData.slots.map((slot: any, i: number) => {
                      const teacherLabel = slot.teacherId?.name || slot.teacherName;
                      return (
                        <View key={i} style={styles.slot}>
                          <Text style={styles.slotTime}>
                            {slot.startTime} – {slot.endTime}
                          </Text>
                          <Text style={styles.slotSubject}>
                            {slot.type === "lunch" ? "Lunch" : slot.subject || "—"}
                          </Text>
                          {teacherLabel ? (
                            <Text style={styles.slotTeacher}>{teacherLabel}</Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </RefreshableScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 16 },
  pickerRow: { flexDirection: "row", marginBottom: 12, gap: 8 },
  pickerScroll: { flexGrow: 0 },
  pickerChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#e2e8f0",
    marginRight: 8,
  },
  pickerChipActive: { backgroundColor: "#059669" },
  pickerChipText: { color: "#475569", fontWeight: "500" },
  pickerChipTextActive: { color: "#fff", fontWeight: "500" },
  hint: { fontSize: 13, color: "#94a3b8", marginBottom: 8 },
  empty: { color: "#64748b", paddingVertical: 24 },
  error: { color: "#b45309", paddingVertical: 16, fontSize: 14, lineHeight: 20 },
  days: { gap: 16 },
  dayCard: { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#e2e8f0" },
  dayTitle: { backgroundColor: "#ecfdf5", padding: 12, fontWeight: "600", color: "#065f46" },
  slots: { padding: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  slot: { backgroundColor: "#f8fafc", padding: 10, borderRadius: 8, minWidth: 100 },
  slotTime: { fontSize: 11, color: "#64748b" },
  slotSubject: { fontWeight: "600", color: "#0f172a", marginTop: 2 },
  slotTeacher: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
});
