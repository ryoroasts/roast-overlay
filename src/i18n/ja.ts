// UI 文字列(日本語)。F9。
import type { Dict } from './en';

export const ja: Dict = {
  appName: 'Overlay',
  appTagline: 'See your roast against its design.',
  appPrivacy: 'ファイルはブラウザ内で処理され、どこにも送信されません。',
  langToggleEn: 'EN',
  langToggleJa: '日本語',

  dropzone: '.kpro / .klog をここにドラッグ&ドロップ、またはクリックして選択(複数可)',

  loadedSection: '読み込み済みプロファイル',
  toggleVisibility: '表示/非表示',
  remove: '削除',
  abortedTitle: (reason: number, roastEnd: string) =>
    `中断ログ: reason=${reason} / roast_end=${roastEnd}s で終了`,
  didNotReachTemp: (temp: number) => `${temp}°C に到達せず`,
  noFirstCrackRecorded: '1ハゼの記録なし',
  noFC: 'FC無し',

  sectionAlignBy: 'Align by',
  sectionRoastCurve: 'Roast カーブ(温度 × 時間)',
  sectionDeviation: 'Deviation(実測 − 設計)',
  sectionEndTemp: '終了温度(Level → roast_levels 補間)',
  sectionPhases: 'フェーズ(Dry / Maillard / Development)',
  sectionSummary: 'Summary',
  sectionScalarDiff: 'スカラー差分(基準=左端)',

  alignByLabel: 'Align by:',
  alignByTime: 'Time(0 = roast start)',
  alignByFirstCrack: 'First crack(button)',
  alignByTemperature: 'Temperature',
  alignByOn: '°C on',
  refColMeanTemp: 'mean_temp',
  refColTemp: 'temp',
  refColSpotTemp: 'spot_temp',

  chartNoProfiles: '表示するプロファイルがありません',
  chartRightAxis: '右軸:',
  chartRightAxisFan: 'Fan',
  chartRightAxisRoR: 'RoR',
  chartRightAxisNone: 'なし',
  chartShowDesignROR: '設計 RoR も重ねる(破線)',
  chartShowZones: 'Zone 帯',
  chartShowRaw: '生データ(spot_temp / temp、.klog のみ)',
  chartRorRequiresKlog: 'RoR requires a .klog file(.kpro には実測 RoR がありません)',
  chartTooltipTime: (t: string) => `時間 ${t}`,
  chartDesignPrefix: (v: string) => `design ${v}`,

  levelSyncAll: 'Sync all(全プロファイルを1つの Level に揃える)',
  levelExplain:
    'Level は焙煎度の絶対値ではなく、roast_levels テーブル(Level 0〜6)から終了温度を' +
    '0.1 刻みで線形補間して選ぶインデックス。カーブ自体は不変で、止める温度だけが変わる。' +
    '既定値は .klog は実際に焼いた Level(roasting_level)、.kpro は推奨 Level(recommended_level)。',
  levelActual: (v: string) => `(actual ${v})`,
  levelBeyondPeak: (temp: string, peak: string) => `${temp}°C — beyond curve peak ${peak}°C`,

  phasesDryEndTempLabel: 'Dry end 温度(mean_temp が上向きに横切る基準)',
  phasesColProfile: 'プロファイル',
  phasesColDryEnd: 'Dry end',
  phasesColFirstCrack: 'First crack',
  phasesColRoastEnd: 'Roast end',
  phasesColMaillard: 'Maillard',
  phasesColDevelopment: 'Development',
  phasesColDTR: 'DTR',
  phasesFcTooltip:
    'First crack はユーザーの手押し(button press)。豆の弾け方でずれる — see Align by temperature',
  phasesComparisonNote: (temp: number) =>
    `button 基準(手押しの First crack) vs temperature 基準(${temp}℃ 通過時刻を FC の代わりに使う)`,
  phasesColProfileMetric: 'プロファイル / 項目',
  phasesColButtonBasis: 'button 基準',
  phasesColTempBasis: 'temperature 基準',

  summaryTotalRoastTime: 'Total roast time',
  summaryDevDtr: 'Development / DTR',
  summaryLevelUsed: 'Level used',
  summaryTargetEndTemp: 'Target end temp',
  summaryActualEndTemp: 'Actual end temp',
  summaryDelta: 'Δ(actual − target)',
  summaryWeightIn: 'in (g)',
  summaryWeightOut: 'out (g)',
  summaryWeightLoss: (v: string) => `Weight loss ${v}%`,

  deviationColProfile: 'プロファイル',
  deviationColMaxAbove: 'Max above',
  deviationColMaxBelow: 'Max below',
  deviationColConverged: 'Converged',
  deviationColAtEnd: 'At end',
  deviationDidNotConverge: 'did not converge',
  deviationTooltipTime: (t: string) => `時間 ${t}`,

  diffGroupPreheat: 'Preheat',
  diffGroupPID: 'PID',
  diffGroupZone1: 'Zone 1',
  diffGroupZone2: 'Zone 2',
  diffGroupCorner1: 'Corner 1',
  diffGroupOther: 'その他',
  diffFieldPreheatTemp: '予熱目標温度',
  diffFieldPreheatPower: '予熱パワー',
  diffFieldStart: '開始',
  diffFieldEnd: '終了',
  diffFieldRecommendedLevel: '推奨 Level',
  diffColItem: '項目',
  diffBaseline: '(基準)',
};
