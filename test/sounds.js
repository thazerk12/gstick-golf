// Renders every club impact in an OfflineAudioContext (48 kHz), measures attack, time to -40 dB and spectral centroid,
// counts oscillators created, and writes WAVs to test/sounds/. Also renders a full-driver whoosh from the game's own
// per-frame whoosh values (logged from a simulated swing) plus its impact, and logs whoosh gain against club speed.
// usage: OUT=<dir> node test/sounds.js [page.html] [out.json]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT || '/tmp';
const SRC = process.argv[2] || path.join(__dirname, '../tempo-golf.html');
const OUTF = process.argv[3] || OUT + '/sounds.json';
const WAVDIR = path.join(__dirname, 'sounds');
fs.mkdirSync(WAVDIR, { recursive: true });
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    const real = performance.now.bind(performance);
    window.__sim = { on: false, t: 0 };
    performance.now = () => (window.__sim.on ? window.__sim.t : real());
  });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.*/**', r => r.abort());
  const f = OUT + '/snd_' + path.basename(SRC);
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });

  // analysis helpers live in the page
  await page.evaluate(() => {
    window.__an = (x, sr) => {
      // envelope: RMS over 0.25 ms windows
      const W = Math.max(1, Math.round(sr * 0.00025)), env = [];
      for (let i = 0; i + W <= x.length; i += W) { let s = 0; for (let j = i; j < i + W; j++) s += x[j] * x[j]; env.push(Math.sqrt(s / W)); }
      let pk = 0, ip = 0; for (let i = 0; i < env.length; i++) if (env[i] > pk) { pk = env[i]; ip = i; }
      let on = 0; for (let i = 0; i < env.length; i++) if (env[i] > pk * 0.01) { on = i; break; }
      let end = on; for (let i = env.length - 1; i >= 0; i--) if (env[i] >= pk * 0.01) { end = i; break; }
      const dt = W / sr;
      // spectral centroid (magnitude-weighted) of the whole sound and of its first 20 ms
      const cent = (a, b) => {
        let N = 1; while (N < (b - a)) N <<= 1; N = Math.max(N, 4096);
        const re = new Float64Array(N), im = new Float64Array(N);
        for (let i = a; i < b && i - a < N; i++) re[i - a] = x[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * (i - a) / Math.max(1, b - a - 1)));
        for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
        for (let len = 2; len <= N; len <<= 1) { const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
          for (let i = 0; i < N; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
            re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
        let sw = 0, s = 0, lowE = 0, e = 0;
        for (let k = 1; k < N / 2; k++) { const fq = k * sr / N; if (fq < 20 || fq > 20000) continue; const m = Math.hypot(re[k], im[k]); sw += fq * m; s += m; e += m * m; if (fq < 150) lowE += m * m; }
        return { centroid: sw / s, below150Hz: lowE / e };
      };
      const a0 = on * W, all = cent(a0, Math.min(x.length, (end + 1) * W)), click = cent(a0, Math.min(x.length, a0 + Math.round(sr * 0.02)));
      let peakS = 0; for (const v of x) peakS = Math.max(peakS, Math.abs(v));
      let i1 = on; for (let i = on; i <= ip; i++) if (env[i] >= pk * 0.891) { i1 = i; break; }   // first time within 1 dB of the peak
      return { attackMs: (ip - on) * dt * 1000, attackTo1dBMs: (i1 - on) * dt * 1000, to40dBMs: (end - on) * dt * 1000, centroidHz: all.centroid, centroidFirst20msHz: click.centroid, energyBelow150Hz: all.below150Hz, peakDbfs: 20 * Math.log10(peakS) };
    };
  });

  const T = 'window.__tempo';
  const cases = await page.evaluate(() => {
    const E = window.__tempo.E, S = E.S;
    const T = window.__tempo, pt = (d) => Math.min(1, E.puttSpeed(T.G.hole, d) / T.FEEL.sound.putt.vFull);   // the game's putt loudness: ball speed
    return [
      ['driver', 'driver', S.TEE, 1.0, 1.0], ['7-iron-fairway', 'iron', S.FAIRWAY, 0.8, 1.0], ['wedge', 'wedge', S.FAIRWAY, 0.62, 1.0],
      ['rough', 'iron', S.ROUGH, 0.8, 1.0], ['sand', 'wedge', S.SAND, 0.55, 1.0], ['putt-3m', 'putt', S.GREEN, pt(3), pt(3)], ['putt-10m', 'putt', S.GREEN, pt(10), pt(10)], ['putt-15m', 'putt', S.GREEN, pt(15), pt(15)],
      // extra rows for the table only
      ['3-wood-fairway', 'wood', S.FAIRWAY, 0.95, 1.0], ['driver-half', 'driver', S.TEE, 0.5, 0.5],
      ['7-iron click only', 'iron', S.FAIRWAY, 0.8, 1.0, 'turf'], ['wedge click only', 'wedge', S.FAIRWAY, 0.62, 1.0, 'turf'], ['turf only (7-iron)', 'iron', S.FAIRWAY, 0.8, 1.0, 'click'],
      ['rough click only', 'iron', S.ROUGH, 0.8, 1.0, 'turf,swish'], ['sand thump only', 'wedge', S.SAND, 0.55, 1.0, 'spray,click']];
  });
  const res = { impacts: [], errors: errs };
  for (const [name, kind, lie, amt, pw, mute] of cases) {
    const r = await page.evaluate(async ([kind, lie, amt, pw, mute]) => {
      const F = window.__tempo.FEEL.sound, saved = JSON.stringify(F);
      for (const m of (mute || '').split(',')) { if (m === 'turf') F.turf.gain = 0; if (m === 'swish') F.rough.swish.gain = 0; if (m === 'spray') F.sand.spray.gain = 0; if (m === 'click') { F[kind].gain = 0; } }
      const sr = 48000, oc = new OfflineAudioContext(1, Math.round(sr * 0.7), sr);
      let osc = 0; const co = oc.createOscillator.bind(oc); oc.createOscillator = () => { osc++; return co(); };
      window.__tempo.Snd.renderInto(oc, kind, lie, amt, pw);
      const buf = await oc.startRendering(), x = buf.getChannelData(0);
      const an = window.__an(x, sr);
      const restore = JSON.parse(saved); (function deep(a, b) { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) deep(a[k], b[k]); else a[k] = b[k]; } })(F, restore);
      return { an, osc, data: Array.from(x) };
    }, [kind, lie, amt, pw, mute || '']);
    if (!name.includes('3-wood') && !name.includes('half') && !mute) wav(path.join(WAVDIR, name + '.wav'), r.data, 48000);
    res.impacts.push({ name, kind, amt: +amt.toFixed(3), oscillators: r.osc, ...Object.fromEntries(Object.entries(r.an).map(([k, v]) => [k, +v.toFixed(k === 'energyBelow150Hz' ? 4 : 1)])) });
  }

  // whoosh: a full driver swing in the game, frames stepped at 60 Hz; log whoosh gain and club speed per frame
  const wl = await page.evaluate(() => {
    const T = window.__tempo, G = T.G, CV = T.CV, sim = window.__sim;
    T.save().seenHow = true; T.startRound({ kind: 'quick', seed: 'sim-b', tier: 4, course: 0 });
    G.manual = true; sim.base = performance.now(); sim.on = true; sim.t = sim.base;
    let k = 0, hitT = null, hitV = CV.hit;
    Object.defineProperty(CV, 'hit', { configurable: true, get: () => hitV, set: (v) => { hitV = v; if (v && hitT == null) hitT = k / 60; } });
    const ev = (type, x, y) => (type === 'pointerdown' ? document.getElementById('touch') : window).dispatchEvent(new PointerEvent(type, { pointerId: 5, clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: true, pointerType: 'touch' }));
    const frame = () => { k++; sim.t = sim.base + k * 1000 / 60; T.tick(1 / 60, false); const w = T.Snd.whoosh(); return { t: k / 60, gain: w ? w.gain : 0, speed: w ? w.speed : 0, phase: CV.phase }; };
    G.ball.place(G.hole, 0, 0.6); G.ball.state = 'rest'; G.club = 0; G.mode = 'aim';
    for (let i = 0; i < 40; i++) frame();
    const L = Math.min(300, Math.max(140, innerHeight * 0.3)), D = L * 0.99, Y0 = 560, X = 195, log = [];
    ev('pointerdown', X, Y0);
    for (let i = 1; i <= 27; i++) { sim.t = sim.base + (k + 1) * 1000 / 60; ev('pointermove', X, Y0 + D * (1 - Math.pow(1 - i / 27, 2))); log.push(frame()); }
    for (let i = 1; i <= 40; i++) { sim.t = sim.base + (k + 1) * 1000 / 60; if (G.swing) ev('pointermove', X, Y0 + D - D * Math.pow(i / 12, 2)); log.push(frame()); }
    for (let i = 0; i < 40; i++) log.push(frame());
    return { hitT, log };
  });
  const tc = wl.hitT;
  const rows = wl.log.filter(r => r.gain > 0 || r.speed > 0).map(r => ({ tMs: +((r.t - tc) * 1000).toFixed(1), phase: r.phase, speedDegS: Math.round(r.speed), gain: +r.gain.toFixed(4) }));
  let pk = rows[0]; for (const r of rows) if (r.gain > pk.gain) pk = r;
  res.whoosh = { contactAt: 0, peak: pk, rows };
  // render the logged whoosh (game's own per-frame values) plus the driver impact at contact, for the WAV
  const wdata = await page.evaluate(async (rows) => {
    const sr = 48000, W = window.__tempo.FEEL.sound.whoosh, t0 = -rows[0].tMs / 1000 + 0.05, oc = new OfflineAudioContext(1, Math.round(sr * (t0 + rows[rows.length - 1].tMs / 1000 + 0.6)), sr);
    const len = sr * 2, nb = oc.createBuffer(1, len, sr), d = nb.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = oc.createBufferSource(), f = oc.createBiquadFilter(), g = oc.createGain(); s.buffer = nb; s.loop = true; f.type = 'bandpass'; f.Q.value = W.q; f.frequency.value = W.f0; g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(oc.destination); s.start(0);
    for (const r of rows) { const t = t0 + r.tMs / 1000; g.gain.setTargetAtTime(r.gain, t, W.tau); f.frequency.setTargetAtTime(W.f0 + (W.f1 - W.f0) * Math.min(1, r.speedDegS / W.vRef), t, W.tau); }
    const g2 = oc.createGain(); g2.gain.value = 0.8; g2.connect(oc.destination);   // the game's master gain
    g.disconnect(); g.connect(g2);
    window.__tempo.Snd.renderInto(oc, 'driver', window.__tempo.E.S.TEE, 1, 1, t0, g2);
    const buf = await oc.startRendering();
    return Array.from(buf.getChannelData(0));
  }, rows);
  wav(path.join(WAVDIR, 'driver-whoosh-and-impact.wav'), wdata, 48000);
  fs.writeFileSync(OUTF, JSON.stringify(res, null, 1));
  console.log('wrote ' + OUTF + (errs.length ? ' errors: ' + errs.join(' | ') : ''));
  await browser.close();
})();
