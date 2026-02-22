import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

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
      name: `Klick ${tasks.length + 1}`,
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
  const startCapture = (id: string) => {
    setCapturingId(id);
    let timeLeft = 3;
    setCountdown(timeLeft);

    const interval = setInterval(() => {
      timeLeft -= 1;
      setCountdown(timeLeft);

      if (timeLeft === 0) {
        clearInterval(interval);
        setCapturingId(null);

        // Globale Position über Electron abfragen
        if (window.electronAPI && window.electronAPI.getCursorPosition) {
          window.electronAPI.getCursorPosition().then((pos: {x: number, y: number}) => {
            updateTask(id, 'x', pos.x);
            updateTask(id, 'y', pos.y);
          });
        }
      }
    }, 1000);
  };

  return (
    <div className="card full-width">
      <h2>🤖 Bot Klick-Sequenz</h2>
      <p style={{ color: '#888', marginBottom: '20px' }}>
        Lege beliebig viele Klicks an. Drücke auf "Erfassen" und bewege die Maus innerhalb von 3 Sekunden an die gewünschte Stelle auf dem Bildschirm.
      </p>

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
              {capturingId === task.id ? `Warte ${countdown}s...` : '📍 Position erfassen'}
            </button>

            <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginLeft: 'auto' }}>
              <span>Warten (Sek):</span>
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
          + Neuen Klick hinzufügen
        </button>

        <button
  onClick={() => {
    if (window.electronAPI && window.electronAPI.saveBotSequence) {
      window.electronAPI.saveBotSequence(tasks);
      toast.success("Sequenz gespeichert!");
    }
  }}
  style={{ padding: '10px 20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
>
  💾 Sequenz Speichern
</button>
<button
          onClick={() => {
            if (window.electronAPI && window.electronAPI.startBot) {
              toast('Bot Testlauf gestartet...', { icon: '🤖' });
              window.electronAPI.startBot();
            }
          }}
          style={{ padding: '10px 20px', background: '#e6a800', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: 'auto' }}
        >
          🎯 Sequenz testen
        </button>
      </div>
    </div>
  );
};

export default BotConfig;