/* Tempo Golf — engine: course generation + ball physics (no rendering) */
(function (root) {
  'use strict';

  const G = 9.81, BALL_R = 0.02135, CUP_R = 0.0675, M2YD = 1.0936133;   // cup 1.25x regulation (round 4)
  const RHO = 1.225, AREA = Math.PI * BALL_R * BALL_R, MASS = 0.04593;
  const KAIR = 0.5 * RHO * AREA / MASS;
  const RPM = 2 * Math.PI / 60;
  const DT = 1 / 240;

  const S = { TEE: 0, FAIRWAY: 1, ROUGH: 2, SAND: 3, GREEN: 4, FRINGE: 5, WATER: 6, OB: 7 };
  const SURF_NAMES = ['Tee', 'Fairway', 'Rough', 'Bunker', 'Green', 'Fringe', 'Water', 'Out of bounds'];
  // e: restitution, mu: impact friction, turf: tangential loss per hard landing,
  // roll: rolling resistance (x g), grip: how much backspin bites,
  // ls/lsp/ld: lie effect on next shot (speed, spin, random deviation)
  const SP = [
    { e: 0.34, mu: 0.42, turf: 0.45, roll: 0.125, grip: 1.3, ls: 1.00, lsp: 1.00, ld: 0.00 }, // tee
    { e: 0.34, mu: 0.42, turf: 0.45, roll: 0.125, grip: 1.3, ls: 1.00, lsp: 1.00, ld: 0.00 }, // fairway
    { e: 0.18, mu: 0.60, turf: 0.62, roll: 0.42, grip: 0.3, ls: 0.84, lsp: 0.50, ld: 0.13 }, // rough
    { e: 0.04, mu: 0.90, turf: 0.92, roll: 1.80, grip: 0.1, ls: 0.62, lsp: 0.55, ld: 0.20 }, // sand
    { e: 0.38, mu: 0.90, turf: 0.45, roll: 0.050, grip: 1.45, ls: 1.00, lsp: 1.00, ld: 0.00 }, // green (round 4: more bounce, less grab)
    { e: 0.24, mu: 0.80, turf: 0.45, roll: 0.17, grip: 1.2, ls: 0.97, lsp: 0.90, ld: 0.02 }, // fringe
    { e: 0, mu: 1, turf: 1, roll: 5, grip: 0, ls: 0.5, lsp: 0.5, ld: 0.3 }, // water
    { e: 0.18, mu: 0.60, turf: 0.62, roll: 0.42, grip: 0.3, ls: 0.84, lsp: 0.50, ld: 0.13 }, // ob
  ];

  // carry targets (yards) at 100% power; speeds are calibrated at load
  const CLUBS = [
    { id: 'DR', name: 'Driver', carry: 245, loft: 12.0, spin: 2600, dev: 1.00, curve: 1.15 },
    { id: '3W', name: '3 Wood', carry: 226, loft: 13.0, spin: 3400, dev: 0.95, curve: 1.05 },
    { id: '4H', name: '4 Hybrid', carry: 206, loft: 15.0, spin: 4200, dev: 0.90, curve: 0.95 },
    { id: '5I', name: '5 Iron', carry: 191, loft: 16.0, spin: 5000, dev: 0.85, curve: 0.90 },
    { id: '6I', name: '6 Iron', carry: 178, loft: 18.0, spin: 5800, dev: 0.82, curve: 0.85 },
    { id: '7I', name: '7 Iron', carry: 165, loft: 20.0, spin: 6600, dev: 0.80, curve: 0.80 },
    { id: '8I', name: '8 Iron', carry: 152, loft: 22.5, spin: 7400, dev: 0.78, curve: 0.75 },
    { id: '9I', name: '9 Iron', carry: 138, loft: 25.5, spin: 8100, dev: 0.75, curve: 0.70 },
    { id: 'PW', name: 'Pitching Wedge', carry: 124, loft: 29.0, spin: 8800, dev: 0.72, curve: 0.62 },
    { id: 'GW', name: 'Gap Wedge', carry: 107, loft: 33.0, spin: 9300, dev: 0.70, curve: 0.55 },
    { id: 'SW', name: 'Sand Wedge', carry: 88, loft: 38.0, spin: 9700, dev: 0.70, curve: 0.50, sand: true },
    { id: 'LW', name: 'Lob Wedge', carry: 68, loft: 44.0, spin: 10000, dev: 0.70, curve: 0.45, sand: true },
    { id: 'PT', name: 'Putter', putter: true },
  ];

  /* ---------- utils ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  // smooth value noise (quintic fade => continuous slopes)
  function makeNoise(rand) {
    const perm = new Uint16Array(512), vals = new Float32Array(256);
    const p = []; for (let i = 0; i < 256; i++) { p.push(i); vals[i] = rand() * 2 - 1; }
    for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
      const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
      const X = xi & 255, Y = yi & 255;
      const a = vals[perm[perm[X] + Y]], b = vals[perm[perm[X + 1] + Y]];
      const c = vals[perm[perm[X] + Y + 1]], d = vals[perm[perm[X + 1] + Y + 1]];
      return lerp(lerp(a, b, u), lerp(c, d, u), v);
    };
  }

  /* ---------- themes / courses ---------- */
  const COURSES = [
    { key: 'meadow', name: 'Willow Creek', hills: 6, dunes: 0.25, teeElev: 3, trees: 1.0, water: 1.0 },
    { key: 'links', name: 'Saltmarsh Links', hills: 3.2, dunes: 1.1, teeElev: 2, trees: 0.25, water: 0.8 },
    { key: 'desert', name: 'Red Mesa', hills: 5, dunes: 0.6, teeElev: 6, trees: 0.45, water: 0.7 },
    { key: 'autumn', name: 'Pinecrest', hills: 10, dunes: 0.3, teeElev: 8, trees: 1.35, water: 0.9 },
  ];

  const PAR_PATTERNS = [
    [4, 3, 5, 4, 3, 4], [4, 4, 3, 5, 3, 4], [5, 4, 3, 4, 4, 3], [4, 3, 4, 5, 4, 3],
    [3, 4, 5, 3, 4, 4], [4, 5, 3, 4, 3, 4],
  ];

  function makeRound(seedStr, tier, courseIdx) {
    const rand = mulberry32(hashStr(seedStr));
    const pars = PAR_PATTERNS[Math.floor(rand() * PAR_PATTERNS.length)].slice();
    const holes = pars.map((par, i) => ({
      seed: hashStr(seedStr + ':h' + i), par, tier, course: courseIdx, index: i,
    }));
    return { seedStr, tier, course: courseIdx, holes, par: pars.reduce((a, b) => a + b, 0) };
  }

  /* ---------- hole generation ---------- */
  function buildHole(cfg) {
    const rand = mulberry32(cfg.seed);
    const tier = cfg.tier, par = cfg.par;
    const C = COURSES[cfg.course];
    const tf = clamp((tier - 1) / 8, 0, 1); // 0..1 difficulty

    const n1 = makeNoise(rand), n2 = makeNoise(rand), n3 = makeNoise(rand);
    const ox = rand() * 100, oz = rand() * 100;

    // length
    let yds;
    if (par === 3) yds = 125 + rand() * 70 + tf * 25;
    else if (par === 4) yds = 330 + rand() * 85 + tf * 45;
    else yds = 480 + rand() * 60 + tf * 40;
    const len = yds / M2YD;

    // centerline: quadratic bezier tee -> green
    const dogSign = rand() < 0.5 ? -1 : 1;
    const dogAmt = par === 3 ? 0 : (rand() < 0.75 ? (0.05 + rand() * 0.13) : 0) * len;
    const gx = (par === 3 ? (rand() - 0.5) * 0.12 : dogSign * (0.02 + rand() * 0.1)) * len;
    const P1x = dogSign * dogAmt * 1.6, P1z = len * (0.5 + rand() * 0.15);
    const gzApprox = len;
    const pts = []; // {x,z,s}
    const NSEG = 96;
    let sAcc = 0, px = 0, pz = 0;
    for (let i = 0; i <= NSEG; i++) {
      const t = i / NSEG, mt = 1 - t;
      const x = 2 * mt * t * P1x + t * t * gx;
      const z = 2 * mt * t * P1z + t * t * gzApprox;
      if (i > 0) sAcc += Math.hypot(x - px, z - pz);
      pts.push({ x, z, s: sAcc }); px = x; pz = z;
    }
    // rescale so arc length == len
    const k = len / sAcc;
    for (const p of pts) { p.x *= k; p.z *= k; p.s *= k; }
    const Ls = len;
    const green = { x: pts[NSEG].x, z: pts[NSEG].z };

    // widths
    const W = clamp(25 - tf * 10, 14, 25) * (C.key === 'links' ? 1.15 : 1);
    const fwPhase = rand() * 6.28;
    const fwStart = par === 3 ? Ls - 32 : clamp(Ls * 0.27, 85, 150);
    const obDist = W + 46 - tf * 6;

    // green shape
    const gr = clamp(13.5 - tf * 3.2 + rand() * 3, 9, 17);
    const grx = gr, grz = gr * (1.05 + rand() * 0.3);
    const grot = Math.atan2(green.x - pts[NSEG - 6].x, green.z - pts[NSEG - 6].z) + (rand() - 0.5) * 0.6;
    const gc = Math.cos(grot), gs = Math.sin(grot);
    const fringeW = 1.8;

    // segment geometry helpers
    function centerInfo(x, z, out) {
      let best = 1e18, bs = 0, bside = 1;
      for (let i = 0; i < NSEG; i++) {
        const a = pts[i], b = pts[i + 1];
        const dx = b.x - a.x, dz = b.z - a.z;
        const l2 = dx * dx + dz * dz;
        let t = ((x - a.x) * dx + (z - a.z) * dz) / l2;
        if (i === 0 && t < 0) { /* extend behind tee */ } else if (i === NSEG - 1 && t > 1) { /* extend past green */ } else t = clamp(t, 0, 1);
        const qx = a.x + dx * t, qz = a.z + dz * t;
        const ddx = x - qx, ddz = z - qz;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 < best) {
          best = d2; bs = a.s + t * Math.sqrt(l2);
          bside = (dx * ddz - dz * ddx) > 0 ? -1 : 1;
        }
      }
      out.d = Math.sqrt(best); out.s = bs; out.side = bside;
      return out;
    }

    function fwHalf(s) {
      if (s < fwStart || s > Ls + 2) return 0;
      let w = W * (1 + 0.16 * Math.sin(s * 0.024 + fwPhase));
      if (par === 3) w = Math.min(w * 0.55, grx * 0.8);
      if (s > Ls - 70 && par !== 3) w *= lerp(1, 0.72, smoothstep(Ls - 70, Ls - 20, s));
      const st = clamp((s - fwStart) / 14, 0, 1);
      return w * Math.sqrt(st);
    }

    // hazards ---------------------------------------------------
    const bunkers = [], ponds = [];
    function pointAtS(s) {
      s = clamp(s, 0, Ls);
      for (let i = 0; i < NSEG; i++) {
        if (pts[i + 1].s >= s) {
          const a = pts[i], b = pts[i + 1];
          const t = (s - a.s) / (b.s - a.s || 1);
          const x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t);
          const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
          return { x, z, tx: dx / l, tz: dz / l, nx: dz / l, nz: -dx / l };
        }
      }
      const a = pts[NSEG - 1], b = pts[NSEG];
      const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
      return { x: b.x, z: b.z, tx: dx / l, tz: dz / l, nx: dz / l, nz: -dx / l };
    }

    // greenside bunkers
    const nGB = 1 + Math.floor(rand() * (2 + tf * 1.5));
    const frontAng = Math.atan2(-(green.x - pts[NSEG - 8].x), -(green.z - pts[NSEG - 8].z));
    for (let i = 0; i < nGB; i++) {
      // angle around green avoiding dead-front opening (+-25deg) unless hard
      let ang = frontAng + (rand() < 0.5 ? -1 : 1) * (0.55 + rand() * 1.9);
      if (tf > 0.5 && i === 0 && rand() < 0.5) ang = frontAng + (rand() - 0.5) * 0.4;
      const rr = Math.max(grx, grz) + 3.5 + rand() * 2.5;
      bunkers.push({
        x: green.x + Math.sin(ang) * rr, z: green.z + Math.cos(ang) * rr,
        rx: 4 + rand() * 3, rz: 2.5 + rand() * 2.2, rot: ang + Math.PI / 2 + (rand() - 0.5) * 0.5,
        depth: 0.7 + rand() * 0.4,
      });
    }
    // fairway bunkers
    if (par !== 3) {
      const nFB = Math.floor(rand() * (1.6 + tf * 2.2));
      for (let i = 0; i < nFB; i++) {
        const s = clamp(205 + rand() * 60 + (par === 5 && rand() < 0.5 ? 150 : 0), fwStart + 20, Ls - 60);
        const p = pointAtS(s); const side = rand() < 0.5 ? -1 : 1;
        const off = side * (fwHalf(s) * (0.7 + rand() * 0.5));
        bunkers.push({
          x: p.x + p.nx * off, z: p.z + p.nz * off, rx: 4 + rand() * 4, rz: 7 + rand() * 7,
          rot: Math.atan2(p.tx, p.tz) + (rand() - 0.5) * 0.4, depth: 0.6 + rand() * 0.3,
        });
      }
    }
    // water
    const waterChance = (0.18 + tf * 0.5) * C.water;
    if (rand() < waterChance) {
      const type = par === 3 ? 'front' : (rand() < 0.5 ? 'side' : (rand() < 0.6 ? 'cross' : 'front'));
      if (type === 'front') {
        const p = pointAtS(Ls - Math.max(grx, grz) - 13 - rand() * 6);
        ponds.push({ x: p.x, z: p.z, rx: Math.max(grx, grz) + 6 + rand() * 6, rz: 7 + rand() * 4, rot: Math.atan2(p.tx, p.tz) });
      } else if (type === 'cross') {
        const s = clamp(150 + rand() * 30, fwStart - 20, Ls - 120);
        const p = pointAtS(s);
        ponds.push({ x: p.x, z: p.z, rx: W + 26, rz: 9 + rand() * 6, rot: Math.atan2(p.tx, p.tz) });
      } else {
        const s = clamp(190 + rand() * 90, fwStart + 10, Ls - 50);
        const p = pointAtS(s); const side = rand() < 0.5 ? -1 : 1;
        const rx = 14 + rand() * 10;
        const off = side * (fwHalf(s) + rx * 0.75 + 3);
        ponds.push({ x: p.x + p.nx * off, z: p.z + p.nz * off, rx, rz: 35 + rand() * 30, rot: Math.atan2(p.tx, p.tz) });
      }
    }
    for (const b of bunkers) { b.c = Math.cos(b.rot); b.s = Math.sin(b.rot); }
    for (const p of ponds) { p.c = Math.cos(p.rot); p.s = Math.sin(p.rot); }
    // drop bunkers that overlap ponds
    for (let i = bunkers.length - 1; i >= 0; i--) {
      for (const p of ponds) if (ellQ(p, bunkers[i].x, bunkers[i].z) < 1.6) { bunkers.splice(i, 1); break; }
    }

    function ellQ(e, x, z) { // elliptical radius (1 == edge)
      const dx = x - e.x, dz = z - e.z;
      const u = dx * e.c - dz * e.s, v = dx * e.s + dz * e.c;
      return Math.sqrt((u * u) / (e.rx * e.rx) + (v * v) / (e.rz * e.rz));
    }
    function greenQ(x, z) {
      const dx = x - green.x, dz = z - green.z;
      const u = dx * gc - dz * gs, v = dx * gs + dz * gc;
      return Math.sqrt((u * u) / (grx * grx) + (v * v) / (grz * grz));
    }

    // heights -------------------------------------------------
    const tmpCI = { d: 0, s: 0, side: 1 };
    const teeElev = C.teeElev * (0.4 + rand() * 0.8) * (par === 3 ? 1.4 : 1);
    function baseH(x, z, d) {
      let h = C.hills * (n1(x * 0.0055 + ox, z * 0.0055 + oz) * 0.72 + n1(x * 0.014 + 7.3, z * 0.014 - 3.1) * 0.28);
      const corr = 1 - smoothstep(W * 0.5, W + 40, d);
      h *= (1 - 0.55 * corr);
      h += C.dunes * n2(x * 0.045 + 3, z * 0.045 + 9) * (1 - 0.75 * corr);
      h += 0.35 * n3(x * 0.03 + 11, z * 0.03 + 4) * corr;
      h += teeElev * Math.exp(-(x * x + z * z) / (2 * 42 * 42));
      return h;
    }
    const gBase = baseH(green.x, green.z, 0) + 0.45;
    // green tilt: mostly back-to-front (higher at back)
    const tiltMag = 0.008 + tf * 0.016 + rand() * 0.006;
    const tiltAng = Math.atan2(green.x - pts[NSEG - 10].x, green.z - pts[NSEG - 10].z) + (rand() - 0.5) * 1.6;
    const tiltX = Math.sin(tiltAng) * tiltMag, tiltZ = Math.cos(tiltAng) * tiltMag;
    const undAmp = 0.06 + tf * 0.08 + rand() * 0.03;
    const n4 = makeNoise(rand);
    const und0 = n4(green.x * 0.06, green.z * 0.06);
    function greenH(x, z) {
      return gBase + tiltX * (x - green.x) + tiltZ * (z - green.z) + undAmp * (n4(x * 0.06, z * 0.06) - und0);
    }
    const teeH = baseH(0, 0, 0) + 0.4;
    const teeRot = Math.atan2(pts[3].x, pts[3].z), tc = Math.cos(teeRot), ts = Math.sin(teeRot);

    // pond levels: below surrounding banks
    for (const p of ponds) {
      let mn = 1e9;
      for (let a = 0; a < 24; a++) {
        const an = a / 24 * Math.PI * 2;
        const u = Math.cos(an) * p.rx * 1.35, v = Math.sin(an) * p.rz * 1.35;
        const x = p.x + u * p.c + v * p.s, z = p.z - u * p.s + v * p.c;
        centerInfo(x, z, tmpCI);
        mn = Math.min(mn, baseH(x, z, tmpCI.d));
      }
      p.y = mn - 0.35;
    }

    function height(x, z) {
      const qg = greenQ(x, z);
      if (qg < 1.05) return greenH(x, z);
      centerInfo(x, z, tmpCI);
      let h = baseH(x, z, tmpCI.d);
      // tee pad
      const tu = x * tc - z * ts, tv = x * ts + z * tc;
      const tq = Math.max(Math.abs(tu) / 6, Math.abs(tv) / 9);
      if (tq < 1.6) h = lerp(h, teeH, 1 - smoothstep(1.0, 1.6, tq));
      if (qg < 1.8) h = lerp(h, greenH(x, z), 1 - smoothstep(1.05, 1.8, qg));
      for (let i = 0; i < bunkers.length; i++) {
        const b = bunkers[i]; const q = ellQ(b, x, z);
        if (q < 1.25) h -= b.depth * (1 - smoothstep(0.45, 1.08, q)) - 0.18 * Math.max(0, 1 - Math.abs(q - 1.12) / 0.13);
      }
      for (let i = 0; i < ponds.length; i++) {
        const p = ponds[i]; const q = ellQ(p, x, z);
        if (q < 1.3) h = lerp(h, p.y - 1.4, 1 - smoothstep(0.75, 1.3, q));
      }
      return h;
    }

    function surface(x, z) {
      for (let i = 0; i < ponds.length; i++) {
        const p = ponds[i];
        if (ellQ(p, x, z) < 1.3 && height(x, z) < p.y) return S.WATER;
      }
      const qg = greenQ(x, z);
      if (qg < 1) return S.GREEN;
      if (qg < 1 + fringeW / Math.min(grx, grz)) return S.FRINGE;
      for (let i = 0; i < bunkers.length; i++) if (ellQ(bunkers[i], x, z) < 1) return S.SAND;
      const tu = x * tc - z * ts, tv = x * ts + z * tc;
      if (Math.abs(tu) < 6 && Math.abs(tv) < 9) return S.TEE;
      centerInfo(x, z, tmpCI);
      if (tmpCI.d > obDist || tmpCI.s < -45 || tmpCI.s > Ls + 48) return S.OB;
      if (tmpCI.d < fwHalf(tmpCI.s)) return S.FAIRWAY;
      return S.ROUGH;
    }

    function pondAt(x, z) {
      for (let i = 0; i < ponds.length; i++) if (ellQ(ponds[i], x, z) < 1.3) return ponds[i];
      return null;
    }

    const NE = 0.06;
    function normal(x, z, out) {
      const hx = (height(x + NE, z) - height(x - NE, z)) / (2 * NE);
      const hz = (height(x, z + NE) - height(x, z - NE)) / (2 * NE);
      const l = Math.sqrt(hx * hx + 1 + hz * hz);
      out.x = -hx / l; out.y = 1 / l; out.z = -hz / l;
      return out;
    }

    // pin: low slope spot on green
    let pin = null, bestSl = 1e9;
    const pinR = 0.4 + tf * 0.35;
    const tmpN = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 40; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * pinR;
      const u = Math.cos(a) * r * grx, v = Math.sin(a) * r * grz;
      const x = green.x + u * gc + v * gs, z = green.z - u * gs + v * gc;
      normal(x, z, tmpN);
      const sl = Math.sqrt(1 - tmpN.y * tmpN.y) / tmpN.y;
      if (sl < 0.022) { pin = { x, z }; break; }
      if (sl < bestSl) { bestSl = sl; pin = { x, z }; }
    }
    pin.y = height(pin.x, pin.z);

    // trees ----------------------------------------------------
    const trees = [];
    const treeGrid = new Map();
    const tcell = 12;
    function addTree(t) {
      trees.push(t);
      const key = Math.floor(t.x / tcell) + ',' + Math.floor(t.z / tcell);
      let a = treeGrid.get(key); if (!a) { a = []; treeGrid.set(key, a); } a.push(t);
    }
    const nTrees = Math.floor((60 + Ls * 0.32 + tf * 60) * C.trees);
    let tries = 0;
    while (trees.length < nTrees && tries < nTrees * 12) {
      tries++;
      const s = -30 + rand() * (Ls + 70);
      const p = pointAtS(s);
      const side = rand() < 0.5 ? -1 : 1;
      const fh = Math.max(fwHalf(s), W * 0.55);
      const minOff = fh + 9 + (s < 70 ? 10 : 0);
      const off = side * (minOff + Math.pow(rand(), 0.8) * (obDist + 40 - minOff));
      const x = p.x + p.nx * off + (rand() - 0.5) * 6, z = p.z + p.nz * off + (rand() - 0.5) * 6;
      if (greenQ(x, z) < 2.3) continue;
      if (x * x + z * z < 22 * 22) continue;
      if (pondAt(x, z)) continue;
      let bad = false;
      for (const b of bunkers) if (ellQ(b, x, z) < 1.6) { bad = true; break; }
      if (bad) continue;
      centerInfo(x, z, tmpCI);
      if (tmpCI.d < fwHalf(tmpCI.s) + 7) continue;
      if (tmpCI.s < 60 && tmpCI.d < 26) continue; // keep tee chute clear
      const sc = 0.75 + rand() * 0.6;
      const kind = rand();
      let t;
      if (C.key === 'links') t = { x, z, kind: 'shrub', trunkH: 0, trunkR: 0, cy: 0.9 * sc, cr: 1.6 * sc };
      else if (C.key === 'desert') t = kind < 0.6 ? { x, z, kind: 'cactus', trunkH: 4.2 * sc, trunkR: 0.45 * sc, cy: 0, cr: 0 } : { x, z, kind: 'round', trunkH: 2.2 * sc, trunkR: 0.25 * sc, cy: 3.6 * sc, cr: 2.4 * sc };
      else if (C.key === 'autumn') t = kind < 0.45 ? { x, z, kind: 'pine', trunkH: 2.2 * sc, trunkR: 0.3 * sc, cy: 6.5 * sc, cr: 2.8 * sc, ch: 10 * sc } : { x, z, kind: 'round', trunkH: 3.4 * sc, trunkR: 0.32 * sc, cy: 6.2 * sc, cr: 3.6 * sc };
      else t = kind < 0.25 ? { x, z, kind: 'pine', trunkH: 2 * sc, trunkR: 0.3 * sc, cy: 6 * sc, cr: 2.6 * sc, ch: 9 * sc } : { x, z, kind: 'round', trunkH: 3.2 * sc, trunkR: 0.32 * sc, cy: 6 * sc, cr: 3.5 * sc };
      t.sc = sc; t.y = height(x, z); t.rnd = rand();
      addTree(t);
    }
    function treesNear(x, z) {
      const cx = Math.floor(x / tcell), cz = Math.floor(z / tcell);
      const out = [];
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const a = treeGrid.get((cx + i) + ',' + (cz + j)); if (a) for (const t of a) out.push(t);
      }
      return out;
    }

    // conditions
    const windMax = Math.min(1.5 + tf * 5.5 + rand() * 1.2, 7);
    const windSpd = rand() * windMax;
    const windDir = rand() * Math.PI * 2;
    const stimp = clamp(9 + tf * 3 + (rand() - 0.5) * 0.6, 8.5, 12.2);
    const greenRoll = (1.83 * 1.83) / (2 * stimp * 0.3048) / G;

    // bounds for mesh
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
    const pad = obDist + 40;
    const bounds = { minX: minX - pad, maxX: maxX + pad, minZ: minZ - 70, maxZ: maxZ + 75 };

    return {
      cfg, par, tier, course: cfg.course, courseKey: C.key, len: Ls, yards: Math.round(Ls * M2YD),
      pts, green, grx, grz, grot, gc, gs, fringeW, pin, tee: { x: 0, z: 0, y: teeH, rot: teeRot },
      bunkers, ponds, trees, bounds, W, obDist, fwStart,
      wind: { x: Math.sin(windDir) * windSpd, z: Math.cos(windDir) * windSpd, speed: windSpd, dir: windDir },
      stimp, greenRoll,
      height, surface, normal, centerInfo, fwHalf, greenQ, ellQ, pondAt, treesNear, greenH,
      pointAtS,
    };
  }

  /* ---------- ball physics ---------- */
  function Ball() {
    this.x = 0; this.y = 0; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.wx = 0; this.wy = 0; this.wz = 0;
    this.state = 'rest'; this.t = 0; this.bounces = 0; this.path = [];
    this.cupT = 0; this.drop = 0; this.lipped = 0;
    this.maxY = 0; this.landed = false; this.carry = 0;
    this.sx = 0; this.sz = 0;
  }
  const _n = { x: 0, y: 0, z: 0 };

  Ball.prototype.place = function (hole, x, z) {
    this.x = x; this.z = z; this.y = hole.height(x, z) + BALL_R;
    this.vx = this.vy = this.vz = 0; this.wx = this.wy = this.wz = 0;
    this.state = 'rest';
  };

  // aim: radians (0 = +z). spinRpm backspin, sideRpm (+ = slice/right)
  Ball.prototype.launch = function (speed, launchDeg, aim, spinRpm, sideRpm) {
    const la = launchDeg * Math.PI / 180;
    const dx = Math.sin(aim), dz = Math.cos(aim);
    this.vx = dx * Math.cos(la) * speed; this.vz = dz * Math.cos(la) * speed; this.vy = Math.sin(la) * speed;
    // right vector = d x up = (dx,0,dz)x(0,1,0) = (-dz, 0, dx)
    const rx = -dz, rz = dx;
    const b = spinRpm * RPM, s = sideRpm * RPM;
    this.wx = rx * b; this.wz = rz * b; this.wy = -s;
    this.state = 'air'; this.t = 0; this.bounces = 0; this.landed = false;
    this.sx = this.x; this.sz = this.z; this.maxY = this.y; this.carry = 0;
    this.cupT = 0; this.drop = 0; this.lipped = 0;
    this.y += 0.01;
    this.path = [[this.x, this.y, this.z]]; this.pk = 0;
  };
  Ball.prototype.putt = function (hole, speed, aim) {
    this.vx = Math.sin(aim) * speed; this.vz = Math.cos(aim) * speed; this.vy = 0;
    this.wx = this.wy = this.wz = 0;
    this.state = 'roll'; this.t = 0; this.bounces = 0; this.landed = true;
    this.sx = this.x; this.sz = this.z; this.maxY = this.y; this.carry = 0;
    this.cupT = 0; this.drop = 0; this.lipped = 0;
  };

  function windAt(hole, hag, out) {
    const f = clamp(0.35 + 0.65 * (hag / 18), 0.35, 1.1);
    out.x = hole.wind.x * f; out.z = hole.wind.z * f;
  }
  const _w = { x: 0, z: 0 };

  function airAcc(b, vx, vy, vz, wnx, wnz, out) {
    const rx = vx - wnx, ry = vy, rz = vz - wnz;
    const sp = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1e-6;
    const om = Math.sqrt(b.wx * b.wx + b.wy * b.wy + b.wz * b.wz);
    const Sp = BALL_R * om / sp;
    const CD = 0.215 + 0.19 * Math.min(Sp, 0.5);
    let ax = -KAIR * CD * sp * rx, ay = -KAIR * CD * sp * ry - G, az = -KAIR * CD * sp * rz;
    if (om > 1) {
      const CL = Math.min(0.36, 0.52 * Math.pow(Sp, 0.42));
      let cx = b.wy * rz - b.wz * ry, cy = b.wz * rx - b.wx * rz, cz = b.wx * ry - b.wy * rx;
      const cm = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1e-6;
      const L = KAIR * CL * sp * sp / cm;
      ax += cx * L; ay += cy * L; az += cz * L;
    }
    out[0] = ax; out[1] = ay; out[2] = az;
  }
  const _a1 = [0, 0, 0], _a2 = [0, 0, 0];

  // ev: array to push events into. returns nothing.
  Ball.prototype.step = function (hole, dt, ev) {
    if (this.state === 'rest' || this.state === 'holed' || this.state === 'water' || this.state === 'ob') return;
    this.t += dt;
    if (this.state === 'air') this.stepAir(hole, dt, ev);
    else if (this.state === 'roll') this.stepRoll(hole, dt, ev);
    if (this.path && ++this.pk >= 3) { this.pk = 0; if (this.path.length < 4000) this.path.push([this.x, this.y, this.z]); }
    if (this.t > 40 && this.state !== 'holed') { this.state = 'rest'; ev.push({ type: 'rest' }); }
  };

  Ball.prototype.stepAir = function (hole, dt, ev) {
    const gh0 = hole.height(this.x, this.z);
    windAt(hole, this.y - gh0, _w);
    // RK2 midpoint
    airAcc(this, this.vx, this.vy, this.vz, _w.x, _w.z, _a1);
    const mvx = this.vx + _a1[0] * dt * 0.5, mvy = this.vy + _a1[1] * dt * 0.5, mvz = this.vz + _a1[2] * dt * 0.5;
    airAcc(this, mvx, mvy, mvz, _w.x, _w.z, _a2);
    this.x += mvx * dt; this.y += mvy * dt; this.z += mvz * dt;
    this.vx += _a2[0] * dt; this.vy += _a2[1] * dt; this.vz += _a2[2] * dt;
    const decay = Math.exp(-dt / 22);
    this.wx *= decay; this.wy *= decay; this.wz *= decay;
    if (this.y > this.maxY) this.maxY = this.y;

    // trees
    if (hole.trees.length) this.treeCollide(hole, ev, true);

    const gh = hole.height(this.x, this.z);
    // water surface
    const pond = this.y < gh + 3 ? hole.pondAt(this.x, this.z) : null;
    if (pond && this.y - BALL_R < pond.y && hole.surface(this.x, this.z) === S.WATER) {
      this.state = 'water'; this.y = pond.y; ev.push({ type: 'water' }); return;
    }
    if (this.y - BALL_R >= gh) return;

    // ground contact
    hole.normal(this.x, this.z, _n);
    this.y = gh + BALL_R;
    const vn = this.vx * _n.x + this.vy * _n.y + this.vz * _n.z;
    if (vn >= 0) return;
    const surf = hole.surface(this.x, this.z);
    if (!this.landed) {
      this.landed = true;
      this.carry = Math.hypot(this.x - this.sx, this.z - this.sz);
      ev.push({ type: 'land', surf, x: this.x, z: this.z });
    }
    // dunk
    const pdx = this.x - hole.pin.x, pdz = this.z - hole.pin.z;
    if (pdx * pdx + pdz * pdz < CUP_R * CUP_R * 1.1) { this.holeOut(hole, ev); return; }
    if (surf === S.WATER) { this.state = 'water'; ev.push({ type: 'water' }); return; }

    const impact = -vn;
    const sp = SP[surf];
    // tangential velocity
    let tx = this.vx - vn * _n.x, ty = this.vy - vn * _n.y, tz = this.vz - vn * _n.z;
    let tm = Math.sqrt(tx * tx + ty * ty + tz * tz);
    if (impact < 1.1) {
      this.vx = tx; this.vy = ty; this.vz = tz;
      this.state = 'roll';
      this.wx *= 0.2; this.wy *= 0.2; this.wz *= 0.2;
      return;
    }
    this.bounces++;
    const e = sp.e * clamp(1 - impact / 38, 0.3, 1);
    // backspin relative to tangential direction: axis = t x n
    let bs = 0;
    if (tm > 1e-4) {
      const ux = tx / tm, uy = ty / tm, uz = tz / tm;
      const ax = uy * _n.z - uz * _n.y, ay = uz * _n.x - ux * _n.z, az = ux * _n.y - uy * _n.x;
      bs = this.wx * ax + this.wy * ay + this.wz * az; // rad/s, + = backspin
      // target tangential speed (rolling w/o slip): (5v - 2*w*r*grip)/7
      const vRoll = (5 * tm - 2 * bs * BALL_R * sp.grip) / 7;
      const maxDv = sp.mu * (1 + e) * impact;
      let vNew = Math.min(tm, Math.max(tm - maxDv, vRoll));
      // turf softness
      vNew *= (1 - sp.turf * clamp(impact / 16, 0, 1));
      if (vNew < 0) vNew = Math.max(vNew, -Math.min(0.12 * tm, 2.2));
      const f = vNew / tm;
      tx *= f; ty *= f; tz *= f;
      ev.push({ type: 'bounce', surf, impact, spinBack: vNew < 0 });
    }
    this.vx = tx + _n.x * impact * e; this.vy = ty + _n.y * impact * e; this.vz = tz + _n.z * impact * e;
    this.wx *= 0.25; this.wy *= 0.25; this.wz *= 0.25;
    if (surf === S.SAND && impact > 6) { // plug-ish
      this.vx *= 0.25; this.vz *= 0.25; this.vy *= 0.2;
    }
  };

  Ball.prototype.stepRoll = function (hole, dt, ev) {
    hole.normal(this.x, this.z, _n);
    const surf = hole.surface(this.x, this.z);
    if (surf === S.WATER) { this.state = 'water'; ev.push({ type: 'water' }); return; }
    // remove normal velocity
    const vn = this.vx * _n.x + this.vy * _n.y + this.vz * _n.z;
    if (vn < 0) { this.vx -= vn * _n.x; this.vy -= vn * _n.y; this.vz -= vn * _n.z; }
    // gravity along surface (rolling sphere: 5/7)
    const gx = G * _n.y * _n.x, gy = -G + G * _n.y * _n.y, gz = G * _n.y * _n.z;
    const k57 = 5 / 7;
    const rollC = (surf === S.GREEN ? hole.greenRoll : SP[surf].roll) * G;
    const sp = Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz);
    const gmag = Math.sqrt(gx * gx + gy * gy + gz * gz) * k57;
    if (sp < 0.05 && gmag < rollC * 0.95) {
      this.vx = this.vy = this.vz = 0; this.state = 'rest';
      this.y = hole.height(this.x, this.z) + BALL_R;
      ev.push({ type: 'rest' }); return;
    }
    let ax = gx * k57, ay = gy * k57, az = gz * k57;
    if (sp > 1e-5) { ax -= rollC * this.vx / sp; ay -= rollC * this.vy / sp; az -= rollC * this.vz / sp; }
    const ovx = this.vx, ovz = this.vz;
    this.vx += ax * dt; this.vy += ay * dt; this.vz += az * dt;
    // friction can't reverse direction on its own
    if (sp > 1e-5 && (this.vx * ovx + this.vz * ovz) < 0 && gmag < rollC) {
      this.vx = this.vy = this.vz = 0;
    }
    this.x += this.vx * dt; this.z += this.vz * dt; this.y += this.vy * dt;
    const gh = hole.height(this.x, this.z);
    const gap = this.y - BALL_R - gh;
    if (gap > 0.004 + 0.6 * G * dt * dt && sp > 2.5) {
      this.state = 'air'; // launched off a crest
    } else {
      this.y = gh + BALL_R;
    }
    // trees (trunks)
    if (hole.trees.length) this.treeCollide(hole, ev, false);
    // cup
    const pdx = this.x - hole.pin.x, pdz = this.z - hole.pin.z;
    const pd = Math.sqrt(pdx * pdx + pdz * pdz);
    if (pd < CUP_R) {
      this.cupT += dt;
      this.drop = 0.5 * G * this.cupT * this.cupT;
      if (this.drop > BALL_R * 1.0) { this.holeOut(hole, ev); return; }
    } else if (this.cupT > 0) {
      const sev = clamp(this.drop / BALL_R, 0, 1);
      const spd = Math.hypot(this.vx, this.vz);
      // dropped far enough to catch the back wall below the ball's equator: it rattles in
      if (sev >= 0.82 && spd < 1.85) { this.holeOut(hole, ev); return; }
      // otherwise it rides the lip
      const nx = pdx / (pd || 1), nz = pdz / (pd || 1);
      // deflect away from cup center, lose speed
      const keep = 1 - 0.55 * sev;
      const dirx = this.vx / (spd || 1), dirz = this.vz / (spd || 1);
      let ndx = dirx + nx * 0.6 * sev, ndz = dirz + nz * 0.6 * sev;
      const nl = Math.hypot(ndx, ndz) || 1;
      this.vx = ndx / nl * spd * keep; this.vz = ndz / nl * spd * keep;
      this.cupT = 0; this.drop = 0; this.lipped++;
      ev.push({ type: 'lip', sev });
    }
  };

  // tree response (round 4). Canopy: a bouncy surface: the velocity reflects about the canopy's outward normal, keeping
  // e of the normal speed and keepT of the tangential speed, turned by up to scatterDeg (seeded from the tree), spin x spin.
  // Trunk: a hard bounce (normal restitution trunkE, then x trunkKeep). The same tree is ignored for `ignore` s after a hit.
  // keepT is 0.55, not the brief's 0.75: with 0.75 a glancing hit keeps up to 75% of its speed (the round 4 target is 25-55%)
  const TREE = { e: 0.3, keepT: 0.55, scatterDeg: 8, spin: 0.5, ignore: 0.25, trunkE: 0.5, trunkKeep: 0.7 };
  Ball.prototype.treeCollide = function (hole, ev, air) {
    const near = hole.treesNear(this.x, this.z);
    for (let i = 0; i < near.length; i++) {
      const t = near[i];
      // just bounced off this tree (this shot): let it get clear
      if (t === this.tIgn && this.sx === this.tIgnSx && this.sz === this.tIgnSz && this.t >= this.tIgnT && this.t < this.tIgnT + TREE.ignore) continue;
      const dx = this.x - t.x, dz = this.z - t.z;
      const hd = Math.sqrt(dx * dx + dz * dz);
      const hy = this.y - t.y;
      // trunk
      if (t.trunkR > 0 && hy < t.trunkH + (t.kind === 'cactus' ? 0 : 0.5) && hd < t.trunkR + BALL_R) {
        const nx = dx / (hd || 1), nz = dz / (hd || 1);
        const vn = this.vx * nx + this.vz * nz;
        if (vn < 0) {
          const vin = Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz);
          this.vx -= (1 + TREE.trunkE) * vn * nx; this.vz -= (1 + TREE.trunkE) * vn * nz;
          this.vx *= TREE.trunkKeep; this.vz *= TREE.trunkKeep;
          this.x = t.x + nx * (t.trunkR + BALL_R + 0.01); this.z = t.z + nz * (t.trunkR + BALL_R + 0.01);
          this.tIgn = t; this.tIgnT = this.t; this.tIgnSx = this.sx; this.tIgnSz = this.sz;
          ev.push({ type: 'tree', hard: true, vin, vout: Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz) });
          continue;
        }
      }
      if (!air || t.cr <= 0) continue;
      // canopy: round trees a sphere; pines a cone (approximated by a shrinking circle at the ball's height) over a short cylinder
      let cr = t.cr, nx, ny, nz, px, py, pz;
      if (t.kind === 'pine') {
        const top = t.trunkH + t.ch; if (hy > top) continue;
        const q = (top - hy) / t.ch; cr = t.cr * clamp(q, 0, 1.1);
        if (hd >= cr) continue;
        const ux = dx / (hd || 1), uz = dz / (hd || 1), k = q < 1.1 ? t.cr / t.ch : 0, l = Math.sqrt(1 + k * k);
        nx = ux / l; ny = k / l; nz = uz / l;
        px = t.x + ux * (cr + 0.02); py = this.y; pz = t.z + uz * (cr + 0.02);
      } else {
        const ddy = this.y - (t.y + t.cy), d2 = dx * dx + ddy * ddy + dz * dz;
        if (d2 >= cr * cr) continue;
        const d = Math.sqrt(d2) || 1;
        nx = dx / d; ny = ddy / d; nz = dz / d;
        px = t.x + nx * (cr + 0.02); py = t.y + t.cy + ny * (cr + 0.02); pz = t.z + nz * (cr + 0.02);
      }
      const vn = this.vx * nx + this.vy * ny + this.vz * nz;
      if (vn >= 0) continue;   // already on its way out
      const vin = Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz);
      // reflection: tangential part kept x keepT, normal part reversed x e
      let rx = (this.vx - vn * nx) * TREE.keepT - vn * TREE.e * nx;
      let ry = (this.vy - vn * ny) * TREE.keepT - vn * TREE.e * ny;
      let rz = (this.vz - vn * nz) * TREE.keepT - vn * TREE.e * nz;
      // scatter: turn the exit by up to scatterDeg about a direction picked from the tree's seed
      const rs = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1, r = t.rnd * 1000 + this.t * 37.1;
      const ang = TREE.scatterDeg * Math.PI / 180 * Math.abs(Math.sin(r * 2.1)), az = r * 1.7;
      let ax = ry * 0 - rz * 1, ay = rz * 0 - rx * 0, azz = rx * 1 - ry * 0;          // exit x up
      if (ax * ax + azz * azz < 1e-9 * rs * rs) { ax = 1; ay = 0; azz = 0; }
      let al = Math.sqrt(ax * ax + ay * ay + azz * azz); ax /= al; ay /= al; azz /= al;
      const ex = rx / rs, ey = ry / rs, ez = rz / rs;
      const bx = ey * azz - ez * ay, by = ez * ax - ex * azz, bz = ex * ay - ey * ax;     // exit x a
      const kx = ax * Math.cos(az) + bx * Math.sin(az), ky = ay * Math.cos(az) + by * Math.sin(az), kz = azz * Math.cos(az) + bz * Math.sin(az);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      let sx = (ex * ca + kx * sa) * rs, sy = (ey * ca + ky * sa) * rs, sz = (ez * ca + kz * sa) * rs;
      // never scattered back into the leaves
      const sn = sx * nx + sy * ny + sz * nz;
      if (sn < 0) { sx -= 2 * sn * nx; sy -= 2 * sn * ny; sz -= 2 * sn * nz; }
      this.vx = sx; this.vy = sy; this.vz = sz;
      this.wx *= TREE.spin; this.wy *= TREE.spin; this.wz *= TREE.spin;
      this.x = px; this.y = py; this.z = pz;
      this.tIgn = t; this.tIgnT = this.t; this.tIgnSx = this.sx; this.tIgnSz = this.sz;
      ev.push({ type: 'tree', hard: false, vin, vout: rs, nx, ny, nz, rx: ex, ry: ey, rz: ez });
    }
  };

  Ball.prototype.holeOut = function (hole, ev) {
    this.sink = { x: this.x, y: this.y - (this.drop || 0), z: this.z, vx: this.vx, vz: this.vz };
    this.state = 'holed'; this.x = hole.pin.x; this.z = hole.pin.z;
    this.y = hole.pin.y - 0.06; this.vx = this.vy = this.vz = 0;
    ev.push({ type: 'holed' });
  };

  /* ---------- flat test hole + calibration ---------- */
  const FLAT = {
    pin: { x: 0, z: 1e6, y: 0 }, wind: { x: 0, z: 0 }, trees: [], greenRoll: 0.05,
    height() { return 0; }, surface() { return S.FAIRWAY; }, pondAt() { return null; },
    normal(x, z, o) { o.x = 0; o.y = 1; o.z = 0; return o; }, treesNear() { return []; },
  };

  function simCarry(club, speed, power, spinMul, hole, startX, startZ, aim, opts) {
    hole = hole || FLAT;
    const b = new Ball();
    b.place(hole, startX || 0, startZ || 0);
    const p = power;
    b.launch(speed * p, club.loft, aim || 0, club.spin * spinMul * (0.55 + 0.45 * Math.min(p, 1)), 0);
    const ev = [];
    let n = 0;
    while (b.state === 'air' && !b.landed && n < 20000) { b.step(hole, DT, ev); n++; }
    const res = { carry: b.carry || Math.hypot(b.x - b.sx, b.z - b.sz), apex: b.maxY - (hole.height(startX || 0, startZ || 0) + BALL_R), x: b.x, z: b.z, t: b.t };
    if (opts && opts.full) {
      while (b.state === 'air' || b.state === 'roll') { b.step(hole, DT, ev); if (++n > 60000) break; }
      res.total = Math.hypot(b.x - b.sx, b.z - b.sz); res.fx = b.x; res.fz = b.z; res.state = b.state;
    }
    return res;
  }

  let calibrated = false;
  function calibrate() {
    if (calibrated) return;
    for (const c of CLUBS) {
      if (c.putter) continue;
      const target = c.carry / M2YD;
      c.fullCarry = target;
      let lo = 10, hi = 95;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        const r = simCarry(c, mid, 1, 1);
        if (r.carry < target) lo = mid; else hi = mid;
      }
      c.speed = (lo + hi) / 2;
      c.table = []; // [speedFraction, carry]
      for (let sf = 0.1; sf <= 1.1301; sf += 0.03) c.table.push([sf, simCarry(c, c.speed, sf, 1).carry]);
    }
    calibrated = true;
  }
  function tableInv(t, dist) {
    if (dist <= t[0][1]) return t[0][0] * dist / t[0][1];
    for (let i = 1; i < t.length; i++) if (t[i][1] >= dist) {
      const a = t[i - 1], b = t[i]; return lerp(a[0], b[0], (dist - a[1]) / (b[1] - a[1]));
    }
    return t[t.length - 1][0];
  }
  function tableFwd(t, sf) {
    if (sf <= t[0][0]) return t[0][1] * sf / t[0][0];
    for (let i = 1; i < t.length; i++) if (t[i][0] >= sf) {
      const a = t[i - 1], b = t[i]; return lerp(a[1], b[1], (sf - a[0]) / (b[0] - a[0]));
    }
    return t[t.length - 1][1];
  }
  // power: swing meter value. <=1 maps linearly to carry; >1 (overswing) adds raw speed.
  function speedFrac(club, power) { return power > 1 ? power : tableInv(club.table, power * club.fullCarry); }
  function carryFor(club, power) { return power <= 1 ? power * club.fullCarry : tableFwd(club.table, power); }
  function powerFor(club, dist) { return dist <= club.fullCarry ? dist / club.fullCarry : tableInv(club.table, dist); }

  // full-swing launch parameters
  function shotParams(club, power, dev, lie, upg) {
    upg = upg || { power: 0, control: 0, spin: 0 };
    const L = SP[lie];
    let ls = L.ls, lsp = L.lsp;
    if (lie === S.SAND && club.sand) { ls = 0.88; lsp = 0.8; }
    if (club.id === 'DR' && lie !== S.TEE) ls *= 0.9;
    const sf = speedFrac(club, power);
    const ctl = 1 - 0.11 * upg.control;
    return {
      speed: club.speed * sf * ls * (1 + 0.022 * upg.power),
      launch: club.loft + (lie === S.ROUGH ? 1.5 : 0) + (lie === S.SAND ? 2.5 : 0),
      spin: club.spin * (0.55 + 0.45 * Math.min(sf, 1)) * lsp * (1 + 0.12 * upg.spin),
      side: dev * 2400 * club.curve * ctl,
      aimOff: dev * 2.4 * club.dev * ctl * Math.PI / 180,
    };
  }
  function puttSpeed(hole, dist) { return Math.sqrt(2 * hole.greenRoll * G * Math.max(dist, 0.05)); }
  const PUTT_SCALES = [3, 6, 10, 16, 24, 34];
  function puttMax(dist) { for (const m of PUTT_SCALES) if (m >= dist * 1.3 + 0.4) return m; return 44; }

  // where to drop after finding water: last dry point on the path, backed up toward the shot origin
  function findDrop(hole, ball) {
    const P = ball.path;
    for (let i = P.length - 1; i >= 0; i -= 1) {
      const x = P[i][0], z = P[i][2];
      const sf = hole.surface(x, z);
      if (sf !== S.WATER && sf !== S.OB) {
        let dx = ball.sx - x, dz = ball.sz - z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        for (let k = 2; k < 40; k += 1.5) {
          const qx = x + dx * k, qz = z + dz * k;
          const s2 = hole.surface(qx, qz);
          if (s2 !== S.WATER && s2 !== S.OB && !hole.pondAt(qx, qz)) return { x: qx, z: qz };
        }
        return { x, z };
      }
    }
    return { x: ball.sx, z: ball.sz };
  }

  /* ---------- tour definition ---------- */
  const EVENTS = [];
  for (let i = 0; i < 24; i++) {
    const course = Math.floor(i / 6);
    const tier = 1 + i * 0.36;
    const cutRel = Math.max(-1, 4 - Math.floor(i / 4));
    EVENTS.push({ idx: i, course, tier, cutRel, name: COURSES[course].name + ' ' + ['Open', 'Classic', 'Invitational', 'Championship', 'Masters', 'Grand Final'][i % 6] });
  }

  const api = {
    G, BALL_R, CUP_R, M2YD, DT, S, SURF_NAMES, SP, CLUBS, COURSES, EVENTS, RPM,
    mulberry32, hashStr, makeNoise, clamp, lerp, smoothstep,
    TREE, makeRound, buildHole, Ball, calibrate, carryFor, powerFor, speedFrac, shotParams, puttSpeed, puttMax, findDrop, simCarry, FLAT,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
