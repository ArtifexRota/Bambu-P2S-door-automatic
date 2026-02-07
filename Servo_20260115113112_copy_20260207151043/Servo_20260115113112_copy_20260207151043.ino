#include <ESP32Servo.h>

const int SERVO_PIN = 18;
const int BUTTON_PIN = 14; // Hier kommt der R13-507 dran
const int POS_CLOSED = 175;
const int POS_OPEN = 0;

Servo bambi;
String inputBuffer = "";
unsigned long moveStartTime = 0;
bool isMoving = false;
int currentTarget = 0;
bool lastButtonState = HIGH; // Für die Entprellung

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP); // Interner Widerstand aktiviert
  bambi.setPeriodHertz(50);
  Serial.println("{\"device\":\"Bambi\", \"status\":\"ready\"}");
}

void loop() {
  // 1. Manuellen Taster prüfen (Entprellt)
  bool currentButtonState = digitalRead(BUTTON_PIN);
  if (currentButtonState == LOW && lastButtonState == HIGH) {
    // Taster wurde gerade gedrückt
    if (currentTarget == POS_CLOSED) {
      processCommand("OPEN");
    } else {
      processCommand("CLOSE");
    }
    delay(50); // Simples Entprellen
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
    if (currentTarget == POS_CLOSED) {
      for (int relief = POS_CLOSED; relief >= (POS_CLOSED - 4); relief--) {
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
    moveBambi(POS_OPEN);
    Serial.println("{\"bambi\":\"moving\", \"target\":\"open\"}");
  } else if (cmd == "CLOSE") {
    moveBambi(POS_CLOSED);
    Serial.println("{\"bambi\":\"moving\", \"target\":\"closed\"}");
  }
}