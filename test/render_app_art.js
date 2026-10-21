// Renders the G$ app icon and the iPhone launch screens with the real Fraunces cut.
// usage: node test/render_app_art.js <out-dir>   (then resize into app_assets/ as listed in build.py)
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const OUT = process.argv[2];
const F = fs.readFileSync(path.join(__dirname, 'fonts', 'fraunces-i900-o9-s50-w1.woff2').toString('base64');
const A = fs.readFileSync(path.join(__dirname, 'fonts', 'archivo-latin-600-normal.woff2').toString('base64');
const CLUB = (fill, stroke) => `<svg viewBox="0 0 100 300" aria-hidden="true"><g transform="rotate(13 50 150)" fill="${fill}" stroke="${stroke}" stroke-width="5" paint-order="stroke" stroke-linejoin="round"><path d="M41 80 L59 80 L58 250 L42 250 Z"/><rect x="33" y="0" width="34" height="92" rx="17"/><path d="M60 236 L60 268 C60 284 54 292 40 292 L-4 292 C-16 292 -22 284 -20 274 C-18 266 -10 262 0 262 L34 262 C40 262 42 258 42 252 L42 236 Z"/></g></svg>`;
const BASE = `@font-face{font-family:'Fraunces';font-style:italic;font-weight:900;src:url(data:font/woff2;base64,${F}) format('woff2');}
@font-face{font-family:'Archivo';font-weight:600;src:url(data:font/woff2;base64,${A}) format('woff2');}
:root{--cream:#F3ECD8;--cream2:#E4DAC0;--green:#1F3A2A;--green2:#2F5641;--yellow:#E3B93F}
*{margin:0;padding:0;box-sizing:border-box}
.mark{font-family:'Fraunces';font-style:italic;font-weight:900;font-variation-settings:'opsz' 9,'SOFT' 50,'WONK' 1;color:var(--cream);white-space:nowrap;line-height:1}
.mark .s{position:relative;display:inline-block;margin:0 0.02em 0 0.05em}
.mark .s svg{position:absolute;overflow:visible;height:1.16em;width:0.3867em;top:-0.15em;left:calc(50% - 0.1933em + 0.01em)}
.ul{display:block;height:0.075em;background:var(--yellow);border-radius:0.04em;margin:0.06em auto 0}`;
const icon = (size, safe) => `<html><head><style>${BASE}
body{width:${size}px;height:${size}px;overflow:hidden;background:radial-gradient(120% 90% at 50% 0%, #2F5641 0%, #1F3A2A 62%, #18301f 100%)}
.wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.mark{font-size:${size * 0.47 * safe}px;transform:translate(-0.03em,-0.02em)}
</style></head><body><div class="wrap"><div class="mark">G<span class="s">S${CLUB('#E3B93F', '#1F3A2A')}</span><span class="ul" style="width:1.32em"></span></div></div></body></html>`;
const splash = (w, h) => `<html><head><style>${BASE}
body{width:${w}px;height:${h}px;overflow:hidden;background:radial-gradient(90% 55% at 50% 38%, #2F5641 0%, #1F3A2A 60%, #16291c 100%)}
.wrap{position:absolute;left:0;right:0;top:42%;transform:translateY(-50%);text-align:center}
.mark{font-size:${w * 0.155}px;display:inline-block}
.tag{font-family:'Archivo';font-weight:600;color:#E4DAC0;opacity:.8;font-size:${w * 0.034}px;letter-spacing:.08em;text-transform:uppercase;margin-top:${w * 0.05}px}
</style></head><body><div class="wrap"><div class="mark">G<span class="s">S${CLUB('#F3ECD8', '#1F3A2A')}</span>tick Golf<span class="ul" style="width:2.2em"></span></div><div class="tag">Pull back · Flick through</div></div></body></html>`;
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const shot = async (html, w, h, file) => { const p = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage(); await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150); const ok = await p.evaluate(() => document.fonts.check("italic 900 40px Fraunces")); await p.screenshot({ path: path.join(OUT, file) }); await p.close(); return ok; };
  console.log('icon', await shot(icon(1024, 1), 1024, 1024, 'icon-1024.png'));
  console.log('maskable', await shot(icon(1024, 0.78), 1024, 1024, 'icon-maskable-1024.png'));
  // iPhone launch screens (portrait, px): 6.1" (393x852 pt), 6.3" Pro (402x874 pt), 6.9" Pro Max (440x956 pt), all @3x
  for (const [w, h] of [[1179, 2556], [1206, 2622], [1320, 2868]]) console.log('splash', w, h, await shot(splash(w, h), w, h, `splash-${w}x${h}.png`));
  await browser.close();
})();
