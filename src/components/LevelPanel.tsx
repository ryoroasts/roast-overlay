import { expandCurve, levelToTemp, maxValue } from '../lib/curve';
import { KLOG_COL, rowValueAtTime } from '../lib/klog';
import type { LoadedProfile } from '../lib/profiles';

interface Props {
  profiles: LoadedProfile[];
  /** id → 現在の Level(Sync all のときは全員同じ値) */
  levels: Record<string, number>;
  onLevelChange: (id: string, level: number) => void;
  syncAll: boolean;
  onSyncAllChange: (syncAll: boolean) => void;
}

export default function LevelPanel({ profiles, levels, onLevelChange, syncAll, onSyncAllChange }: Props) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-zinc-400">
        <input
          type="checkbox"
          checked={syncAll}
          onChange={(e) => onSyncAllChange(e.target.checked)}
        />
        Sync all(全プロファイルを1つの Level に揃える)
      </label>
      <p className="text-xs text-zinc-500">
        Level は焙煎度の絶対値ではなく、roast_levels テーブル(Level 0〜6)から終了温度を
        0.1 刻みで線形補間して選ぶインデックス。カーブ自体は不変で、止める温度だけが変わる。
        既定値は .klog は実際に焼いた Level(roasting_level)、.kpro は推奨 Level(recommended_level)。
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {profiles.map((p) => {
          const level = levels[p.id] ?? 0;
          const temp = levelToTemp(p.profile.roastLevels, level);
          const poly = expandCurve(p.profile.roast);
          const curveMax = poly.length ? maxValue(poly) : null;
          const beyond = temp != null && curveMax != null && temp > curveMax;
          const actualEnd =
            p.kind === 'klog' && p.log ? rowValueAtTime(p.log.rows, KLOG_COL.meanTemp, p.log.roastEnd) : null;

          return (
            <div
              key={p.id}
              className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: p.color }}
                  />
                  {p.profile.name}
                </span>
                <span className="tabular-nums font-semibold text-amber-300">
                  {temp != null ? `${temp.toFixed(1)}°C` : '—'}
                  {actualEnd != null && (
                    <span className="ml-1 font-normal text-zinc-400">
                      (actual {actualEnd.toFixed(1)})
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={6}
                  step={0.1}
                  value={level}
                  onChange={(e) => onLevelChange(p.id, parseFloat(e.target.value))}
                  className="flex-1 accent-amber-500"
                />
                <input
                  type="number"
                  min={0}
                  max={6}
                  step={0.1}
                  value={level}
                  onChange={(e) => onLevelChange(p.id, parseFloat(e.target.value) || 0)}
                  className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right tabular-nums"
                />
              </div>
              {beyond && curveMax != null && temp != null && (
                <p className="text-xs text-amber-500">
                  {temp.toFixed(1)}°C — beyond curve peak {curveMax.toFixed(1)}°C
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
