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

interface BotConfigProps {
  initialConfig: any;
  activeDeviceId: string;
}

const BotConfig: React.FC<BotConfigProps> = ({ initialConfig, activeDeviceId }) => {
  const { t } = useTranslation();
  
  const [sequences, setSequences] = useState<ClickTask[][]>([[]]);
  const [mode, setMode] = useState<'loop' | 'stop'>('stop');
  const [activeSeqIndex, setActiveSeqIndex] = useState(0);

  const [capturingId, setCapturingId] = useState<string | null>(null);

  useEffect(() => {
    if (initialConfig) {
      const device = initialConfig.devices?.find((d: any) => d.id === activeDeviceId);
      if (device && device.bot) {
        setSequences(device.bot.sequences && device.bot.sequences.length > 0 ? device.bot.sequences : [[]]);
        setMode(device.bot.mode || 'stop');
        setActiveSeqIndex(0);
      }
    }
  }, [initialConfig, activeDeviceId]);

  const addSequence = () => {
    setSequences([...sequences, []]);
    setActiveSeqIndex(sequences.length);
  };

  const removeSequence = (index: number) => {
    if (sequences.length <= 1) {
      toast.error(t("bot.seq_min_error"));
      return;
    }
    const newSeqs = sequences.filter((_, i) => i !== index);
    setSequences(newSeqs);
    if (activeSeqIndex >= newSeqs.length) {
      setActiveSeqIndex(newSeqs.length - 1);
    }
  };

  const addTask = () => {
    const newTask: ClickTask = {
      id: Date.now().toString(),
      name: `Klick ${sequences[activeSeqIndex].length + 1}`,
      x: 0,
      y: 0,
      delaySeconds: 2
    };
    const newSeqs = [...sequences];
    newSeqs[activeSeqIndex] = [...newSeqs[activeSeqIndex], newTask];
    setSequences(newSeqs);
  };

  const removeTask = (id: string) => {
    const newSeqs = [...sequences];
    newSeqs[activeSeqIndex] = newSeqs[activeSeqIndex].filter(t => t.id !== id);
    setSequences(newSeqs);
  };

  const updateTask = (id: string, field: keyof ClickTask, value: any) => {
    setSequences(prevSeqs => {
      const newSeqs = [...prevSeqs];
      newSeqs[activeSeqIndex] = newSeqs[activeSeqIndex].map(t => t.id === id ? { ...t, [field]: value } : t);
      return newSeqs;
    });
  };

  // Die Countdown-Logik zum Erfassen der Maus
  const startCapture = async (id: string) => {
    if (capturingId === id) {
      if (window.electronAPI && window.electronAPI.cancelCaptureCursor) {
        window.electronAPI.cancelCaptureCursor();
      }
      setCapturingId(null);
      toast.error("Erfassung abgebrochen.");
      return;
    }

    setCapturingId(id);
    
    // Kurze Info für den Nutzer
    toast(t("bot.capture_instruction"), { icon: '⌨️', duration: 4000 });

    if (window.electronAPI && window.electronAPI.captureCursorWithHotkey) {
      // Die App pausiert hier quasi und wartet, bis der Nutzer F8 drückt!
      const pos = await window.electronAPI.captureCursorWithHotkey();
      if (pos) {
        updateTask(id, 'x', pos.x);
        updateTask(id, 'y', pos.y);
        toast.success(t("bot.capture_success"));
      }
      setCapturingId(null); // Button wieder normal machen
    }
  };

  return (
    <div className="card full-width">
      <h2>🤖 {t("bot.title")}</h2>
      <p style={{ color: '#888', marginBottom: '15px' }}>
        {t("bot.multi_seq_desc") || "Hier kannst du mehrere Sequenzen anlegen, die der Bot für jeden neuen Druck nacheinander abarbeitet."}
      </p>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center' }}>
        <label style={{ color: '#fff', fontWeight: 'bold' }}>{t("bot.after_last_seq") || "Nach der letzten Sequenz:"}</label>
        <select 
          value={mode} 
          onChange={e => setMode(e.target.value as 'loop' | 'stop')}
          style={{ background: '#2a2a2e', color: 'white', border: '1px solid #555', padding: '8px', borderRadius: '4px' }}
        >
          <option value="stop">{t("bot.mode_stop") || "Bot stoppen"}</option>
          <option value="loop">{t("bot.mode_loop") || "Von vorne beginnen (Loop)"}</option>
        </select>
      </div>

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

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {sequences.map((_, idx) => (
          <button 
            key={idx}
            onClick={() => setActiveSeqIndex(idx)}
            style={{ 
              padding: '10px 20px', 
              background: activeSeqIndex === idx ? '#2196f3' : '#2a2a2e', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer' 
            }}
          >
            {t("bot.sequence")} {idx + 1}
          </button>
        ))}
        <button onClick={addSequence} style={{ padding: '10px 15px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          {t("bot.add_sequence") || "+ Neue Sequenz"}
        </button>
      </div>

      <div style={{ background: '#1e1e24', padding: '20px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>{t("bot.sequence")} {activeSeqIndex + 1} {t("bot.config_sequence")}</h3>
          <button onClick={() => removeSequence(activeSeqIndex)} style={{ background: '#d32f2f', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>
            {t("bot.delete_sequence") || "Sequenz löschen"}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {sequences[activeSeqIndex].length === 0 && (
            <p style={{ color: '#888' }}>{t("bot.empty_sequence") || "Keine Klicks in dieser Sequenz."}</p>
          )}
          {sequences[activeSeqIndex].map((task) => (
            <div key={task.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#2a2a2e', padding: '15px', borderRadius: '8px' }}>
            
            <input 
              type="text" 
                value={task.name} 
                onChange={(e) => updateTask(task.id, 'name', e.target.value)}
                style={{ width: '120px', background: '#1e1e24', color: 'white', border: '1px solid #555', borderRadius: '4px', padding: '5px' }}
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
              disabled={capturingId !== null && capturingId !== task.id}
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
                style={{ width: '70px', background: '#1e1e24', color: 'white', border: '1px solid #555', borderRadius: '4px', padding: '5px' }}
              />
            </div>

            <button onClick={() => removeTask(task.id)} style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>
              X
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
        <button onClick={addTask} style={{ padding: '10px 20px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          {t("bot.add_click")}
        </button>
        
        <button 
          onClick={() => {
            if (window.electronAPI && window.electronAPI.testBotSequence) {
              toast(t("bot.running"), { icon: '🤖' });
              window.electronAPI.testBotSequence(sequences[activeSeqIndex]);
            }
          }} 
          disabled={sequences[activeSeqIndex].length === 0}
          style={{ padding: '10px 20px', background: sequences[activeSeqIndex].length === 0 ? '#555' : '#e6a800', color: sequences[activeSeqIndex].length === 0 ? '#aaa' : '#000', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: sequences[activeSeqIndex].length === 0 ? 'not-allowed' : 'pointer', marginLeft: 'auto' }}
        >
          🎯 {t("bot.sequence")} {activeSeqIndex + 1} {t("bot.test_sequence_btn") || "testen"}
        </button>
      </div>
    </div>

    <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 100 }}>
      <button 
        onClick={() => {
          if (window.electronAPI && window.electronAPI.saveBotSequence) {
            window.electronAPI.saveBotSequence(activeDeviceId, sequences, mode);
            toast.success(t("bot.success"));
          }
        }} 
        style={{ padding: '15px 30px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '50px', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
      >
        💾 {t("bot.save_sequence") || "Alles Speichern"}
      </button>
    </div>
    </div>
  );
};

export default BotConfig;