import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../hooks/useTranslation';

// Struktur für einen einzelnen Klick-Auftrag
interface ClickTask {
  id: string;
  name: string;
  x: number;
  y: number;
  delaySeconds: number;
}

// NEU: Wir definieren, dass die Komponente Startdaten empfangen kann
interface BotConfigProps {
  initialSequence?: ClickTask[];
}

const BotConfig: React.FC<BotConfigProps> = ({ initialSequence = [] }) => {
  const { t } = useTranslation();
  // Wir nutzen die Startdaten, falls vorhanden. Sonst leeres Array [].
  const [tasks, setTasks] = useState<ClickTask[]>(initialSequence);
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  // NEU: Falls die Daten aus der App.tsx einen Moment länger brauchen
  useEffect(() => {
    if (initialSequence && initialSequence.length > 0) {
      setTasks(initialSequence);
    }
  }, [initialSequence]);

  // Fügt einen neuen, leeren Klick zur Liste hinzu
  const addTask = () => {
    const newTask: ClickTask = {
      id: Date.now().toString(),
      name: `${t("bot.click_name")} ${tasks.length + 1}`,
      x: 0,
      y: 0,
      delaySeconds: 2 // Standardwert: 2 Sekunden
    };
    setTasks([...tasks, newTask]);
  };

  // Löscht einen Klick
  const removeTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  // Aktualisiert einen bestimmten Wert eines Klicks
  const updateTask = (id: string, field: keyof ClickTask, value: any) => {
    setTasks(prevTasks => prevTasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // Die Countdown-Logik zum Erfassen der Maus
  const startCapture = async (id: string) => {
    setCapturingId(id);
    
    // Kurze Info für den Nutzer
    toast(t("bot.capture_instruction"), { icon: '⌨️', duration: 4000 });

    if (window.electronAPI && window.electronAPI.captureCursorWithHotkey) {
      // Die App pausiert hier quasi und wartet, bis der Nutzer F8 drückt!
      const pos = await window.electronAPI.captureCursorWithHotkey();
      
      updateTask(id, 'x', pos.x);
      updateTask(id, 'y', pos.y);
      setCapturingId(null); // Button wieder normal machen
      toast.success(t("bot.capture_success"));
    }
  };

  return (
    <div className="card full-width">
      <h2>🤖 {t("bot.title")}</h2>
      <p style={{ color: '#888', marginBottom: '15px' }}>
        {t("bot.description")}
      </p>

      {/* NEU: Ausklappbarer Info-Kasten */}
      <details style={{ 
        background: '#1e1e24', 
        padding: '12px 15px', 
        borderRadius: '8px', 
        marginBottom: '20px', 
        border: '1px solid #333',
        transition: 'all 0.3s ease'
      }}>
        <summary style={{ 
          cursor: 'pointer', 
          fontWeight: 'bold', 
          color: '#2196f3', 
          outline: 'none',
          userSelect: 'none'
        }}>
          {t("bot.info_title")}
        </summary>
        <ul style={{ 
          marginTop: '12px', 
          color: '#bbb', 
          lineHeight: '1.6', 
          paddingLeft: '20px',
          fontSize: '0.95rem'
        }}>
          <li>{t("bot.info_fullscreen")}</li>
          <li>{t("bot.info_taskbar")}</li>
          <li>{t("bot.info_taskbar_hide")}</li>
          <li>{t("bot.info_scaling")}</li>
        </ul>
      </details>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {tasks.map((task) => (
          <div key={task.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#1e1e24', padding: '15px', borderRadius: '8px' }}>
            
            <input 
              type="text" 
              value={task.name} 
              onChange={(e) => updateTask(task.id, 'name', e.target.value)}
              style={{ width: '120px', background: '#2a2a2e', color: 'white', border: '1px solid #555', borderRadius: '4px', padding: '5px' }}
            />

            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              <span>X:</span>
              <input 
                type="number" 
                value={task.x} 
                readOnly 
                style={{ width: '70px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', padding: '5px' }} 
              />
              <input 
                type="number" 
                value={task.y} 
                readOnly 
                style={{ width: '70px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', padding: '5px' }} 
              />
            </div>

            <button 
              onClick={() => startCapture(task.id)}
              disabled={capturingId !== null}
              style={{ background: capturingId === task.id ? '#e6a800' : '#4caf50', cursor: 'pointer' }}
            >
              {capturingId === task.id ? `⏳ ${t("bot.waiting_for_hotkey")}` : `📍 ${t("bot.capture")}`}
            </button>

            <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginLeft: 'auto' }}>
              <span>{t("bot.delay")}:</span>
              <input 
                type="number" 
                value={task.delaySeconds} 
                onChange={(e) => updateTask(task.id, 'delaySeconds', Number(e.target.value))}
                min="0"
                step="0.5"
                style={{ width: '70px', background: '#2a2a2e', color: 'white', border: '1px solid #555', borderRadius: '4px', padding: '5px' }}
              />
            </div>

            <button onClick={() => removeTask(task.id)} style={{ background: '#d32f2f', padding: '8px 12px' }}>
              X
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button onClick={addTask} style={{ padding: '10px 20px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          {t("bot.add_click")}
        </button>

        <button 
          onClick={() => {
            if (window.electronAPI && window.electronAPI.saveBotSequence) {
              window.electronAPI.saveBotSequence(tasks);
              toast.success(t("bot.success"));
            }
          }} 
          style={{ padding: '10px 20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          💾 {t("bot.save_sequence")}
        </button>
        <button 
          onClick={() => {
            if (window.electronAPI && window.electronAPI.startBot) {
              toast(t("bot.running"), { icon: '🤖' });
              window.electronAPI.startBot();
            }
          }} 
          style={{ padding: '10px 20px', background: '#e6a800', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: 'auto' }}
        >
          🎯 {t("bot.test_sequence")}
        </button>
      </div>
    </div>
  );
};

export default BotConfig;