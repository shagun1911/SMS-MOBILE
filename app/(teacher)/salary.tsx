import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import api from "@/lib/api";

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

export default function TeacherSalaryScreen() {
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/salaries/my/history");
        const data = res.data?.data ?? res.data ?? [];
        setRecords(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e?.response?.data?.message ?? "Unable to load salary history.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.centerText}>Loading salary history...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!records.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No salary payments recorded yet.</Text>
        <Text style={styles.emptySub}>
          Once payroll is generated and payments are recorded for you, they will appear here.
        </Text>
      </View>
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Salary History</Text>
      <Text style={styles.subtitle}>All salary transactions recorded for your account.</Text>

      {records.map((r) => {
        const paid = r.paidAmount || 0;
        const due = Math.max(0, (r.netSalary || 0) - paid);
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  statusText: { fontSize: 11, fontWeight: "600", color: "#111827" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  label: { fontSize: 13, color: "#64748b" },
  value: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  valuePaid: { color: "#16a34a" },
  valueDue: { color: "#dc2626" },
  metaRow: { marginTop: 8 },
  meta: { fontSize: 11, color: "#6b7280" },
});

