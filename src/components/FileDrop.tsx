import { useRef, useState } from 'react';
import { parseKpro } from '../lib/kpro';
import { parseKlog } from '../lib/klog';
import type { ParsedFile } from '../lib/profiles';
import { useI18n } from '../i18n/context';

/**
 * public/ に置いた匿名化済みサンプル(機体シリアル等は伏せてある。SPEC §2.7)。
 * overshoot = README のスクリーンショットと同じ焙煎(+12.06℃ @ 1:12)。
 * align = 1ハゼの手押しで数字がどれだけ動くかを見せる2本(片方だけ動く)。
 */
const EXAMPLE_OVERSHOOT = ['example-overshoot.klog'];
const EXAMPLE_ALIGN = ['example-align-a.klog', 'example-align-b.klog'];

interface Props {
  onLoad: (files: ParsedFile[]) => void;
  /** 何も読み込んでいないときだけ「例を読み込む」を出す */
  showExample?: boolean;
}

export default function FileDrop({ onLoad, showExample = false }: Props) {
  const { t } = useI18n();
  const [over, setOver] = useState(false);
  const [exampleFailed, setExampleFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadExample(files: string[]) {
    setExampleFailed(false);
    try {
      // base: './' なので、ページからの相対で引ける(Pages のサブパス配下でも同じ)
      const parsed: ParsedFile[] = [];
      for (const name of files) {
        const res = await fetch(`./${name}`);
        if (!res.ok) throw new Error(String(res.status));
        parsed.push({ kind: 'klog', klog: parseKlog(await res.text(), name) });
      }
      onLoad(parsed);
    } catch {
      setExampleFailed(true);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const parsed: ParsedFile[] = [];
    for (const file of Array.from(files)) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.kpro')) {
        const text = await file.text();
        parsed.push({ kind: 'kpro', kpro: parseKpro(text, file.name) });
      } else if (lower.endsWith('.klog')) {
        const text = await file.text();
        parsed.push({ kind: 'klog', klog: parseKlog(text, file.name) });
      }
    }
    if (parsed.length) onLoad(parsed);
  }

  return (
    <>
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
        over ? 'border-amber-400 bg-amber-400/10' : 'border-zinc-600 hover:border-zinc-500'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".kpro,.klog"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <p className="text-zinc-300">{t.dropzone}</p>
    </div>

    {showExample && (
      <div className="mt-2 text-center text-sm">
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => void loadExample(EXAMPLE_OVERSHOOT)}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
          >
            {t.exampleOvershoot}
          </button>
          <button
            onClick={() => void loadExample(EXAMPLE_ALIGN)}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
          >
            {t.exampleAlign}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">
          {exampleFailed ? t.exampleError : t.exampleHint}
        </p>
      </div>
    )}
    </>
  );
}
