import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../hooks/useTranslation';

interface MaterialProfile {
  id: string;
  name: string;
  openTemp: number;
}

interface SettingsProps {
  initialConfig: any;
  activeDeviceId: string;
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

const Settings: React.FC<SettingsProps> = ({ initialConfig, activeDeviceId }) => {
  const { t } = useTranslation();
  
  const [deviceName, setDeviceName] = useState('');
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
      const device = initialConfig.devices?.find((d: any) => d.id === activeDeviceId) || initialConfig.devices?.[0];
      if (device) {
        setDeviceName(device.name || '');
        setIp(device.printer?.ip || '');
        setAccessCode(device.printer?.accessCode || '');
        setSerialNum(device.printer?.serial || '');
        setComPort(device.serial?.port || '');
        setServoOpen(device.servo?.open || 0);
        setServoClose(device.servo?.close || 175);
        setActiveProfileId(device.activeProfileId || '');
      }

      const loadedProfiles = initialConfig.materials?.profiles || [
        { id: '1', name: 'PLA', openTemp: 45 },
        { id: '2', name: 'ABS', openTemp: 80 },
        { id: '3', name: 'ASA', openTemp: 90 }
      ];
      setProfiles(loadedProfiles);
      // Fallback falls der Drucker noch keins hat
      if (device && !device.activeProfileId && loadedProfiles.length > 0) {
          setActiveProfileId(loadedProfiles[0].id);
      }
    }
  }, [initialConfig, activeDeviceId]);

  // --- FUNKTIONEN: Profile verwalten ---
  const addProfile = () => {
    const newProfile: MaterialProfile = {
      id: Date.now().toString(),
      name: t("settings.materials.new_profile"),
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
    const updatedDevices = (initialConfig.devices || []).map((d: any) => {
      if (d.id === activeDeviceId) {
        return {
          ...d,
          name: deviceName,
          activeProfileId,
          printer: { ...d.printer, ip, accessCode, serial: serialNum },
          serial: { ...d.serial, port: comPort },
          servo: { ...d.servo, open: servoOpen, close: servoClose }
        };
      }
      return d;
    });

    const updatedConfig = {
      ...initialConfig,
      devices: updatedDevices,
      materials: {
        profiles
      }
    };

    if (window.electronAPI && window.electronAPI.saveConfig) {
      window.electronAPI.saveConfig(updatedConfig);
      toast.success(t("settings.success"));

      setTimeout(() => {
        if (window.electronAPI.requestConfig) {
          window.electronAPI.requestConfig();
        }
      }, 250); 
    }
  };

  const addNewPrinter = () => {
    const newId = Date.now().toString();
    const newDevice = {
      id: newId,
      name: `Drucker ${(initialConfig.devices?.length || 0) + 1}`,
      printer: { ip: "192.168.X.X", accessCode: "", serial: "" },
      serial: { port: "COM3", baudRate: 115200 },
      servo: { open: 0, close: 175 },
      bot: {
        closeDelayMs: 20000,
        mode: "stop",
        currentSequenceIndex: 0,
        sequences: [[]]
      }
    };
    
    const updatedConfig = {
      ...initialConfig,
      devices: [...(initialConfig.devices || []), newDevice]
    };
    
    if (window.electronAPI && window.electronAPI.saveConfig) {
      window.electronAPI.saveConfig(updatedConfig);
      toast.success("Neuer Drucker hinzugefügt!");
      setTimeout(() => {
        if (window.electronAPI.requestConfig) {
          window.electronAPI.requestConfig();
        }
      }, 250); 
    }
  };

  const deleteCurrentPrinter = () => {
    if ((initialConfig.devices || []).length <= 1) {
      toast.error("Du kannst nicht den letzten Drucker löschen!");
      return;
    }
    
    if (!window.confirm(`Möchtest du "${deviceName}" wirklich löschen?`)) return;

    const updatedDevices = (initialConfig.devices || []).filter((d: any) => d.id !== activeDeviceId);
    const updatedConfig = {
      ...initialConfig,
      devices: updatedDevices
    };

    if (window.electronAPI && window.electronAPI.saveConfig) {
      window.electronAPI.saveConfig(updatedConfig);
      toast.success("Drucker gelöscht!");
      setTimeout(() => {
        if (window.electronAPI.requestConfig) {
          window.electronAPI.requestConfig();
        }
      }, 250); 
    }
  };

  return (
    <div className="card full-width" style={{ paddingBottom: '80px' }}>
      <h2>⚙️ {t("settings.title")}</h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <p style={{ color: '#888', margin: 0 }}>
          {t("settings.description")}
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={addNewPrinter}
            style={{ padding: '8px 16px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ➕ {t("settings.add_printer") || "Neuen Drucker"}
          </button>
          <button 
            onClick={deleteCurrentPrinter}
            style={{ padding: '8px 16px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            🗑️ {t("settings.delete_printer") || "Drucker löschen"}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '40px' }}>
        {/* LINKS: Verbindung */}
        <div style={{ background: '#1e1e24', padding: '20px', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px' }}>🔌 {t("settings.connection.title")}</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>{t("settings.device_name") || "Drucker Name"}</label>
            <input type="text" value={deviceName} onChange={e => setDeviceName(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>{t("settings.connection.ip")}</label>
            <input type="text" value={ip} onChange={e => setIp(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>{t("settings.connection.access_code")}</label>
            <input type="text" value={accessCode} onChange={e => setAccessCode(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>{t("settings.connection.serial")}</label>
            <input type="text" value={serialNum} onChange={e => setSerialNum(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>{t("settings.connection.com_port")}</label>
            <input type="text" value={comPort} onChange={e => setComPort(e.target.value)} style={inputStyle} placeholder="z.B. COM100" />
          </div>
        </div>

        {/* RECHTS: Hardware */}
        <div style={{ background: '#1e1e24', padding: '20px', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px' }}>⚙️ {t("settings.servo.title")}</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>{t("settings.servo.open_angle")}</label>
            <input type="number" value={servoOpen} onChange={e => setServoOpen(Number(e.target.value))} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>{t("settings.servo.close_angle")}</label>
            <input type="number" value={servoClose} onChange={e => setServoClose(Number(e.target.value))} style={inputStyle} />
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
            <button 
              onClick={() => window.electronAPI?.sendSerial(activeDeviceId, 'OPEN')}
              style={{ flex: 1, padding: '10px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}
            >
              {t("settings.servo.test_open")}
            </button>
            <button 
              onClick={() => window.electronAPI?.sendSerial(activeDeviceId, 'CLOSE')}
              style={{ flex: 1, padding: '10px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}
            >
              {t("settings.servo.test_close")}
            </button>
          </div>
        </div>
      </div>

      {/* UNTEN: Material Profile */}
      <div style={{ background: '#1e1e24', padding: '20px', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>🧵 {t("settings.materials.title")}</h3>
        
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
                <label style={labelStyle}>{t("settings.materials.name")}</label>
                <input type="text" value={profile.name} onChange={e => updateProfile(profile.id, 'name', e.target.value)} style={{ ...inputStyle, background: '#1e1e24' }} />
              </div>

              <div style={{ width: '150px' }}>
                <label style={labelStyle}>{t("settings.materials.open_temp")}</label>
                <input type="number" value={profile.openTemp} onChange={e => updateProfile(profile.id, 'openTemp', Number(e.target.value))} style={{ ...inputStyle, background: '#1e1e24' }} />
              </div>

              <button onClick={() => removeProfile(profile.id)} style={{ background: '#d32f2f', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', marginTop: '20px' }}>
                X
              </button>
            </div>
          ))}
        </div>

        <button onClick={addProfile} style={{ marginTop: '20px', padding: '10px 20px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          {t("settings.materials.add")}
        </button>
      </div>

      {/* Floating Save Button */}
      <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 100 }}>
        <button 
          onClick={handleSave} 
          style={{ padding: '15px 30px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '50px', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
        >
          💾 {t("settings.save_all")}
        </button>
      </div>

    </div>
  );
};

export default Settings;