export interface IElectronAPI {
  onInitConfigs: (callback: (data: any) => void) => void;
  requestConfig: () => void;
  saveConfig: (config: any) => void;
  saveBotSequence: (deviceId: string, sequences: any[], mode: string, targetCount?: number, targetTimeHours?: number, customStartSeq?: number) => void;
  startBot: (deviceId: string) => void;
  testBotSequence: (sequence: any[]) => void;
  sendSerial: (deviceId: string, cmd: string) => void;
  getCursorPosition: () => Promise<{ x: number, y: number }>;
  quitApp: () => void;
  send: (channel: string, data: any) => void;
  on: (channel: string, func: (...args: any[]) => void) => void;
  onPrinterUpdate: (callback: (data: any) => void) => void;
  onAppUpdate: (callback: (data: any) => void) => void;
  onBotUpdate: (callback: (data: any) => void) => void;
  changeLanguage: (lang: string) => void;
  captureCursorWithHotkey: () => Promise<{ x: number; y: number } | null>;
  cancelCaptureCursor: () => void;
  onAppError: (callback: (msg: string) => void) => void;
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
