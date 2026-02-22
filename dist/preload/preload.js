"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  saveBotSequence: (sequence) => electron.ipcRenderer.send("save-bot-sequence", sequence),
  quitApp: () => electron.ipcRenderer.send("quit-app"),
  getCursorPosition: () => electron.ipcRenderer.invoke("get-cursor-position"),
  sendSerial: (cmd) => electron.ipcRenderer.send("serial-command", cmd),
  saveConfig: (config) => electron.ipcRenderer.send("save-config", config),
  startBot: () => electron.ipcRenderer.send("start-bot"),
  requestConfig: () => electron.ipcRenderer.send("get-initial-config"),
  onPrinterUpdate: (callback) => electron.ipcRenderer.on("printer-data", (_event, value) => callback(value)),
  onInitConfigs: (callback) => electron.ipcRenderer.on(
    "init-app",
    (_event, config, i18n) => callback(config, i18n)
  )
});
