import { createContext, useContext, useState, type ReactNode } from 'react';
import { en, type Dict } from './en';
import { ja } from './ja';

export type Lang = 'en' | 'ja';

const DICTS: Record<Lang, Dict> = { en, ja };
const STORAGE_KEY = 'overlay-lang';

interface I18nValue {
  lang: Lang;
  t: Dict;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

function loadInitialLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'ja' ? 'ja' : 'en'; // 既定は英語(F9)
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadInitialLang);

  function setLang(next: Lang) {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next); // 設定であってデータではないので保存してよい(§9)
  }

  return <I18nContext.Provider value={{ lang, t: DICTS[lang], setLang }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
