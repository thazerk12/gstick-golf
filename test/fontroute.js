// Serves the game's Google Fonts request from local files (the sandbox can't reach Google Fonts).
// Fraunces is a static instance cut from the variable font at ital 1, opsz 9, wght 900, SOFT 50, WONK 1,
// the same cut the game's font URL pins. usage: await require('./fontroute')(page)
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, 'fonts');
const FACES = [
  ['Archivo', 'normal', 400, 'archivo-latin-400-normal.woff2'],
  ['Archivo', 'normal', 500, 'archivo-latin-500-normal.woff2'],
  ['Archivo', 'normal', 600, 'archivo-latin-600-normal.woff2'],
  ['Archivo', 'normal', 700, 'archivo-latin-700-normal.woff2'],
  ['Archivo', 'normal', 800, 'archivo-latin-800-normal.woff2'],
  ['Big Shoulders Display', 'normal', 700, 'big-shoulders-display-latin-700-normal.woff2'],
  ['Big Shoulders Display', 'normal', 800, 'big-shoulders-display-latin-800-normal.woff2'],
  ['Big Shoulders Display', 'normal', 900, 'big-shoulders-display-latin-900-normal.woff2'],
  ['Fraunces', 'italic', 900, 'fraunces-i900-o9-s50-w1.woff2'],
];
module.exports = async function routeFonts(page) {
  const css = FACES.map(([fam, st, w, f]) => `@font-face{font-family:'${fam}';font-style:${st};font-weight:${w};font-display:swap;src:url(https://fonts.gstatic.com/local/${f}) format('woff2');}`).join('\n');
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', headers: { 'access-control-allow-origin': '*' }, body: css }));
  await page.route('**/fonts.gstatic.com/**', r => {
    const f = path.basename(new URL(r.request().url()).pathname);
    const p = path.join(DIR, f);
    if (!fs.existsSync(p)) return r.abort();
    r.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(p) });
  });
};
