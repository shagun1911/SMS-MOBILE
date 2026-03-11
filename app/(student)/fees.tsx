import { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import studentApi from "@/lib/studentApi";

const NOTIF_SEEN_KEY = "sms_fees_notif_seen_ids";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function formatDate(d: string | Date) {
  const x = new Date(d);
  return x.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatAmount(n: number) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function modeLabel(m: string) {
  const map: Record<string, string> = {
    cash: "Cash", upi: "UPI", bank: "Bank Transfer",
    card: "Card", cheque: "Cheque", online: "Online",
  };
  return map[m?.toLowerCase()] ?? m ?? "—";
}

export default function StudentFeesScreen() {
  const [loading, setLoading] = useState(true);
  const [feeData, setFeeData] = useState<any>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedOpt, setSelectedOpt] = useState<{ label: string; year: number; month: number } | null>(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const [res, stored] = await Promise.all([
          studentApi.get("/fees/student/me"),
          AsyncStorage.getItem(NOTIF_SEEN_KEY),
        ]);
        setFeeData(res.data.data);
        if (stored) setSeenIds(new Set(JSON.parse(stored)));
      } catch (e) {
        console.log("Fee fetch error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const markAllSeen = useCallback(async (ids: string[]) => {
    const updated = new Set(ids);
    setSeenIds(updated);
    await AsyncStorage.setItem(NOTIF_SEEN_KEY, JSON.stringify(ids));
  }, []);

  const totalFee = feeData?.totalYearlyFee ?? 0;
  const paidAmount = feeData?.paidAmount ?? 0;
  const dueAmount = feeData?.dueAmount ?? 0;
  const payments: any[] = feeData?.payments ?? [];
  const progressPct = totalFee > 0 ? Math.min(Math.round((paidAmount / totalFee) * 100), 100) : 0;

  // Separate one-time ledger entries from monthly ones.
  // StudentFee ledger has a "month" field that is either "One-Time" or a month name.
  const oneTimeLedger = useMemo(
    () => payments.filter((p: any) => (p.month || "").toLowerCase() === "one-time"),
    [payments]
  );

  const monthlyLedger = useMemo(
    () => payments.filter((p: any) => {
      const m = (p.month || "").toLowerCase();
      return m !== "one-time" && m !== "";
    }),
    [payments]
  );

  // Build month options from the monthly ledger entries (unique month+year combos).
  // Use the payments sub-array inside each ledger entry to extract year info.
  const monthOptions = useMemo(() => {
    const opts: { label: string; year: number; month: number; key: string }[] = [];
    const seen = new Set<string>();

    for (const entry of monthlyLedger) {
      const monthName: string = entry.month ?? "";
      const monthIdx = MONTHS.findIndex(
        (m) => m.toLowerCase() === monthName.toLowerCase()
      );
      if (monthIdx < 0) continue;

      // Try to figure out the year from dueDate or the first payment date
      let year = 0;
      if (entry.dueDate) {
        year = new Date(entry.dueDate).getFullYear();
      } else if (entry.payments?.length > 0) {
        year = new Date(entry.payments[0].paymentDate).getFullYear();
      } else {
        year = new Date().getFullYear();
      }

      const key = `${year}-${monthIdx + 1}`;
      if (seen.has(key)) continue;
      seen.add(key);
      opts.push({ label: `${monthName} ${year}`, year, month: monthIdx + 1, key });
    }

    // Sort by year, then by month (session order — March before April etc.)
    opts.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
    return opts;
  }, [monthlyLedger]);

  // Payments for the selected month — get from the ledger entry.
  const selectedMonthPayments = useMemo(() => {
    if (!selectedOpt) return [];
    const monthName = MONTHS[selectedOpt.month - 1];
    const entry = monthlyLedger.find((e: any) => {
      const m = (e.month || "").toLowerCase();
      return m === monthName.toLowerCase();
    });
    if (!entry) return [];
    // Return the payments sub-array from the StudentFee ledger
    const subPayments: any[] = entry.payments ?? [];
    return subPayments.map((p: any) => ({
      ...p,
      monthTotal: entry.totalAmount ?? 0,
      monthPaid: entry.paidAmount ?? 0,
      monthRemaining: entry.remainingAmount ?? 0,
      monthStatus: entry.status ?? "pending",
    }));
  }, [selectedOpt, monthlyLedger]);

  const selectedMonthEntry = useMemo(() => {
    if (!selectedOpt) return null;
    const monthName = MONTHS[selectedOpt.month - 1];
    return monthlyLedger.find((e: any) =>
      (e.month || "").toLowerCase() === monthName.toLowerCase()
    ) ?? null;
  }, [selectedOpt, monthlyLedger]);

  // Build notification list from ALL ledger payment transactions.
  const notifications = useMemo(() => {
    const list: { id: string; month: string; amount: number; date: string; mode: string; type: "one-time" | "monthly" }[] = [];
    for (const entry of payments) {
      const isOneTime = (entry.month || "").toLowerCase() === "one-time";
      const monthLabel = isOneTime ? "Admission (One-Time)" : (entry.month ?? "Fee");
      for (const p of entry.payments ?? []) {
        const id = p._id ?? `${entry._id}-${p.paymentDate}`;
        list.push({
          id: String(id),
          month: monthLabel,
          amount: p.amount ?? 0,
          date: p.paymentDate ?? "",
          mode: p.paymentMode ?? "",
          type: isOneTime ? "one-time" : "monthly",
        });
      }
    }
    // Most recent first
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [payments]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !seenIds.has(n.id)).length,
    [notifications, seenIds]
  );

  const handleOpenNotifs = () => {
    setShowNotifs(true);
    markAllSeen(notifications.map((n) => n.id));
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Title row with notification bell ── */}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>My Fees</Text>
          <Text style={styles.subtitle}>Fee summary and payment history</Text>
        </View>
        <TouchableOpacity style={styles.bellBtn} onPress={handleOpenNotifs} activeOpacity={0.7}>
          <Text style={styles.bellIcon}>🔔</Text>
          {unreadCount > 0 && (
            <View style={styles.badge2}>
              <Text style={styles.badgeCount}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Notification Modal ── */}
      <Modal visible={showNotifs} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowNotifs(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.notifHeader}>
              <Text style={styles.modalTitle}>Fee Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifs(false)}>
                <Text style={styles.notifClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {notifications.length === 0 ? (
              <View style={[styles.emptyBox, { paddingVertical: 32 }]}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🔔</Text>
                <Text style={styles.emptyText}>No fee notifications yet</Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.notifItem}>
                    <View style={[styles.notifDot, item.type === "one-time" ? styles.notifDotGreen : styles.notifDotBlue]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifTitle}>
                        {item.type === "one-time"
                          ? "Admission fee deposited"
                          : `${item.month} fee deposited`}
                      </Text>
                      <Text style={styles.notifMeta}>
                        {formatAmount(item.amount)} · {modeLabel(item.mode)}
                        {item.date ? `  ·  ${formatDate(item.date)}` : ""}
                      </Text>
                    </View>
                  </View>
                )}
                ItemSeparatorComponent={() => <View style={styles.notifSep} />}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Summary cards ── */}
      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Total Fee</Text>
          <Text style={styles.cardValue}>{formatAmount(totalFee)}</Text>
        </View>
        <View style={[styles.card, styles.cardPaid]}>
          <Text style={styles.cardLabelPaid}>Paid</Text>
          <Text style={styles.cardValuePaid}>{formatAmount(paidAmount)}</Text>
        </View>
        <View style={[styles.card, dueAmount > 0 && styles.cardDue]}>
          <Text style={dueAmount > 0 ? styles.cardLabelDue : styles.cardLabel}>Due</Text>
          <Text style={dueAmount > 0 ? styles.cardValueDue : styles.cardValue}>
            {formatAmount(dueAmount)}
          </Text>
        </View>
      </View>

      {totalFee > 0 && (
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Payment progress</Text>
            <Text style={styles.progressPct}>{progressPct}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
          </View>
        </View>
      )}

      {/* ── ONE-TIME / ADMISSION FEES ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>One-Time</Text>
          </View>
          <Text style={styles.sectionTitle}>Admission Fees</Text>
        </View>
        <Text style={styles.sectionMeta}>
          Charged once at the time of admission for the entire session.
        </Text>

        {oneTimeLedger.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No one-time fees recorded</Text>
          </View>
        ) : (
          oneTimeLedger.map((entry: any, idx: number) => (
            <View key={entry._id ?? idx} style={styles.oneTimeCard}>
              <View style={styles.oneTimeRow}>
                <Text style={styles.oneTimeLabel}>Total</Text>
                <Text style={styles.oneTimeValue}>{formatAmount(entry.totalAmount ?? 0)}</Text>
              </View>
              <View style={styles.oneTimeRow}>
                <Text style={styles.oneTimeLabel}>Paid</Text>
                <Text style={[styles.oneTimeValue, { color: "#059669" }]}>{formatAmount(entry.paidAmount ?? 0)}</Text>
              </View>
              <View style={styles.oneTimeRow}>
                <Text style={styles.oneTimeLabel}>Remaining</Text>
                <Text style={[styles.oneTimeValue, (entry.remainingAmount ?? 0) > 0 ? { color: "#dc2626" } : { color: "#059669" }]}>
                  {formatAmount(entry.remainingAmount ?? 0)}
                </Text>
              </View>
              <View style={[styles.statusBadge, (entry.status ?? "").toLowerCase() === "paid" ? styles.statusPaid : styles.statusPending]}>
                <Text style={(entry.status ?? "").toLowerCase() === "paid" ? styles.statusTextPaid : styles.statusTextPending}>
                  {(entry.status ?? "pending").toUpperCase()}
                </Text>
              </View>
              {(entry.payments ?? []).length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.subHead}>Transactions</Text>
                  {(entry.payments ?? []).map((p: any, i: number) => (
                    <View key={i} style={styles.txRow}>
                      <View>
                        <Text style={styles.txDate}>{p.paymentDate ? formatDate(p.paymentDate) : "—"}</Text>
                        <Text style={styles.txMode}>{modeLabel(p.paymentMode)}</Text>
                      </View>
                      <Text style={styles.txAmount}>{formatAmount(p.amount ?? 0)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* ── MONTHLY FEES ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.badge, styles.badgeMonthly]}>
            <Text style={[styles.badgeText, styles.badgeTextMonthly]}>Monthly</Text>
          </View>
          <Text style={styles.sectionTitle}>Monthly Fees</Text>
        </View>
        <Text style={styles.sectionMeta}>Select a month to view transactions for that period.</Text>

        {/* Month picker */}
        <TouchableOpacity style={styles.picker} onPress={() => setShowPicker(true)}>
          <Text style={styles.pickerText}>
            {selectedOpt ? selectedOpt.label : "Select month…"}
          </Text>
          <Text style={styles.pickerChevron}>▾</Text>
        </TouchableOpacity>

        <Modal visible={showPicker} transparent animationType="slide">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowPicker(false)}
          >
            <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>Select Month</Text>
              {monthOptions.length === 0 ? (
                <Text style={[styles.emptyText, { textAlign: "center", paddingVertical: 20 }]}>
                  No monthly fee records yet
                </Text>
              ) : (
                <FlatList
                  data={monthOptions}
                  keyExtractor={(item) => item.key}
                  renderItem={({ item }) => {
                    const isActive =
                      selectedOpt?.year === item.year && selectedOpt?.month === item.month;
                    return (
                      <TouchableOpacity
                        style={[styles.modalOption, isActive && styles.modalOptionActive]}
                        onPress={() => {
                          setSelectedOpt(item);
                          setShowPicker(false);
                        }}
                      >
                        <Text style={[styles.modalOptionText, isActive && styles.modalOptionTextActive]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Selected month details */}
        {selectedOpt && selectedMonthEntry && (
          <View style={styles.monthDetail}>
            <View style={styles.monthSummary}>
              <View style={styles.oneTimeRow}>
                <Text style={styles.oneTimeLabel}>Fee for {MONTHS[selectedOpt.month - 1]}</Text>
                <Text style={styles.oneTimeValue}>{formatAmount(selectedMonthEntry.totalAmount ?? 0)}</Text>
              </View>
              <View style={styles.oneTimeRow}>
                <Text style={styles.oneTimeLabel}>Paid</Text>
                <Text style={[styles.oneTimeValue, { color: "#059669" }]}>{formatAmount(selectedMonthEntry.paidAmount ?? 0)}</Text>
              </View>
              <View style={styles.oneTimeRow}>
                <Text style={styles.oneTimeLabel}>Remaining</Text>
                <Text style={[styles.oneTimeValue, (selectedMonthEntry.remainingAmount ?? 0) > 0 ? { color: "#dc2626" } : { color: "#059669" }]}>
                  {formatAmount(selectedMonthEntry.remainingAmount ?? 0)}
                </Text>
              </View>
              <View style={[styles.statusBadge, (selectedMonthEntry.status ?? "").toLowerCase() === "paid" ? styles.statusPaid : styles.statusPending]}>
                <Text style={(selectedMonthEntry.status ?? "").toLowerCase() === "paid" ? styles.statusTextPaid : styles.statusTextPending}>
                  {(selectedMonthEntry.status ?? "pending").toUpperCase()}
                </Text>
              </View>
            </View>

            {selectedMonthPayments.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No transactions for this month</Text>
              </View>
            ) : (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.subHead}>Transactions</Text>
                {selectedMonthPayments.map((p: any, i: number) => (
                  <View key={i} style={styles.txRow}>
                    <View>
                      <Text style={styles.txDate}>{p.paymentDate ? formatDate(p.paymentDate) : "—"}</Text>
                      <Text style={styles.txMode}>{modeLabel(p.paymentMode)}{p.receiptNumber ? ` · ${p.receiptNumber}` : ""}</Text>
                    </View>
                    <Text style={styles.txAmount}>{formatAmount(p.amount ?? 0)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {selectedOpt && !selectedMonthEntry && (
          <View style={[styles.emptyBox, { marginTop: 12 }]}>
            <Text style={styles.emptyText}>No fee record for {selectedOpt.label}</Text>
          </View>
        )}
      </View>

      {dueAmount > 0 && (
        <View style={styles.alert}>
          <Text style={styles.alertTitle}>Contact the school office to clear your dues.</Text>
          <Text style={styles.alertText}>Bring your admission number when visiting the fee department.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#64748b" },

  bellBtn: { position: "relative", padding: 6, marginTop: 2 },
  bellIcon: { fontSize: 22 },
  badge2: { position: "absolute", top: 2, right: 2, backgroundColor: "#ef4444", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeCount: { fontSize: 9, fontWeight: "800", color: "#fff" },

  notifHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  notifClose: { fontSize: 18, color: "#64748b", padding: 4 },
  notifItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, paddingHorizontal: 4 },
  notifDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  notifDotGreen: { backgroundColor: "#22c55e" },
  notifDotBlue: { backgroundColor: "#4f46e5" },
  notifTitle: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  notifMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  notifSep: { height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 4 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  card: { flex: 1, minWidth: "30%", backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e2e8f0" },
  cardLabel: { fontSize: 12, color: "#64748b", marginBottom: 4 },
  cardValue: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  cardPaid: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
  cardLabelPaid: { fontSize: 12, color: "#059669", marginBottom: 4 },
  cardValuePaid: { fontSize: 18, fontWeight: "700", color: "#047857" },
  cardDue: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  cardLabelDue: { fontSize: 12, color: "#dc2626", marginBottom: 4 },
  cardValueDue: { fontSize: 18, fontWeight: "700", color: "#b91c1c" },

  progressCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#e2e8f0" },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { fontSize: 14, color: "#64748b" },
  progressPct: { fontWeight: "600", color: "#0f172a" },
  progressBar: { height: 8, backgroundColor: "#e2e8f0", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#22c55e", borderRadius: 4 },

  section: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", padding: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  sectionMeta: { fontSize: 13, color: "#64748b", marginBottom: 12 },

  badge: { backgroundColor: "#f0fdf4", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: "#bbf7d0" },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#15803d" },
  badgeMonthly: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  badgeTextMonthly: { color: "#1d4ed8" },

  oneTimeCard: { backgroundColor: "#fafafa", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#f1f5f9" },
  oneTimeRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  oneTimeLabel: { fontSize: 14, color: "#64748b" },
  oneTimeValue: { fontSize: 14, fontWeight: "600", color: "#0f172a" },

  statusBadge: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, marginTop: 8 },
  statusPaid: { backgroundColor: "#dcfce7" },
  statusPending: { backgroundColor: "#fef9c3" },
  statusTextPaid: { fontSize: 11, fontWeight: "700", color: "#15803d" },
  statusTextPending: { fontSize: 11, fontWeight: "700", color: "#a16207" },

  subHead: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 8 },
  txRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  txDate: { fontSize: 13, fontWeight: "500", color: "#334155" },
  txMode: { fontSize: 12, color: "#94a3b8", marginTop: 1 },
  txAmount: { fontSize: 15, fontWeight: "700", color: "#059669" },

  picker: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "#c7d2fe", borderRadius: 10, padding: 12, backgroundColor: "#f5f3ff" },
  pickerText: { fontSize: 14, color: "#3730a3", fontWeight: "500" },
  pickerChevron: { fontSize: 16, color: "#4f46e5" },

  monthDetail: { marginTop: 12 },
  monthSummary: { backgroundColor: "#fafafa", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#f1f5f9" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "70%" },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 12, textAlign: "center" },
  modalOption: { padding: 14, borderRadius: 10, marginBottom: 4 },
  modalOptionActive: { backgroundColor: "#eff6ff" },
  modalOptionText: { fontSize: 15, color: "#334155" },
  modalOptionTextActive: { color: "#1d4ed8", fontWeight: "600" },

  emptyBox: { alignItems: "center", paddingVertical: 20 },
  emptyText: { fontSize: 14, color: "#94a3b8" },
  alert: { backgroundColor: "#fffbeb", borderRadius: 12, padding: 16, marginTop: 4, borderWidth: 1, borderColor: "#fde68a" },
  alertTitle: { fontWeight: "600", color: "#92400e" },
  alertText: { fontSize: 14, color: "#b45309", marginTop: 4 },
});
