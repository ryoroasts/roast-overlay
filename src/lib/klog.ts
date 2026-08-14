// Kaffelogic .klog パーサ
//
// .klog はプレーン ASCII / LF。3ブロック構成:
//   ① key:value ヘッダ(.kpro の全項目 + 機体情報 + roast_profile / fan_profile / roast_levels)
//   ② !event 行(ヘッダ末尾に固まっているとは限らず、データ行の間に混在する)
//   ③ offsets 行 → カラム見出し行 → タブ区切りデータ行(1Hz)
//
// 行の種別は内容だけで判別できる:
//   - "!" で始まる → イベント行
//   - ":" を含む(イベント行を除く)→ ヘッダの key:value 行
//   - それ以外をタブ分割し、先頭要素が数値なら → データ行
//     ("offsets" 行・カラム見出し行は先頭要素が数値でないため自然に弾かれる)

import { kproFromRaw, parseRoastLevels, type KproProfile } from './kpro';

export interface KlogEvent {
  key: string;
  t: number;
}

export interface RoastLog {
  fileName: string;
  /**
   * 表示名。**ログのファイル名を主、プロファイル名を従**にする。
   *
   * 同じプロファイルを Level 違いで焼いて比べるのは中心的な使い方なので
   * (例: ninjaturtle を Lv1.5 と Lv2.0)、プロファイル名を主にすると
   * 2本が同名になって区別できなくなる。ログのファイル名は焙煎ごとに必ず違う。
   *
   *   log0028 (ninjaturtle)   ← プロファイル名が取れる場合
   *   log0028                 ← 取れない場合
   */
  name: string;
  header: Record<string, string>;
  events: KlogEvent[];
  /** t <= roastEnd に切り詰めていない全行(クーリング含む) */
  rows: number[][];
  firstCrack: number | null;
  roastEnd: number;
  endReason: number;
  developmentPercent: number | null;
  roastingLevel: number;
  roastLevels: number[];
  /** ヘッダに含まれる設計カーブ。`.kpro` と同じ形に構造化 */
  design: KproProfile;
  /** 中断ログ判定: endReason !== 0 || roastEnd < 60 */
  aborted: boolean;
}

// データ行のカラム(§2.3, 0-indexed)
export const KLOG_COL = {
  time: 0,
  spotTemp: 1,
  temp: 2,
  meanTemp: 3,
  profile: 4,
  profileROR: 5,
  actualROR: 6,
  desiredROR: 7,
  powerKW: 8,
  actualFanRPM: 13,
} as const;

/** t<=roastEnd に限定した列値。クーリング区間は描かない(§5 F2)。 */
export function klogValueAt(log: RoastLog, col: number, t: number): number | null {
  if (t > log.roastEnd) return null;
  return rowValueAtTime(log.rows, col, t);
}

/** rows 上の valueCol 列を、time 列で線形補間して t の値を返す。範囲外は null。 */
export function rowValueAtTime(rows: number[][], valueCol: number, t: number): number | null {
  if (rows.length === 0) return null;
  const timeCol = KLOG_COL.time;
  if (t < rows[0][timeCol] || t > rows[rows.length - 1][timeCol]) return null;
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (t >= a[timeCol] && t <= b[timeCol]) {
      if (b[timeCol] === a[timeCol]) return a[valueCol];
      const f = (t - a[timeCol]) / (b[timeCol] - a[timeCol]);
      return a[valueCol] + f * (b[valueCol] - a[valueCol]);
    }
  }
  return rows[rows.length - 1][valueCol];
}

/** rows 内で valueCol が threshold を上向きに最初に横切る時刻(線形補間)。無ければ null。 */
export function firstUpwardCrossing(rows: number[][], valueCol: number, threshold: number): number | null {
  const timeCol = KLOG_COL.time;
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (a[valueCol] < threshold && b[valueCol] >= threshold) {
      if (b[valueCol] === a[valueCol]) return a[timeCol];
      const f = (threshold - a[valueCol]) / (b[valueCol] - a[valueCol]);
      return a[timeCol] + f * (b[timeCol] - a[timeCol]);
    }
  }
  return null;
}

export const DEFAULT_DRY_END_TEMP = 150.0;

/** Dry end 閾値の既定値。expect_colrchange が非0ならそれを使う(§5 F5)。 */
export function defaultDryEndTemp(log: RoastLog): number {
  const v = parseFloat(log.header['expect_colrchange'] ?? '');
  return Number.isFinite(v) && v !== 0 ? v : DEFAULT_DRY_END_TEMP;
}

export interface Phases {
  dryEnd: number | null;
  maillard: number | null;
  development: number | null;
  /** 0〜1 の割合(% 表示は呼び出し側で ×100) */
  dtr: number | null;
}

/**
 * Dry/Maillard/Development/DTR(§5)。fcTime に「発展相の起点」として使う時刻を渡す
 * (通常は log.firstCrack。F6 の温度基準表示では代わりに温度通過時刻を渡す)。null なら
 * Maillard/Development/DTR は null。
 */
export function computePhasesAt(log: RoastLog, dryEndTemp: number, fcTime: number | null): Phases {
  const dryEnd = firstUpwardCrossing(log.rows, KLOG_COL.meanTemp, dryEndTemp);
  const maillard = fcTime != null && dryEnd != null ? fcTime - dryEnd : null;
  const development = fcTime != null ? log.roastEnd - fcTime : null;
  const dtr = development != null && log.roastEnd > 0 ? development / log.roastEnd : null;
  return { dryEnd, maillard, development, dtr };
}

/** button(手押しの First crack)基準の Phases。既定の呼び出し方。 */
export function computePhases(log: RoastLog, dryEndTemp: number): Phases {
  return computePhasesAt(log, dryEndTemp, log.firstCrack);
}

// F6: 温度基準アラインメント
export const DEFAULT_ALIGN_TEMP = 200.0;

/** 基準線の選択肢(既定 mean_temp)。 */
export type AlignRefCol = 'meanTemp' | 'temp' | 'spotTemp';

/**
 * Align by Temperature の既定温度(§6 F6):
 * 最初に読み込んだログの First crack 時点の mean_temp を 0.1℃ に丸めた値。
 * FC が無ければ expect_fc、それも無ければ 200.0。
 */
export function defaultAlignTemp(log: RoastLog): number {
  if (log.firstCrack != null) {
    const v = rowValueAtTime(log.rows, KLOG_COL.meanTemp, log.firstCrack);
    if (v != null) return Math.round(v * 10) / 10;
  }
  const expectFc = parseFloat(log.header['expect_fc'] ?? '');
  if (Number.isFinite(expectFc) && expectFc !== 0) return expectFc;
  return DEFAULT_ALIGN_TEMP;
}

// F7: 設計からの偏差(deviation = mean_temp − profile)の判定定数。1箇所にまとめておく。
export const DEVIATION_BAND = 3; // ℃
export const DEVIATION_SUMMARY_START = 30; // s(立ち上がりの下振れを除外)

export interface DeviationSummary {
  maxAbove: { value: number; t: number } | null;
  maxBelow: { value: number; t: number } | null;
  /** それ以降ずっと |deviation| < DEVIATION_BAND を保つ最初の時刻。収束しなければ null */
  converged: number | null;
  atEnd: number | null;
}

/** t<=roastEnd の deviation(t) = mean_temp(t) - profile(t) 点列(0s から)。 */
export function deviationSeries(log: RoastLog): { t: number; v: number }[] {
  const out: { t: number; v: number }[] = [];
  for (const row of log.rows) {
    const t = row[KLOG_COL.time];
    if (t > log.roastEnd) continue;
    out.push({ t, v: row[KLOG_COL.meanTemp] - row[KLOG_COL.profile] });
  }
  return out;
}

/** 表示B(§5 F7)。t < DEVIATION_SUMMARY_START は除外して集計する。 */
export function computeDeviationSummary(
  log: RoastLog,
  band = DEVIATION_BAND,
  startT = DEVIATION_SUMMARY_START,
): DeviationSummary {
  const series = deviationSeries(log).filter((p) => p.t >= startT);
  if (series.length === 0) return { maxAbove: null, maxBelow: null, converged: null, atEnd: null };

  let maxAbove = series[0];
  let maxBelow = series[0];
  let lastViolation = -1;
  series.forEach((p, i) => {
    if (p.v > maxAbove.v) maxAbove = p;
    if (p.v < maxBelow.v) maxBelow = p;
    if (Math.abs(p.v) >= band) lastViolation = i;
  });
  const converged = lastViolation === series.length - 1 ? null : series[lastViolation + 1].t;

  const meanEnd = rowValueAtTime(log.rows, KLOG_COL.meanTemp, log.roastEnd);
  const profileEnd = rowValueAtTime(log.rows, KLOG_COL.profile, log.roastEnd);
  const atEnd = meanEnd != null && profileEnd != null ? meanEnd - profileEnd : null;

  return {
    maxAbove: { value: maxAbove.v, t: maxAbove.t },
    maxBelow: { value: maxBelow.v, t: maxBelow.t },
    converged,
    atEnd,
  };
}

function lastEventValue(events: KlogEvent[], key: string): number | null {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].key === key) return events[i].t;
  }
  return null;
}

export function parseKlog(text: string, fileName: string): RoastLog {
  const header: Record<string, string> = {};
  const events: KlogEvent[] = [];
  const rows: number[][] = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim()) continue;

    if (line.startsWith('!')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(1, idx).trim();
      const value = parseFloat(line.slice(idx + 1));
      if (Number.isFinite(value)) events.push({ key, t: value });
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      header[key] = line.slice(colonIdx + 1);
      continue;
    }

    const parts = line.split('\t').filter((s) => s.trim() !== '');
    if (parts.length === 0) continue;
    const nums = parts.map((s) => parseFloat(s));
    if (!Number.isFinite(nums[0])) continue; // "offsets" / カラム見出し行
    rows.push(nums);
  }

  // ログのファイル名(拡張子なし)を主にする。プロファイル名は括弧で従える
  const stem = fileName.replace(/\.klog$/i, '');
  const profileName = header['profile_file_name']?.trim().replace(/\.kpro$/i, '');
  const name = profileName ? `${stem} (${profileName})` : stem;

  const firstCrack = lastEventValue(events, 'first_crack');
  const roastEnd = lastEventValue(events, 'roast_end') ?? 0;
  const endReason = lastEventValue(events, 'roast_end_reason') ?? 0;
  const developmentPercent = lastEventValue(events, 'development_percent');
  const roastingLevel = parseFloat(header['roasting_level'] ?? '') || 0;
  const roastLevels = parseRoastLevels(header['roast_levels']);
  const design = kproFromRaw(header, name, fileName);

  return {
    fileName,
    name,
    header,
    events,
    rows,
    firstCrack,
    roastEnd,
    endReason,
    developmentPercent,
    roastingLevel,
    roastLevels,
    design,
    aborted: endReason !== 0 || roastEnd < 60,
  };
}
