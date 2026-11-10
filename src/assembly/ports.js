/* ================= 연결점(포트) =================
 기구 모델마다 다른 기구와 이어지는 자리를 붙임. 위치·방향은 기구 좌표(mm).
 port = { id, role:'in'|'out', kind:'rot'|'lin', at, dir(축이 기구 밖으로 나가는 방향), part(따라 움직이는 부품 번호), shaft:{d}, label,
          of(θin) → rot: dir 둘레 오른손 각도(rad, 처음 자세 기준) / lin: dir 방향 변위(mm) }
 θin 은 입력 포트 dir 둘레의 입력 각도. 모델 시간 t 와는 θin = rate·t (model.ports.rate). */
const V3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]), unit: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
const xfRot = A => [A[0], A[1], A[2], 0, A[4], A[5], A[6], 0, A[8], A[9], A[10], 0];
const xfDir = (A, d) => [A[0] * d[0] + A[1] * d[1] + A[2] * d[2], A[4] * d[0] + A[5] * d[1] + A[6] * d[2], A[8] * d[0] + A[9] * d[1] + A[10] * d[2]];
// 두 자세 A→B 의 상대 회전: 축 u, 각도 φ, 축 위의 한 점 c
function relRot(A, B) {
  const G = XF.mul(B, XF.inv(A)), w = [G[9] - G[6], G[2] - G[8], G[4] - G[1]], s = V3.len(w) / 2, c = (G[0] + G[5] + G[10] - 1) / 2, phi = Math.atan2(s, c);
  if (s < 1e-6) return { phi: c > 0 ? 0 : PI, u: null, G };
  const u = V3.mul(w, 1 / (2 * s)), t = [G[3], G[7], G[11]], tp = V3.sub(t, V3.mul(u, V3.dot(t, u)));
  const cpt = V3.mul(V3.add(tp, V3.mul(V3.cross(u, tp), 1 / Math.tan(phi / 2))), 0.5);
  return { phi, u, c: cpt, slide: V3.dot(t, u), G };
}
// 부품이 고정된 축 둘레로만 도는지 찾음: 축 방향, 축 위 점 (도는 동안 몇 자리에서 확인)
function partSpin(p, tq) {
  const A = p.motion(0); let best = null;
  for (const t of tq) { const r = relRot(A, p.motion(t)); if (r.u && Math.abs(Math.sin(r.phi / 2)) > 0.2) { best = r; break; } }
  if (!best) return null;
  for (const t of tq) { const r = relRot(A, p.motion(t)); if (!r.u) continue;
    if (Math.abs(Math.abs(V3.dot(r.u, best.u)) - 1) > 1e-4 || Math.abs(r.slide) > 1e-3) return null;
    const d = V3.sub(r.c, best.c); if (V3.len(V3.sub(d, V3.mul(best.u, V3.dot(d, best.u)))) > 0.05) return null; }
  return { u: best.u, c: best.c };
}
// dir 둘레 각도 (t=0 기준). 한 단계에 π 이상 넘지 않는다고 보고 이어 붙임
const spinAbout = (A0, A, d) => { const r = relRot(A0, A); return r.u ? r.phi * Math.sign(V3.dot(r.u, d)) : r.phi; };
// 입력 한 바퀴를 N등분한 표 → 바퀴 수만큼 늘어나는 양을 더함
function periodicFn(sample, N = 720) {
  const v = new Float64Array(N + 1); let prev = 0;
  for (let i = 0; i <= N; i++) { const th = 2 * PI * i / N; let x = sample(th);
    if (sample.wrap && i) { while (x - prev > PI) x -= 2 * PI; while (x - prev < -PI) x += 2 * PI; }
    v[i] = x; prev = x; }
  const adv = v[N] - v[0];
  const f = th => { const k = Math.floor(th / (2 * PI)), u = (th - k * 2 * PI) / (2 * PI) * N, i = Math.min(N - 1, Math.floor(u)), fr = u - i; return k * adv + v[i] + (v[i + 1] - v[i]) * fr - v[0]; };
  f.adv = adv; f.range = [Math.min(...v) - v[0], Math.max(...v) - v[0]];
  return f;
}
function partBox(p, t = 0) { return trisBounds(xfTris(p.tris, p.motion(t))); }
// 동작 기구의 출력 부품 (회전/직선). 차동 기어는 출력축 막대에서 찾음
const LK_PORTS = {
  slider: [{ id: 'out', part: '슬라이더', label: '슬라이더 왕복' }], yoke: [{ id: 'out', part: '요크', label: '요크 왕복' }],
  fourbar: [{ id: 'out', part: '흔들이', label: '흔들이 축 (흔들림)' }], jansen: [],
  geneva: [{ id: 'out', part: '제네바 바퀴', label: '바퀴 축 (간헐 회전)' }], ratchet: [{ id: 'out', part: '래칫 바퀴', label: '래칫 바퀴 축 (한 방향)' }],
  screw: [{ id: 'out', part: '너트', label: '너트 직선 이동' }],
};
function modelPorts(D, model) {
  if (model.ports) return model.ports;
  const parts = model.parts, rods = model.rods || [];
  // 시간 표본: 입력 회전 빠르기를 몰라도 적당한 각이 나오는 자리를 고름
  const tq = [1e-4, 3e-4, 1e-3, 3e-3, 0.006, 0.013, 0.031, 0.07, 0.11, 0.17, 0.23, 0.37, 0.53, 0.71, 1.1, 1.7, 2.3, 3.7];
  const all = parts.concat(model.housing || []).map(p => p.motion ? partBox(p) : trisBounds(p.tris));
  const lo = [0, 1, 2].map(a => Math.min(...all.map(b => b.lo[a]))), hi = [0, 1, 2].map(a => Math.max(...all.map(b => b.hi[a])));
  const cen = [0, 1, 2].map(a => (lo[a] + hi[a]) / 2);
  const spins = parts.map(p => partSpin(p, tq));
  const onRod = (a, b) => { const u = V3.unit(V3.sub(b, a));
    return spins.findIndex(s => s && Math.abs(Math.abs(V3.dot(s.u, u)) - 1) < 1e-3 && (d => V3.len(V3.sub(d, V3.mul(u, V3.dot(d, u)))) < 0.3)(V3.sub(s.c, a))); };
  const rodPort = (r, id, role) => {
    const far = V3.len(V3.sub(r.a, cen)) >= V3.len(V3.sub(r.b, cen)), at = far ? r.a : r.b, dir = V3.unit(V3.sub(at, far ? r.b : r.a)), k = onRod(r.a, r.b);
    return k < 0 ? null : { id, role, kind: 'rot', at: at.slice(), dir, part: k, shaft: { d: r.d } };
  };
  const ins = rods.filter(r => r.role === 'input').map(r => rodPort(r, 'in', 'in')).filter(Boolean);
  const P = { list: [], rate: 0 };
  if (!ins.length) return (model.ports = P);
  const pin = ins[0], A0 = parts[pin.part].motion(0);
  // 입력 빠르기 (rad/모델 시간): 짧은 시간에서 잼
  const t1 = tq.find(t => Math.abs(spinAbout(A0, parts[pin.part].motion(t), pin.dir)) > 0.05) || 1;
  P.rate = spinAbout(A0, parts[pin.part].motion(t1), pin.dir) / t1;
  if (Math.abs(P.rate) < 1e-9) return (model.ports = P);
  const tOf = th => th / P.rate;
  pin.of = th => th; pin.label = '입력축'; P.list.push(pin);
  if (D.kind === 'linkage' && LK_PORTS[D.type]) {
    for (const sp of LK_PORTS[D.type]) {
      const k = parts.findIndex(p => p.name === sp.part); if (k < 0) continue;
      const p = parts[k], b = partBox(p);
      if (spins[k]) {   // 고정 축 둘레 회전 → 위로 축을 뺌
        const s = spins[k], up = s.u[2] < 0 ? V3.mul(s.u, -1) : s.u, d = V3.sub([s.c[0], s.c[1], s.c[2]], [0, 0, 0]);
        const at = V3.add(V3.sub(d, V3.mul(up, V3.dot(d, up))), V3.mul(up, V3.dot([0, 0, b.hi[2]], up)));
        P.list.push({ ...sp, role: 'out', kind: 'rot', at, dir: up, part: k, shaft: { d: D.sd } });
      } else {          // 직선 이동: 가장 크게 움직이는 방향
        const T0 = p.motion(0); let best = [0, 0, 0];
        for (let i = 1; i < 24; i++) { const T = p.motion(tOf(2 * PI * i / 24)), dv = [T[3] - T0[3], T[7] - T0[7], T[11] - T0[11]]; if (V3.len(dv) > V3.len(best)) best = dv; }
        if (V3.len(best) < 1e-3) continue;
        const dir = V3.unit(best), at = [(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, b.hi[2]];
        P.list.push({ ...sp, role: 'out', kind: 'lin', at, dir, part: k });
      }
    }
  } else {
    let n = 0; rods.filter(r => r.role === 'output').forEach(r => { const q = rodPort(r, n ? 'out' + (n + 1) : 'out', 'out'); if (q) { n++; q.label = n > 1 ? `출력축 ${n}` : '출력축'; P.list.push(q); } });
    if (D.kind === 'linkage' && D.type === 'diff') P.list.filter(q => q.role === 'out').forEach((q, i) => q.label = `출력 ${'AB'[i] || i + 1}`);
  }
  for (const q of P.list) if (q.role === 'out') {
    const p = parts[q.part], T0 = p.motion(0);
    const smp = q.kind === 'rot' ? th => spinAbout(T0, p.motion(tOf(th)), q.dir) : th => { const T = p.motion(tOf(th)); return V3.dot([T[3] - T0[3], T[7] - T0[7], T[11] - T0[11]], q.dir); };
    smp.wrap = q.kind === 'rot';
    if (q.kind === 'rot') q.of = periodicFn(smp);
    else {   // 직선: 값을 바로 잼 (리드스크루처럼 여러 바퀴 뒤에 되돌아오는 것도 맞게). 범위는 기구 한 주기에서
      const span = Math.min(400 * PI, Math.max(2 * PI, Math.abs(P.rate) * (isFinite(model.period) ? model.period : 0))), N = 720; let a = Infinity, b = -Infinity;
      for (let i = 0; i <= N; i++) { const v = smp(span * i / N); a = Math.min(a, v); b = Math.max(b, v); }
      q.of = smp; q.of.range = [a, b]; q.of.adv = 0;
    }
  }
  return (model.ports = P);
}
