import { useRef, useState } from 'react';
import { parseKpro, type KproProfile } from '../lib/kpro';

interface Props {
  onLoad: (profiles: KproProfile[]) => void;
}

export default function FileDrop({ onLoad }: Props) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const parsed: KproProfile[] = [];
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.kpro')) continue;
      const text = await file.text();
      parsed.push(parseKpro(text, file.name));
    }
    if (parsed.length) onLoad(parsed);
  }

  return (
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
        accept=".kpro"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <p className="text-zinc-300">
        .kpro をここにドラッグ&ドロップ、またはクリックして選択(複数可)
      </p>
    </div>
  );
}
