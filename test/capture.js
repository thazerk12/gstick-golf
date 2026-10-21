const E = require(process.env.ENGINE ? require('path').resolve(process.env.ENGINE) : '../engine.js'); E.calibrate();
// flat green, cup at origin+3m; roll balls at the cup with different speeds and offsets
const hole = Object.assign({}, E.FLAT, { pin: { x: 0, z: 3, y: 0 }, greenRoll: (1.83 * 1.83) / (2 * 10 * 0.3048) / E.G, surface() { return E.S.GREEN; } });
const rows = [];
for (const past of [0.0, 0.2, 0.45, 0.9, 1.5, 2.5]) {
  const row = ['past ' + past.toFixed(2) + 'm'];
  for (const off of [0, 0.02, 0.035, 0.045, 0.052]) {
    const b = new E.Ball(); b.place(hole, off, 0);
    const v = E.puttSpeed(hole, 3 + past);
    b.putt(hole, v, 0);
    const ev = []; let n = 0, lip = 0;
    while ((b.state === 'roll' || b.state === 'air') && n < 40000) { ev.length = 0; b.step(hole, E.DT, ev); for (const e of ev) if (e.type === 'lip') lip++; n++; }
    row.push((b.state === 'holed' ? 'IN ' : lip ? 'lip' : 'mis') + ' v@cup=' + Math.sqrt(Math.max(0, v * v - 2 * hole.greenRoll * E.G * 3)).toFixed(2));
  }
  rows.push(row.join(' | '));
}
console.log('columns: lateral offset 0, 2, 3.5, 4.5, 5.2 cm\n' + rows.join('\n'));
