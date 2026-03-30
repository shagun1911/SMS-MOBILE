import { useCallback, useEffect, useState } from "react";
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
  Alert,
  Image,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import api, { postMultipart } from "@/lib/api";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useRegisterScreenRefresh } from "@/hooks/useRegisterScreenRefresh";

const MAX_HOMEWORK_FILES = 8;

const HOMEWORK_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

type PendingFile = { uri: string; name: string; mimeType?: string };

type AttachmentItem = { url: string; filename?: string; mimeType?: string };

function homeworkAttachmentList(hw: any): AttachmentItem[] {
  if (Array.isArray(hw.attachments) && hw.attachments.length > 0) {
    return hw.attachments.filter((a: any) => a?.url);
  }
  if (hw.attachmentUrl) {
    return [{ url: hw.attachmentUrl, filename: "Attachment" }];
  }
  return [];
}

function isImageAttachment(item: AttachmentItem): boolean {
  if (item.mimeType?.startsWith("image/")) return true;
  const u = item.url.toLowerCase();
  return /(\.png|\.jpe?g|\.webp)(\?|$)/.test(u) || u.includes("/image/upload/");
}

export default function TeacherHomeworkScreen() {
  const [homework, setHomework] = useState<any[]>([]);
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [sectionsByClass, setSectionsByClass] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const [form, setForm] = useState({
    className: "",
    section: "",
    subject: "",
    title: "",
    description: "",
  });
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  const load = useCallback(async () => {
    const [hRes, cRes] = await Promise.all([
      api.get("/homework"),
      api.get("/classes"),
    ]);
    setHomework(hRes.data.data ?? []);
    const classesRaw = cRes.data.data ?? [];
    const sectionMap: Record<string, Set<string>> = {};
    for (const cls of classesRaw) {
      const className = String(cls.className ?? "").trim();
      const section = String(cls.section ?? "").trim().toUpperCase();
      if (!className || !section) continue;
      if (!sectionMap[className]) sectionMap[className] = new Set<string>();
      sectionMap[className].add(section);
    }

    const classNames = Object.keys(sectionMap).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
    const normalizedMap: Record<string, string[]> = {};
    for (const className of classNames) {
      normalizedMap[className] = Array.from(sectionMap[className]).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      );
    }

    setClassOptions(classNames);
    setSectionsByClass(normalizedMap);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await load();
      } catch {
        Alert.alert("Error", "Failed to load homework data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const pullReload = useCallback(async () => {
    try {
      await load();
    } catch {
      Alert.alert("Error", "Failed to load homework data.");
    }
  }, [load]);
  useRegisterScreenRefresh(pullReload);

  const sections = sectionsByClass[form.className] ?? [];

  const pickAttachments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [...HOMEWORK_MIME_TYPES],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return;
      const assets = result.assets ?? [];
      setPendingFiles((prev) => {
        const room = MAX_HOMEWORK_FILES - prev.length;
        if (room <= 0) {
          Alert.alert("Limit", `You can attach up to ${MAX_HOMEWORK_FILES} files per homework.`);
          return prev;
        }
        const toAdd = assets.slice(0, room);
        if (assets.length > room) {
          Alert.alert(
            "Limit",
            `Only ${room} more file(s) added (maximum ${MAX_HOMEWORK_FILES} per homework).`
          );
        }
        return [
          ...prev,
          ...toAdd.map((a) => ({
            uri: a.uri,
            name: a.name || "file",
            mimeType: a.mimeType || undefined,
          })),
        ];
      });
    } catch {
      Alert.alert("Error", "Could not open the file picker.");
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadHomeworkAsset = async (f: PendingFile) => {
    const formData = new FormData();
    const mime = f.mimeType || "application/octet-stream";
    const safeName =
      f.name && f.name.includes(".")
        ? f.name
        : `${f.name || "upload"}${
            mime === "image/jpeg" || mime === "image/jpg"
              ? ".jpg"
              : mime === "image/png"
                ? ".png"
                : mime === "image/webp"
                  ? ".webp"
                  : mime === "application/pdf"
                    ? ".pdf"
                    : mime === "application/msword"
                      ? ".doc"
                      : mime ===
                          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        ? ".docx"
                        : ""
          }`;
    formData.append("file", {
      uri: f.uri,
      name: safeName,
      type: mime,
    } as any);
    const json = (await postMultipart("/upload/homework", formData)) as {
      data?: { url?: string; filename?: string; mimeType?: string };
    };
    const d = json?.data;
    return {
      url: d?.url as string,
      filename: (d?.filename as string) || safeName,
      mimeType: (d?.mimeType as string) || mime,
    };
  };

  const submit = async () => {
    if (!form.className || !form.section || !form.subject || !form.title || !form.description) {
      Alert.alert("Missing fields", "Please fill all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const uploaded: { url: string; filename?: string; mimeType?: string }[] = [];
      for (const f of pendingFiles) {
        const meta = await uploadHomeworkAsset(f);
        if (!meta.url) throw new Error("Upload missing URL");
        uploaded.push(meta);
      }
      const fallbackDueDate = new Date();
      const payload = {
        ...form,
        section: form.section.toUpperCase(),
        dueDate: fallbackDueDate.toISOString().slice(0, 10),
        ...(uploaded.length > 0 ? { attachments: uploaded } : {}),
      };
      await api.post("/homework", payload);
      setShowForm(false);
      setForm({ className: "", section: "", subject: "", title: "", description: "" });
      setPendingFiles([]);
      Alert.alert("Assigned", "Homework assigned to selected class and section students.");
      load();
    } catch (error: any) {
      const message =
        error?.response?.data?.message ?? error?.message ?? "Failed to assign homework.";
      Alert.alert("Assign failed", String(message));
    } finally {
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
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <RefreshableScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Homework</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
            <Text style={styles.addBtnText}>+ Assign</Text>
          </TouchableOpacity>
        </View>

        {homework.length === 0 ? (
          <Text style={styles.empty}>No homework assigned yet.</Text>
        ) : (
          homework.map((hw: any) => {
            const attachmentItems = homeworkAttachmentList(hw);
            return (
              <View key={hw._id} style={styles.card}>
                <View style={styles.cardBody}>
                  <Text style={styles.badge}>
                    Class {hw.className}-{hw.section} · {hw.subject}
                  </Text>
                  <Text style={styles.cardTitle}>{hw.title}</Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>{hw.description}</Text>
                  {hw.dueDate ? (
                    <Text style={styles.cardDue}>Due: {new Date(hw.dueDate).toLocaleDateString()}</Text>
                  ) : (
                    <Text style={styles.cardDue}>No due date</Text>
                  )}
                  {attachmentItems.length > 0 ? (
                    <View style={styles.attachmentsBlock}>
                      <Text style={styles.attachmentsLabel}>Attachments you shared</Text>
                      {attachmentItems.map((item, idx) => (
                        <View key={`${item.url}-${idx}`} style={styles.attachmentRow}>
                          {isImageAttachment(item) ? (
                            <TouchableOpacity
                              activeOpacity={0.85}
                              onPress={() => Linking.openURL(item.url)}
                              style={styles.previewThumbWrap}
                            >
                              <Image
                                source={{ uri: item.url }}
                                style={styles.previewThumb}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                          ) : null}
                          <Text
                            style={styles.attachmentLink}
                            onPress={() => Linking.openURL(item.url)}
                          >
                            {item.filename || `File ${idx + 1}`} →
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => deleteHw(hw._id)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <Modal visible={showForm} animationType="slide" transparent>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalOverlay}
          >
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Homework</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowForm(false);
                    setPendingFiles([]);
                  }}
                >
                  <Text style={styles.modalClose}>Cancel</Text>
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>Class</Text>
                <TouchableOpacity
                  style={styles.selectInput}
                  activeOpacity={0.8}
                  onPress={() => setShowClassPicker(true)}
                >
                  <Text style={form.className ? styles.selectText : styles.selectPlaceholder}>
                    {form.className || "Select class"}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.label}>Section</Text>
                <TouchableOpacity
                  style={[styles.selectInput, !form.className && styles.selectDisabled]}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (!form.className) return;
                    setShowSectionPicker(true);
                  }}
                  disabled={!form.className}
                >
                  <Text style={form.section ? styles.selectText : styles.selectPlaceholder}>
                    {form.section || "Select section"}
                  </Text>
                </TouchableOpacity>
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
                <Text style={styles.label}>Attachments (optional)</Text>
                <Text style={styles.hint}>
                  PNG, JPEG, WebP, PDF, Word (.doc / .docx) — up to {MAX_HOMEWORK_FILES} files
                </Text>
                <TouchableOpacity style={styles.pickFileBtn} onPress={pickAttachments}>
                  <Text style={styles.pickFileBtnText}>+ Add files</Text>
                </TouchableOpacity>
                {pendingFiles.map((f, i) => (
                  <View key={`${f.uri}-${i}`} style={styles.fileRow}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {f.name}
                    </Text>
                    <TouchableOpacity onPress={() => removePendingFile(i)}>
                      <Text style={styles.fileRemove}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
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

        <Modal visible={showClassPicker} animationType="slide" transparent>
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerBox}>
              <Text style={styles.pickerTitle}>Select Class</Text>
              <ScrollView>
                {classOptions.map((className) => (
                  <TouchableOpacity
                    key={className}
                    style={styles.pickerRow}
                    onPress={() => {
                      setForm({ ...form, className, section: "" });
                      setShowClassPicker(false);
                    }}
                  >
                    <Text style={styles.pickerRowText}>Class {className}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.pickerCloseBtn} onPress={() => setShowClassPicker(false)}>
                <Text style={styles.pickerCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showSectionPicker} animationType="slide" transparent>
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerBox}>
              <Text style={styles.pickerTitle}>Select Section</Text>
              <ScrollView>
                {sections.map((section) => (
                  <TouchableOpacity
                    key={section}
                    style={styles.pickerRow}
                    onPress={() => {
                      setForm({ ...form, section });
                      setShowSectionPicker(false);
                    }}
                  >
                    <Text style={styles.pickerRowText}>Section {section}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.pickerCloseBtn} onPress={() => setShowSectionPicker(false)}>
                <Text style={styles.pickerCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </RefreshableScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
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
  attachmentsBlock: { marginTop: 10 },
  attachmentsLabel: { fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 6 },
  attachmentRow: { marginBottom: 10 },
  previewThumbWrap: {
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f1f5f9",
  },
  previewThumb: { width: "100%", height: 120 },
  attachmentLink: { fontSize: 13, color: "#047857", fontWeight: "500" },
  deleteText: { color: "#dc2626", fontSize: 13 },
  hint: { fontSize: 12, color: "#64748b", marginBottom: 8 },
  pickFileBtn: {
    backgroundColor: "#ecfdf5",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    marginBottom: 8,
    alignItems: "center",
  },
  pickFileBtnText: { color: "#047857", fontWeight: "600" },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  fileName: { flex: 1, fontSize: 13, color: "#0f172a", marginRight: 8 },
  fileRemove: { color: "#dc2626", fontSize: 13, fontWeight: "600" },
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
  selectInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  selectText: {
    fontSize: 16,
    color: "#0f172a",
  },
  selectPlaceholder: {
    fontSize: 16,
    color: "#94a3b8",
  },
  selectDisabled: {
    opacity: 0.6,
  },
  textArea: { minHeight: 80 },
  submitBtn: { backgroundColor: "#059669", padding: 14, borderRadius: 10, alignItems: "center", marginTop: 8 },
  submitDisabled: { opacity: 0.7 },
  submitBtnText: { color: "#fff", fontWeight: "600" },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  pickerBox: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "65%",
    padding: 20,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  pickerRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  pickerRowText: {
    fontSize: 16,
    color: "#0f172a",
  },
  pickerCloseBtn: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
  },
  pickerCloseText: {
    color: "#0f172a",
    fontWeight: "600",
  },
});
