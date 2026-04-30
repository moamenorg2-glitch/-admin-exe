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
      if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
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
    // Basic heuristics to find un-awaited, un-returned promises in UI callbacks.
    if (line.includes('supabase.') && !line.includes('await ') && !line.includes('return ') && !line.includes('.then') && !line.includes('.catch') && !line.includes('on(')) {
        if (!line.includes('import ') && !line.trim().startsWith('//')) {
            console.log(`${file}:${index + 1} -> ${line.trim()}`);
        }
    }
  });
});
