import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const iconSrc = path.join(rootDir, 'assets', 'icon.png');
const splashSrc = path.join(rootDir, 'assets', 'splash.png');
const resDir = path.join(rootDir, 'android/app/src/main/res');

if (!fs.existsSync(resDir)) {
  console.log('Android resource directory not found. Skipping distribution.');
  process.exit(0);
}

const copyToRes = (src, pattern) => {
  if (!fs.existsSync(src)) {
    console.log(`Source ${src} not found. Skipping.`);
    return;
  }
  const buffer = fs.readFileSync(src);
  const dirs = fs.readdirSync(resDir);
  dirs.forEach(dir => {
    if (dir.startsWith('mipmap-') || dir.startsWith('drawable-')) {
      const fullDir = path.join(resDir, dir);
      const files = fs.readdirSync(fullDir);
      files.forEach(file => {
        if (file.includes(pattern) && file.endsWith('.png')) {
          fs.writeFileSync(path.join(fullDir, file), buffer);
          console.log(`Updated: ${path.join(dir, file)}`);
        }
      });
    }
  });
};

console.log('Distributing assets to Android resources...');
copyToRes(iconSrc, 'ic_launcher');
copyToRes(splashSrc, 'splash');
console.log('Asset distribution complete.');
