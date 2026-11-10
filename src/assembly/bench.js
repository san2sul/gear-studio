/* ================= 조립 작업대 (1단계: 직렬 구동 사슬) =================
 design = { kind:'asm', rpm, motor, mods:[{ design, from:'out'|'out2', link:{ kind:'shaft'|'mesh'|'belt', zA, zB, m, ang } }] }
 첫 기구가 동력원을 받고, 다음 기구는 앞 기구의 출력 포트(from)에 이음(link)으로 이어짐. link.ang 는 옆으로 놓는 방향(°)
 모듈 k 의 입력 각도 θk 를 차례로 구하고, 그 기구의 시간 t = θk / rate 로 움직임을 돌림 */
const ASM_KINDS = { shaft: '축 직결 (커플링)', mesh: '기어 물림', belt: '벨트 (GT2)' };
const ASM_PULLEY = [16, 20, 24, 30, 36, 40, 60];
const ASM_BELTS = [100, 110, 122, 140, 158, 200, 232, 280, 300, 400, 500, 610, 852, 1000];
function asmDefault() {
  const L = linkageDefault(); L.type = 'geneva'; L.drive.motor = 'auto';
  const S = linkageDefault(); S.type = 'slider';
  return { version: 1, kind: 'asm', mods: [{ design: L }, { design: S, from: 'out', link: { kind: 'belt', zA: 20, zB: 20, m: 1, ang: 'auto' } }] };
}
function asmLinkFix(L) { return Object.assign({ kind: 'shaft', zA: 20, zB: 20, m: 1, ang: 'auto' }, L || {}); }
// 축 z 를 w 로 보내는 틀 (x 축은 ref 를 w 에 수직으로 깎은 것)
function frameOf(o, w, ref) {
  let x = V3.sub(ref, V3.mul(w, V3.dot(ref, w)));
  if (V3.len(x) < 1e-6) { const r2 = Math.abs(w[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; x = V3.sub(r2, V3.mul(w, V3.dot(r2, w))); }
  x = V3.unit(x); const y = V3.cross(w, x);
  return XF.basis(x, y, w, o);
}
// a 를 b 로 돌리는 최소 회전
function alignRot(a, b) {
  const c = V3.dot(a, b), v = V3.cross(a, b), s = V3.len(v);
  if (s < 1e-9) { if (c > 0) return XF.I(); const p = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], u = V3.unit(V3.cross(a, p)); return rotAxis(u, PI); }
  return rotAxis(V3.mul(v, 1 / s), Math.atan2(s, c));
}
function rotAxis(u, f) {
  const c = Math.cos(f), s = Math.sin(f), k = 1 - c, [x, y, z] = u;
  return [c + x * x * k, x * y * k - z * s, x * z * k + y * s, 0, y * x * k + z * s, c + y * y * k, y * z * k - x * s, 0, z * x * k - y * s, z * y * k + x * s, c + z * z * k, 0];
}
function beltLen(C, rA, rB) { return 2 * C + PI * (rA + rB) + (rA - rB) ** 2 / C; }
function beltC(L, rA, rB) { let C = Math.max(rA + rB + 2, (L - PI * (rA + rB)) / 2); for (let i = 0; i < 40; i++) C = (L - PI * (rA + rB) - (rA - rB) ** 2 / C) / 2; return C; }
// 열린 벨트 둘레 선 (틀 좌표, 두 바퀴 중심 (0,0)과 (C,0))
function beltLoop(C, rA, rB) {
  const b = Math.asin((rA - rB) / C), pts = [], arc = (cx, r, a0, a1) => { for (let i = 0; i <= 24; i++) { const f = a0 + (a1 - a0) * i / 24; pts.push([cx + r * Math.cos(f), r * Math.sin(f), 0]); } };
  arc(0, rA, PI / 2 + b, 3 * PI / 2 - b); arc(C, rB, -PI / 2 - b, PI / 2 + b); pts.push(pts[0]);
  return pts;
}
function asmModel(D) {
  const mods = D.mods || [], model = { kind: 'asm', parts: [], housing: [], rods: [], extras: [], checks: [], notes: [], frame: true, single: false, interference: null };
  if (!mods.length) throw new Error('기구가 없습니다');
  const M = [], bom = new Map(), addBom = (n, c, note = '') => { const k = n + '|' + note; const o = bom.get(k) || [n, 0, note]; o[1] += c; bom.set(k, o); };
  const rows = [], steps = [], links = [];
  mods.forEach((md, k) => {
    const d = JSON.parse(JSON.stringify(md.design));
    if (k > 0 && d.drive) { d.drive.motor = 'none'; }
    let m; try { m = buildModel(d); } catch (e) { throw new Error(`${k + 1}번 기구를 만들 수 없습니다: ${e && e.message || e}`); }
    const P = modelPorts(d, m), pin = P.list.find(q => q.role === 'in');
    const lb = trisBounds([].concat(...m.parts.map(p => xfTris(p.tris, p.motion(0))), ...m.housing.filter(h => h.assembly !== false).map(h => h.tris)));
    M.push({ d, m, P, pin, pose: XF.I(), name: asmName(d), lb });
  });
  // 자세 맞춤과 이음 부품
  for (let k = 1; k < M.length; k++) {
    const A = M[k - 1], B = M[k], L = asmLinkFix(mods[k].link), qa = A.P.list.find(q => q.id === (mods[k].from || 'out') && q.role === 'out') || A.P.list.find(q => q.role === 'out');
    const lk = { k, L, qa, ok: false };
    links.push(lk);
    if (!qa) { model.checks.push({ st: 'bad', txt: `${k}번 ${A.name}에는 다음 기구로 이을 출력축이 없습니다 (발끝 궤적처럼 끝에서 쓰는 동작).` }); B.pose = XF.T(asmRight(M, k), 0, 0); continue; }
    if (qa.kind !== 'rot') { model.checks.push({ st: 'bad', txt: `${k}번 ${A.name}의 출력은 직선 운동이라 아직 회전 기구로 이을 수 없습니다 (랙·캠 이음은 다음 단계).` }); B.pose = XF.T(asmRight(M, k), 0, 0); continue; }
    if (!B.pin) { model.checks.push({ st: 'bad', txt: `${k + 1}번 ${B.name}에서 입력축을 찾지 못했습니다.` }); B.pose = XF.T(asmRight(M, k), 0, 0); continue; }
    const wA = V3.unit(xfDir(A.pose, qa.dir)), oA = XF.apply(A.pose, qa.at), dA = qa.shaft ? qa.shaft.d : 5, dB = B.pin.shaft ? B.pin.shaft.d : 5;
    const ref = xfDir(A.pose, [1, 0, 0]), F0 = frameOf([0, 0, 0], wA, ref), auto = L.kind !== 'shaft' && !isFinite(+L.ang) || L.ang === 'auto';
    let perp = null;
    let g, side = 0, plane = 0;
    if (L.kind === 'shaft') { g = 30; }
    else if (L.kind === 'mesh') {
      const m = L.m || 1, gA = { m, z: L.zA, pa: 20, x: 0, b: 6, backlash: 0.1 }, gB = { ...gA, z: L.zB }; side = meshGeom(gA, gB).cd; plane = 8; g = 2 * plane;
      lk.gears = { gA, gB, cd: side };
    } else {
      const rA = L.zA * 2 / (2 * PI), rB = L.zB * 2 / (2 * PI), want = beltLen(Math.max(rA + rB + 20, 60), rA, rB);
      const i0 = Math.max(0, ASM_BELTS.findIndex(x => x >= want)), Ls = ASM_BELTS.slice(i0 < 0 ? ASM_BELTS.length - 1 : i0, (i0 < 0 ? ASM_BELTS.length - 1 : i0) + 4);
      plane = 10; g = 2 * plane; lk.belts = Ls.map(Lb => ({ rA, rB, Lb, C: beltC(Lb, rA, rB) })); side = lk.belts[0].C; lk.belt = lk.belts[0];
    }
    // B 의 입력 dir 를 −wA 로, 입력 자리를 oA + wA·g + perp·side 로
    // B 를 놓을 방향: 자동이면 앞 기구들과 상자가 가장 덜 겹치는 쪽 (같으면 오른쪽부터)
    const R = alignRot(V3.unit(B.pin.dir), V3.mul(wA, -1)), p0 = XF.apply(R, B.pin.at);
    const poseAt = (a, side) => { const pp = xfDir(F0, [Math.cos(a * D2R), Math.sin(a * D2R), 0]), tgt = V3.add(V3.add(oA, V3.mul(wA, g)), V3.mul(pp, side));
      return { pp, pose: XF.mul(XF.T(tgt[0] - p0[0], tgt[1] - p0[1], tgt[2] - p0[2]), R) }; };
    let best = null;
    // 벨트는 겹치면 한 치수 긴 벨트로 더 멀리 놓아 봄
    for (const bt of lk.belts && auto ? lk.belts : [lk.belt || null]) for (const a of auto ? [0, 30, 330, 60, 300, 90, 270, 120, 240, 150, 210, 180] : [+L.ang || 0]) {
      if (best && best.ov <= 1) break;
      const c = poseAt(a, bt ? bt.C : side), wb = boxXf(B.lb, c.pose); let ov = 0;
      for (let i = 0; i < k; i++) ov += boxOverlap(wb, boxXf(M[i].lb, M[i].pose));
      if (!best || ov < best.ov - 1) best = { ...c, ov, a, bt };
    }
    B.pose = best.pose; perp = best.pp; lk.ang = best.a; if (best.bt) { lk.belt = best.bt; side = best.bt.C; }
    Object.assign(lk, { ok: true, wA, oA, perp, g, side, plane, dA, dB, F: frameOf(oA, wA, perp) });
    const oB = XF.apply(B.pose, B.pin.at);
    if (L.kind === 'shaft') {
      const pc = STD.coupling.mk({ d1: dA, d2: dB, type: 'rigid' })[0], cz = 21;
      lk.parts = [{ name: `커플링 ${dA}→${dB}`, file: `coupling_${dA}_${dB}`, tris: pc.tris, frame: XF.mul(lk.F, XF.T(0, 0, g / 2 - cz / 2)), spin: 'A' }];
      model.rods.push({ a: oA, b: V3.add(oA, V3.mul(wA, g / 2 + 8)), d: dA }, { a: oB, b: V3.sub(oB, V3.mul(wA, g / 2 + 8)), d: dB });
      addBom(`커플링 ${dA}→${dB} mm`, 1, '고정형 또는 조 커플링');
      steps.push(`${k}번 출력축과 ${k + 1}번 입력축을 커플링(${dA}→${dB} mm)으로 잇고 멈춤나사를 D컷 면에 조입니다.`);
    } else if (L.kind === 'mesh') {
      const { gA, gB, cd } = lk.gears, gT = (g0, d) => extrudeTris(gearOutline(g0).pts, [borePts(d + 0.1, 0.5, 32)], 6);
      lk.parts = [{ name: `이음 기어 ${gA.z}T`, file: `link${k}_gear_m${gA.m}_z${gA.z}`, tris: gT(gA, dA), frame: XF.mul(lk.F, XF.T(0, 0, plane - 3)), spin: 'A' },
        { name: `이음 기어 ${gB.z}T`, file: `link${k}_gear_m${gB.m}_z${gB.z}`, tris: gT(gB, dB), frame: XF.mul(lk.F, XF.T(cd, 0, plane - 3)), spin: 'B', ph: PI + PI / gB.z }];
      model.rods.push({ a: oA, b: V3.add(oA, V3.mul(wA, plane + 5)), d: dA }, { a: oB, b: V3.sub(oB, V3.mul(wA, plane + 5)), d: dB });
      model.checks.push({ st: 'ok', txt: `${k}→${k + 1}번 기어 물림: 모듈 ${gA.m}, ${gA.z}:${gB.z}, 중심거리 <em>${fmt(cd, 2)} mm</em>, 비 ${fmt(gB.z / gA.z, 3)}` });
      steps.push(`${k}번 출력축에 ${gA.z}T, ${k + 1}번 입력축에 ${gB.z}T 기어를 끼우고 같은 높이로 맞춥니다 (중심거리 ${fmt(cd, 2)} mm).`);
    } else {
      const { rA, rB, Lb, C } = lk.belt, pz = 9.5;
      const pA = STD.pulley.mk({ z: String(L.zA), d: dA, dcut: 'dcut' })[0], pB = STD.pulley.mk({ z: String(L.zB), d: dB, dcut: 'dcut' })[0];
      lk.parts = [{ name: `GT2 풀리 ${L.zA}T`, file: `link${k}_pulley_${L.zA}T_d${dA}`, tris: pA.tris, frame: XF.mul(lk.F, XF.T(0, 0, plane - pz)), spin: 'A' },
        { name: `GT2 풀리 ${L.zB}T`, file: `link${k}_pulley_${L.zB}T_d${dB}`, tris: pB.tris, frame: XF.mul(lk.F, XF.T(C, 0, plane - pz)), spin: 'B' }];
      model.extras.push({ line: beltLoop(C, rA + 0.6, rB + 0.6).map(p => XF.apply(lk.F, [p[0], p[1], plane])), color: '#c9773a' });
      model.rods.push({ a: oA, b: V3.add(oA, V3.mul(wA, plane + 6)), d: dA }, { a: oB, b: V3.sub(oB, V3.mul(wA, plane + 6)), d: dB });
      addBom(`GT2 풀리 ${L.zA}T (구멍 ${dA})`, 1); addBom(`GT2 풀리 ${L.zB}T (구멍 ${dB})`, 1); addBom(`GT2 폐루프 벨트 ${Lb} mm (폭 6)`, 1);
      model.checks.push({ st: 'ok', txt: `${k}→${k + 1}번 벨트: GT2 ${L.zA}T:${L.zB}T, 벨트 <em>${Lb} mm</em>, 축 사이 ${fmt(C, 1)} mm, 비 ${fmt(L.zB / L.zA, 3)}` });
      steps.push(`${k}번 출력축과 ${k + 1}번 입력축에 풀리(${L.zA}T, ${L.zB}T)를 끼우고 ${Lb} mm 벨트를 겁니다. 축 사이 ${fmt(C, 1)} mm.`);
    }
  }
  // 각도 사슬: 시간 t → 각 기구의 입력 각도
  const rate0 = M[0].P.rate || 1;
  let memoT = NaN, memo = null;
  const chain = t => {
    if (t === memoT) return memo;
    const th = [rate0 * t], phi = [null];
    for (let k = 1; k < M.length; k++) {
      const lk = links[k - 1];
      if (!lk.ok) { th.push(0); phi.push(null); continue; }
      const a = lk.qa.of(th[k - 1]), L = lk.L, r = L.kind === 'shaft' ? 1 : L.kind === 'mesh' ? -L.zA / L.zB : L.zA / L.zB, b = a * r;
      phi.push({ a, b }); th.push(-b);   // B 입력 dir = −wA
    }
    memoT = t; memo = { th, phi }; return memo;
  };
  model.chain = chain;
  // 부품 합치기
  M.forEach((X, k) => {
    const rate = X.P.rate || 1, tag = `${k + 1}·`, pf = `m${k + 1}_`;
    X.first = model.parts.length;
    X.m.parts.forEach(p => model.parts.push({ name: tag + p.name, file: pf + p.file, tris: p.tris, print: p.print, ghost: p.ghost, mod: k,
      motion: t => XF.mul(X.pose, p.motion(chain(t).th[k] / rate)) }));
    X.m.housing.forEach(h => model.housing.push({ ...h, name: tag + h.name, file: pf + h.file, tris: xfTris(h.tris, X.pose), printTris: h.tris, mod: k }));
    (X.m.rods || []).forEach(r => model.rods.push({ ...r, a: XF.apply(X.pose, r.a), b: XF.apply(X.pose, r.b), role: k === 0 && r.role === 'input' ? 'input' : k === M.length - 1 && r.role === 'output' ? 'output' : undefined }));
    (X.m.extras || []).forEach(x => model.extras.push(x.line ? { ...x, line: x.line.map(p => XF.apply(X.pose, p)) } : { ...x, tris: xfTris(x.tris, X.pose) }));
    (X.m.checks || []).forEach(c => { if (k === 0 || c.st !== 'ok' || !/토크|모터/.test(c.txt)) model.checks.push({ st: c.st, txt: `${k + 1}번 ${X.name}: ${c.txt}` }); });
    (X.m.bom || []).forEach(b => { if (k > 0 && /모터|드라이버|아두이노|전원|배터리|어댑터|스위치|퓨즈|점퍼|버튼/.test(b[0])) return; addBom(b[0], b[1], b[2] || ''); });
    (X.m.steps || []).forEach(s => steps.push(`[${k + 1}번 ${X.name}] ${s}`));
  });
  // 이음 부품은 앞(A) 또는 뒤(B) 축과 함께 돎
  links.forEach(lk => (lk.parts || []).forEach(q => model.parts.push({ name: `이음 ${lk.k}→${lk.k + 1}: ${q.name}`, file: q.file, tris: q.tris, mod: -1,
    motion: t => { const c = chain(t).phi[lk.k]; return XF.mul(q.frame, XF.Rz((q.ph || 0) + (c ? (q.spin === 'A' ? c.a : c.b) : 0))); } })));
  // 기구끼리 겹침 (처음 자세의 상자)
  const boxOf = k => { const ts = model.parts.filter(p => p.mod === k).map(p => xfTris(p.tris, p.motion(0))).concat(model.housing.filter(h => h.mod === k && h.assembly !== false).map(h => h.tris)); return trisBounds([].concat(...ts)); };
  const bx = M.map((_, k) => boxOf(k));
  for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) {
    const ov = [0, 1, 2].map(a => Math.min(bx[i].hi[a], bx[j].hi[a]) - Math.max(bx[i].lo[a], bx[j].lo[a]));
    if (ov.every(v => v > 0.5)) model.checks.push({ st: 'warn', txt: `${i + 1}번과 ${j + 1}번 기구의 자리가 겹칩니다 (${ov.map(v => fmt(v, 0)).join('×')} mm). 이음을 벨트로 바꾸거나 놓는 방향(각도)을 돌려 보세요.` });
  }
  // 한 방향으로만 도는 기구(래칫)가 거꾸로 돌려지는지
  { const T = m0Period(M[0].m), c = chain(T);
    M.forEach((X, k) => { if (k && X.d.kind === 'linkage' && X.d.type === 'ratchet' && links[k - 1].ok && c.th[k] / (X.P.rate || 1) < -1e-6)
      model.checks.push({ st: 'bad', txt: `${k + 1}번 래칫 기구가 거꾸로 돌려져 멈춤쇠에 걸립니다. 이음을 기어 물림↔벨트로 바꾸거나 기어를 하나 더 넣어 방향을 뒤집으세요.` }); }); }
  // 끝 출력과 비
  const last = M[M.length - 1], outs = last.P.list.filter(q => q.role === 'out');
  const thEnd = th0 => { let th = th0; for (let k = 1; k < M.length; k++) { const lk = links[k - 1]; if (!lk.ok) return null; const L = lk.L, r = L.kind === 'shaft' ? 1 : L.kind === 'mesh' ? -L.zA / L.zB : L.zA / L.zB; th = -lk.qa.of(th) * r; } return th; };
  const m0 = M[0].m, rpm = m0.thOf ? m0.thOf(1) * 60 / (2 * PI) : (M[0].d.rpm || 0);
  const rev = thEnd(2 * PI);
  model.hud = [['입력', fmt(rpm, 1) + ' rpm'], ['기구', M.length + '개']];
  if (rev !== null) model.hud.push([`${M.length}번 입력`, `입력 1바퀴에 ${fmt(Math.abs(rev) / (2 * PI), 3)}바퀴`]);
  outs.forEach(q => { if (rev === null) return; const f = q.of; model.hud.push([`끝 출력 ${q.label || q.id}`, q.kind === 'rot' ? `${fmt((f.range[1] - f.range[0]) / D2R, 0)}° 범위` : `${fmt(f.range[1] - f.range[0], 1)} mm 행정`]); });
  model.table = { head: ['#', '기구', '이음', '출력'], rows: M.map((X, k) => ({ part: X.first, cells: [String(k + 1), X.name, k ? (links[k - 1].ok ? ASM_KINDS[links[k - 1].L.kind] : '이어지지 않음') : '동력원', X.P.list.filter(q => q.role === 'out').map(q => q.label || q.id).join(', ') || '끝 동작'] })) };
  model.bom = [...bom.values()]; model.steps = steps;
  model.kit = m0.kit; model.shaftRows = null;
  model.period = m0.period; model.thOf = m0.thOf;
  model.scad = () => '// 조립 작업대: 부품별 STL을 쓰세요. (조립은 assembly.stl)\n';
  model.mods = M.map(X => ({ name: X.name, ports: X.P.list.map(q => ({ id: q.id, role: q.role, kind: q.kind, label: q.label })) }));
  model.notes.push('조립 작업대 1단계: 기구를 한 줄로 이어 함께 돌립니다. 각 기구 받침은 따로 있어 실제 장치에서는 판이나 프로파일에 함께 고정합니다.');
  return model;
}
function m0Period(m) { return m.period && isFinite(m.period) ? m.period : 1; }
function boxXf(b, A) { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < 8; i++) { const q = XF.apply(A, [i & 1 ? b.hi[0] : b.lo[0], i & 2 ? b.hi[1] : b.lo[1], i & 4 ? b.hi[2] : b.lo[2]]); for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], q[a]); hi[a] = Math.max(hi[a], q[a]); } }
  return { lo, hi }; }
function boxOverlap(a, b) { let v = 1; for (let i = 0; i < 3; i++) { const o = Math.min(a.hi[i], b.hi[i]) - Math.max(a.lo[i], b.lo[i]); if (o <= 0) return 0; v *= o; } return v; }
function asmName(d) {
  if (d.kind === 'linkage') return LK_KO[d.type] || d.type;
  return ({ spur: '평기어', gearbox: '기어박스', bevel: '베벨 기어', planetary: '유성 기어', rack: '랙·피니언', worm: '웜 기어', cycloid: '사이클로이드', cam: '캠', train: '기어열' })[d.kind] || d.kind;
}
function asmRight(M, k) { let x = 0; for (let i = 0; i < k; i++) { const b = trisBounds([].concat(...M[i].m.parts.map(p => xfTris(p.tris, p.motion(0))))); x = Math.max(x, b.hi[0] + 30); } return x + 40; }
