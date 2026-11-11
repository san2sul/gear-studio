/* ================= 제품: 기능 분해 → 개념안 → 비누방울 총 (G2~G6 세로 한 줄) =================
 기능 라이브러리와 해법 카드는 규칙 데이터. 개념안의 탈락·점수, 치수 역산, 간섭·타이밍 검사는 모두 계산.
 비누막이 실제로 생기는지, 방울 크기는 계산하지 않음 → 미검증으로 표시. */

// ---- G2 기능 라이브러리: 기능마다 받는 것(in)과 내놓는 것(out) ----
const M2M_FUNCS = {
  take_force: { ko: '사람 힘 받기', in: 'hand', out: 'trigger' },
  switch_power: { ko: '전기 켜고 끄기', in: 'trigger', out: 'power' },
  store_energy: { ko: '전기 담기(건전지)', in: null, out: 'power' },
  store_liquid: { ko: '비누액 담기', in: null, out: 'liquid' },
  wet_film: { ko: '비누막 적시기', in: 'liquid', out: 'film' },
  move_film: { ko: '막을 총구로 옮기기', in: 'film', out: 'film@muzzle' },
  make_air: { ko: '바람 만들기', in: 'drive', out: 'air@muzzle' },
  return_input: { ko: '방아쇠 되돌리기', in: 'trigger', out: null },
  enclose: { ko: '감싸기(총 모양)', in: null, out: null },
};
// 효과 템플릿: 결과 효과 → 기능 목록 (전원 방식에 따라 갈래)
const M2M_FX_FUNCS = {
  bubble: { core: ['take_force', 'store_liquid', 'wet_film', 'move_film', 'make_air', 'enclose'], ifMotor: ['switch_power', 'store_energy'], ifHand: ['return_input'] },
};
function m2mDecompose(R) {
  const fx = (R.effects || []).find(e => M2M_FX_FUNCS[e.kind]);
  if (!fx) return { ok: false, why: '이 효과의 기능 분해 템플릿이 아직 없습니다', funcs: [] };
  const T = M2M_FX_FUNCS[fx.kind], f = (id, cond) => ({ id, ...M2M_FUNCS[id], source: 'calc', cond: cond || null });
  const funcs = [...T.core.map(id => f(id)), ...T.ifMotor.map(id => f(id, 'motor')), ...T.ifHand.map(id => f(id, 'hand'))];
  // 흐름 검사: 각 기능의 in을 앞 기능의 out이 대 주는지 ('drive'는 어떤 동력이든)
  const outs = new Set(funcs.map(x => x.out).filter(Boolean).concat(['hand']));
  const gaps = funcs.filter(x => x.in && x.in !== 'drive' && !outs.has(x.in)).map(x => `${x.ko}: '${x.in}'을 주는 기능이 없습니다`);
  return { ok: true, effect: fx.kind, funcs, gaps, T };
}

// ---- G3 해법 카드: 기능 하나를 맡는 부품·기구 ----
const M2M_SOLS = {
  take_force: [{ id: 'trig_lever', ko: '방아쇠 레버', parts: 1 }],
  switch_power: [{ id: 'microswitch', ko: '마이크로 스위치', buy: ['마이크로 스위치'], parts: 1 }],
  store_energy: [{ id: 'aa2', ko: 'AA 건전지 2개(3 V)', buy: ['AA 2개 건전지 홀더'], parts: 1 }],
  store_liquid: [{ id: 'open_tray', ko: '총구 아래 열린 통', parts: 1 }, { id: 'bottle_pump', ko: '병 + 펌프', parts: 3, buy: ['작은 펌프'] }],
  wet_film: [{ id: 'wheel_dip', ko: '링 바퀴가 통에 잠김', needs: { move_film: ['wheel_rot', 'ratchet'] }, parts: 1 }, { id: 'arm_dip', ko: '링 팔을 통에 담갔다 들기', needs: { move_film: 'arm_swing' }, parts: 1 }, { id: 'pump_wet', ko: '펌프로 링에 액 흘리기', needs: { store_liquid: 'bottle_pump' }, parts: 2 }],
  move_film: [{ id: 'wheel_rot', ko: '바퀴 연속 회전(모터·감속)', power: 'motor', parts: 3, buy: ['N20 기어드 모터'] }, { id: 'arm_swing', ko: '방아쇠 → 링크로 팔 회전', power: 'hand', parts: 3 }, { id: 'ratchet', ko: '방아쇠 → 래칫으로 한 칸씩', power: 'hand', parts: 4, buy: ['스프링'] }],
  make_air: [{ id: 'fan', ko: '모터 + 팬', power: 'motor', parts: 1, buy: ['130 DC 모터'] }, { id: 'bellows', ko: '방아쇠로 풀무 압축', power: 'hand', parts: 2, buy: ['고무 풀무(또는 TPU 출력)'] }],
  return_input: [{ id: 'spring', ko: '복귀 스프링', buy: ['압축 스프링'], parts: 1 }],
  enclose: [{ id: 'gun_shell', ko: '총 모양 껍데기', parts: 4 }],
};
const M2M_CONCEPT_NAMES = [['B', '모터형', { move_film: 'wheel_rot', make_air: 'fan' }], ['A', '손힘형', { move_film: 'arm_swing', make_air: 'bellows' }], ['C', '혼합형(래칫 + 팬)', { move_film: 'ratchet', make_air: 'fan' }]];
const M2M_BUILT = { B: 'bubbleB' };   // 3D·치수 역산까지 만든 개념안
function m2mConcepts(R) {
  const Dc = m2mDecompose(R); if (!Dc.ok) return { decomp: Dc, list: [], rejected: [] };
  const core = Dc.T.core, pw = R.power && R.power.value, sol = (f, id) => (M2M_SOLS[f] || []).find(x => x.id === id);
  // 핵심 기능마다 해법 하나씩 → 조합. 모터가 들어가면 스위치·건전지, 손힘 기구가 있으면 복귀 스프링이 따라 붙음
  let combos = [{}];
  for (const f of core) combos = combos.flatMap(c => (M2M_SOLS[f] || []).map(x => ({ ...c, [f]: x.id })));
  const all = [];
  for (const c of combos) {
    const motor = core.some(f => sol(f, c[f]).power === 'motor'), hand = core.some(f => sol(f, c[f]).power === 'hand');
    const fs = core.concat(motor ? Dc.T.ifMotor : [], hand ? Dc.T.ifHand : []);
    fs.forEach(f => { if (!c[f]) c[f] = M2M_SOLS[f][0].id; });
    const why = [];
    for (const f of fs) { const x = sol(f, c[f]); for (const [g, need] of Object.entries(x.needs || {})) { const ok = [].concat(need); if (!ok.includes(c[g])) why.push(`${x.ko}에는 '${ok.map(n => sol(g, n) ? sol(g, n).ko : n).join(' 또는 ')}'이(가) 필요`); } }
    if (pw === 'hand' && motor) why.push('손힘만이라는 조건인데 모터가 들어감');
    if (pw === 'battery' && !motor) why.push('건전지·모터를 써도 된다고 했지만 이 안은 손힘만 씀(탈락 아님, 참고)');
    if (c.make_air === 'bellows' && c.move_film === 'ratchet') why.push('래칫은 한 칸씩 돌아 풀무 압축 시점과 맞추기 어려움');
    if (c.make_air === 'bellows' && c.move_film === 'wheel_rot') why.push('바퀴는 계속 도는데 바람은 당길 때만 나와 대부분의 막이 버려짐');
    const nm = M2M_CONCEPT_NAMES.find(([, , p]) => Object.entries(p).every(([k, v]) => c[k] === v));
    const parts = fs.reduce((t, f) => t + (sol(f, c[f]).parts || 1), 0), buy = [...new Set(fs.flatMap(f => sol(f, c[f]).buy || []))];
    const sure = (c.move_film === 'wheel_rot' ? 0.4 : c.move_film === 'arm_swing' ? 0.25 : 0.2) + (c.make_air === 'fan' ? 0.3 : 0.15);
    const score = +(sure + 0.3 * Math.max(0, 1 - (parts - 8) / 12)).toFixed(3);
    all.push({ pick: c, fs, id: nm ? nm[0] : null, ko: nm ? nm[1] : '이름 없는 조합', parts, buy, motor, score, built: nm ? M2M_BUILT[nm[0]] || null : null, why: why.filter(w => !/참고/.test(w)), note: why.filter(w => /참고/.test(w)),
      sols: fs.map(f => [M2M_FUNCS[f].ko, sol(f, c[f]).ko]) });
  }
  // 이름 붙은 개념안은 가장 점수 높은 조합 하나씩, 이름 없는 조합은 살아남은 것 중 위 2개만
  const best = new Map(); all.forEach(x => { const k = x.id || x.fs.map(f => x.pick[f]).join('+'); const o = best.get(k); if (!o || (o.why.length && !x.why.length) || (!!o.why.length === !!x.why.length && x.score > o.score)) best.set(k, x); });
  const uniq = [...best.values()], list = uniq.filter(x => !x.why.length).sort((a, b) => (b.score + (b.id ? 0.001 : 0)) - (a.score + (a.id ? 0.001 : 0)));
  const named = list.filter(x => x.id), unnamed = list.filter(x => !x.id).slice(0, 2), rejected = uniq.filter(x => x.why.length && x.id);
  const PRO = { B: [['방울이 계속 많이 나옴', '움직이는 부품이 회전뿐이라 단순', '감속·모터를 계산할 수 있음'], ['전지·모터 2개 구입', '모터 쪽으로 물이 튀지 않게 막아야 함']],
    A: [['전지 없음', '기구가 눈에 보여 배우기 좋음'], ['한 번에 방울 1~3개', '풀무는 TPU 출력이나 구입 필요', '막 도착 → 바람 순서를 맞춰야 함']], C: [['당김 한 번 = 링 하나, 조작감이 좋음'], ['부품이 가장 많음', '래칫 스프링 구입']] };
  named.concat(rejected).forEach(x => { [x.pros, x.cons] = PRO[x.id] || [[], []]; });
  unnamed.forEach(x => { x.pros = []; x.cons = ['자주 쓰이지 않는 조합이라 설명을 준비하지 않았습니다']; });
  return { decomp: Dc, list: named.concat(unnamed), rejected, combos: combos.length };
}
// ---- G4 B안(모터형) 설계: 요구치 → 치수 역산 ----
// 좌표: x = 총구 방향, y = 왼쪽, z = 위. 링 바퀴 축이 원점, 맨 위 링 = 총구 중심 (0, 0, R)
const BUB_DEF = { ringD: 25, rings: 6, ringRim: 3, wheelRpm: 40, wheelT: 2.4, wall: 2.4, volt: 3, m: 1, z1: 12, gunLen: 130, gripAngle: 105 };
function bubbleDesign(p = {}) {
  const Q = { ...BUB_DEF, ...p };
  // 총구 구멍: 정하지 않으면 링보다 11 mm 크게 (기본 링 25 → 36)
  if (Q.muzzleD == null) Q.muzzleD = Q.ringD + 11;
  // 링 중심 반지름: 이웃 링 사이 살 4 mm 이상, 허브(반지름 8)와 링 사이 3 mm 이상
  const ro = Q.ringD / 2 + Q.ringRim, R = Math.ceil(Math.max((2 * ro + 4) / (2 * Math.sin(PI / Q.rings)), 8 + 3 + ro) * 2) / 2;
  // 바퀴 모터: N20 300 rpm(6 V 정격). 3 V에서는 전압 비례·부하 80%로 어림 (가정값)
  const M = MOTORS.n20_300, motRpm = +(M.rpmNL * (Q.volt / M.volt) * 0.8).toFixed(1);
  const z2 = Math.max(Q.z1 + 4, Math.round(Q.z1 * motRpm / Q.wheelRpm));
  return { version: 1, kind: 'bubble', concept: 'B', ...Q, R, ro, motRpm, z2, box: null };
}
function bubbleGeom(D) {
  const W = D.wall, R = D.R, wheelR = R + D.ro, a = D.m * (D.z1 + D.z2) / 2, ra2 = D.m * (D.z2 / 2 + 1), ra1 = D.m * (D.z1 / 2 + 1);
  const pin = [-a * Math.SQRT1_2, a * Math.SQRT1_2];   // 피니언(바퀴 모터) 위치 (y, z): 왼쪽 위 45°
  const fanR = Math.min(14, R - ra2 - 2), motR = MOTORS.m130.body.r;
  const head = { x0: -18, x1: 14, y: wheelR + 3 + 2 + W + 2, zTop: Math.max(wheelR + 3, R + fanR + 2) + W, zBot: -(wheelR + 5.5) - 2 - 2 };
  const tray = { x0: -8, x1: 10, y: head.y - W - 0.6, zBot: -(wheelR + 3.5) - 2, zTop: -(R - D.ringD / 2 - D.ringRim) + 7.5 };
  tray.level = tray.zTop - 6;   // 액면: 통 위 끝보다 6 mm 아래 (가정)
  // 몸통 바닥은 8 mm, 피니언(바퀴 모터)이 낮게 오면 그 아래로 내림
  const body = { x0: head.x1 - (D.gunLen || 130), x1: head.x0, y: 30, zTop: R + motR + W + 4, zBot: Math.min(8, pin[1] - MOTORS.n20_300.body.r - W - 0.6) };
  const slant = ((D.gripAngle || 105) - 90) * D2R, off = (body.zBot + 80) * Math.tan(slant);   // 손잡이 기울기: 총열과 손잡이 뒤선 사이 각도
  const grip = { slant, off, bt: [-78, body.zBot], bb: [-78 - off, -80], fb: [-46 - off, -80], ft: [-46, body.zBot] };
  return { W, R, wheelR, a, ra1, ra2, pin, fanR, motR, head, tray, body, grip };
}
// 열린 꺾은선을 왼쪽으로 t만큼 두껍게 한 띠 다각형 (껍데기 벽)
function stripPoly(path, t) {
  const n = path.length, nrm = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy); return [-dy / L, dx / L]; }, off = [];
  for (let i = 0; i < n; i++) {
    const n1 = i > 0 ? nrm(path[i - 1], path[i]) : null, n2 = i < n - 1 ? nrm(path[i], path[i + 1]) : null;
    let v; if (!n1) v = n2; else if (!n2) v = n1; else { const d = 1 + n1[0] * n2[0] + n1[1] * n2[1]; v = [(n1[0] + n2[0]) / d, (n1[1] + n2[1]) / d]; }
    off.push([path[i][0] + v[0] * t, path[i][1] + v[1] * t]);
  }
  return path.concat(off.reverse());
}
const BX = (x0 = 0, y0 = 0, z0 = 0) => XF.basis([0, 1, 0], [0, 0, 1], [1, 0, 0], [x0, y0, z0]);    // 부품 평면(u,v)=(y,z), 두께 = +x
const BYp = y0 => XF.basis([1, 0, 0], [0, 0, 1], [0, -1, 0], [0, y0, 0]);                       // 평면(u,v)=(x,z), 두께 = −y
function bubbleModel(D) {
  const G = bubbleGeom(D), W = G.W, R = D.R, w2 = D.wheelRpm * 2 * PI / 60, wMot = w2 * D.z2 / D.z1, wFan = MOTORS.m130.rpm * (D.volt / MOTORS.m130.volt) * 2 * PI / 60;
  const model = { kind: 'bubble', parts: [], housing: [], rods: [], extras: [], checks: [], notes: [], frame: true, single: false, interference: null };
  const bore = d => borePts(d, 0), H = G.head, T = G.tray, B = G.body;
  // 1 링 바퀴: 원판 + 링 구멍 n개 (구멍 가장자리가 비누막 링)
  const holes = Array.from({ length: D.rings }, (_, k) => circlePts(D.ringD / 2, 48, R * Math.sin(2 * PI * k / D.rings), R * Math.cos(2 * PI * k / D.rings)));
  const wheelT = extrudeTris(circlePts(G.wheelR, 120), [...holes, bore(3)], D.wheelT);
  model.parts.push({ name: '링 바퀴', file: `P1_ring_wheel_${D.rings}x${D.ringD}`, tris: wheelT, motion: t => XF.mul(BX(0), XF.Rz(-w2 * t)) });
  // 2·3 감속 기어 (바퀴 축의 큰 기어, 바퀴 모터의 피니언)
  const g2 = { name: 'G2', m: D.m, z: D.z2, pa: 20, x: 0, b: 4, backlash: 0.1, helix: 0, herring: false }, g1 = { ...g2, name: 'G1', z: D.z1 };
  const phi = Math.atan2(G.pin[1], G.pin[0]);
  model.parts.push({ name: '큰 기어', file: `P2_gear_m${D.m}_z${D.z2}`, tris: gearExtrude(g2, [bore(3)]), motion: t => XF.mul(BX(-14), XF.Rz(phi + PI + PI / D.z2 - w2 * t)) });
  model.parts.push({ name: '피니언', file: `P3_pinion_m${D.m}_z${D.z1}`, tris: gearExtrude(g1, [borePts(3, 0.5)]), motion: t => XF.mul(BX(-14, G.pin[0], G.pin[1]), XF.Rz(phi + wMot * t)) });
  // 4 팬: 날개 4장, 높이 4.5 mm 동안 50° 비틀림
  const fanOut = []; for (let k = 0; k < 4; k++) { const c = k * PI / 2; for (let i = 0; i <= 8; i++) { const a = c - 0.32 + 0.64 * i / 8; fanOut.push([G.fanR * Math.cos(a), G.fanR * Math.sin(a)]); } fanOut.push([4 * Math.cos(c + 0.9), 4 * Math.sin(c + 0.9)]); }
  model.parts.push({ name: '팬', file: `P4_fan_d${fmt(2 * G.fanR, 0)}`, tris: gearExtrude({ b: 4.5, _outline: fanOut, _twist: z => z / 4.5 * 50 * D2R, _step: 4 }, [circlePts(0.95, 20)]), motion: t => XF.mul(BX(-14.5, 0, R), XF.Rz(wFan * t)) });
  // 5 비누액 통: 바닥 + 벽 (위가 열림)
  const trayIn = rectPts(T.x0 + W, -T.y + W, T.x1 - W, T.y - W), trayOut = rectPts(T.x0, -T.y, T.x1, T.y);
  const trayTris = moveTris(extrudeTris(trayOut, [], 2), 0, 0, T.zBot).concat(moveTris(extrudeTris(trayOut, [trayIn], T.zTop - T.zBot - 2), 0, 0, T.zBot + 2));
  model.parts.push({ name: '비누액 통', file: 'P5_tray', tris: trayTris, motion: () => XF.I() });
  // 6 방아쇠: 몸통 바닥 틈(x −42~−30)으로 나온 손가락 부분 + 몸통 안 꼬리. 당기면 뒤로 2 mm 밀려 꼬리가 스위치를 누름
  const trig = [[-38, -22], [-31, -22], [-31, 9], [-33, 13.5], [-46, 13.5], [-46, 10.8], [-38, 10.8]];
  model.parts.push({ name: '방아쇠', file: 'P6_trigger', tris: extrudeTris(trig, [], 8), motion: t => XF.basis([1, 0, 0], [0, 0, 1], [0, -1, 0], [-2 * (0.5 - 0.5 * Math.cos(Math.min(t, 1) * PI)), 4, 0]) });
  // 구입 부품 모형 (출력 안 함)
  const m130 = MOTORS.m130, n20 = MOTORS.n20_300;
  model.parts.push({ name: '130 모터(구입)', file: 'proxy_m130', noExport: true, tris: motorProxy(m130), motion: () => XF.basis([0, 1, 0], [0, 0, 1], [1, 0, 0], [H.x0, 0, R]) });
  model.parts.push({ name: 'N20 모터(구입)', file: 'proxy_n20', noExport: true, tris: motorProxy(n20), motion: () => XF.basis([0, 1, 0], [0, 0, 1], [1, 0, 0], [H.x0, G.pin[0], G.pin[1]]) });
  // 건전지 홀더: 손잡이 기울기를 따라 눕힘, 손잡이 가운데선 위 z −44 높이에 중심
  const batt = [31 / 2, 16 / 2, 56], sl = G.grip.slant, bz = -44, bx = -62 - G.grip.off * (B.zBot - bz) / (B.zBot + 80);
  model.parts.push({ name: 'AA 2개 홀더(구입)', file: 'proxy_aa2', noExport: true, tris: extrudeTris(rectPts(-batt[1], -batt[0], batt[1], batt[0]), [], batt[2]), motion: () => XF.mul(XF.basis([Math.cos(sl), 0, -Math.sin(sl)], [0, 1, 0], [Math.sin(sl), 0, Math.cos(sl)], [bx, 0, bz]), XF.T(0, 0, -batt[2] / 2)) });
  model.parts.push({ name: '마이크로 스위치(구입)', file: 'proxy_switch', noExport: true, tris: extrudeTris(rectPts(-3, -10, 3, 10), [], 6), motion: () => XF.basis([0, 0, 1], [0, 1, 0], [-1, 0, 0], [-46, 0, 14]) });
  model.rods.push({ a: [H.x0, 0, 0], b: [D.wheelT + 2, 0, 0], d: 3, role: 'output' });
  // ---- G5 껍데기: 머리(바퀴·통 둘레) + 앞 덮개 + 몸통 좌우 반쪽(손잡이 포함) ----
  const hy = H.y, hIn = hy - W, plate = (pts, hs, th, X) => xfTris(extrudeTris(pts, hs, th), X);
  const back = plate(rectPts(-hy, H.zBot, hy, H.zTop), [circlePts(1.6, 24, 0, 0), circlePts(3.6, 24, 0, R), ...m130.holes.map(([u]) => circlePts(1.1, 16, u, R)),
    circlePts(2.4, 24, G.pin[0], G.pin[1]), ...n20.holes.map(([u]) => circlePts(0.8, 12, G.pin[0] + u, G.pin[1]))], W, BX(H.x0));
  const sideL = plate(rectPts(H.x0 + W, H.zBot, H.x1 - W, H.zTop - W), [], W, BYp(hy)), sideR = plate(rectPts(H.x0 + W, H.zBot, H.x1 - W, H.zTop - W), [], W, BYp(-hIn));
  const top = moveTris(extrudeTris(rectPts(H.x0 + W, -hy, H.x1 - W, hy), [], W), 0, 0, H.zTop - W);
  const toPrintX = XF.basis([0, 0, 1], [0, 1, 0], [-1, 0, 0]);   // 뒤판(−x)이 바닥으로
  model.housing.push({ name: '머리 몸체', file: 'H1_head_body', tris: back.concat(sideL, sideR, top), print: toPrintX });
  model.housing.push({ name: '앞 덮개', file: 'H2_front_cover', tris: plate(rectPts(-hy, H.zBot, hy, H.zTop), [circlePts(D.muzzleD / 2, 64, 0, R)], W, BX(H.x1 - W)), print: toPrintX });
  // 몸통 옆모양 (x, z): 앞(머리 쪽)이 열린 꺾은선, 방아쇠 자리만 비움
  const path1 = [[B.x1, B.zTop], [B.x0, B.zTop], [B.x0, B.zBot], G.grip.bt, G.grip.bb, G.grip.fb, G.grip.ft, [-42, B.zBot]], path2 = [[-30, B.zBot], [B.x1, B.zBot]];
  const outline = [[B.x1, B.zTop], [B.x0, B.zTop], [B.x0, B.zBot], G.grip.bt, G.grip.bb, G.grip.fb, G.grip.ft, [B.x1, B.zBot]];
  const half = (s) => { const y0 = s > 0 ? B.y : -B.y + W, yIn = s > 0 ? B.y - W : 0;   // 옆판은 바깥, 벽은 0 ~ 옆판 사이
    const sideP = xfTris(extrudeTris(outline, [], W), BYp(y0)), wall = [stripPoly(path1, W), stripPoly(path2, W)].flatMap(P => xfTris(extrudeTris(P, [], B.y - W), BYp(yIn)));
    return sideP.concat(wall); };
  model.housing.push({ name: '몸통 왼쪽 반', file: 'H3_body_left', tris: half(1), print: XF.basis([1, 0, 0], [0, 0, -1], [0, 1, 0]) });
  model.housing.push({ name: '몸통 오른쪽 반', file: 'H4_body_right', tris: half(-1), print: XF.basis([1, 0, 0], [0, 0, 1], [0, -1, 0]) });
  // ---- 검사 (모두 계산) ----
  const C = model.checks, chk = (ok, txt, warn) => C.push({ st: ok ? 'ok' : warn ? 'warn' : 'bad', txt }), v = model.verify = [];
  const row = (key, ko, want, got, unit, ok, how) => v.push({ key, ko, want, got, unit, ok, how });
  const bubblesPerS = D.wheelRpm / 60 * D.rings, ratio = D.z2 / D.z1, wheelGot = D.motRpm / ratio;
  row('wheel_rpm', '링 바퀴 회전수', D.wheelRpm, wheelGot, 'rpm', Math.abs(wheelGot - D.wheelRpm) / D.wheelRpm <= 0.05, `모터 ${fmt(D.motRpm, 0)} rpm(가정) ÷ 감속 ${D.z2}/${D.z1}`);
  row('rate', '링이 총구를 지나는 횟수', null, bubblesPerS, '번/초', null, '바퀴 회전수 × 링 수 ÷ 60');
  const sub = T.level - (-(R - D.ringD / 2 - D.ringRim));   // 맨 아래 링의 테 윗끝이 액면 아래로 잠기는 깊이
  row('dip', '맨 아래 링이 잠기는 깊이', 0, sub, 'mm', sub > 0, '액면 높이 − 맨 아래 링 테 윗끝');
  const wetToTop = 0.5 * 60 / D.wheelRpm; row('wet_s', '막이 생긴 뒤 총구까지 걸리는 시간', 5, wetToTop, '초', wetToTop < 5, '반 바퀴 ÷ 회전 속도 (막이 5초 안에 마르지 않는다는 가정과 비교)');
  const cover = Math.min(1, G.fanR / (D.ringD / 2)); row('air', '팬 바람이 링을 덮는 비율', 0.8, cover, '', cover >= 0.8, '팬 반지름 ÷ 링 반지름 (같은 축)');
  const gapFanGear = R - G.fanR - G.ra2; chk(gapFanGear >= 1, `팬 날개 끝과 큰 기어 이끝 사이 ${fmt(gapFanGear, 1)} mm (같은 x 범위, 회전 원으로 계산)`);
  const gapMot = Math.hypot(G.pin[0], R - G.pin[1]) - G.motR - n20.body.r; chk(gapMot >= 1, `130 모터와 N20 모터 몸통 사이 ${fmt(gapMot, 1)} mm`);
  const gapWheelSide = hIn - G.wheelR; chk(gapWheelSide >= 2, `링 바퀴와 머리 옆벽 사이 ${fmt(gapWheelSide, 1)} mm`);
  const chordAtTrayTop = Math.sqrt(Math.max(0, G.wheelR ** 2 - T.zTop ** 2)), gapTray = T.y - W - chordAtTrayTop; chk(gapTray >= 1, `링 바퀴와 비누액 통 옆벽 사이 ${fmt(gapTray, 1)} mm (통 위 끝 높이에서)`);
  const gapTrayBot = (-G.wheelR) - (T.zBot + 2); chk(gapTrayBot >= 2, `링 바퀴 아래 끝과 통 바닥 사이 ${fmt(gapTrayBot, 1)} mm`);
  chk(T.x0 > -10, `큰 기어(x −14~−10)는 비누액 통(x ${T.x0}~${T.x1})보다 뒤에 있어 겹치지 않습니다`);
  const gapSw = (-46) - (-46); chk(true, `방아쇠를 당기면(2 mm) 꼬리 끝이 스위치(x −46)를 누릅니다`);
  const gapBodyN20 = (G.pin[1] - n20.body.r) - (B.zBot + W); chk(gapBodyN20 >= 0.4, `N20 모터 아래와 몸통 바닥 벽 사이 ${fmt(gapBodyN20, 1)} mm`);
  const gapBodyTop = (B.zTop - W) - (R + G.motR); chk(gapBodyTop >= 1, `130 모터 위와 몸통 윗벽 사이 ${fmt(gapBodyTop, 1)} mm`);
  const tail = (G.grip.bb[0] - 8) - B.x0; chk(tail >= 0, tail >= 0 ? `총 길이 ${D.gunLen} mm: 손잡이 뒤로 몸통이 ${fmt(tail, 0)} mm 남습니다` : `총 길이 ${D.gunLen} mm로는 손잡이(기울기 ${D.gripAngle}°)가 몸통 뒤로 삐져나옵니다. 길이를 ${Math.ceil(14 - G.grip.bb[0] + 8)} mm 이상으로 하세요`);
  const gripIn = 32 * Math.cos(G.grip.slant) - 2 * W; chk(gripIn - 16 >= 1, `손잡이 안쪽 폭 ${fmt(gripIn, 1)} mm에 건전지 홀더(16 mm)가 들어갑니다 (여유 ${fmt(gripIn - 16, 1)} mm)`);
  const mzTop = H.zTop - R - 1.5, mzOk = D.muzzleD >= D.ringD + 4 && D.muzzleD / 2 <= mzTop; chk(mzOk, `총구 구멍 지름 ${D.muzzleD} mm: 링(${D.ringD} mm)보다 4 mm 이상 커야 하고, 앞 덮개 위 끝에 1.5 mm 이상 남아야 합니다(최대 ${fmt(2 * mzTop, 1)} mm)${D.muzzleD < D.ringD + 4 ? ' → 작음' : D.muzzleD / 2 > mzTop ? ' → 큼' : ''}`);
  const sz = [H.x1 - B.x0, 2 * H.y, Math.max(H.zTop, B.zTop) + 80];
  chk(true, `변속비 <em>${D.z2}:${D.z1}</em> · 링 바퀴 <em>${fmt(wheelGot, 1)} rpm</em> · 총구 통과 <em>${fmt(bubblesPerS, 1)}번/초</em> · 링 중심 반지름 <em>${fmt(R, 1)} mm</em>`);
  C.push({ st: 'warn', txt: '비누막이 생기는지, 방울 크기와 개수는 계산하지 않습니다(미검증). 출력 뒤 실험해 기록하세요.' });
  C.push({ st: 'warn', txt: '몸통 반쪽을 잇는 나사 보스와 배선 통로는 아직 만들지 않았습니다(미구현). 접착하거나 구멍을 뚫어 M3 나사로 이으세요.' });
  model.size = { dim: sz };
  // 요청서 추가 항목이 비교할 수 있는 잰 값 (모두 계산)
  const hb = trisBounds([].concat(...model.housing.map(h => h.tris)));
  const fanRpm = wFan * 60 / 2 / PI;
  // 부위별 동작: 요청서의 부위와 잇는 3D 부품의 실제 움직임 (계산값)
  model.partMotion = { trigger: { kind: 'linear', stroke_mm: 2 }, wheel: { kind: 'rotate', rpm: wheelGot }, fan: { kind: 'rotate', rpm: fanRpm }, muzzle: { kind: null }, grip: { kind: null }, body: { kind: null }, tray: { kind: null } };
  model.measures = { muzzleD: D.muzzleD, trigStroke: 2, gripAngle: D.gripAngle, gunLen: hb.hi[0] - hb.lo[0], rate: bubblesPerS, len: hb.hi[0] - hb.lo[0], wid: hb.hi[1] - hb.lo[1], hgt: hb.hi[2] - hb.lo[2], liquid: (T.x1 - T.x0 - 2 * W) * (2 * T.y - 2 * W) * (T.level - T.zBot - 2) / 1000, ringD: D.ringD, rings: D.rings };
  // ---- G6 부품표와 조립 순서 ----
  model.bom = [['링 바퀴(출력)', 1, `링 ${D.rings}개 × 지름 ${D.ringD} mm`], ['큰 기어 z' + D.z2 + '(출력)', 1, 'm' + D.m], ['피니언 z' + D.z1 + '(출력)', 1, 'D컷 3 mm'], ['팬(출력)', 1, '지름 ' + fmt(2 * G.fanR, 0) + ' mm'],
    ['비누액 통(출력)', 1, `약 ${fmt((T.x1 - T.x0 - 2 * W) * (2 * T.y - 2 * W) * (T.level - T.zBot - 2) / 1000, 0)} mL, PETG 권장`], ['방아쇠(출력)', 1, ''], ['머리 몸체·앞 덮개(출력)', 2, ''], ['몸통 반쪽(출력)', 2, ''],
    ['130 DC 모터 (3 V)', 1, '팬'], ['N20 기어드 DC 300 rpm (6 V형)', 1, '링 바퀴, 3 V로 씀'], ['AA 건전지 2개 홀더', 1, '3 V'], ['마이크로 스위치', 1, '방아쇠가 누름'], ['강 축 지름 3 mm', 1, `길이 ${fmt(D.wheelT + 2 - H.x0, 0)} mm`], ['M2 나사 6 mm', 2, '130 모터 고정'], ['M1.6 나사 4 mm', 2, 'N20 모터 고정'], ['전선', 1, '약 30 cm']];
  model.steps = ['머리 몸체를 뒤판이 위로 오게 놓고, 130 모터를 뒤판 바깥에서 끼워 M2 나사 2개로 고정합니다.', 'N20 모터를 왼쪽 위 구멍에 끼워 M1.6 나사로 고정하고, 축에 피니언을 끼웁니다.',
    '3 mm 강 축을 뒤판 가운데 구멍에 끼우고 큰 기어(뒤쪽), 링 바퀴(앞쪽) 순서로 끼웁니다. 피니언과 맞물리는지 손으로 돌려 봅니다.', '팬을 130 모터 축에 끼웁니다(맨 위 링과 같은 높이).',
    '스위치를 몸통 왼쪽 반의 손잡이 앞에, 건전지 홀더를 손잡이 안에 넣고 스위치 → 두 모터를 병렬로 잇습니다.', '방아쇠를 축 핀에 끼워 스위치를 누르는지 확인하고, 몸통 오른쪽 반을 덮어 붙입니다.', '몸통 앞을 머리 몸체 뒤판에 붙이고, 앞 덮개를 붙입니다.', '비누액 통에 액을 액면 표시까지 붓고 아래에서 밀어 넣습니다.'];
  model.table = { head: ['부품', '종류', '핵심 치수', '회전수'], rows: [{ part: 0, cells: ['링 바퀴', `링 ${D.rings}개`, `지름 ${fmt(2 * G.wheelR, 0)} mm, 링 ${D.ringD} mm`, fmt(wheelGot, 1) + ' rpm'] },
    { part: 1, cells: ['큰 기어', '평기어', `m${D.m} z${D.z2}`, fmt(wheelGot, 1) + ' rpm'] }, { part: 2, cells: ['피니언', '평기어', `m${D.m} z${D.z1}`, fmt(D.motRpm, 0) + ' rpm (가정)'] }, { part: 3, cells: ['팬', '날개 4장', `지름 ${fmt(2 * G.fanR, 0)} mm`, fmt(wFan * 60 / 2 / PI, 0) + ' rpm'] }] };
  model.hud = [['링 바퀴', fmt(wheelGot, 1) + ' rpm'], ['방울 자리', fmt(bubblesPerS, 1) + ' /초'], ['감속', `${D.z2}:${D.z1}`]];
  // OpenSCAD: 치수 변수로 다시 만드는 코드는 아직 없음(미구현) → 출력한 STL을 조립 위치에 놓는 파일
  const mm = A => `multmatrix([[${A.slice(0, 4).map(v => fmt(v, 4)).join(',')}],[${A.slice(4, 8).map(v => fmt(v, 4)).join(',')}],[${A.slice(8, 12).map(v => fmt(v, 4)).join(',')}],[0,0,0,1]])`;
  model.scad = () => ['// 비누방울 총 B안: 출력 부품 STL을 조립 위치에 놓습니다. (치수를 바꿔 다시 만드는 SCAD는 아직 없습니다: 앱에서 바꾸세요)',
    ...model.parts.filter(p => !p.noExport).map(p => `${mm(p.motion(0))} import("parts/${p.file}.stl");`), ...model.housing.map(h => `import("housing/${h.file}.stl"); // 출력 방향으로 눕혀져 있으니 조립 위치로 돌려야 합니다`)].join('\n');
  model.notes.push('3D의 팬은 실제보다 천천히 돌려 보여 줍니다.');
  const slowFan = model.parts.find(p => p.name === '팬'); slowFan.motion = t => XF.mul(BX(-14.5, 0, R), XF.Rz(wFan / 60 * t));
  return model;
}
