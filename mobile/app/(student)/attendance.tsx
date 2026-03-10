import { View, Text, StyleSheet, ScrollView } from "react-native";

export default function StudentAttendanceScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Attendance</Text>
      <View style={styles.comingSoon}>
        <Text style={styles.comingSoonIcon}>📋</Text>
        <Text style={styles.comingSoonText}>Attendance feature coming soon.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginBottom: 20 },
  comingSoon: {
    backgroundColor: "#fdf2f8",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fbcfe8",
  },
  comingSoonIcon: { fontSize: 48, marginBottom: 12 },
  comingSoonText: { fontSize: 15, color: "#db2777", fontWeight: "600", textAlign: "center" },
});
