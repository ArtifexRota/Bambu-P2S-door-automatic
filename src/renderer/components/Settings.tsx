import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface MaterialProfile {
  id: string;
  name: string;
  openTemp: number;
}

interface SettingsProps {
  initialConfig: any;
}

const inputStyle = {
  background: '#2a2a2e',
  color: 'white',
  border: '1px solid #555',
  borderRadius: '4px',
  padding: '8px',
  width: '100%',
  boxSizing: 'border-box' as const
};

const labelStyle = {
  display: 'block',
  marginBottom: '5px',
  color: '#bbb',
  fontSize: '0.9rem'
};

const Settings: React.FC<SettingsProps> = ({ initialConfig }) => {
  // --- STATE: Verbindung ---
  const [ip, setIp] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [serialNum, setSerialNum] = useState('');
  const [comPort, setComPort] = useState('');

  // --- STATE: Hardware ---
  const [servoOpen, setServoOpen] = useState(0);
  const [servoClose, setServoClose] = useState(175);

  // --- STATE: Material Profile ---
  const [profiles, setProfiles] = useState<MaterialProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState('');

  // Lade die Daten beim Start
  useEffect(() => {
    if (initialConfig) {
      setIp(initialConfig.printer?.ip || '');
      setAccessCode(initialConfig.printer?.accessCode || '');
      setSerialNum(initialConfig.printer?.serial || '');
      setComPort(initialConfig.serial?.port || '');
      
      setServoOpen(initialConfig.servo?.open || 0);
      setServoClose(initialConfig.servo?.close || 175);

      // Falls schon Profile existieren, laden wir sie. Sonst Standard-Dummies.
      const loadedProfiles = initialConfig.materials?.profiles || [
        { id: '1', name: 'PLA', openTemp: 45 },
        { id: '2', name: 'ABS', openTemp: 80 },
        { id: '3', name: 'ASA', openTemp: 90 }
      ];
      setProfiles(loadedProfiles);
      setActiveProfileId(initialConfig.materials?.activeProfileId || loadedProfiles[0]?.id || '');
    }
  }, [initialConfig]);

  // --- FUNKTIONEN: Profile verwalten ---
  const addProfile = () => {
    const newProfile: MaterialProfile = {
      id: Date.now().toString(),
      name: `Neues Material`,
      openTemp: 50
    };
    setProfiles([...profiles, newProfile]);
  };

  const updateProfile = (id: string, field: keyof MaterialProfile, value: any) => {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeProfile = (id: string) => {
    setProfiles(profiles.filter(p => p.id !== id));
    if (activeProfileId === id) setActiveProfileId(''); // Reset active if deleted
  };

  // --- SPEICHERN ---
  const handleSave = () => {
    // Wir bauen das Objekt so auf, wie die main.ts es erwartet
    const updatedConfig = {
      ...initialConfig,
      printer: { ...initialConfig.printer, ip, accessCode, serial: serialNum },
      serial: { ...initialConfig.serial, port: comPort },
      servo: { ...initialConfig.servo, open: servoOpen, close: servoClose },
      materials: {
        activeProfileId,
        profiles
      }
    };

    if (window.electronAPI && window.electronAPI.saveConfig) {
      window.electronAPI.saveConfig(updatedConfig);
      toast.success("Einstellungen erfolgreich gespeichert!");
    }
  };

  return (
    <div className="card full-width" style={{ paddingBottom: '80px' }}>
      <h2>⚙️ Systemeinstellungen</h2>
      <p style={{ color: '#888', marginBottom: '30px' }}>
        Konfiguriere hier die Verbindung zum Drucker, die Hardware-Ports und deine Material-Profile.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '40px' }}>
        {/* LINKS: Verbindung */}
        <div style={{ background: '#1e1e24', padding: '20px', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px' }}>🔌 Verbindung</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>Drucker IP-Adresse</label>
            <input type="text" value={ip} onChange={e => setIp(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>Access Code</label>
            <input type="text" value={accessCode} onChange={e => setAccessCode(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>Seriennummer</label>
            <input type="text" value={serialNum} onChange={e => setSerialNum(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>ESP32 COM-Port</label>
            <input type="text" value={comPort} onChange={e => setComPort(e.target.value)} style={inputStyle} placeholder="z.B. COM100" />
          </div>
        </div>

        {/* RECHTS: Hardware */}
        <div style={{ background: '#1e1e24', padding: '20px', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px' }}>⚙️ Servo Kalibrierung</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>Winkel: Offen (0-180)</label>
            <input type="number" value={servoOpen} onChange={e => setServoOpen(Number(e.target.value))} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>Winkel: Geschlossen (0-180)</label>
            <input type="number" value={servoClose} onChange={e => setServoClose(Number(e.target.value))} style={inputStyle} />
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
            <button 
              onClick={() => window.electronAPI?.sendSerial('OPEN')}
              style={{ flex: 1, padding: '10px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}
            >
              Test Öffnen
            </button>
            <button 
              onClick={() => window.electronAPI?.sendSerial('CLOSE')}
              style={{ flex: 1, padding: '10px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}
            >
              Test Schließen
            </button>
          </div>
        </div>
      </div>

      {/* UNTEN: Material Profile */}
      <div style={{ background: '#1e1e24', padding: '20px', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>🧵 Material Profile (Auto-Öffnen)</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {profiles.map(profile => (
            <div key={profile.id} style={{ display: 'flex', gap: '15px', alignItems: 'center', background: '#2a2a2e', padding: '15px', borderRadius: '6px', border: activeProfileId === profile.id ? '2px solid #4caf50' : '2px solid transparent' }}>
              
              <input 
                type="radio" 
                name="activeProfile" 
                checked={activeProfileId === profile.id} 
                onChange={() => setActiveProfileId(profile.id)} 
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />

              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Material Name</label>
                <input type="text" value={profile.name} onChange={e => updateProfile(profile.id, 'name', e.target.value)} style={{ ...inputStyle, background: '#1e1e24' }} />
              </div>

              <div style={{ width: '150px' }}>
                <label style={labelStyle}>Tür auf ab (°C)</label>
                <input type="number" value={profile.openTemp} onChange={e => updateProfile(profile.id, 'openTemp', Number(e.target.value))} style={{ ...inputStyle, background: '#1e1e24' }} />
              </div>

              <button onClick={() => removeProfile(profile.id)} style={{ background: '#d32f2f', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', marginTop: '20px' }}>
                X
              </button>
            </div>
          ))}
        </div>

        <button onClick={addProfile} style={{ marginTop: '20px', padding: '10px 20px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          + Neues Profil
        </button>
      </div>

      {/* Floating Save Button */}
      <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 100 }}>
        <button 
          onClick={handleSave} 
          style={{ padding: '15px 30px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '50px', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
        >
          💾 Alles Speichern
        </button>
      </div>

    </div>
  );
};

export default Settings;