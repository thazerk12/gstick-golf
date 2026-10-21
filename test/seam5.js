// Round 5 Task 5: no seam at the green's edge. The relief offset is (relief - 1) * w * (h - pin.y), w = the tint weight
// (1 on the green, 0 at the fringe's outer edge). For many holes: w at every vertex on the green mesh's outer boundary,
// and w at every terrain-mesh vertex of a terrain triangle that overlaps the green mesh's area (the terrain is cut out where
// a cell's centre has greenQ < 1.25 and is drawn at the physical height). Both must be 0: then the two surfaces meet exactly.
// usage: node test/seam5.js [holes per tier]
const path = require('path');
const E = require(path.join(__dirname, '../engine.js')); E.calibrate();
const N = +(process.argv[2] || 12), relief = 2.5;
const greenW = (h, x, z) => 1 - E.smoothstep(1, 1 + h.fringeW / Math.min(h.grx, h.grz), h.greenQ(x, z));
let worstB = 0, worstT = 0, worstOff = 0, holes = 0, qFmax = 0, info = null;
for (let tier = 1; tier <= 9; tier++) for (let s = 0; s < N; s++) {
  const rd = E.makeRound('seam-' + tier + '-' + s, tier, s % 4);
  for (const cfg of rd.holes) {
    const h = E.buildHole(cfg); holes++;
    qFmax = Math.max(qFmax, 1 + h.fringeW / Math.min(h.grx, h.grz));
    // green mesh: same grid as buildGreen; boundary = vertices of included cells that touch an excluded cell
    const R = Math.max(h.grx, h.grz) * 1.6 + 2, cell = 0.45, n = Math.ceil(2 * R / cell), x0 = h.green.x - R, z0 = h.green.z - R;
    const inc = (i, j) => i >= 0 && j >= 0 && i < n && j < n && h.greenQ(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell) <= 1.5;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const c = [inc(i - 1, j - 1), inc(i, j - 1), inc(i - 1, j), inc(i, j)], any = c.some(Boolean), all = c.every(Boolean);
      if (!any || all) continue;
      const x = x0 + i * cell, z = z0 + j * cell, w = greenW(h, x, z);
      if (w > worstB) { worstB = w; }
    }
    // terrain mesh near the green: vertices of included terrain cells within the green mesh's square
    const b = h.bounds, W = b.maxX - b.minX, D = b.maxZ - b.minZ, tc = Math.max(1.5, Math.sqrt(W * D / 72000));
    const nx = Math.ceil(W / tc), nz = Math.ceil(D / tc);
    const i0 = Math.max(0, Math.floor((x0 - b.minX) / tc)), i1 = Math.min(nx - 1, Math.ceil((x0 + 2 * R - b.minX) / tc)), j0 = Math.max(0, Math.floor((z0 - b.minZ) / tc)), j1 = Math.min(nz - 1, Math.ceil((z0 + 2 * R - b.minZ) / tc));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (h.greenQ(b.minX + (i + 0.5) * tc, b.minZ + (j + 0.5) * tc) < 1.25) continue;
      for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const x = Math.min(b.minX + (i + di) * tc, b.maxX), z = Math.min(b.minZ + (j + dj) * tc, b.maxZ), w = greenW(h, x, z);
        if (w > worstT) { worstT = w; info = { tier, seed: s, hole: cfg.seed, q: +h.greenQ(x, z).toFixed(3), qF: +(1 + h.fringeW / Math.min(h.grx, h.grz)).toFixed(3) }; }
        worstOff = Math.max(worstOff, Math.abs((relief - 1) * w * (h.height(x, z) - h.pin.y)));
      }
    }
  }
}
console.log(JSON.stringify({ holes, maxFringeEdgeQ: +qFmax.toFixed(3), greenMeshBoundaryMaxW: worstB, terrainVertexMaxW: +worstT.toFixed(4), terrainVertexMaxOffsetM: +worstOff.toFixed(4), worstTerrain: info }));
