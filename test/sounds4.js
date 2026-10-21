// Round 4 Task 3b/3f sounds: renders the tree (canopy, trunk), cup and rattle voices in an OfflineAudioContext (48 kHz),
// measures attack, time to -40 dB and spectral centroid, counts oscillators created, writes WAVs to test/sounds/.
// Also renders a whole hole-out (cup + rattles at the times and speeds the drop animation produced).
// usage: node test/sounds4.js [page.html] [out.json] [holeout4.json]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = process.argv[2] || path.join(__dirname, '../tempo-golf.html');
const OUTF = process.argv[3] || '/tmp/sounds4.json';
const HO = process.argv[4];
const WAVDIR = path.join(__dirname, 'sounds'); fs.mkdirSync(WAVDIR, { recursive: true });
function wav(file, data, sr) {
  const n = data.length, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(data[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(file, buf);
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(path.dirname(OUTF), 'snd4_' + path.basename(SRC));
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  const hits = HO ? JSON.parse(fs.readFileSync(HO, 'utf8')).res.out.map(o => ({ name: o.name, hits: o.hits })) : [];
  const res = await page.evaluate(async (hits) => {
    const T = window.__tempo, SR = 48000;
    let osc = 0; const orig = OfflineAudioContext.prototype.createOscillator;
    OfflineAudioContext.prototype.createOscillator = function () { osc++; return orig.call(this); };
    const an = (x) => {
      const W = 12, env = []; for (let i = 0; i + W <= x.length; i += W) { let s = 0; for (let j = i; j < i + W; j++) s += x[j] * x[j]; env.push(Math.sqrt(s / W)); }
      let pk = 0, ip = 0; for (let i = 0; i < env.length; i++) if (env[i] > pk) { pk = env[i]; ip = i; }
      let on = 0; for (let i = 0; i < env.length; i++) if (env[i] > pk * 0.01) { on = i; break; }
      let end = on; for (let i = env.length - 1; i >= 0; i--) if (env[i] >= pk * 0.01) { end = i; break; }
      // centroid by DFT over the sound (Hann), 20 Hz - 20 kHz
      const a = on * W, b = Math.min(x.length, (end + 1) * W); let N = 4096; while (N < b - a) N <<= 1;
      let sw = 0, s = 0;
      for (let k = 1; k < N / 2; k += 2) { const fq = k * SR / N; if (fq < 20 || fq > 20000) continue; let re = 0, im = 0; for (let i = a; i < b; i++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * (i - a) / (b - a)), ph = -2 * Math.PI * k * (i - a) / N; re += x[i] * w * Math.cos(ph); im += x[i] * w * Math.sin(ph); } const m = Math.hypot(re, im); sw += fq * m; s += m; }
      let peak = 0; for (const v of x) peak = Math.max(peak, Math.abs(v));
      return { attackMs: +((ip - on) * W / SR * 1000).toFixed(2), to40dBMs: +((end - on) * W / SR * 1000).toFixed(1), centroidHz: Math.round(sw / s), peakDbfs: +(20 * Math.log10(peak)).toFixed(1) };
    };
    const render = async (fn, dur) => { const c = new OfflineAudioContext(1, Math.round(SR * dur), SR); fn(c); const buf = await c.startRendering(); return Array.from(buf.getChannelData(0)); };
    const out = { voices: [], wavs: {}, osc: 0 };
    for (const [name, kind, amt] of [['tree-canopy', 'canopy', 1], ['tree-canopy-soft', 'canopy', 0.4], ['tree-trunk', 'trunk', 1], ['cup', 'cup', 0.9], ['rattle', 'rattle', 0.5]]) {
      osc = 0; const x = await render((c) => T.Snd.renderInto(c, kind, 0, amt), 0.4);
      out.voices.push(Object.assign({ name, kind, amt, oscillators: osc }, an(x))); out.wavs[name] = x;
    }
    // whole hole-outs: the first contact is 'cup', later ones 'rattle' (as the game plays them)
    for (const H of hits) {
      osc = 0; let first = true, last = -1;
      const x = await render((c) => { for (const [ms, kind, v] of H.hits) { const t = 0.01 + ms / 1000; if (first) { T.Snd.renderInto(c, 'cup', 0, Math.min(1, v / 1.5), 0, t); first = false; last = ms; } else if (v >= 0.1 && ms - last >= 40) { T.Snd.renderInto(c, 'rattle', 0, Math.min(1, v / 0.8), 0, t); last = ms; } } }, 0.8);
      out.wavs['holeout-' + H.name.replace(/[^a-z]+/g, '-')] = x; out.voices.push({ name: 'hole-out: ' + H.name, oscillators: osc });
    }
    return out;
  }, hits);
  for (const k in res.wavs) wav(path.join(WAVDIR, k + '.wav'), res.wavs[k], 48000);
  delete res.wavs;
  fs.writeFileSync(OUTF, JSON.stringify({ errors: errs, res }, null, 1));
  for (const v of res.voices) console.log(JSON.stringify(v));
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors');
  await browser.close();
})();
