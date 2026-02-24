import React, { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';

interface EulaModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

const EulaModal: React.FC<EulaModalProps> = ({ onAccept, onDecline }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);

  const setLanguage = (lang: string) => {
    setSelectedLang(lang);
    if (window.electronAPI && window.electronAPI.changeLanguage) {
      window.electronAPI.changeLanguage(lang);
    }
  };

  if (step === 1) {
    return (
      <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div className="modal-content" style={{ background: '#1e1e24', padding: '40px', borderRadius: '12px', textAlign: 'center', border: '1px solid #444', maxWidth: '500px', width: '100%' }}>
          <h2>Select Language</h2>
          
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', margin: '30px 0' }}>
            <button 
              onClick={() => setLanguage('de')} 
              style={{ 
                padding: '15px 30px', 
                fontSize: '1.2rem', 
                background: selectedLang === 'de' ? '#2a2a2e' : '#1e1e24', 
                color: 'white', 
                border: `2px solid ${selectedLang === 'de' ? '#2196f3' : '#555'}`, 
                boxShadow: selectedLang === 'de' ? '0 0 15px rgba(33, 150, 243, 0.4)' : 'none',
                borderRadius: '8px', 
                cursor: 'pointer', 
                transition: 'all 0.2s ease',
                transform: selectedLang === 'de' ? 'scale(1.05)' : 'scale(1)'
              }}
            >
              Deutsch
            </button>
            <button 
              onClick={() => setLanguage('en')} 
              style={{ 
                padding: '15px 30px', 
                fontSize: '1.2rem', 
                background: selectedLang === 'en' ? '#2a2a2e' : '#1e1e24', 
                color: 'white', 
                border: `2px solid ${selectedLang === 'en' ? '#2196f3' : '#555'}`, 
                boxShadow: selectedLang === 'en' ? '0 0 15px rgba(33, 150, 243, 0.4)' : 'none',
                borderRadius: '8px', 
                cursor: 'pointer', 
                transition: 'all 0.2s ease',
                transform: selectedLang === 'en' ? 'scale(1.05)' : 'scale(1)'
              }}
            >
              English
            </button>
          </div>

          <button 
            onClick={() => setStep(2)} 
            disabled={!selectedLang} 
            style={{ 
              background: selectedLang ? '#2196f3' : '#444', 
              color: selectedLang ? 'white' : '#888', 
              padding: '12px 40px', 
              fontSize: '1.1rem', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: selectedLang ? 'pointer' : 'not-allowed', 
              marginTop: '10px',
              transition: 'all 0.2s ease'
            }}
          >
            {selectedLang ? (t("eula.next") !== "eula.next" ? t("eula.next") : "Next") : "Please select"}
          </button>
        </div>
      </div>
    );
  }

  // Seite 2: Die formatierte EULA (abgestimmt auf deine neue JSON-Struktur)
  return (
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div className="modal-content" style={{ background: '#1e1e24', padding: '30px', borderRadius: '12px', border: '1px solid #444', maxWidth: '750px', width: '100%' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '5px' }}>📜 {t("eula.title")}</h2>
        <p style={{ textAlign: 'center', color: '#888', marginBottom: '20px', fontSize: '0.9rem' }}>{t("eula.copyright")}</p>
        
        <div style={{ 
          maxHeight: '400px', 
          overflowY: 'auto', 
          background: '#151518', 
          padding: '25px', 
          borderRadius: '8px', 
          marginBottom: '25px', 
          border: '1px solid #333', 
          lineHeight: '1.6', 
          color: '#ddd',
          fontSize: '0.95rem'
        }}>
          <h3 style={{ marginTop: 0, color: '#fff' }}>{t("eula.software_name")}</h3>
          <hr style={{ borderColor: '#333', margin: '15px 0' }} />

          <h4 style={{ color: '#2196f3', marginBottom: '5px' }}>{t("eula.rights.title")}</h4>
          <p style={{ marginBottom: '20px' }}>{t("eula.rights.text")}</p>

          <h4 style={{ color: '#2196f3', marginBottom: '5px' }}>{t("eula.restrictions.title")}</h4>
          <ul style={{ marginBottom: '20px', paddingLeft: '20px' }}>
            <li style={{ marginBottom: '8px' }}>{t("eula.restrictions.no_sale")}</li>
            <li style={{ marginBottom: '8px' }}>{t("eula.restrictions.no_mod")}</li>
            <li style={{ marginBottom: '8px' }}>{t("eula.restrictions.no_commercial")}</li>
          </ul>

          <h4 style={{ color: '#2196f3', marginBottom: '5px' }}>{t("eula.distribution.title")}</h4>
          <p style={{ marginBottom: '20px' }}>{t("eula.distribution.text")}</p>

          <h4 style={{ color: '#2196f3', marginBottom: '5px' }}>{t("eula.liability.title")}</h4>
          <p style={{ marginBottom: '20px'}}>{t("eula.liability.text")}</p>

          <h4 style={{ color: '#2196f3', marginBottom: '5px' }}>{t("eula.privacy.title")}</h4>
          <p style={{ marginBottom: '0' }}>{t("eula.privacy.text")}</p>
        </div>

        <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
          <button 
            onClick={onDecline} 
            style={{ background: '#d32f2f', color: 'white', padding: '12px 25px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ❌ {t("eula.decline")}
          </button>
          <button 
            onClick={onAccept} 
            style={{ background: '#4caf50', color: 'white', padding: '12px 25px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✅ {t("eula.accept")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EulaModal;