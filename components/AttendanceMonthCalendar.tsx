import { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import {
  daysInMonth,
  startWeekdaySun0,
  ymdFromParts,
} from "@/lib/absentDates";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  year: number;
  monthIndex: number;
  absentYmdSet: Set<string>;
  presentYmdSet?: Set<string>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

function chunkWeeks(cells: (number | null)[]): (number | null)[][] {
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

export function AttendanceMonthCalendar({
  year,
  monthIndex,
  absentYmdSet,
  presentYmdSet,
  onPrevMonth,
  onNextMonth,
}: Props) {
  const now = new Date();
  const todayYmd = ymdFromParts(now.getFullYear(), now.getMonth(), now.getDate());

  const { title, weeks } = useMemo(() => {
    const dim = daysInMonth(year, monthIndex);
    const pad = startWeekdaySun0(year, monthIndex);
    const cells: (number | null)[] = [];
    for (let i = 0; i < pad; i++) cells.push(null);
    for (let d = 1; d <= dim; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const t = new Date(year, monthIndex, 1).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
    return { title: t, weeks: chunkWeeks(cells) };
  }, [year, monthIndex]);

  const absentThisMonth = useMemo(() => {
    let n = 0;
    for (let d = 1; d <= daysInMonth(year, monthIndex); d++) {
      if (absentYmdSet.has(ymdFromParts(year, monthIndex, d))) n += 1;
    }
    return n;
  }, [year, monthIndex, absentYmdSet]);

  return (
    <View style={styles.wrap}>
      <View style={styles.monthRow}>
        <TouchableOpacity
          onPress={onPrevMonth}
          style={styles.monthNavBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Text style={styles.monthNavText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{title}</Text>
        <TouchableOpacity
          onPress={onNextMonth}
          style={styles.monthNavBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <Text style={styles.monthNavText}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.legend}>
        {absentThisMonth === 0
          ? "No absences this month"
          : `${absentThisMonth} absence${absentThisMonth === 1 ? "" : "s"} this month`}
      </Text>

      <View style={styles.weekHeader}>
        {WEEKDAYS.map((w) => (
          <View key={w} style={styles.weekHeaderCell}>
            <Text style={styles.weekHeaderText}>{w}</Text>
          </View>
        ))}
      </View>

      {weeks.map((row, ri) => (
        <View key={ri} style={styles.weekRow}>
          {row.map((day, ci) => {
            if (day == null) {
              return <View key={`e-${ri}-${ci}`} style={styles.dayCell} />;
            }
            const ymd = ymdFromParts(year, monthIndex, day);
            const absent = absentYmdSet.has(ymd);
            const present = !absent && Boolean(presentYmdSet?.has(ymd));
            const isToday = ymd === todayYmd;
            return (
              <View key={ymd} style={styles.dayCell}>
                <View
                  style={[
                    styles.dayInner,
                    absent && styles.dayAbsent,
                    present && styles.dayPresent,
                    isToday && !absent && styles.dayToday,
                    isToday && absent && styles.dayTodayAbsent,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      absent && styles.dayNumAbsent,
                      present && styles.dayNumPresent,
                      isToday && styles.dayNumToday,
                    ]}
                  >
                    {day}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}

      <View style={styles.legendRow}>
        <View style={styles.legendSwatchPresent} />
        <Text style={styles.legendLabel}>Present</Text>
        <View style={styles.legendSwatch} />
        <Text style={styles.legendLabel}>Absent</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  monthNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  monthNavText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#334155",
    marginTop: -2,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  legend: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 12,
  },
  weekHeader: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekHeaderCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  weekHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  weekRow: {
    flexDirection: "row",
  },
  dayCell: {
    flex: 1,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
  },
  dayInner: {
    width: "100%",
    aspectRatio: 1,
    maxWidth: 40,
    maxHeight: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  dayAbsent: {
    backgroundColor: "#fecaca",
    borderWidth: 1,
    borderColor: "#f87171",
  },
  dayPresent: {
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#4ade80",
  },
  dayToday: {
    borderWidth: 2,
    borderColor: "#4f46e5",
    backgroundColor: "#eef2ff",
  },
  dayTodayAbsent: {
    borderWidth: 2,
    borderColor: "#b91c1c",
  },
  dayNum: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  dayNumAbsent: {
    color: "#991b1b",
    fontWeight: "700",
  },
  dayNumPresent: {
    color: "#166534",
    fontWeight: "700",
  },
  dayNumToday: {},
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: "#fecaca",
    borderWidth: 1,
    borderColor: "#f87171",
  },
  legendSwatchPresent: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#4ade80",
  },
  legendLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
});
