/* ================= 랙과 피니언 =================
 design = { kind:'rack', m, pa, b, backlash, z1, x1, nR(랙 잇수), H(랙 등 두께), bore1, dcut1, rpm } */
function rackPair(Q) {
  return { version: 3, kind: 'rack', m: Q.m, pa: Q.pa, b: Q.b, backlash: Q.bl, z1: Q.z1, x1: Q.autoX ? autoShift(Q.z1) : (Q.x1 || 0),
    nR: Math.max(4, Math.round(Q.nR)), H: Q.H, bore1: Q.bore1, dcut1: Q.d1 ? 0.5 : 0, rpm: Q.rpm, box: null };
}
function rackOutline(D) {
  const m = D.m, p = PI * m, ta = Math.tan(D.pa * D2R), bl = D.backlash || 0;
  const wt = p / 4 - bl / 2 - m * ta, wr = p / 4 - bl / 2 + 1.25 * m * ta, yr = -1.25 * m, yb = yr - D.H;
  const k0 = -Math.floor(D.nR / 2), cs = Array.from({ length: D.nR }, (_, i) => (k0 + i + 0.5) * p);
  const x0 = cs[0] - p / 2, x1 = cs[cs.length - 1] + p / 2, pts = [[x0, yb], [x1, yb], [x1, yr]];
  for (let i = cs.length - 1; i >= 0; i--) { const c = cs[i]; pts.push([c + wr, yr], [c + wt, m], [c - wt, m], [c - wr, yr]); }
  pts.push([x0, yr]);
  return { pts, x0, x1, yb, wt, wr, p };
}
function rackModel(D) {
  const g1 = { name: 'G1', m: D.m, z: D.z1, pa: D.pa, x: D.x1, b: D.b, backlash: D.backlash };
  const I = gearOutlineInfo(g1), r = I.r, cy = r + D.x1 * D.m, R = rackOutline(D);
  const w = D.rpm * 2 * PI / 60, travel = Math.max(R.p, (R.x1 - R.x0) / 2 - I.ra - R.p), thMax = travel / r;
  const th = t => thMax * Math.sin(w * t / thMax);
  const bore = borePts(D.bore1, D.dcut1);
  const model = { kind: 'rack', housing: [], rods: [], notes: [], frame: false };
  model.parts = [
    { name: 'G1', file: `G1_pinion_m${D.m}_z${D.z1}`, tris: extrudeTris(gearOutline(g1).pts, bore ? [bore] : [], D.b), motion: t => XF.mul(XF.T(0, cy, 0), XF.Rz(-PI / 2 + th(t))) },
    { name: 'R1', file: `R1_rack_m${D.m}_n${D.nR}_L${fmt(R.x1 - R.x0, 1)}`, tris: extrudeTris(R.pts, [], D.b), motion: t => XF.T(r * th(t), 0, 0) },
  ];
  model.rods.push({ a: [0, cy, -6], b: [0, cy, D.b + 12], d: D.bore1 > 0 ? D.bore1 : 3, role: 'input' });
  const checks = [];
  // 물림률 (랙): 피니언 쪽 접근 + 랙 쪽 접근
  const a = D.pa * D2R, ga = Math.sqrt(I.ra ** 2 - I.rb ** 2) - r * Math.sin(a), gr = Math.min(D.m - D.x1 * D.m, 1e9) / Math.sin(a);
  const eps = (ga + gr) / (PI * D.m * Math.cos(a));
  checks.push({ st: eps >= 1.2 ? 'ok' : eps >= 1.05 ? 'warn' : 'bad', txt: `피니언–랙 물림률 <em>${eps.toFixed(2)}</em> · 피니언 1바퀴에 랙 <em>${fmt(2 * PI * r, 2)} mm</em> 이동 · 이동 속도 <em>${fmt(w * r, 1)} mm/s</em>` });
  checks.push({ st: 'ok', txt: `랙 길이 <em>${fmt(R.x1 - R.x0, 1)} mm</em> · 시뮬레이션은 랙이 끝까지 가지 않도록 피니언이 왕복 회전합니다 (±<em>${fmt(thMax / D2R, 0)}°</em>)` });
  if (D.z1 < 17 && D.x1 < (17 - D.z1) / 17 - 0.02) checks.push({ st: 'warn', txt: `피니언 잇수 ${D.z1} < 17: 언더컷이 생깁니다. 전위 자동 적용을 켜세요.` });
  if (D.bore1 > 0 && I.rf - D.bore1 / 2 < 1.5) checks.push({ st: 'bad', txt: '피니언 이뿌리와 축 구멍 사이가 1.5 mm보다 얇습니다.' });
  model.checks = checks;
  model.interference = () => {
    const P1 = gearOutline(g1).pts, steps = 24, out = { pair: 'G1–R1', hits: 0, steps };
    const tip = []; for (let k = 0; k < D.nR; k++) { const c = (Math.floor(-D.nR / 2) + k + 0.5) * R.p; tip.push([c - R.wt, D.m], [c + R.wt, D.m], [c, D.m]); }
    for (let i = 0; i < steps; i++) {
      const ang = (i / steps) * 2 * PI / D.z1 + 0.3, dx = r * ang, c = Math.cos(-PI / 2 + ang), s = Math.sin(-PI / 2 + ang);
      const Pw = P1.map(([x, y]) => [x * c - y * s - dx, x * s + y * c + cy]);
      if (Pw.some(([x, y]) => y < D.m + 0.01 && pointInPoly(x, y, R.pts)) || tip.some(([x, y]) => pointInPoly(x + dx, y - cy, P1.map(([u, v]) => [u * c - v * s, u * s + v * c])))) out.hits++;
    }
    return [out];
  };
  model.table = { head: ['부품', '종류', 'z / 잇수', 'm', 'α', 'x', '피치원·피치', '이끝', '폭 b', '구멍'],
    rows: [ { part: 0, cells: ['G1', '피니언', D.z1, D.m, D.pa + '°', fmt(D.x1, 3), fmt(2 * r, 2), fmt(2 * I.ra, 2), D.b, D.bore1 > 0 ? fmt(D.bore1, 2) + (D.dcut1 ? ' D' : '') : '–'] },
      { part: 1, cells: ['R1', '랙', D.nR, D.m, D.pa + '°', '0', `p ${fmt(R.p, 3)}`, `등 두께 ${D.H}`, D.b, '–'] } ] };
  model.hud = [['입력', fmt(D.rpm, 1) + ' rpm'], ['랙 속도', fmt(w * r, 1) + ' mm/s'], ['1회전 이동', fmt(2 * PI * r, 2) + ' mm']];
  model.notes.push('랙은 출력판에 눕혀 그대로 출력됩니다. 랙을 곧게 안내할 홈이나 레일을 따로 두세요. 피니언 중심은 랙 피치선에서 ' + fmt(cy, 3) + ' mm 위입니다.');
  model.scad = () => rackScad(D, cy);
  return model;
}
function rackScad(D, cy) {
  return `// 기어 설계실: 랙과 피니언 (OpenSCAD). 숫자를 바꾸고 F6 → STL로 내보내기
mode = "assembly";   // "assembly" | "pinion" | "rack"
m = ${D.m}; pa = ${D.pa}; b = ${D.b}; bl = ${D.backlash};
z1 = ${D.z1}; x1 = ${D.x1}; bore1 = ${D.bore1}; dcut1 = ${D.dcut1};
nR = ${D.nR}; H = ${D.H};   // 랙 잇수, 랙 등 두께
res = 10;
${SCAD_LIB}
function rack_pts(m, pa, n, H, bl) = let(p = PI*m, wt = p/4 - bl/2 - m*tan(pa), wr = p/4 - bl/2 + 1.25*m*tan(pa), yr = -1.25*m,
  k0 = -floor(n/2), x0 = (k0)*p, x1 = (k0 + n)*p)
  concat([[x0, yr - H], [x1, yr - H], [x1, yr]],
    [ for (i = [n-1:-1:0]) let(c = (k0 + i + 0.5)*p) each [[c + wr, yr], [c + wt, m], [c - wt, m], [c - wr, yr]] ],
    [[x0, yr]]);
module rack() linear_extrude(b) polygon(rack_pts(m, pa, nR, H, bl));
module pinion() spur_gear(m, z1, pa, x1, b, bl, bore1, dcut1);
if (mode == "assembly") { rack(); translate([0, m*z1/2 + x1*m, 0]) rotate(-90) pinion(); }
else if (mode == "pinion") pinion(); else rack();
`;
}
