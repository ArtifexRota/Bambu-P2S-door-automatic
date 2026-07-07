import { app, BrowserWindow, ipcMain, screen, globalShortcut, Notification } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as mqtt from "mqtt";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { exec } from "child_process";
import { initFilamentDb, getFilaments, addFilament, updateFilament, deleteFilament } from "./filamentDb";

app.name = "Bambi Automatic Control";
if (process.platform === 'win32') {
  app.setAppUserModelId("Bambi Automatic Control");
}

// --- INTERFACES ---
interface MaterialProfile {
  id: string;
  name: string;
  openTemp: number;
}

interface ClickTask {
  id: string;
  name: string;
  x: number;
  y: number;
  delaySeconds: number;
}

interface DeviceConfig {
  id: string;
  name: string;
  activeProfileId?: string;
  printer: { ip: string; accessCode: string; serial: string; };
  serial: { port: string; baudRate: number };
  servo: { open: number; close: number };
  bot: {
    closeDelayMs: number;
    mode: "loop" | "stop" | "target_count" | "target_time";
    currentSequenceIndex: number;
    sequences: ClickTask[][];
    autoMode?: boolean;
    targetCount?: number;
    targetTimeHours?: number;
    customStartSeq?: number;
  };
}

interface Config {
  devices: DeviceConfig[];
  materials: {
    activeProfileId: string;
    profiles: MaterialProfile[];
  };
  language: string;
  eulaAccepted: boolean;
}

interface AmsTray {
  id: string;
  tray_info_idx: string;
  tray_sub_brands: string;
  tray_color: string;
  tray_type: string;
  tray_weight?: string;
  remain?: number;
  filamentId?: string;
}

interface AmsData {
  trays: AmsTray[];
}

interface PrinterData {
  currentTemp: number;
  targetTemp: number;
  percent: number;
  status: string;
  bambiState: string;
  isWaitingToClose: boolean;
  isDoorOpen: boolean;
  printedParts: number;
  botStartTime?: number;
  botTakeoverTime?: number;
  amsData?: AmsData;
}

// --- LOGGING ---
const logPath = path.join(app.getPath("userData"), "error.log");

function logToFile(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(logPath, logMessage);
  } catch (err) {
    console.error("Logging failed:", err);
  }
}

// Initial Log
logToFile("App gestartet. Version: " + app.getVersion());

// --- GLOBALE VARIABLEN ---
let mainWindow: BrowserWindow | null = null;
const serialPorts: Record<string, SerialPort> = {};
const serialParsers: Record<string, ReadlineParser> = {};
const mqttClients: Record<string, mqtt.MqttClient> = {};
const printerDataMap: Record<string, PrinterData> = {};

const defaultDevice: DeviceConfig = {
  id: "1",
  name: "Drucker 1",
  printer: { ip: "192.168.X.X", accessCode: "", serial: "" },
  serial: { port: "COM3", baudRate: 115200 },
  servo: { open: 0, close: 175 },
  bot: {
    closeDelayMs: 10000,
    mode: "stop",
    currentSequenceIndex: 0,
    sequences: [[]]
  }
};

const defaultConfig: Config = {
  devices: [defaultDevice],
  materials: {
    activeProfileId: "1",
    profiles: [
      { id: "1", name: "PLA", openTemp: 45 },
      { id: "2", name: "ABS", openTemp: 80 },
      { id: "3", name: "ASA", openTemp: 90 }
    ]
  },
  language: "de",
  eulaAccepted: false
};

// --- KONFIGURATION LADEN & ERSTELLEN ---
const userDataPath = app.getPath("userData");
const configPath = path.join(userDataPath, "config.json");

// SCHRITT 1: Sicherstellen, dass der ORDNER existiert
if (!fs.existsSync(userDataPath)) {
  // { recursive: true } erstellt auch übergeordnete Ordner, falls nötig
  fs.mkdirSync(userDataPath, { recursive: true });
}

// Migration vom alten App-Namen "Bambi P2S Control" zu "Bambi Automatic Control"
const oldUserDataPath = path.join(app.getPath("appData"), "Bambi P2S Control");
const oldConfigPath = path.join(oldUserDataPath, "config.json");

if (!fs.existsSync(configPath) && fs.existsSync(oldConfigPath)) {
  fs.copyFileSync(oldConfigPath, configPath);
  console.log("Config aus altem Ordner migriert.");
}

let config: Config;

try {
  if (fs.existsSync(configPath)) {
    const rawData = fs.readFileSync(configPath, "utf-8");
    let loadedConfig = JSON.parse(rawData);
    
    if (!loadedConfig.devices) {
      logToFile("Migriere alte Config auf neues Multi-Printer-Format...");
      const migratedDevice: DeviceConfig = {
        id: "1",
        name: "Drucker 1",
        printer: loadedConfig.printer || defaultDevice.printer,
        serial: loadedConfig.serial || defaultDevice.serial,
        servo: loadedConfig.servo || defaultDevice.servo,
        bot: {
          closeDelayMs: loadedConfig.bot?.closeDelayMs || 20000,
          mode: "stop",
          currentSequenceIndex: 0,
          sequences: [loadedConfig.bot?.sequence || []]
        }
      };
      config = {
        devices: [migratedDevice],
        materials: loadedConfig.materials || defaultConfig.materials,
        language: loadedConfig.language || defaultConfig.language,
        eulaAccepted: loadedConfig.eulaAccepted || false
      };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } else {
      config = loadedConfig as Config;
    }

    // MIGRATION: config.materials.activeProfileId -> device.activeProfileId
    if (config.materials && config.materials.activeProfileId) {
      logToFile(`[Migration] Verschiebe activeProfileId zu Devices...`);
      config.devices.forEach((device: any) => {
        if (!device.activeProfileId) {
          device.activeProfileId = config.materials.activeProfileId;
        }
      });
      delete config.materials.activeProfileId;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
    logToFile("Config geladen.");
  } else {
    logToFile("Erstelle neue config.json...");
    config = defaultConfig;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
} catch (error: any) {
  logToFile(`Config defekt, nutze Defaults: ${error.message}`);
  config = defaultConfig;
}

let currentTranslations: any = {};
// --- TRANSLATIONS LADEN (Robust) ---
const lang = config.language || "de";
// Fix: Use __dirname for relative path resolution within ASAR
const localesPath = app.isPackaged
  ? path.join(process.resourcesPath, 'locales', `${lang}.json`) // Often safer for external resources
  : path.join(app.getAppPath(), "locales", `${lang}.json`);

let translations: any = {};

try {
  logToFile(`[Main] Lade Übersetzungen von: ${localesPath}`);
  if (fs.existsSync(localesPath)) {
    translations = JSON.parse(fs.readFileSync(localesPath, "utf-8"));
    currentTranslations = translations;
    logToFile("[Main] Übersetzungen erfolgreich geladen.");
  } else {
    // Fallback: Try standard path if resourcesPath fails
    const fallbackPath = path.join(app.getAppPath(), "locales", `${lang}.json`);
    logToFile(`[Main] FEHLER: Übersetzungsdatei nicht gefunden! Versuche Fallback: ${fallbackPath}`);
    if (fs.existsSync(fallbackPath)) {
        translations = JSON.parse(fs.readFileSync(fallbackPath, "utf-8"));
        currentTranslations = translations;
        logToFile("[Main] Übersetzungen (Fallback) erfolgreich geladen.");
    } else {
        logToFile(`[Main] CRITICAL: Auch Fallback fehlgeschlagen.`);
    }
  }
} catch (error: any) {
  logToFile(`[Main] CRITICAL: Fehler beim Laden der Übersetzungen: ${error.message}`);
}

let printFinishedHandledMap: Record<string, boolean> = {};

config.devices.forEach(device => {
  printerDataMap[device.id] = {
    currentTemp: 0, targetTemp: 0, percent: 0, status: "Offline",
    bambiState: "Unbekannt", isWaitingToClose: false, isDoorOpen: false, printedParts: 0, botStartTime: undefined
  };
  printFinishedHandledMap[device.id] = false;
});

// --- ELECTRON WINDOW ---
function createWindow(): void {
  // Fix: Use __dirname based path for preload script
  const preloadPath = path.join(__dirname, "../preload/preload.js");
  logToFile(`[Main] Preload Pfad (__dirname basierend): ${preloadPath}`);

  if (!fs.existsSync(preloadPath)) {
      logToFile(`[Main] WARNUNG: Preload Script nicht gefunden!`);
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      // Nutzt den absoluten Pfad zur preload.js
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });


  if (app.isPackaged) {
    // In der Produktion: Pfad direkt ab __dirname (sicherer im ASAR)
    // Struktur: dist/main/main.js -> dist/renderer/index.html
    const indexPath = path.join(__dirname, "../renderer/index.html");
    logToFile(`[Main] Lade Index (Packaged): ${indexPath}`);
    
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath).catch(e => logToFile(`[Main] LoadFile Error: ${e.message}`));
    } else {
      logToFile(`[Main] CRITICAL: Index nicht gefunden an: ${indexPath}`);
    }
  } else {
    // Im Entwicklungsmodus
    logToFile("[Main] Lade Dev Server URL");
    mainWindow.loadURL("http://localhost:3000");
  }

  mainWindow.webContents.on("did-finish-load", () => {
    logToFile("[Main] Renderer fertig geladen. Sende init-app...");
    mainWindow?.webContents.send("init-app", {
      config: config,
      i18n: translations,
    });
  });

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    logToFile(`[Main] ERROR: Renderer failed to load: ${errorCode} - ${errorDescription}`);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    logToFile(`[Main] CRITICAL: Renderer Process CRASHED! Reason: ${details.reason}`);
  });
}

app.whenReady().then(() => {
  logToFile("[Main] App is Ready.");
  initFilamentDb();
  createWindow();
  config.devices.forEach(device => {
    connectSerial(device.id);
    connectMQTT(device.id);
  });
});

ipcMain.on('get-initial-config', (event) => {
  if (mainWindow) {
    mainWindow.webContents.send('init-app', { 
      config: config, 
      i18n: currentTranslations 
    });
  }
});

ipcMain.handle('get-cursor-position', () => {
  const point = screen.getCursorScreenPoint();
  return point; 
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// --- SERIELLE VERBINDUNG ---
function connectSerial(deviceId: string): void {
  const device = config.devices.find(d => d.id === deviceId);
  if (!device) return;

  const initPort = () => {
    if (!device.serial.port) {
      logToFile(`[Serial ${deviceId}] Kein COM-Port in der Konfiguration definiert.`);
      return;
    }
    try {
      const p = new SerialPort({
        path: device.serial.port,
        baudRate: device.serial.baudRate,
        autoOpen: false,
      });

      serialPorts[deviceId] = p;

      p.open((err) => {
        if (err) {
          logToFile(`[Serial ${deviceId}] Port ${device.serial.port} nicht gefunden oder Fehler: ${err.message}`);
          if (mainWindow) mainWindow.webContents.send("app-error", `Serial Error (${device.name}): ${err.message}`);
        } else {
          logToFile(`[Serial ${deviceId}] Verbunden mit ${device.serial.port}`);
          setTimeout(() => {
            sendToBambi(deviceId, `SAVE:${device.servo.open}:${device.servo.close}`);
            logToFile(`[Serial ${deviceId}] Initiale Settings an Arduino gesendet.`);
          }, 2500);
        }
      });

      const parser = p.pipe(new ReadlineParser({ delimiter: "\r\n" }));
      serialParsers[deviceId] = parser;

      parser.on("data", (data: string) => {
        try {
          const json = JSON.parse(data);
          const pData = printerDataMap[deviceId];
          if (json.bambi === "moving") {
            pData.bambiState = json.target === "open" ? "ÖFFNET..." : "SCHLIEẞT...";
          }
          if (json.status === "detached_soft") {
            pData.bambiState = pData.bambiState === "ÖFFNET..." ? "OFFEN" : "GESCHLOSSEN";
          }
          updateDashboard();
        } catch (e) {}
      });
    } catch (error: any) {
      logToFile(`[Serial ${deviceId}] Fehler: ${error.message}`);
    }
  };

  if (serialPorts[deviceId] && serialPorts[deviceId].isOpen) {
    serialPorts[deviceId].close(() => {
      initPort();
    });
  } else {
    initPort();
  }
}

function sendToBambi(deviceId: string, command: string): void {
  const p = serialPorts[deviceId];
  if (p && p.isOpen) {
    p.write(command + "\n");
  }
}

// --- MQTT VERBINDUNG ---
function connectMQTT(deviceId: string): void {
  const device = config.devices.find(d => d.id === deviceId);
  if (!device) return;

  if (mqttClients[deviceId]) {
    mqttClients[deviceId].end(true); 
    logToFile(`[MQTT ${deviceId}] Alte Verbindung getrennt.`);
  }

  if (!device.printer.ip || device.printer.ip.includes("X.X")) {
    logToFile(`[MQTT ${deviceId}] Keine gültige IP hinterlegt. Warte auf Benutzereingabe.`);
    return;
  }
  logToFile(`[MQTT ${deviceId}] Versuche Verbindung zu ${device.printer.ip}...`);
  const client = mqtt.connect(`mqtts://${device.printer.ip}:8883`, {
    username: "bblp",
    password: device.printer.accessCode,
    rejectUnauthorized: false,
  });
  
  mqttClients[deviceId] = client;

  client.on("connect", () => {
    logToFile(`[MQTT ${deviceId}] Verbunden!`);
    printerDataMap[deviceId].status = "Verbunden";
    client.subscribe(`device/${device.printer.serial}/report`);
    client.publish(
      `device/${device.printer.serial}/request`,
      JSON.stringify({ pushing: { sequenceId: "1", command: "pushing" } }),
    );
    updateDashboard();
  });

  client.on("error", (err) => {
    logToFile(`[MQTT ${deviceId}] Fehler: ${err.message}`);
    if (mainWindow) mainWindow.webContents.send("app-error", `MQTT Error (${device.name}): ${err.message}`);
  });

  client.on("message", (topic: string, message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      const pData = printerDataMap[deviceId];
      if (data && data.print) {
        const p = data.print;
        if (p.bed_temper !== undefined) pData.currentTemp = Math.round(p.bed_temper);
        if (p.bed_target_temper !== undefined) pData.targetTemp = Math.round(p.bed_target_temper);
        if (p.mc_percent !== undefined) pData.percent = p.mc_percent;
        if (p.gcode_state) pData.status = p.gcode_state;

        if (p.ams && p.ams.ams && p.ams.ams.length > 0) {
          let allTrays: any[] = [];
          p.ams.ams.forEach((amsUnit: any, amsIndex: number) => {
            if (amsUnit.tray) {
              const letter = String.fromCharCode(65 + amsIndex); // 0 -> A, 1 -> B, etc.
              allTrays = allTrays.concat(amsUnit.tray.map((t: any) => ({
                id: `${letter}${parseInt(t.id) + 1}`, // A1, A2... B1, B2...
                tray_info_idx: t.tray_info_idx,
                tray_sub_brands: t.tray_sub_brands,
                tray_color: t.tray_color,
                tray_type: t.tray_type,
                tray_weight: t.tray_weight,
                remain: t.remain,
                tag_uid: t.tag_uid || t.tray_uuid || ''
              })));
            }
          });
          pData.amsData = { trays: allTrays };

          // Auto-Sync Filament Inventory
          const localFilaments = getFilaments();
          
          allTrays.forEach(tray => {
            const linkedFilament = localFilaments.find(f => f.amsTrayId === tray.id);
            if (linkedFilament) {
              if (!tray.tray_type) {
                updateFilament(linkedFilament.id, { amsTrayId: undefined });
              } else if (tray.remain !== undefined) {
                let startW = linkedFilament.startWeight;
                if (tray.tray_weight && !isNaN(parseInt(tray.tray_weight, 10))) {
                  const parsedW = parseInt(tray.tray_weight, 10);
                  if (parsedW > 10) startW = parsedW;
                  else if (parsedW > 0) startW = parsedW * 1000;
                }
                if (tray.remain >= 0) {
                  const calcWeight = (tray.remain / 100) * startW;
                  if (Math.abs(linkedFilament.remainingWeight - calcWeight) > 1) {
                    updateFilament(linkedFilament.id, { remainingWeight: calcWeight });
                  }
                }
              }
            }
          });
        }

        if (pData.status === "RUNNING") {
            printFinishedHandledMap[deviceId] = false;
        }

        const currentDevice = config.devices.find(d => d.id === deviceId);
        const autoModeEnabled = currentDevice?.bot?.autoMode === true; // AutoMode PER DEVICE
        const profiles = config.materials?.profiles || [];
        const activeProfileId = currentDevice?.activeProfileId;
        const activeProfile = profiles.find((prof: any) => prof.id === activeProfileId);

        if (autoModeEnabled) {
            if (!activeProfile && pData.status === "RUNNING") {
                if (!pData.isDoorOpen) {
                    logToFile(`[Auto ${deviceId}] ⚠️ WARNUNG: Kein Material-Profil ausgewählt!`);
                    pData.isDoorOpen = true; 
                }
            } else if (activeProfile) {
                const currentTargetOpenTemp = activeProfile.openTemp;
                const isNearEnd = pData.percent > 80;        
                const isSafeTemp = pData.currentTemp <= currentTargetOpenTemp;

                if ( 
                    isSafeTemp &&              
                    isNearEnd &&               
                    !pData.isDoorOpen && 
                    !printFinishedHandledMap[deviceId]
                ) {
                    logToFile(`[Auto ${deviceId}] 80% erreicht & Temperatur OK -> Öffne Tür!`);
                    sendToBambi(deviceId, "OPEN");
                    pData.isDoorOpen = true; 
                }
            }
        }

        if (
          (pData.status === "FINISH" || pData.status === "COMPLETED") &&
          !printFinishedHandledMap[deviceId] && 
          autoModeEnabled          
        ) {
          printFinishedHandledMap[deviceId] = true; 
          pData.isWaitingToClose = true;
          
          const delayMs = device.bot.closeDelayMs || 10000;
          pData.botTakeoverTime = Date.now() + delayMs + 3000;
          
          setTimeout(() => {
            sendToBambi(deviceId, "CLOSE");
            pData.isWaitingToClose = false;
            pData.isDoorOpen = false; 
            
            setTimeout(() => {
              const latestDevice = config.devices.find(d => d.id === deviceId);
              if ((pData.status === "FINISH" || pData.status === "IDLE") && latestDevice?.bot?.autoMode === true) {
                startNewSpool(deviceId);
              } else {
                pData.botTakeoverTime = undefined;
                updateDashboard();
              }
            }, 3000);
          }, delayMs);
        }
      }
      updateDashboard();
    } catch (e) {}
  });
}

// --- BOT FUNKTIONEN ---
function clickAt(x: number | string, y: number | string): void {
  // 1. Finde heraus, auf welchem Monitor sich die Koordinaten befinden
  const display = screen.getDisplayNearestPoint({ x: Number(x), y: Number(y) });
  
  // 2. Lese den Windows-Zoomfaktor aus (z.B. 1.25 für 125%)
  const scale = display.scaleFactor; 

  // 3. Berechne die echten Hardware-Pixel für die PowerShell
  const realX = Math.round(Number(x) * scale);
  const realY = Math.round(Number(y) * scale);

  logToFile(`[Bot] Klicke auf logisch (${x},${y}) -> skaliert für Windows (${realX},${realY})`);

  // 4. Feuer den Befehl mit den skalierten Koordinaten ab
  const clickCmd = `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${realX},${realY}); $type = Add-Type -name nativeMethods -namespace Win32 -PassThru -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern void mouse_event(int d, int x, int y, int c, int e);'; $type::mouse_event(2, 0, 0, 0, 0); $type::mouse_event(4, 0, 0, 0, 0);"`;
  exec(clickCmd);
}

// Wartet eine bestimmte Anzahl an Millisekunden
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function startNewSpool(deviceId: string): Promise<void> {
  const device = config.devices.find(d => d.id === deviceId);
  if (!device) return;
  printerDataMap[deviceId].botTakeoverTime = undefined;
  updateDashboard();

  if (device.bot.mode === 'target_count') {
    if (printerDataMap[deviceId].printedParts >= (device.bot.targetCount || 0)) {
      logToFile(`[Bot ${deviceId}] Ziel-Menge erreicht (${device.bot.targetCount}). Stoppe Bot.`);
      device.bot.autoMode = false;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      updateDashboard();
      return;
    }
  } else if (device.bot.mode === 'target_time') {
    const startTime = printerDataMap[deviceId].botStartTime || Date.now();
    const targetMs = (device.bot.targetTimeHours || 0) * 3600000;
    if (Date.now() >= startTime + targetMs) {
      logToFile(`[Bot ${deviceId}] Ziel-Zeit erreicht. Stoppe Bot.`);
      device.bot.autoMode = false;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      updateDashboard();
      return;
    }
  }

  const sequences = device.bot.sequences || [];
  if (sequences.length === 0) {
      logToFile(`[Bot ${deviceId}] Keine Klick-Sequenzen gespeichert.`);
      return;
  }

  const seqIndex = device.bot.currentSequenceIndex || 0;
  if (seqIndex >= sequences.length) {
    logToFile(`[Bot ${deviceId}] Alle Sequenzen abgeschlossen.`);
    return;
  }

  const sequence = sequences[seqIndex];
  logToFile(`[Bot ${deviceId}] Starte Sequenz ${seqIndex + 1}/${sequences.length} mit ${sequence.length} Schritten...`);

  for (const step of sequence) {
      logToFile(`[Bot ${deviceId}] Führe aus: ${step.name} (X: ${step.x}, Y: ${step.y}) - Warte ${step.delaySeconds}s...`);
      clickAt(step.x, step.y);
      await delay(step.delaySeconds * 1000);
  }

  logToFile(`[Bot ${deviceId}] Sequenz ${seqIndex + 1} abgeschlossen.`);
  printerDataMap[deviceId].printedParts++;
  updateDashboard();

  let nextIndex = seqIndex + 1;
  if (nextIndex >= sequences.length) {
    if (device.bot.mode === 'loop' || device.bot.mode === 'target_count' || device.bot.mode === 'target_time') {
      nextIndex = 0;
      logToFile(`[Bot ${deviceId}] Loop aktiv (${device.bot.mode}), beginne wieder bei Sequenz 1 für den nächsten Druck.`);
    } else {
      logToFile(`[Bot ${deviceId}] Ende erreicht (kein Loop).`);
    }
  } else {
    logToFile(`[Bot ${deviceId}] Nächster Druck nutzt Sequenz ${nextIndex + 1}.`);
  }
  
  device.bot.currentSequenceIndex = nextIndex;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// --- KOMMUNIKATION MIT GUI ---
function updateDashboard(): void {
  if (mainWindow) {
    mainWindow.webContents.send("printer-data", printerDataMap);
  }
}

ipcMain.on("serial-command", (_event, { deviceId, cmd }) => {
  sendToBambi(deviceId, cmd);
});

ipcMain.on("save-config", (event, newConfig) => {
  try {
    const oldConfig = JSON.parse(JSON.stringify(config)); // deep copy
    config = newConfig;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    config.devices.forEach(newDevice => {
      if (!printerDataMap[newDevice.id]) {
        printerDataMap[newDevice.id] = {
          currentTemp: 0, targetTemp: 0, percent: 0, status: "Offline",
          bambiState: "Unbekannt", isWaitingToClose: false, isDoorOpen: false, printedParts: 0, botStartTime: undefined
        };
        printFinishedHandledMap[newDevice.id] = false;
        connectSerial(newDevice.id);
        connectMQTT(newDevice.id);
        return;
      }

      const oldDevice = oldConfig.devices.find((d: any) => d.id === newDevice.id);
      if (oldDevice) {
        if (!oldDevice.bot?.autoMode && newDevice.bot?.autoMode) {
          logToFile(`[Bot ${newDevice.id}] Auto-Modus aktiviert, setze Tracker zurück.`);
          printerDataMap[newDevice.id].printedParts = 0;
          printerDataMap[newDevice.id].botStartTime = Date.now();
        }
        if (oldDevice.serial.port !== newDevice.serial.port || oldDevice.serial.baudRate !== newDevice.serial.baudRate) {
          logToFile(`[Settings] Port/BaudRate für ${newDevice.id} geändert, starte serielle Verbindung neu...`);
          connectSerial(newDevice.id);
        } else {
          sendToBambi(newDevice.id, `SAVE:${newDevice.servo.open}:${newDevice.servo.close}`);
        }

        if (oldDevice.printer.ip !== newDevice.printer.ip || oldDevice.printer.accessCode !== newDevice.printer.accessCode || oldDevice.printer.serial !== newDevice.printer.serial) {
          logToFile(`[Settings] MQTT für ${newDevice.id} geändert, starte neu...`);
          connectMQTT(newDevice.id);
        }
      }
    });

    logToFile('[Settings] Config erfolgreich aktualisiert!');
  } catch (error: any) {
    logToFile(`[Settings] Fehler beim Speichern: ${error.message}`);
  }
});

ipcMain.on('save-bot-sequence', (event, { deviceId, sequences, mode, targetCount, targetTimeHours, customStartSeq }) => {
    const device = config.devices.find(d => d.id === deviceId);
    if (device) {
      try {
        device.bot.sequences = sequences;
        device.bot.mode = mode;
        if (targetCount !== undefined) device.bot.targetCount = targetCount;
        if (targetTimeHours !== undefined) device.bot.targetTimeHours = targetTimeHours;
        
        if (customStartSeq !== undefined) {
          device.bot.customStartSeq = customStartSeq;
          device.bot.currentSequenceIndex = customStartSeq - 1; // 1-indexed in UI, 0-indexed in code
        } else {
          device.bot.customStartSeq = undefined;
          device.bot.currentSequenceIndex = 0;
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        logToFile(`[Bot ${deviceId}] Erfolgreich in config.json gespeichert: ${sequences.length} Sequenzen`);
      } catch (error: any) {
        logToFile(`[Bot ${deviceId}] Fehler beim Speichern der config.json: ${error.message}`);
      }
    }
});

ipcMain.on('quit-app', () => {
  app.quit();
});

ipcMain.on("change-language", (event, lang) => {
  try {
    config.language = lang;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    const localesPath = path.join(app.getAppPath(), "locales", `${lang}.json`);
    if (fs.existsSync(localesPath)) {
      const newTranslations = JSON.parse(fs.readFileSync(localesPath, "utf-8"));
      currentTranslations = newTranslations;
      logToFile(`[Main] Sprache gewechselt zu: ${lang}`);
      
      event.reply("init-app", { config: config, i18n: currentTranslations });
    }
  } catch (error: any) {
    logToFile(`[Main] Fehler beim Sprachwechsel: ${error.message}`);
  }
});

ipcMain.on("start-bot", (event, deviceId) => {
  startNewSpool(deviceId);
});

ipcMain.on("test-bot-sequence", async (event, sequence) => {
  logToFile(`[Bot Test] Teste Sequenz mit ${sequence.length} Schritten...`);
  for (const step of sequence) {
    logToFile(`[Bot Test] Klick: ${step.name} (X: ${step.x}, Y: ${step.y})`);
    clickAt(step.x, step.y);
    await delay(step.delaySeconds * 1000);
  }
  logToFile("[Bot Test] Beendet.");
});

let captureResolve: ((val: any) => void) | null = null;

// --- HOTKEY LOGIK (Richtiger Backend Code) ---
ipcMain.handle('capture-cursor-hotkey', () => {
  return new Promise((resolve) => {
    const hotkey = 'F8'; 
    captureResolve = resolve;
    
    globalShortcut.unregister(hotkey);
    logToFile(`[Bot] Versuche Hotkey (${hotkey}) bei Windows anzumelden...`);

    const success = globalShortcut.register(hotkey, () => {
      const point = screen.getCursorScreenPoint();
      logToFile(`[Bot] ${hotkey} gedrückt! Position erfasst: X:${point.x} Y:${point.y}`);
      
      globalShortcut.unregister(hotkey);

      // NEU: Echte Windows-Benachrichtigung anzeigen!
      // Wir holen uns die Texte aus deinen geladenen Sprachdateien (mit Fallback)
      const title = currentTranslations?.bot?.capture_success_title || "Gespeichert!";
      const body = currentTranslations?.bot?.capture_success_body || "Koordinaten übernommen.";
      
      new Notification({ title: title, body: body }).show();

      if (captureResolve) {
        captureResolve(point);
        captureResolve = null;
      }
    });

    if (!success) {
      logToFile(`[Bot] Fehler: Konnte ${hotkey} nicht registrieren.`);
    } else {
      logToFile(`[Bot] ✅ Hotkey ${hotkey} ist scharfgeschaltet. Warte auf Eingabe...`);
    }
  });
});

ipcMain.on('cancel-capture-cursor', () => {
  const hotkey = 'F8';
  globalShortcut.unregister(hotkey);
  logToFile(`[Bot] Capture für ${hotkey} abgebrochen.`);
  if (captureResolve) {
    captureResolve(null);
    captureResolve = null;
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// --- FILAMENT MANAGER IPC ---
ipcMain.handle('get-filaments', () => getFilaments());
ipcMain.handle('add-filament', (_event, f) => addFilament(f));
ipcMain.handle('update-filament', (_event, id, updates) => updateFilament(id, updates));
ipcMain.handle('delete-filament', (_event, id) => {
  deleteFilament(id);
  return true;
});

ipcMain.handle('import-pdf', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PDF Invoices', extensions: ['pdf'] }]
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  try {
    const fs = require('fs');
    const { PDFParse } = require('pdf-parse');
    const dataBuffer = fs.readFileSync(result.filePaths[0]);
    const parser = new PDFParse({ data: dataBuffer });
    const parsed = await parser.getText();
    return parsed.text;
  } catch (error) {
    console.error("PDF Parsing Error:", error);
    return "ERROR: " + error.message;
  }
});