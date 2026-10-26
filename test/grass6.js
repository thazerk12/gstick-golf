// Round 6 Task 3: rounds 4, 5 and 6 side by side at address (390x844): the driver on the tee and a 7-iron from the fairway,
// same hole, same spot, each build's own address camera, settled. Writes one PNG per build and club, then a side-by-side sheet
// (needs python3 + PIL). Also logs the ball's screen position and drawn size, and the camera's height and distance.
// usage: node test/grass6.js <outdir> <label>=<page.html> [<label>=<page.html> ...]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const OUT = process.argv[2] || '/tmp/grass6'; fs.mkdirSync(OUT, { recursive: true });
const BUILDS = process.argv.slice(3).map(a => a.split('='));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const log = [];
  for (const [label, src] of BUILDS) {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
    await require('./fontroute')(page);
    const f = path.join(OUT, 'g_' + label + '.html');
    fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(path.resolve(src), 'utf8') + '</body></html>');
    await page.goto('file://' + f);
    await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
    await page.evaluate(() => { const T = window.__tempo; T.save().seenHow = true; T.save().shots = 99; if (T.save().settings) T.save().settings.cam = 'std'; T.startRound({ kind: 'quick', seed: 'frame-4', tier: 2, course: 0 }); T.G.manual = true; for (let i = 0; i < 240; i++) T.tick(1 / 60, false); });
    for (const id of ['DR', '7I']) {
      const r = await page.evaluate((id) => {
        const T = window.__tempo, G = T.G, E = T.E, h = G.hole, ci = E.CLUBS.findIndex(c => c.id === id);
        let bx = 0, bz = 0.6; if (ci > 0) { const p = h.pointAtS(Math.min(h.len - 60, 230)); bx = p.x; bz = p.z; }
        G.ball.place(h, bx, bz); G.ball.state = 'rest'; G.lie = h.surface(bx, bz); G.club = ci; G.mode = 'aim'; G.map = false; G.swing = null; G.shot = null; G.camOrbit = null;
        G.aim = Math.atan2(h.pin.x - bx, h.pin.z - bz); if ('camYaw' in G) { G.camYaw = null; G.camLock = false; }
        const b = document.getElementById('banner'), t = document.getElementById('toast'); if (b) b.classList.remove('show'); if (t) t.classList.remove('show');
        T.setupClub(ci); T.tick(1 / 60, false); T.snap(); for (let i = 0; i < 90; i++) T.tick(1 / 60, false); T.tick(1 / 60, true);
        const cam = T.camera, v = new THREE.Vector3(); cam.updateMatrixWorld(); v.copy(T.ballMesh.position).project(cam);
        return { ball: [+(50 + v.x * 50).toFixed(1), +(50 - v.y * 50).toFixed(1)], ballScale: T.state().ballScale, camUp: +(cam.position.y - G.ball.y).toFixed(2), camBack: +Math.hypot(cam.position.x - bx, cam.position.z - bz).toFixed(2), fov: +cam.fov.toFixed(1) };
      }, id);
      await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => { window.__tempo.tick(0, true); requestAnimationFrame(() => res()); })));
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `grass_${id}_${label}.png`), timeout: 180000 });
      log.push(Object.assign({ build: label, club: id }, r));
      console.log(label, id, JSON.stringify(r));
    }
    if (errs.length) console.log(label, 'errors', errs);
    await page.close();
  }
  fs.writeFileSync(path.join(OUT, 'grass6.json'), JSON.stringify(log, null, 1));
  // side by side: one row per club, one column per build, full width plus a 2x crop of the grass in front of the ball
  const py = `
from PIL import Image, ImageDraw
import json, sys
out, labels = sys.argv[1], sys.argv[2].split(',')
log = json.load(open(f'{out}/grass6.json'))
for club in ['DR', '7I']:
    ims = [Image.open(f'{out}/grass_{club}_{l}.png').convert('RGB') for l in labels]
    w, h = ims[0].size
    sheet = Image.new('RGB', (len(ims) * (w // 2 + 20), h // 2 + 40 + 420), 'white')
    d = ImageDraw.Draw(sheet)
    for i, (im, l) in enumerate(zip(ims, labels)):
        x = i * (w // 2 + 20)
        sheet.paste(im.resize((w // 2, h // 2)), (x, 30))
        d.text((x + 6, 8), l, fill='black')
        # the grass just in front of (below) the ball, 2x: a 195 x 200 CSS px box, its top 10 px above the ball
        b = [r for r in log if r['build'] == l and r['club'] == club][0]['ball']
        bx, by = int(w * b[0] / 100), int(h * b[1] / 100)
        crop = im.crop((bx - 195, by - 20, bx + 195, by + 380)).resize((w // 2, 400))
        sheet.paste(crop, (x, h // 2 + 40))
    sheet.save(f'{out}/grass_{club}_side_by_side.png')
`;
  try { execFileSync('python3', ['-c', py, OUT, BUILDS.map(b => b[0]).join(',')]); } catch (e) { console.log('sheet failed', e.message); }
  await browser.close();
})();
