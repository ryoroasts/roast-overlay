import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';
import { expandCurve, valueAtTime, levelToTemp, timeAtValue } from '../lib/curve';
import { activeZones } from '../lib/kpro';
import type { LoadedProfile } from '../lib/profiles';

interface Props {
  profiles: LoadedProfile[];
  /** id → 終了温度を打つための現在 Level */
  levels: Record<string, number>;
  /** グリッド間隔(秒) */
  step?: number;
}

// 横軸は読み込んだログ/プロファイルの最大長 + 30s に自動調整(§6)。最低 600s(10分)は確保する。
const T_MIN_MAX = 600;
const T_STEP = 30; // 30 秒刻み
const TEMP_MAX = 250; // 縦軸 250℃(固定)
const TEMP_STEP = 50; // 50℃ 刻み
const Y_TICKS = Array.from({ length: TEMP_MAX / TEMP_STEP + 1 }, (_, i) => i * TEMP_STEP);

const FAN_KEY = (id: string) => `${id}__fan`;

/** mm:ss 表示 */
function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface EndDot {
  id: string;
  t: number;
  temp: number;
  color: string;
}

interface EndLine {
  id: string;
  temp: number;
  color: string;
}

interface ZoneBand {
  id: string;
  label: string;
  start: number;
  end: number;
  color: string;
}

export default function RoastChart({ profiles, levels, step = 2 }: Props) {
  const [showFan, setShowFan] = useState(true);
  const [showZones, setShowZones] = useState(true);

  const visible = profiles.filter((p) => p.visible && p.profile.roast.anchors.length > 0);
  const nameOf = (id: string) => visible.find((p) => p.id === id)?.profile.name ?? id;
  const baseId = visible[0]?.id;

  const { data, endDots, endLines, zoneBands, fanDomain, tMax, xTicks } = useMemo(() => {
    const polys = visible.map((p) => ({
      id: p.id,
      color: p.color,
      poly: expandCurve(p.profile.roast),
      fanPoly: expandCurve(p.profile.fan),
      roastLevels: p.profile.roastLevels,
    }));

    // 横軸の右端: klog は roastEnd、kpro はカーブ自体の長さを使い、+30s して 30s 刻みに切り上げる
    const rawMax = Math.max(
      T_MIN_MAX,
      ...visible.map((p) => {
        if (p.kind === 'klog' && p.log) return p.log.roastEnd;
        const poly = polys.find((x) => x.id === p.id)?.poly;
        return poly && poly.length ? poly[poly.length - 1].t : 0;
      }),
    );
    const tMax = Math.ceil((rawMax + 30) / T_STEP) * T_STEP;
    const ticks = Array.from({ length: tMax / T_STEP + 1 }, (_, i) => i * T_STEP);

    const rows: Record<string, number | null>[] = [];
    for (let t = 0; t <= tMax; t += step) {
      const row: Record<string, number | null> = { time: t };
      for (const { id, poly, fanPoly } of polys) {
        row[id] = valueAtTime(poly, t);
        row[FAN_KEY(id)] = valueAtTime(fanPoly, t);
      }
      rows.push(row);
    }

    // 選択中 Level の終了温度 — 水平線は必ず引く。ドットはカーブ上に載るときだけ(F3)。
    const dots: EndDot[] = [];
    const lines: EndLine[] = [];
    for (const { id, color, poly, roastLevels } of polys) {
      const temp = levelToTemp(roastLevels, levels[id] ?? 0);
      if (temp == null) continue;
      lines.push({ id, temp, color });
      const t = timeAtValue(poly, temp);
      if (t == null) continue;
      dots.push({ id, t, temp, color });
    }

    // 有効ゾーンの帯
    const bands: ZoneBand[] = [];
    for (const p of visible) {
      for (const z of activeZones(p.profile.raw)) {
        const parts = [z.label];
        if (z.boost != null && z.boost !== 0) parts.push(`+${z.boost}`);
        bands.push({
          id: `${p.id}_${z.key}`,
          label: parts.join(' '),
          start: z.start,
          end: z.end,
          color: p.color,
        });
      }
    }

    // ファン軸ドメイン(データから 1000 単位で丸め)
    let fanMin = Infinity;
    let fanMax = -Infinity;
    for (const { fanPoly } of polys) {
      for (const pt of fanPoly) {
        if (pt.v < fanMin) fanMin = pt.v;
        if (pt.v > fanMax) fanMax = pt.v;
      }
    }
    const fd: [number, number] | null = Number.isFinite(fanMin)
      ? [Math.floor(fanMin / 1000) * 1000, Math.ceil(fanMax / 1000) * 1000]
      : null;

    return { data: rows, endDots: dots, endLines: lines, zoneBands: bands, fanDomain: fd, tMax, xTicks: ticks };
  }, [visible, step, levels]);

  if (visible.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-zinc-500">
        表示するプロファイルがありません
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex gap-4 text-sm text-zinc-400">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={showFan} onChange={(e) => setShowFan(e.target.checked)} />
          ファン(破線・右軸)
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showZones}
            onChange={(e) => setShowZones(e.target.checked)}
          />
          Zone 帯
        </label>
      </div>

      <ResponsiveContainer width="100%" height={440}>
        <ComposedChart data={data} margin={{ top: 16, right: showFan && fanDomain ? 56 : 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            type="number"
            domain={[0, tMax]}
            ticks={xTicks}
            tickFormatter={fmtTime}
            stroke="#a1a1aa"
            fontSize={11}
            interval={0}
            allowDataOverflow
          />
          <YAxis
            yAxisId="temp"
            type="number"
            domain={[0, TEMP_MAX]}
            ticks={Y_TICKS}
            stroke="#a1a1aa"
            fontSize={12}
            tickFormatter={(v) => `${v}°`}
            width={48}
            allowDataOverflow
          />
          {showFan && fanDomain && (
            <YAxis
              yAxisId="fan"
              orientation="right"
              type="number"
              domain={fanDomain}
              stroke="#71717a"
              fontSize={11}
              width={52}
              tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
            />
          )}

          {/* Zone 帯 */}
          {showZones &&
            zoneBands.map((b) => (
              <ReferenceArea
                key={b.id}
                yAxisId="temp"
                x1={b.start}
                x2={b.end}
                fill={b.color}
                fillOpacity={0.14}
                stroke={b.color}
                strokeOpacity={0.4}
                label={{ value: b.label, position: 'insideTop', fill: b.color, fontSize: 10 }}
              />
            ))}

          <Tooltip content={<DiffTooltip nameOf={nameOf} baseId={baseId} showFan={showFan} />} />
          <Legend formatter={(id) => nameOf(String(id))} />

          {/* 温度カーブ */}
          {visible.map((p) => (
            <Line
              key={`line-${p.id}`}
              yAxisId="temp"
              type="monotone"
              dataKey={p.id}
              name={p.id}
              stroke={p.color}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}

          {/* ファンカーブ(破線・右軸) */}
          {showFan &&
            fanDomain &&
            visible.map((p) => (
              <Line
                key={`fan-${p.id}`}
                yAxisId="fan"
                type="monotone"
                dataKey={FAN_KEY(p.id)}
                name={FAN_KEY(p.id)}
                stroke={p.color}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                strokeOpacity={0.6}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
                legendType="none"
              />
            ))}

          {/* 終了温度の水平線(F3: カーブ最高点を超えていても必ず引く) */}
          {endLines.map((l) => (
            <ReferenceLine
              key={`refline-${l.id}`}
              yAxisId="temp"
              y={l.temp}
              stroke={l.color}
              strokeDasharray="4 2"
              strokeOpacity={0.5}
            />
          ))}

          {/* 終了温度の点(カーブ上に載るときだけ) */}
          {endDots.map((d) => (
            <ReferenceDot
              key={`dot-${d.id}`}
              yAxisId="temp"
              x={d.t}
              y={d.temp}
              r={5}
              fill={d.color}
              stroke="#18181b"
              strokeWidth={1.5}
              isFront
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── ホバー差分ツールチップ ──────────────────────────────
interface TooltipEntry {
  dataKey: string;
  value: number | null;
  color: string;
}
function DiffTooltip(props: {
  nameOf: (id: string) => string;
  baseId?: string;
  showFan: boolean;
  active?: boolean;
  payload?: TooltipEntry[];
  label?: number;
}) {
  const { nameOf, baseId, showFan, active, payload, label } = props;
  if (!active || !payload || payload.length === 0) return null;

  // 温度系列(dataKey が __fan で終わらない)
  const temps = payload.filter((e) => !e.dataKey.endsWith('__fan'));
  const fans = payload.filter((e) => e.dataKey.endsWith('__fan'));
  const baseTemp = temps.find((e) => e.dataKey === baseId)?.value ?? null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-medium text-zinc-300">時間 {fmtTime(Number(label))}</p>
      <table className="tabular-nums">
        <tbody>
          {temps.map((e) => {
            const fan = showFan ? fans.find((f) => f.dataKey === FAN_KEY(e.dataKey))?.value : null;
            const delta =
              baseTemp != null && e.value != null && e.dataKey !== baseId
                ? e.value - baseTemp
                : null;
            return (
              <tr key={e.dataKey}>
                <td className="pr-2">
                  <span
                    className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                    style={{ background: e.color }}
                  />
                  {nameOf(e.dataKey)}
                </td>
                <td className="pr-2 text-right text-zinc-100">
                  {e.value != null ? `${e.value.toFixed(1)}°C` : '—'}
                </td>
                <td className="pr-2 text-right text-zinc-400">
                  {delta != null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` : ''}
                </td>
                {showFan && (
                  <td className="text-right text-zinc-500">
                    {fan != null ? `${Math.round(fan)}rpm` : ''}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
