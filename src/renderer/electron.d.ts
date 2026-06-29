declare module '*.css';

export interface IElectronAPI {
  getCursorPosition: () => Promise<{x: number, y: number}>;
  captureCursorWithHotkey: () => Promise<{x: number, y: number}>;
  sendSerial: (cmd: string) => void;
  saveConfig: (config: any) => void;
  startBot: () => void;
  onPrinterUpdate: (callback: (data: any) => void) => void;
  onInitConfigs: (callback: (config: any, i18n: any) => void) => void;
  requestConfig: () => void; 
  quitApp: () => void;
  saveBotSequence: (deviceId: string, sequences: any, mode: string, targetCount?: number, targetTimeHours?: number, customStartSeq?: number) => void;
  testBotSequence: (sequence: any[]) => void;
  changeLanguage: (lang: string) => void;
  send: (channel: string, data: any) => void;
  getFilaments: () => Promise<any[]>;
  addFilament: (filament: any) => Promise<any>;
  updateFilament: (id: string, updates: any) => Promise<any>;
  deleteFilament: (id: string) => Promise<boolean>;
  importPdf: () => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}