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

      // Modal backdrops explicitly
      content = content.replace(/bg-black\/[0-9]+/g, 'bg-[#000000B3]');
      content = content.replace(/bg-gray-900\/[0-9]+/g, 'bg-[#111827B3]');
      content = content.replace(/bg-white\/[0-9]+/g, 'bg-[#FFFFFF80]');
      
      // General background opacity
      content = content.replace(/bg-([a-z]+)-([0-9]+)\/([0-9]+)/g, 'bg-$1-$2');
      
      // General border opacity
      content = content.replace(/border-([a-z]+)-([0-9]+)\/([0-9]+)/g, 'border-$1-$2');
      
      // General text opacity
      content = content.replace(/text-([a-z]+)-([0-9]+)\/([0-9]+)/g, 'text-$1-$2');
      
      // General shadow opacity (if any)
      content = content.replace(/shadow-([a-z]+)-([0-9]+)\/([0-9]+)/g, 'shadow-$1-$2');
      
      // General ring opacity
      content = content.replace(/ring-([a-z]+)-([0-9]+)\/([0-9]+)/g, 'ring-$1-$2');

      // Specific weird ones
      content = content.replace(/bg-slate-([0-9]+)\/([0-9]+)/g, 'bg-slate-$1');
      content = content.replace(/text-white\/([0-9]+)/g, 'text-gray-200');

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
        console.log('Processed opacities in', fullPath);
      }
    }
  }
}

processDir(path.join(__dirname, 'src'));
