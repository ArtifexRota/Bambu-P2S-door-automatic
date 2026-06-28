import React, { useState, useEffect } from "react";
import "./App.css"; 
import Settings from "./components/Settings";
import BotConfig from './components/BotConfig';
import { Toaster } from 'react-hot-toast';
import GcodeGen from './components/GcodeGen';
import EulaModal from './components/EulaModal';
import toast from "react-hot-toast";
import { useTranslation } from './hooks/useTranslation';

const App: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings" | "gcode" | 'bot'>('dashboard');
  
  const [printerDataMap, setPrinterDataMap] = useState<Record<string, any>>({});
  const [config, setConfig] = useState<any>(null);
  const [activeDeviceId, setActiveDeviceId] = useState<string>("1");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onInitConfigs((data: any) => {
        console.log("Config empfangen:", data); 
        setConfig(data.config || data);
        if (data.config?.devices && data.config.devices.length > 0) {
          const exists = data.config.devices.find((d: any) => d.id === activeDeviceId);
          if (!exists) {
            setActiveDeviceId(data.config.devices[0].id);
          }
        }
      });

      window.electronAPI.onPrinterUpdate((data: any) => {
        setPrinterDataMap(data);
      });
      window.electronAPI.onAppError((msg: string) => {
        toast.error(msg, { duration: 6000 });
      });
      window.electronAPI.requestConfig(); 
    }
  }, [activeDeviceId]);

  if (!config) {
    return <div style={{ color: "white", padding: '20px' }}>Loading...</div>;
  }

  const activeDevice = config.devices?.find((d: any) => d.id === activeDeviceId) || config.devices?.[0];
  const printerData = printerDataMap[activeDeviceId] || {
    currentTemp: 0,
    targetTemp: 0,
    percent: 0,
    status: "offline",
    bambiState: "Unbekannt",
    printedParts: 0,
    isDoorOpen: false
  };

  // --- Aktives Material ermitteln ---
  const profiles = config.materials?.profiles || [];
  const activeProfile = profiles.find((p: any) => p.id === activeDevice?.activeProfileId);
  const profileName = activeProfile ? activeProfile.name : "Kein Profil";
  const openTemp = activeProfile ? activeProfile.openTemp : "--";

  let autoStatusText = t("dashboard.status.waiting");
  let autoStatusColor = "#888";
  let autoStatusBg = "rgba(255, 255, 255, 0.05)";
  let autoStatusBorder = "1px solid #444";

  if (printerData.status === "RUNNING") {
      if (printerData.percent < 80) {
          autoStatusText = t("dashboard.status.waiting_80");
          autoStatusColor = "#e6a800"; // Gelb
          autoStatusBorder = "1px solid #e6a800";
          autoStatusBg = "rgba(230, 168, 0, 0.1)";
      } else if (!printerData.isDoorOpen) {
          autoStatusText = t("dashboard.status.cooling");
          autoStatusColor = "#2196f3"; // Blau
          autoStatusBorder = "1px solid #2196f3";
          autoStatusBg = "rgba(33, 150, 243, 0.1)";
      } else {
          autoStatusText = t("dashboard.status.door_open");
          autoStatusColor = "#4caf50"; // Grün
          autoStatusBorder = "1px solid #4caf50";
          autoStatusBg = "rgba(76, 175, 80, 0.1)";
      }
  } else if (printerData.status === "FINISH" || printerData.status === "COMPLETED") {
      autoStatusText = t("dashboard.status.finished");
      autoStatusColor = "#9c27b0"; // Lila
      autoStatusBorder = "1px solid #9c27b0";
      autoStatusBg = "rgba(156, 39, 176, 0.1)";
  }
  
  if (printerData.botTakeoverTime && printerData.botTakeoverTime > now) {
      const remainingSeconds = Math.ceil((printerData.botTakeoverTime - now) / 1000);
      autoStatusText = `${t("dashboard.status.bot_takeover")} ${remainingSeconds} ${t("dashboard.status.seconds")}`;
      autoStatusColor = "#ff9800"; // Orange
      autoStatusBorder = "1px solid #ff9800";
      autoStatusBg = "rgba(255, 152, 0, 0.1)";
  }

  const handleAcceptEula = () => {
    const updatedConfig = { ...config, eulaAccepted: true };
    setConfig(updatedConfig);
    if (window.electronAPI && window.electronAPI.saveConfig) {
      window.electronAPI.saveConfig(updatedConfig);
      toast.success(t("eula.accepted_toast"));
    }
  };

  const handleDeclineEula = () => {
    if (window.electronAPI && window.electronAPI.quitApp) {
      window.electronAPI.quitApp();
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    if (window.electronAPI) {
      if (window.electronAPI.changeLanguage) {
        window.electronAPI.changeLanguage(newLang);
      } else if (window.electronAPI.send) {
        window.electronAPI.send("change-language", newLang);
      }
    }
  };

  // --- NEU: Hilfsfunktionen für die Status-Übersetzungen ---
  const getPrinterStateText = (status: string) => {
    if (!status) return "";
    const key = `states.printer.${status.toLowerCase()}`;
    const translated = t(key);
    // Wenn der Key zurückgegeben wird (weil keine Übersetzung existiert), nutze den Original-Status als Fallback
    return translated === key ? status : translated;
  };

  const getDoorStateText = (state: string) => {
    // Mappt die fest eincodierten deutschen Backend-Werte auf die i18n Keys
    let stateKey = "unknown";
    switch(state) {
      case "Unbekannt": stateKey = "unknown"; break;
      case "ÖFFNET...": stateKey = "opening"; break;
      case "OFFEN": stateKey = "open"; break;
      case "SCHLIEẞT...": stateKey = "closing"; break;
      case "GESCHLOSSEN": stateKey = "closed"; break;
      default: stateKey = "unknown";
    }
    return t(`states.door.${stateKey}`);
  };

  return (
    <div className="app-layout">
      {/* DER TÜRSTEHER */}
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
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #333', marginBottom: '10px' }}>
          <label style={{ display: 'block', color: '#888', marginBottom: '5px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
            {t("dashboard.active_printer") || "Aktiver Drucker"}
          </label>
          <select 
            value={activeDeviceId} 
            onChange={(e) => setActiveDeviceId(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '10px', 
              background: '#2a2a2e', 
              color: 'white', 
              border: '1px solid #555', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {config.devices?.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name || `Drucker ${d.id}`}</option>
            ))}
          </select>
        </div>

        <nav>
          <button
            className={activeTab === "dashboard" ? "active" : ""}
            onClick={() => setActiveTab("dashboard")}
          >
            📊 {t("dashboard.title")}
          </button>
          <button
            className={activeTab === "settings" ? "active" : ""}
            onClick={() => setActiveTab("settings")}
          >
            ⚙️ {t("dashboard.settings")}
          </button>
          
          <button
            className={activeTab === "bot" ? "active" : ""}
            onClick={() => setActiveTab("bot")}
          >
            🤖 {t("dashboard.bot")}
          </button>

          <button
            className={activeTab === "gcode" ? "active" : ""}
            onClick={() => setActiveTab("gcode")}
          >
            📄 {t("dashboard.gcode")}
          </button>
        </nav>
        
        {/* Sprachauswahl */}
        <div className="language-selector" style={{ marginTop: 'auto', padding: '20px', borderTop: '1px solid #333' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#888', fontSize: '0.85rem', fontWeight: 'bold' }}>
            🌍 {t("sidebar.language")}
          </label>
          <select
            value={config.language || "en"}
            onChange={handleLanguageChange}
            style={{ 
              width: '100%', 
              padding: '8px', 
              background: '#1e1e24', 
              color: '#fff', 
              border: '1px solid #444', 
              borderRadius: '4px',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="de">Deutsch</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="it">Italiano</option>
            <option value="pt">Português</option>
            <option value="zh">中文 (简体)</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
            <option value="ru">Русский</option>
          </select>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="content">
        {activeTab === "dashboard" && (
          <div className="dashboard-grid">
            
            {/* 1. Drucker Status Card */}
            <div className="card status-card">
              <h3>{t("dashboard.printer_status")}</h3>
              {/* NEU: Nutzen der Übersetzungs-Funktion */}
              <div className="status-badge">{getPrinterStateText(printerData.status)}</div>
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
              <p>{printerData.percent}% {t("dashboard.percent_completed") || "abgeschlossen"}</p>
            </div>

            {/* 2. Aktuelles Material Card */}
            <div className="card profile-card">
              <h3>{t("dashboard.current_material")}</h3>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2196f3', margin: '15px 0 5px 0' }}>
                {profileName}
              </div>
              <div style={{ color: '#bbb', fontSize: '1.1rem' }}>
                {t("dashboard.door_opens_at")}: <strong>{openTemp}°C</strong>
              </div>
              
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
              <div style={{ 
                marginTop: '20px', 
                padding: '15px', 
                background: 'rgba(0,0,0,0.2)', 
                borderRadius: '8px', 
                border: '1px solid #333' 
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={activeDevice?.bot?.autoMode || false}
                    onChange={(e) => {
                      const updatedDevices = config.devices.map((d: any) => {
                        if (d.id === activeDeviceId) {
                          return { ...d, bot: { ...d.bot, autoMode: e.target.checked } };
                        }
                        return d;
                      });
                      const updatedConfig = { ...config, devices: updatedDevices };
                      setConfig(updatedConfig);
                      if (window.electronAPI && window.electronAPI.saveConfig) {
                        window.electronAPI.saveConfig(updatedConfig);
                        toast.success(
                          e.target.checked 
                            ? t("dashboard.auto_mode.activated_toast") 
                            : t("dashboard.auto_mode.deactivated_toast")
                        );
                      }
                    }}
                    style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: '#4caf50' }}
                  />
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: activeDevice?.bot?.autoMode ? '#4caf50' : '#888' }}>
                    {activeDevice?.bot?.autoMode ? t("dashboard.auto_mode.status_on") : t("dashboard.auto_mode.status_off")}
                  </span>
                </label>
                <p style={{ margin: '5px 0 0 32px', fontSize: '0.85rem', color: '#666' }}>
                  {t("dashboard.auto_mode.description")}
                </p>
              </div>
            </div>

            {/* 3. Bambi Tür-Status Card */}
            <div className="card bambi-card">
              <h3>{t("dashboard.door_control")}</h3>
              <div
                className={`bambi-badge ${printerData.bambiState === "OFFEN" ? "open" : "closed"}`}
              >
                {/* NEU: Nutzen der Übersetzungs-Funktion */}
                {getDoorStateText(printerData.bambiState)}
              </div>
              <div className="actions" style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button 
                  onClick={() => window.electronAPI.sendSerial(activeDeviceId, "OPEN")}
                  style={{ flex: 1, padding: '10px', background: '#2a2a2e', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', transition: 'background 0.2s' }}
                >
                  🔓 {t("dashboard.open")}
                </button>
                <button 
                  onClick={() => window.electronAPI.sendSerial(activeDeviceId, "CLOSE")}
                  style={{ flex: 1, padding: '10px', background: '#2a2a2e', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', transition: 'background 0.2s' }}
                >
                  🔒 {t("dashboard.close")}
                </button>
              </div>
            </div>

            {/* 4. Statistik Card */}
            <div className="card stats-card">
              <h3>{t("dashboard.stats")}</h3>
              <div className="stat-value">{printerData.printedParts}</div>
              <div className="stat-label">{t("dashboard.parts_printed")}</div>
            </div>

          </div>
        )}

        {activeTab === "settings" && <Settings initialConfig={config} activeDeviceId={activeDeviceId} />}
        {activeTab === 'bot' && <BotConfig initialConfig={config} activeDeviceId={activeDeviceId} />}
        {activeTab === "gcode" && <GcodeGen initialConfig={config} activeDeviceId={activeDeviceId} />}
      </main>
    </div>
  );
};

export default App;