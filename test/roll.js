const E = require('../engine.js');
E.calibrate();
const mk = (surf) => Object.assign({}, E.FLAT, { surface(){return surf;} });
function run(label){
  const FW = mk(E.S.FAIRWAY), GR = mk(E.S.GREEN), RO=mk(E.S.ROUGH);
  let out=[];
  for (const id of ['DR','5I','7I','9I','PW','SW','LW']) { const c=E.CLUBS.find(c=>c.id===id);
    const r = E.simCarry(c, c.speed, 1, 1, FW, 0,0,0,{full:true});
    const g = E.simCarry(c, c.speed, 1, 1, GR, 0,0,0,{full:true});
    const g2 = E.simCarry(c, c.speed, 1, 1.4, GR, 0,0,0,{full:true});
    const ro = E.simCarry(c, c.speed, 1, 1, RO, 0,0,0,{full:true});
    out.push(`${id} fw ${((r.total-r.carry)*E.M2YD).toFixed(1)} gr ${((g.total-g.carry)*E.M2YD).toFixed(1)} gr+spin ${((g2.total-g2.carry)*E.M2YD).toFixed(1)} ro ${((ro.total-ro.carry)*E.M2YD).toFixed(1)}`);
  }
  console.log(label+'\n  '+out.join('\n  '));
}
const args = JSON.parse(process.argv[2]||'{}');
for (const k in args) Object.assign(E.SP[+k], args[k]);
run(process.argv[2]||'base');
