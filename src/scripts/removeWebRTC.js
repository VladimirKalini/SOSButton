const fs = require('fs');
const path = require('path');

/**
 * Скрипт для удаления всех WebRTC-зависимых файлов и кода
 */

// Список файлов, которые нужно полностью удалить
const filesToDelete = [
  path.join(__dirname, '../scripts/webrtcErrorHandler.js'),
  path.join(__dirname, '../scripts/simpleWebRTC.js')
];

// Удаляем файлы
console.log('Удаление WebRTC-зависимых файлов...');
filesToDelete.forEach(file => {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`✓ Удален файл: ${path.basename(file)}`);
  } else {
    console.log(`⚠ Файл не найден: ${path.basename(file)}`);
  }
});

// Список файлов, из которых нужно удалить WebRTC-зависимый код
const filesToModify = [
  {
    path: path.join(__dirname, '../components/SOSButton.jsx'),
    replacements: [
      {
        search: /import \{ diagnoseWebRTCError \} from ['"]\.\.\/scripts\/webrtcErrorHandler['"];/g,
        replace: '// WebRTC импорты удалены'
      },
      {
        search: /const peerRef = useRef\(null\);/g,
        replace: '// WebRTC ссылки удалены'
      },
      {
        search: /const initializeWebRTC = async \(\) => \{[\s\S]*?\};/g,
        replace: '// Функция initializeWebRTC удалена'
      },
      {
        search: /const diagnosis = diagnoseWebRTCError\(error\);/g,
        replace: 'const diagnosis = "Ошибка в приложении";'
      }
    ]
  },
  {
    path: path.join(__dirname, '../components/CallDetails.jsx'),
    replacements: [
      {
        search: /import \{ checkWebRTCSupport[\s\S]*?checkSignalingServer \} from ['"]\.\.\/scripts\/webrtcErrorHandler['"];/g,
        replace: '// WebRTC импорты удалены'
      },
      {
        search: /const peerRef = useRef\(null\);/g,
        replace: '// WebRTC ссылки удалены'
      },
      {
        search: /\/\/ Инициализация WebRTC[\s\S]*?addDebugInfo\('WebRTC соединение не инициализировано'\);/g,
        replace: '// WebRTC функционал удален'
      }
    ]
  }
];

// Модифицируем файлы
console.log('\nУдаление WebRTC-кода из файлов...');
filesToModify.forEach(file => {
  if (fs.existsSync(file.path)) {
    let content = fs.readFileSync(file.path, 'utf8');
    let modified = false;
    
    file.replacements.forEach(replacement => {
      const originalContent = content;
      content = content.replace(replacement.search, replacement.replace);
      if (content !== originalContent) {
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(file.path, content);
      console.log(`✓ Модифицирован файл: ${path.basename(file.path)}`);
    } else {
      console.log(`⚠ Не найдены паттерны для замены в: ${path.basename(file.path)}`);
    }
  } else {
    console.log(`⚠ Файл не найден: ${path.basename(file.path)}`);
  }
});

console.log('\nУдаление WebRTC-зависимостей завершено!'); 