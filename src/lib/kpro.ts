// Kaffelogic .kpro パーサ
//
// .kpro はプレーン ASCII / LF / BOM なし / チェックサムなし。
// 1 行 = `key:value`。
//
// roast_profile / fan_profile は (時間秒, 値) のペア列。
// 先頭・末尾に time=0 のパディングペアが入る。
// パディングを除いた実データは **3 ペアで 1 グループ**。
// 各グループは [アンカー, 制御点, 制御点] で、
//   - アンカー(曲線が実際に通る点)= グループの **1 番目**
//   - 残り 2 つ = そのアンカーから次のアンカーへ向かう区間の 2 制御点
//     (格納順は不定なので時間でソートして cp1, cp2 とする)
//
// 例) roast_profile の 1 グループ:
//   [ (7.09,48.8)=アンカー, (59.06,125.0), (33.40,108.4) ]
//   → 制御点を時間順に並べ替え cp1=(33.40,108.4), cp2=(59.06,125.0)
// 隣接アンカー Aᵢ→Aᵢ₊₁ の区間を、
//   start=Aᵢ, cp1/cp2=グループ i の制御点(時間順), end=Aᵢ₊₁
// の 3 次ベジェで描くと Kaffelogic Studio と同じ曲線になる。
// (Studio のファン値 ― v2b で 7:00≒13540 ― と一致することで構造を確定)

export interface Point {
  t: number; // 時間(秒)
  v: number; // 値(温度℃ または ファンRPM)
}

/** 3 次ベジェの 1 セグメント */
export interface BezierSegment {
  start: Point;
  cp1: Point;
  cp2: Point;
  end: Point;
}

/** roast_profile / fan_profile の構造化結果 */
export interface CurveData {
  /** 曲線が通るアンカー点(時間昇順) */
  anchors: Point[];
  /** アンカー間を結ぶ 3 次ベジェセグメント */
  segments: BezierSegment[];
}

export interface KproProfile {
  /** 表示名(profile_short_name、無ければファイル名) */
  name: string;
  /** 元ファイル名 */
  fileName: string;
  designer: string;
  /** \v を改行に戻した説明文 */
  description: string;
  /** roast_profile(温度カーブ) */
  roast: CurveData;
  /** fan_profile(ファン RPM) */
  fan: CurveData;
  /** roast_levels: Level 0..6 の終了温度(7 値) */
  roastLevels: number[];
  /** 全 key:value(数値/文字列そのまま) */
  raw: Record<string, string>;
}

/** "key:value" 行群を Record に */
function parseLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1); // value 内の ':' は保持
    out[key] = value.replace(/\r$/, '');
  }
  return out;
}

/** カンマ区切り数値列 → ペア列(time<=0 のパディングを除外) */
function toPairs(csv: string | undefined): Point[] {
  if (!csv) return [];
  const nums = csv
    .split(',')
    .map((s) => parseFloat(s.trim()))
    .filter((n) => Number.isFinite(n));
  const pairs: Point[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pairs.push({ t: nums[i], v: nums[i + 1] });
  }
  // 先頭 (0,20)(0,0) / 末尾 (0,0) などの time=0 パディングを落とす
  return pairs.filter((p) => p.t > 0);
}

/** ペア列 → アンカー & ベジェセグメント */
export function buildCurve(csv: string | undefined): CurveData {
  const pairs = toPairs(csv);
  // 3 ペア = [左制御, 右制御, アンカー] のグループに分割
  const groups: Point[][] = [];
  for (let i = 0; i + 2 < pairs.length + 1; i += 3) {
    const g = pairs.slice(i, i + 3);
    if (g.length === 3) groups.push(g);
  }
  const anchors = groups.map((g) => g[0]);

  const segments: BezierSegment[] = [];
  for (let i = 0; i + 1 < groups.length; i++) {
    // グループ i の 2 制御点を時間順に並べ替えて cp1(早), cp2(遅)
    const [cp1, cp2] = [groups[i][1], groups[i][2]].sort((a, b) => a.t - b.t);
    segments.push({
      start: groups[i][0], // アンカー i
      cp1,
      cp2,
      end: groups[i + 1][0], // アンカー i+1
    });
  }

  // 最終グループの制御点2つは、最終アンカーより後ろへ伸びる最終セグメントの
  // [制御点, 終端アンカー] を表す(§2.4(b))。cp1=cp2=制御点として1本追加する。
  if (groups.length > 0) {
    const lastAnchor = anchors[anchors.length - 1];
    const [cp, finalAnchor] = [groups[groups.length - 1][1], groups[groups.length - 1][2]].sort(
      (a, b) => a.t - b.t,
    );
    if (finalAnchor.t > lastAnchor.t) {
      segments.push({ start: lastAnchor, cp1: cp, cp2: cp, end: finalAnchor });
      anchors.push(finalAnchor);
    }
  }

  return { anchors, segments };
}

/** zone1 / zone2 / corner1 のうち、有効(end > start)な時間帯 */
export interface ActiveZone {
  key: 'zone1' | 'zone2' | 'corner1';
  label: string;
  start: number;
  end: number;
  boost: number | null;
  multiplierKp: number | null;
  multiplierKd: number | null;
}

const ZONE_DEFS: { key: ActiveZone['key']; label: string }[] = [
  { key: 'zone1', label: 'Z1' },
  { key: 'zone2', label: 'Z2' },
  { key: 'corner1', label: 'C1' },
];

function num(raw: Record<string, string>, key: string): number | null {
  const v = raw[key];
  if (v == null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function activeZones(raw: Record<string, string>): ActiveZone[] {
  const out: ActiveZone[] = [];
  for (const { key, label } of ZONE_DEFS) {
    const start = num(raw, `${key}_time_start`);
    const end = num(raw, `${key}_time_end`);
    if (start == null || end == null || end <= start) continue;
    out.push({
      key,
      label,
      start,
      end,
      boost: num(raw, `${key}_boost`),
      multiplierKp: num(raw, `${key}_multiplier_Kp`),
      multiplierKd: num(raw, `${key}_multiplier_Kd`),
    });
  }
  return out;
}

export function parseRoastLevels(csv: string | undefined): number[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((s) => parseFloat(s.trim()))
    .filter((n) => Number.isFinite(n));
}

/** key:value の Record(.kpro 本体 or .klog ヘッダ)から KproProfile を組み立てる */
export function kproFromRaw(raw: Record<string, string>, name: string, fileName: string): KproProfile {
  return {
    name,
    fileName,
    designer: raw['profile_designer']?.trim() ?? '',
    description: (raw['profile_description'] ?? '').replace(/\\v/g, '\n'),
    roast: buildCurve(raw['roast_profile']),
    fan: buildCurve(raw['fan_profile']),
    roastLevels: parseRoastLevels(raw['roast_levels']),
    raw,
  };
}

/** .kpro テキスト全体をパース */
export function parseKpro(text: string, fileName: string): KproProfile {
  const raw = parseLines(text);
  const shortName = raw['profile_short_name']?.trim();
  return kproFromRaw(raw, shortName || fileName.replace(/\.kpro$/i, ''), fileName);
}
