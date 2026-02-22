export interface IElectronAPI {
  getCursorPosition: () => Promise<{x: number, y: number}>;
  sendSerial: (cmd: string) => void;
  saveConfig: (config: any) => void;
startBot: () => void;
  onPrinterUpdate: (callback: (data: any) => void) => void;
  onInitConfigs: (callback: (config: any, i18n: any) => void) => void;
requestConfig: () => void;
quitApp: () => void;
saveBotSequence: (sequence: any) => void;
}


declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
