import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { isSupportStaffRole } from "@/lib/supportStaffRoles";

function roleLabel(role: string) {
  if (role === "accountant") return "Accountant";
  if (role === "cleaning_staff") return "Cleaning staff";
  if (role === "staff_other") return "Other staff";
  return role;
}

export default function SupportProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await api.get("/auth/me");
        const u = res.data?.data ?? res.data;
        if (u) {
          setName(u.name ?? "");
          setEmail(u.email ?? "");
          setPhone(u.phone ?? "");
          setUsername(u.username ?? "");
          if (!isSupportStaffRole(u.role)) {
            setError("This account is not authorized in this app.");
          }
        }
      } catch (e: any) {
        setError(e?.response?.data?.message ?? "Unable to load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill all password fields.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    try {
      setPwdSaving(true);
      setError(null);
      await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Success", "Your password was updated.");
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Unable to change password.");
    } finally {
      setPwdSaving(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Not logged in.</Text>
      </View>
    );
  }

  return (
    <RefreshableScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SafeAreaView style={styles.header} edges={["top"]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 60 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#c2410c" />
        </View>
      ) : (
        <View style={styles.body}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.sectionTitle}>Your details</Text>
          <Text style={styles.hint}>
            Contact your school admin to change name or phone. You can update your password below.
          </Text>

          <Text style={styles.label}>Full name</Text>
          <Text style={styles.readonly}>{name || "—"}</Text>

          <Text style={styles.label}>Role</Text>
          <Text style={styles.readonly}>{roleLabel(user.role)}</Text>

          <Text style={styles.label}>Login (mobile)</Text>
          <Text style={styles.readonly}>{username || phone || "—"}</Text>

          <Text style={styles.label}>Phone</Text>
          <Text style={styles.readonly}>{phone || "—"}</Text>

          <Text style={styles.label}>Email</Text>
          <Text style={styles.readonly}>{email || "—"}</Text>

          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Change password</Text>
          <Text style={styles.label}>Current password</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Current password"
            secureTextEntry
          />
          <Text style={styles.label}>New password</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 6 characters"
            secureTextEntry
          />
          <Text style={styles.label}>Confirm new password</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.primaryBtn, pwdSaving && { opacity: 0.7 }]}
            onPress={handleChangePassword}
            disabled={pwdSaving}
          >
            <Text style={styles.primaryBtnText}>
              {pwdSaving ? "Updating…" : "Update password"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { paddingBottom: 40 },
  header: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  backText: { fontSize: 14, color: "#c2410c" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  center: { paddingVertical: 40, alignItems: "center" },
  muted: { color: "#64748b" },
  body: { paddingHorizontal: 16, paddingTop: 16 },
  error: { color: "#b91c1c", fontSize: 14, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a", marginBottom: 6 },
  hint: { fontSize: 13, color: "#64748b", marginBottom: 12 },
  label: { fontSize: 12, color: "#6b7280", marginTop: 12, marginBottom: 4 },
  readonly: {
    fontSize: 15,
    color: "#111827",
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    overflow: "hidden",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  primaryBtn: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "#c2410c",
    alignItems: "center",
  },
  primaryBtnText: { fontSize: 15, fontWeight: "600", color: "#ffffff" },
});
