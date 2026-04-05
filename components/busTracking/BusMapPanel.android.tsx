import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { MapMarker, Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { GOOGLE_MAPS_API_KEY } from "@/constants/env";
import type { BusMapPanelProps } from "./types";

const INDIA_FALLBACK: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

function regionFor(lat: number, lng: number, delta = 0.04): Region {
  return { latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta };
}

export default function BusMapPanel({ location, offline }: BusMapPanelProps) {
  const mapRef = useRef<MapView | null>(null);
  const markerRef = useRef<MapMarker | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const useGoogleProvider = GOOGLE_MAPS_API_KEY.trim().length > 0;

  const openGoogleMaps = useCallback(() => {
    if (!location) return;
    const url = `https://www.google.com/maps?q=${location.lat},${location.lng}`;
    Linking.openURL(url).catch(() => {});
  }, [location]);

  useEffect(() => {
    if (!location || !mapReady || !mapRef.current) return;
    const next = regionFor(location.lat, location.lng, 0.04);
    const coord = { latitude: location.lat, longitude: location.lng };
    const id = requestAnimationFrame(() => {
      try {
        markerRef.current?.animateMarkerToCoordinate(coord, 450);
      } catch {
        /* ignore */
      }
      try {
        mapRef.current?.animateToRegion(next, 450);
      } catch {
        /* ignore */
      }
    });
    return () => cancelAnimationFrame(id);
  }, [location, mapReady]);

  const initialRegion =
    location != null ? regionFor(location.lat, location.lng, 0.06) : INDIA_FALLBACK;

  return (
    <View style={styles.mapWrap} collapsable={false}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={useGoogleProvider ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        onMapReady={() => setMapReady(true)}
        showsUserLocation={false}
        showsMyLocationButton={false}
        mapType="standard"
        loadingEnabled
        moveOnMarkerPress={false}
      >
        {location ? (
          <Marker
            ref={markerRef}
            coordinate={{ latitude: location.lat, longitude: location.lng }}
            title="School bus"
            description={offline ? "Last known position" : "Live position"}
            tracksViewChanges={false}
          />
        ) : null}
      </MapView>
      {location ? (
        <View style={styles.footer} pointerEvents="box-none">
          <TouchableOpacity onPress={openGoogleMaps} activeOpacity={0.85} hitSlop={8}>
            <Text style={styles.footerLink}>Open in Google Maps</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {!GOOGLE_MAPS_API_KEY.trim() ? (
        <View style={styles.keyBanner} pointerEvents="none">
          <Text style={styles.keyBannerText}>
            Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY and run a new native build for map tiles.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: { flex: 1, minHeight: 200, width: "100%", backgroundColor: "#e2e8f0" },
  footer: {
    position: "absolute",
    bottom: 8,
    right: 12,
    left: 12,
    alignItems: "center",
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f766e",
    textDecorationLine: "underline",
    backgroundColor: "rgba(255,255,255,0.92)",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  keyBanner: {
    position: "absolute",
    top: 8,
    left: 10,
    right: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(15,23,42,0.88)",
  },
  keyBannerText: { color: "#f8fafc", fontSize: 12, lineHeight: 17, textAlign: "center" },
});
