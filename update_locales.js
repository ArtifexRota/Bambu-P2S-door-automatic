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
