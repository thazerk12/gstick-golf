const E = require('../engine.js');
const t0 = Date.now(); E.calibrate(); console.log('calibrate ms', Date.now()-t0);
const mk = (surf) => Object.assign({}, E.FLAT, { surface(){return surf;} });
const FW = mk(E.S.FAIRWAY), GR = mk(E.S.GREEN), RO = mk(E.S.ROUGH);
for (const c of E.CLUBS) { if (c.putter) continue;
  const r = E.simCarry(c, c.speed, 1, 1, FW, 0, 0, 0, {full:true});
  const g = E.simCarry(c, c.speed, 1, 1, GR, 0, 0, 0, {full:true});
  const ro = E.simCarry(c, c.speed, 1, 1, RO, 0, 0, 0, {full:true});
  const half = E.carryFor(c, 0.5);
  console.log(c.id.padEnd(3), 'spd', c.speed.toFixed(1), 'mph', (c.speed*2.237).toFixed(0), 'carry', (r.carry*E.M2YD).toFixed(0)+'y', 'apex', (r.apex*3.28).toFixed(0)+'ft', 't', r.t.toFixed(1)+'s',
   '| roll fw', ((r.total-r.carry)*E.M2YD).toFixed(1), 'gr', ((g.total-g.carry)*E.M2YD).toFixed(1), 'rough', ((ro.total-ro.carry)*E.M2YD).toFixed(1), '| 50%', (half*E.M2YD).toFixed(0));
}
