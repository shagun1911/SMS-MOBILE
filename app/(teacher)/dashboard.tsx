import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
} from "react-native";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

export default function TeacherDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const [classes, setClasses] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);

  type SalaryNotification = {
    id: string;
    month: string;
    year: number;
    amount: number;
    paymentDate: string;
    read: boolean;
  };

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [notifItems, setNotifItems] = useState<SalaryNotification[]>([]);

  useEffect(() => {
    (async () => {
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
        // ignore list errors for dashboard
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load salary notifications on mount (for badge + unread state)
  useEffect(() => {
    (async () => {
      try {
        setNotifLoading(true);
        setNotifError(null);
        const res = await api.get("/salaries/my/history");
        const data = res.data?.data ?? res.data ?? [];
        const list = Array.isArray(data) ? data : [];

        let seenIds: string[] = [];
        if (typeof window !== "undefined") {
          try {
            const raw = window.localStorage.getItem(
              "teacherSalarySeenNotificationIds"
            );
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                seenIds = parsed.filter((x) => typeof x === "string");
              }
            }
          } catch {
            // ignore storage errors
          }
        }

        const flattened: SalaryNotification[] = list.flatMap(
          (r: any) =>
            (r.paymentHistory ?? []).map((h: any, idx: number) => {
              const id = `${r._id}-${idx}-${h.paymentDate}`;
              return {
                id,
                month: r.month,
                year: r.year,
                amount: h.amount,
                paymentDate: h.paymentDate,
                read: seenIds.includes(id),
              } as SalaryNotification;
            })
        );

        flattened.sort(
          (a, b) =>
            new Date(b.paymentDate).getTime() -
            new Date(a.paymentDate).getTime()
        );

        setNotifItems(flattened.slice(0, 20));
      } catch (e: any) {
        setNotifError(
          e?.response?.data?.message ?? "Unable to load salary notifications."
        );
      } finally {
        setNotifLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/schools/me");
        const data = res.data?.data ?? res.data;
        if (cancelled) return;
        if (data?.logo) setSchoolLogo(data.logo);
        if (data?.name) setSchoolName(data.name);
      } catch {
        // ignore logo/school name errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingHomework = useMemo(
    () => homework.filter((h: any) => !h.isCompleted),
    [homework]
  );

  const featureCards = [
    { icon: "👥", title: "My Classes", route: "/(teacher)/classes", accent: "#4f46e5", bg: "#eef2ff" },
    { icon: "📚", title: "Homework", route: "/(teacher)/homework", accent: "#16a34a", bg: "#f0fdf4" },
    { icon: "📊", title: "Enter Marks", route: "/(teacher)/marks", accent: "#0891b2", bg: "#ecfeff" },
    { icon: "💵", title: "Salary", route: "/(teacher)/salary", accent: "#16a34a", bg: "#ecfdf3" },
    { icon: "📅", title: "Timetable", route: "/(teacher)/timetable", accent: "#d97706", bg: "#fffbeb" },
    { icon: "🚌", title: "Buses", route: "/(teacher)/bus-routes", accent: "#0ea5e9", bg: "#e0f2fe" },
    { icon: "👤", title: "Profile", route: "/(teacher)/profile", accent: "#7c3aed", bg: "#f5f3ff" },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header – same visual style as student dashboard */}
      <View style={styles.header}>
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
            {!!notifItems.filter((n) => !n.read).length && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {Math.min(9, notifItems.filter((n) => !n.read).length)}
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
              Latest updates about your salary.
            </Text>

            {!!notifItems.filter((n) => !n.read).length && (
              <TouchableOpacity
                style={styles.markAllButton}
                onPress={() => {
                  setNotifItems((items) =>
                    items.map((n) => ({ ...n, read: true }))
                  );
                  if (typeof window !== "undefined") {
                    try {
                      const allIds = notifItems.map((n) => n.id);
                      window.localStorage.setItem(
                        "teacherSalarySeenNotificationIds",
                        JSON.stringify(allIds)
                      );
                    } catch {
                      // ignore storage errors
                    }
                  }
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
                <Text style={styles.modalEmpty}>No salary updates yet.</Text>
              </View>
            ) : (
              notifItems.map((n) => {
                const dt = new Date(n.paymentDate);
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
                    style={[
                      styles.notifItem,
                      !n.read && styles.notifItemUnread,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setNotifItems((items) => {
                        const next = items.map((it) =>
                          it.id === n.id ? { ...it, read: true } : it
                        );
                        if (typeof window !== "undefined") {
                          try {
                            const seen = next
                              .filter((it) => it.read)
                              .map((it) => it.id);
                            window.localStorage.setItem(
                              "teacherSalarySeenNotificationIds",
                              JSON.stringify(seen)
                            );
                          } catch {
                            // ignore
                          }
                        }
                        return next;
                      });
                    }}
                  >
                    <Text
                      style={[
                        styles.notifText,
                        !n.read && styles.notifTextUnread,
                      ]}
                    >
                      ₹{Number(n.amount).toLocaleString("en-IN", {
                        maximumFractionDigits: 0,
                      })}{" "}
                      of your salary for {n.month} {n.year} has been
                      transferred.
                    </Text>
                    <Text style={styles.notifMeta}>
                      {dateStr} · {timeStr}
                    </Text>
                    {!n.read && (
                      <Text style={styles.unreadLabel}>Unread</Text>
                    )}
                  </TouchableOpacity>
                );
              })
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

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { paddingBottom: 40, flexGrow: 1 },

  /* Header – same visual style as student dashboard */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
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

  /* Feature cards grid – use minHeight so cards render on native Android */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 24,
    alignContent: "flex-start",
  },
  card: {
    width: "47%",
    minWidth: "47%",
    minHeight: 120,
    borderRadius: 20,
    paddingVertical: 36,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
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
    borderRadius: 20,
    backgroundColor: "#ffffff",
    paddingVertical: 18,
    paddingHorizontal: 16,
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
  modalEmpty: { fontSize: 12, color: "#6b7280", textAlign: "center" },
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
