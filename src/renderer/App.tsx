import React, { useState, useEffect } from "react";
import "./App.css"; // Falls du Styling extrahieren willst
import Settings from "./components/settings";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "settings" | "gcode"
  >("dashboard");
  const [printerData, setPrinterData] = useState<any>({
    currentTemp: 0,
    targetTemp: 0,
    percent: 0,
    status: "Lade...",
    bambiState: "Unbekannt",
    spoolsDone: 0,
  });
  const [config, setConfig] = useState<any>(null);

useEffect(() => {
  // Sicherheitscheck: Gibt es die Bridge?
  if (window.electronAPI) {
    
    // 1. ZUHÖREN: Wenn Daten kommen, speichern wir sie
    window.electronAPI.onInitConfigs((data: any) => {
      console.log("Daten empfangen:", data); // Zur Kontrolle in der Konsole
      setConfig(data.config || data); 
    });

    window.electronAPI.onPrinterUpdate((data: any) => {
      setPrinterData(data);
    });

    // 2. RUFEN: "Hallo Main-Prozess, schick mir die Daten bitte jetzt!"
    // ---> DIESE ZEILE IST NEU UND WICHTIG: <---
    window.electronAPI.requestConfig(); 
  }
}, []);

  useEffect(() => {
    // Auf Daten vom Main-Prozess hören
    if (window.electronAPI) {
      window.electronAPI.onPrinterUpdate((data: any) => {
        setPrinterData(data);
      });
    }
  }, []);

  if (!config) {
    return <div style={{ color: "white" }}>Lade Konfiguration...</div>;
  }

  return (
    <div className="app-layout">
      {/* Sidebar / Navigation */}
      <aside className="sidebar">
        <div className="brand">Belling Software</div>
        <nav>
          <button
            className={activeTab === "dashboard" ? "active" : ""}
            onClick={() => setActiveTab("dashboard")}
          >
            📊 Dashboard
          </button>
          <button
            className={activeTab === "settings" ? "active" : ""}
            onClick={() => setActiveTab("settings")}
          >
            ⚙️ Settings
          </button>
          <button
            className={activeTab === "gcode" ? "active" : ""}
            onClick={() => setActiveTab("gcode")}
          >
            📄 Gcode Gen
          </button>
        </nav>
        <div className="version">v1.0.0</div>
      </aside>

      {/* Main Content Area */}
      <main className="content">
        {activeTab === "dashboard" && (
          <div className="dashboard-grid">
            {/* Drucker Status Card */}
            <div className="card status-card">
              <h3>Drucker Status</h3>
              <div className="status-badge">{printerData.status}</div>
              <div className="temp-display">
                <span className="current">{printerData.currentTemp}°C</span>
                <span className="target"> / {printerData.targetTemp}°C</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${printerData.percent}%` }}
                ></div>
              </div>
              <p>{printerData.percent}% abgeschlossen</p>
            </div>

            {/* Bambi Tür-Status Card */}
            <div className="card bambi-card">
              <h3>Bambi P2S Tür</h3>
              <div
                className={`bambi-badge ${printerData.bambiState === "OFFEN" ? "open" : "closed"}`}
              >
                {printerData.bambiState}
              </div>
              <div className="actions">
                <button onClick={() => window.electronAPI.sendSerial("OPEN")}>
                  Öffnen
                </button>
                <button onClick={() => window.electronAPI.sendSerial("CLOSE")}>
                  Schließen
                </button>
              </div>
            </div>

            {/* Statistik Card */}
            <div className="card stats-card">
              <h3>Statistik</h3>
              <div className="stat-value">{printerData.spoolsDone}</div>
              <div className="stat-label">Gedruckte Spulen</div>
            </div>
          </div>
        )}

        {activeTab === "settings" && <Settings initialConfig={config} />}
        {activeTab === "gcode" && (
          <div className="card">
            <h2>Gcode Tool folgt...</h2>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
