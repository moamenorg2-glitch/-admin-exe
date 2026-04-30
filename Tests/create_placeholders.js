import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const validPngBuffer = Buffer.from(validPngBase64, 'base64');

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

fs.writeFileSync(path.join(assetsDir, 'icon.png'), validPngBuffer);
fs.writeFileSync(path.join(assetsDir, 'splash.png'), validPngBuffer);

console.log('Created valid placeholder icon.png and splash.png in assets folder.');
