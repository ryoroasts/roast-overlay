import { useState } from 'react';
import FileDrop from './components/FileDrop';
import RoastChart from './components/RoastChart';
import DiffTable from './components/DiffTable';
import LevelPanel from './components/LevelPanel';
import PhasesPanel from './components/PhasesPanel';
import DeviationPanel from './components/DeviationPanel';
import AlignPanel from './components/AlignPanel';
import SummaryPanel from './components/SummaryPanel';
import { DEFAULT_DRY_END_TEMP, defaultDryEndTemp, defaultAlignTemp, type AlignRefCol } from './lib/klog';
import {
  computeAlignShift,
  defaultLevel,
  makeId,
  type AlignMode,
  type LoadedProfile,
  type ParsedFile,
} from './lib/profiles';
import { colorFor } from './lib/palette';
import { useI18n } from './i18n/context';
import type { Lang } from './i18n/context';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
      {children}
    </section>
  );
}

export default function App() {
  const { t, lang, setLang } = useI18n();
  const [profiles, setProfiles] = useState<LoadedProfile[]>([]);
  // F3: 個別 Level が基本。「Sync all」ON のときだけ全プロファイルがこの1値を共有する。
  const [syncAll, setSyncAll] = useState(false);
  const [syncLevel, setSyncLevel] = useState(3.0);
  // F5: Dry end 判定温度。最初に読み込んだ .klog の expect_colrchange(非0なら)を既定値にする。
  const [dryEndTemp, setDryEndTemp] = useState(DEFAULT_DRY_END_TEMP);
  // F6: 温度基準アラインメント。
  const [alignMode, setAlignMode] = useState<AlignMode>('time');
  const [alignTemp, setAlignTemp] = useState(200.0);
  const [alignRefCol, setAlignRefCol] = useState<AlignRefCol>('meanTemp');

  function addProfiles(files: ParsedFile[]) {
    const hadKlog = profiles.some((p) => p.kind === 'klog');
    if (!hadKlog) {
      const firstKlog = files.find((f) => f.kind === 'klog');
      if (firstKlog && firstKlog.kind === 'klog') {
        setDryEndTemp(defaultDryEndTemp(firstKlog.klog));
        setAlignTemp(defaultAlignTemp(firstKlog.klog));
      }
    }
    setProfiles((prev) => {
      const next = [...prev];
      for (const f of files) {
        next.push({
          id: makeId(),
          color: colorFor(next.length),
          visible: true,
          kind: f.kind,
          profile: f.kind === 'kpro' ? f.kpro : f.klog.design,
          log: f.kind === 'klog' ? f.klog : undefined,
          level: defaultLevel(f),
        });
      }
      return next;
    });
  }

  function toggle(id: string) {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, visible: !p.visible } : p)));
  }

  function remove(id: string) {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  }

  function setLevel(id: string, value: number) {
    if (syncAll) {
      setSyncLevel(value);
    } else {
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, level: value } : p)));
    }
  }

  const levels: Record<string, number> = {};
  for (const p of profiles) levels[p.id] = syncAll ? syncLevel : p.level;

  const shifts: Record<string, ReturnType<typeof computeAlignShift>> = {};
  for (const p of profiles) shifts[p.id] = computeAlignShift(p, alignMode, alignTemp, alignRefCol);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">
              {t.appName} <span className="text-sm font-normal text-zinc-500">{t.appTagline}</span>
            </h1>
            <p className="mt-1 text-sm text-zinc-500">{t.appPrivacy}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-sm">
            {(['en', 'ja'] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded px-2 py-1 ${
                  lang === l ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {l === 'en' ? t.langToggleEn : t.langToggleJa}
              </button>
            ))}
          </div>
        </header>

        <FileDrop onLoad={addProfiles} />

        {profiles.length > 0 && (
          <>
            <Section title={t.loadedSection}>
              <ul className="flex flex-wrap gap-2">
                {profiles.map((p) => (
                  <li
                    key={p.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                      p.visible ? 'border-zinc-700 bg-zinc-800/60' : 'border-zinc-800 opacity-50'
                    }`}
                  >
                    <button
                      onClick={() => toggle(p.id)}
                      className="flex items-center gap-2"
                      title={t.toggleVisibility}
                    >
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ background: p.color }}
                      />
                      {p.profile.name}
                      {p.log?.aborted && (
                        <span
                          className="text-amber-400"
                          title={t.abortedTitle(p.log.endReason, p.log.roastEnd.toFixed(1))}
                        >
                          ⚠
                        </span>
                      )}
                      {alignMode !== 'time' && shifts[p.id] && !shifts[p.id].reached && (
                        <span
                          className="text-xs text-amber-400"
                          title={alignMode === 'temp' ? t.didNotReachTemp(alignTemp) : t.noFirstCrackRecorded}
                        >
                          {alignMode === 'temp' ? t.didNotReachTemp(alignTemp) : t.noFC}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="text-zinc-500 hover:text-red-400"
                      title={t.remove}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </Section>

            {profiles.some((p) => p.kind === 'klog') && (
              <Section title={t.sectionAlignBy}>
                <AlignPanel
                  alignMode={alignMode}
                  onAlignModeChange={setAlignMode}
                  alignTemp={alignTemp}
                  onAlignTempChange={setAlignTemp}
                  alignRefCol={alignRefCol}
                  onAlignRefColChange={setAlignRefCol}
                />
              </Section>
            )}

            <Section title={t.sectionRoastCurve}>
              <RoastChart
                profiles={profiles}
                levels={levels}
                dryEndTemp={dryEndTemp}
                shifts={shifts}
                alignMode={alignMode}
              />
            </Section>

            {profiles.some((p) => p.kind === 'klog') && (
              <Section title={t.sectionDeviation}>
                <DeviationPanel
                  profiles={profiles.filter((p) => p.visible)}
                  shifts={shifts}
                  alignMode={alignMode}
                />
              </Section>
            )}

            <Section title={t.sectionEndTemp}>
              <LevelPanel
                profiles={profiles.filter((p) => p.visible)}
                levels={levels}
                onLevelChange={setLevel}
                syncAll={syncAll}
                onSyncAllChange={setSyncAll}
              />
            </Section>

            {profiles.some((p) => p.kind === 'klog') && (
              <Section title={t.sectionPhases}>
                <PhasesPanel
                  profiles={profiles.filter((p) => p.visible)}
                  dryEndTemp={dryEndTemp}
                  onDryEndTempChange={setDryEndTemp}
                  alignMode={alignMode}
                  alignTemp={alignTemp}
                  shifts={shifts}
                />
              </Section>
            )}

            {profiles.some((p) => p.kind === 'klog') && (
              <Section title={t.sectionSummary}>
                <SummaryPanel profiles={profiles.filter((p) => p.visible)} dryEndTemp={dryEndTemp} />
              </Section>
            )}

            <Section title={t.sectionScalarDiff}>
              <DiffTable profiles={profiles.filter((p) => p.visible)} />
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
