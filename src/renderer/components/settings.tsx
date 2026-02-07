import React, { useState } from "react";

interface SettingsProps {
  initialConfig: any;
}

const Settings: React.FC<SettingsProps> = ({ initialConfig }) => {
  const [localConfig, setLocalConfig] = useState({
    servoOpen: initialConfig?.servoOpen || 0,
    servoClose: initialConfig?.servoClose || 175,
    clickDelay: initialConfig?.clickDelay || 1500,
    posTaskbar: initialConfig?.posTaskbar || "0,0",
    posPrint: initialConfig?.posPrint || "0,0",
  });

  const handleSave = () => {
    if (window.electronAPI) {
      window.electronAPI.saveConfig(localConfig);
      // Optional: Ein schöneres Feedback als alert wäre später cool
      alert("Einstellungen gespeichert!");
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-grid">
        {/* SERVO CARD */}
        <div className="card">
          <h2 className="card-title">🛠️ Servo Justierung</h2>
          <div className="input-group">
            <label>Öffnungswinkel (°)</label>
            <div className="input-with-button">
              <input
                type="number"
                value={localConfig.servoOpen}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    servoOpen: parseInt(e.target.value) || 0,
                  })
                }
              />
              <button
                onClick={() =>
                  window.electronAPI.sendSerial(`GOTO:${localConfig.servoOpen}`)
                }
              >
                Test
              </button>
            </div>
          </div>
          <div className="input-group">
            <label>Schließwinkel (°)</label>
            <div className="input-with-button">
              <input
                type="number"
                value={localConfig.servoClose}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    servoClose: parseInt(e.target.value) || 0,
                  })
                }
              />
              <button
                onClick={() =>
                  window.electronAPI.sendSerial(
                    `GOTO:${localConfig.servoClose}`,
                  )
                }
              >
                Test
              </button>
            </div>
          </div>
        </div>

        {/* BOT CARD */}
        <div className="card">
          <h2 className="card-title">🤖 Bot & Klicks</h2>
          <div className="input-group">
            <label>Verzögerung (ms)</label>
            <input
              type="number"
              value={localConfig.clickDelay}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  clickDelay: parseInt(e.target.value) || 0,
                })
              }
            />
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>Taskbar X,Y</label>
              <input
                type="text"
                value={localConfig.posTaskbar}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, posTaskbar: e.target.value })
                }
              />
            </div>
            <div className="input-group">
              <label>Print X,Y</label>
              <input
                type="text"
                value={localConfig.posPrint}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, posPrint: e.target.value })
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="settings-footer">
        <button className="save-button" onClick={handleSave}>
          Konfiguration speichern
        </button>
      </div>
    </div>
  );
};

export default Settings;
