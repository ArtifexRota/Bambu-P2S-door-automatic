import React from 'react';

interface EulaModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

const EulaModal: React.FC<EulaModalProps> = ({ onAccept, onDecline }) => {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.9)', zIndex: 9999,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div style={{
        background: '#1e1e24', width: '90%', maxWidth: '800px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', borderRadius: '8px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.8)', border: '1px solid #333'
      }}>

        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid #333', background: '#2a2a2e', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
          <h2 style={{ margin: 0, color: '#fff' }}>📜 Lizenzvereinbarung & Haftungsausschluss</h2>
        </div>

        {/* Text Area */}
        <div style={{ padding: '25px', overflowY: 'auto', color: '#bbb', lineHeight: '1.6', fontSize: '0.95rem' }}>
          <p><strong>Belling Software - Freeware Lizenzvereinbarung</strong><br/>
          © 2026 Nils Belling. Alle Rechte vorbehalten.</p>

          <h4 style={{ color: '#fff', marginBottom: '5px' }}>1. Nutzungsrecht</h4>
          <p style={{ marginTop: 0 }}>Diese Software wird als Freeware kostenlos zur Verfügung gestellt. Du darfst die Software herunterladen, installieren und zeitlich unbegrenzt nutzen. Die Nutzung für private sowie ausdrücklich auch für kommerzielle Zwecke (z. B. in kommerziellen 3D-Druckfarmen) ist gestattet.</p>

          <h4 style={{ color: '#fff', marginBottom: '5px' }}>2. Einschränkungen</h4>
          <ul style={{ marginTop: 0 }}>
            <li><strong>Kein Verkauf:</strong> Du darfst diese Software (weder im Ganzen noch in Teilen) nicht verkaufen, vermieten, verleasen oder in irgendeiner Form gegen eine Gebühr anbieten.</li>
            <li><strong>Keine Modifikation:</strong> Es ist untersagt, die Software oder den zugrundeliegenden Quellcode zu verändern, zu übersetzen, zu dekompilieren oder davon abgeleitete Werke zu erstellen.</li>
            <li><strong>Keine kommerzielle Aneignung:</strong> Du darfst diesen Code nicht in eine eigene, kommerzielle Software einbauen.</li>
          </ul>

          <h4 style={{ color: '#fff', marginBottom: '5px' }}>3. Weitergabe</h4>
          <p style={{ marginTop: 0 }}>Du darfst diese Software frei kopieren und weitergeben, vorausgesetzt, dies geschieht kostenlos, die Software bleibt unverändert und dieser Lizenzhinweis bleibt erhalten.</p>

          <h4 style={{ color: '#e6a800', marginBottom: '5px' }}>4. Haftungsausschluss</h4>
          <p style={{ marginTop: 0, color: '#e6a800' }}>DIESE SOFTWARE WIRD "WIE BESEHEN" (AS IS) BEREITGESTELLT. Der Autor (Nils Belling) übernimmt keinerlei Haftung für direkte oder indirekte Schäden, Datenverluste, Hardware-Defekte oder Produktionsausfälle, die durch die Nutzung dieser Software entstehen. Die Nutzung der Software zur Steuerung von Hardware erfolgt ausdrücklich auf eigene Gefahr.</p>

          <h4 style={{ color: '#fff', marginBottom: '5px' }}>5. Datenschutz</h4>
          <p style={{ marginTop: 0 }}>Diese Anwendung arbeitet zu 100 % lokal. Es werden keine personenbezogenen Daten oder Telemetriedaten gesammelt oder an das Internet übertragen.</p>
        </div>

        {/* Footer Buttons */}
        <div style={{ padding: '20px', borderTop: '1px solid #333', display: 'flex', justifyContent: 'flex-end', gap: '15px', background: '#2a2a2e', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
          <button onClick={onDecline} style={{ background: '#d32f2f', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
            ❌ Ablehnen & Beenden
          </button>
          <button onClick={onAccept} style={{ background: '#4caf50', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
            ✅ Ich habe verstanden & akzeptiere
          </button>
        </div>

      </div>
    </div>
  );
};

export default EulaModal;