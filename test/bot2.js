const E = require("../engine.js"); E.calibrate(); const S = E.S;
const src = require('fs').readFileSync(__dirname+'/bot.js','utf8');
const fnSrc = src.slice(src.indexOf('let rnd'), src.indexOf('const stats'));
eval(fnSrc.replace('const SKILL = +(process.argv[2]||0.16);','const SKILL=0.16;'));
for (const evi of [17,19,22]) { const E0=E.EVENTS[evi]; const round=E.makeRound('event'+evi,E0.tier,E0.course);
 for (const hc of round.holes){ const h=E.buildHole(hc); const r=playHole(h);
  console.log(evi, 'par',hc.par, h.yards+'y', 'W',h.W.toFixed(0),'wind', (h.wind.speed*2.237).toFixed(0)+'mph','stimp',h.stimp.toFixed(1),'ponds',h.ponds.length,'bunk',h.bunkers.length,'trees',h.trees.length,'->',r.strokes,'putts',r.putts,'pen',r.penalties);
 }}
