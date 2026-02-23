import { app, BrowserWindow, ipcMain, screen } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as mqtt from "mqtt";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { exec } from "child_process";

// --- INTERFACES ---
interface MaterialProfile {
  id: string;
  name: string;
  openTemp: number;
}

interface Config {
  printer: {
    ip: string;
    accessCode: string;
    serial: string;
  };
  serial: { port: string; baudRate: number };
  servo: { open: number; close: number };
  bot: {
    closeDelayMs: number;
    sequence: Array<{
      id: string;
      name: string;
      x: number;
      y: number;
      delaySeconds: number;
    }>;
  };
  materials: {
    activeProfileId: string;
    profiles: MaterialProfile[];
  };
  language: string;
  eulaAccepted: boolean;
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
let port: SerialPort | null = null;
let parser: ReadlineParser | null = null;
let currentTranslations: any = {};

// --- STANDARD KONFIGURATION (Hardcoded im Code) ---
const defaultConfig: Config = {
  printer: {
    ip: "192.168.X.X",
    accessCode: "",
    serial: ""
  },
  serial: {
    port: "COM3",
    baudRate: 115200
  },
  servo: {
    open: 0,
    close: 175
  },
  bot: {
    closeDelayMs: 20000,
    sequence: []
  },
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

let config: any; // oder dein Interface Config

// SCHRITT 2: Datei laden oder erstellen
try {
  if (fs.existsSync(configPath)) {
    // Datei ist da -> Laden
    const rawData = fs.readFileSync(configPath, "utf-8");
    config = JSON.parse(rawData);
    logToFile("Config geladen.");
  } else {
    // Datei fehlt -> Standardwerte nehmen und SPEICHERN
    logToFile("Erstelle neue config.json...");
    config = defaultConfig;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
} catch (error: any) {
  logToFile(`Config defekt, nutze Defaults: ${error.message}`);
  config = defaultConfig;
}

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

let printerData: PrinterData = {
  currentTemp: 0,
  targetTemp: 0,
  percent: 0,
  status: "Offline",
  bambiState: "Unbekannt",
  isWaitingToClose: false,
  isDoorOpen: false,
  printedParts: 0,
};

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
    webPreferences: {
      // Nutzt den absoluten Pfad zur preload.js
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // DEVTOOLS ERZWINGEN FÜR DEBUGGING
  mainWindow.webContents.openDevTools();

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

  mainWindow.webContents.on("crashed", (event, killed) => {
    logToFile(`[Main] CRITICAL: Renderer Process CRASHED! Killed: ${killed}`);
  });
}

app.whenReady().then(() => {
  logToFile("[Main] App is Ready.");
  createWindow();
  connectSerial();
  connectMQTT();
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
function connectSerial(): void {
  try {
    // NEU: Alte Verbindung schließen, falls vorhanden
    if (port && port.isOpen) {
      port.close();
      logToFile("[Serial] Alte Verbindung geschlossen.");
    }

    if (!config.serial.port) return;

    logToFile(`[Serial] Versuche Verbindung zu ${config.serial.port}...`);
    port = new SerialPort({
      path: config.serial.port,
      baudRate: config.serial.baudRate,
      autoOpen: false,
    });

    port.open((err) => {
      if (err) {
        logToFile(`[Serial] Port ${config.serial.port} nicht gefunden oder Fehler: ${err.message}`);
      } else {
        logToFile(`[Serial] Verbunden mit ${config.serial.port}`);
      }
    });

    parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

    parser.on("data", (data: string) => {
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
        // Zu viel Spam im Log vermeiden
      }
    });
  } catch (error: any) {
    logToFile(`SerialPort Fehler: ${error.message}`);
  }
}

function sendToBambi(command: string): void {
  if (port && port.isOpen) {
    port.write(command + "\n");
  }
}

// --- MQTT VERBINDUNG ---
let client: mqtt.MqttClient;

function connectMQTT(): void {
  if (client) {
    client.end(true); 
    logToFile("[MQTT] Alte Verbindung getrennt.");
  }

  // NEU: Gar nicht erst versuchen, wenn noch die Platzhalter-IP drinsteht
  if (!config.printer.ip || config.printer.ip.includes("X.X")) {
    logToFile("[MQTT] Keine gültige IP hinterlegt. Warte auf Benutzereingabe.");
    return;
  }
  logToFile(`[MQTT] Versuche Verbindung zu ${config.printer.ip}...`);
  client = mqtt.connect(`mqtts://${config.printer.ip}:8883`, {
    username: "bblp",
    password: config.printer.accessCode,
    rejectUnauthorized: false,
  });

  client.on("connect", () => {
    logToFile("[MQTT] Verbunden!");
    printerData.status = "Verbunden";
    client.subscribe(`device/${config.printer.serial}/report`);
    client.publish(
      `device/${config.printer.serial}/request`,
      JSON.stringify({ pushing: { sequenceId: "1", command: "pushing" } }),
    );
    updateDashboard();
  });

  client.on("error", (err) => {
    logToFile(`[MQTT] Fehler: ${err.message}`);
  });

  client.on("message", (topic: string, message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      if (data && data.print) {
        const p = data.print;
        if (p.bed_temper !== undefined) printerData.currentTemp = Math.round(p.bed_temper);
        if (p.bed_target_temper !== undefined) printerData.targetTemp = Math.round(p.bed_target_temper);
        if (p.mc_percent !== undefined) printerData.percent = p.mc_percent;
        if (p.gcode_state) printerData.status = p.gcode_state;


        // --- Die smarte Tür-Steuerung (mit Profilen) ---
        const profiles = config.materials?.profiles || [];
        const activeProfileId = config.materials?.activeProfileId;
        const activeProfile = profiles.find((p: any) => p.id === activeProfileId);

        if (!activeProfile && printerData.status === "RUNNING") {
            // Nur einmal warnen, nicht spammen
            if (!printerData.isDoorOpen) {
                logToFile('[Auto] ⚠️ WARNUNG: Kein Material-Profil ausgewählt! Tür-Automatik ist deaktiviert.');
                printerData.isDoorOpen = true; // Missbraucht als Flag, um Spam zu verhindern
            }
        } else if (activeProfile) {
            const currentTargetOpenTemp = activeProfile.openTemp;
            const isNearEnd = printerData.percent > 80;         
            const isSafeTemp = printerData.currentTemp <= currentTargetOpenTemp;

            if ( 
                isSafeTemp &&              
                isNearEnd &&               
                !printerData.isDoorOpen    
            ) {
                logToFile(`[Auto] 80% erreicht & Temperatur OK (${printerData.currentTemp}°C <= ${currentTargetOpenTemp}°C | Profil: ${activeProfile.name}) -> Öffne Tür!`);
                sendToBambi("OPEN");
                printerData.isDoorOpen = true; 
            }
        }

        // --- Finish Logik ---
        if (
          (printerData.status === "FINISH" || printerData.status === "COMPLETED") &&
          !printerData.isWaitingToClose
        ) {
          printerData.isWaitingToClose = true;
          setTimeout(() => {
            sendToBambi("CLOSE");
            printerData.isWaitingToClose = false;
            printerData.isDoorOpen = false; // Reset für den nächsten Druck
            
            setTimeout(() => {
              if (printerData.status === "FINISH" || printerData.status === "IDLE") {
                startNewSpool();
              }
            }, 60000);
          }, config.bot.closeDelayMs || 20000);
        }
      }
      updateDashboard();
    } catch (e) {}
  });
}

// --- BOT FUNKTIONEN ---
function clickAt(x: number | string, y: number | string): void {
  const clickCmd = `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x},${y}); $type = Add-Type -name nativeMethods -namespace Win32 -PassThru -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern void mouse_event(int d, int x, int y, int c, int e);'; $type::mouse_event(2, 0, 0, 0, 0); $type::mouse_event(4, 0, 0, 0, 0);"`;
  exec(clickCmd);
}

// Wartet eine bestimmte Anzahl an Millisekunden
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function startNewSpool(): Promise<void> {
  const sequence = config.bot.sequence;
  
  if (!sequence || sequence.length === 0) {
      logToFile("[Bot] Keine Klick-Sequenz gespeichert. Bot bricht ab.");
      return;
  }

  logToFile(`[Bot] Starte Klick-Sequenz mit ${sequence.length} Schritten...`);

  

  // Abarbeiten der dynamischen Liste
  for (const step of sequence) {
      logToFile(`[Bot] Führe aus: ${step.name} (X: ${step.x}, Y: ${step.y}) - Warte ${step.delaySeconds}s...`);
      clickAt(step.x, step.y);
      
      // Delay in Millisekunden umrechnen
      await delay(step.delaySeconds * 1000);
  }

  logToFile("[Bot] Sequenz abgeschlossen.");
printerData.printedParts++;
  updateDashboard();
}

// --- KOMMUNIKATION MIT GUI ---
function updateDashboard(): void {
  if (mainWindow) {
    mainWindow.webContents.send("printer-data", printerData);
  }
}

ipcMain.on("serial-command", (_event, cmd: string) => {
  sendToBambi(cmd);
});

ipcMain.on("save-config", (event, newConfig) => {
  try {
    config = newConfig;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    sendToBambi(`SAVE:${config.servo.open}:${config.servo.close}`);
    logToFile('[Settings] Config erfolgreich aktualisiert!');
    connectSerial();
    connectMQTT();
  } catch (error: any) {
    logToFile(`[Settings] Fehler beim Speichern: ${error.message}`);
  }
});

ipcMain.on('save-bot-sequence', (event, sequence) => {
  try {
    config.bot.sequence = sequence; 
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    logToFile(`[Bot] Erfolgreich in config.json gespeichert: ${sequence.length} Klicks`);
  } catch (error: any) {
    logToFile(`[Bot] Fehler beim Speichern der config.json: ${error.message}`);
  }
});

ipcMain.on('quit-app', () => {
  app.quit();
});

// Kann jetzt manuell aus dem UI oder automatisch vom MQTT getriggert werden
ipcMain.on("start-bot", () => {
  startNewSpool();
});
