import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import studentApi from "@/lib/studentApi";

export default function StudentFeesScreen() {
  const [feeData, setFeeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await studentApi.get("/fees/student/me");
        setFeeData(res.data.data);
      } catch (_) {}
      finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  const totalFee = feeData?.totalYearlyFee ?? 0;
  const paidAmount = feeData?.paidAmount ?? 0;
  const dueAmount = feeData?.dueAmount ?? 0;
  const payments = feeData?.payments ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>My Fees</Text>
      <Text style={styles.subtitle}>Fee summary and payment history</Text>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Total Fee</Text>
          <Text style={styles.cardValue}>₹{totalFee.toLocaleString()}</Text>
        </View>
        <View style={[styles.card, styles.cardPaid]}>
          <Text style={styles.cardLabelPaid}>Paid</Text>
          <Text style={styles.cardValuePaid}>₹{paidAmount.toLocaleString()}</Text>
        </View>
        <View style={[styles.card, dueAmount > 0 && styles.cardDue]}>
          <Text style={dueAmount > 0 ? styles.cardLabelDue : styles.cardLabel}>Due</Text>
          <Text style={dueAmount > 0 ? styles.cardValueDue : styles.cardValue}>
            ₹{dueAmount.toLocaleString()}
          </Text>
        </View>
      </View>

      {totalFee > 0 && (
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Payment progress</Text>
            <Text style={styles.progressPct}>
              {Math.round((paidAmount / totalFee) * 100)}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min((paidAmount / totalFee) * 100, 100)}%` },
              ]}
            />
          </View>
        </View>
      )}

      {payments.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Payment history</Text>
          <View style={styles.list}>
            {payments.map((p: any, i: number) => (
              <View key={i} style={styles.listItem}>
                <View>
                  <Text style={styles.listTitle}>{p.feeTitle || p.month || "Fee Payment"}</Text>
                  <Text style={styles.listMeta}>
                    {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : ""} · {p.paymentMode || p.mode || "—"}
                  </Text>
                </View>
                <Text style={styles.listAmount}>
                  ₹{(p.amountPaid ?? p.amount ?? 0).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

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
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  card: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
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
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a", marginBottom: 12 },
  list: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  listItem: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  listTitle: { fontWeight: "500", color: "#0f172a" },
  listMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  listAmount: { fontWeight: "600", color: "#059669" },
  alert: { backgroundColor: "#fffbeb", borderRadius: 12, padding: 16, marginTop: 20, borderWidth: 1, borderColor: "#fde68a" },
  alertTitle: { fontWeight: "600", color: "#92400e" },
  alertText: { fontSize: 14, color: "#b45309", marginTop: 4 },
});
