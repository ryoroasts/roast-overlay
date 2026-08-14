import type { KproProfile } from './kpro';

/** UI 上で扱う、読み込み済みプロファイル(色・表示状態つき) */
export interface LoadedProfile {
  id: string;
  color: string;
  visible: boolean;
  profile: KproProfile;
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}
