import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as mqtt from "mqtt";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { exec } from "child_process";

// --- INTERFACES (Löscht die TS-Fehler) ---
interface Config {
  printer: {
    ip: string;
    accessCode: string;
    serial: string;
    targetOpenTemp: number;
  };
  serial: { port: string; baudRate: number };
  servo: { open: number; close: number };
  bot: {
    clickDelayMs: number;
    closeDelayMs: number;
    posTaskbar: string;
    posPrint: string;
    [key: string]: any;
  };
  language: string;
}

interface PrinterData {
  currentTemp: number;
  targetTemp: number;
  percent: number;
  status: string;
  bambiState: string;
  readyToCool: boolean;
  isWaitingToClose: boolean;
  spoolsDone: number;
}

// --- GLOBALE VARIABLEN ---
let mainWindow: BrowserWindow | null = null;
let port: SerialPort | null = null;
let parser: ReadlineParser | null = null;

// --- KONFIGURATION LADEN ---
// Da wir in src/main/main.ts sind, müssen wir zwei Ebenen hoch zur config.json
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
  readyToCool: false,
  isWaitingToClose: false,
  spoolsDone: 0,
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

  // Pfad zur index.html im dist-Ordner oder dev-server
  const indexPath = path.join(__dirname, "../renderer/index.html");
  if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    // Falls du npm run dev nutzt
    mainWindow.loadURL("http://localhost:3000");
  }

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow?.webContents.send("init-app", {
      config: {
        servoOpen: config.servo.open,
        servoClose: config.servo.close,
        clickDelay: config.bot.clickDelayMs,
        posTaskbar: config.bot.posTaskbar,
        posPrint: config.bot.posPrint,
      },
      i18n: translations,
    });
  });
}

app.whenReady().then(() => {
  createWindow();
  connectSerial();
  connectMQTT();
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
          printerData.bambiState =
            json.target === "open" ? "ÖFFNET..." : "SCHLIEẞT...";
        }
        if (json.status === "detached_soft") {
          printerData.bambiState =
            printerData.bambiState === "ÖFFNET..." ? "OFFEN" : "GESCHLOSSEN";
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
        if (p.bed_temper !== undefined)
          printerData.currentTemp = Math.round(p.bed_temper);
        if (p.bed_target_temper !== undefined)
          printerData.targetTemp = Math.round(p.bed_target_temper);
        if (p.mc_percent !== undefined) printerData.percent = p.mc_percent;
        if (p.gcode_state) printerData.status = p.gcode_state;

        if (printerData.currentTemp >= 50 && printerData.status === "RUNNING") {
          printerData.readyToCool = true;
        }

        if (
          printerData.readyToCool &&
          printerData.targetTemp < 85 &&
          printerData.currentTemp <= config.printer.targetOpenTemp &&
          printerData.percent > 80
        ) {
          if (printerData.bambiState !== "OFFEN") sendToBambi("OPEN");
        }

        if (
          printerData.readyToCool &&
          (printerData.status === "FINISH" ||
            printerData.status === "COMPLETED") &&
          !printerData.isWaitingToClose
        ) {
          printerData.isWaitingToClose = true;
          setTimeout(() => {
            sendToBambi("CLOSE");
            printerData.readyToCool = false;
            printerData.isWaitingToClose = false;
            setTimeout(() => {
              if (
                printerData.status === "FINISH" ||
                printerData.status === "IDLE"
              )
                startNewSpool();
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

async function startNewSpool(): Promise<void> {
  const coords = {
    taskbar: config.bot.posTaskbar.split(","),
    print: config.bot.posPrint.split(","),
  };

  clickAt(coords.taskbar[0], coords.taskbar[1]);
  await new Promise((r) => setTimeout(r, 2000));
  exec(
    `powershell -command "$wshell = New-Object -ComObject WScript.Shell; $wshell.AppActivate('Bambu Studio')"`,
  );

  printerData.spoolsDone++;
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

ipcMain.on("save-config", (_event, newValues: any) => {
  config.servo.open = parseInt(newValues.servoOpen);
  config.servo.close = parseInt(newValues.servoClose);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  sendToBambi(`SAVE:${newValues.servoOpen}:${newValues.servoClose}`);
});

ipcMain.on("start-bot", (_event, data: any) => {
  config.bot.clickDelayMs = parseInt(data.delay);
  config.bot.posTaskbar = data.posTaskbar;
  config.bot.posPrint = data.posPrint;
  startNewSpool();
});
