import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../hooks/useTranslation';

interface GcodeGenProps {
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
  fontSize: '0.9rem',
  fontWeight: 'bold'
};

const detailsStyle = {
  background: '#333',
  padding: '10px',
  borderRadius: '6px',
  marginTop: '8px',
  fontSize: '0.85rem',
  color: '#bbb',
  borderLeft: '3px solid #2196f3'
};

const summaryStyle = {
  cursor: 'pointer',
  color: '#2196f3',
  fontWeight: 'bold',
  outline: 'none'
};

const GcodeGen: React.FC<GcodeGenProps> = ({ initialConfig, activeDeviceId }) => {
  const { t } = useTranslation();
  const [doorOpenTemp, setDoorOpenTemp] = useState<number | ''>('');
  const warningTemp = doorOpenTemp !== '' ? Number(doorOpenTemp) - 4 : '';
  const [tempWait2, setTempWait2] = useState<number | ''>('');
  const actualPushTemp = tempWait2 !== '' ? Number(tempWait2) - 5 : '';
  const [pushCoordinates, setPushCoordinates] = useState<{x: number | '', z: number | ''}[]>([{x: '', z: ''}]);

  // New states for the Bender feature
  const [useHooks, setUseHooks] = useState(false);
  const [hookZ, setHookZ] = useState<number | ''>('');
  const [hookZRelease, setHookZRelease] = useState<number | ''>('');

  useEffect(() => {
    if (initialConfig && activeDeviceId) {
      const device = initialConfig.devices?.find((d: any) => d.id === activeDeviceId);
      if (device && device.gcodeSettings) {
        setDoorOpenTemp(device.gcodeSettings.doorOpenTemp ?? '');
        setTempWait2(device.gcodeSettings.tempWait2 ?? '');
        if (device.gcodeSettings.pushCoordinates) {
          setPushCoordinates(device.gcodeSettings.pushCoordinates);
        } else if (device.gcodeSettings.pushX !== undefined && device.gcodeSettings.pushZ !== undefined) {
          setPushCoordinates([{x: device.gcodeSettings.pushX, z: device.gcodeSettings.pushZ}]);
        } else {
          setPushCoordinates([{x: '', z: ''}]);
        }
        setUseHooks(device.gcodeSettings.useHooks ?? false);
        setHookZ(device.gcodeSettings.hookZ ?? '');
        setHookZRelease(device.gcodeSettings.hookZRelease ?? '');
      } else {
        setDoorOpenTemp('');
        setTempWait2('');
        setPushCoordinates([{x: '', z: ''}]);
        setUseHooks(false);
        setHookZ('');
        setHookZRelease('');
      }
    }
  }, [initialConfig, activeDeviceId]);

  const saveSettings = () => {
    const hasEmptyPush = pushCoordinates.some(p => p.x === '' || p.z === '');
    if (doorOpenTemp === '' || tempWait2 === '' || hasEmptyPush) {
      toast.error(t("gcode.missing_values_error") || "Bitte fülle alle leeren Felder aus!");
      return false;
    }
    if (useHooks && (hookZ === '' || hookZRelease === '')) {
      toast.error(t("gcode.missing_values_error") || "Bitte fülle alle leeren Felder aus!");
      return false;
    }

    const updatedDevices = initialConfig.devices.map((d: any) => {
      if (d.id === activeDeviceId) {
        return {
          ...d,
          gcodeSettings: {
            doorOpenTemp, tempWait2, pushCoordinates, useHooks, hookZ, hookZRelease
          }
        };
      }
      return d;
    });
    const updatedConfig = { ...initialConfig, devices: updatedDevices };
    if (window.electronAPI && (window.electronAPI as any).saveConfig) {
      (window.electronAPI as any).saveConfig(updatedConfig);
    }
    return true;
  };

  const generateGcode = () => {
    let gcode = `;========= BAMBI AUTOMATION START=========
M104 S0 ; turn off hotend
M106 P2 S255 ; Fan Speed 100%
M106 P3 S255
M190 S${warningTemp} ; Wait for intermediate temp (Warning)

;=====Door open Warning sound start=====
M17
M400 S1
M1006 S1
M1006 A53 B10 L50 C53 D10 M50 E53 F10 N50 
M1006 A57 B10 L50 C57 D10 M50 E57 F10 N50 
M1006 A0 B15 L0 C0 D15 M0 E0 F15 N0 
M1006 A53 B10 L50 C53 D10 M50 E53 F10 N50 
M1006 A57 B10 L50 C57 D10 M50 E57 F10 N50 
M1006 A0 B15 L0 C0 D15 M0 E0 F15 N0 
M1006 A48 B10 L50 C48 D10 M50 E48 F10 N50 
M1006 A0 B15 L0 C0 D15 M0 E0 F15 N0 
M1006 A60 B10 L50 C60 D10 M50 E60 F10 N50 
M1006 W
;=====Door open warning sound end=====

;===Wait for Part Push Temp===
G90
M400
M190 S${actualPushTemp} ; Wait for push temp
M190 S${actualPushTemp} ; Double check temp
;===now cool===
`;

    if (useHooks) {
      gcode += `
;=========Bender (5x)=========
G90
`;
      for (let i = 1; i <= 5; i++) {
        gcode += `G1 Z${hookZ} F600 ; ${i}. Mal in die Bender biegen
G1 Z${hookZRelease} F600 ; Wieder hochfahren zum Entspannen
`;
      }
      gcode += `;===Bender End===
`;
    }

    gcode += `
;=========Pushing Print=========
`;
    
    pushCoordinates.forEach((coord, idx) => {
      gcode += `;--- Push ${idx + 1} ---
G1 Z${coord.z} F600 ; Bed height to push level
G1 X${coord.x} Y250 F6000 ; Head to target X position
G1 Y5 F3000 ; push out print
G1 Y50 F6000 ; get out
`;
    });

    const lastX = pushCoordinates.length > 0 ? pushCoordinates[pushCoordinates.length - 1].x : 100;
    
    gcode += `
G1 Z20 F600 ; Move bed back up to Z20
G1 X${lastX} Y20 F6000 ; Park toolhead safely out of the way
;===Push end===
M106 P2 S0
M106 P3 S0
;=========BAMBI AUTOMATION ENDE=========`;

    return gcode;
  };

  const copyToClipboard = () => {
    if (!saveSettings()) return; // save and validate before copying
    navigator.clipboard.writeText(generateGcode());
    toast.success(t("gcode.copied"));
  };

  return (
    <div className="card full-width" style={{ paddingBottom: '40px' }}>
      <h2>📄 {t("gcode.title")}</h2>
      <p style={{ color: '#888', marginBottom: '30px' }}>
        {t("gcode.description")}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        
        {/* LINKS: Die Eingabefelder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ background: '#1e1e24', padding: '20px', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#fff' }}>🌡️ {t("gcode.temps.title")}</h3>
            
            <div style={{ marginBottom: '20px' }}>
  <label style={labelStyle}>{t("gcode.temps.door_temp")}</label>
  <input 
    type="number" 
    value={doorOpenTemp} 
    onChange={(e) => setDoorOpenTemp(e.target.value === '' ? '' : Number(e.target.value))} 
    style={inputStyle} 
  />
  
  {/* Hier ist die transparente Magie: */}
  <div style={{ background: '#333', padding: '10px', borderRadius: '4px', marginTop: '8px', borderLeft: '3px solid #e6a800' }}>
    <p style={{ margin: 0, color: '#e6a800', fontSize: '0.85rem', fontWeight: 'bold' }}>
      {t("gcode.temps.warning_sound")}: {warningTemp}°C
    </p>
    <p style={{ margin: '5px 0 0 0', color: '#bbb', fontSize: '0.8rem' }}>
      {t("gcode.temps.auto_calc")}
    </p>
  </div>
</div>

            <div>
              <label style={labelStyle}>{t("gcode.temps.push_temp")}</label>
              <input type="number" value={tempWait2} onChange={(e) => setTempWait2(e.target.value === '' ? '' : Number(e.target.value))} style={inputStyle} />
              
              <div style={{ background: '#333', padding: '10px', borderRadius: '4px', marginTop: '8px', borderLeft: '3px solid #e6a800' }}>
                <p style={{ margin: 0, color: '#e6a800', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  {t("gcode.temps.auto_calc_push")}: {actualPushTemp !== '' ? actualPushTemp : ''}°C
                </p>
                <p style={{ margin: '5px 0 0 0', color: '#bbb', fontSize: '0.8rem' }}>
                  {t("gcode.temps.auto_calc_push_text")}
                </p>
              </div>
            </div>
          </div>

          <div style={{ background: '#1e1e24', padding: '20px', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#fff' }}>🎯 {t("gcode.position.title")}</h3>
            
            {pushCoordinates.map((coord, index) => (
              <div key={index} style={{ marginBottom: '20px', background: '#2a2a2e', padding: '15px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, color: '#2196f3' }}>Push {index + 1}</h4>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {pushCoordinates.length > 1 && (
                      <button 
                        onClick={() => {
                          const newCoords = [...pushCoordinates];
                          newCoords.splice(index, 1);
                          setPushCoordinates(newCoords);
                        }}
                        style={{ background: '#d32f2f', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        🗑️
                      </button>
                    )}
                    {index === pushCoordinates.length - 1 && (
                      <button 
                        onClick={() => setPushCoordinates([...pushCoordinates, {x: '', z: ''}])}
                        style={{ background: '#4caf50', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        + Push
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>{t("gcode.position.start_x")} (X)</label>
                    <input 
                      type="number" 
                      value={coord.x} 
                      onChange={(e) => {
                        const newCoords = [...pushCoordinates];
                        newCoords[index].x = e.target.value === '' ? '' : Number(e.target.value);
                        setPushCoordinates(newCoords);
                      }} 
                      style={inputStyle} 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>{t("gcode.position.push_z")} (Z)</label>
                    <input 
                      type="number" 
                      value={coord.z} 
                      onChange={(e) => {
                        const newCoords = [...pushCoordinates];
                        newCoords[index].z = e.target.value === '' ? '' : Number(e.target.value);
                        setPushCoordinates(newCoords);
                      }} 
                      style={inputStyle} 
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <details style={detailsStyle}>
              <summary style={summaryStyle}>ℹ️ Mehrere Objekte schieben</summary>
              <p style={{ margin: '8px 0 0 0' }}>
                Du kannst beliebig viele Pushes anlegen. Der Drucker fährt dann Teil für Teil ab, passt jeweils die Z-Höhe an und schiebt bei der entsprechenden X-Position aus.
              </p>
            </details>
            
            {/* NEW BENDER SECTION */}
            <div style={{ background: '#2a2a2e', padding: '15px', borderRadius: '6px', borderLeft: useHooks ? '4px solid #4caf50' : '4px solid transparent' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', ...labelStyle, marginBottom: 0 }}>
                <input 
                  type="checkbox" 
                  checked={useHooks} 
                  onChange={(e) => setUseHooks(e.target.checked)} 
                  style={{ width: '18px', height: '18px' }}
                />
                {t("gcode.hook.toggle") || "Hook Bending aktivieren (Platte biegen)"}
              </label>
              
              {useHooks && (
                <div style={{ marginTop: '15px' }}>
                  <div style={{ background: '#333', borderLeft: '4px solid #ff9800', padding: '15px', borderRadius: '4px', marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#fff' }}>⚠️ {t("gcode.hook.warning_title") || "Wichtig: Einstellungen anpassen!"}</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#bbb', fontSize: '0.85rem' }}>
                      <li style={{ marginBottom: '8px' }}>
                        <strong>{t("gcode.hook.warning_height_title") || "Druckhöhe reduzieren:"}</strong> {t("gcode.hook.warning_height_desc") || "Verringere die maximale Druckhöhe (Printable height) in den Druckereinstellungen um die exakte Länge der montierten Haken."}
                      </li>
                      <li>
                        <strong>{t("gcode.hook.warning_startcode_title") || "Start-Gcode prüfen:"}</strong> {t("gcode.hook.warning_startcode_desc") || "Achtung: Das Ändern der 'Printable height' ändert oft NICHT automatisch hartkodierte Werte im Start-Gcode! Prüfe den Machine Start G-code auf Z-Limit-Befehle (wie 'G28 Z P0 T...') und reduziere diese manuell um die Haken-Länge, sonst kracht das Bett beim Homing unten rein!"}
                      </li>
                    </ul>
                  </div>

                  <label style={labelStyle}>{t("gcode.hook.z_down") || "Z-Höhe runter (Spannen)"}</label>
                  <input type="number" value={hookZ} onChange={(e) => setHookZ(e.target.value === '' ? '' : Number(e.target.value))} style={inputStyle} />
                  <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '5px', marginBottom: '15px' }}>
                    {t("gcode.hook.z_down_desc") || "Die Z-Höhe, auf die das Druckbett runtergefahren wird, um Druck auf die Platte aufzubauen."}
                  </p>
                  
                  <label style={labelStyle}>{t("gcode.hook.z_up") || "Z-Höhe hoch (Entspannen)"}</label>
                  <input type="number" value={hookZRelease} onChange={(e) => setHookZRelease(e.target.value === '' ? '' : Number(e.target.value))} style={inputStyle} />
                  <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '5px' }}>
                    {t("gcode.hook.z_up_desc") || "Die Z-Höhe, auf die das Druckbett wieder hochgefahren wird, um zu entspannen."}
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RECHTS: Code-Vorschau und Anleitung */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <div style={{ background: '#333', borderLeft: '4px solid #e6a800', padding: '15px', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#fff' }}>⚠️ {t("gcode.instruction.title")}</h4>
            <p style={{ margin: 0, color: '#bbb', fontSize: '0.9rem', lineHeight: '1.4' }}>
              {t("gcode.instruction.text")}<br/>
              <code style={{ color: '#e6a800', background: '#222', padding: '2px 6px', borderRadius: '3px', marginTop: '8px', display: 'inline-block' }}>
                ;=====printer finish  sound=========
              </code>
            </p>
          </div>

          <div style={{ background: '#1e1e24', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{t("gcode.preview")}</h3>
              <button 
                onClick={copyToClipboard}
                style={{ background: '#4caf50', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                📋 {t("gcode.copy")}
              </button>
            </div>
            
            <textarea 
              readOnly 
              value={generateGcode()} 
              style={{ 
                flex: 1, 
                background: '#121212', 
                color: '#4caf50', 
                border: '1px solid #333', 
                borderRadius: '4px', 
                padding: '15px', 
                fontFamily: 'monospace', 
                fontSize: '0.9rem',
                resize: 'none',
                outline: 'none',
                minHeight: '400px'
              }} 
            />
          </div>

        </div>

      </div>
    </div>
  );
};

export default GcodeGen;
