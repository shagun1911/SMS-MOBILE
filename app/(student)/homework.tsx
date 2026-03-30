import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from "react-native";
import studentApi from "@/lib/studentApi";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useRegisterScreenRefresh } from "@/hooks/useRegisterScreenRefresh";

export default function StudentHomeworkScreen() {
  const [homework, setHomework] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHomework = useCallback(async () => {
    const res = await studentApi.get("/homework/student");
    setHomework(res.data.data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadHomework();
      } catch (_) {
      } finally {
        setLoading(false);
      }
    })();
  }, [loadHomework]);

  const pullReload = useCallback(async () => {
    try {
      await loadHomework();
    } catch (_) {}
  }, [loadHomework]);
  useRegisterScreenRefresh(pullReload);

  const now = new Date();
  const pending = homework.filter((h: any) => !h.dueDate || new Date(h.dueDate) >= now);
  const past = homework.filter((h: any) => !!h.dueDate && new Date(h.dueDate) < now);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  const Card = ({ hw }: { hw: any }) => {
    const hasDueDate = !!hw.dueDate;
    const due = hasDueDate ? new Date(hw.dueDate) : null;
    const isOverdue = hasDueDate && !!due && due < now;
    const attachmentItems: { url: string; filename?: string }[] =
      Array.isArray(hw.attachments) && hw.attachments.length > 0
        ? hw.attachments.filter((a: any) => a?.url)
        : hw.attachmentUrl
          ? [{ url: hw.attachmentUrl, filename: "Attachment" }]
          : [];
    return (
      <View style={[styles.card, isOverdue && styles.cardPast]}>
        <Text style={styles.badge}>{hw.subject}</Text>
        <Text style={styles.cardTitle}>{hw.title}</Text>
        <Text style={styles.cardDesc}>{hw.description}</Text>
        <Text style={styles.cardMeta}>By {hw.createdBy?.name || "Teacher"}</Text>
        <Text style={[styles.cardDue, isOverdue && styles.cardDuePast]}>
          {hasDueDate && due
            ? `${isOverdue ? "Past" : "Due"}: ${due.toLocaleDateString()}`
            : "No due date"}
        </Text>
        {attachmentItems.length > 0 ? (
          <View style={styles.attachmentsBlock}>
            <Text style={styles.attachmentsLabel}>Files from teacher</Text>
            {attachmentItems.map((item, idx) => (
              <Text
                key={`${item.url}-${idx}`}
                style={styles.attachment}
                onPress={() => Linking.openURL(item.url)}
              >
                {item.filename || `File ${idx + 1}`} →
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <RefreshableScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Homework</Text>
      <Text style={styles.subtitle}>All assignments for your class</Text>

      {pending.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Pending ({pending.length})</Text>
          {pending.map((hw) => (
            <Card key={hw._id} hw={hw} />
          ))}
        </>
      )}
      {past.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Past ({past.length})</Text>
          {past.map((hw) => (
            <Card key={hw._id} hw={hw} />
          ))}
        </>
      )}
      {homework.length === 0 && (
        <Text style={styles.empty}>No homework assigned yet.</Text>
      )}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#475569", marginBottom: 12, marginTop: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },
  cardPast: { opacity: 0.8, borderColor: "#e2e8f0" },
  badge: { fontSize: 11, color: "#4f46e5", marginBottom: 4 },
  cardTitle: { fontWeight: "600", color: "#0f172a" },
  cardDesc: { fontSize: 14, color: "#64748b", marginTop: 4 },
  cardMeta: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  cardDue: { fontSize: 13, fontWeight: "500", color: "#dc2626", marginTop: 8 },
  cardDuePast: { color: "#64748b" },
  attachmentsBlock: { marginTop: 8 },
  attachmentsLabel: { fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 4 },
  attachment: { fontSize: 13, color: "#4f46e5", marginTop: 4 },
  empty: { color: "#64748b", paddingVertical: 24 },
});
