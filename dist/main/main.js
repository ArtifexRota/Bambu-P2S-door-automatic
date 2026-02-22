"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const mqtt = require("mqtt");
const serialport = require("serialport");
const require$$0 = require("stream");
const child_process = require("child_process");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const mqtt__namespace = /* @__PURE__ */ _interopNamespaceDefault(mqtt);
var dist$1 = {};
var dist = {};
var hasRequiredDist$1;
function requireDist$1() {
  if (hasRequiredDist$1) return dist;
  hasRequiredDist$1 = 1;
  Object.defineProperty(dist, "__esModule", { value: true });
  dist.DelimiterParser = void 0;
  const stream_1 = require$$0;
  class DelimiterParser extends stream_1.Transform {
    includeDelimiter;
    delimiter;
    buffer;
    constructor({ delimiter, includeDelimiter = false, ...options }) {
      super(options);
      if (delimiter === void 0) {
        throw new TypeError('"delimiter" is not a bufferable object');
      }
      if (delimiter.length === 0) {
        throw new TypeError('"delimiter" has a 0 or undefined length');
      }
      this.includeDelimiter = includeDelimiter;
      this.delimiter = Buffer.from(delimiter);
      this.buffer = Buffer.alloc(0);
    }
    _transform(chunk, encoding, cb) {
      let data = Buffer.concat([this.buffer, chunk]);
      let position;
      while ((position = data.indexOf(this.delimiter)) !== -1) {
        this.push(data.slice(0, position + (this.includeDelimiter ? this.delimiter.length : 0)));
        data = data.slice(position + this.delimiter.length);
      }
      this.buffer = data;
      cb();
    }
    _flush(cb) {
      this.push(this.buffer);
      this.buffer = Buffer.alloc(0);
      cb();
    }
  }
  dist.DelimiterParser = DelimiterParser;
  return dist;
}
var hasRequiredDist;
function requireDist() {
  if (hasRequiredDist) return dist$1;
  hasRequiredDist = 1;
  Object.defineProperty(dist$1, "__esModule", { value: true });
  dist$1.ReadlineParser = void 0;
  const parser_delimiter_1 = requireDist$1();
  class ReadlineParser extends parser_delimiter_1.DelimiterParser {
    constructor(options) {
      const opts = {
        delimiter: Buffer.from("\n", "utf8"),
        encoding: "utf8",
        ...options
      };
      if (typeof opts.delimiter === "string") {
        opts.delimiter = Buffer.from(opts.delimiter, opts.encoding);
      }
      super(opts);
    }
  }
  dist$1.ReadlineParser = ReadlineParser;
  return dist$1;
}
var distExports = requireDist();
let mainWindow = null;
let port = null;
let parser = null;
let currentTranslations = {};
const configPath = path__namespace.join(electron.app.getAppPath(), "config.json");
let config = JSON.parse(fs__namespace.readFileSync(configPath, "utf-8"));
const lang = config.language || "de";
const localesPath = path__namespace.join(electron.app.getAppPath(), "locales", `${lang}.json`);
const translations = JSON.parse(fs__namespace.readFileSync(localesPath, "utf-8"));
let printerData = {
  currentTemp: 0,
  targetTemp: 0,
  percent: 0,
  status: "Offline",
  bambiState: "Unbekannt",
  isWaitingToClose: false,
  isDoorOpen: false,
  printedParts: 0
};
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path__namespace.join(__dirname, "../preload/preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  const indexPath = path__namespace.join(__dirname, "../renderer/index.html");
  if (fs__namespace.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    mainWindow.loadURL("http://localhost:3000");
  }
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow?.webContents.send("init-app", {
      config,
      i18n: translations
    });
  });
}
electron.app.whenReady().then(() => {
  createWindow();
  connectSerial();
  connectMQTT();
});
electron.ipcMain.on("get-initial-config", (event) => {
  if (mainWindow) {
    mainWindow.webContents.send("init-app", {
      config,
      i18n: currentTranslations
    });
  }
});
electron.ipcMain.handle("get-cursor-position", () => {
  const point = electron.screen.getCursorScreenPoint();
  return point;
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
function connectSerial() {
  try {
    port = new serialport.SerialPort({
      path: config.serial.port,
      baudRate: config.serial.baudRate,
      autoOpen: false
    });
    port.open((err) => {
      if (err) {
        console.log(`[Serial] Port ${config.serial.port} nicht gefunden.`);
      } else {
        console.log(`[Serial] Verbunden mit ${config.serial.port}`);
      }
    });
    parser = port.pipe(new distExports.ReadlineParser({ delimiter: "\r\n" }));
    parser.on("data", (data) => {
      try {
        const json = JSON.parse(data);
        if (json.bambi === "moving") {
          printerData.bambiState = json.target === "open" ? "ÖFFNET..." : "SCHLIEẞT...";
        }
        if (json.status === "detached_soft") {
          printerData.bambiState = printerData.bambiState === "ÖFFNET..." ? "OFFEN" : "GESCHLOSSEN";
        }
        updateDashboard();
      } catch (e) {
        console.log("[Serial Data Error]");
      }
    });
  } catch (error) {
    console.error("SerialPort Fehler:", error.message);
  }
}
function sendToBambi(command) {
  if (port && port.isOpen) {
    port.write(command + "\n");
  }
}
let client;
function connectMQTT() {
  client = mqtt__namespace.connect(`mqtts://${config.printer.ip}:8883`, {
    username: "bblp",
    password: config.printer.accessCode,
    rejectUnauthorized: false
  });
  client.on("connect", () => {
    printerData.status = "Verbunden";
    client.subscribe(`device/${config.printer.serial}/report`);
    client.publish(
      `device/${config.printer.serial}/request`,
      JSON.stringify({ pushing: { sequenceId: "1", command: "pushing" } })
    );
    updateDashboard();
  });
  client.on("message", (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data && data.print) {
        const p = data.print;
        if (p.bed_temper !== void 0) printerData.currentTemp = Math.round(p.bed_temper);
        if (p.bed_target_temper !== void 0) printerData.targetTemp = Math.round(p.bed_target_temper);
        if (p.mc_percent !== void 0) printerData.percent = p.mc_percent;
        if (p.gcode_state) printerData.status = p.gcode_state;
        const profiles = config.materials?.profiles || [];
        const activeProfileId = config.materials?.activeProfileId;
        const activeProfile = profiles.find((p2) => p2.id === activeProfileId);
        if (!activeProfile && printerData.status === "RUNNING") {
          if (!printerData.isDoorOpen) {
            console.log("[Auto] ⚠️ WARNUNG: Kein Material-Profil ausgewählt! Tür-Automatik ist deaktiviert.");
            printerData.isDoorOpen = true;
          }
        } else if (activeProfile) {
          const currentTargetOpenTemp = activeProfile.openTemp;
          const isNearEnd = printerData.percent > 80;
          const isSafeTemp = printerData.currentTemp <= currentTargetOpenTemp;
          if (isSafeTemp && isNearEnd && !printerData.isDoorOpen) {
            console.log(`[Auto] 80% erreicht & Temperatur OK (${printerData.currentTemp}°C <= ${currentTargetOpenTemp}°C | Profil: ${activeProfile.name}) -> Öffne Tür!`);
            sendToBambi("OPEN");
            printerData.isDoorOpen = true;
          }
        }
        if ((printerData.status === "FINISH" || printerData.status === "COMPLETED") && !printerData.isWaitingToClose) {
          printerData.isWaitingToClose = true;
          setTimeout(() => {
            sendToBambi("CLOSE");
            printerData.isWaitingToClose = false;
            printerData.isDoorOpen = false;
            setTimeout(() => {
              if (printerData.status === "FINISH" || printerData.status === "IDLE") {
                startNewSpool();
              }
            }, 6e4);
          }, config.bot.closeDelayMs || 2e4);
        }
      }
      updateDashboard();
    } catch (e) {
    }
  });
}
function clickAt(x, y) {
  const clickCmd = `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x},${y}); $type = Add-Type -name nativeMethods -namespace Win32 -PassThru -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern void mouse_event(int d, int x, int y, int c, int e);'; $type::mouse_event(2, 0, 0, 0, 0); $type::mouse_event(4, 0, 0, 0, 0);"`;
  child_process.exec(clickCmd);
}
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
async function startNewSpool() {
  const sequence = config.bot.sequence;
  if (!sequence || sequence.length === 0) {
    console.log("[Bot] Keine Klick-Sequenz gespeichert. Bot bricht ab.");
    return;
  }
  console.log(`[Bot] Starte Klick-Sequenz mit ${sequence.length} Schritten...`);
  for (const step of sequence) {
    console.log(`[Bot] Führe aus: ${step.name} (X: ${step.x}, Y: ${step.y}) - Warte ${step.delaySeconds}s...`);
    clickAt(step.x, step.y);
    await delay(step.delaySeconds * 1e3);
  }
  console.log("[Bot] Sequenz abgeschlossen.");
  printerData.printedParts++;
  updateDashboard();
}
function updateDashboard() {
  if (mainWindow) {
    mainWindow.webContents.send("printer-data", printerData);
  }
}
electron.ipcMain.on("serial-command", (_event, cmd) => {
  sendToBambi(cmd);
});
electron.ipcMain.on("save-config", (event, newConfig) => {
  try {
    config = newConfig;
    fs__namespace.writeFileSync(configPath, JSON.stringify(config, null, 2));
    sendToBambi(`SAVE:${config.servo.open}:${config.servo.close}`);
    console.log("[Settings] Config erfolgreich aktualisiert!");
  } catch (error) {
    console.error("[Settings] Fehler beim Speichern:", error);
  }
});
electron.ipcMain.on("save-bot-sequence", (event, sequence) => {
  try {
    config.bot.sequence = sequence;
    fs__namespace.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("[Bot] Erfolgreich in config.json gespeichert:", sequence.length, "Klicks");
  } catch (error) {
    console.error("[Bot] Fehler beim Speichern der config.json:", error);
  }
});
electron.ipcMain.on("quit-app", () => {
  electron.app.quit();
});
electron.ipcMain.on("start-bot", () => {
  startNewSpool();
});
