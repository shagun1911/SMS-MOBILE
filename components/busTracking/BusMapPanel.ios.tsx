import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { BusMapPanelProps } from "./types";

/**
 * iOS: no embedded map — open system Maps for the bus position.
 */
export default function BusMapPanel({ location, offline }: BusMapPanelProps) {
  const openMaps = () => {
    if (!location) return;
    const { lat, lng } = location;
    const apple = `http://maps.apple.com/?ll=${lat},${lng}&q=School%20bus`;
    Linking.openURL(apple).catch(() => {
      Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`).catch(() => {});
    });
  };

  return (
    <View style={styles.wrap}>
      {location ? (
        <>
          <View style={styles.card}>
            <Text style={styles.label}>Bus location</Text>
            <Text style={styles.coords}>
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </Text>
            <Text style={styles.tag}>{offline ? "Last known position" : "Live position"}</Text>
          </View>
          <TouchableOpacity style={styles.btn} onPress={openMaps} activeOpacity={0.85}>
            <Text style={styles.btnText}>Open in Maps</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.waitCard}>
          <Text style={styles.waitTitle}>Waiting for location</Text>
          <Text style={styles.waitText}>
            When your driver or conductor shares GPS, you can open the bus position in Maps.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 200,
    width: "100%",
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  label: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  coords: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginTop: 8 },
  tag: { marginTop: 12, fontSize: 12, color: "#0f766e", fontWeight: "600" },
  btn: {
    backgroundColor: "#0f766e",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  waitCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  waitTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  waitText: { fontSize: 14, color: "#64748b", lineHeight: 21 },
});
