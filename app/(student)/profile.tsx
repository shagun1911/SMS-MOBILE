import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import studentApi from "@/lib/studentApi";
import { useStudentAuthStore } from "@/store/studentAuthStore";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useRegisterScreenRefresh } from "@/hooks/useRegisterScreenRefresh";

export default function StudentProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ changePassword?: string }>();
  const forceChange = params.changePassword === "1";
  const { student, clearMustChange } = useStudentAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showChangePw, setShowChangePw] = useState(forceChange);
  const [currentPw, setCurrentPw] = useState("");
  const [newUsername, setNewUsername] = useState(student?.username || student?.firstName || "");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (forceChange) setShowChangePw(true);
  }, [forceChange]);

  const loadProfile = useCallback(async () => {
    const res = await studentApi.get("/auth/student/me");
    setProfile(res.data.data);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadProfile();
      } catch (_) {
      } finally {
        setLoading(false);
      }
    })();
  }, [loadProfile]);

  const pullReload = useCallback(async () => {
    try {
      await loadProfile();
    } catch (_) {}
  }, [loadProfile]);
  useRegisterScreenRefresh(pullReload);

  const handleUpdateCredentials = async () => {
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
      await studentApi.post("/auth/student/update-credentials", {
        currentPassword: currentPw,
        newUsername: newUsername.trim() || student?.firstName,
        newPassword: newPw,
      });
      clearMustChange();
      setShowChangePw(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setMessage("Credentials updated.");
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Failed to update credentials");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  const data = profile || student;

  return (
    <RefreshableScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.name}>
          {data?.firstName} {data?.lastName}
        </Text>
        <Text style={styles.role}>Student profile</Text>
      </View>

      {forceChange && (
        <View style={styles.alert}>
          <Text style={styles.alertTitle}>Complete your profile</Text>
          <Text style={styles.alertText}>
            Please set a new username and password for your account (required on first login).
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Personal information</Text>
        <Row label="Full name" value={`${data?.firstName} ${data?.lastName}`} />
        <Row label="Username" value={data?.username || data?.firstName} />
        <Row label="Admission number" value={data?.admissionNumber} />
        <Row label="Class" value={`${data?.class} — Section ${data?.section}`} />
        <Row label="Roll number" value={data?.rollNumber || "—"} />
        <Row label="Father's name" value={data?.fatherName || "—"} />
        <Row label="Mother's name" value={data?.motherName || "—"} />
        <Row
          label="Date of birth"
          value={data?.dateOfBirth ? new Date(data.dateOfBirth).toLocaleDateString() : "—"}
        />
        <Row label="Phone" value={data?.phone || "—"} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Change password</Text>
          {!showChangePw && (
            <TouchableOpacity onPress={() => setShowChangePw(true)}>
              <Text style={styles.link}>Change</Text>
            </TouchableOpacity>
          )}
        </View>
        {showChangePw ? (
          <>
            <Text style={styles.label}>New username</Text>
            <TextInput
              style={styles.input}
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder="Username"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.label}>Current password</Text>
            <TextInput
              style={styles.input}
              value={currentPw}
              onChangeText={setCurrentPw}
              placeholder="Current password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
            />
            <Text style={styles.label}>New password</Text>
            <TextInput
              style={styles.input}
              value={newPw}
              onChangeText={setNewPw}
              placeholder="New password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
            />
            <Text style={styles.label}>Confirm new password</Text>
            <TextInput
              style={styles.input}
              value={confirmPw}
              onChangeText={setConfirmPw}
              placeholder="Confirm"
              placeholderTextColor="#94a3b8"
              secureTextEntry
            />
            {message ? <Text style={styles.error}>{message}</Text> : null}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitDisabled]}
              onPress={handleUpdateCredentials}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Save credentials</Text>
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

      
    </RefreshableScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { marginBottom: 20 },
  name: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  role: { fontSize: 14, color: "#64748b", marginTop: 4 },
  alert: {
    backgroundColor: "#fef3c7",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  alertTitle: { fontWeight: "600", color: "#92400e" },
  alertText: { fontSize: 14, color: "#b45309", marginTop: 4 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontWeight: "600", color: "#0f172a", marginBottom: 12 },
  row: { marginBottom: 12 },
  rowLabel: { fontSize: 12, color: "#64748b" },
  rowValue: { fontSize: 15, color: "#0f172a", marginTop: 2 },
  link: { color: "#4f46e5", fontWeight: "500" },
  label: { fontSize: 13, fontWeight: "500", color: "#475569", marginBottom: 6 },
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
  submitBtn: { backgroundColor: "#4f46e5", padding: 14, borderRadius: 10, alignItems: "center", marginTop: 4 },
  submitDisabled: { opacity: 0.7 },
  submitBtnText: { color: "#fff", fontWeight: "600" },
  cancelBtn: { marginTop: 12, alignItems: "center" },
  cancelText: { color: "#64748b" },
  muted: { fontSize: 14, color: "#64748b" },
  logoutBtn: {
    backgroundColor: "#fef2f2",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  logoutText: { color: "#dc2626", fontWeight: "600" },
});
