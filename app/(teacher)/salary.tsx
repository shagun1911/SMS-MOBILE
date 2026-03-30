import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "@/lib/api";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useRegisterScreenRefresh } from "@/hooks/useRegisterScreenRefresh";

type SalaryRecord = {
  _id: string;
  month: string;
  year: number;
  netSalary: number;
  paidAmount: number;
  status: string;
  paymentDate?: string;
  paymentMode?: string;
};

type OtherPayment = {
  _id: string;
  title: string;
  amount: number;
  type: "bonus" | "adjustment";
  date: string;
};

type TeacherNotification = {
  _id: string;
  title?: string;
  message?: string;
  metadata?: {
    category?: string;
    paymentType?: "bonus" | "adjustment";
    amount?: number;
    title?: string;
    date?: string;
    otherPaymentId?: string;
  };
};

function monthYearKeyFromSalary(month: string, year: number) {
  return `${String(month).trim()}-${year}`;
}

function monthYearKeyFromPaymentDate(dateStr: string): string | null {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const month = d.toLocaleString("en-US", { month: "long" });
  const year = d.getFullYear();
  return `${month}-${year}`;
}

function parseMonthYearKey(key: string): { month: string; year: number } | null {
  const i = key.lastIndexOf("-");
  if (i <= 0) return null;
  const month = key.slice(0, i);
  const year = Number(key.slice(i + 1));
  if (Number.isNaN(year)) return null;
  return { month, year };
}

const MONTH_ORDER = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function sortOrphanMonthKeysDesc(keys: string[]) {
  return [...keys].sort((a, b) => {
    const pa = parseMonthYearKey(a);
    const pb = parseMonthYearKey(b);
    if (!pa || !pb) return a.localeCompare(b);
    if (pb.year !== pa.year) return pb.year - pa.year;
    return MONTH_ORDER.indexOf(pb.month) - MONTH_ORDER.indexOf(pa.month);
  });
}

export default function TeacherSalaryScreen() {
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [otherPayments, setOtherPayments] = useState<OtherPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSalary = useCallback(async () => {
    const [salaryRes, extraRes, notifRes] = await Promise.all([
      api.get("/salaries/my/history"),
      api.get("/salary-other-payments/me").catch(() => ({ data: { data: [] } })),
      api.get("/user-notifications").catch(() => ({ data: { data: [] } })),
    ]);
    const salaryData = salaryRes.data?.data ?? salaryRes.data ?? [];
    const extraDataRaw = extraRes.data?.data ?? extraRes.data ?? [];
    const notifDataRaw = notifRes.data?.data ?? notifRes.data ?? [];
    const extraData: OtherPayment[] = Array.isArray(extraDataRaw) ? extraDataRaw : [];
    const notifications: TeacherNotification[] = Array.isArray(notifDataRaw) ? notifDataRaw : [];

    const fromNotifications: OtherPayment[] = notifications
      .filter((n) => n?.metadata?.category === "other_payment")
      .map((n) => {
        const md = n.metadata || {};
        return {
          _id: String(md?.otherPaymentId ?? n._id ?? `${Date.now()}-${Math.random()}`),
          title: String(md.title ?? n.title ?? "Bonus/Adjustment"),
          amount: Number(md.amount ?? 0),
          type: md.paymentType === "adjustment" ? "adjustment" : "bonus",
          date: String(md.date ?? (n as any).createdAt ?? new Date().toISOString()),
        } as OtherPayment;
      })
      .filter((p) => !!p.amount && !!p.date);

    const mergedMap = new Map<string, OtherPayment>();
    [...fromNotifications, ...extraData].forEach((p) => {
      const k = `${p.type}|${p.title}|${p.amount}|${new Date(p.date).toISOString()}`;
      if (!mergedMap.has(k)) mergedMap.set(k, p);
    });
    const mergedExtras = [...mergedMap.values()];

    setRecords(Array.isArray(salaryData) ? salaryData : []);
    setOtherPayments(mergedExtras);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await loadSalary();
      } catch (e: any) {
        setError(e?.response?.data?.message ?? "Unable to load salary history.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadSalary]);

  const pullReload = useCallback(async () => {
    try {
      setError(null);
      await loadSalary();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Unable to load salary history.");
    }
  }, [loadSalary]);
  useRegisterScreenRefresh(pullReload);

  const extrasByMonth = useMemo(() => {
    const map = new Map<string, OtherPayment[]>();
    for (const p of otherPayments) {
      const k = monthYearKeyFromPaymentDate(p.date);
      if (!k) continue;
      const arr = map.get(k) ?? [];
      arr.push(p);
      map.set(k, arr);
    }
    return map;
  }, [otherPayments]);

  const salaryMonthKeys = useMemo(
    () => new Set(records.map((r) => monthYearKeyFromSalary(r.month, r.year))),
    [records]
  );

  const orphanMonthKeys = useMemo(() => {
    const keys = [...extrasByMonth.keys()].filter((k) => !salaryMonthKeys.has(k));
    return sortOrphanMonthKeysDesc(keys);
  }, [extrasByMonth, salaryMonthKeys]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.centerText}>Loading salary history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!records.length && !otherPayments.length) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No salary payments recorded yet.</Text>
          <Text style={styles.emptySub}>
            Once payroll is generated and payments are recorded for you, they will appear here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const fmt = (n: number) =>
    `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const prettyStatus = (s: string) => {
    if (s === "paid") return "Paid";
    if (s === "partial") return "Partial";
    if (s === "hold") return "On Hold";
    return "Pending";
  };

  const renderExtraRows = (items: OtherPayment[]) => {
    const bonuses = items.filter((p) => p.type === "bonus");
    const adjustments = items.filter((p) => p.type === "adjustment");
    return (
      <>
        {bonuses.map((p) => (
          <View key={p._id} style={styles.row}>
            <Text style={styles.label}>Bonus — {p.title || "Bonus"}</Text>
            <Text style={[styles.value, styles.valueBonus]}>{fmt(p.amount)}</Text>
          </View>
        ))}
        {adjustments.map((p) => (
          <View key={p._id} style={styles.row}>
            <Text style={styles.label}>Deduction — {p.title || "Adjustment"}</Text>
            <Text style={[styles.value, styles.valueAdjustment]}>-{fmt(p.amount)}</Text>
          </View>
        ))}
        {(bonuses.length > 0 || adjustments.length > 0) && (
          <Text style={styles.settledNote}>
            Paid or adjusted outside monthly payroll — not included in net salary above.
          </Text>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <RefreshableScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Salary History</Text>
        <Text style={styles.subtitle}>Monthly payroll and one-time bonuses & adjustments.</Text>

        {records.map((r) => {
          const paid = r.paidAmount || 0;
          const due = Math.max(0, (r.netSalary || 0) - paid);
          const monthKey = monthYearKeyFromSalary(r.month, r.year);
          const monthExtras = extrasByMonth.get(monthKey) ?? [];
          return (
            <View key={r._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardMonth}>
                  {r.month} {r.year}
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    r.status === "paid"
                      ? styles.statusPaid
                      : r.status === "partial"
                        ? styles.statusPartial
                        : r.status === "hold"
                          ? styles.statusHold
                          : styles.statusPending,
                  ]}
                >
                  <Text style={styles.statusText}>{prettyStatus(r.status)}</Text>
                </View>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Net salary</Text>
                <Text style={styles.value}>{fmt(r.netSalary)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Paid</Text>
                <Text style={[styles.value, styles.valuePaid]}>{fmt(paid)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Remaining</Text>
                <Text style={[styles.value, due > 0 ? styles.valueDue : styles.valuePaid]}>
                  {fmt(due)}
                </Text>
              </View>
              {monthExtras.length > 0 ? (
                <View style={styles.extrasBlock}>{renderExtraRows(monthExtras)}</View>
              ) : null}
              <View style={styles.metaRow}>
                <Text style={styles.meta}>
                  {r.paymentDate
                    ? `Last payment: ${new Date(r.paymentDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}`
                    : "No payment date"}
                </Text>
                {r.paymentMode ? (
                  <Text style={styles.meta}>Mode: {r.paymentMode}</Text>
                ) : null}
              </View>
            </View>
          );
        })}

        {orphanMonthKeys.map((key) => {
          const parsed = parseMonthYearKey(key);
          const items = extrasByMonth.get(key) ?? [];
          if (!parsed || !items.length) return null;
          return (
            <View key={`extras-${key}`} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardMonth}>
                  {parsed.month} {parsed.year}
                </Text>
                <View style={[styles.statusPill, styles.statusExtrasOnly]}>
                  <Text style={styles.statusText}>Extra payments</Text>
                </View>
              </View>
              <Text style={styles.extrasOnlySub}>No monthly payroll row for this month.</Text>
              <View style={styles.extrasBlock}>{renderExtraRows(items)}</View>
            </View>
          );
        })}
      </RefreshableScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32 },
  center: {
    flex: 1,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: { marginTop: 8, fontSize: 13, color: "#64748b" },
  errorText: { fontSize: 13, color: "#b91c1c", textAlign: "center" },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 280,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardMonth: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPaid: { backgroundColor: "#dcfce7" },
  statusPartial: { backgroundColor: "#e0f2fe" },
  statusPending: { backgroundColor: "#fef9c3" },
  statusHold: { backgroundColor: "#e5e7eb" },
  statusExtrasOnly: { backgroundColor: "#ede9fe" },
  statusText: { fontSize: 11, fontWeight: "600", color: "#111827" },
  extrasOnlySub: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 8,
  },
  extrasBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  settledNote: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 8,
    fontStyle: "italic",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  label: { fontSize: 13, color: "#64748b", flex: 1, paddingRight: 8 },
  value: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  valuePaid: { color: "#16a34a" },
  valueDue: { color: "#dc2626" },
  valueBonus: { color: "#15803d" },
  valueAdjustment: { color: "#b91c1c" },
  metaRow: { marginTop: 8 },
  meta: { fontSize: 11, color: "#6b7280" },
});
