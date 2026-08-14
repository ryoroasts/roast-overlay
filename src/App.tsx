import { useState } from 'react';
import FileDrop from './components/FileDrop';
import RoastChart from './components/RoastChart';
import DiffTable from './components/DiffTable';
import LevelPanel from './components/LevelPanel';
import { defaultLevel, makeId, type LoadedProfile, type ParsedFile } from './lib/profiles';
import { colorFor } from './lib/palette';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
      {children}
    </section>
  );
}

export default function App() {
  const [profiles, setProfiles] = useState<LoadedProfile[]>([]);
  // F3: 個別 Level が基本。「Sync all」ON のときだけ全プロファイルがこの1値を共有する。
  const [syncAll, setSyncAll] = useState(false);
  const [syncLevel, setSyncLevel] = useState(3.0);

  function addProfiles(files: ParsedFile[]) {
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <header>
          <h1 className="text-xl font-bold">
            kpro-diff <span className="text-sm font-normal text-zinc-500">Kaffelogic プロファイル比較</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            複数の .kpro を重ね描きして差分を見る。ファイルはブラウザ内で処理され、どこにも送信されません。
          </p>
        </header>

        <FileDrop onLoad={addProfiles} />

        {profiles.length > 0 && (
          <>
            <Section title="読み込み済みプロファイル">
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
                      title="表示/非表示"
                    >
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ background: p.color }}
                      />
                      {p.profile.name}
                      {p.log?.aborted && (
                        <span
                          className="text-amber-400"
                          title={`中断ログ: reason=${p.log.endReason} / roast_end=${p.log.roastEnd.toFixed(1)}s で終了`}
                        >
                          ⚠
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="text-zinc-500 hover:text-red-400"
                      title="削除"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Roast カーブ(温度 × 時間)">
              <RoastChart profiles={profiles} levels={levels} />
            </Section>

            <Section title="終了温度(Level → roast_levels 補間)">
              <LevelPanel
                profiles={profiles.filter((p) => p.visible)}
                levels={levels}
                onLevelChange={setLevel}
                syncAll={syncAll}
                onSyncAllChange={setSyncAll}
              />
            </Section>

            <Section title="スカラー差分(基準=左端)">
              <DiffTable profiles={profiles.filter((p) => p.visible)} />
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
