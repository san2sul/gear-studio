/* ================= 웜과 웜휠 =================
 design = { kind:'worm', m(축방향 모듈), pa, n(줄 수), q(직경계수), z2, b2, Lw, backlash, bore1, bore2, rpm } */
function wormPair(Q) {
  const m = Q.m, d1 = Q.q * m, da1 = d1 + 2 * m;
  const b2 = Q.b > 0 ? Q.b : Math.round(0.7 * da1 * 2) / 2;
  const Lw = Q.Lw > 0 ? Q.Lw : Math.ceil((Q.n <= 2 ? 11 + 0.06 * Q.z2 : 12.5 + 0.09 * Q.z2) * m);
  return { version: 3, kind: 'worm', m, pa: Q.pa, n: Q.n, q: Q.q, z2: Q.z2, b2, Lw, backlash: Q.bl, bore1: Q.bore1, bore2: Q.bore2, rpm: Q.rpm, box: null };
}
function wormGeom(D) {
  const m = D.m, p = PI * m, L = D.n * p, r1 = D.q * m / 2, ra = r1 + m, rf = r1 - 1.25 * m, ta = Math.tan(D.pa * D2R), bl = D.backlash || 0;
  const gam = Math.atan(L / (2 * PI * r1));
  const wAx = rho => p / 4 - bl / 2 - (rho - r1) * ta;           // 축방향 나사산 반두께
  const half = rho => 2 * PI * wAx(Math.max(rf, Math.min(ra, rho))) / L;   // 단면에서 나사산 반각
  const a = (D.q + D.z2) * m / 2;
  return { m, p, L, r1, ra, rf, ta, gam, wAx, half, a };
}
function wormOutline(D, res = 14) {
  const W = wormGeom(D), out = [], st = 2 * PI / D.n, hR = W.half(W.rf), rootN = 6;
  const rhos = Array.from({ length: res + 1 }, (_, i) => W.rf + (W.ra - W.rf) * i / res);
  for (let k = 0; k < D.n; k++) {
    const c = k * st, lobe = [];
    rhos.forEach(rho => lobe.push([rho, c - W.half(rho)]));
    for (let j = 1; j < 4; j++) lobe.push([W.ra, c - W.half(W.ra) + 2 * W.half(W.ra) * j / 4]);
    for (let i = rhos.length - 1; i >= 0; i--) lobe.push([rhos[i], c + W.half(rhos[i])]);
    for (let j = 1; j < rootN; j++) lobe.push([W.rf, c + hR + (st - 2 * hR) * j / rootN]);
    out.push(...lobe);
  }
  return out.map(([rr, t]) => [rr * Math.cos(t), rr * Math.sin(t)]);
}
function wormTris(D) {
  const W = wormGeom(D), bore = borePts(D.bore1, D.bore1 > 0 ? 0.5 : 0);
  return gearExtrude({ b: D.Lw, helix: 1, _outline: wormOutline(D, 10), _twist: z => 2 * PI * z / W.L, _step: 3 }, bore ? [bore] : []);
}
// 점 P(웜 지역 좌표)가 웜 나사산 안인지
function inWorm(W, D, x, y, z) {
  if (z < 0 || z > D.Lw) return false;
  const rho = Math.hypot(x, y); if (rho > W.ra) return false; if (rho <= W.rf) return true;
  const st = 2 * PI / D.n; let ph = Math.atan2(y, x) - 2 * PI * z / W.L;
  ph = ((ph % st) + st) % st; if (ph > st / 2) ph -= st;
  return Math.abs(ph) <= W.half(rho);
}
function wormWheel(D, hand) {
  const W = wormGeom(D);
  return { name: 'G2', m: D.m * Math.cos(W.gam), z: D.z2, pa: Math.atan(Math.tan(D.pa * D2R) * Math.cos(W.gam)) / D2R, x: 0, b: D.b2, backlash: D.backlash, helix: hand * W.gam / D2R, herring: false };
}
// 휠 나선 방향·회전 방향·위상을 간섭 표본으로 찾음
function wormSolve(D) {
  const W = wormGeom(D), w1 = D.rpm * 2 * PI / 60, Mw = XF.basis([0, 1, 0], [0, 0, 1], [1, 0, 0], [-D.Lw / 2, -W.a, 0]);
  const zs = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1];
  const sample = (hand) => { const g = wormWheel(D, hand), tw = gearTwist(g), pts = gearOutline(g).pts;
    return zs.map(f => { const h = f * g.b, t = tw(h), c = Math.cos(t), s = Math.sin(t); return { z: h - g.b / 2, pts: pts.map(([x, y]) => [x * c - y * s, x * s + y * c]) }; }); };
  const hits = (S, dir, ph, a1) => {
    const inv = XF.inv(XF.mul(Mw, XF.Rz(a1))), a2 = ph + dir * a1 * D.n / D.z2, c = Math.cos(a2), s = Math.sin(a2); let n = 0;
    for (const L of S) for (const [x0, y0] of L.pts) {
      const x = x0 * c - y0 * s, y = x0 * s + y0 * c, z = L.z;
      if (Math.hypot(y + W.a, z) > W.ra) continue;
      const q = XF.apply(inv, [x, y, z]); if (inWorm(W, D, q[0], q[1], q[2])) n++;
    }
    return n;
  };
  const NP = 36, NT = 6, pitch = 2 * PI / D.z2;
  let best = null;
  for (const hand of [1, -1]) { const S = sample(hand);
    for (const dir of [1, -1]) {
      const row = [];
      for (let i = 0; i < NP; i++) { let tot = 0; for (let k = 0; k < NT; k++) tot += hits(S, dir, i * pitch / NP, k * 2 * PI / D.n / NT); row.push(tot); }
      const mn = Math.min(...row);
      // 가장 긴 최소값 구간의 가운데
      let bi = 0, bl = 0; for (let i = 0; i < NP; i++) { let l = 0; while (l < NP && row[(i + l) % NP] === mn) l++; if (l > bl) { bl = l; bi = i; } }
      const cand = { hand, dir, phase: ((bi + (bl - 1) / 2) % NP) * pitch / NP, score: mn, run: bl };
      if (!best || cand.score < best.score || (cand.score === best.score && cand.run > best.run)) best = cand;
    }
  }
  return { ...best, W, Mw, w1, hits, sample };
}
function wormModel(D) {
  const S = wormSolve(D), W = S.W, g2 = wormWheel(D, S.hand), I2 = gearOutlineInfo(g2);
  const w1 = S.w1, w2 = S.dir * w1 * D.n / D.z2;
  const model = { kind: 'worm', housing: [], rods: [], notes: [], frame: false };
  const bore2 = borePts(D.bore2, D.bore2 > 0 ? 0.5 : 0);
  model.parts = [
    { name: 'W1', file: `W1_worm_m${D.m}_n${D.n}_q${D.q}_L${D.Lw}`, tris: wormTris(D), motion: t => XF.mul(S.Mw, XF.Rz(w1 * t)) },
    { name: 'G2', file: `G2_wormwheel_m${D.m}_z${D.z2}`, tris: gearExtrude(g2, bore2 ? [bore2] : []), motion: t => XF.mul(XF.T(0, 0, -D.b2 / 2), XF.Rz(S.phase + w2 * t)) },
  ];
  model.rods.push({ a: [-D.Lw / 2 - 6, -W.a, 0], b: [D.Lw / 2 + 12, -W.a, 0], d: D.bore1 > 0 ? D.bore1 : 3, role: 'input' });
  model.rods.push({ a: [0, 0, -D.b2 / 2 - 6], b: [0, 0, D.b2 / 2 + 12], d: D.bore2 > 0 ? D.bore2 : 3, role: 'output' });
  const checks = [], ratio = D.z2 / D.n, gdeg = W.gam / D2R;
  checks.push({ st: 'ok', txt: `변속비 <em>${ratioTxt(ratio)}</em> · 출력 <em>${fmt(rpmOf(w2), 2)} rpm</em> · 중심거리 <em>${fmt(W.a, 3)} mm</em> · 리드각 <em>${fmt(gdeg, 2)}°</em>` });
  checks.push(gdeg < 6 ? { st: 'ok', txt: `리드각이 ${fmt(gdeg, 1)}°로 작아 휠 쪽에서 웜을 돌리기 어렵습니다 (자동 잠김). 하중을 붙잡아 두는 용도에 좋습니다.` }
    : { st: 'warn', txt: `리드각 ${fmt(gdeg, 1)}°: 휠 쪽에서 역으로 돌아갈 수 있습니다. 붙잡아 두려면 줄 수를 줄이거나 직경계수 q를 키우세요.` });
  if (D.z2 < 24) checks.push({ st: 'warn', txt: `웜휠 잇수 ${D.z2}가 작습니다. 24 이상을 권장합니다 (언더컷·물림 부족).` });
  if (D.bore1 > 0 && W.rf - D.bore1 / 2 < 1.5) checks.push({ st: 'bad', txt: `웜 이뿌리와 축 구멍 사이가 ${fmt(W.rf - D.bore1 / 2, 2)} mm로 얇습니다. q나 모듈을 키우거나 구멍을 줄이세요.` });
  if (D.bore2 > 0 && I2.rf - D.bore2 / 2 < 1.5) checks.push({ st: 'bad', txt: '웜휠 이뿌리와 축 구멍 사이가 1.5 mm보다 얇습니다.' });
  if (S.score > 0) checks.push({ st: 'bad', txt: `웜과 휠이 겹치는 위치가 있습니다 (표본 ${S.score}점). 백래시를 늘리거나 휠 폭을 줄이세요.` });
  else checks.push({ st: 'ok', txt: `웜 1/${D.n}바퀴 동안 휠과 겹치지 않음 (위상 여유 ${S.run}/36)` });
  model.checks = checks;
  model.interference = () => {
    const Sm = S.sample(S.hand), steps = 24; let h = 0;
    for (let k = 0; k < steps; k++) if (S.hits(Sm, S.dir, S.phase, k * 2 * PI / D.n / steps) > 0) h++;
    return [{ pair: 'W1–G2', hits: h, steps }];
  };
  model.table = { head: ['부품', '종류', 'z / 줄 수', 'm', 'α', '피치원 d', '이끝원', '폭·길이', '나선(리드)각', '구멍', 'rpm'],
    rows: [ { part: 0, cells: ['W1', `웜 (오른나사)`, D.n + '줄', D.m, D.pa + '°', fmt(2 * W.r1, 2), fmt(2 * W.ra, 2), D.Lw, fmt(gdeg, 2) + '°', D.bore1 > 0 ? fmt(D.bore1, 2) + ' D' : '–', fmt(D.rpm, 1)] },
      { part: 1, cells: ['G2', `웜휠 (${S.hand > 0 ? '오른' : '왼'}나선)`, D.z2, D.m, D.pa + '°', fmt(2 * I2.r, 2), fmt(2 * I2.ra, 2), D.b2, fmt(gdeg, 2) + '°', D.bore2 > 0 ? fmt(D.bore2, 2) + ' D' : '–', fmt(rpmOf(w2), 2)] } ] };
  model.hud = [['입력 (웜)', fmt(D.rpm, 1) + ' rpm'], ['출력 (휠)', fmt(rpmOf(w2), 2) + ' rpm'], ['변속비', ratioTxt(ratio)]];
  model.notes.push('웜휠은 나선각이 리드각과 같은 헬리컬 기어로 만든 근사형입니다 (3D 프린팅용으로 흔히 쓰는 방식). 접촉이 점에 가까우니 큰 힘에는 모듈과 휠 폭을 키우세요.',
    '웜은 세워서 출력하면 나사산 아랫면이 ' + fmt(90 - D.pa, 0) + '° 기울어진 오버행이 됩니다. 압력각 25°를 쓰거나 트리 서포트를 켜면 깔끔합니다.');
  model.scad = () => wormScad(D, S, g2);
  return model;
}
function wormScad(D, S, g2) {
  return `// 기어 설계실: 웜과 웜휠 (OpenSCAD). 숫자를 바꾸고 F6 → STL로 내보내기
mode = "assembly";   // "assembly" | "worm" | "wheel"
m = ${D.m}; pa = ${D.pa}; bl = ${D.backlash};
n = ${D.n}; q = ${D.q}; Lw = ${D.Lw}; bore1 = ${D.bore1};      // 웜: 줄 수, 직경계수, 길이, 구멍
z2 = ${D.z2}; b2 = ${D.b2}; bore2 = ${D.bore2};                  // 웜휠
hand = ${S.hand}; wheel_phase = ${fmt(S.phase / D2R, 3)};       // 계산된 휠 나선 방향과 맞물림 위상(°)
res = 10;
${SCAD_LIB}
function worm_pts(m, n, q, pa, bl) = let(p = PI*m, L = n*p, r1 = q*m/2, ra = r1 + m, rf = r1 - 1.25*m, st = 360/n,
    hf = function(rho) (p/4 - bl/2 - (rho - r1)*tan(pa)) * 360 / L)
  [ for (k = [0:n-1]) let(c = k*st) each concat(
      [ for (i = [0:res]) let(rho = rf + (ra-rf)*i/res) pol(rho, c - hf(rho)) ],
      [ for (i = [res:-1:0]) let(rho = rf + (ra-rf)*i/res) pol(rho, c + hf(rho)) ],
      [ for (j = [1:5]) pol(rf, c + hf(rf) + (st - 2*hf(rf))*j/6) ]) ];
module worm() { L = n*PI*m;
  difference() { linear_extrude(Lw, twist = -360*Lw/L, slices = ceil(Lw/L*90)) polygon(worm_pts(m, n, q, pa, bl));
    translate([0, 0, -1]) linear_extrude(Lw + 2) bore2d(bore1, 0.5); } }
gam = atan(n/q);
module wheel() spur_gear(m*cos(gam), z2, atan(tan(pa)*cos(gam)), 0, b2, bl, bore2, 0.5, hand*gam, 0);
if (mode == "assembly") {
  a = (q + z2)*m/2;
  multmatrix([[0,0,1,-Lw/2],[1,0,0,-a],[0,1,0,0],[0,0,0,1]]) worm();
  translate([0, 0, -b2/2]) rotate(wheel_phase) wheel();
} else if (mode == "worm") worm(); else wheel();
`;
}
