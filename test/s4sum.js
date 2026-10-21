// Summarise swing4 runs: smoothness of the club's per-frame angular speed (RMS deviation from a cubic fit, % of peak),
// time-scale steps around contact, finger-cross to ball moving, and the shot values.
// usage: node test/s4sum.js r3.json r4.json [--detail]
const fs = require('fs');
function solve(A, b) { const n = b.length, M = A.map((r, i) => r.concat([b[i]])); for (let i = 0; i < n; i++) { let p = i; for (let j = i + 1; j < n; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j; [M[i], M[p]] = [M[p], M[i]]; for (let j = i + 1; j < n; j++) { const f = M[j][i] / M[i][i]; for (let k = i; k <= n; k++) M[j][k] -= f * M[i][k]; } } const x = new Array(n); for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let k = i + 1; k < n; k++) s -= M[i][k] * x[k]; x[i] = s / M[i][i]; } return x; }
function cubicRms(pts) {
  const n = pts.length; if (n < 5) return null;
  const t0 = pts[0][0], M = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], V = [0, 0, 0, 0];
  for (const [t, y] of pts) { const x = t - t0, p = [1, x, x * x, x * x * x]; for (let a = 0; a < 4; a++) { V[a] += p[a] * y; for (let b = 0; b < 4; b++) M[a][b] += p[a] * p[b]; } }
  const c = solve(M, V); let ss = 0, pk = 0;
  for (const [t, y] of pts) { const x = t - t0, f = c[0] + c[1] * x + c[2] * x * x + c[3] * x * x * x; ss += (y - f) ** 2; pk = Math.max(pk, Math.abs(y)); }
  return { rms: 100 * Math.sqrt(ss / n) / pk, peak: pk, n };
}
// frame row: [t, mode, phase, a, b, ts, moved, bd, tau, Test, alpha]
function analyse(r) {
  const F = r.frames, iD = F.findIndex(f => f[2] === 'down');
  let iC = -1; for (let i = iD; i < F.length; i++) if (F[i][2] === 'follow' || F[i][2] === 'finish') { iC = i; break; }
  if (iD < 0 || iC < 0) return { error: 'no downswing or contact' };
  const spA = [], spAB = [];
  for (let i = iD + 1; i <= iC; i++) { const dt = F[i][0] - F[i - 1][0]; spA.push([F[i][0], -(F[i][3] - F[i - 1][3]) / dt]); spAB.push([F[i][0], -(F[i][3] + F[i][4] - F[i - 1][3] - F[i - 1][4]) / dt]); }
  const thru = cubicRms(spA), pre = cubicRms(spA.slice(0, -1)), thruAB = cubicRms(spAB);
  // time scale steps from 5 frames before the ball moves to 0.6 s after
  let maxStep = 0, minTs = 1; const fb = r.fBall;
  if (fb != null) for (let i = Math.max(1, fb - 5); i < F.length && F[i][0] <= F[fb][0] + 0.6; i++) { maxStep = Math.max(maxStep, Math.abs(F[i][5] - F[i - 1][5])); minTs = Math.min(minTs, F[i][5]); }
  // drawn ball: displacement per frame / (frame time x time scale), for the contact frame and the next 6
  const ball = [];
  if (fb != null) for (let i = fb; i < Math.min(F.length, fb + 7); i++) { const a = F[i - 1][7], b = F[i][7], d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); ball.push(+(d / ((F[i][0] - F[i - 1][0]) * (i === fb ? 1 : F[i][5]))).toFixed(2)); }
  return { thru: thru && thru.rms, pre: pre && pre.rms, thruAB: thruAB && thruAB.rms, peak: thru && thru.peak, frames: spA.length, c2b: r.tBall != null ? (r.tBall - r.tCross) * 1000 : null, maxStep, minTs, ball, shot: r.shot };
}
const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
const detail = process.argv.includes('--detail');
const runs = files.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
const key = (r) => [r.club, r.T, r.hold, r.drift, r.phase].join('|');
const A = runs.map(R => { const m = new Map(); for (const r of R.results) m.set(key(r), Object.assign({ r }, analyse(r))); return m; });
// groups: club x T x hold x drift; report max over phases
const groups = new Map();
for (const r of runs[0].results) { const g = [r.club, r.T, r.hold, r.drift].join(' '); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(key(r)); }
const fmt = (v, d = 1) => v == null ? '–' : v.toFixed(d);
const agg = (m, ks, f, how) => { const v = ks.map(k => m.get(k)).filter(x => x && x[f] != null).map(x => x[f]); if (!v.length) return null; return how === 'min' ? Math.min(...v) : how === 'mean' ? v.reduce((a, b) => a + b, 0) / v.length : Math.max(...v); };
console.log('hz ' + runs.map(R => R.hz).join(','), files.map(f => f.split('/').pop()).join(' vs '));
console.log('club T hold drift | ' + files.map((f, i) => '[' + i + '] rms thru-contact max/mean, rms pre-contact max, a+b max, c2b min..max ms, ts max step, ts min').join(' | '));
for (const [g, ks] of groups) {
  console.log(g.padEnd(18) + ' | ' + A.map(m => fmt(agg(m, ks, 'thru', 'max'), 2) + '/' + fmt(agg(m, ks, 'thru', 'mean'), 2) + '% pre ' + fmt(agg(m, ks, 'pre', 'max'), 2) + '% ab ' + fmt(agg(m, ks, 'thruAB', 'max'), 1) + '% c2b ' + fmt(agg(m, ks, 'c2b', 'min'), 0) + '..' + fmt(agg(m, ks, 'c2b', 'max'), 0) + ' ts ' + fmt(agg(m, ks, 'maxStep', 'max'), 3) + ' min ' + fmt(agg(m, ks, 'minTs', 'min'), 3)).join(' | '));
}
// shot values: power and tempoMul identical; dev differs only by the mapping
if (A.length === 2) {
  let n = 0, powEq = 0, tmEq = 0, devMap = 0, devEq = 0, worst = 0;
  const L = Math.min(300, Math.max(140, 844 * 0.3)), map = (f) => { const a = Math.abs(f); return a <= 0.04 ? 0 : Math.sign(f) * Math.min(1.6, (a - 0.04) / 0.84); };
  for (const [k, x] of A[0]) {
    const y = A[1].get(k); if (!x.shot || !y || !y.shot) continue; n++;
    if (x.shot.power === y.shot.power) powEq++;
    if (x.shot.tempoMul === y.shot.tempoMul) tmEq++;
    if (x.shot.dev === y.shot.dev) devEq++;
    const f = -x.shot.dev * 0.42;   // round 3: dev = -clamp(f / 0.42)
    const exp = -map(f); if (Math.abs(exp - y.shot.dev) < 1e-9) devMap++; worst = Math.max(worst, Math.abs(exp - y.shot.dev));
  }
  console.log('shots compared ' + n + ': power identical ' + powEq + ', tempoMul identical ' + tmEq + ', dev identical ' + devEq + ', dev = mapping of round 3 drift ' + devMap + ' (worst diff ' + worst.toExponential(1) + ')');
}
if (detail) for (const m of A) { const x = [...m.values()].find(v => v.r.club === 'driver' && v.r.T === 200 && v.r.hold === 0 && v.r.drift === 0 && v.r.phase === 4); console.log(JSON.stringify({ ball: x.ball, c2b: x.c2b, thru: x.thru })); }
module.exports = { analyse, cubicRms };
