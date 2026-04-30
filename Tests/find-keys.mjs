import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else {
      if (filePath.endsWith('.tsx')) {
        results.push(filePath);
      }
    }
  });
  return results;
}

const files = walk('./src');
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('.map(') && !line.includes('key=') && !line.includes('//') && line.includes('<') && !line.includes('Array.')) {
      // It might be on the next line
      const nextLines = lines.slice(index, index + 3).join(' ');
      if (!nextLines.includes('key=')) {
        console.log(`${file}:${index + 1} -> ${line.trim()}`);
      }
    }
  });
});
