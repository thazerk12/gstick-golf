// Round 4 Task 3a: 50 scripted shots into canopies (driver and irons, round trees and pines, different heights and offsets).
// One tree on flat ground in the ball's path. Checks: the ball is out of the canopy within 2 physics steps, exit speed 25-55%
// of entry, exit direction within 10 deg of the reflection, straight-on hits come back toward the player, glancing hits go
// sideways, and tree events (one sound each) never closer than 0.25 s. usage: node test/trees4.js [engine.js]
const path = require('path');
const E = require(process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '../engine.js'));
E.calibrate();
const D2R = Math.PI / 180;
function holeWith(tree) { return Object.assign({}, E.FLAT, { trees: [tree], treesNear: () => [tree] }); }
function pathOf(club, power) {   // ball positions without the tree
  const sp = E.shotParams(club, power, 0, E.S.FAIRWAY), b = new E.Ball(); b.place(E.FLAT, 0, 0); b.launch(sp.speed, sp.launch, 0, sp.spin, 0);
  const P = [], ev = []; for (let n = 0; n < 4000 && b.state === 'air'; n++) { b.step(E.FLAT, E.DT, ev); P.push([b.x, b.y, b.z]); }
  return { sp, P };
}
const clubs = ['DR', '5I', '7I', '9I', 'PW'].map(id => E.CLUBS.find(c => c.id === id));
const rows = [];
let shot = 0;
for (const club of clubs) {
  const { sp, P } = pathOf(club, 1);
  const zMax = P[P.length - 1][2];
  // 10 per club: 5 round trees, 5 pines, at 20..75% of the carry, offsets from dead-on to glancing
  const cfg = [[0.18, 'round', 0, 0], [0.3, 'round', 0.45, 0.1], [0.45, 'round', 0.75, -0.2], [0.6, 'round', 0.9, 0.2], [0.72, 'round', 0.2, -0.85],
               [0.22, 'pine', 0, 0], [0.35, 'pine', 0.5, 0], [0.5, 'pine', 0.8, 0], [0.62, 'pine', 0.92, 0], [0.75, 'pine', 0.3, 0]];
  for (const [fz, kind, lat, vert] of cfg) {
    shot++;
    const zT = fz * zMax, k = P.findIndex(p => p[2] >= zT), yb = P[k][1];
    let t;
    if (kind === 'round') { const cr = 3.5; t = { x: lat * cr, z: zT, y: 0, kind: 'round', trunkH: Math.max(0.5, yb - cr - 1), trunkR: 0.32, cy: yb - vert * cr, cr, rnd: (shot * 0.6180339) % 1 }; }
    else { const cr = 2.6, ch = 9, trunkH = Math.max(0.5, yb - 4); t = { x: lat * cr * Math.min(1, (trunkH + ch - yb) / ch), z: zT, y: 0, kind: 'pine', trunkH, trunkR: 0.3, cy: 6, cr, ch, rnd: (shot * 0.6180339) % 1 }; }
    const h = holeWith(t), b = new E.Ball(); b.place(h, 0, 0); b.launch(sp.speed, sp.launch, 0, sp.spin, 0);
    const ev = [], hits = []; let n = 0, first = null, outAfter = null, before = null;
    const inside = () => {
      const dx = b.x - t.x, dz = b.z - t.z, hd = Math.hypot(dx, dz), hy = b.y - t.y;
      if (t.kind === 'pine') { const top = t.trunkH + t.ch; if (hy > top) return false; return hd < t.cr * Math.max(0, Math.min(1.1, (top - hy) / t.ch)); }
      return Math.hypot(dx, b.y - (t.y + t.cy), dz) < t.cr;
    };
    while ((b.state === 'air' || b.state === 'roll') && n < 240 * 12) {
      const v0 = [b.vx, b.vy, b.vz];
      ev.length = 0; b.step(h, E.DT, ev); n++;
      for (const e of ev) if (e.type === 'tree') { hits.push({ t: b.t, hard: e.hard }); if (!first && !e.hard) { first = Object.assign({ vinV: v0, voutV: [b.vx, b.vy, b.vz], step: n }, e); } }
      if (first && outAfter == null && n > first.step) { if (!inside()) outAfter = n - first.step; else if (n - first.step > 10) outAfter = 99; }
    }
    if (!first) { rows.push({ shot, club: club.id, kind, lat, vert, miss: true }); continue; }
    const vin = first.vinV, vout = first.voutV, si = Math.hypot(...vin), so = Math.hypot(...vout);
    const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
    const toRef = Math.acos(Math.max(-1, Math.min(1, dot(vout, [first.rx, first.ry, first.rz]) / so))) / D2R;
    const cosInc = -dot(vin, [first.nx, first.ny, first.nz]) / si;   // 1 = dead-on, 0 = grazing
    const hIn = Math.atan2(vin[0], vin[2]), hOut = Math.atan2(vout[0], vout[2]);
    let turn = (hOut - hIn) / D2R; turn = ((turn + 540) % 360) - 180;
    let minGap = Infinity; for (let i = 1; i < hits.length; i++) minGap = Math.min(minGap, hits[i].t - hits[i - 1].t);
    rows.push({ shot, club: club.id, kind, lat, vert, height: +yb.toFixed(1), vin: +si.toFixed(1), keep: +(so / si).toFixed(3), incidence: +(Math.acos(Math.min(1, cosInc)) / D2R).toFixed(0), toReflectionDeg: +toRef.toFixed(1), outInSteps: outAfter, horizTurnDeg: +turn.toFixed(0), backTowardPlayer: vout[2] < 0, hits: hits.length, minGapS: hits.length > 1 ? +minGap.toFixed(3) : null });
  }
}
const hit = rows.filter(r => !r.miss);
console.log(JSON.stringify(rows));
const pct = (f) => hit.filter(f).length + '/' + hit.length;
console.log('shots ' + rows.length + ', canopy hits ' + hit.length);
console.log('out of the canopy within 2 steps: ' + pct(r => r.outInSteps <= 2));
console.log('exit speed 25-55% of entry: ' + pct(r => r.keep >= 0.25 && r.keep <= 0.55) + ' (range ' + Math.min(...hit.map(r => r.keep)) + '-' + Math.max(...hit.map(r => r.keep)) + ')');
console.log('within 10 deg of the reflection: ' + pct(r => r.toReflectionDeg <= 10) + ' (max ' + Math.max(...hit.map(r => r.toReflectionDeg)) + ')');
const dead = hit.filter(r => r.incidence <= 25), glance = hit.filter(r => r.incidence >= 60);
console.log('straight-on (incidence <= 25 deg): ' + dead.length + ', back toward the player ' + dead.filter(r => r.backTowardPlayer).length);
console.log('glancing (incidence >= 60 deg): ' + glance.length + ', |horizontal turn| ' + glance.map(r => Math.abs(r.horizTurnDeg)).join(',') + ' deg, back toward player ' + glance.filter(r => r.backTowardPlayer).length);
console.log('tree events closer than 0.25 s: ' + hit.filter(r => r.minGapS != null && r.minGapS < 0.25).length + ' (min gap ' + Math.min(...hit.filter(r => r.minGapS != null).map(r => r.minGapS)) + ' s)');
