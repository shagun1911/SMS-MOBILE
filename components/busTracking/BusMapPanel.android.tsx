import { useCallback, useEffect, useState } from "react";
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GOOGLE_MAPS_API_KEY } from "@/constants/env";
import type { BusMapPanelProps } from "./types";

/**
 * Android: avoid react-native-maps MapView (native crashes on many devices / RN 0.81).
 * Show a map preview via Static Maps HTTP image when the key works; otherwise coordinates + external Maps.
 */
function staticMapUri(lat: number, lng: number, apiKey: string): string {
  const marker = `color:0x0f766e|${lat},${lng}`;
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: "16",
    size: "640x320",
    scale: "2",
    markers: marker,
    key: apiKey,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

export default function BusMapPanel({ location, offline }: BusMapPanelProps) {
  const [staticMapOk, setStaticMapOk] = useState(true);
  const key = GOOGLE_MAPS_API_KEY.trim();

  useEffect(() => {
    setStaticMapOk(true);
  }, [location?.lat, location?.lng]);

  const openGoogleMaps = useCallback(() => {
    if (!location) return;
    Linking.openURL(`https://www.google.com/maps?q=${location.lat},${location.lng}`).catch(() => {});
  }, [location]);

  const openGeo = useCallback(() => {
    if (!location) return;
    const { lat, lng } = location;
    Linking.openURL(`geo:${lat},${lng}?q=${lat},${lng}`).catch(() => openGoogleMaps());
  }, [location, openGoogleMaps]);

  if (!location) {
    return (
      <View style={styles.wrap}>
        <View style={styles.waitCard}>
          <Text style={styles.waitTitle}>Waiting for location</Text>
          <Text style={styles.waitText}>
            When your driver or conductor shares GPS, the bus position will appear here.
          </Text>
        </View>
      </View>
    );
  }

  const tryStatic = Boolean(key && staticMapOk);
  const uri = tryStatic ? staticMapUri(location.lat, location.lng, key) : "";

  return (
    <View style={styles.wrap}>
      {tryStatic ? (
        <Image
          source={{ uri }}
          style={styles.mapImage}
          resizeMode="cover"
          onError={() => setStaticMapOk(false)}
        />
      ) : (
        <View style={styles.coordCard}>
          <Text style={styles.coordLabel}>Latitude</Text>
          <Text style={styles.coordValue}>{location.lat.toFixed(6)}</Text>
          <Text style={[styles.coordLabel, styles.coordLabelSpaced]}>Longitude</Text>
          <Text style={styles.coordValue}>{location.lng.toFixed(6)}</Text>
          <Text style={styles.statusTag}>
            {offline ? "Last reported · may be stale" : "Recently updated"}
          </Text>
          {!key ? (
            <Text style={styles.hintMuted}>Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for a map preview (enable Maps Static API).</Text>
          ) : null}
        </View>
      )}
      <TouchableOpacity style={styles.primaryBtn} onPress={openGoogleMaps} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>Open in Google Maps</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={openGeo} activeOpacity={0.85}>
        <Text style={styles.secondaryBtnText}>Open in maps app (geo)</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 220,
    width: "100%",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  mapImage: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: "#e2e8f0",
  },
  coordCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  coordLabel: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  coordLabelSpaced: { marginTop: 12 },
  coordValue: { fontSize: 18, fontWeight: "700", color: "#0f172a", marginTop: 4 },
  statusTag: { marginTop: 14, fontSize: 12, color: "#0f766e", fontWeight: "600" },
  primaryBtn: {
    backgroundColor: "#0f766e",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryBtn: { paddingVertical: 12, alignItems: "center" },
  secondaryBtnText: { color: "#0f766e", fontSize: 15, fontWeight: "600" },
  waitCard: {
    flex: 1,
    minHeight: 200,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    justifyContent: "center",
  },
  waitTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  waitText: { fontSize: 14, color: "#64748b", lineHeight: 21 },
  hintMuted: { marginTop: 10, fontSize: 12, color: "#64748b", lineHeight: 17 },
});
