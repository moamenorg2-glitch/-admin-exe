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
      if (content.includes('backdrop-blur') || content.includes('mix-blend')) {
        content = content.replace(/backdrop-blur(-\w+)?/g, '');
        content = content.replace(/mix-blend(-\w+)?/g, '');
        fs.writeFileSync(fullPath, content);
        console.log('Fixed', fullPath);
      }
    }
  }
}

processDir(path.join(__dirname, 'src'));
