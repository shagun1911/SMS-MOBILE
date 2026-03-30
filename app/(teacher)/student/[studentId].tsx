import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  useWindowDimensions,
} from "react-native";
import Svg, { Polyline, Circle, Line, Text as SvgText } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import api from "@/lib/api";
import { API_BASE_URL } from "@/constants/env";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useRegisterScreenRefresh } from "@/hooks/useRegisterScreenRefresh";

const ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

function resolvePhotoUrl(photo?: string | null): string | undefined {
  if (!photo || photo === "default-student.png") return undefined;
  if (photo.startsWith("http")) return photo;
  return ORIGIN + (photo.startsWith("/") ? photo : `/${photo}`);
}

function formatExamType(t?: string) {
  if (!t) return "";
  return t.replace(/_/g, " ");
}

function gradeColors(grade: string) {
  if (grade === "A+" || grade === "A")
    return { bg: "#ecfdf5", text: "#059669", border: "#a7f3d0" };
  if (grade === "B+" || grade === "B")
    return { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" };
  if (grade === "C")
    return { bg: "#fffbeb", text: "#d97706", border: "#fde68a" };
  return { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" };
}

function subjectPctColor(pct: number) {
  if (pct >= 60) return "#059669";
  if (pct >= 40) return "#d97706";
  return "#dc2626";
}

/** Populated `busId` from GET /students/:id after backend populate. */
function getAssignedBus(student: any): {
  routeName?: string;
  busNumber?: string;
  registrationNumber?: string;
  driverName?: string;
  driverPhone?: string;
  conductorName?: string;
  conductorPhone?: string;
} | null {
  const b = student?.busId;
  if (b && typeof b === "object" && b !== null && b._id) {
    return b;
  }
  return null;
}

/** Line chart: rank on Y (1 = top, higher = lower on screen), exams on X — matches web “lower rank is better”. */
function RankProgressChart({
  data,
}: {
  data: { label: string; rank: number; fullTitle: string }[];
}) {
  const { width: winW } = useWindowDimensions();
  const chartWidth = Math.max(280, winW - 60);
  const chartHeight = 232;
  const padLeft = 34;
  const padRight = 10;
  const padTop = 16;
  const padBottom = 6;
  const innerW = chartWidth - padLeft - padRight;
  const innerH = chartHeight - padTop - padBottom;

  const ranks = data.map((d) => d.rank);
  const rankYMax = Math.max(...ranks, 2) + 1;
  const yMin = 1;
  const yMax = rankYMax;

  const rankToY = (r: number) => {
    if (yMax <= yMin) return padTop + innerH / 2;
    const t = (r - yMin) / (yMax - yMin);
    return padTop + t * innerH;
  };

  const indexToX = (i: number) => {
    const n = data.length;
    if (n <= 1) return padLeft + innerW / 2;
    return padLeft + (i / (n - 1)) * innerW;
  };

  const pts = data.map((d, i) => ({
    x: indexToX(i),
    y: rankToY(d.rank),
    label: d.label,
    fullTitle: d.fullTitle,
    rank: d.rank,
  }));

  const polyPoints = pts.map((p) => `${p.x},${p.y}`).join(" ");

  const gridRanks: number[] = [];
  for (let r = yMin; r <= yMax; r++) gridRanks.push(r);

  return (
    <View style={rankChartStyles.wrap}>
      <Svg width={chartWidth} height={chartHeight}>
        {gridRanks.map((r) => (
          <Line
            key={`g-${r}`}
            x1={padLeft}
            y1={rankToY(r)}
            x2={padLeft + innerW}
            y2={rankToY(r)}
            stroke="#e5e7eb"
            strokeWidth={1}
            strokeDasharray="4,6"
          />
        ))}
        <Line
          x1={padLeft}
          y1={padTop}
          x2={padLeft}
          y2={padTop + innerH}
          stroke="#d1d5db"
          strokeWidth={1}
        />
        <Line
          x1={padLeft}
          y1={padTop + innerH}
          x2={padLeft + innerW}
          y2={padTop + innerH}
          stroke="#d1d5db"
          strokeWidth={1}
        />
        {gridRanks.map((r) => (
          <SvgText
            key={`y-${r}`}
            x={2}
            y={rankToY(r) + 4}
            fontSize={10}
            fill="#6b7280"
          >
            {String(r)}
          </SvgText>
        ))}
        <SvgText x={2} y={12} fontSize={9} fill="#9ca3af">
          Rank
        </SvgText>
        {pts.length > 1 ? (
          <Polyline
            points={polyPoints}
            fill="none"
            stroke="#4f46e5"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {pts.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={6}
            fill="#4f46e5"
            stroke="#ffffff"
            strokeWidth={2}
          />
        ))}
      </Svg>
      <View style={rankChartStyles.labelsRow}>
        {data.map((d, i) => (
          <Text key={i} style={rankChartStyles.xLabel} numberOfLines={1}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const rankChartStyles = StyleSheet.create({
  wrap: { marginTop: 4, alignSelf: "center" },
  labelsRow: { flexDirection: "row", marginTop: 6, paddingHorizontal: 4 },
  xLabel: {
    flex: 1,
    fontSize: 10,
    color: "#64748b",
    textAlign: "center",
  },
});

export default function TeacherStudentProfileScreen() {
  const router = useRouter();
  const { studentId, className, section } = useLocalSearchParams<{
    studentId: string;
    className?: string;
    section?: string;
  }>();

  const [student, setStudent] = useState<any>(null);
  const [examResults, setExamResults] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudentData = useCallback(async () => {
    if (!studentId) return;
    setError(null);
    try {
      const sRes = await api.get(`/students/${studentId}`);
      setStudent(sRes.data.data);

      const examsRes = await api.get("/exams");
      const exams = examsRes.data?.data ?? [];
      const allResults: any[] = [];
      for (const exam of exams) {
        try {
          const res = await api.get(`/exams/${exam._id}/results`);
          const results = res.data?.data ?? [];
          const match = results.find((r: any) => {
            const sid = r.studentId?._id || r.studentId;
            return String(sid) === String(studentId);
          });
          if (match) {
            const sorted = [...results].sort(
              (a: any, b: any) =>
                (b.percentage || 0) - (a.percentage || 0) ||
                (b.totalObtained || 0) - (a.totalObtained || 0)
            );
            const idx = sorted.findIndex((r: any) => {
              const sid = r.studentId?._id || r.studentId;
              return String(sid) === String(studentId);
            });
            const computedRank = idx >= 0 ? idx + 1 : undefined;
            allResults.push({
              ...match,
              examId: exam._id,
              examTitle: exam.title,
              examType: exam.type,
              examDate: exam.startDate,
              rank: match.rank ?? computedRank,
            });
          }
        } catch {
          /* skip exam */
        }
      }
      setExamResults(allResults);

      try {
        const ledRes = await api.get(`/fees/ledger/${studentId}`);
        const ledger = ledRes.data?.data ?? [];
        const flat: any[] = [];
        for (const row of ledger) {
          for (const p of row.payments || []) {
            flat.push({
              amountPaid: p.amount,
              paymentDate: p.paymentDate,
              paymentMode: p.paymentMode,
              receiptNumber: p.receiptNumber,
            });
          }
        }
        flat.sort(
          (a, b) =>
            new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
        );
        setPayments(flat.slice(0, 30));
      } catch {
        setPayments([]);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Could not load student.");
      setStudent(null);
    }
  }, [studentId]);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      await fetchStudentData();
    } finally {
      setLoading(false);
    }
  }, [studentId, fetchStudentData]);

  useEffect(() => {
    load();
  }, [load]);

  const pullReload = useCallback(async () => {
    await fetchStudentData();
  }, [fetchStudentData]);
  useRegisterScreenRefresh(pullReload);

  const fmt = (n: number) =>
    `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const overallPercentage = useMemo(() => {
    if (!examResults.length) return null;
    const sum = examResults.reduce((s, r) => s + (r.percentage || 0), 0);
    return (sum / examResults.length).toFixed(1);
  }, [examResults]);

  const rankChartData = useMemo(() => {
    return (examResults ?? [])
      .filter((r: any) => r.rank != null && Number(r.rank) > 0)
      .map((r: any) => ({
        label:
          (r.examTitle || "Exam").length > 8
            ? `${(r.examTitle || "Ex").slice(0, 6)}…`
            : r.examTitle || "Exam",
        fullTitle: r.examTitle || "Exam",
        rank: Number(r.rank),
        examDate: r.examDate ? new Date(r.examDate).getTime() : 0,
      }))
      .sort((a, b) => a.examDate - b.examDate);
  }, [examResults]);

  const clsLine =
    className && section
      ? `Class ${className}-${section}`
      : student
      ? `Class ${student.class}-${student.section}`
      : "";

  if (!studentId) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Text style={styles.err}>Missing student.</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !student) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.err}>{error ?? "Student not found."}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const photoUri = resolvePhotoUrl(student.photo);
  const assignedBus = student.usesTransport ? getAssignedBus(student) : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <RefreshableScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroRow}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetters}>
                {student.firstName?.[0]}
                {student.lastName?.[0]}
              </Text>
            </View>
          )}
          <View style={styles.heroText}>
            <Text style={styles.name}>
              {student.firstName} {student.lastName}
            </Text>
            <Text style={styles.subline}>
              {student.admissionNumber}
              {clsLine ? ` · ${clsLine}` : ""}
              {student.fatherName ? ` · S/o ${student.fatherName}` : ""}
            </Text>
          </View>
        </View>

        <View style={styles.statGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Total fee</Text>
            <Text style={[styles.statValue, { color: "#2563eb" }]}>
              {fmt(student.totalYearlyFee)}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Paid</Text>
            <Text style={[styles.statValue, { color: "#059669" }]}>
              {fmt(student.paidAmount)}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Due</Text>
            <Text
              style={[
                styles.statValue,
                { color: student.dueAmount > 0 ? "#e11d48" : "#059669" },
              ]}
            >
              {fmt(student.dueAmount)}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Avg. score</Text>
            <Text style={[styles.statValue, { color: "#7c3aed" }]}>
              {overallPercentage ? `${overallPercentage}%` : "—"}
            </Text>
          </View>
        </View>

        <View style={styles.contactCard}>
          {student.phone ? (
            <Text style={styles.contactLine}>📞 {student.phone}</Text>
          ) : null}
          {student.fatherName ? (
            <Text style={styles.contactLine}>
              Father: <Text style={styles.contactStrong}>{student.fatherName}</Text>
            </Text>
          ) : null}
          {student.motherName ? (
            <Text style={styles.contactLine}>
              Mother: <Text style={styles.contactStrong}>{student.motherName}</Text>
            </Text>
          ) : null}
        </View>

        <View style={styles.transportCard}>
          <Text style={styles.transportTitle}>School bus (home ↔ school)</Text>
          {!student.usesTransport ? (
            <Text style={styles.transportNone}>
              This student is not using school bus transport.
            </Text>
          ) : assignedBus ? (
            <>
              <Text style={styles.transportRoute}>
                {assignedBus.routeName || "Route"}
              </Text>
              <Text style={styles.transportMeta}>
                Vehicle{" "}
                <Text style={styles.transportStrong}>
                  {assignedBus.busNumber || "—"}
                </Text>
                {assignedBus.registrationNumber
                  ? ` · Reg ${assignedBus.registrationNumber}`
                  : ""}
              </Text>
              {assignedBus.driverName || assignedBus.driverPhone ? (
                <Text style={styles.transportMeta}>
                  Driver:{" "}
                  <Text style={styles.transportStrong}>
                    {assignedBus.driverName || "—"}
                  </Text>
                  {assignedBus.driverPhone ? ` · ${assignedBus.driverPhone}` : ""}
                </Text>
              ) : null}
              {assignedBus.conductorName || assignedBus.conductorPhone ? (
                <Text style={styles.transportMeta}>
                  Conductor:{" "}
                  <Text style={styles.transportStrong}>
                    {assignedBus.conductorName || "—"}
                  </Text>
                  {assignedBus.conductorPhone
                    ? ` · ${assignedBus.conductorPhone}`
                    : ""}
                </Text>
              ) : null}
              <Text style={styles.transportHint}>
                Same bus is used for pick-up and drop unless the school informs
                you otherwise.
              </Text>
            </>
          ) : (
            <Text style={styles.transportNone}>
              School transport is enabled, but no bus is assigned yet.
            </Text>
          )}
        </View>

        {!examResults.length ? null : rankChartData.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Exam rank progress</Text>
            <Text style={styles.sectionHint}>
              Rank in each test (lower is better).
            </Text>
            <RankProgressChart data={rankChartData} />
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Exam results</Text>
        {examResults.length === 0 ? (
          <Text style={styles.muted}>No exam results for this student yet.</Text>
        ) : (
          examResults.map((r: any, i: number) => {
            const g = gradeColors(r.grade || "F");
            const examKey = r.examId || r._id || i;
            return (
              <View key={String(examKey)} style={styles.examCard}>
                <View style={styles.examHeader}>
                  <View>
                    <Text style={styles.examName}>{r.examTitle || "Exam"}</Text>
                    <Text style={styles.examMeta}>
                      {formatExamType(r.examType)}
                      {r.examDate
                        ? ` · ${new Date(r.examDate).toLocaleDateString("en-IN", {
                            month: "short",
                            year: "numeric",
                          })}`
                        : ""}
                    </Text>
                  </View>
                  <View style={styles.examRight}>
                    <Text style={styles.examPct}>
                      {r.percentage != null ? `${Number(r.percentage).toFixed(1)}%` : "—"}
                    </Text>
                    <View
                      style={[
                        styles.gradePill,
                        { backgroundColor: g.bg, borderColor: g.border },
                      ]}
                    >
                      <Text style={[styles.gradeText, { color: g.text }]}>
                        Grade {r.grade ?? "—"}
                      </Text>
                    </View>
                  </View>
                </View>
                {Array.isArray(r.subjects) && r.subjects.length > 0 ? (
                  <View style={styles.subjGrid}>
                    {r.subjects.map((sub: any, j: number) => {
                      const pct =
                        sub.maxMarks > 0
                          ? (sub.obtainedMarks / sub.maxMarks) * 100
                          : 0;
                      return (
                        <View key={j} style={styles.subjCell}>
                          <Text style={styles.subjName} numberOfLines={1}>
                            {sub.subject}
                          </Text>
                          <Text style={styles.subjMarks}>
                            {sub.obtainedMarks}/{sub.maxMarks}
                            <Text
                              style={{ color: subjectPctColor(pct), fontWeight: "600" }}
                            >
                              {" "}
                              ({pct.toFixed(0)}%)
                            </Text>
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Fee payments</Text>
        {payments.length === 0 ? (
          <Text style={styles.muted}>No payment records in the current session.</Text>
        ) : (
          <View style={styles.card}>
            {payments.map((p: any, idx: number) => (
              <View
                key={idx}
                style={[
                  styles.payRow,
                  idx < payments.length - 1 && styles.payRowBorder,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.payDate}>
                    {p.paymentDate
                      ? new Date(p.paymentDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </Text>
                  <Text style={styles.payReceipt}>{p.receiptNumber || "—"}</Text>
                </View>
                <Text style={styles.payAmt}>{fmt(p.amountPaid)}</Text>
                <Text style={styles.payMode}>
                  {(p.paymentMode || "—").replace(/_/g, " ")}
                </Text>
              </View>
            ))}
          </View>
        )}
      </RefreshableScrollView>
    </SafeAreaView>
  );
}

const { width: W } = Dimensions.get("window");

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, maxWidth: W },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  headerBar: { marginBottom: 8 },
  backBtn: { alignSelf: "flex-start", paddingVertical: 8, paddingRight: 12 },
  backText: { fontSize: 16, color: "#059669", fontWeight: "600" },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: "#e2e8f0" },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#e0e7ff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#c7d2fe",
  },
  avatarLetters: { fontSize: 18, fontWeight: "700", color: "#4f46e5" },
  heroText: { flex: 1, minWidth: 0 },
  name: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  subline: { fontSize: 13, color: "#64748b", marginTop: 4 },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  statCell: {
    width: (W - 16 * 2 - 10) / 2,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statLabel: {
    fontSize: 10,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: { fontSize: 18, fontWeight: "700", marginTop: 4 },
  contactCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
    gap: 6,
  },
  contactLine: { fontSize: 14, color: "#475569" },
  contactStrong: { fontWeight: "600", color: "#0f172a" },
  transportCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
  },
  transportTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
  },
  transportRoute: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f766e",
    marginBottom: 6,
  },
  transportMeta: { fontSize: 13, color: "#64748b", marginTop: 4 },
  transportStrong: { fontWeight: "600", color: "#0f172a" },
  transportHint: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 12,
    lineHeight: 17,
  },
  transportNone: { fontSize: 14, color: "#64748b", lineHeight: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  sectionHint: { fontSize: 12, color: "#64748b", marginBottom: 4 },
  muted: { fontSize: 14, color: "#94a3b8", marginBottom: 12 },
  examCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  examHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  examName: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  examMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  examRight: { alignItems: "flex-end" },
  examPct: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  gradePill: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  gradeText: { fontSize: 10, fontWeight: "600" },
  subjGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subjCell: {
    width: (W - 16 * 2 - 8) / 2,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 10,
  },
  subjName: { fontSize: 11, color: "#64748b" },
  subjMarks: { fontSize: 14, fontWeight: "600", color: "#0f172a", marginTop: 4 },
  payRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 8 },
  payRowBorder: { borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  payDate: { fontSize: 13, color: "#475569" },
  payReceipt: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  payAmt: {
    fontSize: 14,
    fontWeight: "700",
    color: "#059669",
    minWidth: 72,
    textAlign: "right",
  },
  payMode: { fontSize: 12, color: "#64748b", flex: 0.8, textAlign: "right" },
  err: { color: "#b91c1c", textAlign: "center", padding: 16 },
});
