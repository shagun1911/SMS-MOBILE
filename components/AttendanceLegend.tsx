import { StyleSheet, Text, View } from "react-native";

export function AttendanceLegend() {
  return (
    <View style={styles.row}>
      <View style={styles.item}>
        <View style={[styles.dot, styles.present]} />
        <Text style={styles.label}>Present</Text>
      </View>
      <View style={styles.item}>
        <View style={[styles.dot, styles.absent]} />
        <Text style={styles.label}>Absent</Text>
      </View>
      <View style={styles.item}>
        <View style={[styles.dot, styles.unmarked]} />
        <Text style={styles.label}>Not marked</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  item: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 999 },
  present: { backgroundColor: "#16a34a" },
  absent: { backgroundColor: "#dc2626" },
  unmarked: { backgroundColor: "#cbd5e1" },
  label: { fontSize: 12, color: "#475569" },
});
