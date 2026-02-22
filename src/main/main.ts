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

// --- GLOBALE VARIABLEN ---
let mainWindow: BrowserWindow | null = null;
let port: SerialPort | null = null;
let parser: ReadlineParser | null = null;
let currentTranslations: any = {};

// --- KONFIGURATION LADEN ---
const configPath = path.join(app.getAppPath(), "config.json");
let config: Config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const lang = config.language || "de";
const localesPath = path.join(app.getAppPath(), "locales", `${lang}.json`);
const translations = JSON.parse(fs.readFileSync(localesPath, "utf-8"));

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
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const indexPath = path.join(__dirname, "../renderer/index.html");
  if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    mainWindow.loadURL("http://localhost:3000");
  }

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow?.webContents.send("init-app", {
      config: config,
      i18n: translations,
    });
  });
}

app.whenReady().then(() => {
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
    port = new SerialPort({
      path: config.serial.port,
      baudRate: config.serial.baudRate,
      autoOpen: false,
    });

    port.open((err) => {
      if (err) {
        console.log(`[Serial] Port ${config.serial.port} nicht gefunden.`);
      } else {
        console.log(`[Serial] Verbunden mit ${config.serial.port}`);
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
        console.log("[Serial Data Error]");
      }
    });
  } catch (error: any) {
    console.error("SerialPort Fehler:", error.message);
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
  client = mqtt.connect(`mqtts://${config.printer.ip}:8883`, {
    username: "bblp",
    password: config.printer.accessCode,
    rejectUnauthorized: false,
  });

  client.on("connect", () => {
    printerData.status = "Verbunden";
    client.subscribe(`device/${config.printer.serial}/report`);
    client.publish(
      `device/${config.printer.serial}/request`,
      JSON.stringify({ pushing: { sequenceId: "1", command: "pushing" } }),
    );
    updateDashboard();
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
                console.log('[Auto] ⚠️ WARNUNG: Kein Material-Profil ausgewählt! Tür-Automatik ist deaktiviert.');
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
                console.log(`[Auto] 80% erreicht & Temperatur OK (${printerData.currentTemp}°C <= ${currentTargetOpenTemp}°C | Profil: ${activeProfile.name}) -> Öffne Tür!`);
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
      console.log("[Bot] Keine Klick-Sequenz gespeichert. Bot bricht ab.");
      return;
  }

  console.log(`[Bot] Starte Klick-Sequenz mit ${sequence.length} Schritten...`);

  

  // Abarbeiten der dynamischen Liste
  for (const step of sequence) {
      console.log(`[Bot] Führe aus: ${step.name} (X: ${step.x}, Y: ${step.y}) - Warte ${step.delaySeconds}s...`);
      clickAt(step.x, step.y);
      
      // Delay in Millisekunden umrechnen
      await delay(step.delaySeconds * 1000);
  }

  console.log("[Bot] Sequenz abgeschlossen.");
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
    console.log('[Settings] Config erfolgreich aktualisiert!');
  } catch (error) {
    console.error('[Settings] Fehler beim Speichern:', error);
  }
});

ipcMain.on('save-bot-sequence', (event, sequence) => {
  try {
    config.bot.sequence = sequence; 
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('[Bot] Erfolgreich in config.json gespeichert:', sequence.length, 'Klicks');
  } catch (error) {
    console.error('[Bot] Fehler beim Speichern der config.json:', error);
  }
});

ipcMain.on('quit-app', () => {
  app.quit();
});

// Kann jetzt manuell aus dem UI oder automatisch vom MQTT getriggert werden
ipcMain.on("start-bot", () => {
  startNewSpool();
});