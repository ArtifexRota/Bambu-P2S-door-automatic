import { useState, useEffect, useCallback } from 'react';

// Wir nutzen die Typisierung aus electron.d.ts, aber hier einfach 'any' für Flexibilität
// oder definieren ein Interface für Translations, wenn wir strikter sein wollen.

export const useTranslation = () => {
  const [translations, setTranslations] = useState<any>({});

  useEffect(() => {
    // 1. Initial Config + Translations laden
    if (window.electronAPI && window.electronAPI.onInitConfigs) {
      window.electronAPI.onInitConfigs((_config: any, i18n: any) => {
        console.log("i18n geladen:", i18n);
        setTranslations(i18n);
      });
      // Trigger den Request, falls die Komponente später mountet
      window.electronAPI.requestConfig();
    }
  }, []);

  // Die t-Funktion: t('monitor.printer') -> "Drucker"
  const t = useCallback((key: string): string => {
    if (!translations) return key;

    const keys = key.split('.');
    let result = translations;

    for (const k of keys) {
      if (result && result[k] !== undefined) {
        result = result[k];
      } else {
        return key; // Fallback: Key zurückgeben, wenn nicht gefunden
      }
    }

    return typeof result === 'string' ? result : key;
  }, [translations]);

  return { t, translations };
};
