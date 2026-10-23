// index.html içine gömülü CSS ve SVG ikon setini yeniden üretir.
// Program internet bağlantısı olmadan çalışsın diye Tailwind CDN ve Font Awesome CDN kullanılmaz;
// bunun yerine kullanılan sınıflar ve ikonlar derlenip dosyanın içine yazılır.
//
// Kullanım:  npm install   (bir kez)
//            npm run build (index.html'de sınıf veya ikon değiştirdikten sonra)
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = path.join(ROOT, 'index.html');

const CSS_BEGIN = '/* TAILWIND:BEGIN */';
const CSS_END = '/* TAILWIND:END */';
const ICON_BEGIN = '<!-- IKONLAR:BEGIN -->';
const ICON_END = '<!-- IKONLAR:END -->';

function replaceBetween(src, begin, end, content) {
  const a = src.indexOf(begin);
  const b = src.indexOf(end);
  if (a < 0 || b < 0 || b < a) throw new Error(`İşaretler bulunamadı: ${begin} … ${end}`);
  return src.slice(0, a + begin.length) + '\n' + content + '\n' + src.slice(b);
}

function stripGenerated(src) {
  return replaceBetween(replaceBetween(src, CSS_BEGIN, CSS_END, ''), ICON_BEGIN, ICON_END, '');
}

// ---------- 1. Tailwind CSS ----------
function buildCss(src) {
  const twPkg = path.join(path.dirname(require.resolve('tailwindcss/package.json')), 'lib', 'cli.js');
  const tmpDir = path.join(ROOT, 'node_modules', '.build');
  execFileSync('mkdir', ['-p', tmpDir]);
  const scanFile = path.join(tmpDir, 'scan.html');
  writeFileSync(scanFile, stripGenerated(src));
  const cfgFile = path.join(tmpDir, 'tailwind.config.cjs');
  writeFileSync(cfgFile, `module.exports = {
  content: [${JSON.stringify(scanFile)}],
  theme: { extend: {
    fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
                  mono: ['JetBrains Mono', 'ui-monospace', 'Consolas', 'monospace'] },
    colors: { brand: { 50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a' } }
  } }
};`);
  const inFile = path.join(tmpDir, 'in.css');
  writeFileSync(inFile, '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
  const outFile = path.join(tmpDir, 'out.css');
  execFileSync(process.execPath, [twPkg, '-c', cfgFile, '-i', inFile, '-o', outFile, '--minify'], { stdio: 'pipe' });
  return readFileSync(outFile, 'utf8').trim();
}

// ---------- 2. SVG ikon seti (Font Awesome Free Solid, CC BY 4.0) ----------
function buildIcons(src) {
  const icons = require('@fortawesome/free-solid-svg-icons');
  const clean = stripGenerated(src);
  const names = new Set();
  for (const m of clean.matchAll(/#i-([a-z0-9-]+)/g)) names.add(m[1]);
  // ic(...) çağrılarındaki tüm sabit adlar (ternary dahil) ve /* ikonlar: a b c */ yorumları
  // (ikinci argüman CSS sınıfıdır; yalnızca Font Awesome'da karşılığı olan adlar alınır)
  const exists = n => !!icons['fa' + n.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('')];
  for (const m of clean.matchAll(/\bic\(([^)]*)\)/g)) for (const q of m[1].matchAll(/'([a-z0-9-]+)'/g)) if (exists(q[1])) names.add(q[1]);
  for (const m of clean.matchAll(/\/\* ikonlar: ([a-z0-9 -]+) \*\//g)) m[1].trim().split(/\s+/).forEach(n => names.add(n));
  for (const m of clean.matchAll(/data-ic="([a-z0-9-]+)"/g)) names.add(m[1]);
  const symbols = [...names].sort().map(n => {
    const key = 'fa' + n.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('');
    const def = icons[key];
    if (!def) throw new Error(`Font Awesome ikonu bulunamadı: ${n} (${key})`);
    const [w, h, , , d] = def.icon;
    const paths = (Array.isArray(d) ? d : [d]).map(p => `<path d="${p}"/>`).join('');
    return `<symbol id="i-${n}" viewBox="0 0 ${w} ${h}">${paths}</symbol>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true"><!-- Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0) -->${symbols.join('')}</svg>`;
}

let src = readFileSync(HTML, 'utf8');
src = replaceBetween(src, CSS_BEGIN, CSS_END, buildCss(src));
src = replaceBetween(src, ICON_BEGIN, ICON_END, buildIcons(src));
writeFileSync(HTML, src);
console.log('index.html güncellendi: gömülü CSS ve ikonlar yeniden üretildi.');
