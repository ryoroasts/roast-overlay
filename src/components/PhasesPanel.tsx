import { computePhases, computePhasesAt } from '../lib/klog';
import type { AlignMode, AlignShift, LoadedProfile } from '../lib/profiles';

interface Props {
  profiles: LoadedProfile[];
  dryEndTemp: number;
  onDryEndTempChange: (temp: number) => void;
  alignMode: AlignMode;
  alignTemp: number;
  /** id → 温度基準アラインメントのシフト量(= 通過時刻)。temp モードのときの値を渡す */
  shifts: Record<string, AlignShift>;
}

/** m:ss.s 表示 */
function fmtTime(sec: number): string {
  const sign = sec < 0 ? '-' : '';
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = (abs % 60).toFixed(1);
  return `${sign}${m}:${s.padStart(4, '0')}`;
}

export default function PhasesPanel({
  profiles,
  dryEndTemp,
  onDryEndTempChange,
  alignMode,
  alignTemp,
  shifts,
}: Props) {
  const klogs = profiles.filter((p) => p.kind === 'klog' && p.log);
  if (klogs.length === 0) return null;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-zinc-400">
        Dry end 温度(mean_temp が上向きに横切る基準)
        <input
          type="number"
          step={0.1}
          value={dryEndTemp}
          onChange={(e) => onDryEndTempChange(parseFloat(e.target.value) || 0)}
          className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right tabular-nums"
        />
        °C
      </label>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-left text-zinc-400">
              <th className="px-2 py-1.5 font-medium">プロファイル</th>
              <th className="px-2 py-1.5 text-right font-medium">Dry end</th>
              <th
                className="px-2 py-1.5 text-right font-medium"
                title="First crack はユーザーの手押し(button press)。豆の弾け方でずれる — see Align by temperature"
              >
                First crack
              </th>
              <th className="px-2 py-1.5 text-right font-medium">Roast end</th>
              <th className="px-2 py-1.5 text-right font-medium">Maillard</th>
              <th className="px-2 py-1.5 text-right font-medium">Development</th>
              <th className="px-2 py-1.5 text-right font-medium">DTR</th>
            </tr>
          </thead>
          <tbody>
            {klogs.map((p) => {
              const log = p.log!;
              const phases = computePhases(log, dryEndTemp);
              return (
                <tr key={p.id} className="border-b border-zinc-800/60">
                  <td className="px-2 py-1.5">
                    <span
                      className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                      style={{ background: p.color }}
                    />
                    {p.profile.name}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {phases.dryEnd != null ? fmtTime(phases.dryEnd) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {log.firstCrack != null ? fmtTime(log.firstCrack) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtTime(log.roastEnd)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {phases.maillard != null ? fmtTime(phases.maillard) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {phases.development != null ? fmtTime(phases.development) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {phases.dtr != null ? `${(phases.dtr * 100).toFixed(2)}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* F6: 温度基準を選んでいる間、button と temperature を並べて出す */}
      {alignMode === 'temp' && (
        <div className="overflow-x-auto">
          <p className="mb-1 text-xs text-zinc-500">
            button 基準(手押しの First crack) vs temperature 基準({alignTemp}℃ 通過時刻を FC の代わりに使う)
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-700 text-left text-zinc-400">
                <th className="px-2 py-1.5 font-medium">プロファイル / 項目</th>
                <th className="px-2 py-1.5 text-right font-medium">button 基準</th>
                <th className="px-2 py-1.5 text-right font-medium">temperature 基準</th>
              </tr>
            </thead>
            <tbody>
              {klogs.flatMap((p) => {
                const log = p.log!;
                const buttonPhases = computePhases(log, dryEndTemp);
                const crossing = shifts[p.id];
                const tempFc = crossing?.reached ? crossing.shift : null;
                const tempPhases = computePhasesAt(log, dryEndTemp, tempFc);
                const rows: { metric: string; button: number | null; temp: number | null; pct?: boolean }[] = [
                  { metric: 'Maillard', button: buttonPhases.maillard, temp: tempPhases.maillard },
                  { metric: 'Development', button: buttonPhases.development, temp: tempPhases.development },
                  {
                    metric: 'DTR',
                    button: buttonPhases.dtr != null ? buttonPhases.dtr * 100 : null,
                    temp: tempPhases.dtr != null ? tempPhases.dtr * 100 : null,
                    pct: true,
                  },
                ];
                return rows.map((r, i) => (
                  <tr key={`${p.id}_${r.metric}`} className="border-b border-zinc-800/60">
                    <td className="px-2 py-1.5">
                      {i === 0 && (
                        <span
                          className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                          style={{ background: p.color }}
                        />
                      )}
                      {i === 0 ? `${p.profile.name} ` : ''}
                      {r.metric}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {r.button != null ? (r.pct ? `${r.button.toFixed(2)}%` : fmtTime(r.button)) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {r.temp != null
                        ? r.pct
                          ? `${r.temp.toFixed(2)}%`
                          : fmtTime(r.temp)
                        : crossing && !crossing.reached
                          ? `did not reach ${alignTemp}°C`
                          : '—'}
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
