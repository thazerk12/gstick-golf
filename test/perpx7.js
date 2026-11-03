// Round 7 Task 1: how far one pixel of pull moves the shot, round 6 vs round 7, at a 390x844 screen.
// Full swings (DR, 7I, PW, flat lie, no upgrades, no wind): carry (yd) per px of pull at 25, 50 and 100% power. Round 6:
// power = pull / 211 px; round 7: power = (pull / 270.08 px)^1.25 to 100%. The carry for a power is the engine's (unchanged).
// Putts: flat roll (ft) per px at pull fractions 25, 50 and 100% (roll = 24 m x f^2 in both rounds; only the pull length
// changes). Also the pull in px for 25/50/100% power and a 30 yd chip with the PW.
// usage: node test/perpx7.js [engine.js]
const path = require('path');
const E = require(process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '../engine.js'));
E.calibrate();
const YD = 1.0936133, FT = 3.2808399, H = 844;
const R6 = { L: Math.min(260, Math.max(140, 0.25 * H)), exp: 1 }, R7 = { L: Math.min(332.8, Math.max(179.2, 0.32 * H)), exp: 1.25 };
const power = (R, px) => { const f = Math.min(px / R.L, 1.12); return f > 1 ? f : Math.pow(f, R.exp); };
const pullFor = (R, p) => R.L * Math.pow(p, 1 / R.exp);   // px of pull for a power (to 100%)
const carryYd = (c, p) => E.carryFor(c, p) * YD;
const rows = [];
for (const id of ['DR', '7I', 'PW']) {
  const c = E.CLUBS.find(k => k.id === id);
  for (const p of [0.25, 0.5, 1.0]) {
    const per = (R) => { const x = pullFor(R, p), h = 0.5; const x0 = Math.min(x, R.L) - h, x1 = Math.min(x + h, R.L); return (carryYd(c, power(R, x1)) - carryYd(c, power(R, x0))) / (x1 - x0); };   // at 100%: from below
    rows.push({ club: id, power: p, carryYd: +carryYd(c, p).toFixed(1), r6PullPx: +pullFor(R6, p).toFixed(1), r7PullPx: +pullFor(R7, p).toFixed(1), r6YdPerPx: +per(R6).toFixed(3), r7YdPerPx: +per(R7).toFixed(3) });
  }
}
const pw = E.CLUBS.find(k => k.id === 'PW');
let p30 = 0; for (let p = 0.05; p <= 1; p += 0.0001) if (carryYd(pw, p) >= 30) { p30 = p; break; }
const chip = { power: +p30.toFixed(3), r6PullPx: +pullFor(R6, p30).toFixed(1), r7PullPx: +pullFor(R7, p30).toFixed(1) };
const putts = [];
for (const f of [0.25, 0.5, 1.0]) {
  const per = (R) => 2 * 24 * f / R.L * FT;
  putts.push({ pull: f, rollFt: +(24 * f * f * FT).toFixed(1), r6PullPx: +(f * R6.L).toFixed(1), r7PullPx: +(f * R7.L).toFixed(1), r6FtPerPx: +per(R6).toFixed(3), r7FtPerPx: +per(R7).toFixed(3) });
}
console.log('swingLen at 390x844: round 6', R6.L, 'px, round 7', R7.L.toFixed(2), 'px');
console.log('club | power | carry yd | pull px R6 -> R7 | yd per px R6 -> R7');
for (const r of rows) console.log([r.club, r.power * 100 + '%', r.carryYd, r.r6PullPx + ' -> ' + r.r7PullPx, r.r6YdPerPx + ' -> ' + r.r7YdPerPx].join(' | '));
console.log('PW 30 yd chip: power', chip.power, ', pull', chip.r6PullPx, '->', chip.r7PullPx, 'px');
console.log('putt pull | flat roll ft | pull px R6 -> R7 | ft per px R6 -> R7');
for (const r of putts) console.log([r.pull * 100 + '%', r.rollFt, r.r6PullPx + ' -> ' + r.r7PullPx, r.r6FtPerPx + ' -> ' + r.r7FtPerPx].join(' | '));
console.log(JSON.stringify({ rows, chip, putts }));
