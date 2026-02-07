const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const mqtt = require("mqtt");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const { exec } = require("child_process");

// --- GLOBALE VARIABLEN ---
let mainWindow;
let port;
let parser;

// --- KONFIGURATION LADEN (Weg von Hardcoded) ---
const configPath = path.join(__dirname, "config.json");
let config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const lang = config.language || "de";
const translations = JSON.parse(
  fs.readFileSync(path.join(__dirname, `locales/${lang}.json`), "utf-8"),
);

let printerData = {
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
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // Sobald das Fenster geladen ist, schicken wir die Config an die GUI
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("init-app", {
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
function connectSerial() {
  try {
    port = new SerialPort({
      path: config.serial.port,
      baudRate: config.serial.baudRate,
      autoOpen: false,
    });

    port.open((err) => {
      if (err) {
        console.log(
          `[Serial] Port ${config.serial.port} nicht gefunden. (Entwicklungsmodus)`,
        );
      } else {
        console.log(`[Serial] Verbunden mit ${config.serial.port}`);
      }
    });

    parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

    parser.on("data", (data) => {
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
        console.log("[Serial Data Error]", e.message);
      }
    });
  } catch (error) {
    console.error("SerialPort Fehler:", error.message);
  }
}

function sendToBambi(command) {
  if (port && port.isOpen) {
    port.write(command + "\n");
  } else {
    console.log("[Serial] Senden nicht möglich: Port geschlossen.");
  }
}

// --- MQTT VERBINDUNG ---
let client;
function connectMQTT() {
  client = mqtt.connect(`mqtts://${config.printer.ip}:8883`, {
    username: "bblp",
    password: config.printer.accessCode,
    rejectUnauthorized: false,
    secureProtocol: "TLSv1_2_method",
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

  client.on("message", (topic, message) => {
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

        // Logik für Türöffnung
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

        // Finish Logik
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
function clickAt(x, y) {
  const clickCmd = `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x},${y}); $type = Add-Type -name nativeMethods -namespace Win32 -PassThru -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern void mouse_event(int d, int x, int y, int c, int e);'; $type::mouse_event(2, 0, 0, 0, 0); $type::mouse_event(4, 0, 0, 0, 0);"`;
  exec(clickCmd);
}

async function startNewSpool() {
  const coords = {
    taskbar: config.bot.posTaskbar.split(","),
    print: config.bot.posPrint.split(","),
    // Füge hier die weiteren hinzu...
  };

  clickAt(coords.taskbar[0], coords.taskbar[1]);
  await new Promise((r) => setTimeout(r, 2000));
  exec(
    `powershell -command "$wshell = New-Object -ComObject WScript.Shell; $wshell.AppActivate('Bambu Studio')"`,
  );

  // Hier die Klick-Sequenz fortsetzen...
  printerData.spoolsDone++;
  updateDashboard();
}

// --- KOMMUNIKATION MIT GUI ---
function updateDashboard() {
  if (mainWindow) {
    mainWindow.webContents.send("printer-data", printerData);
  }
}

ipcMain.on("serial-command", (event, cmd) => {
  sendToBambi(cmd);
});

ipcMain.on("save-config", (event, newValues) => {
  // Config im Speicher und in Datei aktualisieren
  config.servo.open = parseInt(newValues.servoOpen);
  config.servo.close = parseInt(newValues.servoClose);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  // Befehl an ESP32 senden, um dort permanent zu speichern
  sendToBambi(`SAVE:${newValues.servoOpen}:${newValues.servoClose}`);
});

ipcMain.on("start-bot", (event, data) => {
  // Aktualisiere Bot-Settings temporär oder permanent
  config.bot.clickDelay = data.delay;
  config.bot.posTaskbar = data.posTaskbar;
  config.bot.posPrint = data.posPrint;
  startNewSpool();
});
