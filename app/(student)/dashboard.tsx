import { useRouter } from "expo-router";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Modal,
  FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStudentAuthStore } from "@/store/studentAuthStore";
import studentApi from "@/lib/studentApi";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useRegisterScreenRefresh } from "@/hooks/useRegisterScreenRefresh";

function seenStorageKey(studentId: string) {
  return `sms_student_notif_seen_${studentId}`;
}

function formatDate(d: string | Date) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function formatAmount(n: number) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

type NotifSource = "inbox" | "fee" | "homework" | "marks";

// ── Notification type ─────────────────────────────────────────────────────────
type NotifDraft = {
  id: string;
  source: NotifSource;
  /** Mongo _id for PATCH /student-notifications/:id/read */
  inboxMongoId?: string;
  category: "fee" | "homework" | "marks" | "attendance" | "school";
  icon: string;
  title: string;
  subtitle: string;
  date: string;
  accentColor: string;
  bgColor: string;
};

type Notif = NotifDraft & { read: boolean };

// ── Build notifications from raw API data ─────────────────────────────────────
function mapStudentInboxRows(raw: any[]): NotifDraft[] {
  const list: NotifDraft[] = [];
  for (const n of raw) {
    const id = String(n?._id ?? "");
    if (!id) continue;
    const t = String(n?.type ?? "general");
    const isAbsent = t === "attendance_absent";
    list.push({
      id: `inbox-${id}`,
      source: "inbox",
      inboxMongoId: id,
      category: isAbsent ? "attendance" : "school",
      icon: isAbsent ? "📋" : "📣",
      title: String(n?.title ?? "Notification"),
      subtitle: String(n?.message ?? ""),
      date: String(n?.createdAt ?? new Date().toISOString()),
      accentColor: isAbsent ? "#db2777" : "#6366f1",
      bgColor: isAbsent ? "#fdf2f8" : "#eef2ff",
    });
  }
  return list;
}

function buildNotifications(
  fees: any,
  homework: any[],
  results: any[],
  studentInbox: any[] = []
): NotifDraft[] {
  const list: NotifDraft[] = [];

  const ledgerEntries: any[] = fees?.payments ?? [];
  for (const entry of ledgerEntries) {
    const monthLabel =
      (entry.month || "").toLowerCase() === "one-time"
        ? "Admission (One-Time)"
        : entry.month ?? "Fee";
    for (const p of entry.payments ?? []) {
      const id = String(p._id ?? `${entry._id}-${p.paymentDate}`);
      list.push({
        id: `fee-${id}`,
        source: "fee",
        category: "fee",
        icon: "💰",
        title: `${monthLabel} fee deposited`,
        subtitle: `${formatAmount(p.amount ?? 0)} · ${p.paymentMode ?? ""}`,
        date: p.paymentDate ?? new Date().toISOString(),
        accentColor: "#16a34a",
        bgColor: "#f0fdf4",
      });
    }
  }

  for (const hw of homework) {
    list.push({
      id: `hw-${hw._id}`,
      source: "homework",
      category: "homework",
      icon: "📚",
      title: `Homework assigned: ${hw.title ?? ""}`,
      subtitle: `${hw.subject ?? ""} · Due ${formatDate(hw.dueDate)}`,
      date: hw.assignedDate ?? hw.createdAt ?? hw.dueDate ?? new Date().toISOString(),
      accentColor: "#4f46e5",
      bgColor: "#eef2ff",
    });
  }

  for (const r of results) {
    const examName = r.examName ?? r.exam?.name ?? "Exam";
    const subject = r.subject ?? r.subjectName ?? "";
    const marks = r.marksObtained ?? r.marks ?? "";
    list.push({
      id: `result-${r._id}`,
      source: "marks",
      category: "marks",
      icon: "📊",
      title: `Result published: ${examName}`,
      subtitle: subject ? `${subject} · Marks: ${marks}` : `Marks: ${marks}`,
      date: r.publishedAt ?? r.createdAt ?? new Date().toISOString(),
      accentColor: "#0891b2",
      bgColor: "#ecfeff",
    });
  }

  list.push(...mapStudentInboxRows(studentInbox));

  list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return list;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function StudentDashboard() {
  const router = useRouter();
  const { student, logout } = useStudentAuthStore();

  const [fees, setFees] = useState<any>(null);
  const [homework, setHomework] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [studentInbox, setStudentInbox] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);

  const [showNotifs, setShowNotifs] = useState(false);
  /** Local "read" state for fee / homework / marks rows (not stored on server). */
  const [seenSyntheticIds, setSeenSyntheticIds] = useState<Set<string>>(new Set());
  const optimisticInboxReadIdsRef = useRef<Set<string>>(new Set());

  const loadDashboard = useCallback(async () => {
    const sid = student?._id;
    const storageKey = sid ? seenStorageKey(sid) : null;
    try {
      const [fRes, hRes, rRes, nRes, storedRaw] = await Promise.all([
        studentApi.get("/fees/student/me"),
        studentApi.get("/homework/student"),
        studentApi.get("/exams/student/results"),
        studentApi.get("/student-notifications").catch(() => ({ data: { data: [] } })),
        storageKey ? AsyncStorage.getItem(storageKey) : Promise.resolve(null),
      ]);
      setFees(fRes.data.data);
      setHomework(hRes.data.data ?? []);
      setResults(rRes.data.data ?? []);
      const inboxRaw = nRes.data?.data ?? nRes.data ?? [];
      setStudentInbox(Array.isArray(inboxRaw) ? inboxRaw : []);
      if (storedRaw) {
        try {
          const arr = JSON.parse(storedRaw) as string[];
          setSeenSyntheticIds(new Set(Array.isArray(arr) ? arr : []));
        } catch {
          setSeenSyntheticIds(new Set());
        }
      } else {
        setSeenSyntheticIds(new Set());
      }
    } catch {
      // keep prior state on partial failure
    }
    if (student?.schoolCode) {
      try {
        const res = await studentApi.get(`/schools/public/${student.schoolCode}`);
        const data = res.data?.data ?? res.data;
        if (data?.logo) setSchoolLogo(data.logo as string);
      } catch {
        // keep previous logo
      }
    }
  }, [student?.schoolCode, student?._id]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadDashboard();
      } catch (_) {
      } finally {
        setLoading(false);
      }
    })();
  }, [loadDashboard]);

  const pullReload = useCallback(async () => {
    try {
      await loadDashboard();
    } catch (_) {}
  }, [loadDashboard]);
  useRegisterScreenRefresh(pullReload);

  useEffect(() => {
    optimisticInboxReadIdsRef.current.clear();
  }, [student?._id]);

  const notificationDrafts = useMemo(
    () => buildNotifications(fees, homework, results, studentInbox),
    [fees, homework, results, studentInbox]
  );

  const notifications: Notif[] = useMemo(() => {
    return notificationDrafts.map((n) => {
      if (n.source === "inbox" && n.inboxMongoId) {
        const raw = studentInbox.find((x) => String(x._id) === n.inboxMongoId);
        const serverRead = raw?.isRead === true || raw?.read === true;
        if (serverRead) optimisticInboxReadIdsRef.current.delete(n.inboxMongoId);
        const read =
          serverRead || optimisticInboxReadIdsRef.current.has(n.inboxMongoId);
        return { ...n, read };
      }
      return { ...n, read: seenSyntheticIds.has(n.id) };
    });
  }, [notificationDrafts, studentInbox, seenSyntheticIds]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read),
    [notifications]
  );

  const persistSeenSynthetic = useCallback(
    async (next: Set<string>) => {
      if (!student?._id) return;
      await AsyncStorage.setItem(
        seenStorageKey(student._id),
        JSON.stringify([...next])
      );
    },
    [student?._id]
  );

  const markOneRead = useCallback(
    async (n: Notif) => {
      if (n.read) return;
      if (n.source === "inbox" && n.inboxMongoId) {
        optimisticInboxReadIdsRef.current.add(n.inboxMongoId);
        setStudentInbox((prev) =>
          prev.map((row) =>
            String(row._id) === n.inboxMongoId ? { ...row, isRead: true } : row
          )
        );
        studentApi.patch(`/student-notifications/${n.inboxMongoId}/read`).catch(() => {});
        return;
      }
      setSeenSyntheticIds((prev) => {
        const next = new Set(prev);
        next.add(n.id);
        persistSeenSynthetic(next);
        return next;
      });
    },
    [persistSeenSynthetic]
  );

  const markAllRead = useCallback(async () => {
    await studentApi.patch("/student-notifications/read-all").catch(() => {});
    setStudentInbox((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setSeenSyntheticIds((prev) => {
      const next = new Set(prev);
      for (const d of notificationDrafts) {
        if (d.source !== "inbox") next.add(d.id);
      }
      persistSeenSynthetic(next);
      return next;
    });
  }, [notificationDrafts, persistSeenSynthetic]);

  // ── Derived stats ────────────────────────────────────────────────
  const pendingHw = homework.filter((h: any) => new Date(h.dueDate) >= new Date());
  const dueAmount = fees?.dueAmount ?? 0;

  const featureCards = [
    { icon: "📚", title: "Homework",     route: "/(student)/homework",      accent: "#4f46e5", bg: "#eef2ff" },
    { icon: "📊", title: "Marks",        route: "/(student)/marks",         accent: "#0891b2", bg: "#ecfeff" },
    { icon: "💰", title: "Fees",         route: "/(student)/fees",          accent: "#16a34a", bg: "#f0fdf4" },
    { icon: "📅", title: "Timetable",    route: "/(student)/timetable",     accent: "#d97706", bg: "#fffbeb" },
    { icon: "🚌", title: "Bus tracking", route: "/(student)/bus-tracking",  accent: "#0f766e", bg: "#ecfdf5" },
    { icon: "📋", title: "Attendance",   route: "/(student)/attendance",    accent: "#db2777", bg: "#fdf2f8" },
    { icon: "👤", title: "Profile",      route: "/(student)/profile",       accent: "#7c3aed", bg: "#f5f3ff" },
  ];

  const CATEGORY_LABELS: Record<Notif["category"], string> = {
    fee: "Fees",
    homework: "Homework",
    marks: "Marks",
    attendance: "Attendance",
    school: "School",
  };

  return (
    <RefreshableScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── HEADER ── */}
      <SafeAreaView style={styles.header} edges={["top"]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {schoolLogo ? (
              <Image source={{ uri: schoolLogo }} style={styles.logo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>
                  {student?.schoolName?.charAt(0) ?? "S"}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeText} numberOfLines={1}>
                Welcome, {student?.firstName} {student?.lastName ?? ""}
              </Text>
              <Text style={styles.subText} numberOfLines={1}>
                Class {student?.class} · Sec {student?.section} · {student?.schoolName}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {/* Global notification bell */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setShowNotifs(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.iconBtnEmoji}>🔔</Text>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Logout */}
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => { logout(); router.replace("/"); }}
            >
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* ── GLOBAL NOTIFICATION PANEL ── */}
      <Modal visible={showNotifs} transparent animationType="slide">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowNotifs(false)}
        >
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>

            {/* Sheet header */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.sheetTitle}>Notifications</Text>
                <Text style={styles.sheetSub}>
                  Unread only · fees, homework, results & school messages
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowNotifs(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {unreadCount > 0 && (
              <TouchableOpacity style={styles.markAllButton} onPress={markAllRead} activeOpacity={0.8}>
                <Text style={styles.markAllText}>Mark all as read</Text>
              </TouchableOpacity>
            )}

            {notifications.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={{ fontSize: 36, marginBottom: 10 }}>🔔</Text>
                <Text style={styles.emptyText}>No notifications yet</Text>
                <Text style={styles.emptySub}>
                  Fee updates, homework, results, and absence alerts will appear here.
                </Text>
              </View>
            ) : unreadNotifications.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={{ fontSize: 36, marginBottom: 10 }}>✓</Text>
                <Text style={styles.emptyText}>You&apos;re all caught up</Text>
                <Text style={styles.emptySub}>No unread notifications.</Text>
              </View>
            ) : (
              <FlatList
                data={unreadNotifications}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.notifRow, styles.notifRowUnread, { borderLeftColor: item.accentColor }]}
                    activeOpacity={0.75}
                    onPress={() => markOneRead(item)}
                  >
                    <View style={[styles.notifIconWrap, { backgroundColor: item.bgColor }]}>
                      <Text style={styles.notifIcon}>{item.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.notifTopRow}>
                        <View style={[styles.catPill, { backgroundColor: item.bgColor }]}>
                          <Text style={[styles.catPillText, { color: item.accentColor }]}>
                            {CATEGORY_LABELS[item.category]}
                          </Text>
                        </View>
                        <Text style={styles.notifDate}>{formatDate(item.date)}</Text>
                      </View>
                      <Text style={styles.notifTitle}>{item.title}</Text>
                      <Text style={styles.notifSub}>{item.subtitle}</Text>
                      <Text style={styles.tapReadHint}>Tap to mark as read</Text>
                    </View>
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.sep} />}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── STATS STRIP ── */}
      <View style={styles.statsStrip}>
        <View style={[styles.statChip, styles.statChipPurple]}>
          <Text style={styles.statChipValue}>
            {loading ? "—" : pendingHw.length}
          </Text>
          <Text style={styles.statChipLabel}>Homework{"\n"}Pending</Text>
        </View>
        <View style={[styles.statChip, styles.statChipGreen]}>
          <Text style={[styles.statChipValue, dueAmount > 0 && styles.statChipDanger]}>
            {loading ? "—" : dueAmount > 0 ? `₹${dueAmount.toLocaleString()}` : "₹0"}
          </Text>
          <Text style={styles.statChipLabel}>Fees{"\n"}Due</Text>
        </View>
        <View style={[styles.statChip, styles.statChipCyan]}>
          <Text style={styles.statChipValue}>—</Text>
          <Text style={styles.statChipLabel}>Attendance{"\n"}%</Text>
        </View>
        <View style={[styles.statChip, styles.statChipAmber]}>
          <Text style={styles.statChipValue}>
            {loading ? "—" : results.length}
          </Text>
          <Text style={styles.statChipLabel}>Test{"\n"}Results</Text>
        </View>
      </View>

      {/* ── FEATURE CARDS GRID ── */}
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
    gap: 8,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  logo: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  logoPlaceholder: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: "#eef2ff", alignItems: "center", justifyContent: "center",
  },
  logoPlaceholderText: { fontSize: 18, fontWeight: "700", color: "#4f46e5" },
  welcomeText: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  subText: { fontSize: 11, color: "#64748b", marginTop: 1 },

  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconBtn: { padding: 6, position: "relative" },
  iconBtnEmoji: { fontSize: 20 },
  badge: {
    position: "absolute", top: 1, right: 1,
    backgroundColor: "#ef4444", borderRadius: 8,
    minWidth: 16, height: 16,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: "#fff",
  },
  badgeText: { fontSize: 9, fontWeight: "800", color: "#fff" },

  logoutBtn: {
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 999, backgroundColor: "#eef2ff",
    borderWidth: 1, borderColor: "#e0e7ff",
  },
  logoutText: { fontSize: 12, fontWeight: "600", color: "#4f46e5" },

  /* Notification sheet */
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "78%",
  },
  sheetHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  sheetSub: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: "#64748b" },

  emptyBox: { alignItems: "center", paddingVertical: 36 },
  emptyText: { fontSize: 15, fontWeight: "600", color: "#64748b" },
  emptySub: { fontSize: 12, color: "#94a3b8", marginTop: 6, textAlign: "center" },

  notifRow: {
    flexDirection: "row", gap: 12, alignItems: "flex-start",
    paddingVertical: 12, paddingHorizontal: 4,
    borderLeftWidth: 3, paddingLeft: 12,
  },
  notifIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  notifIcon: { fontSize: 18 },
  notifTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  catPill: {
    borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8,
  },
  catPillText: { fontSize: 10, fontWeight: "700" },
  notifDate: { fontSize: 10, color: "#94a3b8" },
  notifTitle: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  notifSub: { fontSize: 11, color: "#64748b", marginTop: 2 },
  notifRowUnread: { backgroundColor: "#eff6ff", borderRadius: 12 },
  tapReadHint: {
    marginTop: 6,
    fontSize: 10,
    color: "#1d4ed8",
    fontWeight: "600",
  },
  markAllButton: {
    alignSelf: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#e0f2fe",
    marginBottom: 10,
  },
  markAllText: { fontSize: 11, color: "#0369a1", fontWeight: "600" },
  sep: { height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 4 },

  /* Stats strip */
  statsStrip: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 14, gap: 8 },
  statChip: {
    flex: 1, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 6,
    alignItems: "center", borderWidth: 1,
  },
  statChipPurple: { backgroundColor: "#eef2ff", borderColor: "#c7d2fe" },
  statChipGreen:  { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  statChipCyan:   { backgroundColor: "#ecfeff", borderColor: "#a5f3fc" },
  statChipAmber:  { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  statChipValue: { fontSize: 18, fontWeight: "800", color: "#0f172a", marginBottom: 4 },
  statChipDanger: { color: "#dc2626" },
  statChipLabel: { fontSize: 10, color: "#64748b", textAlign: "center", lineHeight: 14 },

  /* Feature cards – same as teacher (2 per row) */
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
  cardIcon:  { fontSize: 40 },
  cardTitle: { fontSize: 16, fontWeight: "700", textAlign: "center" },
});
