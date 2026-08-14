import type { LoadedProfile } from '../lib/profiles';
import type { Dict } from '../i18n/en';
import { useI18n } from '../i18n/context';

interface Props {
  profiles: LoadedProfile[];
}

interface Field {
  key: string;
  label: (t: Dict) => string;
  unit?: string;
}

// 比較対象のスカラー項目(group ごと)。Kp/Ki/Kd/boost/×Kp/×Kd は両言語共通の技術用語なのでそのまま。
const GROUPS: { title: (t: Dict) => string; fields: Field[] }[] = [
  {
    title: (t) => t.diffGroupPreheat,
    fields: [
      { key: 'preheat_nominal_temperature', label: (t) => t.diffFieldPreheatTemp, unit: '°C' },
      { key: 'preheat_power', label: (t) => t.diffFieldPreheatPower, unit: 'W' },
    ],
  },
  {
    title: (t) => t.diffGroupPID,
    fields: [
      { key: 'roast_PID_Kp', label: () => 'Kp' },
      { key: 'roast_PID_Ki', label: () => 'Ki' },
      { key: 'roast_PID_Kd', label: () => 'Kd' },
    ],
  },
  {
    title: (t) => t.diffGroupZone1,
    fields: [
      { key: 'zone1_time_start', label: (t) => t.diffFieldStart, unit: 's' },
      { key: 'zone1_time_end', label: (t) => t.diffFieldEnd, unit: 's' },
      { key: 'zone1_boost', label: () => 'boost' },
      { key: 'zone1_multiplier_Kp', label: () => '×Kp' },
      { key: 'zone1_multiplier_Kd', label: () => '×Kd' },
    ],
  },
  {
    title: (t) => t.diffGroupZone2,
    fields: [
      { key: 'zone2_time_start', label: (t) => t.diffFieldStart, unit: 's' },
      { key: 'zone2_time_end', label: (t) => t.diffFieldEnd, unit: 's' },
      { key: 'zone2_boost', label: () => 'boost' },
      { key: 'zone2_multiplier_Kp', label: () => '×Kp' },
      { key: 'zone2_multiplier_Kd', label: () => '×Kd' },
    ],
  },
  {
    title: (t) => t.diffGroupCorner1,
    fields: [
      { key: 'corner1_time_start', label: (t) => t.diffFieldStart, unit: 's' },
      { key: 'corner1_time_end', label: (t) => t.diffFieldEnd, unit: 's' },
    ],
  },
  {
    title: (t) => t.diffGroupOther,
    fields: [{ key: 'recommended_level', label: (t) => t.diffFieldRecommendedLevel }],
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
  const { t } = useI18n();
  if (profiles.length === 0) return null;
  const base = profiles[0];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-700 text-left">
            <th className="px-3 py-2 font-medium text-zinc-400">{t.diffColItem}</th>
            {profiles.map((p, i) => (
              <th key={p.id} className="px-3 py-2 font-medium">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: p.color }}
                  />
                  {p.profile.name}
                  {i === 0 && <span className="text-xs text-zinc-500">{t.diffBaseline}</span>}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((group) => (
            <FieldGroup key={group.title(t)} group={group} profiles={profiles} base={base} t={t} />
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
  t,
}: {
  group: { title: (t: Dict) => string; fields: Field[] };
  profiles: LoadedProfile[];
  base: LoadedProfile;
  t: Dict;
}) {
  return (
    <>
      <tr className="bg-zinc-800/40">
        <td
          colSpan={profiles.length + 1}
          className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-400/80"
        >
          {group.title(t)}
        </td>
      </tr>
      {group.fields.map((field) => {
        const baseVal = base.profile.raw[field.key];
        return (
          <tr key={field.key} className="border-b border-zinc-800/60">
            <td className="px-3 py-1.5 text-zinc-400">
              {field.label(t)}
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
