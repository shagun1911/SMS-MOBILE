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

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function TeacherTimetableScreen() {
  const [classes, setClasses] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  const classData = classes.find((c: any) => c.className === selectedClass);
  const sections = classData?.sections ?? [];

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

  useEffect(() => {
    if (!selectedClass || !selectedSection) {
      setTimetable([]);
      return;
    }
    (async () => {
      try {
        const res = await api.get(
          `/timetable?class=${encodeURIComponent(selectedClass)}&section=${encodeURIComponent(selectedSection)}`
        );
        setTimetable(res.data.data ?? []);
      } catch (_) {
        setTimetable([]);
      }
    })();
  }, [selectedClass, selectedSection]);

  const getDay = (dayName: string) => timetable.find((t: any) => t.dayOfWeek === dayName);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Timetable</Text>
      <Text style={styles.subtitle}>Select class and section</Text>

      <View style={styles.pickerRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
          {classes.map((c: any) => (
            <TouchableOpacity
              key={c._id}
              style={[
                styles.pickerChip,
                selectedClass === c.className && styles.pickerChipActive,
              ]}
              onPress={() => {
                setSelectedClass(c.className);
                setSelectedSection("");
              }}
            >
              <Text style={selectedClass === c.className ? styles.pickerChipTextActive : styles.pickerChipText}>
                Class {c.className}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {sections.length > 0 && (
        <View style={styles.pickerRow}>
          {sections.map((s: string) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.pickerChip,
                selectedSection === s && styles.pickerChipActive,
              ]}
              onPress={() => setSelectedSection(s)}
            >
              <Text style={selectedSection === s ? styles.pickerChipTextActive : styles.pickerChipText}>
                Sec {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!selectedClass || !selectedSection ? (
        <Text style={styles.empty}>Select class and section to view timetable.</Text>
      ) : (
        <View style={styles.days}>
          {DAYS.map((day) => {
            const dayData = getDay(day);
            if (!dayData?.slots?.length) return null;
            return (
              <View key={day} style={styles.dayCard}>
                <Text style={styles.dayTitle}>{day}</Text>
                <View style={styles.slots}>
                  {dayData.slots.map((slot: any, i: number) => (
                    <View key={i} style={styles.slot}>
                      <Text style={styles.slotTime}>
                        {slot.startTime} – {slot.endTime}
                      </Text>
                      <Text style={styles.slotSubject}>
                        {slot.type === "lunch" ? "Lunch" : slot.subject}
                      </Text>
                      {slot.teacherId?.name && (
                        <Text style={styles.slotTeacher}>{slot.teacherId.name}</Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  empty: { color: "#64748b", paddingVertical: 24 },
  days: { gap: 16 },
  dayCard: { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#e2e8f0" },
  dayTitle: { backgroundColor: "#ecfdf5", padding: 12, fontWeight: "600", color: "#065f46" },
  slots: { padding: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  slot: { backgroundColor: "#f8fafc", padding: 10, borderRadius: 8, minWidth: 100 },
  slotTime: { fontSize: 11, color: "#64748b" },
  slotSubject: { fontWeight: "600", color: "#0f172a", marginTop: 2 },
  slotTeacher: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
});
