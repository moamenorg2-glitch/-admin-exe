const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;

      content = content.replace(/bg-primary\/[0-9]+/g, 'bg-emerald-500');
      content = content.replace(/text-primary\/[0-9]+/g, 'text-emerald-500');
      content = content.replace(/border-primary\/[0-9]+/g, 'border-emerald-500');
      content = content.replace(/ring-primary\/[0-9]+/g, 'ring-emerald-500');

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
        console.log('Processed primary opacities in', fullPath);
      }
    }
  }
}

processDir(path.join(__dirname, 'src'));
