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
import { computePhases, klogValueAt, KLOG_COL } from '../lib/klog';
import type { AlignMode, AlignShift, LoadedProfile } from '../lib/profiles';
import { useI18n } from '../i18n/context';

interface Props {
  profiles: LoadedProfile[];
  /** id → 終了温度を打つための現在 Level */
  levels: Record<string, number>;
  /** Dry end 判定の閾値(℃)。F5 */
  dryEndTemp: number;
  /** id → 時間シフト量(実時間からこれを引くと表示時間になる)。F6 */
  shifts: Record<string, AlignShift>;
  /** F6: 現在の Align モード。time 以外では横軸に負の時間を許し ±30s の余白を足す */
  alignMode: AlignMode;
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
const ROR_KEY = (id: string) => `${id}__ror`;
const ROR_DESIGN_KEY = (id: string) => `${id}__ror_design`;

type RightAxis = 'fan' | 'ror' | 'none';

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

interface PhaseMark {
  id: string;
  label: string;
  t: number;
  color: string;
}

interface ZoneBand {
  id: string;
  label: string;
  start: number;
  end: number;
  color: string;
}

export default function RoastChart({ profiles, levels, dryEndTemp, shifts, alignMode, step = 2 }: Props) {
  const { t } = useI18n();
  const [rightAxis, setRightAxis] = useState<RightAxis>('fan');
  const [showZones, setShowZones] = useState(true);
  const [showRaw, setShowRaw] = useState(false);
  const [showDesignROR, setShowDesignROR] = useState(false);

  const visible = profiles.filter((p) => p.visible && p.profile.roast.anchors.length > 0);
  const nameOf = (id: string) => visible.find((p) => p.id === id)?.profile.name ?? id;
  const baseId = visible[0]?.id;

  const { data, endDots, endLines, phaseMarks, zoneBands, fanDomain, rorDomain, tMax, xMin, xTicks } = useMemo(() => {
    const polys = visible.map((p) => ({
      id: p.id,
      color: p.color,
      poly: expandCurve(p.profile.roast),
      fanPoly: expandCurve(p.profile.fan),
      roastLevels: p.profile.roastLevels,
    }));
    const shiftOf = (id: string) => shifts[id]?.shift ?? 0;

    // 横軸レンジ: alignMode==='time' なら従来どおり [0, 実データ長+30s]・最低600s。
    // fc/temp モードでは各プロファイルの表示レンジ(実時間 − シフト)の和集合を取り、
    // 両端に30sの余白を足す(負の時間も許す。§6)。
    const ranges = visible.map((p) => {
      const shift = shiftOf(p.id);
      let realStart = 0;
      let realEnd: number;
      if (p.kind === 'klog' && p.log) {
        realStart = p.log.rows[0]?.[KLOG_COL.time] ?? 0;
        realEnd = p.log.roastEnd;
      } else {
        const poly = polys.find((x) => x.id === p.id)?.poly ?? [];
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
      for (const p of visible) {
        const { id, poly, fanPoly } = polys.find((x) => x.id === p.id)!;
        const realT = t + shiftOf(id); // 設計カーブも同じシフト量で一緒に動かす(F6)
        row[FAN_KEY(id)] = valueAtTime(fanPoly, realT);
        if (p.kind === 'klog' && p.log) {
          // 実測(主線)= mean_temp、設計(破線)= =profile 列。ともに roastEnd で打ち切る(F2)。
          row[id] = klogValueAt(p.log, KLOG_COL.meanTemp, realT);
          row[DESIGN_KEY(id)] = klogValueAt(p.log, KLOG_COL.profile, realT);
          if (showRaw) {
            row[SPOT_KEY(id)] = klogValueAt(p.log, KLOG_COL.spotTemp, realT);
            row[TEMP_KEY(id)] = klogValueAt(p.log, KLOG_COL.temp, realT);
          }
          if (rightAxis === 'ror') {
            // RoR は actual_ROR 列をそのまま使う。自前で微分しない(F4)。
            row[ROR_KEY(id)] = klogValueAt(p.log, KLOG_COL.actualROR, realT);
            if (showDesignROR) row[ROR_DESIGN_KEY(id)] = klogValueAt(p.log, KLOG_COL.profileROR, realT);
          }
        } else {
          // .kpro 単体はベジェ再構成の1本(実線)
          row[id] = valueAtTime(poly, realT);
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
      dots.push({ id, t: t - shiftOf(id), temp, color });
    }

    // Dry end / First crack / Roast end の縦線(.klog のみ、F5)
    const marks: PhaseMark[] = [];
    for (const p of visible) {
      if (p.kind !== 'klog' || !p.log) continue;
      const shift = shiftOf(p.id);
      const phases = computePhases(p.log, dryEndTemp);
      if (phases.dryEnd != null) {
        marks.push({ id: `${p.id}_dry`, label: 'Dry', t: phases.dryEnd - shift, color: p.color });
      }
      if (p.log.firstCrack != null) {
        marks.push({ id: `${p.id}_fc`, label: 'FC', t: p.log.firstCrack - shift, color: p.color });
      }
      marks.push({ id: `${p.id}_end`, label: 'End', t: p.log.roastEnd - shift, color: p.color });
    }

    // 有効ゾーンの帯(設計カーブ上の時間なので同じシフト量で動かす)
    const bands: ZoneBand[] = [];
    for (const p of visible) {
      const shift = shiftOf(p.id);
      for (const z of activeZones(p.profile.raw)) {
        const parts = [z.label];
        if (z.boost != null && z.boost !== 0) parts.push(`+${z.boost}`);
        bands.push({
          id: `${p.id}_${z.key}`,
          label: parts.join(' '),
          start: z.start - shift,
          end: z.end - shift,
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

    // RoR 軸ドメイン(t<=roastEnd のデータだけから、5 単位で丸め。F4: 降温域の負値は出さない)
    let rorMin = Infinity;
    let rorMax = -Infinity;
    if (rightAxis === 'ror') {
      for (const row of rows) {
        for (const p of visible) {
          if (p.kind !== 'klog') continue;
          const v = row[ROR_KEY(p.id)];
          if (v != null) {
            if (v < rorMin) rorMin = v;
            if (v > rorMax) rorMax = v;
          }
          if (showDesignROR) {
            const dv = row[ROR_DESIGN_KEY(p.id)];
            if (dv != null) {
              if (dv < rorMin) rorMin = dv;
              if (dv > rorMax) rorMax = dv;
            }
          }
        }
      }
    }
    const rd: [number, number] | null = Number.isFinite(rorMin)
      ? [Math.floor(rorMin / 5) * 5, Math.ceil(rorMax / 5) * 5]
      : null;

    return {
      data: rows,
      endDots: dots,
      endLines: lines,
      phaseMarks: marks,
      zoneBands: bands,
      fanDomain: fd,
      rorDomain: rd,
      tMax: xHi,
      xMin: xLo,
      xTicks: ticks,
    };
  }, [visible, step, levels, showRaw, dryEndTemp, rightAxis, showDesignROR, shifts, alignMode]);

  if (visible.length === 0) {
    return <div className="flex h-80 items-center justify-center text-zinc-500">{t.chartNoProfiles}</div>;
  }

  const hasKlog = visible.some((p) => p.kind === 'klog');
  const showRightAxis = (rightAxis === 'fan' && !!fanDomain) || (rightAxis === 'ror' && !!rorDomain);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-sm text-zinc-400">
        <div className="flex items-center gap-3">
          <span>{t.chartRightAxis}</span>
          {(['fan', 'ror', 'none'] as const).map((opt) => (
            <label key={opt} className="flex items-center gap-1">
              <input
                type="radio"
                name="rightAxis"
                checked={rightAxis === opt}
                onChange={() => setRightAxis(opt)}
              />
              {opt === 'fan' ? t.chartRightAxisFan : opt === 'ror' ? t.chartRightAxisRoR : t.chartRightAxisNone}
            </label>
          ))}
        </div>
        {rightAxis === 'ror' && (
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showDesignROR}
              onChange={(e) => setShowDesignROR(e.target.checked)}
            />
            {t.chartShowDesignROR}
          </label>
        )}
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showZones}
            onChange={(e) => setShowZones(e.target.checked)}
          />
          {t.chartShowZones}
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
          {t.chartShowRaw}
        </label>
      </div>

      {rightAxis === 'ror' && !hasKlog && <p className="mb-2 text-sm text-amber-500">{t.chartRorRequiresKlog}</p>}

      <ResponsiveContainer width="100%" height={440}>
        <ComposedChart data={data} margin={{ top: 16, right: showRightAxis ? 56 : 16, bottom: 8, left: 0 }}>
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
          {rightAxis === 'fan' && fanDomain && (
            <YAxis
              yAxisId="right"
              orientation="right"
              type="number"
              domain={fanDomain}
              stroke="#71717a"
              fontSize={11}
              width={52}
              tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
            />
          )}
          {rightAxis === 'ror' && rorDomain && (
            <YAxis
              yAxisId="right"
              orientation="right"
              type="number"
              domain={rorDomain}
              stroke="#71717a"
              fontSize={11}
              width={52}
              tickFormatter={(v) => `${v}`}
              label={{ value: '°C/min', angle: 90, position: 'insideRight', fill: '#71717a', fontSize: 10 }}
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

          <Tooltip content={<DiffTooltip visible={visible} nameOf={nameOf} baseId={baseId} rightAxis={rightAxis} />} />
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
          {rightAxis === 'fan' &&
            fanDomain &&
            visible.map((p) => (
              <Line
                key={`fan-${p.id}`}
                yAxisId="right"
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

          {/* RoR(実測、右軸)。actual_ROR をそのまま使う(F4) */}
          {rightAxis === 'ror' &&
            rorDomain &&
            visible
              .filter((p) => p.kind === 'klog')
              .map((p) => (
                <Line
                  key={`ror-${p.id}`}
                  yAxisId="right"
                  type="monotone"
                  dataKey={ROR_KEY(p.id)}
                  stroke={p.color}
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                  legendType="none"
                />
              ))}

          {/* 設計 RoR(破線、チェックボックスで表示、F4) */}
          {rightAxis === 'ror' &&
            rorDomain &&
            showDesignROR &&
            visible
              .filter((p) => p.kind === 'klog')
              .map((p) => (
                <Line
                  key={`ror-design-${p.id}`}
                  yAxisId="right"
                  type="monotone"
                  dataKey={ROR_DESIGN_KEY(p.id)}
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

          {/* Dry end / First crack / Roast end の縦線(.klog のみ、F5) */}
          {phaseMarks.map((m) => (
            <ReferenceLine
              key={`phase-${m.id}`}
              yAxisId="temp"
              x={m.t}
              stroke={m.color}
              strokeDasharray={m.label === 'FC' ? '2 2' : '3 3'}
              strokeOpacity={0.6}
              label={{
                value: m.label,
                position: 'top',
                fill: m.color,
                fontSize: 10,
              }}
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
  rightAxis: RightAxis;
  active?: boolean;
  payload?: TooltipEntry[];
  label?: number;
}) {
  const { visible, nameOf, baseId, rightAxis, active, payload, label } = props;
  const { t } = useI18n();
  if (!active || !payload || payload.length === 0) return null;

  const byKey = new Map(payload.map((e) => [e.dataKey, e.value]));
  const baseTemp = baseId != null ? (byKey.get(baseId) ?? null) : null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-medium text-zinc-300">{t.chartTooltipTime(fmtTime(Number(label)))}</p>
      <table className="tabular-nums">
        <tbody>
          {visible.map((p) => {
            const value = byKey.get(p.id) ?? null;
            const design = p.kind === 'klog' ? (byKey.get(DESIGN_KEY(p.id)) ?? null) : null;
            const fan = rightAxis === 'fan' ? (byKey.get(FAN_KEY(p.id)) ?? null) : null;
            const ror = rightAxis === 'ror' ? (byKey.get(ROR_KEY(p.id)) ?? null) : null;
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
                  {design != null ? t.chartDesignPrefix(design.toFixed(2)) : ''}
                </td>
                <td className="pr-2 text-right text-zinc-400">
                  {delta != null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` : ''}
                </td>
                {rightAxis === 'fan' && (
                  <td className="text-right text-zinc-500">
                    {fan != null ? `${Math.round(fan)}rpm` : ''}
                  </td>
                )}
                {rightAxis === 'ror' && (
                  <td className="text-right text-zinc-500">
                    {ror != null ? `${ror.toFixed(1)}°C/min` : ''}
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
