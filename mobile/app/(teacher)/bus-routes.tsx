import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import api from "@/lib/api";

export default function TeacherBusRoutesScreen() {
  const [fleet, setFleet] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/transport");
        setFleet(res.data.data ?? []);
      } catch (_) {
        setFleet([]);
      }
      finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeBuses = fleet.filter((b: any) => b.isActive !== false);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Bus routes</Text>
      <Text style={styles.subtitle}>View bus routes and vehicle details (read-only)</Text>

      {activeBuses.length === 0 ? (
        <Text style={styles.empty}>No bus routes added yet.</Text>
      ) : (
        activeBuses.map((bus: any) => (
          <View key={bus._id} style={styles.card}>
            <Text style={styles.cardTitle}>Bus {bus.busNumber}</Text>
            <Text style={styles.cardReg}>{bus.registrationNumber}</Text>
            <Text style={styles.cardRoute}>📍 {bus.routeName}</Text>
            <Text style={styles.cardCap}>Capacity: {bus.capacity} students</Text>
          </View>
        ))
      )}
    </ScrollView>
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: { fontWeight: "600", color: "#0f172a" },
  cardReg: { fontSize: 12, color: "#64748b", marginTop: 2 },
  cardRoute: { fontSize: 14, color: "#059669", marginTop: 8 },
  cardCap: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
});
