#include <ESP32Servo.h>
#include <Preferences.h> // NEU: Für das Langzeitgedächtnis

const int SERVO_PIN = 18;
const int BUTTON_PIN = 14;

// NEU: Aus Konstanten wurden dynamische Variablen
int posOpen = 0;
int posClosed = 175;

Servo bambi;
Preferences preferences; // NEU: Instanz für den Flash-Speicher

String inputBuffer = "";
unsigned long moveStartTime = 0;
bool isMoving = false;
int currentTarget = 0;
bool lastButtonState = HIGH;

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  bambi.setPeriodHertz(50);

  // NEU: Speicher öffnen (Name "bambi", false = Lese-/Schreibmodus)
  preferences.begin("bambi", false);

  // Lade gespeicherte Werte. Falls noch nie gespeichert wurde, nimm 0 und 175 als Standard.
  posOpen = preferences.getInt("posOpen", 0);
  posClosed = preferences.getInt("posClosed", 175);

  Serial.println("{\"device\":\"Bambi\", \"status\":\"ready\", \"open\":" + String(posOpen) + ", \"closed\":" + String(posClosed) + "}");
}

void loop() {
  // 1. Manuellen Taster prüfen
  bool currentButtonState = digitalRead(BUTTON_PIN);
  if (currentButtonState == LOW && lastButtonState == HIGH) {
    if (!isMoving && (millis() - moveStartTime > 500)) {
      if (currentTarget == posClosed) { // Geändert zu dynamischer Variable
        processCommand("OPEN");
      } else {
        processCommand("CLOSE");
      }
    }
  }
  lastButtonState = currentButtonState;

  // 2. Serielle Befehle (Node.js)
  while (Serial.available() > 0) {
    char ch = (char)Serial.read();
    if (ch == '\n' || ch == '\r') {
      if (inputBuffer.length() > 0) {
        processCommand(inputBuffer);
        inputBuffer = "";
      }
    } else {
      inputBuffer += ch;
    }
  }

  // 3. Abschalten & Soft-Release
  if (isMoving && (millis() - moveStartTime > 2000)) {
    if (currentTarget == posClosed) { // Geändert zu dynamischer Variable
      // Geändert zu dynamischer Variable:
      for (int relief = posClosed; relief >= (posClosed - 4); relief--) {
        bambi.write(relief);
        delay(50);
      }
    }
    bambi.detach();
    isMoving = false;
    Serial.println("{\"bambi\":\"idle\", \"status\":\"detached_soft\"}");
  }
}

void moveBambi(int angle) {
  if (!bambi.attached()) {
    bambi.attach(SERVO_PIN, 500, 2500);
  }
  bambi.write(angle);
  currentTarget = angle;
  moveStartTime = millis();
  isMoving = true;
}

void processCommand(String cmd) {
  cmd.trim();

  if (cmd == "OPEN") {
    moveBambi(posOpen);
    Serial.println("{\"bambi\":\"moving\", \"target\":\"open\"}");
  }
  else if (cmd == "CLOSE") {
    moveBambi(posClosed);
    Serial.println("{\"bambi\":\"moving\", \"target\":\"closed\"}");
  }
  // NEU: Den SAVE-Befehl aus der App abfangen und zerlegen
  else if (cmd.startsWith("SAVE:")) {
    // Erwartetes Format: "SAVE:0:175"
    int firstColon = cmd.indexOf(':');
    int secondColon = cmd.indexOf(':', firstColon + 1);

    if (firstColon != -1 && secondColon != -1) {
      // Werte aus dem String schneiden und in Zahlen (Int) umwandeln
      String openStr = cmd.substring(firstColon + 1, secondColon);
      String closeStr = cmd.substring(secondColon + 1);

      posOpen = openStr.toInt();
      posClosed = closeStr.toInt();

      // Dauerhaft im Flash-Speicher ablegen
      preferences.putInt("posOpen", posOpen);
      preferences.putInt("posClosed", posClosed);

      Serial.println("{\"status\":\"saved\", \"open\":" + String(posOpen) + ", \"closed\":" + String(posClosed) + "}");
    }
  }
}