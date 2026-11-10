/* ================= 동작 기구 =================
 design = { kind:'linkage', type, rpm, w(링크 폭), t(두께), pinD, sd(입력축),
   slider:{r, L, e}, yoke:{r}, fourbar:{a, b, c, d, p, q}, jansen:{m}, geneva:{n, a}, ratchet:{z, R, h, L}, screw:{d, p, starts, len}, diff:{m, zs, zp, zm, zc, dv},
   goal:{stroke, swing, Q}, drive:{motor:'auto'|'none'|id, F(N), T(N·cm), mount:'face'|'clamp'} }
 입력축 O = (0,0), 위로 z. 바닥판 윗면 bt, 1층 z1, 층 간격 t + 0.4 */
const LK_TYPES = ['slider', 'yoke', 'fourbar', 'jansen', 'geneva', 'ratchet', 'screw', 'diff'];
const LK_DEF = { slider: { r: 15, L: 55, e: 0 }, yoke: { r: 15 }, fourbar: { a: 60, b: 18, c: 55, d: 45, p: 0, q: 0 }, jansen: { m: 15 }, geneva: { n: 4, a: 25 },
  ratchet: { z: 12, R: 25, h: 4, L: 24 }, screw: { d: 10, p: 2, starts: 1, len: 60 }, diff: { m: 1.5, zs: 12, zp: 10, zm: 12, zc: 40, dv: 30 } };
function linkageDefault() {
  return linkFix({ version: 1, kind: 'linkage', type: 'slider', rpm: 30, w: 10, t: 5, pinD: 4, sd: 5, goal: { stroke: 30, swing: 50, Q: 1 }, drive: { motor: 'auto', F: 5, T: 5, mount: 'face' } });
}
function linkFix(D) {   // 예전 설계 파일에 없는 기구 값을 채움
  for (const k of Object.keys(LK_DEF)) D[k] = Object.assign({}, LK_DEF[k], D[k] || {});
  D.goal = Object.assign({ stroke: 30, swing: 50, Q: 1 }, D.goal || {});
  if (!LK_TYPES.includes(D.type)) D.type = 'slider';
  return D;
}
// 두 원의 교점: sg = +1 이면 P1→P2 선의 왼쪽
function circX(P1, r1, P2, r2, sg) {
  const dx = P2[0] - P1[0], dy = P2[1] - P1[1], R = Math.hypot(dx, dy);
  if (R > r1 + r2 || R < Math.abs(r1 - r2) || R < 1e-9) return null;
  const k = (r1 * r1 - r2 * r2 + R * R) / (2 * R), h = Math.sqrt(Math.max(0, r1 * r1 - k * k)), ux = dx / R, uy = dy / R;
  return [P1[0] + k * ux - sg * h * uy, P1[1] + k * uy + sg * h * ux];
}
// 얀센 링크 (테오 얀센의 '성스러운 수', 크랭크 m = 15 기준)
const JANSEN = { a: 38, b: 41.5, c: 39.3, d: 40.1, e: 55.8, f: 39.4, g: 36.7, h: 65.7, i: 49, j: 50, k: 61.9, l: 7.8, m: 15 };
let JSG = null;
function jansenPose(s, th) {
  const L = k => JANSEN[k] * s, Z = [-L('a'), -L('l')], A = [L('m') * Math.cos(th), L('m') * Math.sin(th)];
  if (!JSG) {   // 교점 방향: B 위, C 아래, D·E 왼쪽, F 아래 (θ=0 에서 정해 두고 계속 같은 쪽)
    JSG = {}; const pick = (P1, r1, P2, r2, f) => { const a = circX(P1, r1, P2, r2, 1), b = circX(P1, r1, P2, r2, -1); return f(a) >= f(b) ? 1 : -1; };
    const A0 = [15, 0], Z0 = [-38, -7.8];
    JSG.B = pick(A0, 50, Z0, 41.5, p => p[1]); const B0 = circX(A0, 50, Z0, 41.5, JSG.B);
    JSG.C = pick(A0, 61.9, Z0, 39.3, p => -p[1]); const C0 = circX(A0, 61.9, Z0, 39.3, JSG.C);
    JSG.D = pick(B0, 55.8, Z0, 40.1, p => -p[0]); const D0 = circX(B0, 55.8, Z0, 40.1, JSG.D);
    JSG.E = pick(D0, 39.4, C0, 36.7, p => -p[0]); const E0 = circX(D0, 39.4, C0, 36.7, JSG.E);
    JSG.F = pick(E0, 65.7, C0, 49, p => -p[1]);
  }
  const B = circX(A, L('j'), Z, L('b'), JSG.B), C = circX(A, L('k'), Z, L('c'), JSG.C); if (!B || !C) return null;
  const Dp = circX(B, L('e'), Z, L('d'), JSG.D); if (!Dp) return null;
  const E = circX(Dp, L('f'), C, L('g'), JSG.E); if (!E) return null;
  const F = circX(E, L('h'), C, L('i'), JSG.F); if (!F) return null;
  return { A, B, C, Dp, E, F, Z, P: F };
}
// 제네바: 구동 핀 반지름 a, 홈 n개. 중심거리 C = a / sin(π/n)
function genevaGeo(D) {
  const { n, a } = D.geneva, rp = D.pinD / 2, ws = D.pinD + 0.3, C = a / Math.sin(PI / n), b = a / Math.tan(PI / n);
  const Rw = Math.sqrt(b * b + (rp + 1.2) ** 2), al = PI / 2 - PI / n, rb = C - a - 0.6;
  const half = Math.asin((ws / 2) / Rw);
  let Rl = a - rp - 2.5;   // 잠금 원판 반지름: 바퀴의 오목 호가 홈 벽을 넘지 않게
  for (let it = 0; it < 60; it++) { const Rc = Rl + 0.4, cg = (C * C + Rw * Rw - Rc * Rc) / (2 * C * Rw); if (cg >= 1 || Math.acos(cg) <= PI / n - half - 2 * D2R) break; Rl -= 0.3; }
  return { n, a, rp, ws, C, b, Rw, al, rb, Rl, half };
}
function genevaPsi(G, th) {
  const k = Math.floor((th + G.al) / (2 * PI)), ph = th - 2 * PI * k;
  let pl = -PI / G.n, eng = false;
  if (ph <= G.al) { const P = [G.a * Math.cos(ph), G.a * Math.sin(ph)]; let v = Math.atan2(P[1], P[0] - G.C) - PI; while (v <= -PI) v += 2 * PI; while (v > PI) v -= 2 * PI; pl = v; eng = true; }
  return { psi: pl - k * 2 * PI / G.n, eng };
}
// 래칫: 톱니 바깥 반지름 R, 깊이 h, z개. 바퀴는 반시계(+)로만 돌고, 시계 방향은 멈춤쇠가 막음
function ratchetGeo(D) {
  const { z, R, h, L } = D.ratchet, tr = 1.0, rr = R - h, p = 2 * PI / z, out = [];
  for (let k = 0; k < z; k++) for (let i = 0; i <= 8; i++) { const f = i / 8, a = k * p + f * p * 0.999, r = R - h * f; out.push([r * Math.cos(a), r * Math.sin(a)]); }
  const T0 = [0, rr + tr], Q = [L, rr + tr + h * 0.6], rq = D.pinD / 2 + 3;
  // 멈춤쇠 몸통 밑선이 톱니 끝 원(R)을 스치지 않을 때까지 피벗을 올림 (끝 근처 4 mm는 톱니 홈에 들어감)
  for (let it = 0; it < 80; it++) { const H = hull2([...circlePts(tr, 12, ...T0), ...circlePts(rq, 24, ...Q)]); let ok = true;
    for (let i = 0; i < H.length && ok; i++) { const a = H[i], b = H[(i + 1) % H.length]; for (let k = 0; k <= 10; k++) { const x = a[0] + (b[0] - a[0]) * k / 10, y = a[1] + (b[1] - a[1]) * k / 10; if (x > 4 && Math.hypot(x, y) < R + 0.6) { ok = false; break; } } }
    if (ok) break; Q[1] += 0.25; }
  return { z, R, h, L, tr, rr, p, outline: out, T0, Q };
}
function ratchetGam(G, th) {
  const W = rotPts(G.outline, th), tip = g => { const c = Math.cos(-g), s = Math.sin(-g), dx = G.T0[0] - G.Q[0], dy = G.T0[1] - G.Q[1]; return [G.Q[0] + dx * c - dy * s, G.Q[1] + dx * s + dy * c]; };
  const clear = g => { const T = tip(g); if (pointInPoly(T[0], T[1], W)) return false; return segDist(T[0], T[1], W) >= G.tr + 0.15; };
  let lo = 0, hi = 0; if (clear(0)) return 0;
  while (!clear(hi) && hi < 1) { lo = hi; hi += 0.02; }
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (clear(m)) hi = m; else lo = m; }
  return hi;
}
// 리드스크루: 사다리꼴 나사 (30°), 효율 η (마찰계수 0.2, PLA끼리)
function screwEta(S) { const L = S.p * S.starts, dm = S.d - S.p / 2, lam = Math.atan(L / (PI * dm)), phi = Math.atan(0.2 / Math.cos(15 * D2R)); return Math.max(0.05, Math.tan(lam) / Math.tan(lam + phi)); }
// 차동(평기어식): 모터 피니언 zm → 캐리어 기어 zc, 해 기어 2개(zs)와 유성 쌍(zp) 2조
function diffGeo(D) {
  const { m, zs, zp, zm, zc } = D.diff, Cd = m * (zm + zc) / 2, ro = m * (zs + zp) / 2, dl = 2 * Math.asin(Math.min(1, m * zp / (2 * ro)));
  return { m, zs, zp, zm, zc, Cd, ro, dl };
}
// 한 입력 각 θ(rad)에서의 위치
function linkPose(D, th) {
  const c = Math.cos(th), s = Math.sin(th);
  if (D.type === 'slider') {
    const { r, L, e } = D.slider, A = [r * c, r * s], dy = e - A[1], h = L * L - dy * dy;
    if (h < 0) return null;
    return { A, B: [A[0] + Math.sqrt(h), e], phi: Math.asin(dy / L) };
  }
  if (typeof LK_X !== 'undefined' && LK_X[D.type]) return LK_X[D.type].pose(D, th);
  if (D.type === 'yoke') { const A = [D.yoke.r * c, D.yoke.r * s]; return { A, B: [A[0], 0], phi: 0, x: A[0] }; }
  if (D.type === 'jansen') return jansenPose(D.jansen.m / 15, th);
  if (D.type === 'geneva') { const G = genevaGeo(D), g = genevaPsi(G, th); return { A: [G.a * c, G.a * s], psi: g.psi, eng: g.eng }; }
  if (D.type === 'ratchet') return { psi: th, gam: ratchetGam(ratchetGeo(D), th) };
  if (D.type === 'screw') return { dz: -D.screw.p * D.screw.starts * th / (2 * PI) };
  if (D.type === 'diff') { const G = diffGeo(D), tc = -th * G.zm / G.zc, dv = (D.diff.dv || 0) / 100; return { tc, tA: tc * (1 + dv), tB: tc * (1 - dv) }; }
  const { a, b, c: cc, d, p = 0, q = 0 } = D.fourbar, A = [b * c, b * s], O4 = [a, 0];
  const B = circX(A, cc, O4, d, 1); if (!B) return null;
  const R = Math.hypot(O4[0] - A[0], O4[1] - A[1]);
  const mu = Math.acos(Math.max(-1, Math.min(1, (cc * cc + d * d - R * R) / (2 * cc * d))));
  const ex = (B[0] - A[0]) / cc, ey = (B[1] - A[1]) / cc, P = [A[0] + p * ex - q * ey, A[1] + p * ey + q * ex];
  return { A, B, O4, psi: Math.atan2(B[1] - O4[1], B[0] - O4[0]), mu, P };
}
function grashof(f) {
  const L = [f.a, f.b, f.c, f.d], s = Math.min(...L), l = Math.max(...L), sum = L.reduce((x, y) => x + y, 0);
  const ok = s + l <= sum - s - l + 1e-9;
  const type = !ok ? 'rocker3' : s === f.b ? 'crank-rocker' : s === f.a ? 'double-crank' : s === f.c ? 'double-rocker' : 'rocker-crank';
  return { ok, type, ko: { 'crank-rocker': '크랭크–흔들이 (크랭크가 한 바퀴, 출력이 흔들림)', 'double-crank': '이중 크랭크 (둘 다 한 바퀴)', 'double-rocker': '이중 흔들이 (크랭크가 한 바퀴를 못 돎)', 'rocker-crank': '흔들이–크랭크 (입력이 한 바퀴를 못 돎)', rocker3: '그라쇼프 조건 불만족 (어느 링크도 한 바퀴를 못 돎)' }[type] };
}
// 입력 한 바퀴를 N 등분해 출력 운동 계산 (y: 슬라이더·요크·나사 mm, 흔들이·바퀴·멈춤쇠·차동 °, 얀센은 발끝 높이 mm)
function linkMotion(D, N = 360) {
  const out = { th: [], y: [], P: [], ok: true, mu: [] }, ty = D.type;
  for (let i = 0; i <= N; i++) {
    const th = 2 * PI * i / N, ps = linkPose(D, th);
    if (!ps) { out.ok = false; out.th.push(th); out.y.push(NaN); continue; }
    out.th.push(th);
    out.y.push(LK_X[ty] ? LK_X[ty].y(ps) : ty === 'slider' ? ps.B[0] : ty === 'yoke' ? ps.x : ty === 'jansen' ? ps.F[1] : ty === 'ratchet' ? ps.gam / D2R : ty === 'screw' ? ps.dz : ty === 'diff' ? ps.tA / D2R : ps.psi / D2R);
    if (ty === 'fourbar') { out.mu.push(ps.mu / D2R); out.P.push(ps.P); }
    else { out.mu.push(ty === 'slider' ? 90 - Math.abs(ps.phi) / D2R : 90); if (ty === 'jansen') out.P.push(ps.F); }
  }
  if (!out.ok) return out;
  if (ty === 'fourbar') for (let i = 1; i < out.y.length; i++) { while (out.y[i] - out.y[i - 1] > 180) out.y[i] -= 360; while (out.y[i] - out.y[i - 1] < -180) out.y[i] += 360; }
  out.full = ty === 'fourbar' && Math.abs(out.y[N] - out.y[0]) > 180;   // 출력도 한 바퀴 (이중 크랭크)
  if (out.full) { const k = (out.y[N] - out.y[0]) / N; out.y = out.y.map((v, i) => v - k * i); }
  const ys = out.y.slice(0, N), iMax = ys.indexOf(Math.max(...ys)), iMin = ys.indexOf(Math.min(...ys));
  out.max = ys[iMax]; out.min = ys[iMin]; out.range = out.max - out.min;
  const fwd = ((iMax - iMin) % N + N) % N, back = N - fwd;
  out.Q = Math.max(fwd, back) / Math.max(1, Math.min(fwd, back)); out.fwdDeg = fwd * 360 / N;
  const dth = 2 * PI / N, mono = ty === 'geneva' || ty === 'screw' || ty === 'diff' || !!(LK_X[ty] && LK_X[ty].mono);
  const yv = i => mono ? out.y[i] : ys[((i % N) + N) % N];
  out.v = ys.map((v, i) => mono ? (out.y[Math.min(N, i + 1)] - out.y[Math.max(0, i - 1)]) / ((Math.min(N, i + 1) - Math.max(0, i - 1)) * dth) : (yv(i + 1) - yv(i - 1)) / (2 * dth));
  out.a = ys.map((v, i) => mono ? 0 : (yv(i + 1) - 2 * v + yv(i - 1)) / (dth * dth));
  if (ty === 'jansen') out.vP = out.P.slice(0, N).map((p, i) => { const q = out.P[(i + 1) % N], r = out.P[(i - 1 + N) % N]; return Math.hypot(q[0] - r[0], q[1] - r[1]) / (2 * dth); });
  out.muMin = Math.min(...out.mu); out.muMax = Math.max(...out.mu);
  return out;
}
// 슬라이더 블록이 가장 왼쪽(xmin)에 있을 때 크랭크 회전 원과 닿는지 (레일은 크랭크를 비켜 잘림)
function railHit(D, r, xmin, e) { const w = D.w, bl = Math.max(16, w + 8), bw = Math.max(12, w + 4), cR = r + Math.max(w / 2, D.sd / 2 + 3);
  return xmin - bl / 2 - cR < 1 && Math.abs(e) < bw / 2 + cR + 1; }
// 목표에 맞춰 치수 찾기
function linkSynth(D0) {
  const D = JSON.parse(JSON.stringify(D0)), G = D.goal, Qt = Math.max(1, G.Q || 1);
  if (D.type === 'yoke') { D.yoke.r = +(Math.max(2, G.stroke) / 2).toFixed(2); return D; }
  if (D.type === 'slider') {
    const S = Math.max(2, G.stroke), lam = Math.max(2.5, D.slider.L / Math.max(1, D.slider.r));
    if (Qt <= 1.001) { D.slider = { r: +(S / 2).toFixed(2), L: +(S / 2 * lam).toFixed(2), e: 0 }; return D; }
    let best = null;
    for (const lm of [lam, 3, 4, 5, 6]) for (let r = S * 0.3; r <= S * 0.8; r += S * 0.02) for (let k = 0; k <= 40; k++) {
      const L = r * lm, e = (L - r) * 0.95 * k / 40, T = { ...D, slider: { r, L, e } }, M = linkMotion(T, 120);
      if (!M.ok || railHit(D, r, M.min, e)) continue; const err = ((M.range - S) / S) ** 2 * 8 + ((M.Q - Qt) / Qt) ** 2 * 2 + (M.muMin < 50 ? 0.004 * (50 - M.muMin) : 0) + 0.002 * lm;
      if (!best || err < best.err) best = { err, r, L, e };
    }
    if (best) { let st = S * 0.01;
      for (let it = 0; it < 30; it++, st *= 0.85) { const B0 = { ...best };
        for (const [dr, dL, de] of [[st, 0, 0], [-st, 0, 0], [0, st, 0], [0, -st, 0], [0, 0, st], [0, 0, -st]]) {
          const r = B0.r + dr, L = B0.L + dL, e = B0.e + de, M = linkMotion({ ...D, slider: { r, L, e } }, 180); if (!M.ok || railHit(D, r, M.min, e)) continue;
          const err = ((M.range - S) / S) ** 2 * 8 + ((M.Q - Qt) / Qt) ** 2 * 2 + (M.muMin < 50 ? 0.004 * (50 - M.muMin) : 0) + 0.002 * L / r;
          if (err < best.err) best = { err, r, L, e }; } } }
    if (best) D.slider = { r: +best.r.toFixed(2), L: +best.L.toFixed(2), e: +best.e.toFixed(2) };
    return D;
  }
  if (D.type !== 'fourbar') return D;
  const a = D.fourbar.a, sw = Math.max(5, Math.min(120, G.swing));
  let best = null;
  const tryF = (b, c, d) => { const T = { ...D, fourbar: { ...D.fourbar, a, b, c, d } }; const g = grashof(T.fourbar); if (!g.ok || g.type !== 'crank-rocker') return;
    const M = linkMotion(T, 120); if (!M.ok) return;
    const err = ((M.range - sw) / sw) ** 2 * 4 + ((M.Q - Qt) / Qt) ** 2 + Math.max(0, 40 - M.muMin) * 0.01 + Math.max(0, M.muMax - 140) * 0.01;
    if (!best || err < best.err) best = { err, b, c, d }; };
  for (let b = a * 0.1; b <= a * 0.6; b += a * 0.04) for (let c = a * 0.4; c <= a * 1.6; c += a * 0.08) for (let d = a * 0.3; d <= a * 1.4; d += a * 0.08) tryF(b, c, d);
  if (best) { let st = a * 0.03;   // 다듬기
    for (let it = 0; it < 40; it++, st *= 0.85) { const B0 = { ...best }; for (const [db, dc, dd] of [[st, 0, 0], [-st, 0, 0], [0, st, 0], [0, -st, 0], [0, 0, st], [0, 0, -st]]) tryF(B0.b + db, B0.c + dc, B0.d + dd); } }
  if (best) Object.assign(D.fourbar, { b: +best.b.toFixed(2), c: +best.c.toFixed(2), d: +best.d.toFixed(2) });
  return D;
}
// 두 캡슐(선분+반지름) 사이 거리
function segSegDist(P1, P2, Q1, Q2) {
  const d = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (cr(P1, P2, Q1) * cr(P1, P2, Q2) < 0 && cr(Q1, Q2, P1) * cr(Q1, Q2, P2) < 0) return 0;
  return Math.min(d(P1, Q1, Q2), d(P2, Q1, Q2), d(Q1, P1, P2), d(Q2, P1, P2));
}
function linkBar(A, B, w, holes, t) {   // 막대 링크 (A, B 구멍), 부품 좌표 = 월드 좌표 (θ=0 자세)
  return extrudeTris(capsulePts(A, B, w / 2), holes.map(([x, y, d]) => circlePts(d / 2, 28, x, y)), t);
}
// ---- 공통: 입력축(모터 축)·바닥판 두께·층 높이·모터 고정
function linkCtx(D, model) {
  const w = D.w, t = D.t, pd = D.pinD, cl = 0.4, checks = model.checks;
  const dv = linkDrive(D), MO = dv && dv.M, rpm = dv ? dv.n : D.rpm, servo = !!MO && dv.mount === 'servo', isRed = !!dv && dv.mount === 'red', shD = MO && !isRed ? MO.shaft.d : D.sd;
  const bore = !MO || isRed ? { d: +(D.sd + 0.1).toFixed(2), dcut: 0.5 } : servo ? { d: +(MO.shaft.d - 0.1).toFixed(2), dcut: 0 } : { d: +(MO.shaft.d + 0.15).toFixed(2), dcut: MO.shaft.dcut ? +(MO.shaft.dcut - 0.05).toFixed(2) : 0, dd: !!MO.shaft.dd };
  const head = !MO || servo ? 0 : dv.mount === 'clamp' || isRed ? 2.0 : MO.headH;
  const bt = head ? Math.max(4, Math.ceil((head + 2.2) * 2) / 2) : 4, cb = head ? +(head + 0.3).toFixed(2) : 0;
  // 감속: 바닥판 밑에 큰 기어(입력축)와 피니언(모터 축), 그 아래 브래킷에 모터를 매닮. 입력축은 금속 D컷 축
  let red = null;
  if (isRed) { const i = dv.red, m = redModule(dv.Tm), z2 = RED_Z1 * i, gt = RED_GT, hh = MO.headH, tb = Math.max(4, Math.ceil((hh + 2.2) * 2) / 2);
    // 브래킷 윗면은 기어 바로 밑(나사 머리는 브래킷 자리파기에 묻힘). 모터 축 끝이 바닥판에 닿으면 브래킷을 내림
    const zg1 = -0.4, zg0 = zg1 - gt; let zb = zg0 - 0.4, zf = zb - tb;
    if (zf + MO.shaft.len > zg1 - 0.2) { zf = +(zg1 - 0.2 - MO.shaft.len).toFixed(2); zb = zf + tb; }
    red = { i, m, z1: RED_Z1, z2, a: m * (RED_Z1 + z2) / 2, ra1: m * (RED_Z1 / 2 + 1), ra2: m * (z2 / 2 + 1), gt, tb, cb: +(hh + 0.3).toFixed(2), zg0, zg1, zb, zf, hh }; }
  const shBot = !MO ? -10 : red ? red.zf : servo ? MO.servo.top : MO.boss.h, shTop = !MO || red ? Infinity : servo ? MO.servo.top + MO.shaft.len : MO.shaft.len;
  let z1 = servo ? Math.max(bt + 0.6, MO.servo.top + 0.4) : bt + 0.6;
  const raised = isFinite(shTop) && shTop > z1 + t + 0.01; if (raised) z1 = +(shTop - t).toFixed(2);
  const hubR0 = Math.max(w / 2, shD / 2 + 3);
  let hub = null;   // 입력 부품 아래 허브: 모터 돌출부 구멍 속으로 내려가 축을 더 길게 물거나, 올라간 입력 부품을 받침
  if (red) hub = { r: shD / 2 + 3, z0: bt + 0.2 };
  else if (MO && !servo) { const rIn = Math.min(shD / 2 + 3, (MO.boss.d + 0.5) / 2 - 0.4);
    if (rIn >= bore.d / 2 + 0.8) hub = { r: rIn, z0: MO.boss.h + 0.4 }; else if (raised) hub = { r: shD / 2 + 3, z0: bt + 0.4 }; }
  const ext = { lo: [-12, -12], hi: [12, 12] }, grow = (x, y, r = 0) => { ext.lo[0] = Math.min(ext.lo[0], x - r); ext.lo[1] = Math.min(ext.lo[1], y - r); ext.hi[0] = Math.max(ext.hi[0], x + r); ext.hi[1] = Math.max(ext.hi[1], y + r); };
  const wv = rpm * 2 * PI / 60;
  const K = { w, t, pd, cl, free: pd + 0.3, press: pd + 0.05, dv, MO, rpm, servo, red, shD, bore, head, bt, cb, shBot, shTop, z1, z2: z1 + t + cl, raised, hubR0, hub, ext, grow, wv, spl: 0, pins: [] };
  K.zL = k => z1 + k * (t + cl);
  K.thOf = tt => wv * tt; K.period = 60 / Math.max(1e-6, rpm);
  K.flip = XF.basis([1, 0, 0], [0, -1, 0], [0, 0, -1]);
  // 입력 부품의 1층 판: 축 구멍(D컷·스플라인), 서보면 위쪽에 중심 나사 구멍, 허브
  K.driver = (outline, holes = []) => {
    const bH = borePts(bore.d, bore.dcut, 40, bore.dd); let ct;
    if (servo) { K.spl = +Math.max(1, Math.min(t - 1.2, shTop - z1)).toFixed(2);
      ct = moveTris(extrudeTris(outline, [bH, ...holes], K.spl), 0, 0, z1).concat(moveTris(extrudeTris(outline, [circlePts(MO.servo.center / 2 + 0.1, 24), ...holes], t - K.spl), 0, 0, z1 + K.spl)); }
    else ct = moveTris(extrudeTris(outline, [bH, ...holes], t), 0, 0, z1);
    if (hub) ct = ct.concat(moveTris(extrudeTris(circlePts(hub.r, 40), [bH], z1 - hub.z0 + 0.01), 0, 0, hub.z0));
    return ct;
  };
  K.crank = (Rk, name = '크랭크') => {
    const ct = K.driver(capsulePts([0, 0], [Rk, 0], hubR0), [circlePts(K.press / 2, 28, Rk, 0)]);
    model.parts.push({ name, file: `crank_r${fmt(Rk, 2)}`, tris: ct, motion: tt => XF.Rz(K.thOf(tt)), print: hub ? K.flip : undefined });
    grow(0, 0, Rk + w);
  };
  K.pin = (n, z0, z1_, at, own) => { K.pins.push({ n, L: +(z1_ - z0).toFixed(2) }); (model.pinBodies = model.pinBodies || []).push({ name: n, r: pd / 2, z0, z1: z1_, at, own }); };
  // 바닥 고정 피벗에서 도는 부품의 받침: 높으면 기둥(하우징), 낮으면 부품 아래 고리 돌기
  K.pivot = (x, y, zPart, name, file) => {
    const h = zPart - bt - 0.4;
    if (h >= 1) { model.housing.push({ name, file, tris: moveTris(extrudeTris(circlePts(pd / 2 + 3, 32, x, y), [circlePts(K.press / 2, 24, x, y)], h), 0, 0, bt - 0.01) }); return []; }
    return moveTris(extrudeTris(circlePts(pd / 2 + 2.5, 32, x, y), [circlePts(K.free / 2, 24, x, y)], zPart - bt - 0.1 + 0.01), 0, 0, bt + 0.1);
  };
  // 슬라이더 안내 레일 (블록 중심이 xs0~xs1 사이를 움직임), 크랭크 회전 원(cR)을 비켜 시작
  K.rails = (xs0, xs1, e, cR, blockT) => {
    const bl = Math.max(16, w + 8), bw = Math.max(12, w + 4), rw = 4, rx0 = xs0 - bl / 2 - 3, rx1 = xs1 + bl / 2 + 3, rh = blockT - 0.5;
    let short = false, trimmed = false;
    [[e + bw / 2 + 0.3, e + bw / 2 + 0.3 + rw], [e - bw / 2 - 0.3 - rw, e - bw / 2 - 0.3]].forEach(([y0, y1], k) => {
      const near = y0 > 0 ? y0 : y1 < 0 ? -y1 : 0, c = cR + 0.8; let x0 = rx0;
      if (near < c) { const xc = Math.sqrt(c * c - near * near); if (xc > x0) { x0 = xc; trimmed = true; } }
      if (rx1 - x0 < bl) short = true;
      model.housing.push({ name: '안내 레일', file: `rail_${k + 1}`, tris: moveTris(extrudeTris(rectPts(x0, y0, rx1, y1), [], rh), 0, 0, bt - 0.01) }); });
    grow(rx0, e - bw / 2 - rw - 4); grow(rx1, e + bw / 2 + rw + 4);
    if (short) checks.push({ st: 'bad', txt: '안내 레일이 크랭크를 피하느라 슬라이더보다 짧아졌습니다. 연결 막대를 길게 하거나 편심 e를 줄이세요' });
    else if (trimmed) model.notes.push('안내 레일의 크랭크 쪽 끝은 크랭크 회전 원을 피하도록 잘려 있습니다.');
    return rectPts(rx0, e - bw / 2 - rw - 0.5, rx1, e + bw / 2 + rw + 0.5);
  };
  // 모터 고정 자리: zones(레일·피벗 받침 등 바닥판 위 부품 자리)를 피하는 각도
  K.mount = zones => {
    if (!MO) return;
    if (red) return K.mountRed(zones);
    let mt = null;
    const cand = a => {
      if (servo) { const V = MO.servo, pad = 0.25, R = rotPts(rectPts(V.ox - V.bw / 2 - pad, -V.bh / 2 - pad, V.ox + V.bw / 2 + pad, V.bh / 2 + pad), a);
        return { cut: R, holes: rotPts(V.ears, a).map(([x, y]) => ({ x, y, d: V.pilot })), keep: [R] }; }
      const pts = dv.mount === 'clamp' ? [[0, MO.body.r + 6], [0, -(MO.body.r + 6)]] : MO.holes, d = dv.mount === 'clamp' ? 3.4 : MO.screw;
      const hs = rotPts(pts, a).map(([x, y]) => ({ x, y, d, cb: +(d * 1.75 + 0.8).toFixed(1) }));
      return { holes: hs, keep: hs.map(h => circlePts(h.cb / 2 + 0.6, 16, h.x, h.y)) };
    };
    for (let k = 0; k < 24; k++) { const a = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 15 * D2R, c = cand(a), n = c.keep.reduce((s, Kp) => s + zones.filter(Z => convexPen(Kp, Z) > 0).length, 0);
      if (!mt || n < mt.n) mt = { ...c, ang: a, n }; if (!n) break; }
    if (mt.n) checks.push({ st: 'warn', txt: '모터 고정 자리가 바닥판 위 부품(레일·받침) 아래에 걸립니다. 나사를 먼저 조인 뒤 그 부품을 붙이세요' });
    const body = motorBodyTris(MO, 0, 0, 0, mt.ang), under = [body];
    model.extras.push({ tris: body, color: servo ? '#2c3e66' : '#59616a' });
    if (dv.mount === 'clamp') { const ct = xfTris(clampTris(MO, false), XF.Rz(mt.ang)); under.push(ct);
      model.housing.push({ name: '모터 클램프', file: `motor_clamp_${MO.short.replace(/\W+/g, '')}`, tris: ct, print: K.flip }); }
    if (servo) model.clashFixed.push({ name: '서보 몸통', h: mt.cut, z: [MO.servo.top - MO.servo.L, MO.servo.top] });
    under.forEach(T => trisXY(T).forEach(([x, y]) => grow(x, y, 10)));
    mt.holes.forEach(h => grow(h.x, h.y, (h.cb || h.d) / 2 + 3));
    mt.drop = -Math.min(...under.map(T => trisZ(T)[0]));
    K.mt = mt;
  };
  K.mountRed = zones => {
    const R = red, sd = D.sd, obs = model.rods.filter(r => r.role === 'output' && Math.min(r.a[2], r.b[2]) < 0).map(r => [r.a[0], r.a[1], r.d / 2 + 1.5]);
    const bodyL = trisXY(motorBodyTris(MO, 0, 0, 0, 0)), pR = 4, inset = 4.5;
    let best = null;
    for (let k = 0; k < 24; k++) {
      const phi = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 15 * D2R, psi = phi + PI / 2, c = Math.cos(phi), sn = Math.sin(phi), mx = R.a * c, my = R.a * sn;
      const toW = ([u, v]) => [u * c - v * sn, u * sn + v * c], toUV = ([x, y]) => [x * c + y * sn, -x * sn + y * c];
      const foot = rotPts(bodyL, psi, mx, my).concat(...rotPts(MO.holes, psi, mx, my).map(([x, y]) => circlePts(MO.screw / 2 + 2.5, 12, x, y)), circlePts(sd / 2 + 4, 16), circlePts(MO.boss.d / 2 + 2, 16, mx, my));
      const uv = foot.map(toUV); let u0 = Math.min(...uv.map(p => p[0])) - 3, u1 = Math.max(...uv.map(p => p[0])) + 3, v0 = Math.min(...uv.map(p => p[1])) - 3, v1 = Math.max(...uv.map(p => p[1])) + 3;
      let posts;
      for (let g = 0; g < 30; g++) {
        posts = [[u0 + inset, v0 + inset], [u1 - inset, v0 + inset], [u1 - inset, v1 - inset], [u0 + inset, v1 - inset]];
        const bad = posts.map(([u, v]) => Math.hypot(u, v) < R.ra2 + 1.2 + pR || Math.hypot(u - R.a, v) < R.ra1 + 1.2 + pR || foot.some(q => { const w2 = toUV(q); return Math.hypot(w2[0] - u, w2[1] - v) < pR + 0.3; }));
        if (!bad.some(Boolean)) break;
        if (bad[0] || bad[3]) u0 -= 2; if (bad[1] || bad[2]) u1 += 2; if (bad[0] || bad[1]) v0 -= 2; if (bad[2] || bad[3]) v1 += 2;
      }
      const rect = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(toW), pw = posts.map(toW);
      const keep = pw.map(([x, y]) => circlePts(6.75 / 2 + 0.6, 16, x, y));
      const n = keep.reduce((sum, Kp) => sum + zones.filter(Z => convexPen(Kp, Z) > 0).length, 0)
        + 10 * obs.filter(([x, y, r]) => pointInPoly(x, y, rect) || segDist(x, y, rect) < r || Math.hypot(x, y) < R.ra2 + r + 1 || Math.hypot(x - mx, y - my) < R.ra1 + r + 1).length;
      if (!best || n < best.n) best = { n, phi, psi, mx, my, rect, pw }; if (!n) break;
    }
    if (best.n >= 10) checks.push({ st: 'bad', txt: '감속 기어·브래킷이 바닥판 밑으로 나온 출력축에 걸립니다. 치수를 바꾸거나 감속을 끄세요' });
    else if (best.n) checks.push({ st: 'warn', txt: '브래킷 고정 나사 자리가 바닥판 위 부품(레일·받침) 아래에 걸립니다. 나사를 먼저 조인 뒤 그 부품을 붙이세요' });
    const { mx, my, psi, rect, pw } = best, i = R.i;
    Object.assign(R, { mx, my, phi: best.phi, psi });
    // 브래킷: 판(모터 앞면이 밑면에 닿음) + 기둥 4개(위에서 M3 나사로 바닥판에)
    const mh = rotPts(MO.holes, psi, mx, my);
    const bh = [circlePts((sd + 0.3) / 2, 32), circlePts((MO.boss.d + 0.5) / 2, 40, mx, my)], scb = +(MO.screw * 1.75 + 0.8).toFixed(1);
    let br = moveTris(extrudeTris(rect, bh.concat(mh.map(([x, y]) => circlePts(MO.screw / 2, 20, x, y))), R.tb - R.cb + 0.01), 0, 0, R.zf)
      .concat(moveTris(extrudeTris(rect, bh.concat(mh.map(([x, y]) => circlePts(scb / 2, 24, x, y))), R.cb), 0, 0, R.zb - R.cb));
    pw.forEach(([x, y]) => { br = br.concat(moveTris(extrudeTris(circlePts(pR, 32, x, y), [circlePts(1.3, 20, x, y)], -R.zb + 0.01), 0, 0, R.zb - 0.01)); });
    model.housing.push({ name: '모터 브래킷', file: `motor_bracket_${MO.short.replace(/\W+/g, '')}`, tris: br, noClash: true });
    pw.forEach(([x, y], k) => model.clashFixed.push({ name: `브래킷 기둥 ${k + 1}`, h: circlePts(pR, 16, x, y), z: [R.zb, 0] }));
    model.extras.push({ tris: motorBodyTris(MO, mx, my, R.zf, psi), color: '#59616a' });
    // 기어: 큰 기어는 입력축(원점), 피니언은 모터 축. 물림 위상은 차동 기어와 같은 규칙
    const gr = z => ({ m: R.m, z, pa: 20, x: 0, backlash: 0.15 }), ol = (z, ph, res = 6) => rotPts(gearOutline(gr(z), res).pts, ph);
    const f0 = best.phi + PI + PI / R.z1 - (R.z2 / R.z1) * (0 - best.phi);
    const mb = { d: +(MO.shaft.d + 0.15).toFixed(2), dcut: MO.shaft.dcut ? +(MO.shaft.dcut - 0.05).toFixed(2) : 0, dd: !!MO.shaft.dd };
    // 피니언 아래 허브: 기어 밑 공간으로, 굵기가 되면 브래킷의 돌출부 구멍 속까지 내려가 짧은 모터 축도 깊게 물림
    const sTop = R.zf + MO.shaft.len, rIn = Math.min(MO.shaft.d / 2 + 3, (MO.boss.d + 0.5) / 2 - 0.4), deep = rIn >= mb.d / 2 + 0.8;
    const hubR = deep ? rIn : MO.shaft.d / 2 + 3, hubBot = deep ? R.zf + MO.boss.h + 0.4 : R.zb + 0.4;
    let pt = moveTris(extrudeTris(ol(R.z1, f0), [borePts(mb.d, mb.dcut, 32, mb.dd)], R.gt), 0, 0, R.zg0);
    if (R.zg0 - hubBot > 0.5) pt = pt.concat(moveTris(extrudeTris(circlePts(hubR, 32), [borePts(mb.d, mb.dcut, 32, mb.dd)], R.zg0 - hubBot + 0.01), 0, 0, hubBot));
    R.pinBot = Math.min(R.zg0, hubBot);
    R.eng = Math.min(sTop, R.zg1) - Math.max(R.pinBot, R.zf + MO.boss.h);
    model.parts.push({ name: '감속 큰 기어', file: `red_gear_z${R.z2}_m${R.m}`, tris: moveTris(extrudeTris(ol(R.z2, 0), [borePts(bore.d, bore.dcut, 32)], R.gt), 0, 0, R.zg0),
      motion: tt => XF.Rz(K.thOf(tt)), own: ['감속 피니언'], clash: [{ h: ol(R.z2, 0, 3), z: [R.zg0, R.zg1], cc: true }] });
    model.parts.push({ name: '감속 피니언', file: `red_pinion_z${R.z1}_m${R.m}`, tris: pt, print: R.zg0 - hubBot > 0.5 ? K.flip : undefined,
      motion: tt => XF.mul(XF.T(mx, my, 0), XF.Rz(-i * K.thOf(tt))), own: ['감속 큰 기어'], clash: [{ h: ol(R.z1, f0, 3), z: [R.pinBot, R.zg1], cc: true }] });
    model.rods.push({ a: [mx, my, R.zf], b: [mx, my, sTop], d: MO.shaft.d, role: 'input' });
    if (sTop > R.zg1 + 0.2) model.plateHoles.push([mx, my, MO.shaft.d + 1]);
    rect.forEach(([x, y]) => grow(x, y, 2));
    K.mt = { holes: pw.map(([x, y]) => ({ x, y, d: 3.4, cb: 6.75 })), drop: -R.zf + MO.body.L, ang: psi };
  };
  return K;
}
const rigidM = (A0, B0, A, B) => { const a0 = Math.atan2(B0[1] - A0[1], B0[0] - A0[0]), a1 = Math.atan2(B[1] - A[1], B[0] - A[0]);
  return XF.mul(XF.T(A[0], A[1], 0), XF.mul(XF.Rz(a1 - a0), XF.T(-A0[0], -A0[1], 0))); };
const rotAbout = (x, y, a) => XF.mul(XF.T(x, y, 0), XF.mul(XF.Rz(a), XF.T(-x, -y, 0)));
const linkTbl = (rows, head = ['부품', '길이·크기', '폭×두께', '구멍']) => ({ head, rows: rows.map((cells, i) => ({ part: cells.part ?? i, cells: cells.c || cells })) });
const boreTxt = K => `축 ${fmt(K.bore.d, 2)}${K.bore.dcut ? ' D컷' : K.servo ? ' 스플라인' : ''}`;

// ---- 크랭크·슬라이더
function lkSlider(D, model, K, M) {
  const { w, t, z1, z2, bt, free, press, checks } = { ...K, checks: model.checks }, { r, L, e } = D.slider, P0 = linkPose(D, 0) || { A: [r, 0], B: [r + L, e] };
  const poseAt = tt => linkPose(D, K.thOf(tt)) || P0;
  K.crank(r);
  model.parts.push({ name: '연결 막대', file: `rod_L${L}`, tris: moveTris(linkBar(P0.A, P0.B, w, [[...P0.A, free], [...P0.B, free]], t), 0, 0, z2), motion: tt => rigidM(P0.A, P0.B, poseAt(tt).A, poseAt(tt).B) });
  const bl = Math.max(16, w + 8), bw = Math.max(12, w + 4), xs = M.ok ? [M.min, M.max] : [P0.B[0], P0.B[0]], blockT = z2 - K.cl - bt - 0.4;
  model.parts.push({ name: '슬라이더', file: `slider_${bl}x${bw}`, tris: moveTris(extrudeTris(rectPts(P0.B[0] - bl / 2, e - bw / 2, P0.B[0] + bl / 2, e + bw / 2), [circlePts(press / 2, 28, P0.B[0], e)], blockT), 0, 0, bt + 0.4),
    motion: tt => XF.T(poseAt(tt).B[0] - P0.B[0], 0, 0) });
  const zone = K.rails(xs[0], xs[1], e, r + K.hubR0, blockT);
  K.pin('크랭크–막대 핀', z1, z2 + t, tt => poseAt(tt).A, ['크랭크', '연결 막대']);
  K.pin('막대–슬라이더 핀', bt + 0.4, z2 + t, tt => poseAt(tt).B, ['연결 막대', '슬라이더']);
  if (M.ok) {
    const vmax = Math.max(...M.v.map(Math.abs)) * K.wv, amax = Math.max(...M.a.map(Math.abs)) * K.wv * K.wv;
    checks.unshift({ st: 'ok', txt: `행정 <em>${fmt(M.range, 2)} mm</em> · 급속귀환비 <em>${fmt(M.Q, 2)}</em> · 최대 속도 <em>${fmt(vmax, 0)} mm/s</em> · 최대 가속도 <em>${fmt(amax / 1000, 2)} m/s²</em>` });
    const phiMax = 90 - M.muMin;
    checks.push({ st: phiMax <= 30 ? 'ok' : phiMax <= 45 ? 'warn' : 'bad', txt: `연결 막대 최대 기울기(압력각) <em>${fmt(phiMax, 1)}°</em>${phiMax > 30 ? ' (30° 이하 권장: 막대를 길게 하세요)' : ''}` });
    if (L / r < 3) checks.push({ st: 'warn', txt: `막대/크랭크 비 ${fmt(L / r, 2)} — 3 이상이면 슬라이더 옆힘이 줄고 부드럽습니다` });
    model.hud = [['크랭크', fmt(K.rpm, 1) + ' rpm'], ['행정', fmt(M.range, 2) + ' mm'], ['급속귀환비', fmt(M.Q, 2)], ['최대 압력각', fmt(phiMax, 1) + '°']];
  }
  model.table = linkTbl([['크랭크', `r = ${r} mm`, `${w}×${t}`, `${boreTxt(K)} · 핀 ${fmt(press, 2)}`], ['연결 막대', `L = ${L} mm`, `${w}×${t}`, `핀 ${fmt(free, 2)} ×2`], ['슬라이더', `${bl}×${bw} mm`, `높이 ${fmt(blockT, 1)}`, `핀 ${fmt(press, 2)} · 편심 e = ${e}`]]);
  model.asm = ['안내 레일 두 개를 바닥판의 슬라이더 길 양옆에 붙입니다. 슬라이더를 끼워 손으로 밀어 걸림 없이 미끄러지는지 확인합니다.'];
  model.glue = '안내 레일을 바닥판에 붙임';
  return [zone];
}
// ---- 스카치 요크: 크랭크 핀이 요크의 세로 홈을 밀어 요크가 정확한 사인 운동으로 왕복
function lkYoke(D, model, K, M) {
  const { w, t, z1, z2, bt, free, press, pd } = K, checks = model.checks, r = D.yoke.r;
  K.crank(r);
  const ws = pd + 0.3, fw = 4, sx = ws / 2, sy = r + ws / 2 + 0.6, ox = sx + fw, oy = sy + fw, bl = Math.max(16, w + 8), bw = Math.max(12, w + 4);
  const Lr = +Math.max(ox + 8, 2 * r + K.hubR0 + bl / 2 + 2).toFixed(2), xe = Lr + bl / 2;
  const out = [[-ox, -oy], [ox, -oy], [ox, -w / 2], [xe, -w / 2], [xe, w / 2], [ox, w / 2], [ox, oy], [-ox, oy]].map(([x, y]) => [x + r, y]);
  const slot = rectPts(r - sx, -sy, r + sx, sy), blockT = z2 - bt - 0.4;
  const yk = moveTris(extrudeTris(out, [slot], t), 0, 0, z2).concat(moveTris(extrudeTris(rectPts(r + Lr - bl / 2, -bw / 2, r + Lr + bl / 2, bw / 2), [], blockT + 0.01), 0, 0, bt + 0.4));
  model.parts.push({ name: '요크', file: `yoke_r${r}`, tris: yk, print: K.flip, motion: tt => XF.T(r * Math.cos(K.thOf(tt)) - r, 0, 0),
    clash: [{ h: hull2(out), z: [z2, z2 + t] }, { h: rectPts(r + Lr - bl / 2, -bw / 2, r + Lr + bl / 2, bw / 2), z: [bt + 0.4, z2] }] });
  K.grow(r + xe, oy); K.grow(-r - ox, -oy);
  const zone = K.rails(Lr - r, Lr + r, 0, r + K.hubR0, blockT);
  K.pin('크랭크 핀', z1, z2 + t, tt => [r * Math.cos(K.thOf(tt)), r * Math.sin(K.thOf(tt))], ['크랭크', '요크']);
  const vmax = r * K.wv, amax = r * K.wv * K.wv;
  checks.unshift({ st: 'ok', txt: `행정 <em>${fmt(2 * r, 2)} mm</em> (정확한 사인 운동, 급속귀환 없음) · 최대 속도 <em>${fmt(vmax, 0)} mm/s</em> · 최대 가속도 <em>${fmt(amax / 1000, 2)} m/s²</em>` });
  checks.push({ st: 'ok', txt: `요크 홈 폭 <em>${fmt(ws, 2)} mm</em> (핀 ${pd} + 0.3) · 홈 길이 <em>${fmt(2 * sy, 1)} mm</em>. 핀이 홈 안에서 미끄러지니 홈에 그리스를 바르세요` });
  model.hud = [['크랭크', fmt(K.rpm, 1) + ' rpm'], ['행정', fmt(2 * r, 1) + ' mm'], ['최대 속도', fmt(vmax, 0) + ' mm/s']];
  model.table = linkTbl([['크랭크', `r = ${r} mm`, `${w}×${t}`, `${boreTxt(K)} · 핀 ${fmt(press, 2)}`], ['요크', `홈 ${fmt(ws, 2)}×${fmt(2 * sy, 1)} · 팔 ${fmt(Lr, 1)} mm`, `${w}×${t}`, `안내 블록 ${bl}×${bw}`]]);
  model.asm = ['안내 레일 두 개를 바닥판에 붙이고, 요크의 안내 블록을 레일 사이에 넣습니다.', '크랭크 핀을 요크 홈에 끼웁니다.'];
  model.glue = '안내 레일을 바닥판에 붙임';
  return [zone];
}
// ---- 4절 링크
function lkFourbar(D, model, K, M) {
  const { w, t, z1, z2, bt, free, press, pd, cl } = K, checks = model.checks, { a, c, d, p = 0, q = 0 } = D.fourbar, O4 = [a, 0], g = grashof(D.fourbar);
  const P0 = linkPose(D, 0) || { A: [D.fourbar.b, 0], B: [a, d], O4, P: [0, 0] }, poseAt = tt => linkPose(D, K.thOf(tt)) || P0;
  K.crank(D.fourbar.b);
  checks.push({ st: g.ok && (g.type === 'crank-rocker' || g.type === 'double-crank') ? 'ok' : 'bad', txt: `그라쇼프 판별: <em>${g.ko}</em>${g.type === 'crank-rocker' || g.type === 'double-crank' ? '' : ' · 가장 짧은 링크를 크랭크(b)로 두고 s + l ≤ p + q 가 되게 하세요'}` });
  const hasP = Math.abs(p) > 0.01 || Math.abs(q) > 0.01, cName = hasP ? '커플러 (삼각판)' : '커플러';
  let rockZ = z1;
  if (M.ok) {
    let minD = Infinity; for (let i = 0; i < 180; i++) { const ps = linkPose(D, 2 * PI * i / 180); if (ps) minD = Math.min(minD, segSegDist([0, 0], ps.A, O4, ps.B) - (K.hubR0 - w / 2)); }
    if (minD < w + 1) rockZ = z2 + t + cl;
    model.rockerLayer = rockZ === z1 ? 1 : 3;
  }
  const cpl = hasP ? extrudeTris(hull2([...capsulePts(P0.A, P0.B, w / 2), ...circlePts(w / 2, 24, ...P0.P)]), [circlePts(free / 2, 28, ...P0.A), circlePts(free / 2, 28, ...P0.B), circlePts(free / 2, 28, ...P0.P)], t)
    : linkBar(P0.A, P0.B, w, [[...P0.A, free], [...P0.B, free]], t);
  model.parts.push({ name: cName, file: `coupler_c${c}`, tris: moveTris(cpl, 0, 0, z2), motion: tt => rigidM(P0.A, P0.B, poseAt(tt).A, poseAt(tt).B) });
  const psi0 = Math.atan2(P0.B[1], P0.B[0] - a);
  model.parts.push({ name: '흔들이', file: `rocker_d${d}`, tris: moveTris(linkBar(O4, P0.B, w, [[...O4, free], [...P0.B, press]], t), 0, 0, rockZ), motion: tt => rotAbout(a, 0, poseAt(tt).psi - psi0) });
  const postH = rockZ - bt - 0.4;
  if (postH >= 1) model.housing.push({ name: '흔들이 피벗 받침', file: `pivot_post_h${fmt(postH, 1)}`, tris: moveTris(extrudeTris(circlePts(pd / 2 + 3, 32, ...O4), [circlePts(press / 2, 24, ...O4)], postH), 0, 0, bt - 0.01) });
  model.plateHoles.push([...O4, press]);
  if (rockZ > z1 && M.ok) {
    let md = Infinity; for (let i = 0; i < 180; i++) { const ps = linkPose(D, 2 * PI * i / 180); if (ps) md = Math.min(md, segSegDist(ps.A, ps.B, O4, O4)); }
    const ok = md >= w / 2 + pd / 2 + 3 + 0.5;
    checks.push({ st: ok ? 'warn' : 'bad', txt: ok ? '크랭크와 흔들이가 같은 높이에서 부딪혀 흔들이를 위층(3층)으로 올렸습니다' : '크랭크와 흔들이가 부딪히고, 위층으로 올리면 커플러가 피벗 기둥에 닿습니다. 길이를 바꿔 보세요' });
  }
  K.grow(...O4, d + w);
  K.pin('크랭크–커플러 핀', z1, z2 + t, tt => poseAt(tt).A, ['크랭크', cName]);
  K.pin('커플러–흔들이 핀', Math.min(z2, rockZ), Math.max(z2, rockZ) + t, tt => poseAt(tt).B, [cName, '흔들이']);
  K.pin('흔들이 피벗 핀', 0, rockZ + t, () => O4, ['흔들이', '흔들이 피벗 받침']);
  if (M.ok) {
    M.P.forEach(P => K.grow(P[0], P[1], 2));
    const wmax = Math.max(...M.v.map(Math.abs)) * K.wv;
    if (M.full) checks.unshift({ st: 'ok', txt: `출력 링크도 한 바퀴 돕니다 (이중 크랭크) · 속도 변동 <em>±${fmt(M.range / 2, 1)}°</em>` });
    else checks.unshift({ st: 'ok', txt: `흔들림 각 <em>${fmt(M.range, 1)}°</em> · 급속귀환비 <em>${fmt(M.Q, 2)}</em> · 흔들이 최대 각속도 <em>${fmt(wmax, 0)}°/s</em>` });
    checks.push({ st: M.muMin >= 40 && M.muMax <= 140 ? 'ok' : M.muMin >= 30 && M.muMax <= 150 ? 'warn' : 'bad', txt: `전달각 <em>${fmt(M.muMin, 1)}° ~ ${fmt(M.muMax, 1)}°</em> (40°~140° 권장)` });
    if (hasP) { model.extras.push({ line: M.P.map(P => [P[0], P[1], z2 + t + 0.3]), color: '#c0392b' }); model.notes.push('커플러 위의 점 P가 그리는 곡선(빨간 선)을 따라 움직입니다. P 구멍에 펜이나 핀을 꽂아 쓰세요.'); }
    model.hud = [['크랭크', fmt(K.rpm, 1) + ' rpm'], M.full ? ['출력', '한 바퀴 회전'] : ['흔들림 각', fmt(M.range, 1) + '°'], ['급속귀환비', M.full ? '–' : fmt(M.Q, 2)], ['전달각', `${fmt(M.muMin, 0)}~${fmt(M.muMax, 0)}°`]];
  }
  model.table = linkTbl([['크랭크 b', `${D.fourbar.b} mm`, `${w}×${t}`, `${boreTxt(K)} · 핀 ${fmt(press, 2)}`], ['커플러 c', `${c} mm${hasP ? ` · 점 P (${p}, ${q})` : ''}`, `${w}×${t}`, `핀 ${fmt(free, 2)}`],
    ['흔들이 d', `${d} mm`, `${w}×${t}`, `피벗 ${fmt(free, 2)} · 핀 ${fmt(press, 2)}`], { part: -1, c: ['고정 링크 a', `${a} mm`, '바닥판', `피벗 ${pd}`] }]);
  model.asm = [model.housing.some(h => h.name === '흔들이 피벗 받침') ? '흔들이 피벗 받침을 바닥판의 피벗 구멍 위에 붙입니다.' : '흔들이 피벗 핀을 바닥판 피벗 구멍에 눌러 끼웁니다.'];
  model.glue = model.housing.some(h => h.name === '흔들이 피벗 받침') ? '피벗 받침을 바닥판에 붙임' : '';
  return [circlePts(pd / 2 + 4, 24, ...O4)];
}
// ---- 얀센 링크: 크랭크 하나로 다리 끝(F)이 납작한 바닥 구간을 가진 보행 궤적을 그림. 링크가 많아 서로 겹치지 않게 층을 자동 배치
function lkJansen(D, model, K, M) {
  const { w, t, bt, free, press, pd, cl } = K, checks = model.checks, s = D.jansen.m / 15, L = k => JANSEN[k] * s;
  const P0 = linkPose(D, 0); if (!P0) { checks.push({ st: 'bad', txt: '얀센 링크를 조립할 수 없습니다' }); K.crank(L('m')); return []; }
  const poseAt = tt => linkPose(D, K.thOf(tt)) || P0;
  // 부품: [이름, 파일, 점 키들, 움직임 기준 두 점, 구멍 맞춤(press 인덱스)]
  const specs = [
    { n: '링크 j', s: 'j', f: 'link_j', k: ['A', 'B'], press: 'B' },
    { n: '링크 k', s: 'k', f: 'link_k', k: ['A', 'C'], press: '' },
    { n: '삼각판 bde', s: 'bde', f: 'tri_bde', k: ['Z', 'B', 'Dp'], press: 'Dp' },
    { n: '링크 c', s: 'c', f: 'link_c', k: ['Z', 'C'], press: 'C' },
    { n: '링크 f', s: 'f', f: 'link_f', k: ['Dp', 'E'], press: 'E' },
    { n: '다리 (삼각판 ghi)', s: '다리', f: 'foot_ghi', k: ['C', 'E', 'F'], press: '' }];
  const shape = sp => { const P = sp.k.map(k => P0[k]); return P.length === 2 ? capsulePts(P[0], P[1], w / 2) : hull2(P.flatMap(p => circlePts(w / 2, 20, ...p))); };
  const mot = sp => tt => { const ps = poseAt(tt); return rigidM(P0[sp.k[0]], P0[sp.k[1]], ps[sp.k[0]], ps[sp.k[1]]); };
  const crankShape = capsulePts([0, 0], P0.A, K.hubR0);
  // 층 배치: 72자리에서 부품끼리, 이음 핀과 부품이 겹치는지 미리 계산
  const N = 72, frames = Array.from({ length: N }, (_, i) => linkPose(D, 2 * PI * i / N)).filter(Boolean);
  const all = [{ n: '크랭크', k: ['O', 'A'] }].concat(specs), shp = [crankShape].concat(specs.map(shape));
  const at = (ps, sp, P) => { const X = sp.n === '크랭크' ? XF.Rz(Math.atan2(ps.A[1], ps.A[0]) - Math.atan2(P0.A[1], P0.A[0])) : rigidM(P0[sp.k[0]], P0[sp.k[1]], ps[sp.k[0]], ps[sp.k[1]]); return P.map(p => [X[0] * p[0] + X[1] * p[1] + X[3], X[4] * p[0] + X[5] * p[1] + X[7]]); };
  const coll = all.map(() => all.map(() => false));
  const joints = [{ k: 'A', o: [0, 1, 2] }, { k: 'B', o: [1, 3] }, { k: 'Z', o: [3, 4], fixed: true }, { k: 'C', o: [2, 4, 6] }, { k: 'Dp', o: [3, 5] }, { k: 'E', o: [5, 6] }];
  const pinHit = joints.map(() => all.map(() => false));
  for (const ps of frames) {
    const H = all.map((sp, i) => at(ps, sp, shp[i]));
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (!coll[i][j] && convexPen(H[i], H[j]) > -0.4) coll[i][j] = coll[j][i] = true;
    joints.forEach((jt, a) => { const c = circlePts(jt.fixed ? pd / 2 + 3.5 : pd / 2 + 0.6, 12, ...ps[jt.k]); all.forEach((sp, i) => { if (!jt.o.includes(i) && !pinHit[a][i] && convexPen(c, H[i]) > 0) pinHit[a][i] = true; }); });
  }
  let best = null; const lay = [0, 0, 0, 0, 0, 0, 0], NL = 6;
  const rec = i => {
    if (i === all.length) {
      for (let a = 0; a < joints.length; a++) { const jt = joints[a], ls = jt.o.map(o => lay[o]), lo = jt.fixed ? -1 : Math.min(...ls), hi = Math.max(...ls);
        for (let p = 0; p < all.length; p++) if (pinHit[a][p] && lay[p] >= lo && lay[p] <= hi) return; }
      const sc = Math.max(...lay) * 100 + lay.reduce((x, y) => x + y, 0); if (!best || sc < best.sc) best = { sc, lay: lay.slice() }; return; }
    for (let l = 0; l < NL; l++) { let ok = true; for (let j = 0; j < i; j++) if (coll[i][j] && lay[j] === l) { ok = false; break; } if (!ok) continue; lay[i] = l; rec(i + 1); }
  };
  rec(1);
  const LY = best ? best.lay : [0, 1, 2, 3, 4, 5, 6];
  if (!best) checks.push({ st: 'bad', txt: '링크가 서로 겹치지 않는 층 배치를 찾지 못했습니다' });
  K.crank(L('m'));
  specs.forEach((sp, i) => {
    const z = K.zL(LY[i + 1]), holes = sp.k.map(k => circlePts((k === sp.press ? press : k === 'F' ? 2.5 : free) / 2, 24, ...P0[k]));
    let tris = moveTris(extrudeTris(shape(sp), holes, t), 0, 0, z);
    if (sp.k.includes('Z') && LY[i + 1] === Math.min(LY[3], LY[4])) tris = tris.concat(K.pivot(...P0.Z, z, '고정 피벗 받침', 'pivot_post_Z'));
    model.parts.push({ name: sp.n, file: sp.f, tris, motion: mot(sp) });
  });
  model.plateHoles.push([...P0.Z, press]);
  const zTop = k => K.zL(k) + t;
  joints.forEach(jt => { const ls = jt.o.map(o => LY[o]), lo = Math.min(...ls), hi = Math.max(...ls);
    K.pin(`${jt.k === 'Dp' ? 'D' : jt.k} 핀`, jt.fixed ? 0 : K.zL(lo), zTop(hi), jt.fixed ? () => P0.Z : tt => poseAt(tt)[jt.k], jt.o.map(o => all[o].n).concat(jt.fixed ? ['고정 피벗 받침'] : [])); });
  model.layers = LY;
  if (M.ok) {
    const ys = M.P.map(p => p[1]), y0 = Math.min(...ys), yr = Math.max(...ys) - y0, ground = M.P.filter(p => p[1] < y0 + yr * 0.04), stride = Math.max(...ground.map(p => p[0])) - Math.min(...ground.map(p => p[0]));
    const gFrac = M.P.filter(p => p[1] < y0 + yr * 0.04).length / M.P.length;
    M.P.forEach(P => K.grow(P[0], P[1], w));
    frames.forEach(ps => ['B', 'C', 'Dp', 'E'].forEach(k => K.grow(ps[k][0], ps[k][1], w)));
    model.extras.push({ line: M.P.map(P => [P[0], P[1], zTop(Math.max(...LY)) + 0.3]), color: '#c0392b' });
    checks.unshift({ st: 'ok', txt: `다리 끝 궤적: 보폭 <em>${fmt(stride, 1)} mm</em> · 들어올림 <em>${fmt(yr, 1)} mm</em> · 땅에 닿는 구간 <em>${fmt(gFrac * 100, 0)}%</em> (크랭크 각)` });
    model.hud = [['크랭크', fmt(K.rpm, 1) + ' rpm'], ['보폭', fmt(stride, 1) + ' mm'], ['들어올림', fmt(yr, 1) + ' mm'], ['층 수', String(Math.max(...LY) + 1)]];
  }
  checks.push({ st: 'ok', txt: `링크를 <em>${Math.max(...LY) + 1}층</em>으로 나눠 서로 지나가게 했습니다 (${LY.slice(1).map((l, i) => `${specs[i].s} ${l + 1}층`).join(', ')})` });
  model.notes.push('빨간 선은 다리 끝(F)의 궤적입니다. 실제 걷는 기계는 이 다리를 크랭크 하나에 120°씩 어긋나게 3쌍(좌우 대칭) 달고, 바닥판을 세워 씁니다.');
  model.table = linkTbl([['크랭크 m', `${fmt(L('m'), 1)} mm`, `${w}×${t}`, `${boreTxt(K)} · 핀 ${fmt(press, 2)}`]].concat(specs.map((sp, i) => [sp.n, sp.k.length === 2 ? `${fmt(Math.hypot(P0[sp.k[1]][0] - P0[sp.k[0]][0], P0[sp.k[1]][1] - P0[sp.k[0]][1]), 1)} mm` : sp.k.map((k, j) => fmt(Math.hypot(P0[sp.k[(j + 1) % 3]][0] - P0[k][0], P0[sp.k[(j + 1) % 3]][1] - P0[k][1]), 1)).join(' / ') + ' mm', `${w}×${t} · ${LY[i + 1] + 1}층`, sp.press ? `핀 ${fmt(press, 2)} 하나, 나머지 ${fmt(free, 2)}` : `핀 ${fmt(free, 2)}`]))
    .concat([{ part: -1, c: ['고정점 Z', `(${fmt(P0.Z[0], 1)}, ${fmt(P0.Z[1], 1)})`, '바닥판', `피벗 ${pd}`] }]));
  model.asm = ['고정 피벗 핀(Z)을 바닥판 구멍에 눌러 끼우고, 층 번호가 낮은 링크부터 끼워 올립니다 (부품 표의 층).'];
  return [circlePts(pd / 2 + 4, 24, ...P0.Z)];
}
// ---- 제네바 기구: 구동판이 한 바퀴 돌 때 바퀴가 360/n° 돌고 나머지 동안 잠금 원판에 물려 멈춤
function genevaWheel(G) {
  const n = G.n, out = [], Rc = G.Rl + 0.4, ws = G.ws, Rw = G.Rw, cg = Math.min(1, (G.C * G.C + Rw * Rw - Rc * Rc) / (2 * G.C * Rw)), gam = Math.acos(cg);
  const arc = (r, a0, a1, k = 6) => { for (let i = 0; i <= k; i++) { const a = a0 + (a1 - a0) * i / k; out.push([r * Math.cos(a), r * Math.sin(a)]); } };
  for (let k = 0; k < n; k++) {
    const s = PI + k * 2 * PI / n, s1 = s + 2 * PI / n, mu = s + PI / n;
    arc(Rw, s + G.half, mu - gam, 3);
    const Q = [G.C * Math.cos(mu), G.C * Math.sin(mu)], P1 = [Rw * Math.cos(mu - gam), Rw * Math.sin(mu - gam)], P2 = [Rw * Math.cos(mu + gam), Rw * Math.sin(mu + gam)];
    let v1 = Math.atan2(P1[1] - Q[1], P1[0] - Q[0]), v2 = Math.atan2(P2[1] - Q[1], P2[0] - Q[0]);
    const mid = mu + PI; while (v1 - mid > PI) v1 -= 2 * PI; while (v1 - mid < -PI) v1 += 2 * PI; while (v2 - mid > PI) v2 -= 2 * PI; while (v2 - mid < -PI) v2 += 2 * PI;
    for (let i = 1; i < 16; i++) { const v = v1 + (v2 - v1) * i / 16; out.push([Q[0] + Rc * Math.cos(v), Q[1] + Rc * Math.sin(v)]); }
    arc(Rw, mu + gam, s1 - G.half, 3);
    // 다음 홈: 오른쪽 벽(바깥→안), 둥근 바닥, 왼쪽 벽(안→바깥)
    const u = [Math.cos(s1), Math.sin(s1)], nn = [-u[1], u[0]], along = Math.sqrt(Rw * Rw - (ws / 2) ** 2);
    const pt = (al, pe) => [u[0] * al + nn[0] * pe, u[1] * al + nn[1] * pe];
    out.push(pt(along, -ws / 2), pt(G.rb, -ws / 2));
    for (let i = 1; i < 10; i++) { const a = -PI / 2 - PI * i / 10; out.push(pt(G.rb + ws / 2 * Math.cos(a), ws / 2 * Math.sin(a))); }
    out.push(pt(G.rb, ws / 2), pt(along, ws / 2));
  }
  return out;
}
function genevaDisk(G) {   // 잠금 원판(오목한 따냄: 바퀴가 도는 동안 바퀴 끝이 지나감)
  const Rl = G.Rl, Rc = G.Rw + 0.5, C = G.C, xi = (Rl * Rl - Rc * Rc + C * C) / (2 * C), yi = Math.sqrt(Math.max(0, Rl * Rl - xi * xi)), fi = Math.atan2(yi, xi), out = [];
  for (let i = 0; i <= 48; i++) { const a = fi + (2 * PI - 2 * fi) * i / 48; out.push([Rl * Math.cos(a), Rl * Math.sin(a)]); }
  const dl = PI - Math.atan2(yi, xi - C);   // 따냄 원 위에서 아래 교점 → 가장 왼쪽 → 위 교점
  for (let i = 1; i < 16; i++) { const a = PI + dl - 2 * dl * i / 16; out.push([C + Rc * Math.cos(a), Rc * Math.sin(a)]); }
  return out;
}
function lkGeneva(D, model, K, M) {
  const { w, t, z1, z2, bt, free, press, pd } = K, checks = model.checks, G = genevaGeo(D);
  const disk = genevaDisk(G), rn = Math.min(G.Rl, G.C - G.Rw - 0.8), armR = Math.max(w / 2, pd / 2 + 3), cen = K.servo ? [circlePts(K.MO.servo.center / 2 + 0.1, 24)] : [];
  let dr = K.driver(disk).concat(moveTris(extrudeTris(circlePts(rn, 40), cen, z2 - z1 - t + 0.02), 0, 0, z1 + t - 0.01),
    moveTris(extrudeTris(capsulePts([0, 0], [G.a, 0], armR), [circlePts(press / 2, 28, G.a, 0), ...cen], t), 0, 0, z2));
  model.parts.push({ name: '구동판', file: `geneva_driver_a${G.a}`, tris: dr, motion: tt => XF.Rz(K.thOf(tt)), print: K.hub ? K.flip : undefined,
    clash: [{ h: disk, z: [z1, z1 + t], cc: true }, { h: hull2([...circlePts(rn, 24), ...capsulePts([0, 0], [G.a, 0], armR)]), z: [z1 + t, z2 + t] }] });
  const wl = genevaWheel(G);
  let wt = moveTris(extrudeTris(wl, [circlePts(free / 2, 28)], t), 0, 0, z1);
  wt = wt.concat(K.pivot(0, 0, z1, '바퀴 받침', 'geneva_post').map(tr => tr));
  const post = model.housing.find(h => h.file === 'geneva_post'); if (post) post.tris = moveTris(post.tris, G.C, 0, 0);
  model.parts.push({ name: '제네바 바퀴', file: `geneva_wheel_n${G.n}`, tris: wt, motion: tt => XF.mul(XF.T(G.C, 0, 0), XF.Rz(genevaPsi(G, K.thOf(tt)).psi)), clash: [{ h: wl, z: [z1, z1 + t], cc: true }] });
  model.plateHoles.push([G.C, 0, press]);
  K.grow(G.C, 0, G.Rw + 4); K.grow(0, 0, Math.max(G.Rl, G.a + armR) + 4);
  K.pin('구동 핀', z1, z2 + t, tt => [G.a * Math.cos(K.thOf(tt)), G.a * Math.sin(K.thOf(tt))], ['구동판', '제네바 바퀴']);
  K.pin('바퀴 피벗 핀', 0, z1 + t, () => [G.C, 0], ['제네바 바퀴', '바퀴 받침']);
  const move = 2 * G.al / (2 * PI), wmax = M.ok ? Math.max(...M.v.map(Math.abs)) * D2R : 0;
  checks.unshift({ st: 'ok', txt: `한 바퀴마다 <em>${fmt(360 / G.n, 1)}°</em> 돌고 멈춤 · 도는 구간 <em>${fmt(move * 360, 0)}°</em> / 멈춤 <em>${fmt(360 - move * 360, 0)}°</em> (구동판 각) · 최대 각속도비 <em>${fmt(wmax, 2)}</em>` });
  checks.push({ st: G.C - G.Rw - 0.8 >= K.shD / 2 + 2 ? 'ok' : 'bad', txt: `중심거리 <em>${fmt(G.C, 2)} mm</em> · 바퀴 반지름 <em>${fmt(G.Rw, 1)} mm</em> · 잠금 원판 <em>${fmt(G.Rl, 1)} mm</em>${G.C - G.Rw - 0.8 < K.shD / 2 + 2 ? ' · 잠금 원판 가운데가 너무 얇습니다. 핀 반지름 a를 키우세요' : ''}` });
  if (G.n < 3 || G.n > 12) checks.push({ st: 'bad', txt: '홈 수는 3~12 사이로 하세요' });
  model.hud = [['구동판', fmt(K.rpm, 1) + ' rpm'], ['홈 수', String(G.n)], ['한 번에', fmt(360 / G.n, 1) + '°'], ['멈춤 비율', fmt(100 - move * 100, 0) + '%']];
  model.table = linkTbl([['구동판', `핀 반지름 a = ${G.a} mm`, `잠금 원판 ${fmt(G.Rl * 2, 1)}`, `${boreTxt(K)} · 핀 ${fmt(press, 2)}`], ['제네바 바퀴', `홈 ${G.n}개 · 지름 ${fmt(G.Rw * 2, 1)} mm`, `두께 ${t}`, `홈 폭 ${fmt(G.ws, 2)} · 피벗 ${fmt(free, 2)}`],
    { part: -1, c: ['중심거리', `${fmt(G.C, 2)} mm`, '바닥판', `피벗 ${pd}`] }]);
  model.asm = ['바퀴 피벗 핀을 바닥판 구멍에 눌러 끼우고 제네바 바퀴를 얹습니다.', '구동판을 끼울 때 구동 핀이 바퀴 홈 하나에 들어가게 맞춥니다.'];
  model.notes.push('구동판의 둥근 잠금 원판이 바퀴의 오목한 호에 물려, 핀이 홈 밖에 있는 동안 바퀴가 돌지 못하게 막습니다.');
  return [circlePts(pd / 2 + 4, 24, G.C, 0)];
}
// ---- 래칫: 톱니바퀴가 반시계로만 돌고, 멈춤쇠가 시계 방향 회전을 막음
function lkRatchet(D, model, K, M) {
  const { w, t, z1, bt, free, press, pd } = K, checks = model.checks, G = ratchetGeo(D);
  const wt = K.driver(G.outline);
  model.parts.push({ name: '래칫 바퀴', file: `ratchet_z${G.z}`, tris: wt, motion: tt => XF.Rz(K.thOf(tt)), print: K.hub ? K.flip : undefined, clash: [{ h: G.outline, z: [z1, z1 + t], cc: true }] });
  const Q = G.Q, T0 = G.T0, dir = [(Q[0] - T0[0]) / G.L, (Q[1] - T0[1]) / G.L], Tl = [Q[0] + dir[0] * 9, Q[1] + dir[1] * 9];
  const pw = hull2([...circlePts(G.tr, 12, ...T0), ...circlePts(pd / 2 + 3, 24, ...Q), ...circlePts(3, 16, ...Tl)]);
  let pt = moveTris(extrudeTris(pw, [circlePts(free / 2, 24, ...Q), circlePts(1.6, 16, ...Tl)], t), 0, 0, z1).concat(K.pivot(...Q, z1, '멈춤쇠 받침', 'pawl_post'));
  const gam = tt => ratchetGam(G, K.thOf(tt));
  model.parts.push({ name: '멈춤쇠', file: 'pawl', tris: pt, motion: tt => rotAbout(Q[0], Q[1], -gam(tt)), clash: [{ h: pw, z: [z1, z1 + t] }] });
  const Sp = [Tl[0], Tl[1] + 10];
  model.housing.push({ name: '고무줄 걸이', file: 'spring_post', tris: moveTris(extrudeTris(circlePts(2.5, 24, ...Sp), [], z1 + t - bt + 2), 0, 0, bt - 0.01) });
  model.extras.push({ line: [[Tl[0], Tl[1], z1 + t + 0.5], [Sp[0], Sp[1], z1 + t + 0.5]], color: '#c0392b' });
  model.plateHoles.push([...Q, press]);
  K.grow(0, 0, G.R + 4); K.grow(...Q, 8); K.grow(...Sp, 6);
  K.pin('멈춤쇠 피벗 핀', 0, z1 + t, () => Q, ['멈춤쇠', '멈춤쇠 받침']);
  const lift = M.ok ? M.max : 0, mom = (T0[0] - Q[0]) * 0 - (T0[1] - Q[1]) * 1;
  checks.unshift({ st: 'ok', txt: `톱니 <em>${G.z}개</em> · 거꾸로 돌 때 최대 <em>${fmt(360 / G.z, 1)}°</em> 안에서 멈춤 · 한 바퀴에 딸깍 <em>${G.z}번</em>` });
  checks.push({ st: mom > 0 ? 'ok' : 'bad', txt: mom > 0 ? '멈춤쇠가 톱니에 걸리면 힘이 멈춤쇠를 더 깊이 물리는 방향입니다 (스스로 물림)' : '멈춤쇠가 톱니에서 튕겨 나갈 수 있습니다' });
  checks.push({ st: 'ok', txt: `멈춤쇠가 넘어갈 때 최대 <em>${fmt(lift, 1)}°</em> 들립니다. 꼬리를 고무줄(또는 작은 용수철)로 걸이에 당겨 두세요` });
  model.hud = [['바퀴', fmt(K.rpm, 1) + ' rpm (반시계)'], ['톱니', String(G.z)], ['역회전 한계', fmt(360 / G.z, 1) + '°']];
  model.table = linkTbl([['래칫 바퀴', `바깥 지름 ${fmt(2 * G.R, 1)} · 톱니 깊이 ${G.h}`, `두께 ${t}`, boreTxt(K)], ['멈춤쇠', `길이 ${G.L} mm`, `두께 ${t}`, `피벗 ${fmt(free, 2)} · 고무줄 구멍 3.2`]]);
  model.asm = ['멈춤쇠 피벗 핀을 바닥판에 눌러 끼우고 멈춤쇠를 얹습니다.', '고무줄 걸이를 붙이고, 고무줄로 멈춤쇠 꼬리를 걸이에 당겨 끝이 톱니에 닿게 합니다.'];
  model.glue = '고무줄 걸이를 바닥판에 붙임';
  model.bomExtra = [['작은 고무줄 또는 인장 용수철', 1, '멈춤쇠 꼬리 → 걸이']];
  return [circlePts(pd / 2 + 4, 24, ...Q), circlePts(4, 16, ...Sp)];
}
// ---- 리드스크루: 사다리꼴 나사(30°), 출력 나사와 너트, 안내 기둥 2개와 윗판
const thrProf = u => u < 0.1 ? 0 : u < 0.4 ? (u - 0.1) / 0.3 : u < 0.6 ? 1 : u < 0.9 ? 1 - (u - 0.6) / 0.3 : 0;
function threadLoop(R0, h, p, L, z, clr, n = 48, prof = thrProf) {
  const out = [];
  for (let j = 0; j < n; j++) { const f = 2 * PI * j / n, x = (z - L * f / (2 * PI)) / p, u = x - Math.floor(x), r = R0 - h + h * prof(u) + clr; out.push([r * Math.cos(f), r * Math.sin(f)]); }
  return out;
}
function threadTris(S, z0, len, nut) {   // nut: {Ro, clr} 이면 바깥 원통 + 안쪽 암나사 관
  const R0 = S.d / 2, h = S.h || S.p * 0.5, L = S.p * (S.starts || 1), nz = Math.max(2, Math.ceil(len / (S.p / 10))), tris = [];
  const zs = Array.from({ length: nz + 1 }, (_, i) => z0 + len * i / nz), loops = zs.map(z => threadLoop(R0, h, S.p, L, z, nut ? nut.clr : 0, S.n || 48, S.prof || thrProf));
  if (!nut) {
    for (let i = 0; i < nz; i++) tris.push(...loftWall(at(loops[i], zs[i]), at(loops[i + 1], zs[i + 1])));
    tris.push(...capTris(loops[0], [], zs[0], false), ...capTris(loops[nz], [], zs[nz], true));
    return tris;
  }
  const oc = nut.outer || circlePts(nut.Ro, 48);
  for (let i = 0; i < nz; i++) tris.push(...loftWall(at(cw(loops[i]), zs[i]), at(cw(loops[i + 1]), zs[i + 1])));
  tris.push(...loftWall(at(oc, z0), at(oc, z0 + len)), ...capTris(oc, [loops[0]], z0, false), ...capTris(oc, [loops[nz]], z0 + len, true));
  return tris;
}