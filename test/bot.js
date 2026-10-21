const E = require(process.env.ENGINE ? require('path').resolve(process.env.ENGINE) : '../engine.js');
E.calibrate();
const S = E.S;
let rnd = E.mulberry32(42);
const gauss = () => { let u=0,v=0; while(!u)u=rnd(); v=rnd(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
const SKILL = +(process.argv[2]||0.16);
function playHole(hole, log) {
  const b = new E.Ball(); b.place(hole, 0, 0);
  let strokes = 0, lie = S.TEE, penalties=0, putts=0, maxSlope=0;
  const ev = [];
  while (strokes < 12) {
    const dx = hole.pin.x - b.x, dz = hole.pin.z - b.z, dist = Math.hypot(dx, dz);
    let aim = Math.atan2(dx, dz);
    const sx=b.x, sz=b.z;
    strokes++;
    if (lie === S.GREEN || (lie === S.FRINGE && dist < 15)) {
      putts++;
      const sp = E.puttSpeed(hole, dist + 0.35) * (1 + gauss() * 0.07);
      b.putt(hole, sp, aim + gauss() * 0.02);
    } else {
      const L = E.SP[lie];
      // pick club
      let club = null;
      const clubs = E.CLUBS.filter(c => !c.putter && (lie===S.TEE || c.id!=='DR'));
      for (let i = clubs.length - 1; i >= 0; i--) { if (clubs[i].fullCarry * (lie===S.SAND && clubs[i].sand ? 0.88 : L.ls) >= dist * 0.97) { club = clubs[i]; break; } }
      let target = dist;
      if (!club) { club = clubs[0];
        // aim along centerline
        const ci = hole.centerInfo(b.x, b.z, {});
        const p = hole.pointAtS(ci.s + club.fullCarry * L.ls * 0.95);
        aim = Math.atan2(p.x - b.x, p.z - b.z); target = club.fullCarry;
      }
      const ls = (lie===S.SAND && club.sand) ? 0.88 : L.ls;
      const power = Math.min(1, E.powerFor(club, target / ls * 0.97));
      const dev = gauss() * SKILL + gauss() * L.ld;
      const sp = E.shotParams(club, power, dev, lie);
      b.launch(sp.speed, sp.launch, aim + sp.aimOff, sp.spin, sp.side);
    }
    let n = 0;
    while (b.state === 'air' || b.state === 'roll') { ev.length = 0; b.step(hole, E.DT, ev); if (++n > 60000) { console.log('STUCK'); break; }
      if (!isFinite(b.x+b.y+b.z)) { console.log('NaN!'); return null; }
      const gh = hole.height(b.x,b.z); if (b.y < gh - 0.2 && b.state!=='holed' && b.state!=='water') { console.log('UNDERGROUND', b.state, b.y-gh); return null; }
    }
    if (b.state === 'holed') return { strokes, penalties, putts };
    if (b.state === 'water') { strokes++; penalties++; const d = E.findDrop(hole, b); b.place(hole, d.x, d.z); lie = hole.surface(b.x,b.z); continue; }
    lie = hole.surface(b.x, b.z);
    if (lie === S.OB) { strokes++; penalties++; b.place(hole, sx, sz); lie = hole.surface(sx,sz); continue; }
    b.state = 'rest';
  }
  return { strokes: 12, penalties, putts, capped: true };
}
const stats = {};
let tGen = 0, nGen = 0, maxGreenSlope = 0;
for (let ev = 0; ev < 24; ev += 1) {
  const E0 = E.EVENTS[ev];
  const round = E.makeRound('event' + ev, E0.tier, E0.course);
  let tot = 0, parTot = 0, pen = 0, putts=0;
  for (const hc of round.holes) {
    const t0 = Date.now(); const hole = E.buildHole(hc); tGen += Date.now() - t0; nGen++;
    // green slope check
    const n = {x:0,y:0,z:0};
    for (let i=0;i<200;i++){ const a=rnd()*6.28, r=Math.sqrt(rnd()); const x=hole.green.x+Math.cos(a)*r*hole.grx*0.95, z=hole.green.z+Math.sin(a)*r*hole.grx*0.95;
      if (hole.surface(x,z)!==S.GREEN) continue; hole.normal(x,z,n); maxGreenSlope=Math.max(maxGreenSlope, Math.sqrt(1-n.y*n.y)/n.y); }
    const r = playHole(hole); if (!r) continue;
    tot += r.strokes; parTot += hc.par; pen += r.penalties; putts += r.putts;
  }
  console.log(`event ${ev} tier ${E0.tier.toFixed(1)} ${E.COURSES[E0.course].key.padEnd(6)} score ${tot}/${parTot} (${tot-parTot>=0?'+':''}${tot-parTot}) pen ${pen} putts ${putts} cut ${E0.cutRel}`);
}
console.log('avg gen ms', (tGen/nGen).toFixed(1), 'max green slope', (maxGreenSlope*100).toFixed(1)+'%');
