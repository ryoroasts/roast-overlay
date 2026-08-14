import type { AlignRefCol } from '../lib/klog';
import type { AlignMode } from '../lib/profiles';

interface Props {
  alignMode: AlignMode;
  onAlignModeChange: (mode: AlignMode) => void;
  alignTemp: number;
  onAlignTempChange: (temp: number) => void;
  alignRefCol: AlignRefCol;
  onAlignRefColChange: (col: AlignRefCol) => void;
}

const REF_COL_LABELS: Record<AlignRefCol, string> = {
  meanTemp: 'mean_temp',
  temp: 'temp',
  spotTemp: 'spot_temp',
};

export default function AlignPanel({
  alignMode,
  onAlignModeChange,
  alignTemp,
  onAlignTempChange,
  alignRefCol,
  onAlignRefColChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400">
      <span className="text-zinc-500">Align by:</span>
      <label className="flex items-center gap-1.5">
        <input
          type="radio"
          name="alignMode"
          checked={alignMode === 'time'}
          onChange={() => onAlignModeChange('time')}
        />
        Time(0 = roast start)
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="radio"
          name="alignMode"
          checked={alignMode === 'fc'}
          onChange={() => onAlignModeChange('fc')}
        />
        First crack(button)
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="radio"
          name="alignMode"
          checked={alignMode === 'temp'}
          onChange={() => onAlignModeChange('temp')}
        />
        Temperature
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
        °C on
        <select
          value={alignRefCol}
          onChange={(e) => {
            onAlignRefColChange(e.target.value as AlignRefCol);
            onAlignModeChange('temp');
          }}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
        >
          {(Object.keys(REF_COL_LABELS) as AlignRefCol[]).map((c) => (
            <option key={c} value={c}>
              {REF_COL_LABELS[c]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
