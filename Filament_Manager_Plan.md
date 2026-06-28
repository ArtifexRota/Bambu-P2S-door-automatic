# Filament Manager (Lokales Inventar)

Dieses Dokument beschreibt die technische Umsetzung des lokalen Filament-Managers für die Bambi-Lab App. 
Da die Datenhoheit komplett lokal bleiben soll, speichern wir alles auf dem Rechner des Nutzers.

## Zielsetzung
1. Verwaltung des Filament-Inventars (Bestand, Farbe, Material, Restgewicht).
2. Automatischer Abzug des Verbrauchs über MQTT, sobald ein Druck beendet ist.
3. Automatischer PDF-Rechnungsimport (Bambu Lab, 3DJake, Sunlu) zum schnellen Anlegen neuer Rollen.

---

> [!WARNING]
> **User Review Required**
> Bitte schau dir die unten aufgeführten offenen Fragen an und gib mir kurz Feedback dazu, wie du dir den Workflow vorstellst, bevor ich mit der Programmierung beginne.

## Offene Fragen an dich:

1. **Verbrauchs-Tracking via MQTT:**
   Bambu Lab Drucker senden beim Start eines Drucks oftmals das geschätzte Gewicht des Drucks mit. Wenn du *kein* AMS nutzt, woher weiß die App, welche Rolle aktuell auf dem Drucker (Drucker 1) eingespannt ist? 
   *Mein Vorschlag:* Wir bauen im Dashboard ein kleines Dropdown ein: "Aktuell geladene Rolle:", wo du manuell aus deinem Inventar wählst, welche Rolle gerade auf der Spule hängt. Die App zieht den Verbrauch dann automatisch von dieser Rolle ab. Ist das in deinem Sinne?

2. **Umgang mit mehreren Rollen (AMS):**
   Möchtest du das Inventar so detailliert haben, dass du Rollen direkt auf AMS-Slots (A1, A2, A3, A4) zuweisen kannst? Oder reicht erstmal eine simple Zuweisung "Drucker 1 druckt aktuell mit Rolle X"?

3. **PDF-Import Logik:**
   Die Rechnungen von Bambu Lab, 3DJake und Sunlu sehen alle sehr unterschiedlich aus. Ich werde einen intelligenten Text-Scanner (Regex) bauen, der nach Schlagwörtern wie "PLA", "PETG", "1kg", "Matte" und den Farben sucht. Wenn der Scanner ein paar Rollen aus der Rechnung nicht zu 100% erkennt, zeige ich dir vor dem Speichern eine Liste, wo du den Namen oder die Farbe noch korrigieren kannst. Passt das so für dich?

---

## Proposed Changes

### 1. Backend: Datenbank & PDF-Parsing (`main.ts` & `package.json`)
- **[MODIFY] `package.json`**: Hinzufügen von `pdf-parse` (eine lokale Bibliothek zum Auslesen von PDF-Texten ohne Cloud).
- **[NEW] `filamentDb.ts` (oder Erweiterung in `main.ts`)**: Eine neue JSON-Datenbank (`filaments.json` im AppData-Ordner), die die Liste aller Spulen speichert.
  - Datenmodell: `id, marke, material, farbe, startGewicht (1000g), restGewicht, preis, kaufdatum`.
- **[MODIFY] `main.ts` (MQTT Logik)**: Wenn `pData.status` auf `FINISH` springt, lesen wir aus dem vorherigen Zustand (oder dem Gcode-Namen) das verbrauchte Gewicht aus und ziehen es von der zugewiesenen Rolle ab.
- **[MODIFY] `preload.ts`**: Neue IPC-Kanäle für `get-filaments`, `save-filament`, `upload-invoice`, `assign-spool`.

### 2. Frontend: UI & Ansichten
- **[NEW] `FilamentManager.tsx`**: Eine komplett neue Ansicht (über das Menü erreichbar), die das Inventar auflistet.
  - Übersicht aller Rollen mit Fortschrittsbalken für das Restgewicht.
  - "PDF Rechnung importieren" Button mit Datei-Auswahl.
- **[MODIFY] `App.tsx` / `Sidebar`**: Neuer Navigationspunkt für den Filament-Manager.
- **[MODIFY] `locales/*.json`**: Alle neuen Übersetzungen für den Filament-Manager in allen 10 Sprachen.

## Verification Plan

### Automatisierte und Manuelle Tests
1. **PDF Import Test:** Ich werde eine Dummy-Rechnung textlich simulieren und prüfen, ob der Parser "Sunlu PLA+ Schwarz 1kg" sauber in die Attribute (Marke: Sunlu, Material: PLA+, Farbe: Schwarz, Gewicht: 1000g) zerlegt.
2. **Datenbank Test:** Anlegen, Bearbeiten und Löschen von Filamenten über die lokale `filaments.json` testen.
3. **MQTT Verbrauchstest:** Ich werde einen simulierten MQTT-Druckstart senden, ein Filament zuweisen, und den Druck beenden, um zu prüfen, ob exakt das berechnete Gewicht abgezogen wird.
