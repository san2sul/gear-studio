/* ================= 캠 =================
 design = { kind:'cam', camType:'disk'|'groove'|'barrel'|'face', follower:'knife'|'roller'|'flat'|'swing',
   Rb(기초원 반지름 · 원통/정면 캠은 경로 반지름), Rr(롤러 반지름), e(편심 오프셋), T(캠 두께), shaftD, rpm,
   motion:{ mode:'program'|'custom', lobes, segs:[{kind:'rise'|'dwell'|'return', ang, h, law}], pts:[[각도°, 변위]] },
   swing:{ d(피벗 거리), L(팔 길이) }, dg(홈 깊이), wall } */
const CAM_LAWS = {
  uniform: u => [u, 1, 0], harmonic: u => [(1 - Math.cos(PI * u)) / 2, PI / 2 * Math.sin(PI * u), PI * PI / 2 * Math.cos(PI * u)],
  cycloid: u => [u - Math.sin(2 * PI * u) / (2 * PI), 1 - Math.cos(2 * PI * u), 2 * PI * Math.sin(2 * PI * u)],
  parabolic: u => u < 0.5 ? [2 * u * u, 4 * u, 4] : [1 - 2 * (1 - u) ** 2, 4 * (1 - u), -4],
  poly345: u => [10 * u ** 3 - 15 * u ** 4 + 6 * u ** 5, 30 * u ** 2 - 60 * u ** 3 + 30 * u ** 4, 60 * u - 180 * u ** 2 + 120 * u ** 3],
};
const CAM_LAW_KO = { uniform: '등속', harmonic: '단진동', cycloid: '사이클로이드', parabolic: '등가속', poly345: '5차 다항식' };
// 변위 s(θ) 표본 (θ: 캠 회전각, rad, 0..2π). 반환 s, s1=ds/dθ, s2=d²s/dθ²
function camMotion(M, N = 720) {
  const lobes = Math.max(1, Math.round(M.lobes || 1)), P = 2 * PI / lobes, out = { N, s: [], s1: [], s2: [], warn: [] };
  let f;
  if (M.mode === 'custom') {
    const pts = (M.pts || []).map(p => [((+p[0] % 360) + 360) % 360 / 360 * P / (2 * PI / 360) * D2R, +p[1]]).filter(p => isFinite(p[1])).sort((a, b) => a[0] - b[0]);
    // 사용자 점은 0~360°를 한 로브 주기로 보고 주기 반복 Catmull-Rom 곡선으로 잇는다
    if (pts.length < 3) { out.warn.push('사용자 곡선 점이 3개보다 적습니다.'); f = () => [0, 0, 0]; }
    else f = th => {
      const n = pts.length, x = ((th % P) + P) % P;
      let i = -1; for (let k = 0; k < n; k++) if (pts[k][0] <= x) i = k;
      const g = k => { const q = pts[((k % n) + n) % n], wr = Math.floor(k / n); return [q[0] + wr * P, q[1]]; };
      const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
      const h = p2[0] - p1[0] || 1e-9, u = (x - p1[0]) / h;
      const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0]) * h, m2 = (p3[1] - p1[1]) / (p3[0] - p1[0]) * h;
      const u2 = u * u, u3 = u2 * u;
      return [(2 * u3 - 3 * u2 + 1) * p1[1] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[1] + (u3 - u2) * m2, 0, 0];
    };
  } else {
    const segs = (M.segs || []).filter(sg => +sg.ang > 0), tot = segs.reduce((a, sg) => a + +sg.ang, 0) || 1;
    if (Math.abs(tot - 360) > 0.01) out.warn.push(`구간 각도 합이 ${fmt(tot, 1)}°라 360°에 맞춰 비례로 늘였습니다.`);
    let lift = 0; segs.forEach(sg => { if (sg.kind === 'rise') lift += +sg.h; if (sg.kind === 'return') lift -= +sg.h; });
    if (Math.abs(lift) > 1e-6) out.warn.push(`상승 합과 하강 합이 ${fmt(lift, 2)} 만큼 달라 한 바퀴 뒤 시작점으로 돌아오지 않습니다. 마지막에서 끊깁니다.`);
    out.closeErr = lift;
    f = th => {
      let x = ((th % P) + P) % P / P * 2 * PI, base = 0, a0 = 0;
      for (const sg of segs) {
        const b = +sg.ang / tot * 2 * PI * (P / (2 * PI)), bN = +sg.ang / tot * 2 * PI;
        if (x <= a0 + bN + 1e-12) {
          if (sg.kind === 'dwell') return [base, 0, 0];
          const hh = (sg.kind === 'rise' ? 1 : -1) * +sg.h, [y, y1, y2] = (CAM_LAWS[sg.law] || CAM_LAWS.cycloid)(Math.min(1, Math.max(0, (x - a0) / bN)));
          return [base + hh * y, hh * y1 / b, hh * y2 / (b * b)];
        }
        a0 += bN; if (sg.kind === 'rise') base += +sg.h; if (sg.kind === 'return') base -= +sg.h;
      }
      return [base, 0, 0];
    };
  }
  for (let i = 0; i < N; i++) out.s.push(f(2 * PI * i / N)[0]);
  // 도함수는 표본에서 중심 차분 (사용자 곡선·구간 경계 모두 같은 방식)
  const d = 2 * PI / N;
  for (let i = 0; i < N; i++) { const a = out.s[(i - 1 + N) % N], b = out.s[(i + 1) % N]; out.s1.push((b - a) / (2 * d)); out.s2.push((b - 2 * out.s[i] + a) / (d * d)); }
  out.min = Math.min(...out.s); out.max = Math.max(...out.s); out.f = th => { const x = ((th % (2 * PI)) + 2 * PI) % (2 * PI) / d, i = Math.floor(x), t = x - i; return out.s[i % N] * (1 - t) + out.s[(i + 1) % N] * t; };
  out.d1 = th => { const x = ((th % (2 * PI)) + 2 * PI) % (2 * PI) / d, i = Math.floor(x), t = x - i; return out.s1[i % N] * (1 - t) + out.s1[(i + 1) % N] * t; };
  return out;
}
const rot2 = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
// 곡선(닫힌 점열)의 곡률반경 (부호: 반시계 볼록이면 +)
function curveRadii(P) {
  const n = P.length, R = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    const la = Math.hypot(b[0] - a[0], b[1] - a[1]), lb = Math.hypot(c[0] - b[0], c[1] - b[1]), lc = Math.hypot(c[0] - a[0], c[1] - a[1]);
    R.push(Math.abs(cr) < 1e-12 ? Infinity : la * lb * lc / (2 * cr));
  }
  return R;
}
const offsetCurve = (P, d) => { const n = P.length; return P.map((p, i) => { const a = P[(i - 1 + n) % n], c = P[(i + 1) % n], tx = c[0] - a[0], ty = c[1] - a[1], L = Math.hypot(tx, ty) || 1; return [p[0] + d * ty / L, p[1] - d * tx / L]; }); };  // d>0: 반시계 곡선의 바깥쪽
// 원통 둘레(u = R·φ) 위 경로를 법선 방향으로 d만큼 띄운 뒤 일정 각도 격자로 다시 표본화
function offsetPath(zc, z1, R, d, N) {
  const pts = [];
  for (let i = 0; i < N; i++) { const k = z1[i] / R, L = Math.sqrt(1 + k * k); pts.push([2 * PI * i / N * R - d * k / L, zc[i] + d / L]); }
  const out = [], P = 2 * PI * R; let bad = false;
  for (let i = 0; i < N; i++) if (((pts[(i + 1) % N][0] - pts[i][0]) + (i === N - 1 ? P : 0)) <= 0) bad = true;
  for (let i = 0; i < N; i++) {
    const u = 2 * PI * i / N * R; let j = 0;
    // u를 감싸는 구간 찾기 (주기)
    let best = null;
    for (let k = 0; k < N; k++) { const a = pts[k], b = pts[(k + 1) % N]; const ua = a[0], ub = b[0] + (k === N - 1 ? P : 0);
      for (const sh of [0, P, -P]) { const uu = u + sh; if (uu >= ua - 1e-9 && uu <= ub + 1e-9 && ub > ua) { const t = (uu - ua) / (ub - ua), z = a[1] + (b[1] - a[1]) * t; if (best == null || (d > 0 ? z > best : z < best)) best = z; } } }
    out.push(best ?? zc[i] + d);
  }
  return { z: out, bad };
}
// (r,z) 단면을 각도마다 바꿔 가며 돌려 만든 닫힌 입체. secs[i] = [[r,z],...] (같은 점 수)
function revolveSections(secs) {
  const N = secs.length, M = secs[0].length, tris = [];
  const P = (i, j) => { const th = 2 * PI * (i % N) / N, [r, z] = secs[i % N][j % M]; return [r * Math.cos(th), r * Math.sin(th), z]; };
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = P(i, j), b = P(i, j + 1), c = P(i + 1, j + 1), d = P(i + 1, j);
    const same = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) < 1e-9;
    if (!same(a, b) && !same(b, c) && !same(a, c)) tris.push([...a, ...b, ...c]);
    if (!same(a, c) && !same(c, d) && !same(a, d)) tris.push([...a, ...c, ...d]);
  }
  let v = 0; for (const t of tris) v += (t[0] * (t[4] * t[8] - t[5] * t[7]) - t[1] * (t[3] * t[8] - t[5] * t[6]) + t[2] * (t[3] * t[7] - t[4] * t[6]));
  return v < 0 ? tris.map(t => [t[0], t[1], t[2], t[6], t[7], t[8], t[3], t[4], t[5]]) : tris;
}
function camDefault() {
  return { version: 4, kind: 'cam', camType: 'disk', follower: 'roller', Rb: 20, Rr: 5, e: 0, T: 8, shaftD: 5, rpm: 30, dg: 4, wall: 3,
    swing: { d: 50, L: 40 },
    motion: { mode: 'program', lobes: 1, segs: [
      { kind: 'rise', ang: 120, h: 12, law: 'cycloid' }, { kind: 'dwell', ang: 60, h: 0, law: 'cycloid' },
      { kind: 'return', ang: 120, h: 12, law: 'cycloid' }, { kind: 'dwell', ang: 60, h: 0, law: 'cycloid' }],
      pts: [[0, 0], [60, 3], [120, 12], [180, 12], [240, 6], [300, 1]] } };
}
const CAM_PRESETS = {
  standard: { label: '상승·정지·하강·정지', apply: D => { D.motion = camDefault().motion; } },
  eccentric: { label: '편심 원판', apply: D => { D.camType = 'disk'; D.follower = 'flat'; D.e = 0; D.motion = { ...D.motion, mode: 'program', lobes: 1, segs: [{ kind: 'rise', ang: 180, h: 10, law: 'harmonic' }, { kind: 'return', ang: 180, h: 10, law: 'harmonic' }] }; } },
  heart: { label: '하트 (등속 왕복)', apply: D => { D.camType = 'disk'; D.follower = 'knife'; D.motion = { ...D.motion, mode: 'program', lobes: 1, segs: [{ kind: 'rise', ang: 180, h: 15, law: 'uniform' }, { kind: 'return', ang: 180, h: 15, law: 'uniform' }] }; } },
  triple: { label: '3로브 (한 바퀴 3번)', apply: D => { D.motion = { ...D.motion, mode: 'program', lobes: 3, segs: [{ kind: 'rise', ang: 150, h: 6, law: 'poly345' }, { kind: 'return', ang: 150, h: 6, law: 'poly345' }, { kind: 'dwell', ang: 60, h: 0, law: 'cycloid' }] }; } },
  snail: { label: '달팽이 (서서히 올라 툭 떨어짐)', apply: D => { D.camType = 'disk'; D.follower = 'roller'; D.motion = { ...D.motion, mode: 'program', lobes: 1, segs: [{ kind: 'rise', ang: 270, h: 10, law: 'cycloid' }, { kind: 'return', ang: 90, h: 10, law: 'cycloid' }] }; } },
};
function camModel(D) {
  const N = 720, M = camMotion(D.motion, N), w = D.rpm * 2 * PI / 60, ct = D.camType, fol = ct === 'disk' ? D.follower : ct === 'groove' ? 'roller' : 'pin';
  const swing = ct === 'disk' && fol === 'swing', T = D.T, sd = D.shaftD, cl = 0.3, wall = D.wall || 3, wR = 8, tR = 5, pinD = 3;
  const model = { kind: 'cam', parts: [], housing: [], rods: [], notes: [], checks: [], frame: true };
  const checks = model.checks;
  M.warn.forEach(t => checks.push({ st: M.closeErr ? 'bad' : 'warn', txt: t }));
  if (M.min < -1e-6) checks.push({ st: 'warn', txt: `변위가 0 아래(${fmt(M.min, 2)})로 내려갑니다. 기초원 안쪽으로 파고드니 기초원을 키우세요.` });
  const bore = borePts(sd + 0.1, 0.5), loose = sd + 0.4;
  const camRot = t => XF.Rz(w * t);
  const thOf = t => w * t;
  let camTris, Rmax, pressure = 0, hud = [], fParts = [], guide = [], unit = swing ? '°' : 'mm';
  const Rr = fol === 'roller' || swing ? D.Rr : 0;
  const frameSlabs = [], baseTop = -1.5, baseT = 4;
  let ext = { lo: [Infinity, Infinity], hi: [-Infinity, -Infinity] };
  const grow = (x, y) => { ext.lo[0] = Math.min(ext.lo[0], x); ext.lo[1] = Math.min(ext.lo[1], y); ext.hi[0] = Math.max(ext.hi[0], x); ext.hi[1] = Math.max(ext.hi[1], y); };
  const sleeveY = (x0, x1, z0, z1, yA, yB) => {   // y 방향으로 미끄러지는 막대의 사각 슬리브 (바닥판까지 내려옴)
    const h = { x0: x0 - cl, x1: x1 + cl, z0: z0 - cl, z1: z1 + cl };
    grow(x0 - wall - cl, yA); grow(x1 + wall + cl, yB);
    return { frame: XF.basis([1, 0, 0], [0, 0, 1], [0, -1, 0], [0, yB, 0]), outline: rectPts(h.x0 - wall, baseTop - 0.2, h.x1 + wall, h.z1 + wall), holesR: [rectPts(h.x0, h.z0, h.x1, h.z1)], t: yB - yA };
  };
  if (ct === 'disk' || ct === 'groove') {
    // 피치 곡선 (롤러 중심 / 칼날 끝) — 캠 좌표
    const e = fol === 'flat' ? 0 : D.e || 0, R0 = D.Rb + Rr, s0 = Math.sqrt(Math.max(1e-6, R0 * R0 - e * e));
    let pitch = [], dirs = [], prof;
    const sw = D.swing || { d: 50, L: 40 }, Pv = [sw.d, 0];
    const c0 = (R0 * R0 - sw.d ** 2 - sw.L ** 2) / (2 * sw.d * sw.L);
    if (swing && Math.abs(c0) > 1) checks.push({ st: 'bad', txt: '피벗 거리와 팔 길이로는 롤러가 기초원에 닿을 수 없습니다. 팔 길이나 피벗 거리를 바꾸세요.' });
    const phi0 = Math.acos(Math.max(-1, Math.min(1, c0)));
    const C0 = [Pv[0] + sw.L * Math.cos(phi0), sw.L * Math.sin(phi0)];
    const follC = th => swing ? [Pv[0] + sw.L * Math.cos(phi0 - M.f(th) * D2R), sw.L * Math.sin(phi0 - M.f(th) * D2R)] : [e, s0 + M.f(th)];
    for (let i = 0; i < N; i++) {
      const th = 2 * PI * i / N, C = follC(th);
      pitch.push(rot2(C, -th));
      dirs.push(rot2(swing ? [-(C[1] - Pv[1]), C[0] - Pv[0]] : [0, 1], -th));
    }
    // 캠 회전 방향(반시계)으로 놓인 곡선이 시계 방향이 되므로 뒤집어 반시계로
    const ccwPts = P => area2(P) < 0 ? P.slice().reverse() : P;
    if (fol === 'flat') {
      prof = [];
      for (let i = 0; i < N; i++) {
        const th = 2 * PI * i / N, f = D.Rb + M.s[i], f1 = M.s1[i];
        const u = rot2([0, 1], -th), u1 = rot2([1, 0], -th);   // d/dθ Rot(-θ)[0,1] = Rot(-θ)[1,0]
        // p·u = f, p·u1 = f1
        const det = u[0] * u1[1] - u[1] * u1[0];
        prof.push([(f * u1[1] - u[1] * f1) / det, (u[0] * f1 - u1[0] * f) / det]);
      }
      const k = Math.min(...M.s.map((s, i) => D.Rb + s + M.s2[i]));
      if (k <= 0.5) checks.push({ st: 'bad', txt: `평면 종동절: 기초원+변위+가속 항의 최소값이 ${fmt(k, 2)} mm라 캠 윤곽이 뾰족하게 꺾입니다. 기초원을 키우거나 상승 각도를 늘리세요.` });
      else checks.push({ st: 'ok', txt: `평면 종동절 윤곽 곡률 여유 <em>${fmt(k, 1)} mm</em>` });
    } else {
      const pc = ccwPts(pitch);
      const rad = curveRadii(pc), minConvex = Math.min(...rad.filter(r => r > 0));
      if (fol === 'roller' || swing) {
        if (ct === 'disk') {
          if (minConvex <= Rr + 0.5) checks.push({ st: 'bad', txt: `피치 곡선의 볼록 곡률반경 최소 ${fmt(minConvex, 2)} mm가 롤러 반지름 ${Rr} mm보다 작아 윤곽이 깎여 나갑니다(언더컷). 롤러를 줄이거나 기초원을 키우세요.` });
          else checks.push({ st: 'ok', txt: `언더컷 없음: 피치 곡선 최소 곡률반경 <em>${fmt(minConvex, 1)} mm</em> > 롤러 <em>${Rr} mm</em>` });
          prof = offsetCurve(pc, -Rr);
        } else prof = pc;
      } else prof = pc;
    }
    // 압력각
    if (fol !== 'flat') {
      const n = pitch.length;
      for (let i = 0; i < n; i++) { const a = pitch[(i - 1 + n) % n], c = pitch[(i + 1) % n], t = [c[0] - a[0], c[1] - a[1]], nn = [t[1], -t[0]], v = dirs[i];
        const cs = Math.abs(nn[0] * v[0] + nn[1] * v[1]) / (Math.hypot(...nn) * Math.hypot(...v)); pressure = Math.max(pressure, Math.acos(Math.min(1, cs)) / D2R); }
      const lim = swing ? 45 : 30;
      checks.push({ st: pressure <= lim ? 'ok' : pressure <= lim + 10 ? 'warn' : 'bad', txt: `최대 압력각 <em>${fmt(pressure, 1)}°</em> (${lim}° 이하 권장)${pressure > lim ? '. 기초원을 키우거나 상승 각도를 늘리세요' + (swing ? '' : ', 또는 편심 e로 줄일 수 있습니다') : ''}` });
    }
    Rmax = Math.max(...prof.map(p => Math.hypot(p[0], p[1])));
    if (ct === 'disk') {
      camTris = extrudeTris(prof, [bore], T);
      if (Math.min(...prof.map(p => Math.hypot(p[0], p[1]))) - (sd / 2) < 2) checks.push({ st: 'bad', txt: '캠 윤곽이 축 구멍에 너무 가깝습니다. 기초원을 키우세요.' });
    } else {
      // 홈 캠: 바닥판 + 바깥 고리 + 안쪽 섬. 홈 폭 = 롤러 지름 + 여유
      const pc = ccwPts(pitch), outC = offsetCurve(pc, Rr + cl), inC = offsetCurve(pc, -(Rr + cl)), tb = 3;
      const Rout = Math.max(...outC.map(p => Math.hypot(p[0], p[1]))) + wall;
      if (Math.min(...inC.map(p => Math.hypot(p[0], p[1]))) - sd / 2 < 2.5) checks.push({ st: 'bad', txt: '홈 안쪽 섬이 축 구멍에 너무 가깝습니다. 기초원을 키우세요.' });
      const rad = curveRadii(pc); if (Math.min(...rad.map(Math.abs)) <= Rr + cl + 0.3) checks.push({ st: 'bad', txt: '홈이 너무 급하게 휘어 롤러가 지나가지 못합니다. 롤러를 줄이거나 기초원을 키우세요.' });
      camTris = extrudeTris(circlePts(Rout, 120), [bore], tb)
        .concat(moveTris(extrudeTris(circlePts(Rout, 120), [outC.slice().reverse()], T - tb + 0.2), 0, 0, tb - 0.2))
        .concat(moveTris(extrudeTris(inC, [bore], T - tb + 0.2), 0, 0, tb - 0.2));
      Rmax = Rout;
      model.notes.push('홈 캠은 바닥판·바깥 고리·안쪽 섬이 살짝 겹친 세 덩어리로 된 STL입니다. 슬라이서가 한 몸으로 합쳐 출력합니다.');
    }
    // 종동절 부품
    const sMin = M.min, sMax = M.max, rollerZ = ct === 'groove' ? [3 + 0.3, T] : [0, T];
    const rodZ = (fol === 'roller' || swing) ? [T + 1, T + 1 + tR] : [0, T];
    if (swing) {
      const pivotH = rodZ[0] - 0.3 - baseTop;
      fParts.push({ name: '스윙 팔', file: `arm_L${sw.L}`, tris: moveTris(extrudeTris(capsulePts(Pv, C0, wR / 2 + 1.5), [circlePts(pinD / 2 + 0.25, 24, ...Pv), circlePts(pinD / 2 + 0.1, 24, ...C0)], tR), 0, 0, rodZ[0]), kind: 'arm' });
      fParts.push({ name: '롤러', file: `roller_r${Rr}`, tris: moveTris(extrudeTris(circlePts(Rr, 64, ...C0), [circlePts(pinD / 2 + 0.25, 24, ...C0)], rollerZ[1] - rollerZ[0] - 0.4), 0, 0, rollerZ[0] + 0.2), kind: 'arm' });
      guide.push({ name: '피벗 기둥', file: 'pivot_post', tris: moveTris(extrudeTris(circlePts(pinD / 2 + 3, 40, ...Pv), [circlePts(pinD / 2 - 0.05, 24, ...Pv)], pivotH), 0, 0, baseTop) });
      grow(Pv[0] + 8, Pv[1] + 8); grow(Pv[0] - 8, Pv[1] - 8);
      model.pins = [{ name: '피벗 핀', d: pinD, L: rodZ[1] + 1 - baseTop }, { name: '롤러 핀', d: pinD, L: rodZ[1] - rollerZ[0] + 0.5 }];
      const ang = t => -M.f(thOf(t)) * D2R;
      model.followerMotion = t => XF.mul(XF.T(Pv[0], Pv[1], 0), XF.mul(XF.Rz(ang(t)), XF.T(-Pv[0], -Pv[1], 0)));
      hud.push(['스윙 각도', `${fmt(M.max - M.min, 1)}°`]);
    } else {
      const tipH = fol === 'knife' ? wR : fol === 'flat' ? 4 : Rr;
      const yA = Math.max(s0 + sMax + tipH, Rmax + 2) + 3, yB = yA + 14, Lf = yB + 5 - (s0 + sMin);
      let rod;
      if (fol === 'knife') rod = [[0, 0], [wR / 2, wR * 0.9], [wR / 2, Lf], [-wR / 2, Lf], [-wR / 2, wR * 0.9]];
      else if (fol === 'flat') { const Wf = 2 * Math.max(...M.s1.map(Math.abs)) + 8; rod = [[-Wf / 2, 0], [Wf / 2, 0], [Wf / 2, 3], [wR / 2, 3], [wR / 2, Lf], [-wR / 2, Lf], [-wR / 2, 3], [-Wf / 2, 3]]; hud.push(['평면 폭', fmt(Wf, 1) + ' mm']); }
      else rod = rectPts(-wR / 2, -wR / 2 - 1, wR / 2, Lf);
      const holes = fol === 'roller' ? [circlePts(pinD / 2 + 0.1, 24)] : [];
      fParts.push({ name: '종동절 막대', file: `follower_${fol}_L${fmt(Lf, 0)}`, tris: xfTris(extrudeTris(rod, holes, rodZ[1] - rodZ[0]), XF.T(e, s0, rodZ[0])), kind: 'slide' });
      if (fol === 'roller') {
        fParts.push({ name: '롤러', file: `roller_r${Rr}`, tris: xfTris(extrudeTris(circlePts(Rr, 64), [circlePts(pinD / 2 + 0.25, 24)], rollerZ[1] - rollerZ[0] - 0.4), XF.T(e, s0, rollerZ[0] + 0.2)), kind: 'slide' });
        model.pins = [{ name: '롤러 핀', d: pinD, L: rodZ[1] - rollerZ[0] + 0.5 }];
      }
      frameSlabs.push(sleeveY(e - wR / 2, e + wR / 2, rodZ[0], rodZ[1], yA, yB));
      model.followerMotion = t => XF.T(0, M.f(thOf(t)), 0);
    }
    grow(-Rmax - 3, -Rmax - 3); grow(Rmax + 3, Rmax + 3);
    model.parts.push({ name: ct === 'groove' ? '홈 캠' : '원판 캠', file: `cam_${ct}_${fol}_Rb${D.Rb}`, tris: camTris, motion: camRot });
    model.rods.push({ a: [0, 0, baseTop - baseT - 8], b: [0, 0, T + 10], d: sd, role: 'input' });
  } else {
    // 원통 캠(홈) / 정면 캠(윗면) — 캠 좌표 각도 φ에서 경로 높이 = s(-φ)
    const R = D.Rb, idx = i => (N - i) % N;
    const s = Array.from({ length: N }, (_, i) => M.s[idx(i)]), s1 = Array.from({ length: N }, (_, i) => -M.s1[idx(i)]);
    pressure = Math.max(...M.s1.map(v => Math.atan(Math.abs(v) / R) / D2R));
    checks.push({ st: pressure <= 30 ? 'ok' : pressure <= 40 ? 'warn' : 'bad', txt: `최대 압력각 <em>${fmt(pressure, 1)}°</em> (30° 이하 권장)${pressure > 30 ? '. 경로 반지름을 키우거나 상승 각도를 늘리세요' : ''}` });
    const rb = sd / 2 + 0.05;
    if (ct === 'barrel') {
      const rr = Math.max(1.5, D.Rr), dg = D.dg || 4, Rc = R + dg / 2, z0 = wall + rr + cl - M.min;
      const zc = s.map(v => z0 + v), up = offsetPath(zc, s1, R, rr + cl, N), lo = offsetPath(zc, s1, R, -(rr + cl), N);
      if (up.bad || lo.bad) checks.push({ st: 'bad', txt: '홈이 너무 급하게 꺾여 핀이 지나가지 못합니다. 핀을 가늘게 하거나 경로 반지름을 키우세요.' });
      const Lc = z0 + M.max + rr + cl + wall;
      const secs = up.z.map((zu, i) => { const zl = lo.z[i]; return [[rb, 0], [Rc, 0], [Rc, zl], [Rc - dg, zl], [Rc - dg, zu], [Rc, zu], [Rc, Lc], [rb, Lc]]; });
      camTris = revolveSections(secs).concat(); Rmax = Rc;
      // 종동절: 바깥 사각 막대 + 홈으로 들어가는 핀
      const xr = Rc + 1.5 + wR / 2, armZ = Lc + 3, Lf = armZ + 8 + 4 - (z0 + M.min - wR / 2);
      const rodT = xfTris(extrudeTris(rectPts(-wR / 2, -wR / 2, wR / 2, wR / 2), [], Lf), XF.T(xr, 0, z0 + M.min - wR / 2 - M.min));
      const pinT = xfTris(extrudeTris(circlePts(rr, 32), [], xr - (Rc - dg + 0.6)), XF.basis([0, 1, 0], [0, 0, 1], [1, 0, 0], [Rc - dg + 0.6, 0, z0]));
      fParts.push({ name: '종동절 (막대+핀)', file: `follower_pin_r${rr}`, tris: rodT.concat(pinT), kind: 'lift' });
      const colX = xr + wR / 2 + 6;
      frameSlabs.push({ frame: XF.T(colX, -6, baseTop), outline: rectPts(0, 0, 8, 12), holesR: [], t: armZ + 8 - baseTop });
      frameSlabs.push({ frame: XF.T(0, 0, armZ), outline: rectPts(xr - wR / 2 - cl - wall, -6, colX + 8, 6), holesR: [rectPts(xr - wR / 2 - cl, -wR / 2 - cl, xr + wR / 2 + cl, wR / 2 + cl)], t: 8 });
      grow(colX + 8, 8); grow(-Rmax - 3, -Rmax - 3); grow(Rmax + 3, Rmax + 3);
      model.parts.push({ name: '원통 캠', file: `cam_barrel_R${R}`, tris: camTris, motion: camRot });
      model.rods.push({ a: [0, 0, baseTop - baseT - 8], b: [0, 0, Lc + 10], d: sd, role: 'input' });
      model.notes.push('원통 캠은 세워서 출력하면 홈 윗벽이 짧은 다리(bridge)가 됩니다. 홈 깊이가 4 mm 안팎이면 서포트 없이 됩니다.');
    } else {
      const rr = 3, H0 = wall + 3 - M.min, ri = rb, Ro = R + wR / 2 + 3, Ri = Math.max(rb + 2, R - wR / 2 - 3);
      const tipC = s.map(v => H0 + v + rr), surf = offsetPath(tipC, s1, R, -rr, N);
      if (surf.bad) checks.push({ st: 'bad', txt: '윗면 경로가 너무 급하게 꺾여 둥근 끝이 따라가지 못합니다. 상승 각도를 늘리거나 경로 반지름을 키우세요.' });
      const secs = surf.z.map(h => [[ri, 0], [Ro, 0], [Ro, h], [Ri, h], [Ri, Math.min(h, H0 - 1)], [ri, Math.min(h, H0 - 1)]]);
      camTris = revolveSections(secs); Rmax = Ro;
      const Hmax = H0 + M.max, armZ = Hmax + 4, Lf = armZ + 8 + 6 - (H0 + M.min);
      // 끝이 반원(반지름 = 막대 폭/2)인 사각 막대, 반원의 축은 반지름 방향
      const half = Array.from({ length: 17 }, (_, i) => { const a = PI + PI * i / 16; return [rr * Math.cos(a), rr + rr * Math.sin(a)]; });
      const outline = [...half, [rr, Lf], [-rr, Lf]];
      fParts.push({ name: '종동절 막대', file: `follower_round_L${fmt(Lf, 0)}`, tris: xfTris(extrudeTris(outline, [], 2 * rr), XF.basis([0, 1, 0], [0, 0, 1], [1, 0, 0], [R - rr, 0, H0 + M.f(0) * 0])), kind: 'lift' });
      const colX = Ro + 4;
      frameSlabs.push({ frame: XF.T(colX, -6, baseTop), outline: rectPts(0, 0, 8, 12), holesR: [], t: armZ + 8 - baseTop });
      frameSlabs.push({ frame: XF.T(0, 0, armZ), outline: rectPts(R - rr - cl - wall, -7, colX + 8, 7), holesR: [rectPts(R - rr - cl, -rr - cl, R + rr + cl, rr + cl)], t: 8 });
      grow(colX + 8, 8); grow(-Rmax - 3, -Rmax - 3); grow(Rmax + 3, Rmax + 3);
      model.parts.push({ name: '정면 캠', file: `cam_face_R${R}`, tris: camTris, motion: camRot });
      model.rods.push({ a: [0, 0, baseTop - baseT - 8], b: [0, 0, Hmax + 4], d: sd, role: 'input' });
    }
    model.followerMotion = t => XF.T(0, 0, M.f(thOf(t)));
  }
  fParts.forEach(p => model.parts.push({ name: p.name, file: p.file, tris: p.tris, motion: model.followerMotion }));
  // 바닥판 + 프레임
  const plate = { frame: XF.T(0, 0, baseTop - baseT), outline: rectPts(ext.lo[0] - 3, ext.lo[1] - 3, ext.hi[0] + 3, ext.hi[1] + 3), holesR: [circlePts(loose / 2, 40)], t: baseT };
  [plate, ...frameSlabs].forEach((sl, k) => {
    const tris = xfTris(extrudeTris(sl.outline, sl.holesR, sl.t), sl.frame);
    model.housing.push({ name: k === 0 ? '바닥판' : '안내 슬리브·기둥', file: k === 0 ? 'base_plate' : `guide_${k}`, tris, print: XF.inv(sl.frame) });
  });
  guide.forEach(g => model.housing.push({ name: g.name, file: g.file, tris: g.tris }));
  (model.pins || []).forEach(p => model.housing.push({ name: p.name, file: `pin_d${p.d}_L${fmt(p.L, 1)}`, tris: extrudeTris(circlePts(p.d / 2 - 0.05, 24), [], p.L), assembly: false }));
  // 운동 정보
  const vmax = Math.max(...M.s1.map(Math.abs)) * w, amax = Math.max(...M.s2.map(Math.abs)) * w * w;
  checks.unshift({ st: 'ok', txt: `행정 <em>${fmt(M.max - M.min, 2)} ${unit}</em> · 최대 속도 <em>${fmt(vmax, 1)} ${unit}/s</em> · 최대 가속도 <em>${fmt(amax / (swing ? 1 : 1000), 2)} ${swing ? '°/s²' : 'm/s²'}</em> (캠 ${fmt(D.rpm, 1)} rpm)` });
  if (!swing && amax / 1000 > 9.81 && ct !== 'groove' && ct !== 'barrel') checks.push({ st: 'warn', txt: `최대 감속도가 중력가속도(9.8 m/s²)보다 커서 종동절이 캠에서 뜰 수 있습니다. 스프링으로 눌러 주거나 회전수를 낮추세요.` });
  if (ct === 'disk' && fol !== 'flat' && !swing) model.notes.push('종동절은 무게로 캠에 닿습니다. 캠을 세워 쓰거나 빠르게 돌리면 고무줄·스프링으로 눌러 주세요.');
  model.camMotion = M; model.pressure = pressure;
  model.hud = [['캠', fmt(D.rpm, 1) + ' rpm'], ['행정', fmt(M.max - M.min, 2) + ' ' + unit], ['최대 압력각', fmt(pressure, 1) + '°'], ...hud];
  model.table = { head: ['부품', '종류', '치수', '비고'], rows: [] };
  const typeKo = { disk: '원판 캠', groove: '홈 캠', barrel: '원통 캠', face: '정면 캠' }[ct], folKo = { knife: '칼날', roller: '롤러', flat: '평면', swing: '스윙 롤러', pin: '핀' }[fol];
  model.table.rows.push({ part: 0, cells: [model.parts[0].name, `${typeKo} · ${folKo} 종동절`, `기초원 R${D.Rb} · 최대 R${fmt(Rmax, 1)} · 두께 ${ct === 'disk' || ct === 'groove' ? T : '–'}`, `${D.motion.mode === 'custom' ? '사용자 곡선' : (D.motion.segs || []).map(sg => ({ rise: '상승', dwell: '정지', return: '하강' })[sg.kind] + sg.ang + '°').join(' ')}${(D.motion.lobes || 1) > 1 ? ` ×${D.motion.lobes}` : ''}`] });
  fParts.forEach((p, i) => model.table.rows.push({ part: i + 1, cells: [p.name, '종동절', '', ''] }));
  model.interference = null;
  model.single = true;
  model.scad = () => camScad(D, model);
  return model;
}
function capsulePts(A, B, r, n = 16) {
  const dx = B[0] - A[0], dy = B[1] - A[1], a = Math.atan2(dy, dx), out = [];
  for (let i = 0; i <= n; i++) { const t = a + PI / 2 + PI * i / n; out.push([A[0] + r * Math.cos(t), A[1] + r * Math.sin(t)]); }
  for (let i = 0; i <= n; i++) { const t = a - PI / 2 + PI * i / n; out.push([B[0] + r * Math.cos(t), B[1] + r * Math.sin(t)]); }
  return out;
}
// OpenSCAD: 캠은 계산된 형상을 그대로 polyhedron으로, 바닥판·축 구멍 등은 매개변수로
function camScad(D, model) {
  const cam = model.parts[0].tris, pts = [], idx = new Map(), faces = [];
  const key = (x, y, z) => `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
  for (const t of cam) { const f = []; for (let k = 0; k < 9; k += 3) { const kk = key(t[k], t[k + 1], t[k + 2]); if (!idx.has(kk)) { idx.set(kk, pts.length); pts.push(`[${kk}]`); } f.push(idx.get(kk)); } faces.push(`[${f[0]},${f[2]},${f[1]}]`); }
  return `// 기어 설계실: 캠 (OpenSCAD). 캠 윤곽(운동 곡선)은 앱에서 바꾸고 design.json으로 다시 불러오세요.
// 여기서는 캠 입체를 그대로 담았습니다. mode: "cam" | "assembly"
mode = "cam";
module cam() polyhedron(points = [${pts.join(',')}], faces = [${faces.join(',')}]);
cam();
`;
}
