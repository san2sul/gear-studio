/* ================= 동력원 연결 (공통 모듈) =================
 동력원이 없던 기구(캠, 기어 직접 설계: 평기어·베벨·유성·랙·웜·사이클로이드, 자유 조립)의 입력축 끝에
 동력원을 붙임: 입력축 부하 계산 → 동력원 추천 → 커플링·모터 브래킷·받침 다리·바탕판·축 받침 또는 손 크랭크·플랜지,
 부품표·배선·조립 순서·검사. 모든 값은 결정적 계산이며, 마찰·효율처럼 모르는 값은 가정값으로 적음. */
const PW_KINDS = { pair: 'pair', spur: 'pair', bevel: 'pair', planetary: 'pair', rack: 'pair', worm: 'pair', cycloid: 'pair', train: 'train', cam: 'cam' };
const PW_MOTORS = ['n20_30', 'n20_100', 'n20_300', 'tt', 'byj48', 'nema17', 'sg90c', 'mg996c', 'm130', 'm370', 'crank', 'handwheel', 'spring'];
const PW_FRIC = 1.3;   // 가정값: 안내·축 마찰로 부하를 30% 더 잡음
let PW = {};           // 탭별 동력원 설정 (pair·train·cam), 화면에서 저장
function pwDefault() { return { on: false, motor: 'auto', end: 'auto', F: 5, T: 5 }; }
function pwOf(D) { const g = PW_KINDS[D.kind]; if (!g || D.drive) return null; const p = D.power || PW[g]; return p && p.on ? { ...pwDefault(), ...p } : null; }
const pwN = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
const pwAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], pwSc = (a, k) => a.map(v => v * k), pwDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const pwCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const pwRect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// 부하 종류: 힘(N)으로 받는 기구(캠의 직선 종동절, 랙)와 출력 토크(N·cm)로 받는 기구
function pwLoadKind(D) { if (D.kind === 'rack') return 'F'; if (D.kind === 'cam') return D.camType === 'disk' && D.follower === 'swing' ? 'T' : 'F'; return 'T'; }
// 입력축에 걸리는 토크 (N·mm)와 회전수
function pwLoad(D, model, pw) {
  const rpm = Math.max(0.1, +D.rpm || 1), F = Math.max(0, +pw.F || 0), T = Math.max(0, +pw.T || 0) * 10;
  if (D.kind === 'cam') { const M = model.camMotion, s1 = M ? Math.max(...M.s1.map(Math.abs)) : 0;
    if (pwLoadKind(D) === 'T') return { T: T * s1 * D2R * PW_FRIC, rpm, how: `흔들이 부하 ${fmt(T / 10, 2)} N·cm × 최대 각 기울기 ${fmt(s1 * D2R, 3)} × 마찰 ${PW_FRIC}` };
    return { T: F * s1 * PW_FRIC, rpm, how: `종동절 힘 ${fmt(F, 1)} N × 캠이 1 rad 돌 때 최대 상승 ${fmt(s1, 2)} mm × 마찰 ${PW_FRIC}` }; }
  if (D.kind === 'rack') { const r = D.m * D.z1 / 2; return { T: F * r / 0.95 * PW_FRIC, rpm, how: `랙을 미는 힘 ${fmt(F, 1)} N × 피니언 피치원 반지름 ${fmt(r, 2)} mm ÷ 효율 0.95 × 마찰 ${PW_FRIC}` }; }
  let io = model.io;
  if (!io) { try { const d = designRatio(D); io = { r: d.r, eta: d.eta }; } catch { io = { r: 1, eta: 0.9 }; } }
  return { T: T / (io.r * io.eta), rpm, how: `출력 부하 ${fmt(T / 10, 2)} N·cm ÷ (변속비 ${fmt(io.r, 3)} × 효율 ${fmt(io.eta, 2)})` };
}
// 동력원 후보: 토크 여유와 회전수 맞음으로 등급
function pwOptions(load) {
  const out = [];
  for (const id of PW_MOTORS) {
    const M = MOTORS[id], need = Math.max(0.5, load.T); let n, Tm, sp, why = '';
    if (M.kind === 'stepper') { n = Math.min(M.rpmHi, Math.max(M.rpmLo, load.rpm)); Tm = M.torqueAt(n); sp = Math.abs(Math.log(n / load.rpm)); }
    else if (M.kind === 'hand') { n = M.att === 'flange' ? M.rpm : Math.min(load.rpm, M.rpm * 1.5); Tm = M.T; sp = Math.abs(Math.log(n / load.rpm)); }
    else { n = load.rpm >= M.rpm * 0.5 && load.rpm <= M.rpmNL ? load.rpm : M.rpm; Tm = M.T * (n < M.rpm ? Math.max(0.6, n / M.rpm) : 1); sp = Math.abs(Math.log(n / load.rpm)); }
    const margin = Tm / need, st = margin < 1 || sp > Math.log(3) ? 'bad' : margin < 1.5 || sp > Math.log(1.25) ? 'warn' : 'ok';
    if (margin < 1) why = '힘이 모자랍니다'; else if (sp > Math.log(1.25)) why = `${fmt(n, n < 20 ? 1 : 0)} rpm으로 돕니다 (필요 ${fmt(load.rpm, 1)} rpm)${n > load.rpm ? ' · 감속이 필요' : ' · 너무 느림'}`; else if (margin < 1.5) why = '여유가 적습니다';
    out.push({ id, M, n, Tm, Treq: need, margin, sp, st, why, pwm: M.kind === 'dc' && n < M.rpm });
  }
  const rk = e => ({ ok: 0, warn: 1, bad: 2 })[e.st], cost = e => e.sp + 0.15 * Math.abs(Math.log(e.margin / 3)) + (e.M.kind === 'hand' ? 0.6 : 0);
  return out.sort((a, b) => rk(a) - rk(b) || cost(a) - cost(b));
}
// 모터 몸통이 모터 좌표(축 = z, 앞면 z=0, 몸통은 -z)에서 차지하는 xy 범위
function pwFoot(M) {
  if (isServo(M)) { const V = M.servo; return [V.ox - V.ew / 2, -V.bh / 2, V.ox + V.ew / 2, V.bh / 2]; }
  const B = M.body; if (B.type === 'box') return [B.cx - B.w / 2, B.cy - B.h / 2, B.cx + B.w / 2, B.cy + B.h / 2];
  if (B.type === 'cyl') return [(B.cx || 0) - B.r, (B.cy || 0) - B.r, (B.cx || 0) + B.r, (B.cy || 0) + B.r];
  return [-B.r, -B.flat, B.r, B.flat];
}
function pwAttach(D, model, pw) {
  const C = model.checks = model.checks || [], rod = (model.rods || []).find(r => r.role === 'input');
  if (!rod) { C.unshift({ st: 'bad', txt: '동력원: 입력축을 찾지 못해 연결하지 못했습니다' }); return; }
  const load = pwLoad(D, model, pw), opts = pwOptions(load), sel = pw.motor === 'auto' ? opts.find(o => o.M.kind !== 'hand') || opts[0] : opts.find(o => o.id === pw.motor) || opts[0];
  const M = sel.M, hand = M.kind === 'hand', d = rod.d, w = sel.n * 2 * PI / 60;
  // 기구 전체 범위 → 바깥쪽 축 끝 고르기
  let all = []; (model.parts || []).forEach(p => { all = all.concat(xfTris(p.tris, p.motion(0))); }); (model.housing || []).forEach(h => { if (h.assembly !== false) all = all.concat(h.tris); });
  const bb = trisBounds(all), cen = bb.lo.map((v, i) => (v + bb.hi[i]) / 2), g0 = bb.lo[2];
  const ab = pwN([rod.a[0] - rod.b[0], rod.a[1] - rod.b[1], rod.a[2] - rod.b[2]]);
  const outA = pwDot([rod.a[0] - cen[0], rod.a[1] - cen[1], rod.a[2] - cen[2]], ab), outB = pwDot([rod.b[0] - cen[0], rod.b[1] - cen[1], rod.b[2] - cen[2]], pwSc(ab, -1));
  let useA = pw.end === 'a' ? true : pw.end === 'b' ? false : outA >= outB;
  if (pw.end === 'auto' && hand && Math.abs(ab[2]) > 0.7) useA = rod.a[2] > rod.b[2];   // 손으로 돌리면 위쪽 끝
  const u = useA ? ab : pwSc(ab, -1), E = useA ? rod.a : rod.b, ez = pwSc(u, -1);
  const e1 = Math.abs(ez[2]) > 0.7 ? [1, 0, 0] : pwN(pwCross([0, 0, 1], ez)), e2 = pwCross(ez, e1);
  const frame = O => XF.basis(e1, e2, ez, O), at = (O, k) => pwAdd(O, pwSc(u, k));
  const rows = [], steps = model.steps = model.steps || [], notes = model.notes = model.notes || [], bom = model.bom = model.bom || [];
  const dir = Math.abs(u[2]) > 0.7 ? (u[2] < 0 ? 'down' : 'up') : 'side';
  C.unshift({ st: sel.st, txt: `동력원 ${M.short}: 입력축 토크 <em>${fmt(sel.Tm / 10, 2)} N·cm</em> (필요 ${fmt(sel.Treq / 10, 2)} N·cm) · 여유 <em>${fmt(sel.margin, 2)}배</em>${sel.margin < 1 ? ' · 힘이 모자랍니다. 다른 동력원을 고르거나 부하를 줄이세요' : sel.margin < 1.5 ? ' · 1.5배 이상 권장' : ''}` },
    { st: sel.sp > Math.log(1.25) ? 'warn' : 'ok', txt: `입력 회전수 <em>${fmt(sel.n, 1)} rpm</em> (필요 ${fmt(load.rpm, 1)} rpm)${sel.pwm ? ' · DC 모터 속도를 PWM으로 낮춤 (토크도 줄어듦, 60%까지 가정)' : ''}${sel.sp > Math.log(1.25) ? ' · 회전수가 맞지 않으면 변속비를 바꾸거나 다른 동력원을 고르세요' : ''}` },
    { st: 'ok', txt: `부하 계산: ${load.how} = ${fmt(load.T / 10, 2)} N·cm (마찰·효율은 가정값)` });
  model.hud = [['동력원', M.short], ['토크 여유', fmt(sel.margin, 2) + '배'], ...(model.hud || [])];
  model.power = { sel, load, opts, dir, end: useA ? 'a' : 'b' };
  const Ld = (+(Math.hypot(rod.b[0] - rod.a[0], rod.b[1] - rod.a[1], rod.b[2] - rod.a[2]))).toFixed(0);
  if (hand) {   // 손 크랭크·핸드휠·태엽(플랜지): 입력축 끝에 끼움
    const ext = 14, O = at(E, 2), part = M.att === 'crank' ? crankTris(d, 0.5, M.arm) : M.att === 'wheel' ? wheelTris(d, 0.5, M.arm) : flangeTris(d, 0.5);
    if (useA) rod.a = at(E, ext); else rod.b = at(E, ext);
    model.parts.push({ name: M.att === 'crank' ? '손 크랭크' : M.att === 'wheel' ? '핸드휠' : '동력 연결 플랜지', file: M.att === 'crank' ? `power_crank_d${d}` : M.att === 'wheel' ? `power_wheel_d${d}` : `power_flange_d${d}`, tris: part, motion: t => XF.mul(frame(O), XF.Rz(-w * t)) });
    model.kit = driveKit({ drive: { motor: sel.id }, rpm: sel.n }, { r: 1, nOut: sel.n }); model.kit.title = M.name;
    bom.push([M.att === 'flange' ? `${M.name} (따로 구입·제작)` : `${M.short} (출력 부품)`, 1, `입력축 ${useA ? '바깥' : '반대'} 끝`], [`Ø${d} D컷 입력축`, 1, `길이 약 ${+Ld + ext} mm (원래보다 ${ext} mm 길게)`]);
    if (M.att === 'flange') bom.push(['M3 나사 (플랜지에 동력원 고정)', 4, '']);
    steps.push(`입력축을 ${ext} mm 길게 하고, ${M.att === 'crank' ? '손 크랭크' : M.att === 'wheel' ? '핸드휠' : '동력 연결 플랜지'}를 D컷에 맞춰 끼운 뒤 순간접착제로 고정합니다.`);
    return;
  }
  // ---- 전동: 모터 좌표에서 치수 ----
  const sh = M.shaft, servo = isServo(M), V = M.servo, tb = Math.max(3, servo ? 3 : M.boss.h + 1.2);
  const zS0 = servo ? V.top + 0.3 : tb + 0.5, zTip = servo ? V.top + sh.len : sh.len, eM = Math.max(0, Math.min(10, zTip - zS0)), eI = 8;
  const OD = Math.max(12, Math.max(d, sh.d) + 8), Lc = eM + 1 + eI, ext = eI + 2;
  const Ein = at(E, ext); if (useA) rod.a = Ein; else rod.b = Ein;
  const F = at(Ein, 1 + eM + zS0), Fw = frame(F);   // 모터 앞면 중심
  // 커플링 (모터 좌표 z = zS0 ~ zS0+Lc)
  const boreM = servo ? circlePts(V.center / 2 + 0.1, 32) : borePts(sh.d + 0.15, sh.dcut ? sh.dcut - 0.05 : 0, 40, !!sh.dd), boreI = borePts(d + 0.15, 0.5);
  const cup = moveTris(extrudeTris(circlePts(OD / 2, 48), [boreM], eM + 0.01), 0, 0, zS0).concat(moveTris(extrudeTris(circlePts(OD / 2, 48), [boreI], eI + 1), 0, 0, zS0 + eM));
  model.parts.push({ name: '축 커플링', file: `power_coupling_${(servo ? 'spline' : 'd' + sh.d)}_to_d${d}`, tris: cup, motion: t => XF.mul(Fw, XF.Rz(w * t)) });
  model.extras = (model.extras || []).concat([{ tris: xfTris(motorBodyTris(M, 0, 0, 0, 0), Fw), color: '#59636e' }]);
  model.rods.push({ a: F, b: at(F, -zTip), d: sh.d, role: 'motor' });
  // 브래킷 판 (모터 좌표 xy), 둘레 띠 7 mm에 다리
  const [fx0, fy0, fx1, fy1] = pwFoot(M), holes = servo ? V.ears : M.holes, hr = servo ? V.pilot / 2 : M.screw / 2;
  let x0 = Math.min(fx0, -OD / 2) - 3, y0 = Math.min(fy0, -OD / 2) - 3, x1 = Math.max(fx1, OD / 2) + 3, y1 = Math.max(fy1, OD / 2) + 3;
  holes.forEach(([hx, hy]) => { x0 = Math.min(x0, hx - hr - 3); x1 = Math.max(x1, hx + hr + 3); y0 = Math.min(y0, hy - hr - 3); y1 = Math.max(y1, hy + hr + 3); });
  const cut = servo ? pwRect(V.ox - V.bw / 2 - 0.3, -V.bh / 2 - 0.3, V.ox + V.bw / 2 + 0.3, V.bh / 2 + 0.3) : circlePts(M.boss.d / 2 + 0.4, 40);
  const hs = [cut, ...holes.map(([hx, hy]) => circlePts(hr, 20, hx, hy))];
  // 바닥(바탕판 윗면) 높이와 브래킷 모양
  let zg, brk, legs = [], print;
  if (dir === 'down' || dir === 'up') {
    x0 -= 7; y0 -= 7; x1 += 7; y1 += 7;
    const lg = [[x0, y0], [x1 - 7, y0], [x0, y1 - 7], [x1 - 7, y1 - 7]];
    if (dir === 'down') { const zLow = F[2] - (servo ? V.L - V.top : M.body.L); zg = Math.min(g0, zLow - 3); }
    else zg = g0;
    const H = Math.abs(F[2] - zg);   // 앞면에서 바닥까지
    brk = extrudeTris(pwRect(x0, y0, x1, y1), hs, tb);
    lg.forEach(([lx, ly]) => { brk = brk.concat(moveTris(extrudeTris(pwRect(lx, ly, lx + 7, ly + 7), [circlePts(1.3, 16, lx + 3.5, ly + 3.5)], (dir === 'down' ? H : H - tb) + 0.01), 0, 0, dir === 'down' ? -H : tb - 0.01)); legs.push(XF.apply(Fw, [lx + 3.5, ly + 3.5, 0])); });
    print = dir === 'down' ? XF.Rx(PI) : XF.I();
    if (dir === 'up') { const hit = legs.some(([lx, ly]) => lx > bb.lo[0] && lx < bb.hi[0] && ly > bb.lo[1] && ly < bb.hi[1]);
      C.push({ st: hit ? 'warn' : 'ok', txt: hit ? '모터 브래킷 다리가 기구 범위 안을 지납니다. 움직이는 부품과 닿지 않는지 3D에서 확인하거나 “축 반대쪽 끝”을 고르세요' : '모터 브래킷 다리가 기구 범위 밖에 있습니다' }); }
  } else {
    const yLow = Math.min(fy0, -OD / 2) - 3; zg = Math.min(g0, F[2] + yLow);
    const yg = zg - F[2], footL = Math.min(40, (servo ? V.L : M.body.L) + 4);
    brk = extrudeTris(pwRect(x0, yg, x1, y1), hs, tb);
    brk = brk.concat(xfTris(extrudeTris(pwRect(x0, -footL, x1, tb), [circlePts(1.3, 16, x0 + 4, -footL + 5), circlePts(1.3, 16, x1 - 4, -footL + 5)], 4), XF.basis([1, 0, 0], [0, 0, 1], [0, -1, 0], [0, yg + 4, 0])));
    legs = [[x0 + 4, -footL + 5], [x1 - 4, -footL + 5]].map(([lx, lz]) => XF.apply(Fw, [lx, yg, lz]));
    print = XF.Rx(PI / 2);
  }
  model.parts.push({ name: '모터 브래킷', file: `power_bracket_${sel.id}`, tris: brk, motion: () => Fw, print });
  // 받침 다리 (기구를 바탕판 높이로 올림) · 축 받침 (바닥판이 없는 옆 방향 축) · 바탕판
  const rise = g0 - zg, mechFrame = !!(model.frame || D.box || (model.housing || []).length);
  const pts = legs.map(p => [p[0], p[1]]), risers = [];
  if (rise > 0.5) { const ins = 6, cs = [[bb.lo[0] + ins, bb.lo[1] + ins], [bb.hi[0] - ins, bb.lo[1] + ins], [bb.lo[0] + ins, bb.hi[1] - ins], [bb.hi[0] - ins, bb.hi[1] - ins]];
    let rt = []; cs.forEach(([cx, cy]) => { rt = rt.concat(extrudeTris(pwRect(cx - 5, cy - 5, cx + 5, cy + 5), [circlePts(1.3, 16, cx, cy)], rise)); pts.push([cx, cy]); risers.push([cx, cy]); });
    model.parts.push({ name: '받침 다리 4개', file: `power_riser_h${fmt(rise, 0)}`, tris: moveTris(rt, 0, 0, zg), motion: () => XF.I() }); }
  let pillow = null;
  if (dir === 'side') { const P0 = at(E, 1), hz = P0[2] - zg, br = BEARINGS[Math.round(d)], useB = br && Math.abs(d - Math.round(d)) < 0.01, ho = useB ? br[1] / 2 + 0.1 : d / 2 + 0.3, Wp = 2 * ho + 10, tp = useB ? Math.max(5, br[2]) : 5;
    const out = [[-Wp / 2, -hz], [Wp / 2, -hz], [Wp / 2, 0], ...Array.from({ length: 17 }, (_, i) => [Wp / 2 * Math.cos(PI * i / 16), Wp / 2 * Math.sin(PI * i / 16)]), [-Wp / 2, 0]];
    const blk = extrudeTris(out, [circlePts(ho, 40)], tp).concat(xfTris(extrudeTris(pwRect(-Wp / 2 - 6, -tp - 4, Wp / 2 + 6, 0), [circlePts(1.3, 16, -Wp / 2 - 3, -tp / 2 - 2), circlePts(1.3, 16, Wp / 2 + 3, -tp / 2 - 2)], 3), XF.basis([1, 0, 0], [0, 0, 1], [0, -1, 0], [0, -hz + 3, tp])));
    const Pw = frame(at(P0, 0)); model.parts.push({ name: '입력축 받침', file: `power_pillow_d${d}${useB ? '_' + br[0] : ''}`, tris: blk, motion: () => Pw, print: XF.Rx(PI / 2) });
    pillow = { useB, br }; [[-Wp / 2 - 3, -tp / 2 - 2], [Wp / 2 + 3, -tp / 2 - 2]].forEach(([lx, lz]) => { const p = XF.apply(Pw, [lx, -hz, lz]); pts.push([p[0], p[1]]); }); }
  const allX = pts.map(p => p[0]).concat([bb.lo[0], bb.hi[0]]), allY = pts.map(p => p[1]).concat([bb.lo[1], bb.hi[1]]);
  const bx0 = Math.min(...allX) - 8, bx1 = Math.max(...allX) + 8, by0 = Math.min(...allY) - 8, by1 = Math.max(...allY) + 8;
  model.parts.push({ name: '공통 바탕판', file: 'power_base_board', tris: moveTris(extrudeTris(pwRect(bx0, by0, bx1, by1), pts.map(([x, y]) => circlePts(1.7, 20, x, y)), 4), 0, 0, zg - 4), motion: () => XF.I() });
  // 검사
  C.push({ st: eM >= 5 ? 'ok' : eM >= 3 ? 'warn' : 'bad', txt: `모터 축이 커플링에 물리는 길이 <em>${fmt(eM, 1)} mm</em>${eM < 5 ? ' (5 mm 이상 권장' + (servo ? ', 서보는 혼(horn)을 커플링에 나사로 고정하세요)' : ')') : ''} · 입력축 ${eI} mm` },
    { st: 'ok', txt: `연결: 모터 ${dir === 'down' ? '아래' : dir === 'up' ? '위' : '옆'} · 직결 커플링 (외경 ${fmt(OD, 0)} mm, 길이 ${fmt(Lc, 0)} mm) · 바탕판 윗면 z = ${fmt(zg, 1)} mm${rise > 0.5 ? ` · 기구를 ${fmt(rise, 1)} mm 올림` : ''}` });
  if (dir === 'side' && !mechFrame) C.push({ st: 'warn', txt: '이 기구에는 바닥판·지지대가 없어 입력축 받침만 만들었습니다. 다른 축(출력축 등)은 따로 받쳐 주세요 (기어박스 자동 설계나 자유 조립의 지지 구조를 쓰면 됩니다)' });
  if (dir !== 'side' && !mechFrame) C.push({ st: 'warn', txt: '이 기구에는 바닥판이 없어 받침 다리를 기어 범위 모서리에 두었습니다. 축을 받칠 판을 받침 다리 위에 따로 얹어야 합니다' });
  // 부품표·배선·조립
  model.kit = driveKit({ drive: { motor: sel.id }, rpm: sel.n }, { r: 1, nOut: sel.n }); model.kit.title = M.name;
  model.kit.notes.push('안전: 전원선에 스위치와 퓨즈(모터 정격 전류의 1.5~2배)를 다세요. 돌아가는 커플링과 기어에 손가락이 닿지 않게 하고, 처음 켤 때는 손을 떼고 지켜보세요.');
  if (M.bigAmp) model.kit.notes.push(`${M.short}는 전류가 커서 TB6612FNG로는 부족합니다. 큰 드라이버를 쓰세요.`);
  bom.push([M.name, 1, `입력 ${fmt(sel.n, 1)} rpm${sel.pwm ? ' (PWM으로 낮춤)' : ''}`]);
  if (!servo) bom.push([({ A4988: 'A4988 드라이버', ULN2003: 'ULN2003 드라이버 보드', TB6612FNG: 'TB6612FNG 드라이버' })[M.driver] || M.driver, 1, '']);
  bom.push([`${servo ? V.screwName : M.screwName} 나사 (모터를 브래킷에)`, holes.length, `길이 ${fmt(tb + 3, 0)}~${fmt(tb + 5, 0)} mm`],
    ['M3 나사 (브래킷·받침 다리·축 받침을 바탕판에)', pts.length, '바탕판 밑에서 끼워 셀프 태핑, 길이 8~10 mm'],
    [`Ø${d} D컷 입력축`, 1, `길이 약 ${+Ld} mm (원래보다 ${ext} mm 길게, 끝 ${eI} mm가 커플링에 들어감)`], ['순간접착제 또는 M3 무두볼트', 1, '커플링이 미끄러지면 축에 고정']);
  if (pillow && pillow.useB) bom.push([`${pillow.br[0]} 베어링`, 1, '입력축 받침에 눌러 끼움']);
  bom.push(...powerRows(M));
  steps.push(`모터를 브래킷 ${dir === 'side' ? '세운 판' : '판'}에 대고 ${servo ? V.screwName : M.screwName} 나사로 고정합니다${servo ? ' (서보 몸통이 사각 구멍을 지남)' : ''}.`,
    `커플링 한쪽(${servo ? '서보 스플라인' : 'Ø' + sh.d})을 모터 축에 끼우고, 입력축을 ${ext} mm 늘린 끝을 다른 쪽에 끼웁니다. D컷 방향을 맞추세요.`,
    `${rise > 0.5 ? `받침 다리 4개를 기구 바닥 모서리에 붙이고, ` : ''}모터 브래킷${pillow ? '·입력축 받침' : ''}${rise > 0.5 ? '·받침 다리' : ''}를 공통 바탕판에 올려 밑에서 M3 나사로 고정합니다. 축이 한 줄로 곧은지 손으로 돌려 봅니다.`,
    '배선표대로 연결하고 아두이노 코드로 천천히 돌려 봅니다.');
}
