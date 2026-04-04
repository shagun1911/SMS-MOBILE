import { useMemo } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Line, Polyline, Circle, Text as SvgText } from "react-native-svg";

export type RankPoint = { label: string; rank: number };

type Props = {
  points: RankPoint[];
};

/** Line chart: rank on Y (1 = top, lower is better), exams on X. Matches report-card PDF logic. */
export function ExamRankProgressChart({ points }: Props) {
  const { width: winW } = useWindowDimensions();

  const { svgW, padL, padR, padT, padB, plotW, plotH, maxR, rankToY, plotPoints } = useMemo(() => {
      const screenChartW = Math.max(260, winW - 64);
      const padL = 34;
      const padR = 12;
      const padT = 22;
      const padB = 44;
      const plotW = screenChartW - padL - padR;
      const plotH = 132;
      const svgW = screenChartW;
      const svgH = padT + plotH + padB;

      const ranks = points.map((p) => p.rank).filter((r) => Number.isFinite(r) && r >= 1);
      const maxR = Math.max(...ranks, 1);
      const minR = 1;

      const rankToY = (r: number) => {
        if (maxR <= minR) return padT + plotH / 2;
        return padT + ((r - minR) / (maxR - minR)) * plotH;
      };

      const n = points.length;
      const indexToX = (i: number) => {
        if (n <= 1) return padL + plotW / 2;
        return padL + (i / (n - 1)) * plotW;
      };

      const plotPoints = points.map((p, i) => ({
        x: indexToX(i),
        y: rankToY(p.rank),
        label: p.label,
        rank: p.rank,
      }));

      return {
        svgW,
        padL,
        padR,
        padT,
        padB,
        plotW,
        plotH,
        maxR,
        rankToY,
        plotPoints,
      };
    }, [points, winW]);

  if (points.length === 0) return null;

  const polylinePts = plotPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Exam rank progress</Text>
      <Text style={styles.cardSub}>Rank in each test (lower is better).</Text>

      <Svg width={svgW} height={padT + plotH + padB}>
        <SvgText x={padL} y={14} fontSize={11} fill="#64748b">
          Rank
        </SvgText>

        <Line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={padT + plotH}
          stroke="#e2e8f0"
          strokeWidth={1}
        />

        <Line
          x1={padL}
          y1={padT}
          x2={padL + plotW}
          y2={padT}
          stroke="#e2e8f0"
          strokeWidth={1}
        />
        <Line
          x1={padL}
          y1={padT + plotH}
          x2={padL + plotW}
          y2={padT + plotH}
          stroke="#e2e8f0"
          strokeWidth={1}
        />
        <Line
          x1={padL + plotW}
          y1={padT}
          x2={padL + plotW}
          y2={padT + plotH}
          stroke="#e2e8f0"
          strokeWidth={1}
        />

        {Array.from({ length: maxR }, (_, i) => i + 1).map((r) => {
          const yy = rankToY(r);
          return (
            <Line
              key={r}
              x1={padL}
              y1={yy}
              x2={padL + plotW}
              y2={yy}
              stroke="#e8ecf4"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          );
        })}

        {Array.from({ length: maxR }, (_, i) => i + 1).map((r) => {
          const yy = rankToY(r);
          return (
            <SvgText
              key={`lbl-${r}`}
              x={padL - 6}
              y={yy + 4}
              fontSize={10}
              fill="#94a3b8"
              textAnchor="end"
            >
              {String(r)}
            </SvgText>
          );
        })}

        <Polyline points={polylinePts} fill="none" stroke="#4f46e5" strokeWidth={2.5} />

        {plotPoints.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={5} fill="#4f46e5" stroke="#fff" strokeWidth={2} />
        ))}

        {plotPoints.map((p, i) => {
          const short =
            p.label.length > 8 ? `${p.label.slice(0, 7)}…` : p.label;
          return (
            <SvgText
              key={`x-${i}`}
              x={p.x}
              y={padT + plotH + 16}
              fontSize={10}
              fill="#334155"
              textAnchor="middle"
            >
              {short}
            </SvgText>
          );
        })}

        {plotPoints.map((p, i) => (
          <SvgText
            key={`r-${i}`}
            x={p.x}
            y={padT + plotH + 30}
            fontSize={9}
            fill="#4f46e5"
            textAnchor="middle"
          >
            {`Rank ${p.rank}`}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 8,
  },
});
