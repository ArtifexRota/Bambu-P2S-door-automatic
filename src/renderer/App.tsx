import React, { useState, useEffect } from "react";
import "./App.css"; 
import Settings from "./components/Settings"; // Achte auf Groß-/Kleinschreibung bei Datei-Imports!
import BotConfig from './components/BotConfig';
import { Toaster } from 'react-hot-toast';
import GcodeGen from './components/GcodeGen';
import EulaModal from './components/EulaModal';
import toast from "react-hot-toast";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings" | "gcode" | 'bot'>('dashboard');
  
  const [printerData, setPrinterData] = useState<any>({
    currentTemp: 0,
    targetTemp: 0,
    percent: 0,
    status: "Lade...",
    bambiState: "Unbekannt",
    printedParts: 0,
  });
  
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    if (window.electronAPI) {
      // 1. ZUHÖREN: Wenn Daten kommen, speichern wir sie
      window.electronAPI.onInitConfigs((data: any) => {
        console.log("Config empfangen:", data); 
        setConfig(data.config || data); 
      });

      // (Der doppelte useEffect wurde hier sauber zusammengefasst)
      window.electronAPI.onPrinterUpdate((data: any) => {
        setPrinterData(data);
      });

      // 2. RUFEN: Initiale Config anfordern
      window.electronAPI.requestConfig(); 
    }
  }, []);

  if (!config) {
    return <div style={{ color: "white", padding: '20px' }}>Lade Konfiguration...</div>;
  }

  // --- Aktives Material ermitteln ---
  const profiles = config.materials?.profiles || [];
  const activeProfile = profiles.find((p: any) => p.id === config.materials?.activeProfileId);
  const profileName = activeProfile ? activeProfile.name : "Kein Profil";
  const openTemp = activeProfile ? activeProfile.openTemp : "--";

let autoStatusText = "💤 Warte auf Druck...";
  let autoStatusColor = "#888";
  let autoStatusBg = "rgba(255, 255, 255, 0.05)";
  let autoStatusBorder = "1px solid #444";

  if (printerData.status === "RUNNING") {
      if (printerData.percent < 80) {
          autoStatusText = "⏳ Warte auf 80% Fortschritt...";
          autoStatusColor = "#e6a800"; // Gelb
          autoStatusBorder = "1px solid #e6a800";
          autoStatusBg = "rgba(230, 168, 0, 0.1)";
      } else if (!printerData.isDoorOpen) {
          autoStatusText = "🌡️ 80% erreicht. Warte auf Abkühlung...";
          autoStatusColor = "#2196f3"; // Blau
          autoStatusBorder = "1px solid #2196f3";
          autoStatusBg = "rgba(33, 150, 243, 0.1)";
      } else {
          autoStatusText = "✅ Tür ist offen!";
          autoStatusColor = "#4caf50"; // Grün
          autoStatusBorder = "1px solid #4caf50";
          autoStatusBg = "rgba(76, 175, 80, 0.1)";
      }
  } else if (printerData.status === "FINISH" || printerData.status === "COMPLETED") {
      autoStatusText = "🔄 Druck beendet. Bot übernimmt...";
      autoStatusColor = "#9c27b0"; // Lila
      autoStatusBorder = "1px solid #9c27b0";
      autoStatusBg = "rgba(156, 39, 176, 0.1)";
  }

const handleAcceptEula = () => {
    const updatedConfig = { ...config, eulaAccepted: true };
    setConfig(updatedConfig);
    if (window.electronAPI && window.electronAPI.saveConfig) {
      window.electronAPI.saveConfig(updatedConfig);
      toast.success("Lizenz akzeptiert. Willkommen!");
    }
  };

  const handleDeclineEula = () => {
    if (window.electronAPI && window.electronAPI.quitApp) {
      window.electronAPI.quitApp();
    }
  };

  return (
    <div className="app-layout">
      {/* DER TÜRSTEHER: Zeigt das Modal an, wenn eulaAccepted false oder nicht vorhanden ist */}
      {!config.eulaAccepted && (
        <EulaModal onAccept={handleAcceptEula} onDecline={handleDeclineEula} />
      )}
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          style: {
            background: '#1e1e24', 
            color: '#fff',
            border: '1px solid #333'
          },
          success: {
            iconTheme: {
              primary: '#4caf50', 
              secondary: '#fff',
            },
          },
        }} 
      />
      
      {/* Sidebar / Navigation */}
      <aside className="sidebar">
        
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
            className={activeTab === "bot" ? "active" : ""}
            onClick={() => setActiveTab("bot")}
          >
            🤖 Bot Setup
          </button>

          <button
            className={activeTab === "gcode" ? "active" : ""}
            onClick={() => setActiveTab("gcode")}
          >
            📄 Gcode Gen
          </button>
        </nav>
        
      </aside>

      {/* Main Content Area */}
      <main className="content">
        {activeTab === "dashboard" && (
          <div className="dashboard-grid">
            
            {/* 1. Drucker Status Card */}
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

            {/* 2. NEU: Aktuelles Material Card */}
            <div className="card profile-card">
              <h3>Aktuelles Material</h3>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2196f3', margin: '15px 0 5px 0' }}>
                {profileName}
              </div>
              <div style={{ color: '#bbb', fontSize: '1.1rem' }}>
                Tür öffnet bei: <strong>{openTemp}°C</strong>
              </div>
              
              {/* Smarter Automatik-Status */}
              <div style={{ 
                marginTop: '25px', 
                padding: '10px', 
                borderRadius: '4px',
                background: autoStatusBg,
                color: autoStatusColor,
                border: autoStatusBorder,
                textAlign: 'center',
                fontWeight: 'bold',
                transition: 'all 0.3s ease'
              }}>
                {autoStatusText}
              </div>
            </div>

            {/* 3. Bambi Tür-Status Card */}
            <div className="card bambi-card">
              <h3>Bambi P2S Tür</h3>
              <div
                className={`bambi-badge ${printerData.bambiState === "OFFEN" ? "open" : "closed"}`}
              >
                {printerData.bambiState}
              </div>
              <div className="actions" style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button 
                  onClick={() => window.electronAPI.sendSerial("OPEN")}
                  style={{ flex: 1, padding: '10px', background: '#2a2a2e', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', transition: 'background 0.2s' }}
                >
                  🔓 Öffnen
                </button>
                <button 
                  onClick={() => window.electronAPI.sendSerial("CLOSE")}
                  style={{ flex: 1, padding: '10px', background: '#2a2a2e', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', transition: 'background 0.2s' }}
                >
                  🔒 Schließen
                </button>
              </div>
            </div>

            {/* 4. Statistik Card */}
            <div className="card stats-card">
              <h3>Session Statistik</h3>
              <div className="stat-value">{printerData.printedParts}</div>
              <div className="stat-label">Gedruckte Teile</div>
            </div>

          </div>
        )}

        {activeTab === "settings" && <Settings initialConfig={config} />}
        {activeTab === 'bot' && <BotConfig initialSequence={config?.bot?.sequence} />}
        {activeTab === "gcode" && <GcodeGen />}
      </main>
    </div>
  );
};

export default App;