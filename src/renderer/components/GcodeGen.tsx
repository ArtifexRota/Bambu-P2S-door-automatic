import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../hooks/useTranslation';

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

const GcodeGen: React.FC = () => {
  const { t } = useTranslation();
  const [doorOpenTemp, setDoorOpenTemp] = useState(80);
const warningTemp = doorOpenTemp - 4;
  const [tempWait2, setTempWait2] = useState(60);
  const [pushX, setPushX] = useState(128);
  const [pushZ, setPushZ] = useState(20);

  const generateGcode = () => {
    return `;========= BAMBI AUTOMATION START=========
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
G1 X${pushX} Y250 F6000 ; Head to target X position
M400
M190 S${tempWait2} ; Wait for push temp
M190 S${tempWait2} ; Double check temp
;===now cool===

;=========Pushing Print=========
G1 Z${pushZ} F600 ; Bed height to push level
G1 Y5 F3000 ; push out print

G1 Y50 F6000 ; get out
G1 X18 Y240 ; no collision with wiper
G1 X18 Y253 F6000 ; Poop position
;===Push end===
M106 P2 S0
M106 P3 S0
;=========BAMBI AUTOMATION ENDE=========`;
  };

  const copyToClipboard = () => {
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
    onChange={(e) => setDoorOpenTemp(Number(e.target.value))} 
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
              <input type="number" value={tempWait2} onChange={(e) => setTempWait2(Number(e.target.value))} style={inputStyle} />
              <details style={detailsStyle}>
                <summary style={summaryStyle}>ℹ️ {t("gcode.temps.why_no_buffer")}</summary>
                <p style={{ margin: '8px 0 0 0' }}>
                  {t("gcode.temps.why_no_buffer_text")}
                </p>
              </details>
            </div>
          </div>

          <div style={{ background: '#1e1e24', padding: '20px', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#fff' }}>🎯 {t("gcode.position.title")}</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>{t("gcode.position.start_x")}</label>
              <input type="number" value={pushX} onChange={(e) => setPushX(Number(e.target.value))} style={inputStyle} />
              <details style={detailsStyle}>
                <summary style={summaryStyle}>ℹ️ {t("gcode.position.center_info")}</summary>
                <p style={{ margin: '8px 0 0 0' }}>
                  {t("gcode.position.center_text")}
                </p>
              </details>
            </div>

            <div>
              <label style={labelStyle}>{t("gcode.position.push_z")}</label>
              <input type="number" value={pushZ} onChange={(e) => setPushZ(Number(e.target.value))} style={inputStyle} />
              <details style={detailsStyle}>
                <summary style={summaryStyle}>ℹ️ {t("gcode.position.plastic_info")}</summary>
                <p style={{ margin: '8px 0 0 0' }}>
                  {t("gcode.position.plastic_text")}
                </p>
              </details>
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
