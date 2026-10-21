// Round 4 Task 2: swing path mapping, before (round 3) and after, at 390x844 (swingLen 253.2 px).
// For each sideways drift at the line: dev, label and offline distance for a full driver (tee) and a full 7-iron (fairway),
// flat ground, no wind, no upgrades; plus putt aim error at 3 m and 10 m. usage: node test/path4.js [engine.js]
const path = require('path');
const E = require(process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '../engine.js'));
E.calibrate();
const L = Math.min(300, Math.max(140, 844 * 0.3));
const R3 = { dev: (f) => -Math.max(-1.6, Math.min(1.6, f / 0.42)), pure: (f, dev) => Math.abs(dev) < 0.07 };
const P = { dead: 0.04, span: 0.84, max: 1.6, pure: 0.05 };
const map = (f) => { const a = Math.abs(f); return a <= P.dead ? 0 : Math.sign(f) * Math.min(P.max, (a - P.dead) / P.span); };
const R4 = { dev: (f) => -map(f), pure: (f) => Math.abs(f) <= P.pure };
function shot(club, dev, pure, lie) {
  // takeShot: no overswing, tempo 1, no lie deviation on tee/fairway; PURE dev x 0.3
  const d = pure ? dev * 0.3 : dev;
  const ad = Math.abs(d), label = pure ? 'PURE' : ad < 0.12 ? 'STRAIGHT' : d > 0 ? (ad > 0.42 ? 'SLICE' : 'FADE') : (ad > 0.42 ? 'HOOK' : 'DRAW');
  const sp = E.shotParams(club, 1, d, lie, { power: 0, control: 0, spin: 0 });
  const b = new E.Ball(); b.place(E.FLAT, 0, 0);
  b.launch(sp.speed, sp.launch, sp.aimOff, sp.spin, sp.side);
  const ev = []; let n = 0, land = null;
  while ((b.state === 'air' || b.state === 'roll') && n < 200000) { b.step(E.FLAT, E.DT, ev); n++; if (!land && b.landed) land = { x: b.x, z: b.z }; }
  return { dev: d, label, carryOff: land ? land.x : null, restOff: b.x, total: Math.hypot(b.x, b.z) };
}
const DR = E.CLUBS[0], I7 = E.CLUBS.find(c => c.id === '7I');
const rows = [];
for (const px of [5, 10, 20, 35, 50, 80, 120]) {
  const f = px / L, row = { px, f: +f.toFixed(4) };
  for (const [name, M] of [['r3', R3], ['r4', R4]]) {
    const dev = M.dev(f), pure = M.pure(f, dev);
    const d = shot(DR, dev, pure, E.S.TEE), i = shot(I7, dev, pure, E.S.FAIRWAY);
    const pd = Math.abs(dev);   // putts: no PURE; aim error = dev x 1.7 deg
    const ang = dev * 1.7 * Math.PI / 180;
    row[name] = { dev: +d.dev.toFixed(3), label: d.label, drOffCarry: +d.carryOff.toFixed(1), drOffRest: +d.restOff.toFixed(1), i7OffCarry: +i.carryOff.toFixed(1), i7OffRest: +i.restOff.toFixed(1),
      puttLabel: pd > 0.3 ? (dev < 0 ? 'PUSHED' : 'PULLED') : '', putt3cm: +(Math.abs(Math.sin(ang)) * 300).toFixed(1), putt10cm: +(Math.abs(Math.sin(ang)) * 1000).toFixed(1) };
  }
  rows.push(row);
}
console.log(JSON.stringify(rows, null, 1));
// thresholds in px at 390x844
const inv = (dev) => (Math.abs(dev) * P.span + P.dead) * L;
console.log('round 4 thresholds (px): PURE <= ' + (P.pure * L).toFixed(1) + ', STRAIGHT < ' + inv(0.12).toFixed(1) + ', SLICE/HOOK > ' + inv(0.42).toFixed(1) + '; round 3: PURE < ' + (0.07 * 0.42 * L).toFixed(1) + ', STRAIGHT < ' + (0.12 * 0.42 * L).toFixed(1) + ', SLICE/HOOK > ' + (0.42 * 0.42 * L).toFixed(1));
