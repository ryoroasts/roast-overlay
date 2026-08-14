import { useState } from 'react';
import { computePhases, rowValueAtTime, KLOG_COL } from '../lib/klog';
import { levelToTemp } from '../lib/curve';
import type { LoadedProfile } from '../lib/profiles';
import { useI18n } from '../i18n/context';

interface Props {
  profiles: LoadedProfile[];
  dryEndTemp: number;
}

/** m:ss.s 表示 */
function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1);
  return `${m}:${s.padStart(4, '0')}`;
}

interface Weight {
  in: string;
  out: string;
}

export default function SummaryPanel({ profiles, dryEndTemp }: Props) {
  const { t } = useI18n();
  // 重量はファイルに含まれないためユーザー入力。保存はしない(§9)— このコンポーネントの
  // state だけに置き、localStorage 等へは書かない。
  const [weights, setWeights] = useState<Record<string, Weight>>({});

  const klogs = profiles.filter((p) => p.kind === 'klog' && p.log);
  if (klogs.length === 0) return null;

  function setWeight(id: string, patch: Partial<Weight>) {
    setWeights((prev) => {
      const current = prev[id] ?? { in: '', out: '' };
      return { ...prev, [id]: { ...current, ...patch } };
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {klogs.map((p) => {
        const log = p.log!;
        const phases = computePhases(log, dryEndTemp);
        const target = levelToTemp(log.roastLevels, log.roastingLevel);
        const actual = rowValueAtTime(log.rows, KLOG_COL.meanTemp, log.roastEnd);
        const delta = target != null && actual != null ? actual - target : null;

        const w = weights[p.id] ?? { in: '', out: '' };
        const inG = parseFloat(w.in);
        const outG = parseFloat(w.out);
        const weightLoss =
          Number.isFinite(inG) && inG > 0 && Number.isFinite(outG) ? ((inG - outG) / inG) * 100 : null;

        return (
          <div
            key={p.id}
            className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 text-sm"
          >
            <div className="flex items-center gap-2 font-medium text-zinc-200">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: p.color }}
              />
              {p.profile.name}
            </div>
            <dl className="grid grid-cols-2 gap-x-2 gap-y-1">
              <dt className="text-zinc-500">{t.summaryTotalRoastTime}</dt>
              <dd className="text-right tabular-nums text-zinc-200">{fmtTime(log.roastEnd)}</dd>

              <dt className="text-zinc-500">{t.summaryDevDtr}</dt>
              <dd className="text-right tabular-nums text-zinc-200">
                {phases.development != null && phases.dtr != null
                  ? `${fmtTime(phases.development)} / ${(phases.dtr * 100).toFixed(1)}%`
                  : '—'}
              </dd>

              <dt className="text-zinc-500">{t.summaryLevelUsed}</dt>
              <dd className="text-right tabular-nums text-zinc-200">{log.roastingLevel.toFixed(1)}</dd>

              <dt className="text-zinc-500">{t.summaryTargetEndTemp}</dt>
              <dd className="text-right tabular-nums text-zinc-200">
                {target != null ? `${target.toFixed(1)}°C` : '—'}
              </dd>

              <dt className="text-zinc-500">{t.summaryActualEndTemp}</dt>
              <dd className="text-right tabular-nums text-zinc-200">
                {actual != null ? `${actual.toFixed(2)}°C` : '—'}
              </dd>

              <dt className="text-zinc-500">{t.summaryDelta}</dt>
              <dd
                className={`text-right tabular-nums font-semibold ${
                  delta == null ? 'text-zinc-200' : delta > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {delta != null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}°C` : '—'}
              </dd>
            </dl>
            <div className="flex items-center gap-1.5 border-t border-zinc-800 pt-2 text-zinc-400">
              <input
                type="number"
                min={0}
                step={0.1}
                placeholder={t.summaryWeightIn}
                value={w.in}
                onChange={(e) => setWeight(p.id, { in: e.target.value })}
                className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-right tabular-nums"
              />
              <span>→</span>
              <input
                type="number"
                min={0}
                step={0.1}
                placeholder={t.summaryWeightOut}
                value={w.out}
                onChange={(e) => setWeight(p.id, { out: e.target.value })}
                className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-right tabular-nums"
              />
              <span className="ml-auto tabular-nums text-zinc-300">
                {weightLoss != null ? t.summaryWeightLoss(weightLoss.toFixed(1)) : ''}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
