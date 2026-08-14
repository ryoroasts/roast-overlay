import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { expandCurve } from '../lib/curve';
import { computeDeviationSummary, klogValueAt, KLOG_COL, DEVIATION_BAND } from '../lib/klog';
import type { AlignMode, AlignShift, LoadedProfile } from '../lib/profiles';

interface Props {
  /** 表示中の全プロファイル(.kpro も含む。x 軸を Roast カーブと揃えるため) */
  profiles: LoadedProfile[];
  /** id → 時間シフト量。Roast カーブと同じものを渡す(F6、x 軸共有) */
  shifts: Record<string, AlignShift>;
  alignMode: AlignMode;
  step?: number;
}

const T_MIN_MAX = 600;
const T_STEP = 30;

/** mm:ss 表示 */
function fmtTime(sec: number): string {
  const sign = sec < 0 ? '-' : '';
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = Math.round(abs % 60);
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

function deviationAt(p: LoadedProfile, realT: number): number | null {
  if (p.kind !== 'klog' || !p.log) return null;
  const mean = klogValueAt(p.log, KLOG_COL.meanTemp, realT);
  const profile = klogValueAt(p.log, KLOG_COL.profile, realT);
  return mean != null && profile != null ? mean - profile : null;
}

export default function DeviationPanel({ profiles, shifts, alignMode, step = 2 }: Props) {
  const klogs = profiles.filter((p) => p.kind === 'klog' && p.log);

  const { data, tMax, xMin, xTicks, summaries } = useMemo(() => {
    const shiftOf = (id: string) => shifts[id]?.shift ?? 0;

    // Roast カーブと同じ横軸レンジ計算(.kpro の長さも含めて揃える、§6)
    const ranges = profiles.map((p) => {
      const shift = shiftOf(p.id);
      let realStart = 0;
      let realEnd: number;
      if (p.kind === 'klog' && p.log) {
        realStart = p.log.rows[0]?.[KLOG_COL.time] ?? 0;
        realEnd = p.log.roastEnd;
      } else {
        const poly = expandCurve(p.profile.roast);
        realStart = poly.length ? poly[0].t : 0;
        realEnd = poly.length ? poly[poly.length - 1].t : 0;
      }
      return { start: realStart - shift, end: realEnd - shift };
    });

    let xLo: number;
    let xHi: number;
    if (alignMode === 'time') {
      const contentMax = Math.max(0, ...ranges.map((r) => r.end));
      xLo = 0;
      xHi = Math.max(T_MIN_MAX, Math.ceil((contentMax + 30) / T_STEP) * T_STEP);
    } else {
      const rangeMin = Math.min(0, ...ranges.map((r) => r.start));
      const rangeMax = Math.max(0, ...ranges.map((r) => r.end));
      xLo = Math.floor((rangeMin - 30) / T_STEP) * T_STEP;
      xHi = Math.ceil((rangeMax + 30) / T_STEP) * T_STEP;
    }
    const ticks = Array.from({ length: Math.round((xHi - xLo) / T_STEP) + 1 }, (_, i) => xLo + i * T_STEP);

    const rows: Record<string, number | null>[] = [];
    for (let t = xLo; t <= xHi; t += step) {
      const row: Record<string, number | null> = { time: t };
      for (const p of klogs) row[p.id] = deviationAt(p, t + shiftOf(p.id));
      rows.push(row);
    }

    const sums = klogs.map((p) => {
      const shift = shiftOf(p.id);
      const summary = computeDeviationSummary(p.log!);
      return {
        id: p.id,
        color: p.color,
        name: p.profile.name,
        summary,
        shift,
      };
    });

    return { data: rows, tMax: xHi, xMin: xLo, xTicks: ticks, summaries: sums };
  }, [profiles, klogs, step, shifts, alignMode]);

  // .kpro 単体では実測が無いため偏差パネルは出さない(AC-F7-3)
  if (klogs.length === 0) return null;

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={140}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            type="number"
            domain={[xMin, tMax]}
            ticks={xTicks}
            tickFormatter={fmtTime}
            stroke="#a1a1aa"
            fontSize={11}
            interval={0}
            allowDataOverflow
          />
          <YAxis
            type="number"
            domain={['dataMin - 2', 'dataMax + 2']}
            stroke="#a1a1aa"
            fontSize={11}
            width={40}
            tickFormatter={(v) => `${v >= 0 ? '+' : ''}${Math.round(v)}°`}
          />
          <ReferenceArea y1={-DEVIATION_BAND} y2={DEVIATION_BAND} fill="#a1a1aa" fillOpacity={0.12} />
          <ReferenceLine y={0} stroke="#71717a" />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              return (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-sm shadow-lg">
                  <p className="mb-1 font-medium text-zinc-300">時間 {fmtTime(Number(label))}</p>
                  {klogs.map((p) => {
                    const entry = payload.find((e) => e.dataKey === p.id);
                    const v = entry?.value as number | null | undefined;
                    return (
                      <p key={p.id} className="tabular-nums" style={{ color: p.color }}>
                        {p.profile.name}: {v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}°C` : '—'}
                      </p>
                    );
                  })}
                </div>
              );
            }}
          />
          {klogs.map((p) => (
            <Line
              key={p.id}
              dataKey={p.id}
              type="monotone"
              stroke={p.color}
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-left text-zinc-400">
              <th className="px-2 py-1.5 font-medium">プロファイル</th>
              <th className="px-2 py-1.5 text-right font-medium">Max above</th>
              <th className="px-2 py-1.5 text-right font-medium">Max below</th>
              <th className="px-2 py-1.5 text-right font-medium">Converged</th>
              <th className="px-2 py-1.5 text-right font-medium">At end</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map(({ id, color, name, summary, shift }) => (
              <tr key={id} className="border-b border-zinc-800/60">
                <td className="px-2 py-1.5">
                  <span
                    className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                    style={{ background: color }}
                  />
                  {name}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {summary.maxAbove
                    ? `+${summary.maxAbove.value.toFixed(2)}°C @ ${fmtTime(summary.maxAbove.t - shift)}`
                    : '—'}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {summary.maxBelow
                    ? `${summary.maxBelow.value.toFixed(2)}°C @ ${fmtTime(summary.maxBelow.t - shift)}`
                    : '—'}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {summary.converged != null ? fmtTime(summary.converged - shift) : 'did not converge'}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {summary.atEnd != null
                    ? `${summary.atEnd >= 0 ? '+' : ''}${summary.atEnd.toFixed(2)}°C`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
