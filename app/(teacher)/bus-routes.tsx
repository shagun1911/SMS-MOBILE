import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Pressable,
  Dimensions,
} from "react-native";

const SCREEN_HEIGHT = Dimensions.get("window").height;
/** Modal card max height; ScrollView gets a fixed cap so it scrolls on Android/iOS. */
const MODAL_MAX_HEIGHT = Math.round(SCREEN_HEIGHT * 0.8);
const MODAL_SCROLL_MAX_HEIGHT = MODAL_MAX_HEIGHT - 32;
import { SafeAreaView } from "react-native-safe-area-context";
import api from "@/lib/api";

type Bus = {
  _id: string;
  vehicleNumber?: string;
  busNumber?: string;
  routeName?: string;
  registrationNumber?: string;
  driverName?: string;
  driverPhone?: string;
  capacity?: number;
};

export default function TeacherBusRoutes() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [busDetails, setBusDetails] = useState<any | null>(null);

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

  const openDetails = async (id: string) => {
    setSelectedBusId(id);
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const res = await api.get(`/transport/${id}/details`);
      setBusDetails(res.data?.data ?? res.data);
    } catch (e: any) {
      setDetailsError(e?.response?.data?.message ?? "Unable to load bus details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const bus = busDetails?.bus;
  const students: any[] = Array.isArray(busDetails?.students) ? busDetails.students : [];

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0f766e" />
          <Text style={styles.loadingText}>Loading bus routes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!buses.length) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No buses assigned to any route.</Text>
          <Text style={styles.emptySub}>
            Once the school admin configures transport in the web app, buses and routes will appear here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <Text style={styles.title}>Bus Routes</Text>
          {buses.map((bus) => (
            <TouchableOpacity
              key={bus._id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => openDetails(bus._id)}
            >
              <Text style={styles.routeName}>{bus.routeName || "Unnamed Route"}</Text>
              <Text style={styles.meta}>
                Vehicle:{" "}
                <Text style={styles.metaStrong}>
                  {bus.busNumber || bus.vehicleNumber || "N/A"}
                </Text>
              </Text>
              <Text style={styles.meta}>
                Reg:{" "}
                <Text style={styles.metaStrong}>
                  {bus.registrationNumber || "N/A"}
                </Text>
              </Text>
              {bus.capacity ? (
                <Text style={styles.meta}>
                  Capacity: <Text style={styles.metaStrong}>{bus.capacity}</Text>
                </Text>
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
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={detailsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setDetailsOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close bus details"
          />
          <View style={[styles.modalCard, { maxHeight: MODAL_MAX_HEIGHT }]}>
            {detailsLoading ? (
              <View style={styles.modalInnerCenter}>
                <ActivityIndicator size="large" color="#0f766e" />
              </View>
            ) : detailsError ? (
              <Text style={styles.errorText}>{detailsError}</Text>
            ) : !bus ? (
              <Text style={styles.errorText}>No details available.</Text>
            ) : (
              <ScrollView
                style={{ maxHeight: MODAL_SCROLL_MAX_HEIGHT }}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator
                bounces
              >
                <Text style={styles.modalTitle}>Bus details</Text>
                <Text style={styles.meta}>
                  Bus:{" "}
                  <Text style={styles.metaStrong}>
                    {bus.busNumber || bus.vehicleNumber || "N/A"}
                  </Text>
                </Text>
                <Text style={styles.meta}>
                  Reg:{" "}
                  <Text style={styles.metaStrong}>
                    {bus.registrationNumber || "N/A"}
                  </Text>
                </Text>
                <Text style={styles.meta}>
                  Route:{" "}
                  <Text style={styles.metaStrong}>
                    {bus.routeName || "Unnamed Route"}
                  </Text>
                </Text>

                <View style={styles.driverRow}>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>Driver</Text>
                    <Text style={styles.infoValue}>{bus.driverName || "N/A"}</Text>
                    <Text style={styles.infoSub}>
                      {bus.driverPhone || "No phone provided"}
                    </Text>
                  </View>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>Conductor</Text>
                    <Text style={styles.infoValue}>{bus.conductorName || "N/A"}</Text>
                    <Text style={styles.infoSub}>
                      {bus.conductorPhone || "No phone provided"}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.title, { marginTop: 16, marginBottom: 8 }]}>
                  Students on this bus ({students.length})
                </Text>
                {students.length === 0 ? (
                  <Text style={[styles.emptySub, styles.modalEmptyStudents]}>
                    No students are assigned to this bus.
                  </Text>
                ) : (
                  students.map((s: any) => (
                    <View key={s._id} style={styles.studentRow}>
                      <Text style={styles.studentName}>
                        {`${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || "—"}
                      </Text>
                      <Text style={styles.studentMeta}>
                        {s.class ? `Class ${s.class}` : "—"}
                        {s.section ? ` · ${s.section}` : ""}
                      </Text>
                      <Text style={styles.studentMeta}>
                        Adm: {s.admissionNumber ?? "—"}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  modalCard: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 16,
    overflow: "hidden",
    zIndex: 1,
    elevation: 8,
  },
  modalScrollContent: { paddingBottom: 16 },
  modalInnerCenter: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  modalEmptyStudents: { textAlign: "left", alignSelf: "stretch" },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  driverRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  infoBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
    backgroundColor: "#f9fafb",
  },
  infoLabel: { fontSize: 12, color: "#6b7280" },
  infoValue: { fontSize: 15, fontWeight: "600", color: "#111827", marginTop: 2 },
  infoSub: { fontSize: 12, color: "#4b5563", marginTop: 2 },
  studentRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  studentName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  studentMeta: { fontSize: 12, color: "#6b7280" },
});
