import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import { useAuthStore } from "@/store/authStore";
import { useStudentAuthStore } from "@/store/studentAuthStore";
import { resolveStaffHomeRoute } from "@/lib/staffPortalConfig";

export default function LandingScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const teacherAuth = useAuthStore((s) => s.isAuthenticated);
  const studentAuth = useStudentAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    (async () => {
      await new Promise((r) => setTimeout(r, 100));
      const auth = useAuthStore.getState();
      if (auth.isAuthenticated && auth.user) {
        const home = resolveStaffHomeRoute(auth.user.role);
        if (home) {
          router.replace(home);
          return;
        }
        useAuthStore.getState().logout();
      }
      if (useStudentAuthStore.getState().isAuthenticated) {
        router.replace("/(student)/dashboard");
        return;
      }
      setChecking(false);
    })();
  }, [router]);

  if (checking) {
    return (
      <ImageBackground
        source={require("../assets/login-bg.png")}
        resizeMode="cover"
        style={styles.background}
      >
        <View style={styles.scrim} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require("../assets/login-bg.png")}
      resizeMode="cover"
      style={styles.background}
    >
      <View style={styles.scrim} />
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>SMS Portal</Text>
          <Text style={styles.subtitle}>Choose how you want to sign in</Text>

          <Text style={styles.sectionLabel}>Staff</Text>
          <Text style={styles.sectionHint}>
            Mobile number or email + password — same as school admin Staff / login credentials.
          </Text>
          <View style={styles.buttonsRow}>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.button, styles.teacherButton]}
                onPress={() => router.push("/(auth)/teacher-login")}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonLabel}>Teacher</Text>
                <Text style={styles.buttonSubtext}>Teacher login</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.transportButton]}
                onPress={() => router.push("/(auth)/transport-login")}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonLabel}>Transport</Text>
                <Text style={styles.buttonSubtext}>Transport manager</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.button, styles.crewButton]}
                onPress={() => router.push("/(auth)/crew-login")}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonLabel}>Driver / Conductor</Text>
                <Text style={styles.buttonSubtext}>Bus driver & conductor</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.supportStaffButton]}
                onPress={() => router.push("/(auth)/support-staff-login")}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonLabel}>Other staff</Text>
                <Text style={styles.buttonSubtext}>Accountant, cleaning, other</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.sectionLabel, styles.sectionAfterStudent]}>Student</Text>
          <View style={styles.buttonsRow}>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.button, styles.studentButton, styles.fullWidthInRow]}
                onPress={() => router.push("/(auth)/student-login")}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonLabel}>Student</Text>
                <Text style={styles.buttonSubtext}>Student portal login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(248,250,252,0.85)",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 640,
    borderRadius: 18,
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 10 },
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 14,
    lineHeight: 18,
  },
  sectionAfterStudent: {
    marginTop: 22,
  },
  buttonsRow: {
    gap: 16,
  },
  row: {
    flexDirection: "row",
    gap: 16,
  },
  fullWidthInRow: {
    flex: 1,
  },
  button: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 18,
    justifyContent: "center",
  },
  teacherButton: {
    backgroundColor: "#10B981",
  },
  studentButton: {
    backgroundColor: "#6366F1",
  },
  transportButton: {
    backgroundColor: "#0f766e",
  },
  crewButton: {
    backgroundColor: "#c2410c",
  },
  supportStaffButton: {
    backgroundColor: "#9333ea",
  },
  buttonLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  buttonSubtext: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
    textAlign: "center",
  },
});
