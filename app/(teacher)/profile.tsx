import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function TeacherProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ changePassword?: string }>();
  const forceChange = params.changePassword === "1";
  const { user, clearMustChangePassword } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showChangePw, setShowChangePw] = useState(forceChange);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (forceChange) setShowChangePw(true);
  }, [forceChange]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/auth/me");
        setProfile(res.data.data);
      } catch (_) {}
      finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      setMessage("New passwords do not match");
      return;
    }
    if (newPw.length < 6) {
      setMessage("Password must be at least 6 characters");
      return;
    }
    setMessage("");
    setSubmitting(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: currentPw,
        newPassword: newPw,
      });
      clearMustChangePassword();
      setShowChangePw(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setMessage("Password updated.");
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      </SafeAreaView>
    );
  }

  const data = profile || user;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>My Profile</Text>

        {forceChange && (
          <View style={styles.alert}>
            <Text style={styles.alertTitle}>Change your password</Text>
            <Text style={styles.alertText}>
              Your password was set by the admin. Please change it for security.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          <Text style={styles.rowLabel}>Name</Text>
          <Text style={styles.rowValue}>{data?.name ?? "—"}</Text>
          <Text style={styles.rowLabel}>Email</Text>
          <Text style={styles.rowValue}>{data?.email ?? "—"}</Text>
          <Text style={styles.rowLabel}>Role</Text>
          <Text style={styles.rowValue}>{(data?.role ?? "").replace("_", " ")}</Text>
          <Text style={styles.rowLabel}>Joining Date</Text>
          <Text style={styles.rowValue}>
            {data?.joiningDate
              ? new Date(data.joiningDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Change Password</Text>
            {!showChangePw && (
              <TouchableOpacity onPress={() => setShowChangePw(true)}>
                <Text style={styles.link}>Change</Text>
              </TouchableOpacity>
            )}
          </View>
          {showChangePw ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Current password"
                placeholderTextColor="#94a3b8"
                value={currentPw}
                onChangeText={setCurrentPw}
                secureTextEntry
              />
              <TextInput
                style={styles.input}
                placeholder="New password"
                placeholderTextColor="#94a3b8"
                value={newPw}
                onChangeText={setNewPw}
                secureTextEntry
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor="#94a3b8"
                value={confirmPw}
                onChangeText={setConfirmPw}
                secureTextEntry
              />
              {message ? <Text style={styles.error}>{message}</Text> : null}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitDisabled]}
                onPress={handleChangePassword}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Password</Text>
                )}
              </TouchableOpacity>
              {!forceChange && (
                <TouchableOpacity onPress={() => setShowChangePw(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Text style={styles.muted}>Your password is set. Click "Change" to update it.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginBottom: 16 },
  alert: { backgroundColor: "#fef3c7", borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#f59e0b" },
  alertTitle: { fontWeight: "600", color: "#92400e" },
  alertText: { fontSize: 14, color: "#b45309", marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontWeight: "600", color: "#0f172a", marginBottom: 12 },
  rowLabel: { fontSize: 12, color: "#64748b", marginTop: 8 },
  rowValue: { fontSize: 16, color: "#0f172a", marginBottom: 4 },
  link: { color: "#059669", fontWeight: "500" },
  input: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    color: "#0f172a",
  },
  error: { color: "#dc2626", fontSize: 14, marginBottom: 8 },
  submitBtn: { backgroundColor: "#059669", padding: 14, borderRadius: 10, alignItems: "center", marginTop: 4 },
  submitDisabled: { opacity: 0.7 },
  submitBtnText: { color: "#fff", fontWeight: "600" },
  cancelBtn: { marginTop: 12, alignItems: "center" },
  cancelText: { color: "#64748b" },
  muted: { fontSize: 14, color: "#64748b" },
  logoutBtn: { backgroundColor: "#fef2f2", padding: 16, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#fecaca" },
  logoutText: { color: "#dc2626", fontWeight: "600" },
});
