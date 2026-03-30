import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "@/lib/api";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useRegisterScreenRefresh } from "@/hooks/useRegisterScreenRefresh";

export default function TeacherMarksScreen() {
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [marksOpen, setMarksOpen] = useState(false);

  const [creatingExam, setCreatingExam] = useState(false);
  const [savingMarks, setSavingMarks] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [examForm, setExamForm] = useState({
    title: "",
    type: "unit_test",
    startDate: "",
    endDate: "",
    classes: [] as string[],
  });

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [subjects, setSubjects] = useState<any[]>([{ subject: "Mathematics", maxMarks: 100 }]);
  const [studentMarks, setStudentMarks] = useState<any[]>([]);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [showSectionPicker, setShowSectionPicker] = useState(false);

  const loadBaseData = useCallback(async () => {
    const [eRes, cRes, sRes] = await Promise.all([
      api.get("/exams"),
      api.get("/classes"),
      api.get("/sessions"),
    ]);
    setExams(eRes.data.data ?? []);
    setClasses(cRes.data.data ?? []);
    setSessions(sRes.data.data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadBaseData();
      } catch {
        Alert.alert("Error", "Failed to load exams data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadBaseData]);

  const pullReload = useCallback(async () => {
    try {
      await loadBaseData();
    } catch {
      Alert.alert("Error", "Failed to load exams data.");
    }
  }, [loadBaseData]);
  useRegisterScreenRefresh(pullReload);

  const activeSession = useMemo(
    () => (sessions ?? []).find((s: any) => s.isActive),
    [sessions]
  );

  const classSectionMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const cls of classes) {
      const className = String(cls.className ?? "").trim();
      const section = String(cls.section ?? "").trim().toUpperCase();
      if (!className || !section) continue;
      if (!map[className]) map[className] = [];
      if (!map[className].includes(section)) map[className].push(section);
    }
    Object.keys(map).forEach((k) => map[k].sort((a, b) => a.localeCompare(b)));
    return map;
  }, [classes]);

  const uniqueClasses = useMemo(
    () =>
      Object.keys(classSectionMap).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      ),
    [classSectionMap]
  );

  const examClassOptions = useMemo(() => {
    if (!selectedExam?.classes?.length) return uniqueClasses;
    return selectedExam.classes;
  }, [selectedExam, uniqueClasses]);

  const sectionsForSelectedClass = classSectionMap[selectedClass] ?? [];

  const openMarksModal = (exam: any) => {
    setSelectedExam(exam);
    setMarksOpen(true);
    setSelectedClass("");
    setSelectedSection("");
    setSubjects([{ subject: "Mathematics", maxMarks: 100 }]);
    setStudentMarks([]);
  };

  const toggleExamClass = (className: string) => {
    setExamForm((prev) => ({
      ...prev,
      classes: prev.classes.includes(className)
        ? prev.classes.filter((c) => c !== className)
        : [...prev.classes, className],
    }));
  };

  const createExam = async () => {
    if (
      !examForm.title.trim() ||
      !examForm.startDate ||
      !examForm.endDate ||
      examForm.classes.length === 0
    ) {
      Alert.alert("Missing fields", "Please fill all required exam fields.");
      return;
    }
    if (!activeSession?._id) {
      Alert.alert("No active session", "Please create/activate a session first.");
      return;
    }
    setCreatingExam(true);
    try {
      await api.post("/exams", {
        title: examForm.title.trim(),
        type: examForm.type,
        startDate: new Date(examForm.startDate),
        endDate: new Date(examForm.endDate),
        classes: examForm.classes,
        sessionId: activeSession._id,
      });
      setCreateOpen(false);
      setExamForm({
        title: "",
        type: "unit_test",
        startDate: "",
        endDate: "",
        classes: [],
      });
      Alert.alert("Success", "Exam created successfully.");
      const eRes = await api.get("/exams");
      setExams(eRes.data.data ?? []);
    } catch (error: any) {
      Alert.alert("Create failed", error?.response?.data?.message ?? "Failed to create exam.");
    } finally {
      setCreatingExam(false);
    }
  };

  const parseNumber = (value: any) => {
    if (typeof value === "number" && !Number.isNaN(value)) return Math.max(0, value);
    const n = parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
    return Number.isNaN(n) ? 0 : Math.max(0, n);
  };

  const loadStudentsAndHydrateMarks = async (examId: string, className: string, section: string) => {
    if (!examId || !className || !section) return;
    setStudentsLoading(true);
    try {
      const [studentsRes, resultsRes] = await Promise.all([
        api.get(
          `/students?class=${encodeURIComponent(className)}&section=${encodeURIComponent(section)}&limit=200`
        ),
        api.get(`/exams/${examId}/results`),
      ]);

      const students = studentsRes.data.data ?? [];
      const allResults = resultsRes.data.data ?? [];
      const resultsForClassSection = allResults.filter(
        (r: any) => String(r.class) === className && String(r.section).toUpperCase() === section.toUpperCase()
      );

      let effectiveSubjects = subjects;
      if (resultsForClassSection.length > 0) {
        const subjectDefs = (resultsForClassSection[0]?.subjects ?? []).map((s: any) => ({
          subject: String(s.subject ?? "").trim() || "Subject",
          maxMarks: parseNumber(s.maxMarks) || 100,
        }));
        if (subjectDefs.length > 0) {
          effectiveSubjects = subjectDefs;
          setSubjects(subjectDefs);
        }
      }

      const rows = students.map((s: any) => {
        const result = resultsForClassSection.find((r: any) => {
          const sid = r.studentId?._id ?? r.studentId;
          return String(sid) === String(s._id);
        });

        const rowSubjects = effectiveSubjects.map((sub: any) => {
          const saved = result?.subjects?.find(
            (x: any) => String(x.subject ?? "").trim().toLowerCase() === String(sub.subject).trim().toLowerCase()
          );
          return {
            subject: sub.subject,
            maxMarks: parseNumber(sub.maxMarks) || 100,
            obtainedMarks: saved != null ? parseNumber(saved.obtainedMarks) : 0,
          };
        });

        return {
          studentId: s._id,
          name: `${s.firstName} ${s.lastName}`,
          subjects: rowSubjects,
        };
      });

      setStudentMarks(rows);
    } catch (_) {
      setStudentMarks([]);
      Alert.alert("Error", "Failed to load students/marks.");
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    if (!marksOpen || !selectedExam?._id || !selectedClass || !selectedSection) return;
    loadStudentsAndHydrateMarks(selectedExam._id, selectedClass, selectedSection);
  }, [marksOpen, selectedExam, selectedClass, selectedSection]);

  const addSubjectColumn = () => {
    const nextSubjects = [...subjects, { subject: "", maxMarks: 100 }];
    setSubjects(nextSubjects);
    setStudentMarks((prev) =>
      prev.map((row) => ({
        ...row,
        subjects: [...row.subjects, { subject: "", maxMarks: 100, obtainedMarks: 0 }],
      }))
    );
  };

  const updateSubject = (index: number, key: "subject" | "maxMarks", value: string) => {
    const nextSubjects = subjects.map((s, i) =>
      i === index ? { ...s, [key]: key === "maxMarks" ? parseNumber(value) : value } : s
    );
    setSubjects(nextSubjects);
    setStudentMarks((prev) =>
      prev.map((row) => ({
        ...row,
        subjects: row.subjects.map((s: any, i: number) =>
          i === index ? { ...s, [key]: key === "maxMarks" ? parseNumber(value) : value } : s
        ),
      }))
    );
  };

  const updateStudentMark = (studentIndex: number, subjectIndex: number, value: string) => {
    setStudentMarks((prev) =>
      prev.map((row, i) =>
        i !== studentIndex
          ? row
          : {
              ...row,
              subjects: row.subjects.map((s: any, j: number) =>
                j !== subjectIndex ? s : { ...s, obtainedMarks: parseNumber(value) }
              ),
            }
      )
    );
  };

  const saveMarks = async () => {
    if (!selectedExam?._id || !selectedClass || !selectedSection || studentMarks.length === 0) {
      Alert.alert("Missing data", "Please select exam, class, section and students.");
      return;
    }
    setSavingMarks(true);
    try {
      const results = studentMarks.map((sm: any) => ({
        studentId: sm.studentId,
        subjects: sm.subjects.map((s: any) => ({
          subject: String(s.subject ?? "").trim() || "Subject",
          maxMarks: parseNumber(s.maxMarks) || 100,
          obtainedMarks: parseNumber(s.obtainedMarks),
        })),
      }));
      await api.post(`/exams/${selectedExam._id}/results`, { results });
      Alert.alert("Saved", "Marks saved successfully.");
      await loadStudentsAndHydrateMarks(selectedExam._id, selectedClass, selectedSection);
    } catch (error: any) {
      Alert.alert("Save failed", error?.response?.data?.message ?? "Failed to save marks.");
    } finally {
      setSavingMarks(false);
    }
  };

  useEffect(() => {
    if (!marksOpen) {
      setSelectedClass("");
      setSelectedSection("");
      setSubjects([{ subject: "Mathematics", maxMarks: 100 }]);
      setStudentMarks([]);
    }
  }, [marksOpen]);

  const examTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      unit_test: "Unit Test",
      quarterly: "Quarterly",
      half_yearly: "Half-Yearly",
      annual: "Annual",
    };
    return map[type] ?? type ?? "Exam";
  };

  const examsSorted = [...exams].sort(
    (a: any, b: any) => new Date(b.startDate ?? 0).getTime() - new Date(a.startDate ?? 0).getTime()
  );

  const upcoming = examsSorted.filter(
    (e: any) => e.status === "scheduled" || e.status === "upcoming" || !e.status
  );
  const completed = examsSorted.filter((e: any) => e.status === "completed");

  const ExamCard = ({ exam }: { exam: any }) => (
    <View style={styles.card}>
      <Text style={styles.cardBadge}>{examTypeLabel(exam.type)}</Text>
      <Text style={styles.cardTitle}>{exam.title ?? "Examination"}</Text>
      {exam.startDate && (
        <Text style={styles.cardMeta}>
          {new Date(exam.startDate).toLocaleDateString()}
          {exam.endDate ? ` - ${new Date(exam.endDate).toLocaleDateString()}` : ""}
        </Text>
      )}
      {!!exam.classes?.length && (
        <Text style={styles.cardMeta}>Classes: {exam.classes.join(", ")}</Text>
      )}
      <TouchableOpacity style={styles.enterBtn} onPress={() => openMarksModal(exam)}>
        <Text style={styles.enterBtnText}>Enter Marks</Text>
      </TouchableOpacity>
    </View>
  );

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
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Exams & Marks</Text>
            <Text style={styles.subtitle}>Create exam and enter marks by class/section</Text>
          </View>
          <TouchableOpacity style={styles.createBtn} onPress={() => setCreateOpen(true)}>
            <Text style={styles.createBtnText}>+ Create Exam</Text>
          </TouchableOpacity>
        </View>

        {exams.length === 0 ? (
          <Text style={styles.empty}>No exams created yet.</Text>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Upcoming</Text>
                {upcoming.map((exam: any) => <ExamCard key={exam._id} exam={exam} />)}
              </>
            )}
            {completed.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Completed</Text>
                {completed.map((exam: any) => <ExamCard key={exam._id} exam={exam} />)}
              </>
            )}
          </>
        )}
      </RefreshableScrollView>

      <Modal visible={createOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Examination</Text>
              <TouchableOpacity onPress={() => setCreateOpen(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Exam Title *</Text>
              <TextInput
                style={styles.input}
                value={examForm.title}
                onChangeText={(v) => setExamForm({ ...examForm, title: v })}
                placeholder="e.g. Mid-Term Examination"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.label}>Exam Type *</Text>
              <View style={styles.rowWrap}>
                {["unit_test", "quarterly", "half_yearly", "annual"].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, examForm.type === t && styles.chipActive]}
                    onPress={() => setExamForm({ ...examForm, type: t })}
                  >
                    <Text style={examForm.type === t ? styles.chipTextActive : styles.chipText}>
                      {examTypeLabel(t)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Session</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={activeSession?.sessionYear ?? "No active session"}
                editable={false}
              />

              <Text style={styles.label}>Start Date *</Text>
              <TextInput
                style={styles.input}
                value={examForm.startDate}
                onChangeText={(v) => setExamForm({ ...examForm, startDate: v })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.label}>End Date *</Text>
              <TextInput
                style={styles.input}
                value={examForm.endDate}
                onChangeText={(v) => setExamForm({ ...examForm, endDate: v })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.label}>Select Classes *</Text>
              <View style={styles.rowWrap}>
                {uniqueClasses.map((className) => (
                  <TouchableOpacity
                    key={className}
                    style={[
                      styles.chip,
                      examForm.classes.includes(className) && styles.chipActive,
                    ]}
                    onPress={() => toggleExamClass(className)}
                  >
                    <Text
                      style={
                        examForm.classes.includes(className)
                          ? styles.chipTextActive
                          : styles.chipText
                      }
                    >
                      Class {className}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, creatingExam && styles.submitDisabled]}
                onPress={createExam}
                disabled={creatingExam}
              >
                {creatingExam ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Create Exam</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={marksOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enter Marks - {selectedExam?.title ?? "Exam"}</Text>
              <TouchableOpacity onPress={() => setMarksOpen(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Class *</Text>
              <TouchableOpacity style={styles.selectInput} onPress={() => setShowClassPicker(true)}>
                <Text style={selectedClass ? styles.selectText : styles.selectPlaceholder}>
                  {selectedClass ? `Class ${selectedClass}` : "Select class"}
                </Text>
              </TouchableOpacity>

              <Text style={styles.label}>Section *</Text>
              <TouchableOpacity
                style={[styles.selectInput, !selectedClass && styles.inputDisabled]}
                onPress={() => selectedClass && setShowSectionPicker(true)}
                disabled={!selectedClass}
              >
                <Text style={selectedSection ? styles.selectText : styles.selectPlaceholder}>
                  {selectedSection ? `Section ${selectedSection}` : "Select section"}
                </Text>
              </TouchableOpacity>

              <View style={styles.subjectHeader}>
                <Text style={styles.label}>Subjects</Text>
                <TouchableOpacity style={styles.smallBtn} onPress={addSubjectColumn}>
                  <Text style={styles.smallBtnText}>+ Add Subject</Text>
                </TouchableOpacity>
              </View>

              {subjects.map((sub, idx) => (
                <View key={idx} style={styles.subjectRow}>
                  <TextInput
                    style={[styles.input, styles.subjectNameInput]}
                    value={sub.subject}
                    onChangeText={(v) => updateSubject(idx, "subject", v)}
                    placeholder="Subject"
                    placeholderTextColor="#94a3b8"
                  />
                  <TextInput
                    style={[styles.input, styles.subjectMaxInput]}
                    value={String(sub.maxMarks)}
                    onChangeText={(v) => updateSubject(idx, "maxMarks", v)}
                    placeholder="Max"
                    keyboardType="numeric"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              ))}

              <Text style={styles.label}>Students</Text>
              {studentsLoading ? (
                <ActivityIndicator style={{ marginVertical: 16 }} color="#059669" />
              ) : studentMarks.length === 0 ? (
                <Text style={styles.empty}>Select class and section to load students.</Text>
              ) : (
                studentMarks.map((row: any, studentIndex: number) => (
                  <View key={row.studentId} style={styles.studentCard}>
                    <Text style={styles.studentName}>{row.name}</Text>
                    {row.subjects.map((sub: any, subjectIndex: number) => (
                      <View key={`${row.studentId}-${subjectIndex}`} style={styles.markRow}>
                        <Text style={styles.markLabel}>
                          {sub.subject || "Subject"} (/{sub.maxMarks || 100})
                        </Text>
                        <TextInput
                          style={styles.markInput}
                          value={String(sub.obtainedMarks ?? 0)}
                          onChangeText={(v) => updateStudentMark(studentIndex, subjectIndex, v)}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#94a3b8"
                        />
                      </View>
                    ))}
                  </View>
                ))
              )}

              <TouchableOpacity
                style={[styles.submitBtn, savingMarks && styles.submitDisabled]}
                onPress={saveMarks}
                disabled={savingMarks || studentsLoading}
              >
                {savingMarks ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Marks</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showClassPicker} animationType="slide" transparent>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerBox}>
            <Text style={styles.pickerTitle}>Select Class</Text>
            <ScrollView>
              {examClassOptions.map((className: string) => (
                <TouchableOpacity
                  key={className}
                  style={styles.pickerRow}
                  onPress={() => {
                    setSelectedClass(className);
                    setSelectedSection("");
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
              {sectionsForSelectedClass.map((section) => (
                <TouchableOpacity
                  key={section}
                  style={styles.pickerRow}
                  onPress={() => {
                    setSelectedSection(section);
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
  },
  headerTextWrap: { flex: 1, paddingRight: 6 },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#64748b" },
  createBtn: {
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    flexShrink: 0,
  },
  createBtnText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  empty: { color: "#64748b", paddingVertical: 24 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#475569", marginBottom: 12, marginTop: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardBadge: { fontSize: 11, color: "#7c3aed", marginBottom: 4 },
  cardTitle: { fontWeight: "600", color: "#0f172a" },
  cardMeta: { fontSize: 12, color: "#64748b", marginTop: 4 },
  enterBtn: {
    marginTop: 10,
    backgroundColor: "#059669",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  enterBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a", flex: 1, paddingRight: 12 },
  modalClose: { color: "#64748b", fontSize: 15 },
  label: { fontSize: 13, fontWeight: "500", color: "#475569", marginBottom: 6 },
  input: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#0f172a",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  inputDisabled: { opacity: 0.65 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "#e2e8f0",
  },
  chipActive: { backgroundColor: "#059669" },
  chipText: { color: "#475569", fontSize: 12, fontWeight: "500" },
  chipTextActive: { color: "#fff", fontSize: 12, fontWeight: "500" },
  selectInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  selectText: { fontSize: 15, color: "#0f172a" },
  selectPlaceholder: { fontSize: 15, color: "#94a3b8" },
  subjectHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  smallBtn: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallBtnText: { color: "#065f46", fontSize: 12, fontWeight: "600" },
  subjectRow: { flexDirection: "row", gap: 8 },
  subjectNameInput: { flex: 1 },
  subjectMaxInput: { width: 90 },
  studentCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  studentName: { fontWeight: "600", color: "#0f172a", marginBottom: 8 },
  markRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  markLabel: { color: "#475569", fontSize: 13, flex: 1, paddingRight: 10 },
  markInput: {
    width: 80,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    color: "#0f172a",
    textAlign: "center",
  },
  submitBtn: {
    backgroundColor: "#059669",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 8,
  },
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
