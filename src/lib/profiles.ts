import type { KproProfile } from './kpro';
import type { RoastLog } from './klog';

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
