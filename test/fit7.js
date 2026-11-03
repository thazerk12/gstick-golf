// Round 7 Task 1: do a full and a 112% pull fit from where the chevron sits? For DR, 7I and the putter at address, at
// 390x844, 430x932 and 360x780 (no safe-area insets in Chromium), and at 402x874 with a 34 px bottom inset applied to the
// game's inset probe (the iPhone 17 Pro's home-screen app): swingLen, the ball's and the chevron's y, where a 100% and a 112%
// pull from the chevron end, and the room left above the bottom edge (and above the inset).
// usage: node test/fit7.js <page.html> <out.json>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUTF = process.argv[3] || '/tmp/fit7.json';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = [];
  for (const [W, H, inset] of [[390, 844, 0], [430, 932, 0], [360, 780, 0], [402, 874, 34]]) {
    const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })).newPage();
    await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
    await page.route('**/fonts.*/**', r => r.abort());
    const f = path.join(path.dirname(OUTF), 'fit7_' + W + '.html');
    fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
    await page.goto('file://' + f);
    await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
    if (inset) { await page.evaluate((b) => { document.getElementById('safeProbe').style.paddingBottom = b + 'px'; }, inset); await page.setViewportSize({ width: W, height: H - 1 }); await page.setViewportSize({ width: W, height: H }); }
    const r = await page.evaluate((inset) => {
      const T = window.__tempo, G = T.G, E = T.E; T.save().seenHow = true;
      T.startRound({ kind: 'quick', seed: 'frame-4', tier: 2, course: 0 }); G.manual = true;
      for (let i = 0; i < 900 && G.mode !== 'aim'; i++) T.tick(1 / 60, false);
      const h = G.hole, res = [];
      for (const id of ['DR', '7I', 'PT']) {
        let x = 0, z = 0.6;
        if (id === 'PT') { for (let a = 0; a < 72; a++) { const t = a * Math.PI / 36, px = h.pin.x + Math.sin(t) * 6, pz = h.pin.z + Math.cos(t) * 6; if (h.surface(px, pz) === E.S.GREEN) { x = px; z = pz; break; } } }
        else if (id === '7I') { const q = h.pointAtS(h.len - 150); x = q.x; z = q.z; }
        G.ball.place(h, x, z); G.ball.state = 'rest'; G.lie = h.surface(x, z); G.club = E.CLUBS.findIndex(c => c.id === id); G.aim = Math.atan2(h.pin.x - x, h.pin.z - z); G.mode = 'aim'; G.camYaw = null;
        T.setupClub(G.club); T.tick(1 / 60, false); T.snap(); for (let i = 0; i < 60; i++) T.tick(1 / 60, false);
        const L = T.swingLen(), c = T.chevronAt(), b = T.ballScreen(), VH = innerHeight;
        res.push({ club: id, VH, inset, L: +L.toFixed(1), ballY: +b[1].toFixed(1), chevY: +c[1].toFixed(1), chevVsBall: +(c[1] - b[1]).toFixed(1), full: +(c[1] + L).toFixed(1), over112: +(c[1] + 1.12 * L).toFixed(1), roomFull: +(VH - inset - (c[1] + L)).toFixed(1), room112: +(VH - inset - (c[1] + 1.12 * L)).toFixed(1) });
      }
      return res;
    }, inset);
    for (const q of r) { q.size = W + 'x' + H + (inset ? ' (inset ' + inset + ')' : ''); out.push(q); console.log(q.size, q.club, 'swingLen', q.L, '| ball y', q.ballY, 'chevron y', q.chevY, '(' + (q.chevVsBall >= 0 ? q.chevVsBall + ' px below' : -q.chevVsBall + ' px above') + ' the ball) | 100% ends', q.full, ', 112% ends', q.over112, '| room left', q.roomFull, '/', q.room112, 'px'); }
    await page.close();
  }
  fs.writeFileSync(OUTF, JSON.stringify(out, null, 1));
  await browser.close();
})();
