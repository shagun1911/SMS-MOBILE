import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useRegisterScreenRefresh } from "@/hooks/useRegisterScreenRefresh";
import { userNotificationSalaryParams } from "@/lib/staffPortalConfig";
import { useCrewLiveLocationShare } from "@/contexts/CrewLiveLocationContext";

type NotifItem = { id: string; read: boolean };

type NotifRow = {
  _id: string;
  title: string;
  message: string;
  createdAt: string;
};

function roleLabel(role: string) {
  if (role === "bus_driver") return "Bus driver";
  if (role === "conductor") return "Conductor";
  return role;
}

export default function CrewDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const liveShare = useCrewLiveLocationShare();
  const { height: windowHeight } = useWindowDimensions();
  const listMaxHeight = Math.min(380, Math.max(200, windowHeight * 0.5));

  const [notifItems, setNotifItems] = useState<NotifItem[]>([]);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [notifRows, setNotifRows] = useState<NotifRow[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const normalize = useCallback((list: any[]): NotifItem[] => {
    const out: NotifItem[] = [];
    for (const n of list) {
      const id = String(n._id ?? n.id ?? "");
      if (!id) continue;
      const read = n.isRead === true || n.read === true;
      out.push({ id, read });
    }
    return out;
  }, []);

  const mapRows = useCallback((list: any[]): NotifRow[] => {
    return list.map((n) => ({
      _id: String(n._id),
      title: String(n.title ?? "Salary"),
      message: String(n.message ?? ""),
      createdAt: String(n.createdAt ?? ""),
    }));
  }, []);

  const refreshBadge = useCallback(async () => {
    try {
      const res = await api.get("/user-notifications", { params: { type: "salary" } });
      const raw = res.data?.data ?? res.data ?? [];
      const list = Array.isArray(raw) ? raw : [];
      setNotifItems(normalize(list));
    } catch {
      setNotifItems([]);
    }
  }, [normalize]);

  const loadModalNotifications = useCallback(async () => {
    setNotifLoading(true);
    setNotifError(null);
    try {
      const res = await api.get("/user-notifications", { params: { type: "salary" } });
      const raw = res.data?.data ?? res.data ?? [];
      const list = Array.isArray(raw) ? raw : [];
      const unreadOnly = list.filter(
        (n: any) => !(n.isRead === true || n.read === true)
      );
      setNotifRows(mapRows(unreadOnly));
    } catch (e: any) {
      setNotifError(e?.response?.data?.message ?? "Could not load notifications.");
      setNotifRows([]);
    } finally {
      setNotifLoading(false);
    }
  }, [mapRows]);

  const openNotifModal = useCallback(() => {
    setNotifModalVisible(true);
    loadModalNotifications();
  }, [loadModalNotifications]);

  const closeNotifModal = useCallback(() => {
    setNotifModalVisible(false);
    refreshBadge();
  }, [refreshBadge]);

  const markAllRead = async () => {
    try {
      setMarkingAll(true);
      await api.patch("/user-notifications/read-all", {}, { params: userNotificationSalaryParams() });
      setNotifRows([]);
      await refreshBadge();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message ?? "Could not mark all as read.");
      await loadModalNotifications();
    } finally {
      setMarkingAll(false);
    }
  };

  const onTapNotification = async (id: string) => {
    try {
      await api.patch(`/user-notifications/${encodeURIComponent(id)}/read`);
      setNotifRows((prev) => prev.filter((r) => r._id !== id));
      await refreshBadge();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message ?? "Could not update notification.");
      await loadModalNotifications();
      await refreshBadge();
    }
  };

  useFocusEffect(
    useCallback(() => {
      refreshBadge();
    }, [refreshBadge])
  );

  useRegisterScreenRefresh(refreshBadge);

  const unreadSalaryCount = notifItems.filter((n) => !n.read).length;

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Not signed in.</Text>
      </View>
    );
  }

  return (
    <RefreshableScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SafeAreaView style={styles.header} edges={["top"]}>
        <View style={styles.headerRow}>
          <View style={styles.profilePill}>
            <Text style={styles.profileName} numberOfLines={1}>
              {user.name}
            </Text>
            <Text style={styles.profileRole} numberOfLines={1}>
              {roleLabel(user.role)}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={openNotifModal}
              activeOpacity={0.75}
            >
              <Text style={styles.iconButtonEmoji}>🔔</Text>
              {unreadSalaryCount > 0 ? (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadSalaryCount > 9 ? "9+" : String(unreadSalaryCount)}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutBtn} onPress={() => logout()} activeOpacity={0.85}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.section}>
        <Text style={styles.welcomeTitle}>Home</Text>
        <Text style={styles.welcomeSub}>
          Salary updates and payroll notifications for your account.
        </Text>

        {liveShare?.hasBusAssignment === false ? (
          <View style={styles.liveBannerNeutral}>
            <Text style={styles.liveBannerTitle}>Bus assignment</Text>
            <Text style={styles.liveBannerText}>
              You are not linked to a bus in the school transport list. Ask your admin to assign you as driver or
              conductor on a bus to enable live location sharing.
            </Text>
          </View>
        ) : null}
        {liveShare?.permission === "denied" ? (
          <View style={styles.liveBannerWarn}>
            <Text style={styles.liveBannerTitle}>Location off</Text>
            <Text style={styles.liveBannerText}>
              Enable location in system settings to share live bus position with students on your route.
            </Text>
          </View>
        ) : null}
        {liveShare?.sharing && liveShare.socketConnected ? (
          <View style={styles.liveBannerOk}>
            <Text style={styles.liveBannerTitle}>Live tracking on</Text>
            <Text style={styles.liveBannerText}>
              Your GPS is shared with students assigned to your bus (foreground and background when allowed).
            </Text>
          </View>
        ) : null}
        {liveShare?.lastError && liveShare.permission === "granted" ? (
          <Text style={styles.liveBannerError}>{liveShare.lastError}</Text>
        ) : null}

        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => router.push("/(crew)/salary")}
        >
          <Text style={styles.cardEmoji}>💵</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cardTitle}>Salary</Text>
            <Text style={styles.cardHint}>Disbursement history, status, and payments</Text>
          </View>
          <Text style={styles.cardChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => router.push("/(crew)/profile")}
        >
          <Text style={styles.cardEmoji}>👤</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cardTitle}>Profile</Text>
            <Text style={styles.cardHint}>Your details and password</Text>
          </View>
          <Text style={styles.cardChevron}>›</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={notifModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeNotifModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeNotifModal}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <TouchableOpacity onPress={closeNotifModal} hitSlop={14} accessibilityLabel="Close">
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.markAllBtn, (markingAll || notifRows.length === 0) && styles.markAllDisabled]}
              onPress={markAllRead}
              disabled={markingAll || notifRows.length === 0}
            >
              <Text style={styles.markAllText}>
                {markingAll ? "Updating…" : "Mark all as read"}
              </Text>
            </TouchableOpacity>

            {notifLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color="#c2410c" />
              </View>
            ) : notifError ? (
              <Text style={styles.modalErr}>{notifError}</Text>
            ) : notifRows.length === 0 ? (
              <Text style={styles.modalEmpty}>No salary notifications.</Text>
            ) : (
              <ScrollView
                style={{ maxHeight: listMaxHeight }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {notifRows.map((row) => (
                  <TouchableOpacity
                    key={row._id}
                    style={styles.notifRow}
                    activeOpacity={0.85}
                    onPress={() => onTapNotification(row._id)}
                  >
                    <Text style={styles.notifRowTitle}>{row.title}</Text>
                    <Text style={styles.notifRowMsg}>{row.message}</Text>
                    <Text style={styles.notifRowHint}>Tap to dismiss</Text>
                    {row.createdAt ? (
                      <Text style={styles.notifRowDate}>
                        {new Date(row.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  muted: { color: "#64748b" },
  header: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profilePill: {
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#ffedd5",
    marginRight: 8,
  },
  profileName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  profileRole: { fontSize: 12, color: "#9a3412", marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconButton: { padding: 6, position: "relative" },
  iconButtonEmoji: { fontSize: 20 },
  notifBadge: {
    position: "absolute",
    top: 1,
    right: 1,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  notifBadgeText: { fontSize: 9, fontWeight: "800", color: "#fff" },
  logoutBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#fee2e2",
  },
  logoutText: { color: "#b91c1c", fontWeight: "600", fontSize: 13 },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  welcomeTitle: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  welcomeSub: { fontSize: 14, color: "#64748b", marginTop: 6, marginBottom: 16 },
  liveBannerOk: {
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  liveBannerWarn: {
    backgroundColor: "#fff7ed",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  liveBannerNeutral: {
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  liveBannerTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  liveBannerText: { fontSize: 13, color: "#475569", lineHeight: 18 },
  liveBannerError: { fontSize: 12, color: "#b91c1c", marginBottom: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  cardEmoji: { fontSize: 28 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  cardHint: { fontSize: 13, color: "#64748b", marginTop: 4 },
  cardChevron: { fontSize: 22, color: "#94a3b8", fontWeight: "300" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  modalClose: { fontSize: 22, color: "#64748b", padding: 4 },
  markAllBtn: { alignSelf: "flex-end", marginBottom: 12, paddingVertical: 6 },
  markAllDisabled: { opacity: 0.45 },
  markAllText: { fontSize: 14, fontWeight: "600", color: "#c2410c" },
  modalLoading: { paddingVertical: 28, alignItems: "center" },
  modalErr: { color: "#b91c1c", fontSize: 14, paddingVertical: 12 },
  modalEmpty: { color: "#64748b", fontSize: 14, paddingVertical: 16, textAlign: "center" },
  notifRow: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  notifRowTitle: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  notifRowMsg: { fontSize: 14, color: "#475569", marginTop: 6 },
  notifRowHint: { fontSize: 12, color: "#c2410c", marginTop: 8, fontWeight: "500" },
  notifRowDate: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
});
