import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  sendSerial: (cmd: string) => ipcRenderer.send("serial-command", cmd),
  saveConfig: (config: any) => ipcRenderer.send("save-config", config),
  startBot: (data: any) => ipcRenderer.send("start-bot", data),
  onPrinterUpdate: (callback: (data: any) => void) =>
    ipcRenderer.on("printer-data", (_event, value) => callback(value)),
  onInitConfigs: (callback: (config: any, i18n: any) => void) =>
    ipcRenderer.on("init-app", (_event, config, i18n) =>
      callback(config, i18n),
    ),
});
