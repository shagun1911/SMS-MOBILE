import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import api from "@/lib/api";

export default function TeacherHomeworkScreen() {
  const [homework, setHomework] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    className: "",
    section: "",
    subject: "",
    title: "",
    description: "",
    dueDate: "",
    attachmentUrl: "",
  });

  const load = async () => {
    try {
      const [hRes, cRes] = await Promise.all([
        api.get("/homework"),
        api.get("/classes"),
      ]);
      setHomework(hRes.data.data ?? []);
      setClasses(cRes.data.data ?? []);
    } catch (_) {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedClass = classes.find((c: any) => c.className === form.className);
  const sections = selectedClass?.sections ?? [];

  const submit = async () => {
    if (!form.className || !form.section || !form.subject || !form.title || !form.description || !form.dueDate) {
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/homework", form);
      setShowForm(false);
      setForm({ className: "", section: "", subject: "", title: "", description: "", dueDate: "", attachmentUrl: "" });
      load();
    } catch (_) {}
    finally {
      setSubmitting(false);
    }
  };

  const deleteHw = async (id: string) => {
    try {
      await api.delete(`/homework/${id}`);
      load();
    } catch (_) {}
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Homework</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Text style={styles.addBtnText}>+ Assign</Text>
        </TouchableOpacity>
      </View>

      {homework.length === 0 ? (
        <Text style={styles.empty}>No homework assigned yet.</Text>
      ) : (
        homework.map((hw: any) => (
          <View key={hw._id} style={styles.card}>
            <View style={styles.cardBody}>
              <Text style={styles.badge}>
                Class {hw.className}-{hw.section} · {hw.subject}
              </Text>
              <Text style={styles.cardTitle}>{hw.title}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>{hw.description}</Text>
              <Text style={styles.cardDue}>Due: {new Date(hw.dueDate).toLocaleDateString()}</Text>
            </View>
            <TouchableOpacity onPress={() => deleteHw(hw._id)}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Homework</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Class</Text>
              <TextInput
                style={styles.input}
                value={form.className}
                onChangeText={(v) => setForm({ ...form, className: v, section: "" })}
                placeholder="e.g. 10"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.label}>Section</Text>
              <TextInput
                style={styles.input}
                value={form.section}
                onChangeText={(v) => setForm({ ...form, section: v })}
                placeholder="e.g. A"
                placeholderTextColor="#94a3b8"
                editable={sections.length > 0}
              />
              <Text style={styles.label}>Subject</Text>
              <TextInput
                style={styles.input}
                value={form.subject}
                onChangeText={(v) => setForm({ ...form, subject: v })}
                placeholder="e.g. Mathematics"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={form.title}
                onChangeText={(v) => setForm({ ...form, title: v })}
                placeholder="Homework title"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.description}
                onChangeText={(v) => setForm({ ...form, description: v })}
                placeholder="Description..."
                placeholderTextColor="#94a3b8"
                multiline
              />
              <Text style={styles.label}>Due date</Text>
              <TextInput
                style={styles.input}
                value={form.dueDate}
                onChangeText={(v) => setForm({ ...form, dueDate: v })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitDisabled]}
                onPress={submit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Assign</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  addBtn: { backgroundColor: "#059669", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  addBtnText: { color: "#fff", fontWeight: "600" },
  empty: { color: "#64748b", paddingVertical: 24 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardBody: { flex: 1 },
  badge: { fontSize: 11, color: "#059669", marginBottom: 4 },
  cardTitle: { fontWeight: "600", color: "#0f172a" },
  cardDesc: { fontSize: 13, color: "#64748b", marginTop: 4 },
  cardDue: { fontSize: 12, color: "#94a3b8", marginTop: 6 },
  deleteText: { color: "#dc2626", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90%", padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  modalClose: { fontSize: 16, color: "#64748b" },
  label: { fontSize: 13, fontWeight: "500", color: "#475569", marginBottom: 6 },
  input: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: "#0f172a",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  textArea: { minHeight: 80 },
  submitBtn: { backgroundColor: "#059669", padding: 14, borderRadius: 10, alignItems: "center", marginTop: 8 },
  submitDisabled: { opacity: 0.7 },
  submitBtnText: { color: "#fff", fontWeight: "600" },
});
