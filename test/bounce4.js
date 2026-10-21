// Round 4 Task 3c: shots landing on a flat green at stimp 10, no wind. First bounce apex (m above the green) and travel
// after landing (m along the shot line from the first touchdown to rest; negative = spun back past it).
// usage: node test/bounce4.js [engine.js] [e mu grip turf]   (the four numbers override the SP green row)
const path = require('path');
const E = require(process.argv[2] && process.argv[2].endsWith('.js') ? path.resolve(process.argv[2]) : path.join(__dirname, '../engine.js'));
const ov = process.argv.slice(2).filter(a => !a.endsWith('.js')).map(Number);
if (ov.length >= 3) { const g = E.SP[E.S.GREEN]; g.e = ov[0]; g.mu = ov[1]; g.grip = ov[2]; if (ov.length >= 4) g.turf = ov[3]; }
E.calibrate();
const stimp = 10, greenRoll = (1.83 * 1.83) / (2 * stimp * 0.3048) / E.G;
const GREEN = Object.assign({}, E.FLAT, { greenRoll, surface() { return E.S.GREEN; } });
function run(id, power, upgSpin) {
  const c = E.CLUBS.find(k => k.id === id), sp = E.shotParams(c, power, 0, E.S.FAIRWAY, { power: 0, control: 0, spin: upgSpin || 0 });
  const b = new E.Ball(); b.place(GREEN, 0, 0); b.launch(sp.speed, sp.launch, 0, sp.spin, 0);
  const ev = []; let land = null, apex = 0, contacts = 0, n = 0, spunBack = false, landV = null;
  while ((b.state === 'air' || b.state === 'roll') && n < 400000) {
    const wasAir = b.state === 'air', vy = b.vy, vz = b.vz;
    ev.length = 0; b.step(GREEN, E.DT, ev); n++;
    for (const e of ev) { if (e.type === 'land') { land = b.z; landV = { vy, vz }; } if (e.type === 'bounce' || e.type === 'land') { if (e.type === 'bounce') contacts++; if (e.spinBack) spunBack = true; } }
    if (land != null && contacts === 1 && b.state === 'air') apex = Math.max(apex, b.y - E.BALL_R);
    if (land != null && wasAir && b.state === 'roll' && contacts === 0) contacts = 99;   // rolled out without bouncing
  }
  return { club: id, power, spinUpg: upgSpin || 0, carry: +land.toFixed(1), landAngle: +(Math.atan2(-landV.vy, landV.vz) * 180 / Math.PI).toFixed(1), landSpeed: +Math.hypot(landV.vy, landV.vz).toFixed(1), apex1: +apex.toFixed(2), travel: +(b.z - land).toFixed(2), spunBack };
}
const out = [run('7I', 1), run('PW', 1), run('GW', 1), run('SW', 1), run('PW', 1, 5), run('SW', 1, 5), run('9I', 1), run('5I', 1), run('PW', 0.6)];
console.log('green row', JSON.stringify(E.SP[E.S.GREEN]));
for (const r of out) console.log(JSON.stringify(r));
