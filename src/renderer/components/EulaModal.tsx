import React from 'react';
import { useTranslation } from '../hooks/useTranslation';

interface EulaModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

const EulaModal: React.FC<EulaModalProps> = ({ onAccept, onDecline }) => {
  const { t } = useTranslation();
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
          <h2 style={{ margin: 0, color: '#fff' }}>📜 {t("eula.title")}</h2>
        </div>

        {/* Text Area */}
        <div style={{ padding: '25px', overflowY: 'auto', color: '#bbb', lineHeight: '1.6', fontSize: '0.95rem' }}>
          <p><strong>{t("eula.software_name")}</strong><br/>
          {t("eula.copyright")}</p>

          <h4 style={{ color: '#fff', marginBottom: '5px' }}>{t("eula.rights.title")}</h4>
          <p style={{ marginTop: 0 }}>{t("eula.rights.text")}</p>

          <h4 style={{ color: '#fff', marginBottom: '5px' }}>{t("eula.restrictions.title")}</h4>
          <ul style={{ marginTop: 0 }}>
            <li><strong>{t("eula.restrictions.no_sale")}</strong></li>
            <li><strong>{t("eula.restrictions.no_mod")}</strong></li>
            <li><strong>{t("eula.restrictions.no_commercial")}</strong></li>
          </ul>

          <h4 style={{ color: '#fff', marginBottom: '5px' }}>{t("eula.distribution.title")}</h4>
          <p style={{ marginTop: 0 }}>{t("eula.distribution.text")}</p>

          <h4 style={{ color: '#e6a800', marginBottom: '5px' }}>{t("eula.liability.title")}</h4>
          <p style={{ marginTop: 0, color: '#e6a800' }}>{t("eula.liability.text")}</p>

          <h4 style={{ color: '#fff', marginBottom: '5px' }}>{t("eula.privacy.title")}</h4>
          <p style={{ marginTop: 0 }}>{t("eula.privacy.text")}</p>
        </div>

        {/* Footer Buttons */}
        <div style={{ padding: '20px', borderTop: '1px solid #333', display: 'flex', justifyContent: 'flex-end', gap: '15px', background: '#2a2a2e', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
          <button onClick={onDecline} style={{ background: '#d32f2f', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
            ❌ {t("eula.decline")}
          </button>
          <button onClick={onAccept} style={{ background: '#4caf50', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
            ✅ {t("eula.accept")}
          </button>
        </div>

      </div>
    </div>
  );
};

export default EulaModal;
