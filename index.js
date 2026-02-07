const mqtt = require('mqtt');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { exec } = require('child_process');

// --- KONFIGURATION ---
const config = {
    ip: '192.168.100.146',
    accessCode: 'e245c3fb',
    printerSerial: '22E8BJ5A3000293',
    serialPath: 'COM100',
    targetOpenTemp: 80,
    closeDelayMs: 20000, // 20 Sekunden warten nach FINISH
    // Deine ermittelten Pixel-Werte
    clickTaskbar:       { x: 344, y: 1053 }, 
    clickPreview:       { x: 247, y: 46 },
    clickPrint:         { x: 1765, y: 48 },
    clickSend:          { x: 1237, y: 811 },
    clickBackground:    { x: 1237, y: 1053 }
};

let printerData = {
    currentTemp: 0,
    targetTemp: 0,
    percent: 0,
    status: "Offline",
    bambiState: "Unbekannt",
    readyToCool: false,
    isWaitingToClose: false,
    spoolsDone: 0 // Zähler für die Nacht
};

// --- SERIELLE VERBINDUNG ---
const port = new SerialPort({ path: config.serialPath, baudRate: 115200 });
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

function sendToBambi(command) {
    port.write(command + "\n");
}

parser.on('data', (data) => {
    try {
        const json = JSON.parse(data);
        
        // 1. Sofort-Feedback bei Befehlserhalt
        if (json.bambi === "moving") {
            printerData.bambiState = (json.target === "open") ? "ÖFFNET..." : "SCHLIEẞT...";
        }

        // 2. Feedback nach Abschluss der Bewegung (nach 2 Sek + Soft-Release)
        if (json.status === "detached_soft") {
            // Wenn der ESP fertig ist, schauen wir, was das letzte Ziel war
            // In deinem ESP Code sendet detached_soft immer nach beiden Bewegungen.
            // Wir prüfen also, was wir zuletzt geschickt haben oder nutzen eine Hilfsvariable.
            
            if (printerData.bambiState === "ÖFFNET...") {
                printerData.bambiState = "OFFEN";
            } else if (printerData.bambiState === "SCHLIEẞT...") {
                printerData.bambiState = "GESCHLOSSEN";
            }
        }

        updateDashboard();
    } catch (e) {}
});

// --- BOT FUNKTIONEN (MAUS & FOKUS) ---
function clickAt(x, y) {
    // Wir setzen die Position und führen den Klick getrennt aus
    // Das ist weniger fehleranfällig beim Escaping
    const movePos = `[Windows.Forms.Cursor]::Position = "${x},${y}"`;
    const mouseClick = `(New-Object -ComObject WScript.Shell).SendKeys('{1}')`; // Dummy-Befehl
    
    // Wir nutzen hier eine stabilere Methode für den Klick:
    const clickCmd = `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x},${y}); $type = Add-Type -name nativeMethods -namespace Win32 -PassThru -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern void mouse_event(int d, int x, int y, int c, int e);'; $type::mouse_event(2, 0, 0, 0, 0); $type::mouse_event(4, 0, 0, 0, 0);"`;

    exec(clickCmd, (error) => {
        if (error) console.error("PowerShell Fehler:", error);
    });
}

async function startNewSpool() {
    console.log("\n[BOT] Starte Fokus-Sequenz...");

    // 1. Zuerst die Maus auf das Taskleisten-Icon bewegen und KLICKEN
    // Das ist zuverlässiger als der AppActivate-Befehl
    clickAt(config.clickTaskbar.x, config.clickTaskbar.y);
    
    // Gib Windows Zeit, das Fenster zu animieren und in den Vordergrund zu holen
    await new Promise(r => setTimeout(r, 2000));

    // 2. Jetzt zur Sicherheit NOCHMAL den PowerShell-Fokus Befehl hinterher
    exec(`powershell -command "$wshell = New-Object -ComObject WScript.Shell; $wshell.AppActivate('Bambu Studio')"`);
    await new Promise(r => setTimeout(r, 1000));

    console.log("[BOT] Klicke Vorschau...");
    clickAt(config.clickPreview.x, config.clickPreview.y);
    await new Promise(r => setTimeout(r, 1500));
    
    console.log("[BOT] Klicke Drucken...");
    clickAt(config.clickPrint.x, config.clickPrint.y);
    await new Promise(r => setTimeout(r, 1500)); // 6 Sek für Slicing & Fenster-Aufbau
    
    console.log("[BOT] Klicke Senden...");
    clickAt(config.clickSend.x, config.clickSend.y);
    
    printerData.spoolsDone++;
    updateDashboard();

    console.log("[BOT] Warte 20s auf Sendevorgang...");
    await new Promise(r => setTimeout(r, 20000)); 

    console.log("[BOT] Klicke Hintergrund zur Neutralisierung...");
    clickAt(config.clickBackground.x, config.clickBackground.y);

}

// --- MQTT VERBINDUNG ---
const client = mqtt.connect(`mqtts://${config.ip}:8883`, {
    username: 'bblp',
    password: config.accessCode,
    rejectUnauthorized: false,
    secureProtocol: 'TLSv1_2_method'
});

client.on('connect', () => {
    printerData.status = "Verbunden";
    client.subscribe(`device/${config.printerSerial}/report`);
    client.publish(`device/${config.printerSerial}/request`, JSON.stringify({pushing: {sequenceId: "1", command: "pushing"}}));
    process.stdout.write('\x1Bc');
});

client.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        if (data && data.print) {
            const p = data.print;

            if (p.bed_temper !== undefined) printerData.currentTemp = Math.round(p.bed_temper);
            if (p.bed_target_temper !== undefined) printerData.targetTemp = Math.round(p.bed_target_temper);
            if (p.mc_percent !== undefined) printerData.percent = p.mc_percent;
            if (p.gcode_state) printerData.status = p.gcode_state;

            // --- LOGIK-IMPLEMENTIERUNG ---

            // 1. Scharfschalten (Wichtig: Niedrigerer Wert für PLA/PETG)
            if (printerData.currentTemp >= 50 && printerData.status === "RUNNING") {
                printerData.readyToCool = true;
            }

            // 2. Öffnen (Bei Abkühlung)
            if (printerData.readyToCool && 
                printerData.targetTemp < 85 && 
                printerData.currentTemp <= config.targetOpenTemp && 
                printerData.percent > 80 ) {
                
                if (printerData.bambiState !== "OFFEN") {
                    sendToBambi("OPEN");
                }
            }

            // 3. Schließen & Bot Neustart (Nach Finish)
            if (printerData.readyToCool && 
               (printerData.status === "FINISH" || printerData.status === "COMPLETED") && 
               !printerData.isWaitingToClose) {
                
                printerData.isWaitingToClose = true;
                updateDashboard();

                setTimeout(() => {
                    sendToBambi("CLOSE");
                    printerData.readyToCool = false; 
                    printerData.isWaitingToClose = false;
                    updateDashboard();

                    // BOT START NACH 60 SEKUNDEN RUHEPAUSE
                    setTimeout(() => {
                        if (printerData.status === "FINISH" || printerData.status === "IDLE") {
                            startNewSpool();
                        }
                    }, 60000);

                }, config.closeDelayMs);
            }
        }
        updateDashboard();
    } catch (e) {}
});

function updateDashboard() {
    process.stdout.write('\x1b[H'); 
    const output = [
        "====================================================",
        "          BAMBI - BATCH PRINT CONTROLLER            ",
        "====================================================",
        ` Status:       ${printerData.status.padEnd(30)}`,
        ` Fortschritt:  ${printerData.percent}%`.padEnd(50),
        ` Bett-Temp:    ${printerData.currentTemp}°C / ${printerData.targetTemp}°C`.padEnd(50),
        ` Fertige Spulen: ${printerData.spoolsDone}`.padEnd(50),
        ` Kühl-Modus:   ${(printerData.readyToCool ? "AKTIV" : "INAKTIV").padEnd(30)}`,
        ` Timer läuft:  ${(printerData.isWaitingToClose ? "JA (20s bis CLOSE)" : "NEIN").padEnd(30)}`,
        "----------------------------------------------------",
        ` Tür Position:    ${printerData.bambiState.padEnd(30)}`,
        "----------------------------------------------------",
        " [O] Öffnen | [C] Schließen | [B] Test-Bot | [ESC]  ",
        "===================================================="
    ];
    process.stdout.write(output.join('\n') + '\n');
}

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', (key) => {
    const k = key.toString().toLowerCase();
    if (k === 'o') sendToBambi("OPEN");
    if (k === 'c') sendToBambi("CLOSE");
    if (k === 'b') startNewSpool(); // Bot manuell testen
    if (k === '\u001b' || k === '\u0003') process.exit();
    updateDashboard();
});