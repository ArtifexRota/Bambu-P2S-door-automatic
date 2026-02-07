export interface IElectronAPI {
  sendSerial: (cmd: string) => void;
  saveConfig: (config: any) => void;
  startBot: (data: any) => void;
  onPrinterUpdate: (callback: (data: any) => void) => void;
  onInitConfigs: (callback: (config: any, i18n: any) => void) => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
