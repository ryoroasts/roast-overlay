// UI 文字列(英語・既定言語)。F9。
export interface Dict {
  appName: string;
  appTagline: string;
  appPrivacy: string;
  langToggleEn: string;
  langToggleJa: string;
  sourceLabel: string;

  aboutTitle: string;
  aboutWhat: string;
  aboutAlign: string;
  aboutPrivacy: string;
  /** 日本語UIのみ。英語話者に日本語ブログを見せても意味がないので en では未定義にする */
  aboutNoteLead?: string;
  aboutNoteLink?: string;

  dropzone: string;
  exampleProfiles: string;
  exampleAlign: string;
  exampleOvershoot: string;
  exampleHint: string;
  exampleError: string;

  loadedSection: string;
  toggleVisibility: string;
  remove: string;
  abortedTitle: (reason: number, roastEnd: string) => string;
  didNotReachTemp: (temp: number) => string;
  noFirstCrackRecorded: string;
  noFC: string;

  sectionAlignBy: string;
  sectionRoastCurve: string;
  sectionDeviation: string;
  sectionEndTemp: string;
  sectionPhases: string;
  sectionSummary: string;
  sectionScalarDiff: string;

  alignByLabel: string;
  alignByTime: string;
  alignByFirstCrack: string;
  alignByTemperature: string;
  alignByOn: string;
  refColMeanTemp: string;
  refColTemp: string;
  refColSpotTemp: string;

  chartNoProfiles: string;
  chartRightAxis: string;
  chartRightAxisFan: string;
  chartRightAxisRoR: string;
  chartRightAxisNone: string;
  chartShowDesignROR: string;
  chartShowZones: string;
  chartShowRaw: string;
  chartRorRequiresKlog: string;
  chartTooltipTime: (t: string) => string;
  chartDesignPrefix: (v: string) => string;

  levelSyncAll: string;
  levelExplain: string;
  levelActual: (v: string) => string;
  levelBeyondPeak: (temp: string, peak: string) => string;

  phasesDryEndTempLabel: string;
  phasesColProfile: string;
  phasesColDryEnd: string;
  phasesColFirstCrack: string;
  phasesColRoastEnd: string;
  phasesColMaillard: string;
  phasesColDevelopment: string;
  phasesColDTR: string;
  phasesFcTooltip: string;
  phasesComparisonNote: (temp: number) => string;
  phasesColProfileMetric: string;
  phasesColButtonBasis: string;
  phasesColTempBasis: string;

  summaryTotalRoastTime: string;
  summaryDevDtr: string;
  summaryLevelUsed: string;
  summaryTargetEndTemp: string;
  summaryActualEndTemp: string;
  summaryDelta: string;
  summaryWeightIn: string;
  summaryWeightOut: string;
  summaryWeightLoss: (v: string) => string;

  deviationColProfile: string;
  deviationColMaxAbove: string;
  deviationColMaxBelow: string;
  deviationColConverged: string;
  deviationColAtEnd: string;
  deviationDidNotConverge: string;
  deviationTooltipTime: (t: string) => string;

  diffGroupPreheat: string;
  diffGroupPID: string;
  diffGroupZone1: string;
  diffGroupZone2: string;
  diffGroupCorner1: string;
  diffGroupOther: string;
  diffFieldPreheatTemp: string;
  diffFieldPreheatPower: string;
  diffFieldStart: string;
  diffFieldEnd: string;
  diffFieldRecommendedLevel: string;
  diffColItem: string;
  diffBaseline: string;
}

export const en: Dict = {
  appName: 'Overlay',
  appTagline: 'See your roast against its design.',
  appPrivacy: 'Your files never leave your browser.',
  langToggleEn: 'EN',
  langToggleJa: '日本語',
  sourceLabel: 'Source',

  aboutTitle: 'What is this?',
  aboutWhat:
    'Overlay is a browser tool for Kaffelogic roasters. Load a .klog and it plots the temperature your roast actually reached against the design curve the machine was following — same graph, solid vs. dashed — plus a panel showing your biggest overshoot, when it converges, and where you land by roast end. "Is this overshoot normal?" becomes a number you can read instead of a guess.',
  aboutAlign:
    'Load several roasts and you can line them up by a chosen bean temperature instead of the first-crack button press. The button is pressed by a human, a few seconds early or late every time, which shifts the Maillard and Development numbers even when the beans did nearly the same thing. Aligning by temperature removes that.',
  aboutPrivacy:
    'No account, no upload. This is a static page: parsing, charting, and comparison all happen in this browser tab, and your files are never sent anywhere. Free and open source (MIT) — the source link above is there so you can check that claim yourself.',

  dropzone: 'Drop .kpro / .klog files here, or click to select (multiple allowed)',
  exampleProfiles: 'Example: two profiles (.kpro)',
  exampleAlign: 'Example: two roasts (.klog)',
  exampleOvershoot: 'Example: an overshoot (.klog)',
  exampleHint: 'No Kaffelogic files handy? Load one of these and look around.',
  exampleError: 'Could not load the example. Please try reloading the page.',

  loadedSection: 'Loaded profiles',
  toggleVisibility: 'Show/hide',
  remove: 'Remove',
  abortedTitle: (reason: number, roastEnd: string) =>
    `Aborted roast: reason=${reason} / ended at ${roastEnd}s`,
  didNotReachTemp: (temp: number) => `did not reach ${temp}°C`,
  noFirstCrackRecorded: 'no first crack recorded',
  noFC: 'no FC',

  sectionAlignBy: 'Align by',
  sectionRoastCurve: 'Roast curve (temperature × time)',
  sectionDeviation: 'Deviation (actual − design)',
  sectionEndTemp: 'End temperature (Level → roast_levels)',
  sectionPhases: 'Phases (Dry / Maillard / Development)',
  sectionSummary: 'Summary',
  sectionScalarDiff: 'Scalar diff (baseline = leftmost)',

  alignByLabel: 'Align by:',
  alignByTime: 'Time (0 = roast start)',
  alignByFirstCrack: 'First crack (button)',
  alignByTemperature: 'Temperature',
  alignByOn: '°C on',
  refColMeanTemp: 'mean_temp',
  refColTemp: 'temp',
  refColSpotTemp: 'spot_temp',

  chartNoProfiles: 'No profiles to display',
  chartRightAxis: 'Right axis:',
  chartRightAxisFan: 'Fan',
  chartRightAxisRoR: 'RoR',
  chartRightAxisNone: 'None',
  chartShowDesignROR: 'Overlay design RoR (dashed)',
  chartShowZones: 'Zone bands',
  chartShowRaw: 'Raw data (spot_temp / temp, .klog only)',
  chartRorRequiresKlog: 'RoR requires a .klog file (no measured RoR in .kpro)',
  chartTooltipTime: (t: string) => `Time ${t}`,
  chartDesignPrefix: (v: string) => `design ${v}`,

  levelSyncAll: 'Sync all (lock every profile to one Level)',
  levelExplain:
    'Level is not roast degree itself — it is an index that linearly interpolates the end ' +
    'temperature from the roast_levels table (Level 0–6) in 0.1 steps. The curve shape never ' +
    'changes, only where it stops. Default: .klog uses the level actually roasted ' +
    '(roasting_level); .kpro uses the recommended level (recommended_level).',
  levelActual: (v: string) => `(actual ${v})`,
  levelBeyondPeak: (temp: string, peak: string) => `${temp}°C — beyond curve peak ${peak}°C`,

  phasesDryEndTempLabel: 'Dry end temperature (mean_temp crosses upward)',
  phasesColProfile: 'Profile',
  phasesColDryEnd: 'Dry end',
  phasesColFirstCrack: 'First crack',
  phasesColRoastEnd: 'Roast end',
  phasesColMaillard: 'Maillard',
  phasesColDevelopment: 'Development',
  phasesColDTR: 'DTR',
  phasesFcTooltip:
    'First crack is a user button press — it drifts with how the beans pop. See Align by temperature.',
  phasesComparisonNote: (temp: number) =>
    `button (hand-pressed First crack) vs temperature (${temp}°C crossing time used instead of FC)`,
  phasesColProfileMetric: 'Profile / metric',
  phasesColButtonBasis: 'button basis',
  phasesColTempBasis: 'temperature basis',

  summaryTotalRoastTime: 'Total roast time',
  summaryDevDtr: 'Development / DTR',
  summaryLevelUsed: 'Level used',
  summaryTargetEndTemp: 'Target end temp',
  summaryActualEndTemp: 'Actual end temp',
  summaryDelta: 'Δ (actual − target)',
  summaryWeightIn: 'in (g)',
  summaryWeightOut: 'out (g)',
  summaryWeightLoss: (v: string) => `Weight loss ${v}%`,

  deviationColProfile: 'Profile',
  deviationColMaxAbove: 'Max above',
  deviationColMaxBelow: 'Max below',
  deviationColConverged: 'Converged',
  deviationColAtEnd: 'At end',
  deviationDidNotConverge: 'did not converge',
  deviationTooltipTime: (t: string) => `Time ${t}`,

  diffGroupPreheat: 'Preheat',
  diffGroupPID: 'PID',
  diffGroupZone1: 'Zone 1',
  diffGroupZone2: 'Zone 2',
  diffGroupCorner1: 'Corner 1',
  diffGroupOther: 'Other',
  diffFieldPreheatTemp: 'Preheat target temp',
  diffFieldPreheatPower: 'Preheat power',
  diffFieldStart: 'Start',
  diffFieldEnd: 'End',
  diffFieldRecommendedLevel: 'Recommended Level',
  diffColItem: 'Item',
  diffBaseline: '(baseline)',
};
