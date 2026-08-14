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
  /** 表示名: profile_file_name → fileName の順で採用(空なら short_name は使わない。内蔵プロファイルの short_name は全ログ共通で無意味なため) */
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

  const fileNameField = header['profile_file_name']?.trim();
  const name = fileNameField ? fileNameField : fileName;

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
