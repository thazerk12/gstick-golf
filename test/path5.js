// Round 5 Task 3: the path from the flick's angle. For flick angles φ of 0, 2, 3, 5, 8, 12, 20 and 30° each way (from straight
// up, right positive): tan φ, dev = −pathMap(tan φ), the label, the offline distance at carry and at rest for a full driver
// (tee) and a full 7-iron (fairway), flat ground, no wind, no upgrades, and the putt aim error at 3 m and 10 m. Alongside:
// round 4's drift (px at 390x844, swingLen 253.2) that gives the same dev on a full pull with no backswing drift, and what
// round 4 gave for the same flick on a half pull (its f halves; round 5 doesn't depend on the pull length).
// usage: node test/path5.js [engine.js]
const path = require('path');
const E = require(process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '../engine.js'));
E.calibrate();
const L4 = Math.min(300, Math.max(140, 844 * 0.3));
const P = { dead: 0.04, span: 0.84, max: 1.6, pure: 0.05 };   // FEEL.path (unchanged from round 4)
const map = (f) => { const a = Math.abs(f); return a <= P.dead ? 0 : Math.sign(f) * Math.min(P.max, (a - P.dead) / P.span); };
function shot(club, dev, pure, lie) {
  // takeShot: no overswing, tempo 1, no lie deviation on tee/fairway; PURE dev x 0.3
  const d = pure ? dev * 0.3 : dev;
  const ad = Math.abs(d), label = pure ? 'PURE' : ad < 0.12 ? 'STRAIGHT' : d > 0 ? (ad > 0.42 ? 'SLICE' : 'FADE') : (ad > 0.42 ? 'HOOK' : 'DRAW');
  const sp = E.shotParams(club, 1, d, lie, { power: 0, control: 0, spin: 0 });
  const b = new E.Ball(); b.place(E.FLAT, 0, 0);
  b.launch(sp.speed, sp.launch, sp.aimOff, sp.spin, sp.side);
  const ev = []; let n = 0, land = null;
  while ((b.state === 'air' || b.state === 'roll') && n < 200000) { b.step(E.FLAT, E.DT, ev); n++; if (!land && b.landed) land = { x: b.x, z: b.z }; }
  return { dev: d, label, carryOff: land ? land.x : null, restOff: b.x };
}
const DR = E.CLUBS[0], I7 = E.CLUBS.find(c => c.id === '7I');
const row = (f) => {
  const dev = -map(f), pure = Math.abs(f) <= P.pure && Math.abs(dev) < 0.12;
  const d = shot(DR, dev, pure, E.S.TEE), i = shot(I7, dev, pure, E.S.FAIRWAY), ang = dev * 1.7 * Math.PI / 180;
  return { dev: +d.dev.toFixed(3), label: d.label, drCarryOff: +d.carryOff.toFixed(1), drRestOff: +d.restOff.toFixed(1), i7CarryOff: +i.carryOff.toFixed(1), i7RestOff: +i.restOff.toFixed(1),
    putt: Math.abs(dev) > 0.3 ? (dev < 0 ? 'PUSHED' : 'PULLED') : '', putt3cm: +(Math.abs(Math.sin(ang)) * 300).toFixed(1), putt10cm: +(Math.abs(Math.sin(ang)) * 1000).toFixed(1) };
};
const out = [];
for (const deg of [0, 2, 3, 5, 8, 12, 20, 30]) for (const sg of deg ? [1, -1] : [1]) {
  const phi = sg * deg, f = Math.tan(phi * Math.PI / 180), r5 = row(f), r4half = row(f / 2);
  out.push(Object.assign({ phi, tanPhi: +f.toFixed(4), r4EquivDriftPx: +(f * L4).toFixed(1) }, r5, { r4HalfPull: { dev: r4half.dev, label: r4half.label } }));
}
console.log('phi | tan | R4 drift px (full pull) | dev | label | DR off carry/rest m | 7I off carry/rest m | putt 3 m / 10 m cm | R4 same flick, half pull');
for (const r of out) console.log([r.phi, r.tanPhi, r.r4EquivDriftPx, r.dev, r.label, r.drCarryOff + '/' + r.drRestOff, r.i7CarryOff + '/' + r.i7RestOff, r.putt3cm + '/' + r.putt10cm + (r.putt ? ' ' + r.putt : ''), r.r4HalfPull.label + ' (' + r.r4HalfPull.dev + ')'].join(' | '));
const deg = (t) => (Math.atan(t) * 180 / Math.PI).toFixed(2);
console.log('thresholds: PURE |φ| <= ' + deg(P.pure) + '°, STRAIGHT |φ| < ' + deg(0.12 * P.span + P.dead) + '°, FADE/DRAW up to ' + deg(0.42 * P.span + P.dead) + '°, cap (dev 1.6) at ' + deg(1.6 * P.span + P.dead) + '°');
