import { useRouter } from "expo-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStudentAuthStore } from "@/store/studentAuthStore";
import studentApi from "@/lib/studentApi";

const GLOBAL_NOTIF_SEEN_KEY = "sms_global_notif_seen_ids";

function formatDate(d: string | Date) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function formatAmount(n: number) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

// ── Notification type ─────────────────────────────────────────────────────────
type Notif = {
  id: string;
  category: "fee" | "homework" | "marks" | "attendance";
  icon: string;
  title: string;
  subtitle: string;
  date: string;         // ISO date string for sorting
  accentColor: string;
  bgColor: string;
};

// ── Build notifications from raw API data ─────────────────────────────────────
function buildNotifications(fees: any, homework: any[], results: any[]): Notif[] {
  const list: Notif[] = [];

  // 1. Fee payment events from the StudentFee ledger sub-payments
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

  // 2. Homework assignments
  for (const hw of homework) {
    list.push({
      id: `hw-${hw._id}`,
      category: "homework",
      icon: "📚",
      title: `Homework assigned: ${hw.title ?? ""}`,
      subtitle: `${hw.subject ?? ""} · Due ${formatDate(hw.dueDate)}`,
      date: hw.assignedDate ?? hw.createdAt ?? hw.dueDate ?? new Date().toISOString(),
      accentColor: "#4f46e5",
      bgColor: "#eef2ff",
    });
  }

  // 3. Exam results published
  for (const r of results) {
    const examName = r.examName ?? r.exam?.name ?? "Exam";
    const subject = r.subject ?? r.subjectName ?? "";
    const marks = r.marksObtained ?? r.marks ?? "";
    list.push({
      id: `result-${r._id}`,
      category: "marks",
      icon: "📊",
      title: `Result published: ${examName}`,
      subtitle: subject ? `${subject} · Marks: ${marks}` : `Marks: ${marks}`,
      date: r.publishedAt ?? r.createdAt ?? new Date().toISOString(),
      accentColor: "#0891b2",
      bgColor: "#ecfeff",
    });
  }

  // 4. Attendance placeholder — no API yet; skip silently.

  // Sort most-recent first
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
  const [loading, setLoading] = useState(true);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);

  // Notification panel state
  const [showNotifs, setShowNotifs] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  // ── Fetch data ───────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [fRes, hRes, rRes, storedRaw] = await Promise.all([
          studentApi.get("/fees/student/me"),
          studentApi.get("/homework/student"),
          studentApi.get("/exams/student/results"),
          AsyncStorage.getItem(GLOBAL_NOTIF_SEEN_KEY),
        ]);
        setFees(fRes.data.data);
        setHomework(hRes.data.data ?? []);
        setResults(rRes.data.data ?? []);
        if (storedRaw) setSeenIds(new Set(JSON.parse(storedRaw)));
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!student?.schoolCode) return;
        const res = await studentApi.get(`/schools/public/${student.schoolCode}`);
        const data = res.data?.data ?? res.data;
        if (!cancelled && data?.logo) setSchoolLogo(data.logo as string);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Notification list ────────────────────────────────────────────
  const notifications = useMemo(
    () => buildNotifications(fees, homework, results),
    [fees, homework, results]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !seenIds.has(n.id)).length,
    [notifications, seenIds]
  );

  const markAllSeen = useCallback(async (ids: string[]) => {
    const s = new Set(ids);
    setSeenIds(s);
    await AsyncStorage.setItem(GLOBAL_NOTIF_SEEN_KEY, JSON.stringify(ids));
  }, []);

  const handleBellPress = () => {
    setShowNotifs(true);
    markAllSeen(notifications.map((n) => n.id));
  };

  // ── Derived stats ────────────────────────────────────────────────
  const pendingHw = homework.filter((h: any) => new Date(h.dueDate) >= new Date());
  const dueAmount = fees?.dueAmount ?? 0;

  const featureCards = [
    { icon: "📚", title: "Homework",   route: "/(student)/homework",   accent: "#4f46e5", bg: "#eef2ff" },
    { icon: "📊", title: "Marks",      route: "/(student)/marks",      accent: "#0891b2", bg: "#ecfeff" },
    { icon: "💰", title: "Fees",       route: "/(student)/fees",       accent: "#16a34a", bg: "#f0fdf4" },
    { icon: "📅", title: "Timetable",  route: "/(student)/timetable",  accent: "#d97706", bg: "#fffbeb" },
    { icon: "👤", title: "Profile",    route: "/(student)/profile",    accent: "#7c3aed", bg: "#f5f3ff" },
    { icon: "📋", title: "Attendance", route: "/(student)/attendance", accent: "#db2777", bg: "#fdf2f8" },
  ];

  const CATEGORY_LABELS: Record<Notif["category"], string> = {
    fee: "Fees",
    homework: "Homework",
    marks: "Marks",
    attendance: "Attendance",
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

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
            <TouchableOpacity style={styles.iconBtn} onPress={handleBellPress} activeOpacity={0.7}>
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
              <View>
                <Text style={styles.sheetTitle}>Notifications</Text>
                <Text style={styles.sheetSub}>
                  {notifications.length} total · all updates in one place
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowNotifs(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {notifications.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={{ fontSize: 36, marginBottom: 10 }}>🔔</Text>
                <Text style={styles.emptyText}>No notifications yet</Text>
                <Text style={styles.emptySub}>
                  Fee updates, homework, and results will appear here.
                </Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={[styles.notifRow, { borderLeftColor: item.accentColor }]}>
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
                    </View>
                  </View>
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

    </ScrollView>
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
