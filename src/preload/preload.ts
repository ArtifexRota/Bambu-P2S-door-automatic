import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  captureCursorWithHotkey: () => ipcRenderer.invoke("capture-cursor-hotkey"),
  cancelCaptureCursor: () => ipcRenderer.send("cancel-capture-cursor"),
  changeLanguage: (lang: string) => ipcRenderer.send("change-language", lang),
  saveBotSequence: (deviceId: string, sequences: any, mode: string, targetCount?: number, targetTimeHours?: number, customStartSeq?: number) => ipcRenderer.send('save-bot-sequence', { deviceId, sequences, mode, targetCount, targetTimeHours, customStartSeq }),
  testBotSequence: (sequence: any) => ipcRenderer.send('test-bot-sequence', sequence),
  quitApp: () => ipcRenderer.send('quit-app'),
  getCursorPosition: () => ipcRenderer.invoke('get-cursor-position'),
  sendSerial: (deviceId: string, cmd: string) => ipcRenderer.send("serial-command", { deviceId, cmd }),
  saveConfig: (config: any) => ipcRenderer.send("save-config", config),
  startBot: (deviceId: string) => ipcRenderer.send('start-bot', deviceId),
  requestConfig: () => ipcRenderer.send('get-initial-config'),
  onPrinterUpdate: (callback: (data: any) => void) =>
    ipcRenderer.on("printer-data", (_event, value) => callback(value)),
  onAppError: (callback: (msg: string) => void) =>
    ipcRenderer.on("app-error", (_event, msg) => callback(msg)),
  onInitConfigs: (callback: (config: any, i18n: any) => void) =>
    ipcRenderer.on("init-app", (_event, config, i18n) =>
      callback(config, i18n),
    ),
  
  // Filament DB
  getFilaments: () => ipcRenderer.invoke('get-filaments'),
  addFilament: (filament: any) => ipcRenderer.invoke('add-filament', filament),
  updateFilament: (id: string, updates: any) => ipcRenderer.invoke('update-filament', id, updates),
  deleteFilament: (id: string) => ipcRenderer.invoke('delete-filament', id),
  importPdf: () => ipcRenderer.invoke('import-pdf')
});
