import type { KproProfile } from './kpro';
import { firstUpwardCrossing, KLOG_COL, type AlignRefCol, type RoastLog } from './klog';

export type LoadedKind = 'kpro' | 'klog';

/** ファイルドロップ直後のパース結果(色・id 付与前) */
export type ParsedFile = { kind: 'kpro'; kpro: KproProfile } | { kind: 'klog'; klog: RoastLog };

/** UI 上で扱う、読み込み済みプロファイル(色・表示状態つき) */
export interface LoadedProfile {
  id: string;
  color: string;
  visible: boolean;
  kind: LoadedKind;
  /** チャート/Level 計算に使う設計カーブ。.klog の場合は log.design と同じ */
  profile: KproProfile;
  /** kind === 'klog' のときのみ */
  log?: RoastLog;
  /** この行固有の Level(0〜6, 0.1刻み)。Sync all OFF のときに使う */
  level: number;
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

/** Level の初期値: .klog → roasting_level(実際に焼いた値)、.kpro → recommended_level */
export function defaultLevel(f: ParsedFile): number {
  if (f.kind === 'klog') return f.klog.roastingLevel;
  const n = parseFloat(f.kpro.raw['recommended_level'] ?? '');
  return Number.isFinite(n) ? n : 3.0;
}

// F6: 温度基準アラインメント
export type AlignMode = 'time' | 'fc' | 'temp';

export interface AlignShift {
  /** 実時間からこの値を引くと表示時間になる(x=0 に来る基準点の実時間) */
  shift: number;
  /** 基準点に到達した(= シフトできた)か。false なら shift は 0 のまま、線は消さず注記を出す */
  reached: boolean;
}

/**
 * プロファイルごとの時間シフト量(§6 F6)。
 * - Time: シフトなし。
 * - First crack: !first_crack の時刻を x=0 に。無ければ reached=false。
 * - Temperature: 基準線(alignRefCol)が alignTemp を上向きに最初に横切る時刻を x=0 に。
 *   到達しなければ reached=false。
 * .kpro 単体(実測が無い)は常にシフトなし。
 */
export function computeAlignShift(
  p: LoadedProfile,
  mode: AlignMode,
  alignTemp: number,
  alignRefCol: AlignRefCol,
): AlignShift {
  if (mode === 'time' || p.kind !== 'klog' || !p.log) return { shift: 0, reached: true };

  if (mode === 'fc') {
    if (p.log.firstCrack == null) return { shift: 0, reached: false };
    return { shift: p.log.firstCrack, reached: true };
  }

  // mode === 'temp'
  const t = firstUpwardCrossing(p.log.rows, KLOG_COL[alignRefCol], alignTemp);
  if (t == null) return { shift: 0, reached: false };
  return { shift: t, reached: true };
}
