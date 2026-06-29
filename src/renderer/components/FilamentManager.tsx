import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { spoolmanColors } from '../assets/spoolmanColors';
import './FilamentManager.css';

interface AmsTray {
  id: string; // e.g. "A1", "B2"
  tray_info_idx: string;
  tray_sub_brands: string;
  tray_color: string;
  tray_type: string;
  tray_weight?: string;
  remain?: number;
  tag_uid?: string;
}

interface Filament {
  id: string;
  brand: string;
  material: string;
  colorName: string;
  colorHex: string;
  startWeight: number;
  remainingWeight: number;
  price?: number;
  purchaseDate?: string;
  serialNumber?: string;
}

interface Props {
  activePrinterId: string;
  printerData: any;
}

const hexToRgba = (hex: string, opacity: number) => {
  let c = hex.replace('#', '');
  if (c.length === 8) c = c.substring(0, 6);
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length !== 6) return `rgba(255, 255, 255, ${opacity})`;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const getBambuColor = (rawColor?: string) => {
  if (!rawColor) return 'transparent';
  const clean = rawColor.replace('#', '');
  if (clean.length >= 6) {
    return `#${clean.substring(0, 6)}`;
  }
  return `#${clean}`;
};

export const FilamentManager: React.FC<Props> = ({ activePrinterId, printerData }) => {
  const { t } = useTranslation();
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [amsData, setAmsData] = useState<AmsTray[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<AmsTray | null>(null);
  const [editWeightFilament, setEditWeightFilament] = useState<Filament | null>(null);
  const [editWeightInput, setEditWeightInput] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [groupIdentical, setGroupIdentical] = useState(false);
  const [deleteConfirmFilament, setDeleteConfirmFilament] = useState<Filament | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [minFill, setMinFill] = useState(0);
  const [maxFill, setMaxFill] = useState(100);
  const [hideEmpty, setHideEmpty] = useState(false);

  // Group Editing
  const [editGroupModal, setEditGroupModal] = useState<Filament[] | null>(null);
  const [groupEditState, setGroupEditState] = useState<{id: string, remainingWeight: number}[]>([]);

  const [newManualFilament, setNewManualFilament] = useState({
    brand: "Generic", material: "PLA", colorName: "Black", colorHex: "#1A1A1A", startWeight: 1000
  });

  const loadFilaments = async () => {
    if (window.electronAPI && window.electronAPI.getFilaments) {
      const data = await window.electronAPI.getFilaments();
      setFilaments(data);
    }
  };

  useEffect(() => {
    loadFilaments();
  }, []);

  useEffect(() => {
    if (printerData && printerData.amsData && printerData.amsData.trays) {
      const validTrays = printerData.amsData.trays.filter((t: AmsTray) => t.tray_type !== "");
      setAmsData(validTrays);
    } else {
      setAmsData([]);
    }
  }, [printerData]);

  const amsGroups = useMemo(() => {
    const groups: Record<string, AmsTray[]> = {};
    amsData.forEach(tray => {
      const letter = tray.id.charAt(0);
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(tray);
    });
    return groups;
  }, [amsData]);

  const handleAddFromAms = async (tray: AmsTray) => {
    if (!window.electronAPI?.addFilament) return;

    if (tray.tag_uid && tray.tag_uid !== '0000000000000000') {
      const exists = filaments.some(f => f.serialNumber === tray.tag_uid);
      if (exists) {
        setDuplicateWarning(tray);
        return;
      }
    }

    await confirmAddFromAms(tray);
  };

  const confirmAddFromAms = async (tray: AmsTray) => {
    setDuplicateWarning(null);
    if (!window.electronAPI?.addFilament) return;

    const newFilament = {
      brand: tray.tray_sub_brands ? "Bambu Lab" : "Generic",
      material: tray.tray_type || "Unknown",
      colorName: tray.tray_sub_brands || "Unknown Color",
      colorHex: getBambuColor(tray.tray_color) || '#888888',
      startWeight: 1000,
      remainingWeight: tray.remain ? (tray.remain / 100) * 1000 : 1000,
      price: 0,
      serialNumber: tray.tag_uid || "",
      purchaseDate: new Date().toISOString()
    };
    
    await window.electronAPI.addFilament(newFilament);
    loadFilaments();
  };

  const handleImportPdf = async () => {
    if (!window.electronAPI?.importPdf) return;
    const text = await window.electronAPI.importPdf();
    if (text) {
      if (text.startsWith("ERROR:")) {
        alert("Fehler beim PDF lesen: " + text);
        return;
      }
      
      console.log("PDF TEXT PARSED:", text);
      const newFilaments = parseInvoice(text);
      
      if (newFilaments.length === 0) {
        alert("Keine Filamente in der Rechnung gefunden. Aktuell wird Bambu Lab und SUNLU unterstützt.");
        return;
      }

      if (window.confirm(`${newFilaments.length} Filamente gefunden! Möchtest du sie dem Lager hinzufügen?\n\n` + newFilaments.map(f => `${f.brand} ${f.material} - ${f.colorName}`).join("\n"))) {
        for (const f of newFilaments) {
          await window.electronAPI.addFilament(f);
        }
        loadFilaments();
      }
    }
  };

  const handleLinkToInventory = async (tray: AmsTray, filamentId: string) => {
    if (!window.electronAPI?.updateFilament) return;
    const hex = getBambuColor(tray.tray_color) || '#888888';
    
    await window.electronAPI.updateFilament(filamentId, {
      serialNumber: tray.tag_uid || "",
      colorHex: hex === 'transparent' ? '#888888' : hex,
      remainingWeight: tray.remain ? (tray.remain / 100) * 1000 : undefined
    });
    loadFilaments();
  };

  const handleDelete = async () => {
    if (deleteConfirmFilament && window.electronAPI?.deleteFilament) {
      await window.electronAPI.deleteFilament(deleteConfirmFilament.id);
      loadFilaments();
    }
    setDeleteConfirmFilament(null);
  };

  const displayedFilaments = useMemo(() => {
    let filtered = filaments;

    if (searchQuery.trim()) {
      const tokens = searchQuery.toLowerCase().split(/\s+/);
      filtered = filtered.filter(f => {
        const searchStr = `${f.brand} ${f.material} ${f.colorName} ${f.serialNumber || ''}`.toLowerCase();
        return tokens.every(token => searchStr.includes(token));
      });
    }

    if (hideEmpty) {
      filtered = filtered.filter(f => f.remainingWeight > 0);
    }

    filtered = filtered.filter(f => {
      const percent = (f.remainingWeight / Math.max(f.startWeight, 1)) * 100;
      return percent >= minFill && percent <= maxFill;
    });

    if (!groupIdentical) return filtered;
    
    const grouped: Record<string, Filament & { count: number, subFilaments: Filament[] }> = {};
    filtered.forEach(f => {
      const key = `${f.brand}|${f.material}|${f.colorName}|${f.colorHex}`;
      if (!grouped[key]) {
        grouped[key] = { ...f, count: 1, subFilaments: [f] };
      } else {
        grouped[key].remainingWeight += f.remainingWeight;
        grouped[key].startWeight += f.startWeight;
        grouped[key].count += 1;
        grouped[key].subFilaments.push(f);
      }
    });
    return Object.values(grouped);
  }, [filaments, groupIdentical, searchQuery, hideEmpty, minFill, maxFill]);

  const handleEditWeightClick = (f: Filament) => {
    setEditWeightInput(Math.round(f.remainingWeight).toString());
    setEditWeightFilament(f);
  };

  const handleSaveWeight = async () => {
    if (!editWeightFilament) return;
    const newWeight = parseInt(editWeightInput.replace(/[^\d]/g, ''), 10);
    if (!isNaN(newWeight) && window.electronAPI?.updateFilament) {
      await window.electronAPI.updateFilament(editWeightFilament.id, { remainingWeight: newWeight });
      loadFilaments();
    }
    setEditWeightFilament(null);
  };

  const handleEditGroupClick = (f: any) => {
    setGroupEditState(f.subFilaments.map((sub: Filament) => ({ id: sub.id, remainingWeight: Math.round(sub.remainingWeight) })));
    setEditGroupModal(f.subFilaments);
  };

  const handleSaveGroupWeight = async () => {
    if (!window.electronAPI?.updateFilament) return;
    for (const item of groupEditState) {
       await window.electronAPI.updateFilament(item.id, { remainingWeight: item.remainingWeight });
    }
    setEditGroupModal(null);
    loadFilaments();
  };

  const handleAddManual = async () => {
    if (!window.electronAPI?.addFilament) return;
    
    const newFilament = {
      ...newManualFilament,
      remainingWeight: newManualFilament.startWeight,
      price: 0,
      serialNumber: "",
      purchaseDate: new Date().toISOString()
    };
    
    await window.electronAPI.addFilament(newFilament);
    setShowAddModal(false);
    loadFilaments();
  };

  const guessBambuColorHex = (code: string, name: string): string => {
    const codeMap: Record<string, string> = {
      '32600': '#87CEEB',
      '32101': '#E0E0E0',
      '13108': '#808080',
      '10701': '#8A2BE2',
      '10601': '#1F51FF',
      '11101': '#1A1A1A',
      '40101': '#1A1A1A',
      '10100': '#F5F5F5',
      '10101': '#F5F5F5',
      '10200': '#FF0000',
      '10400': '#FFFF00',
      '10500': '#00FF00',
      '10800': '#FFA500',
    };
    
    if (code && codeMap[code]) return codeMap[code];

    const n = name.toLowerCase();

    for (const [key, value] of Object.entries(spoolmanColors)) {
      if (n.includes(key) && value !== '#888888') {
        return value;
      }
    }

    if (n.includes('schwarz') || n.includes('black')) return '#1A1A1A';
    if (n.includes('weiß') || n.includes('white')) return '#F5F5F5';
    if (n.includes('grau') || n.includes('gray') || n.includes('grey')) return '#888888';
    if (n.includes('blau') || n.includes('blue')) return '#1F51FF';
    if (n.includes('rot') || n.includes('red')) return '#FF0000';
    if (n.includes('grün') || n.includes('green')) return '#00FF00';
    if (n.includes('gelb') || n.includes('yellow')) return '#FFFF00';
    if (n.includes('orange')) return '#FFA500';
    if (n.includes('lila') || n.includes('purple') || n.includes('violett')) return '#8A2BE2';
    
    return '#888888';
  };

  const parseInvoice = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const filamentsToAdd: Omit<Filament, 'id'>[] = [];
    
    const isSunlu = text.includes('SUNLU INTERNATIONAL') || text.includes('sunlude@sunlu.com');

    if (isSunlu) {
      // SUNLU Invoice Parsing
      let buffer: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const qtyMatch = line.match(/^(\d+)\s+([\d,]+)\s*€/);
        
        if (qtyMatch && buffer.length > 0) {
          let description = buffer.join(" ");
          
          // Strip table headers and address block by finding the actual start of the product
          const startIdx = description.search(/\[MOQ:|SUNLU\s+(PLA|PETG|ABS|SILK|TPU)/i);
          if (startIdx !== -1) {
            description = description.substring(startIdx);
          } else {
            description = description.replace(/.*Beschreibung\s+Anzahl\s+Grundpreis\s+Mehrwertsteuersatz\s+Betrag\s*/i, "");
          }
          
          const qty = parseInt(qtyMatch[1], 10);
          const price = parseFloat(qtyMatch[2].replace(',', '.'));
          buffer = []; // reset for next item

          if (description.toLowerCase().includes("filament")) {
            let material = "PLA";
            const baseMatMatch = description.match(/\b(PLA|PETG|ABS|TPU|ASA|PC|Nylon)\b/i);
            if (baseMatMatch) {
              material = baseMatMatch[1].toUpperCase();
            } else if (description.match(/\bSILK\b/i)) {
              material = "SILK";
            }

            const modifiers = [];
            if (description.match(/\bMatte\b/i)) modifiers.push("Matte");
            if (description.match(/\bGalaxy\b/i)) modifiers.push("Galaxy");
            if (description.match(/\bSilk\b/i) && material !== "SILK") modifiers.push("Silk");
            if (description.match(/\bMeta\b/i)) modifiers.push("Meta");
            if (description.match(/\bPlus|\+\b/i)) modifiers.push("Plus");
            if (description.match(/\bTough\b/i)) modifiers.push("Tough");
            
            if (modifiers.length > 0) {
              material += " " + modifiers.join(" ");
            }

            let colorName = "Unknown";
            // Look for color name after separators with spaces to avoid splitting at 3/F or Dual-Color
            const possibleSeparators = [' | ', ' / ', ' - ', '  '];
            let lastSepIdx = -1;
            let bestSepLength = 0;
            
            for (const sep of possibleSeparators) {
              const idx = description.lastIndexOf(sep);
              if (idx > lastSepIdx) {
                lastSepIdx = idx;
                bestSepLength = sep.length;
              }
            }

            if (lastSepIdx > -1) {
              colorName = description.substring(lastSepIdx + bestSepLength).trim();
            } else {
              // Fallback: look for "Finish" or similar keywords
              const matchFinish = description.match(/Finish\s*[-|:]?\s*(.*)/i);
              if (matchFinish) {
                colorName = matchFinish[1].trim();
              } else {
                colorName = description; 
              }
            }

            // Cleanup weird OCR artifacts (e.g., '+' being scanned as a weird glyph)
            // Replace any non-standard letter/number/punctuation with '+'
            colorName = colorName.replace(/[^\p{L}\p{N}\s\-&()]/gu, '+').replace(/\s*\+\s*/g, ' + ').replace(/\+{2,}/g, '+').trim();
            // Remove trailing/leading '+' if any
            if (colorName.startsWith('+ ')) colorName = colorName.substring(2);
            if (colorName.endsWith(' +')) colorName = colorName.substring(0, colorName.length - 2);
            // Some final manual cleanups for common OCR breaks
            colorName = colorName.replace(/Finish\s*\+\s*/i, "");

            let weight = 1000;
            if (description.toLowerCase().includes("1kg") || description.toLowerCase().includes("1 kg")) weight = 1000;
            if (description.toLowerCase().includes("2kg") || description.toLowerCase().includes("2 kg")) weight = 2000;
            
            let hexColor = guessBambuColorHex("", colorName);

            for (let q = 0; q < qty; q++) {
              filamentsToAdd.push({
                brand: "SUNLU",
                material: material,
                colorName: colorName,
                colorHex: hexColor,
                startWeight: weight,
                remainingWeight: weight,
                price: price,
                serialNumber: "",
                purchaseDate: new Date().toISOString()
              });
            }
          }
        } else {
          // Accumulate description
          buffer.push(line);
        }
      }
    } else {
      // Bambu Lab Invoice Parsing (Default)
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("SKU: ")) {
          const materialRaw = lines[i - 1] || "Unknown Material";
          let variantStr = "";
          let qty = 1;
          let price = 0;
          
          let j = i + 1;
          while (j < lines.length) {
            if (lines[j].match(/^\d+\s+€\d+/)) {
              const match = lines[j].match(/^(\d+)\s+€([\d.]+)/);
              if (match) {
                qty = parseInt(match[1], 10);
                price = parseFloat(match[2]);
              }
              break;
            } else {
              variantStr += " " + lines[j];
            }
            j++;
            if (j > i + 5) break;
          }

          let variantPart = variantStr.replace("Variant:", "").split("/")[0].trim();
          let colorName = variantPart;
          let colorCodeMatch = variantPart.match(/\((\d+)\)/);
          let colorCode = colorCodeMatch ? colorCodeMatch[1] : "";
          let weight = 1000;
          if (variantStr.includes("1 kg") || variantStr.includes("1kg")) weight = 1000;
          
          let hexColor = guessBambuColorHex(colorCode, colorName);

          if (!variantStr.toLowerCase().includes("filament") && !materialRaw.toLowerCase().includes("filament") && !lines[i].toLowerCase().includes("filament")) {
             continue;
          }

          for (let q = 0; q < qty; q++) {
            filamentsToAdd.push({
              brand: "Bambu Lab",
              material: materialRaw,
              colorName: colorName,
              colorHex: hexColor,
              startWeight: weight,
              remainingWeight: weight,
              price: price,
              serialNumber: "",
              purchaseDate: new Date().toISOString()
            });
          }
        }
      }
    }
    
    return filamentsToAdd;
  };

  return (
    <div className="filament-manager">
      
      {deleteConfirmFilament && (
        <div className="fm-modal-overlay">
          <div className="fm-modal">
            <h3>🗑️ Filament löschen</h3>
            <p>
              Möchtest du das Filament <strong>{deleteConfirmFilament.brand} {deleteConfirmFilament.material} ({deleteConfirmFilament.colorName})</strong> wirklich dauerhaft aus dem Lager löschen?
            </p>
            <div className="fm-modal-actions">
              <button className="fm-btn-cancel" onClick={() => setDeleteConfirmFilament(null)}>Abbrechen</button>
              <button className="fm-btn-confirm" style={{background: 'rgba(255, 50, 50, 0.2)', color: '#ff5252', borderColor: 'rgba(255, 50, 50, 0.4)'}} onClick={handleDelete}>Ja, löschen</button>
            </div>
          </div>
        </div>
      )}

      {duplicateWarning && (
        <div className="fm-modal-overlay">
          <div className="fm-modal">
            <h3>⚠️ Achtung: Duplikat</h3>
            <p>
              Dieses Filament (SN: <strong>{duplicateWarning.tag_uid}</strong>) existiert bereits in deinem lokalen Lager. 
              Möchtest du es wirklich noch einmal als neue, separate Rolle hinzufügen?
            </p>
            <div className="fm-modal-actions">
              <button className="fm-btn-cancel" onClick={() => setDuplicateWarning(null)}>Abbrechen</button>
              <button className="fm-btn-confirm" onClick={() => confirmAddFromAms(duplicateWarning)}>Trotzdem hinzufügen</button>
            </div>
          </div>
        </div>
      )}

      {editWeightFilament && (
        <div className="fm-modal-overlay">
          <div className="fm-modal">
            <h3>⚖️ Gewicht anpassen</h3>
            <p>Aktuelles Restgewicht in Gramm eingeben:</p>
            <input 
              type="number" 
              className="fm-input"
              value={editWeightInput} 
              onChange={(e) => setEditWeightInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveWeight()}
              autoFocus
            />
            <div className="fm-modal-actions">
              <button className="fm-btn-cancel" onClick={() => setEditWeightFilament(null)}>Abbrechen</button>
              <button className="fm-btn-confirm" onClick={handleSaveWeight}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {editGroupModal && (
        <div className="fm-modal-overlay">
          <div className="fm-modal">
            <h3>⚖️ Gruppierte Rollen anpassen</h3>
            <p>Menge der einzelnen Rollen bearbeiten:</p>
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '20px' }}>
              {editGroupModal.map((f, idx) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', color: '#ccc' }}>Rolle {idx + 1}</span>
                    <span style={{ fontSize: '0.7rem', color: '#888', fontFamily: 'monospace' }}>SN: {f.serialNumber || 'Manuell'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input 
                      type="number" 
                      className="fm-input"
                      style={{ width: '80px', padding: '5px' }}
                      value={groupEditState.find(s => s.id === f.id)?.remainingWeight || 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setGroupEditState(prev => prev.map(s => s.id === f.id ? { ...s, remainingWeight: val } : s));
                      }}
                    />
                    <span style={{ color: '#888' }}>/ {f.startWeight}g</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="fm-modal-actions">
              <button className="fm-btn-cancel" onClick={() => setEditGroupModal(null)}>Abbrechen</button>
              <button className="fm-btn-confirm" onClick={handleSaveGroupWeight}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fm-modal-overlay">
          <div className="fm-modal">
            <h3>➕ Neues Filament</h3>
            
            <label className="fm-label">Marke:</label>
            <input type="text" className="fm-input" value={newManualFilament.brand} onChange={(e) => setNewManualFilament({...newManualFilament, brand: e.target.value})} />
            
            <label className="fm-label">Material (z.B. PLA, PETG):</label>
            <input type="text" className="fm-input" value={newManualFilament.material} onChange={(e) => setNewManualFilament({...newManualFilament, material: e.target.value})} />
            
            <label className="fm-label">Farbe Name:</label>
            <input type="text" className="fm-input" value={newManualFilament.colorName} onChange={(e) => setNewManualFilament({...newManualFilament, colorName: e.target.value})} />
            
            <label className="fm-label">Farbe (Hex):</label>
            <input type="color" className="fm-input-color" value={newManualFilament.colorHex} onChange={(e) => setNewManualFilament({...newManualFilament, colorHex: e.target.value})} />
            
            <label className="fm-label">Startgewicht (Gramm):</label>
            <input type="number" className="fm-input" value={newManualFilament.startWeight} onChange={(e) => setNewManualFilament({...newManualFilament, startWeight: parseInt(e.target.value) || 0})} />

            <div className="fm-modal-actions" style={{marginTop: '20px'}}>
              <button className="fm-btn-cancel" onClick={() => setShowAddModal(false)}>Abbrechen</button>
              <button className="fm-btn-confirm" onClick={handleAddManual}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      <div className="fm-header">
        <h2>Inventar & AMS</h2>
        <p>Verwalte alle deine Rollen lokal und erfasse neue direkt vom Drucker.</p>
      </div>

      <div className="fm-section">
        <div className="fm-section-header">
          <h3>📡 Live AMS Status <span className="fm-badge">Connected</span></h3>
        </div>
        
        {amsData.length === 0 ? (
          <div className="fm-empty">
            Lade AMS Daten oder AMS ist leer...
          </div>
        ) : (
          <div>
            {Object.keys(amsGroups).map(letter => (
              <div key={letter} className="fm-ams-group">
                <h4>AMS {letter}</h4>
                <div className="fm-grid-ams">
                  {amsGroups[letter].map((tray) => {
                    const isEmpty = !tray.tray_type && !tray.tray_sub_brands;
                    const isGenericRFID = tray.tag_uid === '0000000000000000';
                    const actualColor = getBambuColor(tray.tray_color);
                    const nameStr = (tray.tray_sub_brands || tray.tray_type || "").toLowerCase();
                    const isTranslucent = nameStr.includes("translucent") || nameStr.includes("transparent") || nameStr.includes("clear");
                    const isSparkle = nameStr.includes("sparkle") || nameStr.includes("galaxy");
                    const isGlow = nameStr.includes("glow") || nameStr.includes("luminous");
                    
                    if (isEmpty) {
                      return (
                        <div key={tray.id} className="fm-card" style={{ opacity: 0.5 }}>
                          <span className="fm-slot-badge">{tray.id}</span>
                          <div className="fm-card-top" style={{ justifyContent: 'center', marginTop: '20px', marginBottom: '20px' }}>
                            <span className="fm-title" style={{ color: '#666' }}>Fach Leer</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={tray.id} className="fm-card">
                        <span className="fm-slot-badge">{tray.id}</span>
                        
                        <div className="fm-card-top">
                          <div 
                            className={`fm-color-circle ${isSparkle ? 'fm-sparkle' : ''} ${isGlow ? 'fm-glow' : ''}`}
                            style={{ 
                              color: actualColor,
                              backgroundColor: actualColor,
                              opacity: isTranslucent ? 0.6 : 1,
                              border: isTranslucent ? '2px solid rgba(255,255,255,0.4)' : '3px solid #111'
                            }}
                          ></div>
                          
                          <div className="fm-info">
                            <span className="fm-title">
                              {(tray.tray_sub_brands || tray.tray_type) ? (tray.tray_sub_brands || tray.tray_type) : "Unknown"}
                            </span>
                            
                            {isGenericRFID ? (
                              <span className="fm-sn italic" style={{ color: '#ffb74d' }}>Fremdmarke / Kein RFID</span>
                            ) : tray.tag_uid ? (
                              <span className="fm-sn">SN: {tray.tag_uid}</span>
                            ) : (
                              <span className="fm-sn italic">Kein RFID</span>
                            )}
                          </div>
                        </div>

                        <div className="fm-progress-container">
                          {tray.remain !== undefined && (
                            <div className="fm-progress-bar">
                              <div 
                                className="fm-progress-fill" 
                                style={{ width: `${tray.remain}%`, backgroundColor: '#00e676' }}
                              ></div>
                            </div>
                          )}
                        </div>

                        <button onClick={() => handleAddFromAms(tray)} className="fm-btn-add">
                          + Inventar
                        </button>

                        <select 
                          className="fm-select-link" 
                          onChange={(e) => {
                            if (e.target.value) handleLinkToInventory(tray, e.target.value);
                            e.target.value = "";
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>🔗 Mit Lager verknüpfen...</option>
                          {filaments.filter(f => !f.serialNumber).map(f => (
                            <option key={f.id} value={f.id}>{f.brand} {f.material} ({f.colorName})</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fm-section">
        <div className="fm-section-header">
          <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
            <h3>📦 Lokales Lager ({displayedFilaments.length} Rollen)</h3>
            <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#aaa'}}>
              <input 
                type="checkbox" 
                checked={groupIdentical} 
                onChange={(e) => setGroupIdentical(e.target.checked)} 
              />
              Gleiche Sorten gruppieren
            </label>
          </div>
          <div style={{display: 'flex', gap: '10px'}}>
            <button className="fm-btn" onClick={() => setShowAddModal(true)}>➕ Neu</button>
            <button className="fm-btn" onClick={handleImportPdf}>📄 PDF Import</button>
          </div>
        </div>
        
        {/* FILTERS */}
        <div className="fm-filters">
          <input 
            type="text" 
            className="fm-input fm-filter-search" 
            placeholder="🔍 Suche (z.B. PLA Black Bambu)" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
          />
          
          <div className="fm-filter-controls">
            <div className="fm-filter-range">
              <label>Füllstand:</label>
              <input type="number" min="0" max="100" className="fm-input fm-input-small" value={minFill} onChange={(e) => setMinFill(Math.max(0, parseInt(e.target.value) || 0))} />
              <span>% bis</span>
              <input type="number" min="0" max="100" className="fm-input fm-input-small" value={maxFill} onChange={(e) => setMaxFill(Math.min(100, parseInt(e.target.value) || 0))} />
              <span>%</span>
            </div>

            <label className="fm-filter-checkbox">
              <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
              Leere Rollen ausblenden
            </label>
          </div>
        </div>

        {displayedFilaments.length === 0 ? (
          <div className="fm-empty">
            <p>Dein Lager ist leer.</p>
            <p>Nutze "+ Inventar" im AMS oder lade eine PDF hoch.</p>
          </div>
        ) : (
          <div className="fm-grid-inventory">
            {displayedFilaments.map((f: any) => {
              const searchStr = (f.material + " " + f.colorName).toLowerCase();
              const isTranslucent = searchStr.includes("translucent") || searchStr.includes("transparent") || searchStr.includes("clear");
              const isSparkle = searchStr.includes("sparkle") || searchStr.includes("galaxy");
              const isGlow = searchStr.includes("glow") || searchStr.includes("luminous");

              return (
                <div 
                  key={f.id} 
                  className={`fm-card ${isSparkle ? 'fm-sparkle' : ''} ${isGlow ? 'fm-glow' : ''}`}
                  style={{ 
                    color: f.colorHex,
                    backgroundColor: hexToRgba(f.colorHex, 0.25),
                    borderColor: hexToRgba(f.colorHex, 0.6)
                  }}
                >
                  {!groupIdentical && (
                    <button onClick={() => setDeleteConfirmFilament(f)} className="fm-btn-delete" title="Löschen">✕</button>
                  )}
                  
                  {f.count > 1 && (
                    <span className="fm-slot-badge">{f.count}x Rollen</span>
                  )}

                  <div className="fm-card-top">
                    <div 
                      className={`fm-color-circle ${isSparkle ? 'fm-sparkle' : ''} ${isGlow ? 'fm-glow' : ''}`}
                      style={{ 
                        color: f.colorHex,
                        backgroundColor: f.colorHex,
                        opacity: isTranslucent ? 0.6 : 1,
                        border: isTranslucent ? '2px solid rgba(255,255,255,0.4)' : '3px solid #111'
                      }}
                    ></div>
                    
                    <div className="fm-info">
                      <span style={{ fontSize: '0.75rem', color: '#aaa', fontWeight: 'bold', textTransform: 'uppercase' }}>{f.brand}</span>
                      <span className="fm-title" style={{ whiteSpace: 'normal', lineHeight: '1.2', marginTop: '2px' }}>{f.material} - {f.colorName}</span>
                    </div>
                  </div>

                  {!groupIdentical && (
                    <>
                      {f.serialNumber && f.serialNumber !== '0000000000000000' ? (
                        <span className="fm-sn">SN: {f.serialNumber}</span>
                      ) : f.serialNumber === '0000000000000000' ? (
                        <span className="fm-sn italic" style={{ marginTop: '10px', color: '#ffb74d' }}>Fremdmarke (0000...)</span>
                      ) : (
                        <span className="fm-sn italic" style={{ marginTop: '10px' }}>Manuell angelegt</span>
                      )}
                    </>
                  )}

                  <div className="fm-progress-container">
                    <div className="fm-progress-text" style={{ cursor: 'pointer' }} onClick={() => groupIdentical ? handleEditGroupClick(f) : handleEditWeightClick(f)} title="Gewicht bearbeiten">
                      <span>{Math.round(f.remainingWeight)}g ✏️</span>
                      <span>{f.startWeight}g</span>
                    </div>
                    <div className="fm-progress-bar">
                      <div 
                        className="fm-progress-fill" 
                        style={{ width: `${Math.min(100, (f.remainingWeight / f.startWeight) * 100)}%`, backgroundColor: '#4fc3f7' }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
