/* ================= 새 동작 기구 6종 =================
 편심추 진동(vib) · 간헐 기어(intgear) · 윈치·도르래(winch) · 그리퍼(gripper) · 유니버설 조인트(ujoint) · 벨트 컨베이어(conveyor)
 LK_X[type] = { def, ko, mono, pose(D, θ) → 자세, y(ps) → 그래프 값, build(D, model, K, M) → 바닥 피할 자리 } */
const PLA_RHO = 1.24e-3;   // g/mm³
function vibGeo(D) {
  const V = D.vib, t = D.t, R = V.R, nN = Math.max(0, Math.round(V.n)), mDisk = PLA_RHO * PI * R * R / 2 * t, eDisk = 4 * R / (3 * PI);
  const rn = R * 0.62, mNut = 1.15, nuts = Array.from({ length: nN }, (_, i) => PI * (i + 1) / (nN + 1));   // M4 너트 하나 ≈ 1.15 g
  const m = mDisk + nN * mNut, me = mDisk * eDisk + nuts.reduce((a, f) => a + mNut * rn * Math.sin(f), 0);   // g·mm (+y 쪽 반원)
  const w = D.rpm * 2 * PI / 60, F = me * 1e-6 * w * w;   // N
  return { R, rn, nuts, m, me, e: me / m, F, w };
}
function intGeo(D) {
  const I = D.intgear, m = I.m, z1 = Math.max(8, Math.round(I.z1)), z2 = Math.max(8, Math.round(I.z2)), k = Math.max(1, Math.min(z1 - 2, Math.round(I.k)));
  const g1 = { m, z: z1, pa: 20, x: 0, b: D.t, backlash: 0.15 }, g2 = { ...g1, z: z2 }, cd = m * (z1 + z2) / 2, step = 2 * PI / z1, Th = k * step;
  return { m, z1, z2, k, g1, g2, cd, step, Th };
}
function intPhi(G, th) {   // 종동 기어 각도. 이가 중심선에 오기 반 피치 앞(−δ)부터 물리기 시작
  const d = G.step * (G.lead ?? 0.5), x = th + d, n = Math.floor(x / (2 * PI)), u = x - n * 2 * PI;
  return -(G.z1 / G.z2) * (n * G.Th + Math.min(u, G.Th) - d);
}
function gripGeo(D) {
  const G = D.gripper, m = G.m, z = Math.max(8, Math.round(G.z)), s = m * z / 2, P1 = [G.a, s], P2 = [G.a, -s];
  const pick = th => { const A = [G.b * Math.cos(th), G.b * Math.sin(th)], c1 = circX(A, G.c, P1, G.d, 1), c2 = circX(A, G.c, P1, G.d, -1); return { A, c1, c2 }; };
  const p0 = pick(0), sg = p0.c1 && p0.c2 ? (p0.c1[0] < p0.c2[0] ? 1 : -1) : 1;
  return { ...G, m, z, s, P1, P2, sg, w: D.w };
}
function gripPose(Gg, th) {
  const A = [Gg.b * Math.cos(th), Gg.b * Math.sin(th)], B = circX(A, Gg.c, Gg.P1, Gg.d, Gg.sg); if (!B) return null;
  return { A, B, psi: Math.atan2(B[1] - Gg.P1[1], B[0] - Gg.P1[0]) };
}
function convPath(R, L) {   // 시계 반대로 도는 둥근 고리: 아래 직선(→), 오른쪽 반원, 위 직선(←), 왼쪽 반원
  const P = 2 * L + 2 * PI * R;
  return s => { s = ((s % P) + P) % P;
    if (s < L) return [s, -R, 0];
    if (s < L + PI * R) { const a = -PI / 2 + (s - L) / R; return [L + R * Math.cos(a), R * Math.sin(a), a + PI / 2]; }
    if (s < 2 * L + PI * R) { const u = s - L - PI * R; return [L - u, R, PI]; }
    const a = PI / 2 + (s - 2 * L - PI * R) / R; return [R * Math.cos(a), R * Math.sin(a), a + PI / 2]; };
}
const LK_X = {
  vib: { def: { R: 18, n: 3 }, ko: '편심추 진동', mono: false,
    pose: (D, th) => { const V = vibGeo(D); return { psi: th, fy: V.F * Math.sin(th + PI / 2) }; }, y: ps => ps.fy,
    build(D, model, K, M) {
      const V = vibGeo(D), { t, z1, w } = K, checks = model.checks, half = [];
      for (let i = 0; i <= 32; i++) { const f = PI * i / 32; half.push([V.R * Math.cos(f), V.R * Math.sin(f)]); }
      const out = hull2([...half, ...circlePts(K.hubR0, 24)]), holes = V.nuts.map(f => { const c = [V.rn * Math.cos(f), V.rn * Math.sin(f)]; return Array.from({ length: 6 }, (_, j) => [c[0] + 4.1 * Math.cos(j * PI / 3), c[1] + 4.1 * Math.sin(j * PI / 3)]); });
      const tr = K.driver(out, holes);
      model.parts.push({ name: '편심추', file: `eccentric_R${V.R}`, tris: tr, motion: tt => XF.Rz(K.thOf(tt)), print: K.hub ? K.flip : undefined, clash: [{ h: out, z: [z1, z1 + t], cc: true }] });
      K.grow(0, 0, V.R + 4);
      const hz = K.rpm / 60;
      checks.unshift({ st: 'ok', txt: `편심추 무게 <em>${fmt(V.m, 1)} g</em> (PLA ${fmt(V.m - V.nuts.length * 1.15, 1)} g + M4 너트 ${V.nuts.length}개) · 편심 <em>${fmt(V.e, 1)} mm</em> · ${fmt(K.rpm, 0)} rpm에서 흔드는 힘 <em>${fmt(V.F, 3)} N</em> (${fmt(hz, 1)} Hz)` });
      checks.push({ st: V.F > 0.05 ? 'ok' : 'warn', txt: V.F > 0.05 ? '힘은 회전수의 제곱에 비례합니다. 회전수를 두 배로 하면 네 배가 됩니다.' : '이 회전수로는 진동이 거의 느껴지지 않습니다. 130·370 같은 빠른 DC 모터(수천 rpm)를 쓰거나 너트를 더 넣으세요.' });
      model.hud = [['회전', fmt(K.rpm, 0) + ' rpm (' + fmt(hz, 1) + ' Hz)'], ['편심 질량', fmt(V.me, 0) + ' g·mm'], ['흔드는 힘', fmt(V.F, 3) + ' N']];
      model.table = linkTbl([['편심추', `반지름 ${V.R} mm (반원)`, `두께 ${t}`, `${boreTxt(K)} · 너트 자리 ${V.nuts.length}개 (M4, 7 mm)`]]);
      model.asm = ['편심추의 육각 구멍에 M4 너트를 눌러 넣고 순간접착제로 고정합니다 (무게 추).', '장치를 바닥판째 진동시킬 곳(체·피더 판)에 단단히 붙입니다. 모터 고정 나사가 풀리지 않게 나사 고정제를 씁니다.'];
      model.bomExtra = [['M4 너트 (무게 추)', V.nuts.length, '편심추 육각 구멍']];
      model.notes.push('편심추가 돌 때마다 무게 중심이 원을 그리며 바닥판을 흔듭니다 (진동 모터·진동 피더·체 원리).');
      return [];
    } },
  intgear: { def: { m: 1.5, z1: 20, k: 5, z2: 20 }, ko: '간헐 기어', mono: true,
    pose: (D, th) => ({ psi: intPhi(intGeo(D), th) }), y: ps => ps.psi / D2R,
    build(D, model, K, M) {
      const G = intGeo(D), { t, z1, free, press, pd } = K, checks = model.checks;
      const o1 = gearOutline(G.g1), I1 = o1.info, rf = G.m * G.z1 / 2 - 1.25 * G.m, w0 = -(G.k - 1) * G.step - G.step / 2, w1 = G.step / 2;
      const rp = G.m * G.z1 / 2 + G.m * (G.trim ?? 0), edge = a => a < w0 + G.step || a > w1 - G.step;   // 처음·마지막 이는 끝을 깎아 멈춘 종동 기어에 걸리지 않게
      const drv = o1.pts.map(([x, y]) => { const a = Math.atan2(y, x), r = Math.hypot(x, y); if (a < w0 || a > w1) return [rf * Math.cos(a), rf * Math.sin(a)]; const rr = edge(a) ? Math.min(r, rp) : r; return [rr * Math.cos(a), rr * Math.sin(a)]; });
      const dr = K.driver(drv);
      model.parts.push({ name: '이 빠진 구동 기어', file: `intermittent_driver_m${G.m}_z${G.z1}_k${G.k}`, tris: dr, motion: tt => XF.Rz(K.thOf(tt)), print: K.hub ? K.flip : undefined, clash: [{ h: shrink2(drv, 0.2), z: [z1, z1 + t], cc: true }] });
      const o2 = gearOutline(G.g2).pts, ph0 = PI + PI / G.z2;
      let wt = moveTris(extrudeTris(o2, [circlePts(free / 2, 28)], t), 0, 0, z1).concat(K.pivot(0, 0, z1, '종동 기어 받침', 'intgear_post'));
      const post = model.housing.find(h => h.file === 'intgear_post'); if (post) post.tris = moveTris(post.tris, G.cd, 0, 0);
      model.parts.push({ name: '간헐 종동 기어', file: `intermittent_driven_m${G.m}_z${G.z2}`, tris: wt, motion: tt => XF.mul(XF.T(G.cd, 0, 0), XF.Rz(ph0 + intPhi(G, K.thOf(tt)))), clash: [{ h: shrink2(o2, 0.2), z: [z1, z1 + t], cc: true }] });
      model.plateHoles.push([G.cd, 0, press]);
      K.grow(0, 0, G.m * (G.z1 / 2 + 1) + 4); K.grow(G.cd, 0, G.m * (G.z2 / 2 + 1) + 4);
      K.pin('종동 기어 피벗 핀', 0, z1 + t, () => [G.cd, 0], ['간헐 종동 기어', '종동 기어 받침']);
      const step = 360 * G.k / G.z2, move = G.Th / (2 * PI);
      checks.unshift({ st: 'ok', txt: `입력 한 바퀴마다 <em>${fmt(step, 1)}°</em> 돌고 멈춤 (이 ${G.k}개 = 종동 ${G.k}/${G.z2}바퀴) · 도는 구간 <em>${fmt(move * 360, 0)}°</em> / 멈춤 <em>${fmt(360 - move * 360, 0)}°</em>` });
      checks.push({ st: 360 % step < 0.01 || Math.abs(360 % step - step) < 0.01 ? 'ok' : 'warn', txt: 360 % step < 0.01 || Math.abs(360 % step - step) < 0.01 ? `종동 기어가 ${fmt(360 / step, 0)}번 멈추면 한 바퀴를 돕니다.` : '종동 한 바퀴가 멈춤 횟수로 나누어떨어지지 않아 멈추는 자리가 매번 달라집니다.' });
      checks.push({ st: 'ok', txt: '처음과 마지막 이는 끝을 피치원까지 깎아, 멈춰 있는 종동 기어에 걸리지 않게 했습니다.' });
      checks.push({ st: 'warn', txt: '멈춰 있는 동안 종동 기어는 마찰로만 붙잡혀 있습니다. 부하가 있으면 래칫이나 잠금(제네바)을 함께 쓰세요.' });
      model.hud = [['구동', fmt(K.rpm, 1) + ' rpm'], ['한 번에', fmt(step, 1) + '°'], ['멈춤 비율', fmt(100 - move * 100, 0) + '%']];
      model.table = linkTbl([['이 빠진 구동 기어', `모듈 ${G.m} · ${G.z1}T 중 ${G.k}개만`, `두께 ${t}`, boreTxt(K)], ['간헐 종동 기어', `모듈 ${G.m} · ${G.z2}T`, `두께 ${t}`, `피벗 ${fmt(free, 2)}`], { part: -1, c: ['중심거리', `${fmt(G.cd, 2)} mm`, '바닥판', `피벗 ${pd}`] }]);
      model.asm = ['종동 기어 피벗 핀을 바닥판 구멍에 눌러 끼우고 종동 기어를 얹습니다.', '구동 기어를 끼울 때 남은 이가 종동 기어 반대쪽을 보게 두고 돌려 맞춥니다.'];
      model.notes.push('구동 기어의 이 일부만 남겨, 그 이가 지나가는 동안만 종동 기어가 돌고 나머지는 멈춥니다.');
      return [circlePts(pd / 2 + 4, 24, G.cd, 0)];
    } },
  winch: { def: { r: 8, H: 70, L: 40, travel: 40 }, ko: '윈치·도르래', mono: true,
    pose: (D, th) => ({ z: D.winch.r * th }), y: ps => ps.z,
    build(D, model, K, M) {
      const W = D.winch, { t, z1, bt, free, press, pd, w } = K, checks = model.checks, r = W.r, rp = 9, hd = 12, rope = 0.8;
      const zr = z1 + t + hd / 2, Pc = [W.L, r, W.H], zTop = W.H - rp - 6, zLow = bt + 4, travel = Math.max(5, Math.min(W.travel, zTop - zLow - 14));
      const thMax = travel / r;
      K.thOf = tt => { const x = K.wv * tt / thMax, f = x - 2 * Math.floor(x / 2); return thMax * (f <= 1 ? f : 2 - f); };
      K.period = 2 * thMax / Math.max(1e-9, K.wv);
      const fl = circlePts(r + 4, 48), drum = K.driver(fl).concat(moveTris(extrudeTris(circlePts(r, 48), [circlePts(1, 12, r - 2.5, 0)], hd + 0.02), 0, 0, z1), moveTris(extrudeTris(fl, [], 2), 0, 0, z1 + t + hd));
      model.parts.push({ name: '감는 드럼', file: `winch_drum_r${r}`, tris: drum, motion: tt => XF.Rz(K.thOf(tt)), print: K.hub ? K.flip : undefined, clash: [{ h: fl, z: [z1, z1 + t + hd + 2], cc: true }] });
      // 도르래: y 축 둘레로 도는 바퀴 (홈 있음), 기둥 옆에 핀으로 매닮
      const sheave = xfTris(extrudeTris(circlePts(rp + 2, 48), [circlePts(free / 2, 24)], 2).concat(moveTris(extrudeTris(circlePts(rp, 48), [circlePts(free / 2, 24)], 3), 0, 0, 2), moveTris(extrudeTris(circlePts(rp + 2, 48), [circlePts(free / 2, 24)], 2), 0, 0, 5)), XF.basis([1, 0, 0], [0, 0, 1], [0, -1, 0], [0, 3.5, 0]));
      model.parts.push({ name: '도르래', file: `pulley_sheave_r${rp}`, tris: sheave, print: XF.basis([1, 0, 0], [0, 0, -1], [0, 1, 0]),
        motion: tt => XF.mul(XF.T(...Pc), XF.mul([Math.cos(-r * K.thOf(tt) / rp), 0, Math.sin(-r * K.thOf(tt) / rp), 0, 0, 1, 0, 0, -Math.sin(-r * K.thOf(tt) / rp), 0, Math.cos(-r * K.thOf(tt) / rp), 0], XF.I())), clash: [] });
      const px = W.L - 2, py = r + 3.5 + 1 + 4, postH = W.H + 4 - bt;
      model.housing.push({ name: '도르래 기둥', file: `pulley_post_h${fmt(postH, 0)}`, tris: moveTris(extrudeTris(rectPts(px - 4, py - 4, px + 4, py + 4), [], postH), 0, 0, bt - 0.01)
        .concat(xfTris(extrudeTris(circlePts(4, 24), [circlePts(press / 2, 20)], 6), XF.basis([1, 0, 0], [0, 0, 1], [0, -1, 0], [W.L, py + 3, W.H]))), noClash: true });
      // 추: 도르래 바깥쪽으로 늘어진 줄 끝 (위아래), 줄은 짧은 토막을 겹쳐 길이가 변하는 것처럼 보이게 함
      const wx = W.L + rp, wy = r, zw0 = zLow, wH = 14, zwOf = tt => zw0 + r * K.thOf(tt);
      const wt = extrudeTris(rectPts(-6, -6, 6, 6), [], wH).concat(moveTris(extrudeTris(capsulePts([-3, 0], [3, 0], 1.6), [], 4), 0, 0, wH - 0.01));
      model.parts.push({ name: '추 (짐)', file: 'winch_load', tris: wt, motion: tt => XF.T(wx, wy, zwOf(tt)), clash: [{ h: rectPts(wx - 6, wy - 6, wx + 6, wy + 6), z: [zw0, zw0 + wH + travel + 4] }] });
      const seg = 6, top = W.H, nSeg = Math.ceil((top - (zw0 + wH)) / seg), rp0 = extrudeTris(circlePts(rope, 8), [], seg + 0.4);
      for (let i = 0; i < nSeg; i++) model.parts.push({ name: '줄', file: 'rope', tris: rp0, noExport: true, clash: [], motion: tt => XF.T(wx, wy, Math.max(zwOf(tt) + wH, top - (i + 1) * seg)) });
      model.extras.push({ line: [[0, r, zr], [W.L - 0.5, r, W.H + rp - 0.2]], color: '#8a6d3b' });
      K.grow(0, 0, r + 6); K.grow(wx, wy, 10); K.grow(px, py, 8);
      const F = +(D.drive || {}).F || 0, T = F * r;
      checks.unshift({ st: 'ok', txt: `드럼 반지름 <em>${r} mm</em> · 한 바퀴에 <em>${fmt(2 * PI * r, 1)} mm</em> 감김 · 들어 올리는 높이 <em>${fmt(travel, 0)} mm</em> (시뮬레이션은 끝에서 되돌아옴)` });
      checks.push({ st: 'ok', txt: `짐 ${fmt(F, 1)} N(약 ${fmt(F / 9.81 * 1000, 0)} g)을 들려면 드럼 축에 <em>${fmt(T / 10, 2)} N·cm</em>가 걸립니다. 놓으면 짐이 떨어지니 웜기어나 래칫으로 잠그세요.` });
      model.hud = [['드럼', fmt(K.rpm, 1) + ' rpm'], ['감기 속도', fmt(r * K.wv, 1) + ' mm/s'], ['높이', fmt(travel, 0) + ' mm']];
      model.table = linkTbl([['감는 드럼', `반지름 ${r} · 폭 ${hd}`, `턱 ${fmt(r + 4, 0)}`, `${boreTxt(K)} · 줄 구멍 2`], ['도르래', `반지름 ${rp} (홈)`, '두께 7', `핀 ${fmt(free, 2)}`], ['추 (짐)', '12×12×14', '고리', '줄 묶음'], { part: -1, c: ['도르래 높이', `${W.H} mm`, '기둥', `${fmt(postH, 0)} mm`] }]);
      model.asm = ['도르래 기둥을 바닥판에 붙이고, 도르래를 핀으로 기둥 옆 구멍에 끼웁니다.', '줄(낚싯줄·실 0.5~1 mm) 끝을 드럼 구멍에 묶고 도르래 홈 위로 넘겨 추 고리에 묶습니다.'];
      model.glue = '도르래 기둥을 바닥판에 붙임';
      model.bomExtra = [['줄 (낚싯줄·면사)', 1, `${fmt(W.L + W.H + travel + 40, 0)} mm 이상`]];
      model.notes.push('드럼이 줄을 감으면 도르래를 지나 추가 올라갑니다. 도르래는 힘의 방향만 바꿉니다 (고정 도르래).');
      return [rectPts(px - 5, py - 5, px + 5, py + 5)];
    } },
  gripper: { def: { b: 5, c: 36, d: 14, a: 34, m: 1.5, z: 12, Lf: 42 }, ko: '그리퍼', mono: false,
    pose: (D, th) => { const G = gripGeo(D), p = gripPose(G, th), p0 = gripPose(G, 0); if (!p || !p0) return null; return { ...p, dpsi: p.psi - p0.psi, gap: gripGap(G, p.psi - p0.psi) }; },
    y: ps => ps.gap,
    build(D, model, K, M) {
      const G = gripGeo(D), { t, z1, z2, w, free, press, pd } = K, checks = model.checks, P0 = gripPose(G, 0);
      if (!P0) { checks.push({ st: 'bad', txt: '이 치수로는 링크가 닿지 않습니다. 커플러 c나 레버 d를 바꿔 보세요.' }); return []; }
      const poseAt = tt => gripPose(G, K.thOf(tt)) || P0, dps = tt => poseAt(tt).psi - P0.psi;
      K.crank(G.b);
      model.parts.push({ name: '커플러', file: `gripper_coupler_c${G.c}`, tris: moveTris(linkBar(P0.A, P0.B, w, [[...P0.A, free], [...P0.B, free]], t), 0, 0, z2), motion: tt => rigidM(P0.A, P0.B, poseAt(tt).A, poseAt(tt).B) });
      const go = gearOutline({ m: G.m, z: G.z, pa: 20, x: 0, b: t, backlash: 0.15 }).pts, gB = go.map(([x, y]) => { const c = Math.cos(PI / G.z), s = Math.sin(PI / G.z); return [x * c - y * s, x * s + y * c]; });
      const ext = gripExt(G), bo = gripBeta(G, M), arm = (P, sg) => { const T = [P[0] + G.Lf * Math.cos(sg * bo), P[1] + G.Lf * Math.sin(sg * bo)], pad = [T[0], T[1] - sg * (w / 2 + 1.5)];
        return { T, poly: hull2([...circlePts(w / 2, 16, ...P), ...circlePts(w / 2, 16, ...T)]), pad: capsulePts([T[0] - 5, pad[1]], [T[0] + 3, pad[1]], 2.5) }; };
      const aA = arm(G.P1, 1), aB = arm(G.P2, -1), lever = capsulePts(G.P1, P0.B, w / 2);
      const fA = moveTris(extrudeTris(go.map(([x, y]) => [x + G.P1[0], y + G.P1[1]]), [circlePts(free / 2, 24, ...G.P1)], t), 0, 0, z1)
        .concat(moveTris(extrudeTris(aA.poly, [circlePts(free / 2, 24, ...G.P1)], t), 0, 0, z1), moveTris(extrudeTris(aA.pad, [], t), 0, 0, z1),
          moveTris(extrudeTris(lever, [circlePts(free / 2, 24, ...G.P1), circlePts(press / 2, 24, ...P0.B)], t), 0, 0, z1));
      const fB = moveTris(extrudeTris(gB.map(([x, y]) => [x + G.P2[0], y + G.P2[1]]), [circlePts(free / 2, 24, ...G.P2)], t), 0, 0, z1)
        .concat(moveTris(extrudeTris(aB.poly, [circlePts(free / 2, 24, ...G.P2)], t), 0, 0, z1), moveTris(extrudeTris(aB.pad, [], t), 0, 0, z1));
      const gl = go.map(([x, y]) => [x + G.P1[0], y + G.P1[1]]), gl2 = gB.map(([x, y]) => [x + G.P2[0], y + G.P2[1]]);
      model.parts.push({ name: '손가락 A (기어·레버)', file: `gripper_finger_A_z${G.z}`, tris: fA, motion: tt => rotAbout(...G.P1, dps(tt)),
        clash: [{ h: gl, z: [z1, z1 + t], cc: true }, { h: aA.poly, z: [z1, z1 + t] }, { h: hull2(aA.pad), z: [z1, z1 + t] }, { h: lever, z: [z1, z1 + t] }] });
      model.parts.push({ name: '손가락 B (기어)', file: `gripper_finger_B_z${G.z}`, tris: fB, motion: tt => rotAbout(...G.P2, -dps(tt)),
        clash: [{ h: gl2, z: [z1, z1 + t], cc: true }, { h: aB.poly, z: [z1, z1 + t] }, { h: hull2(aB.pad), z: [z1, z1 + t] }] });
      [G.P1, G.P2].forEach((P, i) => { model.plateHoles.push([...P, press]); K.pin(`손가락 ${'AB'[i]} 피벗 핀`, 0, z1 + t, () => P, [i ? '손가락 B (기어)' : '손가락 A (기어·레버)']); });
      K.pin('크랭크–커플러 핀', z1, z2 + t, tt => poseAt(tt).A, ['크랭크', '커플러']);
      K.pin('커플러–레버 핀', z1, z2 + t, tt => poseAt(tt).B, ['커플러', '손가락 A (기어·레버)']);
      K.grow(G.P1[0] + G.Lf + 8, G.s + 14); K.grow(G.P2[0], -G.s - 14); K.grow(...P0.B, w);
      const gmin = M.ok ? M.min : 0, gmax = M.ok ? M.max : 0;
      checks.unshift({ st: gmin >= 0 ? 'ok' : 'bad', txt: `집게 벌어짐 <em>${fmt(gmin, 1)} ~ ${fmt(gmax, 1)} mm</em> · 손가락 흔들림 <em>${fmt(ext.span / D2R, 1)}°</em> · 두 손가락은 같은 기어(${G.z}T)로 서로 반대로 움직입니다` });
      if (ext.span < 8 * D2R) checks.push({ st: 'warn', txt: '손가락이 너무 조금 움직입니다. 크랭크 b를 키우거나 레버 d를 줄이세요.' });
      model.hud = [['크랭크', fmt(K.rpm, 1) + ' rpm'], ['벌어짐', `${fmt(gmin, 0)}~${fmt(gmax, 0)} mm`], ['잡기·놓기', '한 바퀴에 한 번']];
      model.table = linkTbl([['크랭크 b', `${G.b} mm`, `${w}×${t}`, boreTxt(K)], ['커플러 c', `${G.c} mm`, `${w}×${t}`, `핀 ${fmt(free, 2)}`], ['손가락 A', `레버 ${G.d} · 손가락 ${G.Lf} mm`, `${G.z}T 모듈 ${G.m}`, `피벗 ${fmt(free, 2)}`], ['손가락 B', `손가락 ${G.Lf} mm`, `${G.z}T 모듈 ${G.m}`, `피벗 ${fmt(free, 2)}`]]);
      model.asm = ['두 손가락 피벗 핀을 바닥판에 눌러 끼우고, 기어 이를 맞물려 두 손가락이 대칭이 되게 얹습니다.', '커플러를 크랭크 핀과 손가락 A 레버 핀에 끼웁니다.', '손가락 끝 패드에 고무(실리콘 패드)를 붙이면 잘 잡힙니다.'];
      model.notes.push('입력 한 바퀴마다 한 번 집고 한 번 놓습니다. 4절 링크가 손가락 A를 흔들고, 기어가 손가락 B를 반대로 돌립니다.');
      return [circlePts(pd / 2 + 4, 24, ...G.P1), circlePts(pd / 2 + 4, 24, ...G.P2)];
    } },
  ujoint: { def: { beta: 25, H: 26, L: 40 }, ko: '유니버설 조인트', mono: true,
    pose: (D, th) => ({ phi: ujPhi(D.ujoint.beta * D2R, th) }), y: ps => ps.phi / D2R,
    build(D, model, K, M) {
      const U = D.ujoint, b = Math.min(45, Math.max(0, U.beta)) * D2R, { t, z1, bt, free, w } = K, checks = model.checks;
      const sd = D.sd, e = sd / 2 + 6, ry = e + 3, Jz = z1 + t + U.H, J = [0, 0, Jz], ax = [0, -Math.sin(b), Math.cos(b)], pin = 3;
      // 입력 요크: 1층 원판은 K.driver, 귀는 그 위
      const ein = xfTris(extrudeTris(rectPts(-4.5, 0, 4.5, U.H + 4.5), [circlePts(pin / 2 + 0.2, 16, 0, U.H)], 3), XF.basis([0, 1, 0], [0, 0, 1], [1, 0, 0]));
      const yin = K.driver(circlePts(ry, 40)).concat(moveTris(ein, e, 0, z1), moveTris(ein, -e - 3, 0, z1));
      model.parts.push({ name: '입력 요크', file: `ujoint_yoke_in_d${sd}`, tris: yin, motion: tt => XF.Rz(K.thOf(tt)), print: K.hub ? K.flip : undefined, clash: [{ h: circlePts(ry, 24), z: [z1, Jz + 5] }] });
      // 십자: x 팔(입력 요크 귀), y 팔(출력 요크 귀)
      const armL = 2 * e + 6, cross = xfTris(extrudeTris(circlePts(pin / 2, 16), [], armL), XF.basis([0, 1, 0], [0, 0, 1], [1, 0, 0], [-armL / 2, 0, 0]))
        .concat(xfTris(extrudeTris(circlePts(pin / 2, 16), [], armL), XF.basis([0, 0, 1], [1, 0, 0], [0, 1, 0], [0, -armL / 2, 0])), moveTris(extrudeTris(rectPts(-4, -4, 4, 4), [], 8), 0, 0, -4));
      const frames = tt => { const th = K.thOf(tt), e1 = [Math.cos(th), Math.sin(th), 0], e2 = V3.unit(V3.cross(ax, e1)), y0 = [0, Math.cos(b), Math.sin(b)];
        const phi = Math.atan2(V3.dot(V3.cross(y0, e2), ax), V3.dot(y0, e2)); return { e1, e2, phi }; };
      model.parts.push({ name: '십자 (스파이더)', file: `ujoint_cross_e${fmt(e, 1)}`, tris: cross, clash: [], motion: tt => { const f = frames(tt); return XF.basis(f.e1, f.e2, V3.cross(f.e1, f.e2), J); } });
      // 출력 요크: 출력 좌표(z' = 출력축)에서 귀가 y' 방향, 원판은 관절 위 U.H 높이
      const eo = xfTris(extrudeTris(rectPts(-4.5, -U.H - 4.5, 4.5, 0), [circlePts(pin / 2 + 0.2, 16, 0, -U.H)], 3), XF.basis([1, 0, 0], [0, 0, 1], [0, -1, 0]));
      const yo = moveTris(extrudeTris(circlePts(ry, 40), [borePts(sd + 0.1, 0.5)], t), 0, 0, 0).concat(moveTris(eo, 0, e + 3, 0.01), moveTris(eo, 0, -e, 0.01));
      const Rb = XF.basis([1, 0, 0], [0, Math.cos(b), Math.sin(b)], ax);
      model.parts.push({ name: '출력 요크', file: `ujoint_yoke_out_d${sd}`, tris: yo, clash: [], print: XF.I(),
        motion: tt => XF.mul(XF.mul(XF.T(...J), Rb), XF.mul(XF.Rz(frames(tt).phi), XF.T(0, 0, U.H))) });
      // 출력축과 받침
      const S0 = V3.add(J, V3.mul(ax, U.H + t)), S1 = V3.add(J, V3.mul(ax, U.H + t + U.L)), Sb = V3.add(J, V3.mul(ax, U.H + t + U.L - 8));
      model.rods.push({ a: S0, b: S1, d: sd, role: 'output' });
      const blk = xfTris(moveTris(extrudeTris(rectPts(-8, -8, 8, 8), [circlePts((sd + 0.3) / 2, 28)], 10), 0, 0, -5), XF.mul(XF.T(...Sb), Rb));
      const bb = trisBounds(blk), colH = bb.lo[2] - bt + 2;
      model.housing.push({ name: '출력축 받침', file: `ujoint_bearing_block_b${U.beta}`, noClash: true, tris: blk.concat(moveTris(extrudeTris(rectPts(Sb[0] - 6, Sb[1] - 6, Sb[0] + 6, Sb[1] + 6), [], colH), 0, 0, bt - 0.01)) });
      K.grow(0, 0, ry + 6); K.grow(Sb[0], Sb[1], 12);
      const v = 1 / Math.cos(b);
      checks.unshift({ st: U.beta <= 30 ? 'ok' : U.beta <= 40 ? 'warn' : 'bad', txt: `꺾임 각 <em>${fmt(U.beta, 0)}°</em> · 출력 속도가 한 바퀴에 두 번 <em>${fmt(Math.cos(b) * 100, 0)}% ~ ${fmt(v * 100, 0)}%</em>로 출렁입니다${U.beta > 30 ? ' · 30° 넘으면 요크 귀끼리 닿고 출렁임이 커집니다' : ''}` });
      checks.push({ st: 'ok', txt: '두 개를 같은 꺾임으로 이어(가운데 축의 요크 방향을 맞춰) 쓰면 출렁임이 사라집니다 (등속 배치).' });
      model.hud = [['입력', fmt(K.rpm, 1) + ' rpm'], ['꺾임', fmt(U.beta, 0) + '°'], ['속도 출렁임', `±${fmt((v - Math.cos(b)) / 2 * 100, 0)}%`]];
      model.table = linkTbl([['입력 요크', `귀 간격 ${fmt(2 * e, 1)} · 높이 ${U.H}`, `원판 ${fmt(2 * ry, 0)}`, boreTxt(K)], ['십자', `팔 ${fmt(armL, 0)} mm`, `핀 ${pin}`, '귀 구멍 3.4'], ['출력 요크', `귀 간격 ${fmt(2 * e, 1)}`, `원판 ${fmt(2 * ry, 0)}`, `축 ${sd} D컷`]]);
      model.asm = ['십자의 두 팔을 입력 요크와 출력 요크 귀 구멍에 끼웁니다 (귀를 살짝 벌려 끼우거나 M3 볼트를 팔 대신 씀).', `출력축을 출력 요크에 끼우고 받침 구멍으로 통과시킵니다. 받침은 바닥판에 붙입니다.`];
      model.glue = '출력축 받침을 바닥판에 붙임';
      model.bomExtra = [[`Ø${sd} D컷 축 (출력)`, 1, `${U.L + 15} mm`]];
      model.notes.push('입력축과 꺾인 출력축 사이에서 십자가 흔들리며 회전을 전합니다. 꺾일수록 출력 속도가 출렁입니다.');
      return [rectPts(Sb[0] - 7, Sb[1] - 7, Sb[0] + 7, Sb[1] + 7)];
    } },
  conveyor: { def: { R: 12, L: 100, h: 16, n: 6 }, ko: '벨트 컨베이어', mono: true,
    pose: (D, th) => ({ s: D.conveyor.R * th }), y: ps => ps.s,
    build(D, model, K, M) {
      const C = D.conveyor, { t, z1, bt, free, press, pd } = K, checks = model.checks, R = C.R, L = C.L, h = C.h, bT = 1.2, Rb = R + bT / 2;
      const drum = K.driver(circlePts(R, 48)).concat(moveTris(extrudeTris(circlePts(R, 48), [borePts(K.bore.d, K.bore.dcut, 40, K.bore.dd)], h - t + 0.01), 0, 0, z1));
      model.parts.push({ name: '구동 드럼', file: `conveyor_drive_drum_R${R}`, tris: drum, motion: tt => XF.Rz(K.thOf(tt)), print: K.hub ? K.flip : undefined, clash: [{ h: circlePts(R, 32), z: [z1, z1 + h], cc: true }] });
      let idl = moveTris(extrudeTris(circlePts(R, 48), [circlePts(free / 2, 28)], h), 0, 0, z1).concat(K.pivot(0, 0, z1, '종동 드럼 받침', 'conveyor_idler_post'));
      const post = model.housing.find(x => x.file === 'conveyor_idler_post'); if (post) post.tris = moveTris(post.tris, L, 0, 0);
      model.parts.push({ name: '종동 드럼', file: `conveyor_idler_drum_R${R}`, tris: idl, motion: tt => XF.mul(XF.T(L, 0, 0), XF.Rz(K.thOf(tt))), clash: [{ h: circlePts(R, 32), z: [z1, z1 + h], cc: true }] });
      const loop = (r, n = 40) => { const P = []; for (let i = 0; i <= n; i++) { const a = -PI / 2 + PI * i / n; P.push([L + r * Math.cos(a), r * Math.sin(a)]); } for (let i = 0; i <= n; i++) { const a = PI / 2 + PI * i / n; P.push([r * Math.cos(a), r * Math.sin(a)]); } return P; };
      const band = moveTris(extrudeTris(loop(R + bT), [loop(R + 0.05)], h - 2), 0, 0, z1 + 1);
      model.parts.push({ name: '벨트 (TPU)', file: `conveyor_belt_L${fmt(2 * L + 2 * PI * Rb, 0)}`, tris: band, clash: [], motion: () => XF.I() });
      const path = convPath(R + bT, L), P = 2 * L + 2 * PI * (R + bT), n = Math.max(2, Math.round(C.n)), cleat = extrudeTris(rectPts(-1.5, 0, 1.5, 6), [], h - 2);
      for (let i = 0; i < n; i++) model.parts.push({ name: `밀대 ${i + 1}`, file: 'conveyor_cleat', tris: cleat, clash: [], motion: tt => { const q = path(P * i / n + (R + bT) * K.thOf(tt)); return XF.mul(XF.T(q[0], q[1], z1 + 1), XF.Rz(q[2] - PI)); } });
      model.plateHoles.push([L, 0, press]);
      K.grow(0, 0, R + 10); K.grow(L, 0, R + 10);
      K.pin('종동 드럼 피벗 핀', 0, z1 + h, () => [L, 0], ['종동 드럼', '종동 드럼 받침']);
      const v = R * K.wv, F = +(D.drive || {}).F || 0;
      checks.unshift({ st: 'ok', txt: `이송 속도 <em>${fmt(v, 1)} mm/s</em> · 축 사이 ${L} mm · 벨트 둘레 <em>${fmt(P, 0)} mm</em> · 밀대 ${n}개 (간격 ${fmt(P / n, 0)} mm)` });
      checks.push({ st: 'ok', txt: `벨트를 ${fmt(F, 1)} N으로 당기려면 드럼 축에 ${fmt(F * R / 10, 2)} N·cm가 걸립니다. 벨트는 TPU로 출력하거나 고무 밴드를 쓰세요.` });
      model.hud = [['드럼', fmt(K.rpm, 1) + ' rpm'], ['이송 속도', fmt(v, 1) + ' mm/s'], ['벨트 둘레', fmt(P, 0) + ' mm']];
      model.table = linkTbl([['구동 드럼', `반지름 ${R} · 높이 ${h}`, '', boreTxt(K)], ['종동 드럼', `반지름 ${R} · 높이 ${h}`, '', `피벗 ${fmt(free, 2)}`], ['벨트 (TPU)', `둘레 ${fmt(P, 0)} mm`, `두께 ${bT}`, ''], { part: -1, c: ['축 사이', `${L} mm`, '바닥판', `피벗 ${pd}`] }]);
      model.asm = ['종동 드럼 피벗 핀을 바닥판에 눌러 끼우고 종동 드럼을 얹습니다.', '벨트를 두 드럼에 걸고 밀대를 벨트 바깥에 같은 간격으로 붙입니다.'];
      model.notes.push('세로로 선 두 드럼에 벨트를 걸어 수평으로 도는 컨베이어입니다. 밀대가 물건을 밀어 보냅니다 (회전 → 연속 이송).');
      return [circlePts(pd / 2 + 4, 24, L, 0)];
    } },
};
// 겹침 검사용: 중심 둘레로 0.2 mm 줄임 (출력 공차보다 작은 스침은 무시)
const shrink2 = (P, d) => P.map(([x, y]) => { const r = Math.hypot(x, y) || 1; return [x * (r - d) / r, y * (r - d) / r]; });
function ujPhi(b, th) { const p = Math.atan2(Math.sin(th), Math.cos(th) * Math.cos(b)); return p + 2 * PI * Math.round((th - p) / (2 * PI)); }
function gripExt(G) { let lo = Infinity, hi = -Infinity; const p0 = gripPose(G, 0); if (!p0) return { lo: 0, hi: 0, span: 0 };
  for (let i = 0; i < 180; i++) { const p = gripPose(G, 2 * PI * i / 180); if (!p) continue; const d = p.psi - p0.psi; lo = Math.min(lo, d); hi = Math.max(hi, d); } return { lo, hi, span: hi - lo }; }
// 손가락이 가장 오므라들 때 두 패드 사이가 2 mm 가 되도록 처음 각도 β0
const gripMemo = new Map();
function gripBeta(G) { const key = JSON.stringify(G); if (gripMemo.has(key)) return gripMemo.get(key); const x = gripExt(G), w = G.w || 10, need = 1 + w / 2 + 1.5 + 2.5 - G.s; const v = Math.asin(Math.max(-0.9, Math.min(0.9, need / G.Lf))) - x.lo; if (gripMemo.size > 200) gripMemo.clear(); gripMemo.set(key, v); return v; }
function gripGap(G, d) { const b0 = gripBeta(G), w = G.w || 10; return 2 * (G.s + G.Lf * Math.sin(b0 + d) - w / 2 - 1.5 - 2.5); }
// 기존 표에 끼워 넣기
LK_TYPES.push(...Object.keys(LK_X));
Object.entries(LK_X).forEach(([k, X]) => { LK_DEF[k] = X.def; LK_BUILD[k] = X.build; LK_KO[k] = X.ko; });
Object.assign(LK_FORCE, { winch: 1, gripper: 1, conveyor: 1 });
Object.assign(LK_PORTS, { vib: [], intgear: [{ id: 'out', part: '간헐 종동 기어', label: '종동 기어 축 (간헐 회전)' }], winch: [{ id: 'out', part: '추 (짐)', label: '짐 오르내림' }],
  gripper: [], ujoint: [{ id: 'out', part: '출력 요크', label: '꺾인 출력축' }], conveyor: [{ id: 'out', part: '종동 드럼', label: '종동 드럼 축' }] });
