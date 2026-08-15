// UI 文字列(日本語)。F9。
import type { Dict } from './en';

export const ja: Dict = {
  appName: 'Overlay',
  appTagline: '焼いた結果を、設計した曲線と重ねて見る。',
  appPrivacy: 'ファイルはブラウザ内で処理され、どこにも送信されません。',
  langToggleEn: 'EN',
  langToggleJa: '日本語',
  sourceLabel: 'ソース',

  aboutTitle: 'これは何か',
  aboutWhat:
    'Overlay は Kaffelogic で焙煎する人のためのブラウザツールです。.klog を読み込むと、実際に到達した温度と、機体が追いかけていた設計曲線を同じグラフに重ねます(実線と破線)。あわせて、最大でどれだけ上振れしたか・いつ収束したか・焙煎終了時にどれだけずれていたかを表示します。「この上振れは普通なのか」を、勘ではなく数字で読めます。',
  aboutAlign:
    '複数の焙煎を読み込むと、1ハゼボタンではなく指定した豆温度の通過時刻で揃えられます。1ハゼは人がボタンを押すので毎回数秒早くなったり遅くなったりし、豆がほぼ同じ動きをしていてもメイラードと発展相の数字がずれます。温度で揃えると、そのぶれが消えます。',
  aboutPrivacy:
    'アカウント不要・アップロードなし。これは静的ページで、解析も描画も比較もこのブラウザタブの中だけで完結し、ファイルはどこにも送信されません。無料・オープンソース(MIT)です。上のソースリンクは、その主張をご自分で確認していただくために置いています。',

  dropzone: '.kpro / .klog をここにドラッグ&ドロップ、またはクリックして選択(複数可)',
  exampleOvershoot: '例: 上振れした焙煎',
  exampleAlign: '例: 2本を比べる',
  exampleHint:
    '手元に Kaffelogic のファイルがなくても試せます。1つめは最初の1分で設計曲線を +12℃ 上回った焙煎、2つめは1ハゼボタンから豆温度基準に切り替えると数字が動く2本です。',
  exampleError: '例を読み込めませんでした。ページを再読み込みしてお試しください。',

  loadedSection: '読み込み済みプロファイル',
  toggleVisibility: '表示/非表示',
  remove: '削除',
  abortedTitle: (reason: number, roastEnd: string) =>
    `中断ログ: reason=${reason} / roast_end=${roastEnd}s で終了`,
  didNotReachTemp: (temp: number) => `${temp}°C に到達せず`,
  noFirstCrackRecorded: '1ハゼの記録なし',
  noFC: 'FC無し',

  sectionAlignBy: '基準を揃える',
  sectionRoastCurve: 'Roast カーブ(温度 × 時間)',
  sectionDeviation: 'Deviation(実測 − 設計)',
  sectionEndTemp: '終了温度(Level → roast_levels 補間)',
  sectionPhases: 'フェーズ(Dry / Maillard / Development)',
  sectionSummary: 'まとめ',
  sectionScalarDiff: 'スカラー差分(基準=左端)',

  alignByLabel: '基準:',
  alignByTime: '時刻(0 = 焙煎開始)',
  alignByFirstCrack: '1ハゼ(ボタン)',
  alignByTemperature: '温度',
  alignByOn: '℃ / 基準線',
  refColMeanTemp: 'mean_temp',
  refColTemp: 'temp',
  refColSpotTemp: 'spot_temp',

  chartNoProfiles: '表示するプロファイルがありません',
  chartRightAxis: '右軸:',
  chartRightAxisFan: 'ファン',
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
  phasesColDryEnd: '乾燥の終わり',
  phasesColFirstCrack: '1ハゼ',
  phasesColRoastEnd: '焙煎終了',
  phasesColMaillard: 'メイラード',
  phasesColDevelopment: '発展相',
  phasesColDTR: 'DTR',
  phasesFcTooltip:
    'First crack はユーザーの手押し(button press)。豆の弾け方でずれる — see Align by temperature',
  phasesComparisonNote: (temp: number) =>
    `button 基準(手押しの First crack) vs temperature 基準(${temp}℃ 通過時刻を FC の代わりに使う)`,
  phasesColProfileMetric: 'プロファイル / 項目',
  phasesColButtonBasis: 'button 基準',
  phasesColTempBasis: 'temperature 基準',

  summaryTotalRoastTime: '総焙煎時間',
  summaryDevDtr: '発展相 / DTR',
  summaryLevelUsed: '使用 Level',
  summaryTargetEndTemp: '終了温度(目標)',
  summaryActualEndTemp: '終了温度(実測)',
  summaryDelta: 'Δ(actual − target)',
  summaryWeightIn: '生豆(g)',
  summaryWeightOut: '焼上(g)',
  summaryWeightLoss: (v: string) => `Weight loss ${v}%`,

  deviationColProfile: 'プロファイル',
  deviationColMaxAbove: '最大の上振れ',
  deviationColMaxBelow: '最大の下振れ',
  deviationColConverged: '収束',
  deviationColAtEnd: '終了時点',
  deviationDidNotConverge: '収束せず',
  deviationTooltipTime: (t: string) => `時間 ${t}`,

  diffGroupPreheat: '予熱',
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
