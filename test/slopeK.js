// brightness difference between green faces tilted toward vs away from the sun on a 2% slope,
// using three.js r128 Lambert (per-vertex): E = hemi(n) + sun * max(n.L, 0); hemi = mix(ground, sky, 0.5 n.y + 0.5) * I
const THEMES = {
  meadow: { sun: 0xfff1da, sunI: 0.8, sky: 0xe4f0ff, ground: 0x56743e, hemiI: 0.62, green: 0x8ad565, green2: 0x7ecb5b },
  links: { sun: 0xfff7e8, sunI: 0.78, sky: 0xeef5ff, ground: 0x7d7a52, hemiI: 0.64, green: 0x8ed06a, green2: 0x84c761 },
  desert: { sun: 0xffe9c8, sunI: 0.85, sky: 0xfff2e0, ground: 0x9a6b45, hemiI: 0.58, green: 0x8ad864, green2: 0x80ce5c },
  autumn: { sun: 0xffe9cc, sunI: 0.8, sky: 0xf1ecff, ground: 0x5c5a32, hemiI: 0.6, green: 0x86d260, green2: 0x7bc858 },
};
const rgb = (h) => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
function E(th, n, L) {
  const w = 0.5 * n[1] + 0.5, sky = rgb(th.sky), gr = rgb(th.ground), sun = rgb(th.sun);
  const nl = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
  return [0, 1, 2].map((i) => (gr[i] + (sky[i] - gr[i]) * w) * th.hemiI + sun[i] * th.sunI * nl);
}
function diff(th, K, s, elDeg) {
  const el = elDeg * Math.PI / 180, L = [Math.cos(el), Math.sin(el), 0];
  const nrm = (x) => { const l = Math.hypot(x, 1); return [x / l, 1 / l, 0]; };
  const et = lum(E(th, nrm(K * s), L)), ea = lum(E(th, nrm(-K * s), L)), ef = lum(E(th, [0, 1, 0], L));
  return (et - ea) / ef;
}
const Ks = [1, 4, 5, 5.5, 6, 7];
console.log('2% slope, toward vs away from the sun, as % of flat brightness (sun elevation 27 / 36 / 45 deg)');
for (const K of Ks) {
  const row = [];
  for (const k in THEMES) row.push(k + ' ' + [27, 36, 45].map((e) => (diff(THEMES[k], K, 0.02, e) * 100).toFixed(1)).join('/'));
  console.log('K=' + K + '  ' + row.join('   '));
}
console.log('\nstripe contrast (green vs green2 drawn at alpha a), % luminance:');
for (const k in THEMES) { const a = lum(rgb(THEMES[k].green)), b = lum(rgb(THEMES[k].green2)); console.log(k, 'alpha 0.9: ' + ((a - b) / a * 90).toFixed(1) + '%', ' alpha 0.6: ' + ((a - b) / a * 60).toFixed(1) + '%'); }
