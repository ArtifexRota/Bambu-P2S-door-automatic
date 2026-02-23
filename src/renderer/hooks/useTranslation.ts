import { useState, useEffect, useCallback } from 'react';

export const useTranslation = () => {
  const [translations, setTranslations] = useState<any>({});

  useEffect(() => {
    // 1. Initial Config + Translations laden
    if (window.electronAPI && window.electronAPI.onInitConfigs) {
      // FIX: Wir nehmen 'data' als einziges Argument an und entpacken es
      window.electronAPI.onInitConfigs((data: any) => {
        console.log("i18n geladen:", data?.i18n);
        
        if (data && data.i18n) {
          setTranslations(data.i18n);
        }
      });
      // Trigger den Request, falls die Komponente später mountet
      window.electronAPI.requestConfig();
    }
  }, []);

  // Die t-Funktion: t('monitor.printer') -> "Drucker"
  const t = useCallback((key: string): string => {
    // Wenn noch keine Übersetzungen da sind, Key zurückgeben
    if (!translations || Object.keys(translations).length === 0) return key;

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