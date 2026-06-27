const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

const newKeys = {
  "dashboard": {
    "percent_completed": {
      "en": "completed",
      "de": "abgeschlossen",
      "fr": "terminé",
      "es": "completado",
      "it": "completato",
      "nl": "voltooid",
      "pl": "ukończono",
      "zh": "已完成",
      "ja": "完了",
      "ko": "완료"
    },
    "printer_status": {
      "en": "Printer Status",
      "de": "Drucker Status",
      "fr": "Statut de l'imprimante",
      "es": "Estado de la impresora",
      "it": "Stato stampante",
      "nl": "Printerstatus",
      "pl": "Status drukarki",
      "zh": "打印机状态",
      "ja": "プリンターステータス",
      "ko": "프린터 상태"
    }
  },
  "settings": {
    "add_printer": {
      "en": "Add New Printer",
      "de": "Neuen Drucker hinzufügen",
      "fr": "Ajouter une nouvelle imprimante",
      "es": "Agregar nueva impresora",
      "it": "Aggiungi nuova stampante",
      "nl": "Nieuwe printer toevoegen",
      "pl": "Dodaj nową drukarkę",
      "zh": "添加新打印机",
      "ja": "新しいプリンターを追加",
      "ko": "새 프린터 추가"
    },
    "delete_printer": {
      "en": "Delete Printer",
      "de": "Drucker löschen",
      "fr": "Supprimer l'imprimante",
      "es": "Eliminar impresora",
      "it": "Elimina stampante",
      "nl": "Printer verwijderen",
      "pl": "Usuń drukarkę",
      "zh": "删除打印机",
      "ja": "プリンターを削除",
      "ko": "프린터 삭제"
    }
  },
  "states": {
    "printer": {
      "offline": {
        "en": "Offline",
        "de": "Offline",
        "fr": "Hors ligne",
        "es": "Desconectado",
        "it": "Offline",
        "nl": "Offline",
        "pl": "Offline",
        "zh": "离线",
        "ja": "オフライン",
        "ko": "오프라인"
      }
    }
  },
  "gcode": {
    "hook": {
      "warning_title": {
        "de": "Wichtig: Einstellungen anpassen!",
        "en": "Important: Adjust Settings!",
        "fr": "Important: Ajustez les paramètres!",
        "es": "Importante: ¡Ajustar configuraciones!",
        "it": "Importante: Modifica le impostazioni!",
        "nl": "Belangrijk: Instellingen aanpassen!",
        "pl": "Ważne: Dostosuj ustawienia!",
        "zh": "重要提示：调整设置！",
        "ja": "重要：設定を調整してください！",
        "ko": "중요: 설정 조정!"
      },
      "warning_height_title": {
        "de": "Druckhöhe reduzieren:",
        "en": "Reduce printable height:",
        "fr": "Réduire la hauteur d'impression:",
        "es": "Reducir altura de impresión:",
        "it": "Riduci l'altezza di stampa:",
        "nl": "Afdrukhoogte verlagen:",
        "pl": "Zmniejsz wysokość druku:",
        "zh": "降低打印高度：",
        "ja": "印刷高さを減らす：",
        "ko": "인쇄 높이 줄이기:"
      },
      "warning_height_desc": {
        "de": "Verringere die maximale Druckhöhe (Printable height) in den Druckereinstellungen um die exakte Länge der montierten Haken.",
        "en": "Decrease the maximum printable height in the printer settings by the exact length of the mounted hooks.",
        "fr": "Diminuez la hauteur maximale d'impression dans les paramètres de l'imprimante de la longueur exacte des crochets montés.",
        "es": "Disminuya la altura máxima de impresión en la configuración de la impresora por la longitud exacta de los ganchos montados.",
        "it": "Riduci l'altezza massima di stampa nelle impostazioni della stampante dell'esatta lunghezza dei ganci montati.",
        "nl": "Verlaag de maximale afdrukhoogte in de printerinstellingen met de exacte lengte van de gemonteerde haken.",
        "pl": "Zmniejsz maksymalną wysokość druku w ustawieniach drukarki o dokładną długość zamontowanych haków.",
        "zh": "在打印机设置中，将最大打印高度减去安装挂钩的确切长度。",
        "ja": "プリンター設定の最大印刷高さを、取り付けたフックの正確な長さに応じて減らします。",
        "ko": "프린터 설정에서 장착된 후크의 정확한 길이만큼 최대 인쇄 높이를 줄이십시오."
      },
      "warning_startcode_title": {
        "de": "Start-Gcode prüfen:",
        "en": "Check Start G-code:",
        "fr": "Vérifier le G-code de démarrage:",
        "es": "Revisar G-code de inicio:",
        "it": "Controlla G-code di avvio:",
        "nl": "Start G-code controleren:",
        "pl": "Sprawdź G-code startowy:",
        "zh": "检查起始 G-code：",
        "ja": "開始 G-code を確認：",
        "ko": "시작 G-code 확인:"
      },
      "warning_startcode_desc": {
        "de": "Achtung: Das Ändern der 'Printable height' ändert oft NICHT automatisch hartkodierte Werte im Start-Gcode! Prüfe den Machine Start G-code auf Z-Limit-Befehle (wie 'G28 Z P0 T...') und reduziere diese manuell um die Haken-Länge, sonst kracht das Bett beim Homing unten rein!",
        "en": "Warning: Changing the 'Printable height' often DOES NOT automatically change hardcoded values in the Start G-code! Check the Machine Start G-code for Z-limit commands (like 'G28 Z P0 T...') and reduce them manually by the hook length, otherwise the bed will crash during homing!",
        "fr": "Attention: Modifier la 'Printable height' ne change souvent PAS automatiquement les valeurs codées en dur dans le G-code de démarrage! Vérifiez le G-code de démarrage pour les commandes de limite Z (comme 'G28 Z P0 T...') et réduisez-les manuellement de la longueur du crochet, sinon le plateau s'écrasera lors du retour à l'origine!",
        "es": "Advertencia: ¡Cambiar la 'Printable height' a menudo NO cambia automáticamente los valores codificados en el G-code de inicio! Revise el G-code de inicio para los comandos de límite Z (como 'G28 Z P0 T...') y redúzcalos manualmente según la longitud del gancho, de lo contrario la cama chocará durante el homing.",
        "it": "Attenzione: Modificare la 'Printable height' spesso NON cambia automaticamente i valori nel G-code di avvio! Controlla il G-code di avvio per i comandi limite Z (come 'G28 Z P0 T...') e riducili manualmente della lunghezza del gancio, altrimenti il letto si schianterà durante l'homing!",
        "nl": "Waarschuwing: Het wijzigen van de 'Printable height' verandert vaak NIET automatisch de hardgecodeerde waarden in de Start G-code! Controleer de Start G-code voor Z-limiet commando's (zoals 'G28 Z P0 T...') en verlaag deze handmatig met de haaklengte, anders crasht het bed tijdens het homen!",
        "pl": "Uwaga: Zmiana 'Printable height' często NIE zmienia automatycznie zahardkodowanych wartości w G-code startowym! Sprawdź G-code startowy pod kątem komend limitu Z (jak 'G28 Z P0 T...') i zmniejsz je ręcznie o długość haka, w przeciwnym razie łóżko zderzy się podczas powrotu do bazy!",
        "zh": "警告：更改“可打印高度”通常不会自动更改起始 G-code 中的硬编码值！请检查机器起始 G-code 中的 Z 限制命令（如 'G28 Z P0 T...'），并根据挂钩长度手动减少它们，否则热床在回零时会发生碰撞！",
        "ja": "警告：'Printable height'を変更しても、開始G-codeのハードコードされた値が自動的に変更されるとは限りません！Z制限コマンド（'G28 Z P0 T...'など）の開始G-codeを確認し、フックの長さ分だけ手動で減らしてください。そうしないと、ホーミング時にベッドが衝突します！",
        "ko": "경고: '인쇄 가능 높이'를 변경해도 시작 G-code의 하드코딩된 값이 자동으로 변경되지 않는 경우가 많습니다! Z-제한 명령('G28 Z P0 T...'와 같은)에 대해 기계 시작 G-code를 확인하고 후크 길이만큼 수동으로 줄이십시오. 그렇지 않으면 호밍 중 베드가 충돌합니다!"
      }
    }
  }
};

for (const file of files) {
  const lang = file.replace('.json', '');
  const filePath = path.join(localesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const updateObj = (target, source) => {
    for (const key in source) {
      if (typeof source[key] === 'object' && !source[key][lang]) {
        if (!target[key]) target[key] = {};
        updateObj(target[key], source[key]);
      } else if (source[key][lang]) {
        target[key] = source[key][lang];
      }
    }
  };

  updateObj(data, newKeys);

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log('Updated ' + file);
}
