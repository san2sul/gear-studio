/* ================= 자유 조립: 축과 단(stage)으로 이루어진 3D 기어열 =================
 design = { kind:'train', rpm, pa, backlash, shaftD, gap, clear, input:{axis, origin},
   stages:[{type:'spur'|'bevel', from, zA, zB, m, b, angle, dir, apex, stack, offset, idler, sd, xA, xB, hub}],
   supports:{ base, ends, skip:['3:lo',...], walls:[{normal, pos}] } } */
const AXES = { '+x': [1, 0, 0], '-x': [-1, 0, 0], '+y': [0, 1, 0], '-y': [0, -1, 0], '+z': [0, 0, 1], '-z': [0, 0, -1] };
const AXIS_UV = { '+z': ['+x', '+y'], '-z': ['+y', '+x'], '+x': ['+y', '+z'], '-x': ['+z', '+y'], '+y': ['+z', '+x'], '-y': ['+x', '+z'] };
const AXIS_KO = { '+x': '+X', '-x': '−X', '+y': '+Y', '-y': '−Y', '+z': '+Z', '-z': '−Z' };
const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  sc: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
};
const axisBasis = ax => { const [u, v] = AXIS_UV[ax]; return XF.basis(AXES[u], AXES[v], AXES[ax]); };
const perpAxes = ax => Object.keys(AXES).filter(k => Math.abs(V.dot(AXES[k], AXES[ax])) < 0.5);

function trainSolve(D) {
  const errs = [], shafts = [], gears = [], meshes = [];
  const gap = D.gap ?? 1, sd = D.shaftD;
  shafts.push({ axis: D.input.axis, P: D.input.origin.slice(), gears: [], made: null, from: null });
  const bevelLen = g => { const B = bevelInfo(g); return B.zt + B.hub; };
  const RW = 3;   // 링 기어 받침판 두께
  const span = g => {   // 축 좌표 s 위에서 차지하는 구간
    if (g.internal) return g.web === '+' ? [g.s, g.s + g.b + gap + RW] : [g.s - gap - RW, g.s + g.b];
    if (g.type === 'spur') return [g.s, g.s + g.b];
    const L = bevelLen(g); return g.flip ? [g.s - L, g.s] : [g.s, g.s + L];
  };
  const occupied = i => { const iv = shafts[i].gears.map(k => span(gears[k])); return iv.length ? [Math.min(...iv.map(v => v[0])), Math.max(...iv.map(v => v[1]))] : null; };
  const place = (i, g, st) => {    // 같은 축의 기존 기어 위(+)나 아래(−)에 층을 쌓음
    const len = g.type === 'spur' ? g.b : bevelLen(g);
    if (st.sd != null && st.sd !== '') { g.s = +st.sd; return; }
    const occ = occupied(i), off = +st.offset || 0;
    if (!occ) { g.s = g.type === 'bevel' && g.flip ? len + off : off; return; }
    if (st.stack === '-') { const end = occ[0] - gap - off; g.s = g.type === 'bevel' && g.flip ? end : end - len; }
    else { const start = occ[1] + gap + off; g.s = g.type === 'bevel' && g.flip ? start + len : start; }
  };
  D.stages.forEach((st, k) => {
    const i = +st.from;
    if (!(i >= 0 && i < shafts.length)) { errs.push(`${k + 1}단: 출발 축 S${i} 이 없습니다.`); return; }
    const sh = shafts[i], a = AXES[sh.axis], m = +st.m, pa = D.pa, bl = D.backlash;
    let A;
    if (st.idler) {
      if (st.type !== 'spur' || sh.made == null || gears[sh.made].type !== 'spur') { errs.push(`${k + 1}단: 아이들러는 평기어로 만들어진 축에서만 쓸 수 있습니다.`); return; }
      A = sh.made;
    } else {
      const g = st.type === 'spur'
        ? { type: 'spur', shaft: i, m, z: +st.zA, pa, x: st.internal ? 0 : st.xA != null ? +st.xA : autoShift(+st.zA), b: +st.b, backlash: bl, flip: false, stage: k, helix: +st.helix || 0, herring: !!(+st.helix && st.herring) }
        : { type: 'bevel', shaft: i, m, z: +st.zA, pa, backlash: bl, flip: st.apex === '-', stage: k, hub: st.hub ?? 4, spiral: +st.spiral || 0 };
      if (g.type === 'bevel') { g.delta = Math.atan2(+st.zA, +st.zB); const A0 = m * st.zA / 2 / Math.sin(g.delta); g.F = +st.b > 0 ? +st.b : Math.floor(Math.min(A0 / 3, 10 * m) * 100) / 100; g.bore = sd + 0.35; }
      place(i, g, st);
      A = gears.push(g) - 1; sh.gears.push(A);
    }
    const gA = gears[A];
    let gB, newShaft;
    if (st.type === 'spur' && st.internal) {
      if (+st.zB - gA.z < 10) errs.push(`${k + 1}단: 내접 기어는 링 잇수가 피니언보다 10 이상 많아야 합니다 (지금 ${gA.z}:${st.zB}).`);
      gB = { type: 'spur', internal: true, m: gA.m, z: +st.zB, pa, x: 0, b: gA.b, backlash: bl, flip: false, s: gA.s, stage: k, helix: gA.helix || 0, herring: !!gA.herring, web: st.web === '+' ? '+' : '-', rw: RW, gap };
      const cd = tvx(gA).m * (gB.z - gA.z) / 2, [u, v] = AXIS_UV[sh.axis], th = (+st.angle || 0) * D2R;
      const dir = V.add(V.sc(AXES[u], Math.cos(th)), V.sc(AXES[v], Math.sin(th)));
      newShaft = { axis: sh.axis, P: V.add(sh.P, V.sc(dir, cd)), gears: [], from: k };
      gB.cd = cd; gB.dir = dir;
      gB.rodSpan = gB.web === '+' ? [gB.s + gB.b + gap, gB.s + gB.b + gap + RW] : [gB.s - gap - RW, gB.s - gap];
    } else if (st.type === 'spur') {
      gB = { type: 'spur', m: gA.m, z: +st.zB, pa, x: st.xB != null ? +st.xB : autoShift(+st.zB), b: gA.b, backlash: bl, flip: false, s: gA.s, stage: k, helix: -(gA.helix || 0), herring: !!gA.herring };
      const cd = meshGeom(gA, gB).cd, [u, v] = AXIS_UV[sh.axis], th = (+st.angle || 0) * D2R;
      const dir = V.add(V.sc(AXES[u], Math.cos(th)), V.sc(AXES[v], Math.sin(th)));
      newShaft = { axis: sh.axis, P: V.add(sh.P, V.sc(dir, cd)), gears: [], from: k };
      gB.cd = cd; gB.dir = dir;
    } else {
      if (!perpAxes(sh.axis).includes(st.dir)) { errs.push(`${k + 1}단: 베벨 출력 방향 ${AXIS_KO[st.dir] || st.dir} 이 축 ${AXIS_KO[sh.axis]} 에 수직이 아닙니다.`); return; }
      gB = { type: 'bevel', m, z: +st.zB, pa, backlash: bl, delta: PI / 2 - gA.delta, F: gA.F, flip: true, stage: k, hub: st.hub ?? 4, bore: sd + 0.35, spiral: -(gA.spiral || 0) };
      const BA = bevelInfo(gA), BB = bevelInfo(gB), sg = gA.flip ? -1 : 1;
      const O = V.add(sh.P, V.sc(a, gA.s + sg * BA.H));
      newShaft = { axis: st.dir, P: O, gears: [], from: k };
      gB.s = BB.H; gB.dir = AXES[st.dir]; gB.apex = O;
    }
    const j = shafts.push(newShaft) - 1;
    gB.shaft = j; const B = gears.push(gB) - 1; newShaft.gears.push(B); newShaft.made = B;
    meshes.push({ a: A, b: B, stage: k, type: st.type, internal: !!gB.internal });
  });
  // 역할과 축 구멍
  const hasOut = new Set(D.stages.map(s => +s.from));
  shafts.forEach((s, i) => { s.role = i === 0 ? 'input' : hasOut.has(i) ? 'mid' : 'output'; s.fixed = s.role !== 'mid'; s.d = sd; });
  // 같은 축 위 기어끼리 겹침
  shafts.forEach((s, i) => {
    const iv = s.gears.map(k => [span(gears[k]), k]).sort((p, q) => p[0][0] - q[0][0]);
    for (let n = 1; n < iv.length; n++) if (iv[n][0][0] < iv[n - 1][0][1] - 1e-6) errs.push(`S${i} 축에서 ${'G' + (iv[n - 1][1] + 1)}와 ${'G' + (iv[n][1] + 1)}가 겹칩니다. 층 방향이나 간격을 바꾸세요.`);
  });
  gears.forEach((g, k) => {
    g.name = 'G' + (k + 1);
    const s = shafts[g.shaft], bo = s.fixed ? { d: sd + 0.1, dcut: 0.5 } : { d: sd + 0.35, dcut: 0 };
    g.boreD = bo.d; g.dcut = bo.dcut;
    if (g.type === 'bevel') { g.bore = bo.d; }
    g.span = span(g);
  });
  // 운동학
  const w = shafts.map(() => null), phase = gears.map(() => null), sgn = g => g.flip ? -1 : 1;
  w[0] = D.rpm * 2 * PI / 60;
  const gearXf0 = k => { const g = gears[k], s = shafts[g.shaft]; return xfChain(XF.T(...s.P), axisBasis(s.axis), XF.T(0, 0, g.s), g.flip ? XF.Rx(PI) : XF.I()); };
  const localAngle = (k, C) => { const p = XF.apply(XF.inv(gearXf0(k)), C); return Math.atan2(p[1], p[0]); };
  for (const ms of meshes) {
    const A = gears[ms.a], B = gears[ms.b], sa = shafts[A.shaft], sb = shafts[B.shaft];
    if (w[A.shaft] == null) continue;
    const wlA = w[A.shaft] * sgn(A), wlB = (ms.internal ? 1 : -1) * wlA * A.z / B.z;
    w[B.shaft] = wlB * sgn(B);
    if (phase[ms.a] == null) phase[ms.a] = 0;
    let C;
    const cA = V.add(sa.P, V.sc(AXES[sa.axis], A.s));
    if (ms.internal) C = V.sub(cA, V.sc(B.dir, tvx(A).m * A.z / 2));
    else if (ms.type === 'spur') C = V.add(cA, V.sc(B.dir, B.cd * A.z / (A.z + B.z)));
    else C = V.add(cA, V.sc(B.dir, A.m * A.z / 2));
    const ca = localAngle(ms.a, C), cb = localAngle(ms.b, C);
    phase[ms.b] = ms.internal ? cb + (A.z / B.z) * (phase[ms.a] - ca) : cb + PI / B.z - (A.z / B.z) * (phase[ms.a] - ca);
    ms.C = C;
  }
  gears.forEach((g, k) => { if (phase[k] == null) phase[k] = 0; });
  return { shafts, gears, meshes, errs, w: w.map(v => v ?? 0), phase, gearXf0 };
}

// 기어 하나의 지역 삼각형 (기어 지역 좌표)
const ringOuterR = g => gearOutlineInfo(g).ra + Math.max(3, 2 * g.m);
function gearLocalTris(g) {
  if (g.type === 'bevel') return bevelTris({ ...g, bore: g.boreD, dcut: g.dcut });
  if (g.internal) {   // 링 기어: 이 부분 + 한쪽 받침판(축 구멍)
    const ro = ringOuterR(g), gp = g.gap ?? 1, th = gearTwist(g), lower = g.web !== '+';
    const body = gearExtrude({ ...g, b: g.b + gp, _outline: circlePts(ro, 128), _twist: th ? (lower ? z => th(z - gp) : th) : null, herring: false }, [gearOutline(g).pts]);
    const bore = borePts(g.boreD, g.dcut), web = extrudeTris(circlePts(ro, 128), bore ? [bore] : [], g.rw + 0.2);
    return lower ? xfTris(body, XF.T(0, 0, -gp)).concat(xfTris(web, XF.T(0, 0, -gp - g.rw))) : body.concat(xfTris(web, XF.T(0, 0, g.b + gp - 0.2)));
  }
  const bore = borePts(g.boreD, g.dcut);
  return gearExtrude(g, bore ? [bore] : []);
}
function gearTipR(g) { return g.type === 'bevel' ? bevelInfo(g).ra : g.internal ? ringOuterR(g) : gearOutlineInfo(g).ra; }
function gearHubR(g) { return g.type === 'bevel' ? bevelInfo({ ...g, bore: g.boreD }).rh : gearOutlineInfo(g).rf - 0.4; }

// 판(slab): frame(3×4) 기준 지역 xy 평면의 외곽+원형 구멍을 지역 z로 두께 t만큼 압출
function slabTris(sl) { return xfTris(extrudeTris(sl.outline, sl.holes.map(h => circlePts(h.d / 2, 32, h.x, h.y)), sl.t), sl.frame); }
const rectPts = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
function aabbOf(tris) { const b = trisBounds(tris); return b; }
const aabbHit = (A, B, sh = 0) => A.lo.every((v, i) => v + sh < B.hi[i] && B.lo[i] + sh < A.hi[i]);
// 축 방향 원기둥의 AABB
function cylAabb(P, ax, s0, s1, r) {
  const a = AXES[ax], p0 = V.add(P, V.sc(a, s0)), p1 = V.add(P, V.sc(a, s1)), lo = [], hi = [];
  for (let i = 0; i < 3; i++) { const e = Math.abs(a[i]) > 0.5 ? 0 : r; lo.push(Math.min(p0[i], p1[i]) - e); hi.push(Math.max(p0[i], p1[i]) + e); }
  return { lo, hi };
}

// 충돌 검사용 모양: 기어(베벨은 원뿔), 축 핀, 판(AABB). 겹치는 AABB 안에 점을 뿌려 둘 다에 들어가는 점을 찾음
function gearShape(g, s) {
  const a = AXES[s.axis], ra = gearTipR(g);
  if (g.internal) { const rin = gearOutlineInfo(g).rf - 0.3, w0 = g.rodSpan[0], w1 = g.rodSpan[1];
    return { P: s.P, a, s0: g.span[0], s1: g.span[1], r: () => ra, rin: x => (x >= w0 && x <= w1) ? 0 : rin, box: cylAabb(s.P, s.axis, g.span[0], g.span[1], ra) }; }
  if (g.type !== 'bevel') return { P: s.P, a, s0: g.span[0], s1: g.span[1], r: () => ra, box: cylAabb(s.P, s.axis, g.span[0], g.span[1], ra) };
  const B = bevelInfo({ ...g, bore: g.boreD }), sg = g.flip ? -1 : 1;
  return { P: s.P, a, s0: g.span[0], s1: g.span[1], box: cylAabb(s.P, s.axis, g.span[0], g.span[1], ra),
    r: x => { const d = (x - g.s) * sg; return d <= B.zt ? ra * (B.H - d) / B.H : B.rh; } };
}
const rodShape = (s, r0, r1) => ({ P: s.P, a: AXES[s.axis], s0: r0, s1: r1, r: () => s.d / 2, box: cylAabb(s.P, s.axis, r0, r1, s.d / 2) });
const boxShape = b => ({ box: b, inside: p => p.every((v, i) => v >= b.lo[i] && v <= b.hi[i]) });
function inShape(S, p) {
  if (S.inside) return S.inside(p);
  const d = V.sub(p, S.P), x = V.dot(d, S.a);
  if (x < S.s0 || x > S.s1) return false;
  const rr = Math.hypot(...V.sub(d, V.sc(S.a, x)));
  return rr <= S.r(x) && !(S.rin && rr < S.rin(x));
}
function shapesHit(A, B, n = 1500) {
  const lo = A.box.lo.map((v, i) => Math.max(v, B.box.lo[i])), hi = A.box.hi.map((v, i) => Math.min(v, B.box.hi[i]));
  if (lo.some((v, i) => v >= hi[i])) return false;
  let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < n; k++) { const p = lo.map((v, i) => v + (hi[i] - v) * rnd()); if (inShape(A, p) && inShape(B, p)) return true; }
  return false;
}

/* ---- 목표 기능 (기어박스 자동 설계와 같은 뜻) ----
 goal = { func: 'none'|'reduce'|'increase'|'reverse'|'transfer', ratio(n:1), dir: 'any'|'same'|'opposite', tol(%) }
 출력은 마지막 단이 만든 축. 방향은 각 축의 방향 벡터 기준 회전 부호로 비교 */
const GOAL_KO = { reduce: '감속', increase: '가속', reverse: '방향 반전', transfer: '동력 전달' };
function goalTarget(goal) {
  const n = Math.max(1, +goal.ratio || 1);
  return { R: goal.func === 'reduce' ? n : goal.func === 'increase' ? 1 / n : 1, dir: goal.func === 'reverse' ? 'opposite' : goal.dir || 'any', tol: Math.max(0.1, +goal.tol || 3) / 100 };
}
function goalEval(S, goal) {
  const o = S.shafts.length - 1, r = Math.abs(S.w[0] / (S.w[o] || 1e-12)), T = goalTarget(goal), err = Math.abs(r - T.R) / T.R, same = Math.sign(S.w[o]) === Math.sign(S.w[0]);
  return { o, r, err, T, same, okR: err <= T.tol + 1e-9, okD: T.dir === 'any' || (T.dir === 'same') === same };
}
// 출력 축에서 입력 축까지 거슬러 올라간 단 번호 (단 k가 축 S(k+1)를 만듦)
function trainPath(D, o) { const path = []; let sh = o; while (sh > 0 && path.length <= D.stages.length) { path.unshift(sh - 1); sh = +D.stages[sh - 1].from; } return path; }
// 공간(기어박스 탭의 모양) 안에 넣기: 먼저 그대로 풀어 부피를 재고, 벽까지 여유가 가장 큰 자리로 옮겨 다시 풂
function hull2(P) {
  P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (P.length < 3) return P;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function wallClear(box, x, y) {   // 벽 안쪽 면까지 거리 (+ 안, − 밖)
  const s = shapeOf(box), w = box.wall;
  if (s === 'cyl') return box.W / 2 - Math.hypot(x - box.W / 2, y - box.H / 2) - w;
  if (s === 'poly') { const O = shapeGeo(box).O, d = segDist(x, y, O); return (pointInPoly(x, y, O) ? d : -d) - w; }
  return Math.min(x, box.W - x, y, box.H - y) - w;
}
function trainPlace(D) {
  const box = D.enclose.box, M0 = trainModel({ ...D, _placed: true, _probe: true }), baseT = 3;
  const pts = []; let zlo = Infinity, zhi = -Infinity, zFrame = Infinity, zGear = Infinity;
  const addItem = (tris, X, frame) => {
    const P = [];
    for (const t of tris) for (let j = 0; j < 9; j += 3) { const p = X ? XF.apply(X, [t[j], t[j + 1], t[j + 2]]) : [t[j], t[j + 1], t[j + 2]]; P.push([p[0], p[1]]); zlo = Math.min(zlo, p[2]); zhi = Math.max(zhi, p[2]);
      if (frame) zFrame = Math.min(zFrame, p[2]); else zGear = Math.min(zGear, p[2]); }
    const H = hull2(P);
    H.forEach((a, i) => { const b = H[(i + 1) % H.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2)); for (let k = 0; k < n; k++) pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); });
  };
  M0.parts.forEach(p => addItem(p.tris, p.motion(0)));
  M0.housing.filter(h => h.assembly !== false && h.file !== 'base_plate').forEach(h => addItem(h.tris, null, true));
  M0.rods.filter(r => r.role === 'mid').forEach(r => [r.a, r.b].forEach(q => { pts.push([q[0], q[1]]); zlo = Math.min(zlo, q[2]); zhi = Math.max(zhi, q[2]); }));
  // 바닥판이 있으면 그 밑면을 하우징 바닥 위에, 없으면 지지대 다리를 바닥 위에 (지지대가 없으면 기어를 0.8 mm 띄움)
  const zb0 = M0._zb, dz = D.supports && D.supports.base === false ? box.wall - Math.min(zFrame, zGear - 0.8) : box.wall + baseT - zb0;
  const minCl = (dx, dy) => { let m = Infinity; for (const p of pts) { const c = wallClear(box, p[0] + dx, p[1] + dy); if (c < m) m = c; } return m; };
  let best = { dx: 0, dy: 0, c: -Infinity };
  const s0 = M0.solved.shafts[0], fix = D.enclose.fixIn;
  if (fix && Math.abs(AXES[s0.axis][2]) > 0.5) best = { dx: fix[0] - s0.P[0], dy: fix[1] - s0.P[1] }, best.c = minCl(best.dx, best.dy);
  else {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const O = shapeGeo(box).O, ox = O.map(p => p[0]), oy = O.map(p => p[1]);
    const ax0 = Math.min(...ox) + box.wall - x0, ax1 = Math.max(...ox) - box.wall - x1, ay0 = Math.min(...oy) + box.wall - y0, ay1 = Math.max(...oy) - box.wall - y1;
    const rng = (a, b) => b >= a ? Array.from({ length: 17 }, (_, i) => a + (b - a) * i / 16) : [(a + b) / 2];
    for (const dx of rng(ax0, ax1)) for (const dy of rng(ay0, ay1)) { const c = minCl(dx, dy); if (c > best.c) best = { dx, dy, c }; }
    for (let st = 1.5, it = 0; it < 12; it++, st *= 0.6) for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = minCl(best.dx + ex * st, best.dy + ey * st); if (c > best.c) best = { dx: best.dx + ex * st, dy: best.dy + ey * st, c }; }
  }
  const o = D.input.origin;
  const fit = { clear: best.c, top: zhi + dz, room: box.D - box.wall - (zhi + dz) };
  return trainModel({ ...D, _placed: true, _encFit: fit, input: { ...D.input, origin: [o[0] + best.dx, o[1] + best.dy, o[2] + dz] } });
}
function trainModel(D) {
  if (D.enclose && D.enclose.on && D.enclose.box && !D._placed) return trainPlace(D);
  // housed: 공간 안에 넣는 모드. 세로 축은 기어박스처럼 하우징 바닥·덮개 구멍이 받치므로 축 끝 지지대를 만들지 않음
  const housed = !!(D.enclose && D.enclose.on && D.enclose.box), encBox = housed && D._placed && !D._probe ? D.enclose.box : null, encHoles = [], encSide = [];
  const S = trainSolve(D), { shafts, gears, meshes, w, phase } = S;
  const model = { kind: 'train', parts: [], housing: [], rods: [], notes: [], checks: [] };
  const sd = D.shaftD, sg = 1.5, ts = 4, clear = D.clear ?? 1.5, wB = sd + 10;
  const sup = D.supports || { base: true, ends: true, skip: [], walls: [] };
  // 부품(축마다 한 덩어리)
  shafts.forEach((s, i) => {
    if (!s.gears.length) return;
    let tris = [];
    const ord = s.gears.slice().sort((p, q) => gears[p].span[0] - gears[q].span[0]);
    for (const k of ord) {
      const g = gears[k];
      tris = tris.concat(xfTris(gearLocalTris(g), xfChain(XF.T(0, 0, g.s), g.flip ? XF.Rx(PI) : XF.I(), XF.Rz(phase[k]))));
    }
    const bore = borePts(ord.length ? gears[ord[0]].boreD : sd, ord.length ? gears[ord[0]].dcut : 0);
    for (let n = 1; n < ord.length; n++) {
      const g0 = gears[ord[n - 1]], g1 = gears[ord[n]], z0 = g0.span[1], z1 = g1.span[0];
      if (z1 - z0 > 1e-6) { const r = Math.min(gearHubR(g0), gearHubR(g1)); tris = tris.concat(xfTris(extrudeTris(circlePts(r, 64), bore ? [bore] : [], z1 - z0), XF.T(0, 0, z0))); }
    }
    const base = xfChain(XF.T(...s.P), axisBasis(s.axis));
    s.part = model.parts.push({ name: 'S' + i, file: `S${i}_${s.gears.map(k => gears[k].name + (gears[k].type === 'bevel' ? 'b' : 'z') + gears[k].z).join('+')}_${s.role}`,
      tris, motion: t => XF.mul(base, XF.Rz(w[i] * t)), shaft: i }) - 1;
  });
  // 축 범위와 지지
  shafts.forEach(s => { const iv = s.gears.map(k => gears[k].rodSpan || gears[k].span); s.lo = Math.min(...iv.map(v => v[0])); s.hi = Math.max(...iv.map(v => v[1])); });
  const gearBox = gears.map(g => { const s = shafts[g.shaft]; return cylAabb(s.P, s.axis, g.span[0], g.span[1], gearTipR(g)); });
  const all = { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] };
  gearBox.forEach(b => { for (let i = 0; i < 3; i++) { all.lo[i] = Math.min(all.lo[i], b.lo[i]); all.hi[i] = Math.max(all.hi[i], b.hi[i]); } });
  const zb = all.lo[2] - (clear + ts);          // 바닥판 윗면
  const baseT = 3;
  const isVert = s => Math.abs(AXES[s.axis][2]) > 0.5;
  const holeD = s => s.d + (s.fixed ? 0.4 : 0.05);
  // 사용자 지지벽: 축과 평행한 법선이면 구멍, 축을 벽까지 연장
  const walls = (sup.walls || []).map((wl, n) => ({ ...wl, n }));
  const wallNormal = { x: '+x', y: '+y', z: '+z' };
  shafts.forEach(s => {
    s.rlo = s.lo - sg - ts; s.rhi = s.hi + sg + ts; s.wallLo = false; s.wallHi = false;
    for (const wl of walls) {
      const n = AXES[wallNormal[wl.normal]], a = AXES[s.axis], d = V.dot(n, a);
      if (Math.abs(d) < 0.5) continue;
      const sw = (wl.pos - V.dot(n, s.P)) / d;     // 벽 평면이 축과 만나는 s
      if (sw <= s.lo) { s.rlo = Math.min(s.rlo, sw - ts / 2); s.wallLo = true; }
      else if (sw >= s.hi) { s.rhi = Math.max(s.rhi, sw + ts / 2); s.wallHi = true; }
      else wl.cuts = true;
    }
  });
  const supParts = [];
  const skip = new Set(sup.skip || []);
  // 링 기어: 링 축의 열린 쪽, 피니언 축의 받침판 쪽 끝은 링 안이라 지지대를 둘 수 없음
  meshes.filter(ms => ms.internal).forEach(ms => { const B = gears[ms.b], A = gears[ms.a], lower = B.web !== '+';
    skip.add(`${B.shaft}:${lower ? 'hi' : 'lo'}`); (shafts[B.shaft].blocked ??= {})[lower ? 'hi' : 'lo'] = true;
    const sa = shafts[A.shaft]; if (lower ? Math.abs(A.span[0] - sa.lo) < 1e-6 : Math.abs(A.span[1] - sa.hi) < 1e-6) { skip.add(`${A.shaft}:${lower ? 'lo' : 'hi'}`); (sa.blocked ??= {})[lower ? 'lo' : 'hi'] = true; } });
  if (gears.some(g => g.spiral)) model.notes.push(SPIRAL_NOTE);
  if (meshes.some(ms => ms.internal)) model.notes.push('링(내접) 기어 단: 링 안쪽 축 끝에는 지지대를 둘 수 없어, 링 축과 피니언 축은 한쪽 끝만 받칩니다. 피니언 축의 바깥쪽 끝은 꼭 받쳐 주세요.');
  const gShapes = gears.map(g => gearShape(g, shafts[g.shaft]));
  const free = slabs => !slabs.some(sl => (sl.check || [sl.outline]).some(o => { const bs = boxShape(aabbOf(slabTris({ ...sl, outline: o, holes: [] }))); return gShapes.some(gs => shapesHit(bs, gs, 800)); }));
  const unplaced = [];
  // 축 끝 지지대 후보를 만들어 기어와 부딪히지 않는 첫 번째를 고름 (축을 조금씩 늘려 가며)
  const makeSup = (s, end, e, mode) => {
    const a = AXES[s.axis], slabs = [];
    const s0 = end === 'lo' ? s.lo - sg - e - ts : s.hi + sg + e;
    const Q0 = V.add(s.P, V.sc(a, s0)), Qc = V.add(s.P, V.sc(a, s0 + ts / 2));
    const R = Math.max(...s.gears.map(k => gearTipR(gears[k])));
    if (!isVert(s)) {
      const y = [0, 0, 1], x = V.cross(y, a), dz = zb - Q0[2], h = wB / 2;
      let out, check;
      if (mode === 0) out = rectPts(-h, dz, h, h);
      else { if (mode > 8) return null; const L = (R + clear + h) * [1, 1.6, 2.4, 3.2][Math.floor((mode - 1) / 2)], sgn = mode % 2 ? 1 : -1;
        out = [[-h, -h], [L - h, -h], [L - h, dz], [L + h, dz], [L + h, h], [-h, h]].map(([u, v]) => [u * sgn, v]);
        if (sgn < 0) out.reverse();
        check = [rectPts(-h, -h, L + h, h), rectPts(L - h, dz, L + h, h)].map(r => r.map(([u, v]) => [u * sgn, v])); }
      slabs.push({ frame: XF.basis(x, y, a, Q0), outline: out, holes: [{ x: 0, y: 0, d: holeD(s) }], t: ts, check });
      return slabs;
    }
    const zLow = Math.min(Q0[2], Q0[2] + a[2] * ts), bottom = (end === 'lo') === (a[2] > 0);
    if (bottom) {
      if (mode > 0) return null;
      const hgt = zLow + ts - zb;
      if (hgt > 0.5) slabs.push({ frame: XF.T(Qc[0], Qc[1], zb), outline: circlePts(sd / 2 + 4, 48), holes: [{ x: 0, y: 0, d: holeD(s) }], t: hgt });
      return slabs;
    }
    if (mode > 15) return null;
    const e2 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]][mode % 4], L = (R + clear + wB / 2 + 1) * [1, 1.6, 2.4, 3.2][Math.floor(mode / 4)];
    const ey = V.cross([0, 0, 1], e2), P = V.add(Qc, V.sc(e2, L));
    slabs.push({ frame: XF.basis(e2, ey, [0, 0, 1], [Qc[0], Qc[1], zLow]), outline: rectPts(-wB / 2, -wB / 2, L + wB / 2, wB / 2), holes: [{ x: 0, y: 0, d: holeD(s) }], t: ts });
    if (zLow - zb > 0.5) slabs.push({ frame: XF.T(P[0], P[1], zb), outline: rectPts(-wB / 2, -wB / 2, wB / 2, wB / 2), holes: [], t: zLow - zb });
    return slabs;
  };
  shafts.forEach((s, i) => {
    s.supE = {};
    if (housed && s.gears.length && isVert(s)) { s.housed = true; return; }
    if (!s.gears.length || sup.ends === false) return;
    for (const end of ['lo', 'hi']) {
      if (skip.has(`${i}:${end}`) || (end === 'lo' ? s.wallLo : s.wallHi)) continue;
      let got = null;
      search: for (const e of [0, 6, 12, 20]) for (let mode = 0; mode < 16; mode++) {
        const sl = makeSup(s, end, e, mode);
        if (sl && sl.length && free(sl)) { got = { sl, e }; break search; }
      }
      if (got) { s.supE[end] = got.e; supParts.push({ name: `지지대 S${i}${end === 'lo' ? '-앞' : '-뒤'}`, file: `support_S${i}_${end}`, slabs: got.sl, shaft: i }); }
      else unplaced.push(`S${i}${end === 'lo' ? '-앞' : '-뒤'}`);
    }
  });
  shafts.forEach((s, i) => {
    const has = e => s.supE[e] != null || (e === 'lo' ? s.wallLo : s.wallHi);
    if (s.supE.lo != null) s.rlo = Math.min(s.rlo, s.lo - sg - s.supE.lo - ts); else if (!s.wallLo) s.rlo = s.lo;
    if (s.supE.hi != null) s.rhi = Math.max(s.rhi, s.hi + sg + s.supE.hi + ts); else if (!s.wallHi) s.rhi = s.hi;
    s.nSup = s.housed ? 2 : (has('lo') ? 1 : 0) + (has('hi') ? 1 : 0);
  });
  // 축 핀(지지축)
  shafts.forEach((s, i) => {
    if (!s.gears.length) return;
    const ext = s.role === 'mid' ? 0 : 12;
    const bk = s.blocked || {};
    let r0 = s.rlo, r1 = s.rhi;
    if (ext) { if (!bk.hi) r1 += ext; else if (!bk.lo) r0 -= ext; }
    if (isVert(s)) { const a = AXES[s.axis]; if (a[2] > 0 && !bk.lo) r0 = Math.min(r0, (zb - baseT + 0.5) - s.P[2]); else if (a[2] < 0 && !bk.hi) r1 = Math.max(r1, s.P[2] - (zb - baseT + 0.5)); }
    if (encBox && s.housed) {   // 바닥 아래부터 덮개 위까지 (기어박스 축 핀과 같음)
      const a = AXES[s.axis], t0 = (0 - s.P[2]) / a[2], t1 = (encBox.D - s.P[2]) / a[2];
      r0 = Math.min(t0, t1); r1 = Math.max(t0, t1);
      encHoles.push({ face: 'floor', u: s.P[0], v: s.P[1], d: holeD(s) }, { face: 'lid', u: s.P[0], v: s.P[1], d: holeD(s) });
    }
    if (encBox && s.role !== 'mid') {   // 입력·출력 축은 하우징 밖으로 8 mm 나오게, 지나가는 면에 구멍
      const a = AXES[s.axis], hi = s.role === 'input' && Math.abs(a[2]) > 0.5 && !bk.lo ? a[2] < 0 : !bk.hi, sg2 = hi ? 1 : -1, dir = V.sc(a, sg2), B = encBox;
      let t = null, hole = null;
      if (Math.abs(a[2]) > 0.5) { const up = dir[2] > 0; t = ((up ? B.D + 8 : -8) - s.P[2]) / a[2]; hole = { face: up ? 'lid' : 'floor', u: s.P[0], v: s.P[1] }; }
      else if (shapeOf(B) === 'rect') { const k = Math.abs(a[0]) > 0.5 ? 0 : 1, pos = dir[k] > 0; t = ((pos ? (k ? B.H : B.W) + 8 : -8) - s.P[k]) / a[k]; hole = { face: (pos ? '+' : '-') + (k ? 'y' : 'x'), u: k ? s.P[0] : s.P[1], v: s.P[2] }; }
      else { let tt = hi ? r1 : r0; for (let n = 0; n < 2000; n++) { const q = V.add(s.P, V.sc(a, tt)); if (!fitsIn(B, q[0], q[1], -B.wall)) break; tt += sg2 * 0.5; } t = tt + sg2 * 8; encSide.push(i); }
      if (hi) r1 = Math.max(r1, t); else r0 = Math.min(r0, t);
      if (hole && !s.housed) encHoles.push({ ...hole, d: holeD(s) });
    }
    s.r0 = r0; s.r1 = r1;
    model.rods.push({ a: V.add(s.P, V.sc(AXES[s.axis], r0)), b: V.add(s.P, V.sc(AXES[s.axis], r1)), d: s.d, role: s.role });
  });
  // 전체 범위 (판 크기용)
  const ext = { lo: all.lo.slice(), hi: all.hi.slice() };
  const grow = b => { for (let i = 0; i < 3; i++) { ext.lo[i] = Math.min(ext.lo[i], b.lo[i]); ext.hi[i] = Math.max(ext.hi[i], b.hi[i]); } };
  supParts.forEach(p => p.slabs.forEach(sl => grow(aabbOf(slabTris(sl)))));
  shafts.forEach(s => s.gears.length && grow(cylAabb(s.P, s.axis, s.r0, s.r1, s.d / 2)));
  const M = 6;
  // 지지벽
  const wallParts = walls.map(wl => {
    const n = wallNormal[wl.normal], slabs = [];
    const holesFor = (e1, e2) => shafts.filter(s => s.gears.length && Math.abs(V.dot(AXES[s.axis], AXES[n])) > 0.5).map(s => ({ x: V.dot(s.P, e1), y: V.dot(s.P, e2), d: holeD(s) }));
    if (wl.normal === 'z') {
      const e1 = [1, 0, 0], e2 = [0, 1, 0];
      slabs.push({ frame: XF.T(0, 0, wl.pos - ts / 2), outline: rectPts(ext.lo[0] - M, ext.lo[1] - M, ext.hi[0] + M, ext.hi[1] + M), holes: holesFor(e1, e2), t: ts });
      for (const [x, y] of [[ext.lo[0] - M, ext.lo[1] - M], [ext.hi[0] + M - 8, ext.lo[1] - M], [ext.lo[0] - M, ext.hi[1] + M - 8], [ext.hi[0] + M - 8, ext.hi[1] + M - 8]])
        slabs.push({ frame: XF.T(x, y, zb), outline: rectPts(0, 0, 8, 8), holes: [], t: wl.pos - ts / 2 - zb });
    } else {
      const e1 = wl.normal === 'x' ? [0, 1, 0] : [0, 0, 1], e2 = wl.normal === 'x' ? [0, 0, 1] : [1, 0, 0], nn = AXES[n];
      const i1 = e1.indexOf(1), i2 = e2.indexOf(1);
      const lo1 = i1 === 2 ? zb : ext.lo[i1] - M, hi1 = ext.hi[i1] + M, lo2 = i2 === 2 ? zb : ext.lo[i2] - M, hi2 = ext.hi[i2] + M;
      const org = V.sc(nn, wl.pos - ts / 2);
      slabs.push({ frame: XF.basis(e1, e2, nn, org), outline: rectPts(lo1, lo2, hi1, hi2), holes: holesFor(e1, e2), t: ts });
    }
    slabs.forEach(sl => grow(aabbOf(slabTris(sl))));
    return { name: `지지벽 ${wl.normal.toUpperCase()}=${wl.pos}`, file: `wall_${wl.normal}${wl.pos}`, slabs, wall: wl };
  });
  // 바닥판
  const frameParts = supParts.concat(wallParts);
  if (sup.base !== false) {
    const holes = shafts.filter(s => s.gears.length && isVert(s)).map(s => ({ x: s.P[0], y: s.P[1], d: holeD(s) }));
    frameParts.unshift({ name: '바닥판', file: 'base_plate', slabs: [{ frame: XF.T(0, 0, zb - baseT), outline: encBox ? offsetPoly(ccw(boxInner(encBox)), 0.4) : rectPts(ext.lo[0] - M, ext.lo[1] - M, ext.hi[0] + M, ext.hi[1] + M), holes, t: baseT }] });
  }
  frameParts.forEach(p => { p.tris = [].concat(...p.slabs.map(slabTris)); model.housing.push({ name: p.name, file: p.file, tris: p.tris, slabs: p.slabs, print: p.slabs.length === 1 ? XF.inv(p.slabs[0].frame) : undefined }); });
  shafts.forEach((s, i) => s.gears.length && model.housing.push({ name: `축 핀 S${i}`, file: `pin_S${i}_d${s.d}_L${fmt(s.r1 - s.r0, 1)}`, tris: extrudeTris(circlePts(s.d / 2 - 0.05, 32), [], s.r1 - s.r0), assembly: false }));
  model.frame = true;
  model._zb = zb;
  if (encBox) {
    const h = boxHousing(encBox, encHoles), zl = encBox.D - encBox.wall;
    model.housing.push({ name: '하우징 본체', file: 'housing_body', tris: h.body, ghost: true }, { name: '덮개', file: 'housing_lid', tris: xfTris(h.lid, XF.T(0, 0, zl)), print: XF.T(0, 0, -zl), ghost: true });
    model.encHoles = encHoles;
  }

  /* ---- 검사 ---- */
  const checks = model.checks;
  S.errs.forEach(e => checks.push({ st: 'bad', txt: e }));
  if (encBox && D._encFit) {
    const f = D._encFit, okXY = f.clear >= 0.5, okZ = f.room >= 0.5;
    checks.push(okXY && okZ ? { st: 'ok', txt: `${shapeTxt(encBox)} 안에 들어갑니다 · 벽까지 최소 <em>${fmt(f.clear, 1)} mm</em> · 덮개까지 <em>${fmt(f.room, 1)} mm</em>` }
      : { st: 'bad', txt: `${shapeTxt(encBox)}에 다 들어가지 않습니다:${okXY ? '' : ` 옆으로 <em>${fmt(0.5 - f.clear, 1)} mm</em> 부족`}${okZ ? '' : ` 높이 <em>${fmt(0.5 - f.room, 1)} mm</em> 부족`}. 기어박스 탭에서 공간을 키우거나 잇수·층을 줄이세요.` });
    if (encSide.length) checks.push({ st: 'warn', txt: `S${encSide.join(', S')} 축은 옆으로 나가는데 ${shapeOf(encBox) === 'cyl' ? '원통' : '직접 그린'} 벽에는 구멍을 자동으로 뚫지 않습니다. 사각 상자를 쓰거나 슬라이서에서 구멍을 내세요.` });
  }
  if (D.goal && D.goal.func && D.goal.func !== 'none' && !S.errs.length && shafts.length > 1) {
    const E = goalEval(S, D.goal), ok = E.okR && E.okD;
    checks.push({ st: ok ? 'ok' : 'bad', txt: `목표 기능 ${GOAL_KO[D.goal.func]}${D.goal.func === 'reduce' || D.goal.func === 'increase' ? ' ' + fmt(+D.goal.ratio || 1, 2) + (D.goal.func === 'increase' ? '배' : ' : 1') : ''} (출력 S${E.o}): 현재 <em>${ratioTxt(E.r)}</em> · 오차 <em>${fmt(E.err * 100, 2)}%</em>${E.okR ? '' : ' ✗'} · ${E.same ? '입력과 같은 방향' : '입력과 반대 방향'}${E.okD ? '' : ' ✗'}${ok ? '' : ' → "목표에 맞게 자동 맞춤"을 누르세요'}` });
  }
  {  // 작동: 입력 토크 → 출력 토크 (맞물림마다 효율: 평·내접 98%, 베벨 95%)
    const Tin = +D.torque || 0;
    if (Tin > 0 && !S.errs.length) shafts.forEach((s, i) => { if (s.role !== 'output') return;
      const path = trainPath(D, i); let eta = 1; path.forEach(k => eta *= D.stages[k].type === 'bevel' ? 0.95 : 0.98);
      const r = Math.abs(w[0] / (w[i] || 1e-12));
      checks.push({ st: 'ok', txt: `작동: 입력 <em>${fmt(Tin, 1)} N·cm</em> → 출력 S${i} 약 <em>${fmt(Tin * r * eta, 1)} N·cm</em> (효율 ${fmt(eta * 100, 0)}%)` }); });
  }
  const meshPair = new Set(meshes.flatMap(ms => [ms.a + ',' + ms.b, ms.b + ',' + ms.a]));
  const wIn = w[0];
  shafts.forEach((s, i) => { if (s.role === 'output') {
    const r = Math.abs(wIn / (w[i] || 1e-12));
    checks.push({ st: 'ok', txt: `출력 S${i} (${AXIS_KO[s.axis]} 축): 변속비 <em>${ratioTxt(r)}</em> · <em>${fmt(rpmOf(w[i]), 2)} rpm</em> · 축 방향 기준 ${Math.sign(w[i]) === Math.sign(wIn) ? '정회전' : '역회전'}` }); } });
  for (const ms of meshes) {
    const A = gears[ms.a], B = gears[ms.b];
    let eps;
    if (ms.internal) eps = internalEps(tvx(A), tvx(B), B.cd);
    else if (ms.type === 'spur') eps = meshGeom(A, B).eps;
    else { const BA = bevelInfo(A), BB = bevelInfo(B); eps = meshGeom(BA.v, BB.v).eps; }
    checks.push({ st: eps >= 1.2 ? 'ok' : eps >= 1.05 ? 'warn' : 'bad', txt: `${ms.stage + 1}단 ${A.name}–${B.name} (${ms.internal ? '내접' : ms.type === 'spur' ? (A.helix ? (A.herring ? '헤링본' : '헬리컬') : '평') : '베벨'} ${A.z}:${B.z}) 물림률 <em>${eps.toFixed(2)}</em>${ms.type === 'spur' ? overlapTxt(A) : spiralTxt(A)}` });
  }
  gears.forEach(g => {
    const rf = g.type === 'bevel' ? (() => { const B = bevelInfo(g); return B.k * B.rf; })() : gearOutlineInfo(g).rf;
    if (rf - g.boreD / 2 < 1.2) checks.push({ st: 'bad', txt: `${g.name}: 축 구멍(${fmt(g.boreD, 2)} mm)이 이뿌리에 너무 가깝습니다. 잇수나 모듈을 키우세요.` });
    const zv = g.type === 'bevel' ? g.z / Math.cos(g.delta) : g.z, lim = 2 / Math.sin(g.pa * D2R) ** 2 * (1 - (g.x || 0));
    if (zv < lim - 0.5) checks.push({ st: 'warn', txt: `${g.name}: ${g.type === 'bevel' ? '등가 ' : ''}잇수 ${fmt(zv, 1)}가 언더컷 한계(${lim.toFixed(1)})보다 작습니다.` });
  });
  // 충돌 (서로 맞물리지 않는 다른 축의 기어, 다른 축의 핀, 지지벽·바닥판)
  const coll = [];
  for (let p = 0; p < gears.length; p++) for (let q = p + 1; q < gears.length; q++) {
    if (gears[p].shaft === gears[q].shaft || meshPair.has(p + ',' + q)) continue;
    if (shapesHit(gShapes[p], gShapes[q])) coll.push(`${gears[p].name}와 ${gears[q].name}`);
  }
  gears.forEach((g, p) => shafts.forEach((t, j) => {
    if (j === g.shaft || !t.gears.length) return;
    if (shapesHit(gShapes[p], rodShape(t, t.r0, t.r1))) coll.push(`${g.name}와 S${j} 축`);
  }));
  frameParts.filter(fp => !fp.file.startsWith('support')).forEach(fp => fp.slabs.forEach(sl => { const bs = boxShape(aabbOf(slabTris(sl)));
    gears.forEach((g, p) => { if (shapesHit(bs, gShapes[p])) coll.push(`${g.name}와 ${fp.name}`); }); }));
  const uniq = [...new Set(coll)];
  checks.push(uniq.length ? { st: 'bad', txt: `부딪히는 곳 <em>${uniq.length}</em>: ${uniq.slice(0, 6).join(', ')}${uniq.length > 6 ? ' …' : ''}. 각도·층 간격·축 방향을 바꿔 보세요.` } : { st: 'ok', txt: '기어·축·지지 구조 사이에 겹치는 곳이 없습니다' });
  if (unplaced.length) checks.push({ st: 'warn', txt: `기어를 피할 자리가 없어 만들지 못한 축 끝 지지대: ${unplaced.join(', ')}` });
  shafts.forEach((s, i) => { if (!s.gears.length) return;
    if (s.nSup === 0) checks.push({ st: 'bad', txt: `S${i} 축을 받치는 곳이 없습니다. 지지벽을 추가하세요.` });
    else if (s.nSup === 1) checks.push({ st: 'warn', txt: `S${i} 축은 한쪽만 받쳐집니다 (외팔 지지).` }); });
  walls.filter(wl => wl.cuts).forEach(wl => checks.push({ st: 'bad', txt: `지지벽 ${wl.normal.toUpperCase()}=${wl.pos} 이 기어 사이를 지나갑니다. 위치를 기어 묶음 바깥으로 옮기세요.` }));

  /* ---- 간섭 (맞물림 부근 점 뿌리기) ---- */
  model.interference = (steps = 18) => {
    const res = [];
    const insideGear = (g, info, p) => {
      if (g.type === 'spur') {
        if (p[2] < 0 || p[2] > g.b) return false;
        const th = gearTwist(g), q = th ? rot2([p[0], p[1]], -th(p[2])) : p;
        if (g.internal) return Math.hypot(q[0], q[1]) <= info.ro && !pointInPoly(q[0], q[1], info.pts);
        return pointInPoly(q[0], q[1], info.pts);
      }
      const b = info.B; if (p[2] < 0 || p[2] > b.zt) return false; const s = b.H / (b.H - p[2]), tw = bevelTwist(g), q = tw ? rot2([p[0], p[1]], -tw(Math.hypot(p[0], p[1]), p[2])) : p; return pointInPoly(q[0] * s, q[1] * s, info.pts);
    };
    const info = g => g.type === 'spur' ? { pts: gearOutline(g, 8).pts, ro: g.internal ? ringOuterR(g) : 0 } : { B: bevelInfo(g), pts: bevelHeel(g) };
    for (const ms of meshes) {
      const A = gears[ms.a], B = gears[ms.b], IA = info(A), IB = info(B);
      const sA = shafts[A.shaft], sB = shafts[B.shaft], a = AXES[sA.axis];
      const T = (2 * PI / A.z) / Math.max(1e-9, Math.abs(w[A.shaft]));
      const gx = (k, t) => xfChain(model.parts[shafts[gears[k].shaft].part].motion(t), XF.T(0, 0, gears[k].s), gears[k].flip ? XF.Rx(PI) : XF.I(), XF.Rz(phase[k]));
      let hits = 0, seed = 11;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const tang = V.cross(a, B.dir);
      for (let k = 0; k < steps; k++) {
        const t = T * k / steps, iA = XF.inv(gx(ms.a, t)), iB = XF.inv(gx(ms.b, t));
        let hit = false;
        for (let n = 0; n < 3000 && !hit; n++) {
          let pnt;
          if (ms.type === 'spur') pnt = V.add(V.add(ms.C, V.sc(B.dir, (rnd() - 0.5) * 3 * A.m)), V.add(V.sc(tang, (rnd() - 0.5) * 3 * A.m), V.sc(a, rnd() * A.b)));
          else { const u = rnd() * 0.4, base = V.add(ms.C, V.sc(V.sub(B.apex, ms.C), u)); pnt = V.add(base, V.add(V.sc(B.dir, (rnd() - 0.5) * 3 * A.m), V.add(V.sc(tang, (rnd() - 0.5) * 3 * A.m), V.sc(a, (rnd() - 0.5) * 3 * A.m)))); }
          if (insideGear(A, IA, XF.apply(iA, pnt)) && insideGear(B, IB, XF.apply(iB, pnt))) hit = true;
        }
        if (hit) hits++;
      }
      res.push({ pair: `${A.name}–${B.name}`, hits, steps });
    }
    return res;
  };

  /* ---- 표·HUD ---- */
  model.table = {
    head: ['기어', '종류', '축', 'z', 'm', 'α', '피치원 d', '이끝원', '폭', '층 위치 s', '구멍', 'rpm'],
    rows: gears.map(g => { const s = shafts[g.shaft]; return { part: s.part, cells: [g.name, g.type === 'bevel' ? `베벨 δ${fmt(g.delta / D2R, 1)}°` : g.internal ? '내접(링)' + (g.helix ? ' ' + gearKindKo(g) : '') : gearKindKo(g), `S${g.shaft} ${AXIS_KO[s.axis]}`, g.z, g.m, g.pa + '°', fmt(gearOutlineInfo(g).r * 2, 2), fmt(2 * gearTipR(g), 2), fmt(g.type === 'bevel' ? g.F : g.b, 2), `${fmt(g.span[0], 1)}~${fmt(g.span[1], 1)}`, fmt(g.boreD, 2) + (g.dcut ? ' D' : ''), fmt(rpmOf(w[g.shaft]), 1)] }; })
  };
  model.hud = [['입력 S0', fmt(D.rpm, 1) + ' rpm' + (D.reverse ? ' (거꾸로)' : '')]];
  shafts.forEach((s, i) => s.role === 'output' && model.hud.push([`출력 S${i}`, fmt(rpmOf(w[i]), 2) + ' rpm']));
  model.hud.push(['단 수', D.stages.length], ['기어', gears.length + '개']);
  model.notes.push('지지대·지지벽·바닥판은 서로 맞닿게 만들어져 있습니다. 따로 출력해 접착하거나, 슬라이서에서 한 물체로 합쳐 출력하세요.',
    '입력축과 출력축 기어는 D컷 구멍이라 축과 함께 돌고, 지지대 구멍은 +0.4 mm로 헐겁게 잡혀 있습니다. 중간 축은 지지대에 고정되고 기어가 축 위에서 돕니다.');
  model.scad = () => trainScad(D, S, model, frameParts);
  model.solved = S;
  return model;
}

function trainScad(D, S, model, frameParts) {
  const { shafts, gears, phase } = S;
  const mat = A => `[[${A[0]},${A[1]},${A[2]},${A[3]}],[${A[4]},${A[5]},${A[6]},${A[7]}],[${A[8]},${A[9]},${A[10]},${A[11]}],[0,0,0,1]]`.replace(/(\d\.\d{4})\d+/g, '$1');
  const L = ['// 기어 설계실 자유 조립에서 생성한 OpenSCAD 소스 (OpenSCAD 2021.01 이상)',
    '// 축 위치는 잇수에 맞춰 계산된 값입니다. 잇수·모듈을 바꾸려면 앱의 자유 조립에서 고친 뒤 다시 내보내는 것을 권장합니다.',
    '// mode: "assembly" | "part" (part_index) | "frame" (지지 구조 전체)' + (D._placed && D.enclose && D.enclose.box ? ' | "housing_body" | "housing_lid"' : ''), 'mode = "assembly";', 'part_index = 0;', 'res = 10;', '', SCAD_LIB, ''];
  shafts.forEach((s, i) => {
    if (!s.gears.length) return;
    L.push(`module shaft${i}() {   // ${s.role}, 축 ${AXIS_KO[s.axis]}`);
    const ord = s.gears.slice().sort((p, q) => gears[p].span[0] - gears[q].span[0]);
    for (const k of ord) {
      const g = gears[k], X = xfChain(XF.T(0, 0, g.s), g.flip ? XF.Rx(PI) : XF.I(), XF.Rz(phase[k]));
      if (g.internal) L.push(`  multmatrix(${mat(X)}) ring_gear2(${g.m}, ${g.z}, ${g.pa}, ${g.backlash}, ${g.b}, ${fmt(ringOuterR(g), 3)}, ${g.helix || 0}, ${g.web === '+' ? 0 : 1}, ${g.gap ?? 1}, ${g.rw}, ${g.boreD}, ${g.dcut});   // ${g.name} 링`);
      else if (g.type === 'spur') L.push(`  multmatrix(${mat(X)}) spur_gear(${g.m}, ${g.z}, ${g.pa}, ${g.x}, ${g.b}, ${g.backlash}, ${g.boreD}, ${g.dcut}, ${g.helix || 0}, ${g.herring ? 1 : 0});   // ${g.name}`);
      else L.push(`  multmatrix(${mat(X)}) bevel_gear(${g.m}, ${g.z}, ${g.pa}, ${g.backlash}, ${fmt(g.delta / D2R, 6)}, ${g.F}, ${g.boreD}, ${g.dcut}, ${fmt(bevelInfo(g).hub, 3)}, ${g.spiral || 0});   // ${g.name}`);
    }
    for (let n = 1; n < ord.length; n++) {
      const g0 = gears[ord[n - 1]], g1 = gears[ord[n]], z0 = g0.span[1], z1 = g1.span[0];
      if (z1 - z0 > 1e-6) L.push(`  translate([0, 0, ${fmt(z0, 4)}]) linear_extrude(${fmt(z1 - z0, 4)}) difference() { circle(r = ${fmt(Math.min(gearHubR(g0), gearHubR(g1)), 3)}, $fn = 64); bore2d(${g0.boreD}, ${g0.dcut}); }`);
    }
    L.push('}');
  });
  L.push('module frame() {');
  frameParts.forEach(fp => fp.slabs.forEach(sl => L.push(`  multmatrix(${mat(sl.frame)}) linear_extrude(${fmt(sl.t, 4)}) difference() { polygon([${sl.outline.map(p => `[${fmt(p[0], 3)},${fmt(p[1], 3)}]`).join(',')}]); ${sl.holes.map(h => `translate([${fmt(h.x, 3)},${fmt(h.y, 3)}]) circle(d = ${fmt(h.d, 3)}, $fn = 32);`).join(' ')} }   // ${fp.name}`)));
  L.push('}');
  const hb = model.encHoles && D.enclose && D.enclose.box;
  if (hb) {
    const B = D.enclose.box, cyl = (h, rot) => `${rot}cylinder(d = ${fmt(h.d, 3)}, h = BOX[3] + 2, $fn = 32);`;
    const sideH = model.encHoles.filter(h => h.face !== 'floor' && h.face !== 'lid').map(h => {
      const P = { '+x': `translate([BOX[0] - BOX[3] - 1, ${fmt(h.u, 3)}, ${fmt(h.v, 3)}]) rotate([0, 90, 0]) `, '-x': `translate([-1, ${fmt(h.u, 3)}, ${fmt(h.v, 3)}]) rotate([0, 90, 0]) `,
        '+y': `translate([${fmt(h.u, 3)}, BOX[1] - BOX[3] - 1, ${fmt(h.v, 3)}]) rotate([-90, 0, 0]) `, '-y': `translate([${fmt(h.u, 3)}, -1, ${fmt(h.v, 3)}]) rotate([-90, 0, 0]) ` }[h.face];
      return '    ' + cyl(h, P); });
    const fl = f => model.encHoles.filter(h => h.face === f).map(h => '    ' + cyl(h, `translate([${fmt(h.u, 3)}, ${fmt(h.v, 3)}, -1]) `));
    L.push(`// 하우징 (${shapeTxt(B)}): 기어박스 탭의 공간 모양`, `BOX = [${B.W}, ${B.H}, ${B.D}, ${B.wall}];`, scadShell(B),
      `module housing_body() {\n  difference() {\n    housing_shell();\n${fl('floor').concat(sideH).join('\n')}\n  }\n}`,
      `module housing_lid() {\n  difference() {\n    housing_plate();\n${fl('lid').join('\n')}\n  }\n}`);
  }
  const used = shafts.map((s, i) => i).filter(i => shafts[i].gears.length);
  L.push(`PLACE = [${used.map(i => mat(xfChain(XF.T(...shafts[i].P), axisBasis(shafts[i].axis)))).join(',\n  ')}];`);
  L.push(`if (mode == "assembly") {\n${used.map((i, n) => `  multmatrix(PLACE[${n}]) shaft${i}();`).join('\n')}\n  %frame();${hb ? '\n  %housing_body();\n  %translate([0, 0, BOX[2] - BOX[3]]) housing_lid();' : ''}\n} else if (mode == "frame") frame();${hb ? '\nelse if (mode == "housing_body") housing_body();\nelse if (mode == "housing_lid") housing_lid();' : ''}\nelse {\n${used.map((i, n) => `  if (part_index == ${n}) shaft${i}();`).join('\n')}\n}`);
  return L.join('\n');
}

/* 목표 기능에 맞게 자유 조립을 고침: 구조(단·축 방향·층)는 그대로 두고
 1) 방향이 틀리면 베벨 단의 맞물림 쪽을 바꾸거나 아이들러 단을 덧붙이고
 2) 변속비가 틀리면 출력까지 가는 단들의 잇수를 조금씩 바꿔 맞춤 (바뀐 잇수가 적고 부딪힘 없는 것) */
function trainFitGoal(D0) {
  const goal = D0.goal;
  if (!goal || !goal.func || goal.func === 'none') return { msg: '목표 기능을 먼저 고르세요.' };
  const bare = D => ({ ...JSON.parse(JSON.stringify(D)), enclose: null });
  const solve = D => { try { const S = trainSolve(D); return S.errs.length ? null : S; } catch { return null; } };
  const clean = D => { try { return trainModel(bare(D)).checks.every(c => c.st !== 'bad'); } catch { return false; } };
  let D = JSON.parse(JSON.stringify(D0)), S = solve(D);
  if (!S || S.shafts.length < 2) return { msg: '먼저 단을 하나 이상, 오류 없이 만들어 주세요.' };
  const E0 = goalEval(S, goal), deadline = Date.now() + 7000;
  if (E0.okR && E0.okD) return { D, msg: '이미 목표 기능에 맞습니다.' };
  // 변속비 맞추기 (구조 T에서): 성공하면 { T, txt }
  const fitRatio = T0 => {
    const S0 = solve(T0); if (!S0) return null;
    const E = goalEval(S0, goal);
    if (E.okR) return clean(T0) ? { T: T0, txt: '' } : null;
    const path = trainPath(T0, E.o), vars = path.slice();
    if (!vars.length) return null;
    const F = Math.pow(E.T.R / E.r, 1 / vars.length), MULS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.12, 1.25, 1.4, 1.6, 1.85];
    const cand = vars.map(k => {
      const st = T0.stages[k], zA0 = +st.zA, zB0 = +st.zB, f = zB0 / zA0 * F, zmin = st.type === 'bevel' ? 12 : 11, out = [];
      for (let dA = st.idler ? 0 : -5; dA <= (st.idler ? 0 : 8); dA++) { const zA = zA0 + dA; if (zA < zmin && !st.idler) continue;
        MULS.forEach((mul, bi) => { for (let dB = -1; dB <= 1; dB++) {
          const zB = Math.round(zA * f * mul) + dB; if (zB < zmin || zB > 150 || (st.internal && zB < zA + 12)) continue;
          out.push({ zA, zB, bi, cost: Math.abs(dA) + Math.abs(zB - zB0), dev: Math.abs(Math.log(zB / zA / f)) }); } }); }
      out.sort((a, b) => a.cost - b.cost);
      // 변속비 구간마다 바뀐 잇수가 적은 것부터 고루 뽑음 (한 단의 비가 다른 단으로 넘어가도 되게)
      const seen = new Set(), uniq = out.filter(c => { const key = c.zA + '/' + c.zB; if (seen.has(key)) return false; seen.add(key); return true; });
      const per = vars.length <= 2 ? 6 : vars.length === 3 ? 3 : 2, pick = [];
      MULS.forEach((_, bi) => pick.push(...uniq.filter(c => c.bi === bi).slice(0, per)));
      return pick;
    });
    // 경로 위 변속비: 보통 단은 zB/zA, 아이들러는 zB/(앞 축 피동 기어 잇수)
    const ratioOf = asg => { let R = 1; const zPrev = {}; for (const k of path) { const st = T0.stages[k], a = asg[k] || { zA: +st.zA, zB: +st.zB };
      const zA = st.idler ? zPrev[+st.from] : a.zA; R *= a.zB / zA; zPrev[k + 1] = a.zB; } return R; };
    const res = [], asg = {};
    // 남은 단으로 낼 수 있는 변속비 범위로 가지치기 (아이들러 없는 경로에서만 정확)
    const plain = !path.some(k => T0.stages[k].idler), fr = cand.map(cs => cs.map(c => c.zB / c.zA));
    const lo = [], hi = []; for (let j = vars.length; j >= 0; j--) { lo[j] = j === vars.length ? 1 : lo[j + 1] * Math.min(...fr[j]); hi[j] = j === vars.length ? 1 : hi[j + 1] * Math.max(...fr[j]); }
    let prod = 1;
    const rec = j => {
      if (res.length > 40000) return;
      if (plain && j < vars.length && (prod * hi[j] < E.T.R * (1 - E.T.tol) || prod * lo[j] > E.T.R * (1 + E.T.tol))) return;
      if (j === vars.length) { const r = ratioOf(asg), err = Math.abs(r - E.T.R) / E.T.R; if (err <= E.T.tol) res.push({ a: JSON.parse(JSON.stringify(asg)), err, cost: vars.reduce((s2, k) => s2 + asg[k].cost, 0) }); return; }
      for (const c of cand[j]) { asg[vars[j]] = c; const p0 = prod; prod *= c.zB / c.zA; rec(j + 1); prod = p0; }
      delete asg[vars[j]];
    };
    rec(0);
    res.sort((a, b) => a.cost + 40 * a.err - (b.cost + 40 * b.err));
    const t0 = Date.now(), tried = new Map();
    for (const r of res) {
      if (Date.now() - t0 > 900 || Date.now() > deadline) break;
      // 같은 단 조합이 계속 부딪히면 그 조합은 3번까지만 시도 (다양한 후보를 보도록)
      const key = vars.slice(0, -1).map(k => r.a[k].zA + '/' + r.a[k].zB).join(' ');
      if ((tried.get(key) || 0) >= 3) continue; tried.set(key, (tried.get(key) || 0) + 1);
      const T = JSON.parse(JSON.stringify(T0));
      for (const k of vars) { T.stages[k].zA = r.a[k].zA; T.stages[k].zB = r.a[k].zB; delete T.stages[k].xA; delete T.stages[k].xB; }
      const S2 = solve(T); if (!S2) continue;
      const E2 = goalEval(S2, goal); if (!E2.okR || !E2.okD) continue;
      if (clean(T)) return { T, txt: '잇수를 바꿨습니다: ' + vars.filter(k => r.a[k].zA !== +T0.stages[k].zA || r.a[k].zB !== +T0.stages[k].zB).map(k => T0.stages[k].idler ? `${k + 1}단 아이들러 ${T0.stages[k].zB} → ${r.a[k].zB}` : `${k + 1}단 ${T0.stages[k].zA}/${T0.stages[k].zB} → ${r.a[k].zA}/${r.a[k].zB}`).join(', ') };
    }
    return null;
  };
  // 방향 후보: 그대로 / 베벨 단 맞물림 쪽 바꾸기 / 아이들러 단 덧붙이기
  const tries = [];
  if (E0.okD) tries.push({ T: D, why: '' });
  else {
    trainPath(D, E0.o).filter(k => D.stages[k].type === 'bevel').reverse().forEach(k => { const T = JSON.parse(JSON.stringify(D)); T.stages[k].apex = T.stages[k].apex === '-' ? '+' : '-'; tries.push({ T, why: `${k + 1}단 베벨의 맞물림 쪽을 바꿨습니다` }); });
    const last = D.stages[D.stages.length - 1];
    if (last.type === 'spur' && !last.internal) for (const da of [90, -90, 60, -60, 120, -120, 150, -150, 180]) {
      const T = JSON.parse(JSON.stringify(D));
      T.stages.push({ type: 'spur', from: S.shafts.length - 1, zA: last.zB, zB: last.zB, m: last.m, b: last.b, angle: ((+last.angle || 0) + da + 360) % 360, stack: '+', offset: 0, idler: true, helix: last.helix ? -last.helix : 0, herring: !!last.herring });
      tries.push({ T, why: `아이들러 단(${D.stages.length + 1}단)을 덧붙여 방향을 바꿨습니다` });
    }
  }
  const notes = [];
  let ok = null;
  for (const t of tries) { if (Date.now() > deadline) break; const S2 = solve(t.T); if (!S2 || !goalEval(S2, goal).okD) continue; const f = fitRatio(t.T); if (f) { ok = f; if (t.why) notes.push(t.why); break; } }
  if (!ok) return { msg: E0.okD ? '이 구조로는 목표 변속비를 부딪힘 없이 맞출 수 없습니다. 단을 더하거나 허용오차를 넓히거나 각도·층을 바꿔 보세요.'
    : '방향과 변속비를 함께 맞출 방법을 찾지 못했습니다. 평기어 단을 하나 더하거나 베벨 단의 맞물림 쪽을 직접 바꿔 보세요.' };
  D = ok.T; if (ok.txt) notes.push(ok.txt);
  if (!notes.length) return { D, msg: '이미 목표 기능에 맞습니다.' };
  return { D, msg: notes.join(' · ') };
}

/* 자동 설계 결과 → 자유 조립 */
function toTrain(D, base) {
  const T = { version: 3, kind: 'train', rpm: D.rpm, pa: 20, backlash: 0.15, shaftD: 4, gap: 1, clear: 1.5, input: { axis: '+z', origin: [0, 0, 0] }, stages: [],
    supports: { base: true, ends: true, skip: [], walls: [] }, ...base };
  if (D.kind === 'bevel') {
    T.pa = D.pa; T.backlash = D.backlash; T.shaftD = D.shaftD || 4;
    const d1 = Math.atan2(D.z1, D.z2), r1 = D.m * D.z1 / 2, r2 = D.m * D.z2 / 2, H1 = r1 / Math.tan(d1), H2 = r2 / Math.tan(PI / 2 - d1);
    if ((D.input || 1) === 1) { T.input = { axis: '+z', origin: [D.O[0], D.O[1], D.O[2] - H1] }; T.stages.push({ type: 'bevel', from: 0, zA: D.z1, zB: D.z2, m: D.m, b: D.F, dir: '+x', apex: '+', stack: '+', offset: 0, sd: 0, hub: D.hub, spiral: D.spiral || 0 }); }
    else { T.input = { axis: '+x', origin: [D.O[0] + H2, D.O[1], D.O[2]] }; T.stages.push({ type: 'bevel', from: 0, zA: D.z2, zB: D.z1, m: D.m, b: D.F, dir: '-z', apex: '-', stack: '+', offset: 0, sd: 0, hub: D.hub, spiral: -(D.spiral || 0) }); }
    return T;
  }
  if (D.kind === 'planetary') return null;
  // 평기어열: 맞물림 순서대로 단을 만듦
  const g0 = D.gears[0]; T.pa = g0.pa; T.backlash = g0.backlash; T.shaftD = D.shafts[0].d || 4;
  const s0 = D.shafts[D.input];
  T.input = { axis: '+z', origin: [s0.x, s0.y, 0] };
  const tIdx = { [D.input]: 0 }, driven = new Set();
  const pending = D.meshes.slice();
  let guard = 0;
  while (pending.length && guard++ < 100) {
    const n = pending.findIndex(([i, j]) => tIdx[D.gears[i].shaft] != null || tIdx[D.gears[j].shaft] != null);
    if (n < 0) break;
    let [i, j] = pending.splice(n, 1)[0];
    if (tIdx[D.gears[i].shaft] == null) [i, j] = [j, i];
    const A = D.gears[i], B = D.gears[j], sa = D.shafts[A.shaft], sb = D.shafts[B.shaft];
    T.stages.push({ type: 'spur', from: tIdx[A.shaft], zA: A.z, zB: B.z, m: A.m, b: A.b, xA: A.x, xB: B.x, angle: +(Math.atan2(sb.y - sa.y, sb.x - sa.x) / D2R).toFixed(3), stack: '+', offset: 0, idler: driven.has(i), sd: driven.has(i) ? null : A.zpos, helix: A.helix || 0, herring: !!A.herring });
    driven.add(j);
    tIdx[B.shaft] = T.stages.length;
  }
  return T;
}

function defaultTrain() {
  return { version: 3, kind: 'train', rpm: 60, pa: 20, backlash: 0.15, shaftD: 4, gap: 1, clear: 1.5, input: { axis: '+z', origin: [0, 0, 0] },
    stages: [
      { type: 'spur', from: 0, zA: 13, zB: 30, m: 1.25, b: 8, angle: 0, stack: '+', offset: 0 },
      { type: 'bevel', from: 1, zA: 16, zB: 24, m: 1.25, b: 0, dir: '+x', apex: '+', stack: '+', offset: 3, hub: 4 },
      { type: 'spur', from: 2, zA: 14, zB: 28, m: 1.25, b: 7, angle: 90, stack: '+', offset: 0 },
    ], supports: { base: true, ends: true, skip: [], walls: [] } };
}

if (typeof module !== 'undefined') module.exports = { trainFitGoal, goalEval, trainPlace, polyProblem, shapeGeo, fitsIn, boxInner, boxOuter, boxOfP, cycloidPair, cycloidSolve, cycloidModel, camModel, camMotion, camDefault, CAM_PRESETS, rackPair, wormPair, wormSolve, inWorm, wormGeom, gearTwist, gearExtrude, trainSolve, trainModel, toTrain, defaultTrain, bevelInfo, bevelHeel, pointInPoly, gearOutline, gearOutlineInfo, meshGeom, autoDesign, pairDesign, kinematics, analyze, interference, partsOf, partTris, extrudeTris, stlBinary, makeZip, scadSource, autoShift, stageCombos, buildModel, bevelAuto, planetaryAuto, bevelPair, planetaryPair, xfTris, trisBounds, XF };
</script>