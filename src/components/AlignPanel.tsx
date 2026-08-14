import type { AlignRefCol } from '../lib/klog';
import type { AlignMode } from '../lib/profiles';
import { useI18n } from '../i18n/context';
import type { Dict } from '../i18n/en';

interface Props {
  alignMode: AlignMode;
  onAlignModeChange: (mode: AlignMode) => void;
  alignTemp: number;
  onAlignTempChange: (temp: number) => void;
  alignRefCol: AlignRefCol;
  onAlignRefColChange: (col: AlignRefCol) => void;
}

function refColLabel(t: Dict, c: AlignRefCol): string {
  switch (c) {
    case 'meanTemp':
      return t.refColMeanTemp;
    case 'temp':
      return t.refColTemp;
    case 'spotTemp':
      return t.refColSpotTemp;
  }
}

const REF_COLS: AlignRefCol[] = ['meanTemp', 'temp', 'spotTemp'];

export default function AlignPanel({
  alignMode,
  onAlignModeChange,
  alignTemp,
  onAlignTempChange,
  alignRefCol,
  onAlignRefColChange,
}: Props) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400">
      <span className="text-zinc-500">{t.alignByLabel}</span>
      <label className="flex items-center gap-1.5">
        <input
          type="radio"
          name="alignMode"
          checked={alignMode === 'time'}
          onChange={() => onAlignModeChange('time')}
        />
        {t.alignByTime}
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="radio"
          name="alignMode"
          checked={alignMode === 'fc'}
          onChange={() => onAlignModeChange('fc')}
        />
        {t.alignByFirstCrack}
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="radio"
          name="alignMode"
          checked={alignMode === 'temp'}
          onChange={() => onAlignModeChange('temp')}
        />
        {t.alignByTemperature}
        <input
          type="number"
          step={0.1}
          value={alignTemp}
          onChange={(e) => {
            onAlignTempChange(parseFloat(e.target.value) || 0);
            onAlignModeChange('temp');
          }}
          className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right tabular-nums"
        />
        {t.alignByOn}
        <select
          value={alignRefCol}
          onChange={(e) => {
            onAlignRefColChange(e.target.value as AlignRefCol);
            onAlignModeChange('temp');
          }}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
        >
          {REF_COLS.map((c) => (
            <option key={c} value={c}>
              {refColLabel(t, c)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
