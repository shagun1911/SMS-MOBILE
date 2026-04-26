import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useRegisterScreenRefresh } from "@/hooks/useRegisterScreenRefresh";

export default function TeacherDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { height: windowHeight } = useWindowDimensions();
  const notifListMaxHeight = Math.min(460, Math.max(220, windowHeight * 0.52));

  const [classes, setClasses] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);

  type TeacherNotification = {
    id: string;
    title: string;
    message: string;
    createdAt: string;
    type: string;
    read: boolean;
  };

  /** IDs marked read in-session so the bell badge stays cleared if a refetch races ahead of PATCH. */
  const optimisticReadIdsRef = useRef<Set<string>>(new Set());

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [notifItems, setNotifItems] = useState<TeacherNotification[]>([]);

  const normalizeNotifications = useCallback((list: any[], seenIds: Set<string>): TeacherNotification[] => {
    const out: TeacherNotification[] = [];
    for (const n of list) {
      const id = String(n._id ?? n.id ?? "");
      if (!id) continue;
      const serverRead = n.isRead === true || n.read === true || seenIds.has(id);
      if (serverRead) optimisticReadIdsRef.current.delete(id);
      const read = serverRead || optimisticReadIdsRef.current.has(id);
      out.push({
        id,
        title: String(n.title ?? "Notification"),
        message: String(n.message ?? ""),
        createdAt: String(n.createdAt ?? new Date().toISOString()),
        type: String(n.type ?? "general"),
        read,
      });
    }
    return out;
  }, []);

  const persistSeenIds = useCallback(async (ids: string[]) => {
    if (!user?._id) return;
    try {
      const key = `sms_staff_notif_seen_${user._id}`;
      await AsyncStorage.setItem(key, JSON.stringify(ids));
      await api.patch("/user-notifications/sync-seen", { seenIds: ids }).catch(() => {});
    } catch {}
  }, [user?._id]);

  const loadDashboard = useCallback(async () => {
    try {
      const [cRes, hRes, eRes] = await Promise.all([
        api.get("/classes"),
        api.get("/homework"),
        api.get("/exams"),
      ]);
      setClasses(cRes.data.data ?? []);
      setHomework(hRes.data.data ?? []);
      setExams(eRes.data.data ?? []);
    } catch {
      // keep prior lists
    }

    try {
      setNotifLoading(true);
      setNotifError(null);
      const [nRes, meRes, storedRaw] = await Promise.all([
        api.get("/user-notifications"),
        api.get("/auth/me").catch(() => null),
        user?._id ? AsyncStorage.getItem(`sms_staff_notif_seen_${user._id}`) : Promise.resolve(null)
      ]);
      const data = nRes.data?.data ?? nRes.data ?? [];
      const list = Array.isArray(data) ? data : [];
      
      const serverSeenIds = meRes?.data?.data?.seenNotificationIds ?? meRes?.data?.seenNotificationIds ?? [];
      let localSeenIds: string[] = [];
      if (storedRaw) {
        try { localSeenIds = JSON.parse(storedRaw); } catch { localSeenIds = []; }
      }

      const mergedSeen = new Set<string>([...serverSeenIds, ...localSeenIds]);
      setNotifItems(normalizeNotifications(list, mergedSeen).slice(0, 50));

      if (localSeenIds.some(id => !serverSeenIds.includes(id))) {
        api.patch("/user-notifications/sync-seen", { seenIds: Array.from(mergedSeen) }).catch(() => {});
      }
    } catch (e: any) {
      setNotifError(e?.response?.data?.message ?? "Unable to load notifications.");
    } finally {
      setNotifLoading(false);
    }

    try {
      const res = await api.get("/schools/me");
      const data = res.data?.data ?? res.data;
      if (data?.logo) setSchoolLogo(data.logo);
      if (data?.name) setSchoolName(data.name);
    } catch {
      // keep prior school branding
    }
  }, [normalizeNotifications]);

  const unreadNotifCount = useMemo(
    () => notifItems.filter((n) => !n.read).length,
    [notifItems]
  );

  /** Modal lists only unread items; read ones disappear after tap or “mark all”. */
  const unreadNotifItems = useMemo(
    () => notifItems.filter((n) => !n.read),
    [notifItems]
  );

  const teacherId = user?._id;
  useEffect(() => {
    optimisticReadIdsRef.current.clear();
  }, [teacherId]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadDashboard();
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [loadDashboard]);

  const pullReload = useCallback(async () => {
    try {
      await loadDashboard();
    } catch {
    }
  }, [loadDashboard]);
  useRegisterScreenRefresh(pullReload);

  const pendingHomework = useMemo(
    () => homework.filter((h: any) => !h.isCompleted),
    [homework]
  );

  const featureCards = [
    { icon: "👥", title: "My Classes", route: "/(teacher)/classes", accent: "#4f46e5", bg: "#eef2ff" },
    { icon: "📋", title: "Attendance", route: "/(teacher)/attendance", accent: "#db2777", bg: "#fdf2f8" },
    { icon: "📚", title: "Homework", route: "/(teacher)/homework", accent: "#16a34a", bg: "#f0fdf4" },
    { icon: "📊", title: "Enter Marks", route: "/(teacher)/marks", accent: "#0891b2", bg: "#ecfeff" },
    { icon: "🗓️", title: "My Attendance", route: "/(teacher)/my-attendance", accent: "#16a34a", bg: "#ecfdf3" },
    { icon: "💵", title: "Salary", route: "/(teacher)/salary", accent: "#16a34a", bg: "#ecfdf3" },
    { icon: "📅", title: "Timetable", route: "/(teacher)/timetable", accent: "#d97706", bg: "#fffbeb" },
    { icon: "🚌", title: "Buses", route: "/(teacher)/bus-routes", accent: "#0ea5e9", bg: "#e0f2fe" },
    { icon: "👤", title: "Profile", route: "/(teacher)/profile", accent: "#7c3aed", bg: "#f5f3ff" },
  ];

  return (
    <RefreshableScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header (safe area) */}
      <SafeAreaView style={styles.header} edges={["top"]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {schoolLogo ? (
              <Image source={{ uri: schoolLogo }} style={styles.logo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>
                  {schoolName?.charAt(0) ?? "S"}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeText} numberOfLines={1}>
                Welcome, {user?.name ?? "Teacher"}!
              </Text>
              <Text style={styles.subText} numberOfLines={1}>
                Teacher · {schoolName ?? "School"}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                setNotifOpen(true);
              }}
            >
              <Text style={styles.iconButtonEmoji}>🔔</Text>
              {unreadNotifCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {Math.min(9, unreadNotifCount)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => {
                logout();
                router.replace("/");
              }}
            >
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Notification modal */}
      <Modal
        visible={notifOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNotifOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setNotifOpen(false)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Notifications</Text>
            <Text style={styles.modalSubtitle}>
              Unread account and attendance updates.
            </Text>

            {unreadNotifCount > 0 && (
              <TouchableOpacity
                style={styles.markAllButton}
                onPress={() => {
                  const updated = notifItems.map((n) => {
                    if (!n.read) optimisticReadIdsRef.current.add(n.id);
                    return { ...n, read: true };
                  });
                  setNotifItems(updated);
                  persistSeenIds(updated.map((x) => x.id));
                  api.patch("/user-notifications/read-all").catch(() => {});
                }}
              >
                <Text style={styles.markAllText}>Mark all as read</Text>
              </TouchableOpacity>
            )}

            {notifLoading ? (
              <View style={styles.modalCenter}>
                <ActivityIndicator size="small" color="#16a34a" />
                <Text style={styles.modalCenterText}>Loading…</Text>
              </View>
            ) : notifError ? (
              <View style={styles.modalCenter}>
                <Text style={styles.modalError}>{notifError}</Text>
              </View>
            ) : !notifItems.length ? (
              <View style={styles.modalCenter}>
                <Text style={styles.modalEmpty}>No unread notifications.</Text>
              </View>
            ) : unreadNotifItems.length === 0 ? (
              <View style={styles.modalCenter}>
                <Text style={styles.modalEmpty}>You&apos;re all caught up.</Text>
                <Text style={styles.modalEmptySub}>No unread notifications.</Text>
              </View>
            ) : (
              <ScrollView
                style={[styles.notifScroll, { maxHeight: notifListMaxHeight }]}
                contentContainerStyle={styles.notifScrollContent}
                showsVerticalScrollIndicator
                scrollIndicatorInsets={{ right: 2 }}
                persistentScrollbar={Platform.OS === "android"}
                indicatorStyle={Platform.OS === "ios" ? "black" : undefined}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              >
                {unreadNotifItems.map((n) => {
                  const dt = new Date(n.createdAt);
                  const dateStr = dt.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });
                  const timeStr = dt.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[styles.notifItem, styles.notifItemUnread]}
                      activeOpacity={0.8}
                      onPress={() => {
                        optimisticReadIdsRef.current.add(n.id);
                        const updated = notifItems.map((it) =>
                          it.id === n.id ? { ...it, read: true } : it
                        );
                        setNotifItems(updated);
                        persistSeenIds(
                          updated.filter((x) => x.read).map((x) => x.id)
                        );
                        api
                          .patch(`/user-notifications/${n.id}/read`)
                          .catch(() => {});
                      }}
                    >
                      <Text style={[styles.notifText, styles.notifTextUnread]}>
                        {n.title}
                      </Text>
                      {!!n.message && <Text style={styles.notifBody}>{n.message}</Text>}
                      <Text style={styles.notifMeta}>
                        {dateStr} · {timeStr}
                      </Text>
                      <Text style={styles.unreadLabel}>Tap to mark as read</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Stats strip – like student dashboard tiles */}
      <View style={styles.statsStrip}>
        <View style={[styles.statChip, styles.statChipPurple]}>
          <Text style={styles.statChipValue}>
            {loading ? "—" : classes.length}
          </Text>
          <Text style={styles.statChipLabel}>Classes{"\n"}Assigned</Text>
        </View>
        <View style={[styles.statChip, styles.statChipGreen]}>
          <Text style={styles.statChipValue}>
            {loading ? "—" : pendingHomework.length}
          </Text>
          <Text style={styles.statChipLabel}>Homework{"\n"}Pending</Text>
        </View>
        <View style={[styles.statChip, styles.statChipCyan]}>
          <Text style={styles.statChipValue}>
            {loading ? "—" : exams.length}
          </Text>
          <Text style={styles.statChipLabel}>Exams{"\n"}Scheduled</Text>
        </View>
        <View style={[styles.statChip, styles.statChipAmber]}>
          <Text style={styles.statChipValue}>—</Text>
          <Text style={styles.statChipLabel}>Timetable{"\n"}Slots</Text>
        </View>
      </View>

      {/* Feature cards grid – identical layout to student */}
      <View style={styles.grid}>
        {featureCards.map((c) => (
          <TouchableOpacity
            key={c.title}
            style={[styles.card, { backgroundColor: c.bg }]}
            activeOpacity={0.75}
            onPress={() => router.push(c.route as any)}
          >
            <Text style={styles.cardIcon}>{c.icon}</Text>
            <Text style={[styles.cardTitle, { color: c.accent }]}>{c.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { paddingBottom: 40, flexGrow: 1 },

  /* Header */
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
    backgroundColor: "#fff",
    gap: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  logoPlaceholderText: { fontSize: 18, fontWeight: "700", color: "#4f46e5" },
  welcomeText: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  subText: { fontSize: 11, color: "#64748b", marginTop: 1 },

  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
    position: "relative",
  },
  iconButtonEmoji: { fontSize: 16 },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  logoutText: { fontSize: 12, fontWeight: "600", color: "#b91c1c" },

  /* Stats strip */
  statsStrip: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
  },
  statChip: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: "center",
    borderWidth: 1,
  },
  statChipPurple: { backgroundColor: "#eef2ff", borderColor: "#c7d2fe" },
  statChipGreen: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  statChipCyan: { backgroundColor: "#ecfeff", borderColor: "#a5f3fc" },
  statChipAmber: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  statChipValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  statChipLabel: {
    fontSize: 10,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 14,
  },

  /* Feature cards grid – 2 per row on phone */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 24,
    alignContent: "flex-start",
    justifyContent: "space-between",
  },
  card: {
    width: "48%",
    minHeight: 120,
    borderRadius: 20,
    paddingVertical: 36,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardIcon: { fontSize: 40 },
  cardTitle: { fontSize: 16, fontWeight: "700", textAlign: "center" },

  /* Notification modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "85%",
    borderRadius: 20,
    backgroundColor: "#ffffff",
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  notifScroll: {
    marginHorizontal: -4,
  },
  notifScrollContent: {
    paddingBottom: 8,
    flexGrow: 0,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 10,
  },
  modalCenter: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCenterText: {
    marginTop: 6,
    fontSize: 12,
    color: "#6b7280",
  },
  modalError: { fontSize: 12, color: "#b91c1c", textAlign: "center" },
  modalEmpty: { fontSize: 13, color: "#475569", textAlign: "center", fontWeight: "600" },
  modalEmptySub: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 6,
  },
  markAllButton: {
    alignSelf: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#e0f2fe",
    marginBottom: 6,
  },
  markAllText: { fontSize: 11, color: "#0369a1", fontWeight: "600" },
  notifItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  notifItemUnread: {
    backgroundColor: "#eff6ff",
  },
  notifText: { fontSize: 13, color: "#0f172a" },
  notifTextUnread: { color: "#0f172a", fontWeight: "600" },
  notifBody: { fontSize: 12, color: "#334155", marginTop: 2 },
  notifMeta: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  unreadLabel: {
    marginTop: 2,
    fontSize: 10,
    color: "#1d4ed8",
    fontWeight: "600",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },

  /* (no extra list styles needed on teacher dashboard now) */
});
