"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  sendSerial: (cmd) => electron.ipcRenderer.send("serial-command", cmd),
  saveConfig: (config) => electron.ipcRenderer.send("save-config", config),
  startBot: (data) => electron.ipcRenderer.send("start-bot", data),
  requestConfig: () => electron.ipcRenderer.send("get-initial-config"),
  onPrinterUpdate: (callback) => electron.ipcRenderer.on("printer-data", (_event, value) => callback(value)),
  onInitConfigs: (callback) => electron.ipcRenderer.on(
    "init-app",
    (_event, config, i18n) => callback(config, i18n)
  )
});
