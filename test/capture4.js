// Round 4 Task 3d: capture rates by speed past the cup and lateral offset, flat green at stimp 10, 3 m putts.
// usage: ENGINE=path node test/capture4.js
const E = require(process.env.ENGINE ? require('path').resolve(process.env.ENGINE) : '../engine.js'); E.calibrate();
const hole = Object.assign({}, E.FLAT, { pin: { x: 0, z: 3, y: 0 }, greenRoll: (1.83 * 1.83) / (2 * 10 * 0.3048) / E.G, surface() { return E.S.GREEN; } });
const offs = [0, 1, 2, 3, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5];   // cm
const pasts = [0, 0.2, 0.45, 0.9, 1.5, 2.5];
console.log('CUP_R ' + E.CUP_R + ' m; rows: speed (would stop this far past the cup), columns: lateral offset (cm). I = holed, l = lipped out, . = missed');
console.log('past(m) v@cup | ' + offs.map(o => String(o).padStart(4)).join(''));
let tot = 0, inn = 0;
for (const past of pasts) {
  const v = E.puttSpeed(hole, 3 + past), vc = Math.sqrt(Math.max(0, v * v - 2 * hole.greenRoll * E.G * 3));
  let line = (past.toFixed(2) + ' ' + vc.toFixed(2)).padEnd(13) + ' | ';
  for (const o of offs) {
    const b = new E.Ball(); b.place(hole, o / 100, 0); b.putt(hole, v, 0);
    const ev = []; let n = 0, lip = 0;
    while ((b.state === 'roll' || b.state === 'air') && n < 40000) { ev.length = 0; b.step(hole, E.DT, ev); for (const e of ev) if (e.type === 'lip') lip++; n++; }
    const c = b.state === 'holed' ? 'I' : lip ? 'l' : '.'; line += c.padStart(4); tot++; if (c === 'I') inn++;
  }
  console.log(line);
}
// capture width: the widest offset that still holes, per speed (1 mm steps)
for (const past of pasts) {
  const v = E.puttSpeed(hole, 3 + past); let w = 0;
  for (let o = 0; o <= 9; o += 0.1) { const b = new E.Ball(); b.place(hole, o / 100, 0); b.putt(hole, v, 0); const ev = []; let n = 0; while ((b.state === 'roll' || b.state === 'air') && n < 40000) { ev.length = 0; b.step(hole, E.DT, ev); n++; } if (b.state === 'holed') w = o; }
  console.log('past ' + past.toFixed(2) + ' m: holes up to ' + w.toFixed(1) + ' cm off centre (capture width ' + (2 * w).toFixed(1) + ' cm)');
}
console.log('grid holed ' + inn + '/' + tot);
