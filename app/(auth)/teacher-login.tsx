import { useRouter } from "expo-router";
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
} from "react-native";
import api from "@/lib/api";
import { ensurePushRegistered } from "@/lib/pushNotifications";
import { useAuthStore } from "@/store/authStore";

/** Only teachers may use this app (other staff have separate flows, e.g. Transport). */
const TEACHER_APP_ROLE = "teacher";

export default function TeacherLoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!phoneOrEmail.trim() || !password) {
      setError("Please fill all fields");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const loginId = phoneOrEmail.trim();
      // Send email + identifier + phone: older APIs only read `email`; new API prefers `identifier`.
      const { data } = await api.post("/auth/login", {
        identifier: loginId,
        email: loginId,
        phone: loginId,
        password,
        portal: "teacher",
      });
      const { user, accessToken, refreshToken, mustChangePassword } = data;
      if (user.role === "superadmin") {
        setError("Master admin accounts use the web control center, not this app.");
        return;
      }
      if (user.role !== TEACHER_APP_ROLE) {
        setError("This app is for teachers only. Use the correct portal for your role.");
        return;
      }
      // Store the mustChangePassword flag in auth store so we can
      // show prompts inside the app, but always land on dashboard first.
      login(
        {
          _id: user._id,
          name: user.name,
          email: user.email ?? "",
          role: user.role,
          schoolId: user.schoolId,
          mustChangePassword: mustChangePassword ?? user.mustChangePassword,
          permissions: user.permissions || [],
        },
        accessToken,
        refreshToken
      );
      void ensurePushRegistered();
      router.replace("/(teacher)/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require("../../assets/auth-bg.png")}
      resizeMode="cover"
      style={styles.background}
    >
      <View style={styles.scrim} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.back}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Teacher Portal</Text>
            <Text style={styles.subtitle}>
              Teachers only — sign in with your registered mobile number or school email
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Mobile number or email"
              placeholderTextColor="#94A3B8"
              value={phoneOrEmail}
              onChangeText={setPhoneOrEmail}
              autoCapitalize="none"
              keyboardType="default"
              autoComplete="username"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.submit, loading && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%" },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(248,250,252,0.9)",
  },
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  back: { marginBottom: 24 },
  backText: { color: "#4F46E5", fontSize: 15 },
  title: { fontSize: 24, fontWeight: "700", color: "#0F172A", marginBottom: 4 },
  subtitle: { color: "#64748B", marginBottom: 20, fontSize: 14 },
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    color: "#0F172A",
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  errorText: { color: "#f87171", marginBottom: 8, fontSize: 14 },
  submit: {
    backgroundColor: "#10B981",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
