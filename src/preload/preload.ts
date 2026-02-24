import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  captureCursorWithHotkey: () => ipcRenderer.invoke("capture-cursor-hotkey"),
  changeLanguage: (lang: string) => ipcRenderer.send("change-language", lang),
  saveBotSequence: (sequence: any) => ipcRenderer.send('save-bot-sequence', sequence),
  quitApp: () => ipcRenderer.send('quit-app'),
  getCursorPosition: () => ipcRenderer.invoke('get-cursor-position'),
  sendSerial: (cmd: string) => ipcRenderer.send("serial-command", cmd),
  saveConfig: (config: any) => ipcRenderer.send("save-config", config),
startBot: () => ipcRenderer.send('start-bot'),
  requestConfig: () => ipcRenderer.send('get-initial-config'),
  onPrinterUpdate: (callback: (data: any) => void) =>
    ipcRenderer.on("printer-data", (_event, value) => callback(value)),
  onInitConfigs: (callback: (config: any, i18n: any) => void) =>
    ipcRenderer.on("init-app", (_event, config, i18n) =>
      callback(config, i18n),
    ),
});
