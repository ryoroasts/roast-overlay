import type { LoadedProfile } from '../lib/profiles';

interface Props {
  profiles: LoadedProfile[];
}

interface Field {
  key: string;
  label: string;
  unit?: string;
}

// 比較対象のスカラー項目(group ごと)
const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: 'Preheat',
    fields: [
      { key: 'preheat_nominal_temperature', label: '予熱目標温度', unit: '°C' },
      { key: 'preheat_power', label: '予熱パワー', unit: 'W' },
    ],
  },
  {
    title: 'PID',
    fields: [
      { key: 'roast_PID_Kp', label: 'Kp' },
      { key: 'roast_PID_Ki', label: 'Ki' },
      { key: 'roast_PID_Kd', label: 'Kd' },
    ],
  },
  {
    title: 'Zone 1',
    fields: [
      { key: 'zone1_time_start', label: '開始', unit: 's' },
      { key: 'zone1_time_end', label: '終了', unit: 's' },
      { key: 'zone1_boost', label: 'boost' },
      { key: 'zone1_multiplier_Kp', label: '×Kp' },
      { key: 'zone1_multiplier_Kd', label: '×Kd' },
    ],
  },
  {
    title: 'Zone 2',
    fields: [
      { key: 'zone2_time_start', label: '開始', unit: 's' },
      { key: 'zone2_time_end', label: '終了', unit: 's' },
      { key: 'zone2_boost', label: 'boost' },
      { key: 'zone2_multiplier_Kp', label: '×Kp' },
      { key: 'zone2_multiplier_Kd', label: '×Kd' },
    ],
  },
  {
    title: 'Corner 1',
    fields: [
      { key: 'corner1_time_start', label: '開始', unit: 's' },
      { key: 'corner1_time_end', label: '終了', unit: 's' },
    ],
  },
  {
    title: 'その他',
    fields: [{ key: 'recommended_level', label: '推奨 Level' }],
  },
];

/** 数値なら整形、それ以外はそのまま。空は — */
function fmt(raw: string | undefined): string {
  if (raw == null || raw.trim() === '') return '—';
  const n = parseFloat(raw);
  // 数値に見えても "21/02/2026 ..." のような日付は parseFloat が部分的に拾うので、
  // 文字列全体が数値表現のときだけ数値整形する。
  const isPureNumber = /^-?\d+(\.\d+)?$/.test(raw.trim());
  if (isPureNumber && Number.isFinite(n)) {
    // 末尾の .0 を整理しつつ過剰桁を抑える
    return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(4)));
  }
  return raw.trim();
}

export default function DiffTable({ profiles }: Props) {
  if (profiles.length === 0) return null;
  const base = profiles[0];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-700 text-left">
            <th className="px-3 py-2 font-medium text-zinc-400">項目</th>
            {profiles.map((p, i) => (
              <th key={p.id} className="px-3 py-2 font-medium">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: p.color }}
                  />
                  {p.profile.name}
                  {i === 0 && <span className="text-xs text-zinc-500">(基準)</span>}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((group) => (
            <FieldGroup key={group.title} group={group} profiles={profiles} base={base} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FieldGroup({
  group,
  profiles,
  base,
}: {
  group: { title: string; fields: Field[] };
  profiles: LoadedProfile[];
  base: LoadedProfile;
}) {
  return (
    <>
      <tr className="bg-zinc-800/40">
        <td
          colSpan={profiles.length + 1}
          className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-400/80"
        >
          {group.title}
        </td>
      </tr>
      {group.fields.map((field) => {
        const baseVal = base.profile.raw[field.key];
        return (
          <tr key={field.key} className="border-b border-zinc-800/60">
            <td className="px-3 py-1.5 text-zinc-400">
              {field.label}
              {field.unit && <span className="ml-1 text-xs text-zinc-600">{field.unit}</span>}
            </td>
            {profiles.map((p, i) => {
              const val = p.profile.raw[field.key];
              const differs = i > 0 && (val ?? '') !== (baseVal ?? '');
              return (
                <td
                  key={p.id}
                  className={`px-3 py-1.5 tabular-nums ${
                    differs ? 'bg-amber-400/10 font-semibold text-amber-300' : 'text-zinc-200'
                  }`}
                >
                  {fmt(val)}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
