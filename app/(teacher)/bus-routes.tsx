import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import api from "@/lib/api";

type Bus = {
  _id: string;
  vehicleNumber?: string;
  routeName?: string;
  driverName?: string;
  driverPhone?: string;
  capacity?: number;
};

export default function TeacherBusRoutes() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/transport");
        const data = res.data?.data ?? res.data ?? [];
        setBuses(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e?.response?.data?.message ?? "Failed to load bus routes");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Loading bus routes...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!buses.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No buses assigned to any route.</Text>
        <Text style={styles.emptySub}>
          Once the school admin configures transport in the web app, buses and routes will appear here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Bus Routes</Text>
      {buses.map((bus) => (
        <View key={bus._id} style={styles.card}>
          <Text style={styles.routeName}>{bus.routeName || "Unnamed Route"}</Text>
          <Text style={styles.meta}>
            Vehicle: <Text style={styles.metaStrong}>{bus.vehicleNumber || "N/A"}</Text>
          </Text>
          {bus.capacity ? (
            <Text style={styles.meta}>Capacity: <Text style={styles.metaStrong}>{bus.capacity}</Text></Text>
          ) : null}
          {bus.driverName || bus.driverPhone ? (
            <Text style={styles.meta}>
              Driver:{" "}
              <Text style={styles.metaStrong}>
                {bus.driverName || "N/A"}
                {bus.driverPhone ? ` · ${bus.driverPhone}` : ""}
              </Text>
            </Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32 },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  routeName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  metaStrong: {
    color: "#0f172a",
    fontWeight: "600",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: "#64748b",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 280,
  },
  errorText: {
    fontSize: 13,
    color: "#b91c1c",
    textAlign: "center",
  },
});
