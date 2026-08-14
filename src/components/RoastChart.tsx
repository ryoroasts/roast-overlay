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
import { KLOG_COL, rowValueAtTime, type RoastLog } from '../lib/klog';
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
// .klog の設計線(=profile 列)。実測(dataKey=id 自身、F2 では mean_temp)と同色・破線で重ねる。
const DESIGN_KEY = (id: string) => `${id}__design`;
const SPOT_KEY = (id: string) => `${id}__spot`;
const TEMP_KEY = (id: string) => `${id}__temp`;

/** .klog の行データ列を t で線形補間。roastEnd を超えたら null(クーリング区間は描かない、§5 F2)。 */
function klogValueAt(log: RoastLog, col: number, t: number): number | null {
  if (t > log.roastEnd) return null;
  return rowValueAtTime(log.rows, col, t);
}

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
  const [showRaw, setShowRaw] = useState(false);

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

    // 横軸の右端: klog は roastEnd、kpro はカーブ自体の長さを使い、+30s して 30s 刻みに切り上げる。
    // 最低 600s は確保するが、+30s の余白はデータの実長にだけ足す(最低ラインには足さない)。
    const contentMax = Math.max(
      0,
      ...visible.map((p) => {
        if (p.kind === 'klog' && p.log) return p.log.roastEnd;
        const poly = polys.find((x) => x.id === p.id)?.poly;
        return poly && poly.length ? poly[poly.length - 1].t : 0;
      }),
    );
    const tMax = Math.max(T_MIN_MAX, Math.ceil((contentMax + 30) / T_STEP) * T_STEP);
    const ticks = Array.from({ length: tMax / T_STEP + 1 }, (_, i) => i * T_STEP);

    const rows: Record<string, number | null>[] = [];
    for (let t = 0; t <= tMax; t += step) {
      const row: Record<string, number | null> = { time: t };
      for (const p of visible) {
        const { id, poly, fanPoly } = polys.find((x) => x.id === p.id)!;
        row[FAN_KEY(id)] = valueAtTime(fanPoly, t);
        if (p.kind === 'klog' && p.log) {
          // 実測(主線)= mean_temp、設計(破線)= =profile 列。ともに roastEnd で打ち切る(F2)。
          row[id] = klogValueAt(p.log, KLOG_COL.meanTemp, t);
          row[DESIGN_KEY(id)] = klogValueAt(p.log, KLOG_COL.profile, t);
          if (showRaw) {
            row[SPOT_KEY(id)] = klogValueAt(p.log, KLOG_COL.spotTemp, t);
            row[TEMP_KEY(id)] = klogValueAt(p.log, KLOG_COL.temp, t);
          }
        } else {
          // .kpro 単体はベジェ再構成の1本(実線)
          row[id] = valueAtTime(poly, t);
        }
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
  }, [visible, step, levels, showRaw]);

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
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
          生データ(spot_temp / temp、.klog のみ)
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

          <Tooltip content={<DiffTooltip visible={visible} nameOf={nameOf} baseId={baseId} showFan={showFan} />} />
          <Legend formatter={(id) => nameOf(String(id))} />

          {/* 温度カーブ(主線: .klog は mean_temp 実測、.kpro はベジェ再構成) */}
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

          {/* 設計線(.klog のみ・=profile 列・同色破線 opacity 0.5、F2) */}
          {visible
            .filter((p) => p.kind === 'klog')
            .map((p) => (
              <Line
                key={`design-${p.id}`}
                yAxisId="temp"
                type="monotone"
                dataKey={DESIGN_KEY(p.id)}
                stroke={p.color}
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeOpacity={0.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
                legendType="none"
              />
            ))}

          {/* 生データ(spot_temp / temp、.klog のみ・デフォルト非表示) */}
          {showRaw &&
            visible
              .filter((p) => p.kind === 'klog')
              .flatMap((p) => [
                <Line
                  key={`spot-${p.id}`}
                  yAxisId="temp"
                  type="monotone"
                  dataKey={SPOT_KEY(p.id)}
                  stroke={p.color}
                  strokeWidth={1}
                  strokeOpacity={0.35}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                  legendType="none"
                />,
                <Line
                  key={`temp-${p.id}`}
                  yAxisId="temp"
                  type="monotone"
                  dataKey={TEMP_KEY(p.id)}
                  stroke={p.color}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  strokeOpacity={0.5}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                  legendType="none"
                />,
              ])}

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
  visible: LoadedProfile[];
  nameOf: (id: string) => string;
  baseId?: string;
  showFan: boolean;
  active?: boolean;
  payload?: TooltipEntry[];
  label?: number;
}) {
  const { visible, nameOf, baseId, showFan, active, payload, label } = props;
  if (!active || !payload || payload.length === 0) return null;

  const byKey = new Map(payload.map((e) => [e.dataKey, e.value]));
  const baseTemp = baseId != null ? (byKey.get(baseId) ?? null) : null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-medium text-zinc-300">時間 {fmtTime(Number(label))}</p>
      <table className="tabular-nums">
        <tbody>
          {visible.map((p) => {
            const value = byKey.get(p.id) ?? null;
            const design = p.kind === 'klog' ? (byKey.get(DESIGN_KEY(p.id)) ?? null) : null;
            const fan = showFan ? (byKey.get(FAN_KEY(p.id)) ?? null) : null;
            const delta =
              baseTemp != null && value != null && p.id !== baseId ? value - baseTemp : null;
            return (
              <tr key={p.id}>
                <td className="pr-2">
                  <span
                    className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                    style={{ background: p.color }}
                  />
                  {nameOf(p.id)}
                </td>
                <td className="pr-2 text-right text-zinc-100">
                  {value != null ? `${value.toFixed(2)}°C` : '—'}
                </td>
                <td className="pr-2 text-right text-zinc-500">
                  {design != null ? `design ${design.toFixed(2)}` : ''}
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
