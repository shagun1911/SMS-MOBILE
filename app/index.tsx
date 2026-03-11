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

export default function LandingScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const teacherAuth = useAuthStore((s) => s.isAuthenticated);
  const studentAuth = useStudentAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    (async () => {
      await new Promise((r) => setTimeout(r, 100));
      if (useAuthStore.getState().isAuthenticated) {
        router.replace("/(teacher)/dashboard");
        return;
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
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={[styles.button, styles.teacherButton]}
              onPress={() => router.push("/(auth)/teacher-login")}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonLabel}>Teacher</Text>
              <Text style={styles.buttonSubtext}>School staff login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.studentButton]}
              onPress={() => router.push("/(auth)/student-login")}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonLabel}>Student</Text>
              <Text style={styles.buttonSubtext}>Student portal login</Text>
            </TouchableOpacity>
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
  buttonsRow: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
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
  buttonLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  buttonSubtext: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
});
