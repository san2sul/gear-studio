/* ================= 사이클로이드 감속기 =================
 design = { kind:'cycloid', N(링 핀 수), R(핀 원 반지름), rp(핀 반지름), e(편심량), T(원판 두께), nOut, Ro, rOut, shaftD, backlash, rpm } */
function cycloidPair(Q) {
  const R = Q.R, N = Q.N;
  return { version: 4, kind: 'cycloid', N, R, rp: Q.rp, e: Q.e, T: Q.T, nOut: Q.nOut, Ro: Q.Ro > 0 ? Q.Ro : +(R * 0.5).toFixed(1), rOut: Q.rOut, shaftD: Q.shaftD, backlash: Q.bl, rpm: Q.rpm, box: null };
}
function cycloidProfile(D, n = 0) {
  const N = D.N, R = D.R, e = D.e, rp = D.rp + (D.backlash || 0) / 2, pts = [], M = n || (N - 1) * 48;
  for (let i = 0; i < M; i++) {
    const t = 2 * PI * i / M, psi = Math.atan2(Math.sin((1 - N) * t), R / (e * N) - Math.cos((1 - N) * t));
    pts.push([R * Math.cos(t) - rp * Math.cos(t + psi) - e * Math.cos(N * t), -R * Math.sin(t) + rp * Math.sin(t + psi) + e * Math.sin(N * t)]);
  }
  return area2(pts) < 0 ? pts.reverse() : pts;
}
function segDist(px, py, P) {   // 점에서 닫힌 다각형 경계까지 거리
  let best = Infinity;
  for (let i = 0, n = P.length; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / L)) : 0;
    best = Math.min(best, Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy));
  }
  return best;
}
// 원판의 놓임(중심 방향·회전 위상·회전 부호)을 핀과의 틈새로 찾음
function cycloidSolve(D) {
  const P = cycloidProfile(D, (D.N - 1) * 120), N = D.N, pins = Array.from({ length: N }, (_, k) => [D.R * Math.cos(2 * PI * k / N), D.R * Math.sin(2 * PI * k / N)]);
  const clr = (c, phi) => { let m = Infinity; const cs = Math.cos(-phi), sn = Math.sin(-phi);
    for (const [px, py] of pins) { const x = px - c[0], y = py - c[1], lx = x * cs - y * sn, ly = x * sn + y * cs;
      const d = segDist(lx, ly, P) * (pointInPoly(lx, ly, P) ? -1 : 1) - D.rp; m = Math.min(m, d); } return m; };
  let best = null;
  const per = 2 * PI / (N - 1);
  for (const c0 of [[D.e, 0], [-D.e, 0]]) for (let i = 0; i < 48; i++) {
    const phi = i / 48 * per, v = clr(c0, phi);
    if (!best || v > best.v) best = { c0, phi, v };
  }
  for (let i = -20; i <= 20; i++) { const phi = best.phi + i / 20 * per / 48, v = clr(best.c0, phi); if (v > best.v) best = { ...best, phi, v }; }
  // 회전 부호: 입력이 돌 때 틈새가 유지되는 쪽
  const test = sg => { let m = Infinity; for (let k = 1; k <= 12; k++) { const th = k / 12 * 2 * PI / (N - 1) * 3, c = rot2(best.c0, th); m = Math.min(m, clr(c, best.phi + sg * th / (N - 1))); } return m; };
  const a = test(1), b = test(-1), sg = a > b ? 1 : -1;
  return { ...best, sg, clrRun: sg > 0 ? a : b, clr };
}
function cycloidModel(D) {
  const S = cycloidSolve(D), N = D.N, k = S.sg / (N - 1), w = D.rpm * 2 * PI / 60, sd = D.shaftD, cl = 0.3;
  const P = cycloidProfile(D), T = D.T, z0 = 0.3, re = sd / 2 + D.e + 3;
  const holeR = D.rOut + D.e + 0.2, rmin = Math.min(...P.map(p => Math.hypot(p[0], p[1])));
  const discHoles = [circlePts(re + 0.25, 64)].concat(Array.from({ length: D.nOut }, (_, j) => circlePts(holeR, 40, D.Ro * Math.cos(2 * PI * j / D.nOut), D.Ro * Math.sin(2 * PI * j / D.nOut))));
  const model = { kind: 'cycloid', parts: [], housing: [], rods: [], notes: [], checks: [], frame: true };
  const ecc = extrudeTris(circlePts(re, 64, D.e, 0), [borePts(sd + 0.1, 0.5)], T);   // 편심축: 중심 (e,0)에서 돌아가는 원
  const th0 = Math.atan2(S.c0[1], S.c0[0]);
  const outR = Math.min(D.R - 1, D.Ro + D.rOut + 5), outT = 4, zOut = z0 + T + 0.7;
  const outPlate = extrudeTris(circlePts(outR, 96), [borePts(sd + 0.1, 0.5)], outT).map(t => t.map((v, i) => i % 3 === 2 ? v + zOut : v))
    .concat(extrudeTris(circlePts(sd / 2 + 4, 48), [borePts(sd + 0.1, 0.5)], 6).map(t => t.map((v, i) => i % 3 === 2 ? v + zOut + outT - 0.2 : v)));
  let outPins = [];
  for (let j = 0; j < D.nOut; j++) { const a = 2 * PI * j / D.nOut; outPins = outPins.concat(xfTris(extrudeTris(circlePts(D.rOut, 32), [], zOut + 0.2 - (z0 + 0.3)), XF.T(D.Ro * Math.cos(a), D.Ro * Math.sin(a), z0 + 0.3))); }
  model.parts.push(
    { name: '편심축', file: `eccentric_e${D.e}`, tris: xfTris(ecc, XF.T(0, 0, z0)), motion: t => XF.Rz(th0 + w * t) },
    { name: '사이클로이드 원판', file: `cycloid_disc_N${N}_R${D.R}_e${D.e}`, tris: xfTris(extrudeTris(P, discHoles, T), XF.T(0, 0, z0)), motion: t => XF.mul(XF.T(...rot2(S.c0, w * t), 0), XF.Rz(S.phi + k * w * t)), print: XF.T(0, 0, -z0) },
    { name: '출력판', file: `output_plate_${D.nOut}pins`, tris: outPlate.concat(outPins), motion: t => XF.Rz(S.phi + k * w * t), print: XF.Rx(PI) },
  );
  // 하우징: 바닥판 + 링 핀(일체) + 바깥 벽
  const Rw = D.R + D.rp + 1.2, baseT = 4, pinH = z0 + T + 0.3;
  let hous = xfTris(extrudeTris(circlePts(Rw + 3, 128), [circlePts((sd + 0.4) / 2, 40)], baseT), XF.T(0, 0, -baseT))
    .concat(xfTris(extrudeTris(circlePts(Rw + 3, 128), [circlePts(Rw, 128)], pinH + 0.2), XF.T(0, 0, -0.2)));
  for (let j = 0; j < N; j++) { const a = 2 * PI * j / N; hous = hous.concat(xfTris(extrudeTris(circlePts(D.rp, 32), [], pinH + 0.2), XF.T(D.R * Math.cos(a), D.R * Math.sin(a), -0.2))); }
  model.housing.push({ name: '하우징 (링 핀 일체)', file: `housing_N${N}_R${D.R}`, tris: hous, print: XF.T(0, 0, baseT) });
  model.rods.push({ a: [0, 0, -baseT - 12], b: [0, 0, z0 + T], d: sd, role: 'input' }, { a: [0, 0, zOut], b: [0, 0, zOut + outT + 18], d: sd, role: 'output' });
  // 검사
  const c = model.checks, ratio = N - 1;
  c.push({ st: 'ok', txt: `변속비 <em>${ratio} : 1</em> · 출력 <em>${fmt(D.rpm / ratio, 2)} rpm</em> · 출력은 입력과 <em>${S.sg > 0 ? '같은' : '반대'}</em> 방향 · 원판 로브 ${N - 1}개` });
  const eLim = D.R / N;
  if (D.e >= eLim) c.push({ st: 'bad', txt: `편심량 ${D.e} mm가 R/N(${fmt(eLim, 2)} mm) 이상이라 원판 윤곽이 뾰족해지거나 꼬입니다. 편심을 줄이세요.` });
  const cr = curveRadii(P), minR = Math.min(...cr.filter(r => r > 0));
  if (minR < 0.3) c.push({ st: 'bad', txt: '원판 윤곽이 뾰족해집니다. 핀 반지름을 줄이거나 편심을 줄이세요.' });
  const run = S.clrRun;
  c.push({ st: run > -0.05 ? 'ok' : 'bad', txt: run > -0.05 ? `회전하는 동안 원판과 링 핀 사이 최소 틈새 <em>${fmt(Math.max(0, run), 2)} mm</em> (백래시 ${D.backlash} mm)` : `원판이 링 핀을 ${fmt(-run, 2)} mm 파고듭니다. 백래시를 늘리세요.` });
  if (D.Ro - holeR - (re + 0.25) < 1.5) c.push({ st: 'bad', txt: '출력 구멍이 가운데 편심 구멍에 너무 가깝습니다. 출력 핀 원 반지름을 키우세요.' });
  if (rmin - (D.Ro + holeR) < 1.5) c.push({ st: 'bad', txt: '출력 구멍이 원판 바깥에 너무 가깝습니다. 출력 핀 원 반지름이나 핀을 줄이세요.' });
  if (2 * PI * D.Ro / D.nOut < 2 * holeR + 1.5) c.push({ st: 'bad', txt: '출력 구멍끼리 겹칩니다. 출력 핀 수를 줄이세요.' });
  if (D.rp < 1.5) c.push({ st: 'warn', txt: '링 핀이 가늘어 출력하면 부러지기 쉽습니다. 금속 핀(지름 ' + fmt(2 * D.rp, 1) + ' mm)으로 바꿔 끼우는 것을 권합니다.' });
  model.interference = () => { const steps = 24; let h = 0; for (let i = 0; i < steps; i++) { const th = i / steps * 2 * PI; if (S.clr(rot2(S.c0, th), S.phi + k * th) < -0.05) h++; } return [{ pair: '원판–링 핀', hits: h, steps }]; };
  model.table = { head: ['부품', '종류', '주요 치수', '비고'], rows: [
    { part: 0, cells: ['편심축', '입력', `편심 e ${D.e} · 반지름 ${fmt(re, 2)}`, `축 ${sd} D컷`] },
    { part: 1, cells: ['원판', '사이클로이드', `로브 ${N - 1} · 최소/최대 반지름 ${fmt(rmin, 1)} / ${fmt(Math.max(...P.map(p => Math.hypot(p[0], p[1]))), 1)} · 두께 ${T}`, `출력 구멍 ${D.nOut}×⌀${fmt(2 * holeR, 2)}`] },
    { part: 2, cells: ['출력판', '출력', `핀 ${D.nOut}×⌀${fmt(2 * D.rOut, 1)} @R${D.Ro}`, `축 ${sd} D컷`] } ] };
  model.hud = [['입력', fmt(D.rpm, 1) + ' rpm'], ['출력', fmt(D.rpm / ratio, 2) + ' rpm'], ['변속비', ratio + ' : 1']];
  model.notes.push('원판 1장 구조라 빠르게 돌리면 흔들립니다. 저속·고토크용으로 쓰거나, 원판을 180° 엇갈린 2장으로 늘리세요.', '출력판의 핀은 원판 구멍 안에서 굴러다니며 원판의 느린 자전만 꺼내 줍니다. 위에 덮개를 얹거나 출력축을 고정해 출력판이 빠지지 않게 하세요.');
  model.single = false;
  model.scad = () => cycloidScad(D, S);
  return model;
}
function cycloidScad(D, S) {
  return `// 기어 설계실: 사이클로이드 감속기 (OpenSCAD). 숫자를 바꾸고 F6 → STL로 내보내기
mode = "disc";   // "disc" | "eccentric" | "output" | "housing"
N = ${D.N}; R = ${D.R}; rp = ${D.rp}; e = ${D.e}; T = ${D.T}; bl = ${D.backlash};
nOut = ${D.nOut}; Ro = ${D.Ro}; rOut = ${D.rOut}; sd = ${D.shaftD};
${SCAD_LIB}
function cyc_pt(t) = let(r = rp + bl/2, psi = atan2(sin((1-N)*t), R/(e*N) - cos((1-N)*t)))
  [R*cos(t) - r*cos(t + psi) - e*cos(N*t), -R*sin(t) + r*sin(t + psi) + e*sin(N*t)];
re = sd/2 + e + 3;
module disc() difference() {
  linear_extrude(T) polygon([ for (i = [0:(N-1)*48-1]) cyc_pt(i*360/((N-1)*48)) ]);
  translate([0, 0, -1]) cylinder(r = re + 0.25, h = T + 2, $fn = 64);
  for (j = [0:nOut-1]) rotate(j*360/nOut) translate([Ro, 0, -1]) cylinder(r = rOut + e + 0.2, h = T + 2, $fn = 40);
}
module eccentric() difference() { translate([e, 0, 0]) cylinder(r = re, h = T, $fn = 64); translate([0, 0, -1]) linear_extrude(T + 2) bore2d(sd + 0.1, 0.5); }
module output() { difference() { union() { cylinder(r = min(R - 1, Ro + rOut + 5), h = 4, $fn = 96); translate([0, 0, 3.8]) cylinder(r = sd/2 + 4, h = 6, $fn = 48); }
    translate([0, 0, -1]) linear_extrude(12) bore2d(sd + 0.1, 0.5); }
  for (j = [0:nOut-1]) rotate(j*360/nOut) translate([Ro, 0, -T - 0.4]) cylinder(r = rOut, h = T + 0.6, $fn = 32); }
module housing() { Rw = R + rp + 1.2;
  difference() { cylinder(r = Rw + 3, h = 4, $fn = 128); translate([0, 0, -1]) cylinder(d = sd + 0.4, h = 6, $fn = 40); }
  translate([0, 0, 4]) difference() { cylinder(r = Rw + 3, h = T + 0.8, $fn = 128); translate([0, 0, -1]) cylinder(r = Rw, h = T + 3, $fn = 128); }
  for (j = [0:N-1]) rotate(j*360/N) translate([R, 0, 3.8]) cylinder(r = rp, h = T + 1, $fn = 32); }
if (mode == "disc") disc(); else if (mode == "eccentric") eccentric(); else if (mode == "output") output(); else housing();
`;
}
