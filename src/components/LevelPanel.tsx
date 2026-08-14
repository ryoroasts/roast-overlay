import { levelToTemp } from '../lib/curve';
import type { LoadedProfile } from '../lib/profiles';

interface Props {
  profiles: LoadedProfile[];
  level: number;
  onLevelChange: (level: number) => void;
}

export default function LevelPanel({ profiles, level, onLevelChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-sm text-zinc-400">Level</label>
        <input
          type="range"
          min={0}
          max={6}
          step={0.1}
          value={level}
          onChange={(e) => onLevelChange(parseFloat(e.target.value))}
          className="flex-1 accent-amber-500"
        />
        <input
          type="number"
          min={0}
          max={6}
          step={0.1}
          value={level}
          onChange={(e) => onLevelChange(parseFloat(e.target.value) || 0)}
          className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right tabular-nums"
        />
      </div>
      <p className="text-xs text-zinc-500">
        Level は焙煎度の絶対値ではなく、roast_levels テーブル(Level 0〜6)から終了温度を
        0.1 刻みで線形補間して選ぶインデックス。カーブ自体は不変で、止める温度だけが変わる。
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((p) => {
          const temp = levelToTemp(p.profile.roastLevels, level);
          return (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: p.color }}
                />
                {p.profile.name}
              </span>
              <span className="tabular-nums font-semibold text-amber-300">
                {temp != null ? `${temp.toFixed(1)}°C` : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
