import { useState, useCallback, useEffect } from 'react';
import { Language } from '../types';
import { translations } from '../translations';

export function useI18n(initialLanguage: Language = 'hu') {
  const [lang, setLang] = useState<Language>(initialLanguage);

  const t = useCallback((path: string) => {
    const keys = path.split('.');
    let current = translations[lang] || translations['hu'];
    
    for (const key of keys) {
      if (current[key] === undefined) {
        // Fallback to Hungarian
        let fallback = translations['hu'];
        for (const fKey of keys) {
          if (fallback[fKey] === undefined) return path;
          fallback = fallback[fKey];
        }
        return fallback;
      }
      current = current[key];
    }
    return current;
  }, [lang]);

  return { t, lang, setLang };
}
