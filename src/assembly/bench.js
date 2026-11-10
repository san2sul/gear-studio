/* ================= 조립 작업대 (구동 사슬 · 갈래) =================
 design = { kind:'asm', rpm, motor, mods:[{ design, src(이을 앞 기구 번호, 0부터 · 기본 바로 앞), from:'out'|'out2', link:{ kind:'shaft'|'mesh'|'belt', zA, zB, m, ang } }] }
 첫 기구가 동력원을 받고, 다음 기구는 앞 기구의 출력 포트(from)에 이음(link)으로 이어짐. link.ang 는 옆으로 놓는 방향(°)
 모듈 k 의 입력 각도 θk 를 차례로 구하고, 그 기구의 시간 t = θk / rate 로 움직임을 돌림 */
const ASM_KINDS = { shaft: '축 직결 (커플링)', mesh: '기어 물림', belt: '벨트 (GT2)', rack: '랙·피니언 (직선→회전)' };
// 이음 비: 뒤 각도 = 앞 값 × 비 (앞 값은 회전이면 rad, 직선이면 mm)
function asmRatio(L) { return L.kind === 'shaft' ? 1 : L.kind === 'mesh' ? -L.zA / L.zB : L.kind === 'rack' ? 2 / ((L.m || 1) * (L.zB || 16)) : L.zA / L.zB; }
const ASM_ETA = { shaft: 0.98, mesh: 0.95, belt: 0.95, rack: 0.9 };
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
  const mk = (d, k) => { let m; try { m = buildModel(d, { sub: true }); } catch (e) { throw new Error(`${k + 1}번 기구를 만들 수 없습니다: ${e && e.message || e}`); }
    const P = modelPorts(d, m), pin = P.list.find(q => q.role === 'in');
    const lb = trisBounds([].concat(...m.parts.map(p => xfTris(p.tris, p.motion(0))), ...m.housing.filter(h => h.assembly !== false).map(h => h.tris)));
    return { d, m, P, pin, pose: XF.I(), name: asmName(d), lb }; };
  const drv0 = mods[0].design.drive ? mods[0].design.drive.motor : 'none';
  const base = D.base !== false;
  mods.forEach((md, k) => { const d = JSON.parse(JSON.stringify(md.design)); if (d.drive) { d.drive.motor = 'none'; delete d.drive.extraT; } if (d.kind === 'linkage') d.cornerHoles = base; M.push(mk(d, k)); });
  // 부하 거슬러 계산: 뒤 기구 입력에 필요한 토크 × 최대 속도비 ÷ 이음 효율 을 앞 기구 출력에 더함 (N·mm, 한 바퀴 중 최댓값끼리 더해 안전 쪽)
  const own = X => X.d.kind === 'linkage' ? (v => isFinite(v) ? v : 0)(linkLoadT(X.d, linkMotion(X.d, 180))) : 0;
  // 갈래: 각 기구는 앞 번호의 어느 기구(src)에든 이어짐 (기본은 바로 앞)
  const srcOf = k => { const v = Math.round(+mods[k].src); return k > 0 && v >= 0 && v < k ? v : k - 1; };
  model.srcs = mods.map((_, k) => k ? srcOf(k) : -1);
  const portOf = k => { const L = mods[k] || {}, S = M[srcOf(k)]; return S.P.list.find(q => q.id === (L.from || 'out') && q.role === 'out') || S.P.list.find(q => q.role === 'out'); };
  const req = M.map(own), gain = new Array(M.length).fill(0);
  // 뒤에서부터 자식 부하(× 최대 속도비 ÷ 효율)를 부모에 더함. 갈래가 여럿이면 모두 합침
  for (let k = M.length - 1; k >= 1; k--) {
    const q = portOf(k), L = asmLinkFix(mods[k].link); if (!q) continue;
    if (q.kind === 'lin') L.kind = 'rack'; else if (L.kind === 'rack') L.kind = 'mesh';
    let g = 0; for (let i = 0; i < 360; i++) g = Math.max(g, Math.abs(q.of((i + 1) * PI / 180) - q.of(i * PI / 180)) / (PI / 180));
    gain[k] = g * Math.abs(asmRatio(L)) / ASM_ETA[L.kind]; req[srcOf(k)] += req[k] * gain[k];
  }
  model.loads = { own: M.map(own), req, gain };
  if (drv0 !== 'none' && mods[0].design.drive) {   // 1번 기구에 뒤 기구들의 부하를 얹어 모터를 다시 고름
    const d = JSON.parse(JSON.stringify(mods[0].design)); d.drive.motor = drv0; if (d.kind === 'linkage') d.cornerHoles = base; d.drive.extraT = req[0] - model.loads.own[0]; M[0] = mk(d, 0);
  }
  if (M.length > 1) model.checks.push({ st: 'ok', txt: `동력원이 감당할 입력 토크(한 바퀴 중 최대): 1번 자체 ${fmt(model.loads.own[0] / 10, 2)} + 뒤 기구들 ${fmt((req[0] - model.loads.own[0]) / 10, 2)} = <em>${fmt(req[0] / 10, 2)} N·cm</em>` });
  // 자세 맞춤과 이음 부품
  for (let k = 1; k < M.length; k++) {
    const si = srcOf(k), A = M[si], B = M[k], L = asmLinkFix(mods[k].link), qa = portOf(k), sn = si + 1;
    // 같은 출력에 먼저 이어진 기구 수: 기어·벨트는 층을 올려 겹치지 않게, 축 직결·랙은 하나만
    const sibs = links.filter(o => o.ok && o.src === si && o.qa === qa), sib = sibs.length, sibHard = sibs.some(o => o.L.kind === 'shaft' || o.L.kind === 'rack');
    const lk = { k, src: si, L, qa, ok: false };
    links.push(lk);
    if (!qa) { model.checks.push({ st: 'bad', txt: `${sn}번 ${A.name}에는 다음 기구로 이을 출력축이 없습니다 (발끝 궤적처럼 끝에서 쓰는 동작).` }); B.pose = XF.T(asmRight(M, k), 0, 0); continue; }
    if (!B.pin) { model.checks.push({ st: 'bad', txt: `${k + 1}번 ${B.name}에서 입력축을 찾지 못했습니다.` }); B.pose = XF.T(asmRight(M, k), 0, 0); continue; }
    // 직선 출력은 랙·피니언으로만, 회전 출력은 랙을 쓸 수 없음
    if (qa.kind === 'lin') L.kind = 'rack'; else if (L.kind === 'rack') L.kind = 'mesh';
    if (sibHard || sib && (L.kind === 'shaft' || L.kind === 'rack')) { model.checks.push({ st: 'bad', txt: `${sn}번 ${A.name}의 그 출력에는 이미 다른 기구가 이어져 있어 ${k + 1}번을 ${L.kind === 'shaft' ? '축 직결로' : '랙으로'} 또 이을 수 없습니다. ${L.kind === 'shaft' ? '기어 물림이나 벨트로 바꾸세요.' : '다른 출력을 고르세요.'}` }); B.pose = XF.T(asmRight(M, k), 0, 0); continue; }
    if (L.kind === 'rack') { asmRackLink(A, B, L, qa, lk, k, model, steps, sn); continue; }
    const wA = V3.unit(xfDir(A.pose, qa.dir)), oA = XF.apply(A.pose, qa.at), dA = qa.shaft ? qa.shaft.d : 5, dB = B.pin.shaft ? B.pin.shaft.d : 5;
    const ref = xfDir(A.pose, [1, 0, 0]), F0 = frameOf([0, 0, 0], wA, ref), auto = L.kind !== 'shaft' && !isFinite(+L.ang) || L.ang === 'auto';
    let perp = null;
    let g, side = 0, plane = 0;
    if (L.kind === 'shaft') { g = 30; }
    else if (L.kind === 'mesh') {
      const m = L.m || 1, gA = { m, z: L.zA, pa: 20, x: 0, b: 6, backlash: 0.1 }, gB = { ...gA, z: L.zB }; side = meshGeom(gA, gB).cd; plane = 8 + 18 * sib; g = 2 * plane;
      lk.gears = { gA, gB, cd: side };
    } else {
      const rA = L.zA * 2 / (2 * PI), rB = L.zB * 2 / (2 * PI), want = beltLen(Math.max(rA + rB + 20, 60), rA, rB);
      const i0 = Math.max(0, ASM_BELTS.findIndex(x => x >= want)), Ls = ASM_BELTS.slice(i0 < 0 ? ASM_BELTS.length - 1 : i0, (i0 < 0 ? ASM_BELTS.length - 1 : i0) + 4);
      plane = 10 + 18 * sib; g = 2 * plane; lk.belts = Ls.map(Lb => ({ rA, rB, Lb, C: beltC(Lb, rA, rB) })); side = lk.belts[0].C; lk.belt = lk.belts[0];
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
      steps.push(`${sn}번 출력축과 ${k + 1}번 입력축을 커플링(${dA}→${dB} mm)으로 잇고 멈춤나사를 D컷 면에 조입니다.`);
    } else if (L.kind === 'mesh') {
      const { gA, gB, cd } = lk.gears, gT = (g0, d) => extrudeTris(gearOutline(g0).pts, [borePts(d + 0.1, 0.5, 32)], 6);
      lk.parts = [{ name: `이음 기어 ${gA.z}T`, file: `link${k}_gear_m${gA.m}_z${gA.z}`, tris: gT(gA, dA), frame: XF.mul(lk.F, XF.T(0, 0, plane - 3)), spin: 'A' },
        { name: `이음 기어 ${gB.z}T`, file: `link${k}_gear_m${gB.m}_z${gB.z}`, tris: gT(gB, dB), frame: XF.mul(lk.F, XF.T(cd, 0, plane - 3)), spin: 'B', ph: PI + PI / gB.z }];
      model.rods.push({ a: oA, b: V3.add(oA, V3.mul(wA, plane + 5)), d: dA }, { a: oB, b: V3.sub(oB, V3.mul(wA, plane + 5)), d: dB });
      model.checks.push({ st: 'ok', txt: `${sn}→${k + 1}번 기어 물림: 모듈 ${gA.m}, ${gA.z}:${gB.z}, 중심거리 <em>${fmt(cd, 2)} mm</em>, 비 ${fmt(gB.z / gA.z, 3)}` });
      steps.push(`${sn}번 출력축에 ${gA.z}T, ${k + 1}번 입력축에 ${gB.z}T 기어를 끼우고 같은 높이로 맞춥니다 (중심거리 ${fmt(cd, 2)} mm).`);
    } else {
      const { rA, rB, Lb, C } = lk.belt, pz = 9.5;
      const pA = STD.pulley.mk({ z: String(L.zA), d: dA, dcut: 'dcut' })[0], pB = STD.pulley.mk({ z: String(L.zB), d: dB, dcut: 'dcut' })[0];
      lk.parts = [{ name: `GT2 풀리 ${L.zA}T`, file: `link${k}_pulley_${L.zA}T_d${dA}`, tris: pA.tris, frame: XF.mul(lk.F, XF.T(0, 0, plane - pz)), spin: 'A' },
        { name: `GT2 풀리 ${L.zB}T`, file: `link${k}_pulley_${L.zB}T_d${dB}`, tris: pB.tris, frame: XF.mul(lk.F, XF.T(C, 0, plane - pz)), spin: 'B' }];
      model.extras.push({ line: beltLoop(C, rA + 0.6, rB + 0.6).map(p => XF.apply(lk.F, [p[0], p[1], plane])), color: '#c9773a' });
      model.rods.push({ a: oA, b: V3.add(oA, V3.mul(wA, plane + 6)), d: dA }, { a: oB, b: V3.sub(oB, V3.mul(wA, plane + 6)), d: dB });
      addBom(`GT2 풀리 ${L.zA}T (구멍 ${dA})`, 1); addBom(`GT2 풀리 ${L.zB}T (구멍 ${dB})`, 1); addBom(`GT2 폐루프 벨트 ${Lb} mm (폭 6)`, 1);
      model.checks.push({ st: 'ok', txt: `${sn}→${k + 1}번 벨트: GT2 ${L.zA}T:${L.zB}T, 벨트 <em>${Lb} mm</em>, 축 사이 ${fmt(C, 1)} mm, 비 ${fmt(L.zB / L.zA, 3)}` });
      steps.push(`${sn}번 출력축과 ${k + 1}번 입력축에 풀리(${L.zA}T, ${L.zB}T)를 끼우고 ${Lb} mm 벨트를 겁니다. 축 사이 ${fmt(C, 1)} mm.`);
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
      const a = lk.qa.of(th[lk.src]), L = lk.L, r = asmRatio(L), b = a * r;
      phi.push({ a, b }); th.push(-b);   // B 입력 dir = −wA
    }
    memoT = t; memo = { th, phi }; return memo;
  };
  model.chain = chain;
  const ties = asmTies(mods, M, links, chain, model, addBom, steps);
  // 부품 합치기
  M.forEach((X, k) => {
    const rate = X.P.rate || 1, tag = `${k + 1}·`, pf = `m${k + 1}_`;
    X.first = model.parts.length;
    X.m.parts.forEach(p => model.parts.push({ name: tag + p.name, file: pf + p.file, tris: p.tris, print: p.print, ghost: p.ghost, mod: k,
      motion: t => XF.mul(X.pose, p.motion(chain(t).th[k] / rate)) }));
    X.m.housing.forEach(h => model.housing.push({ ...h, name: tag + h.name, file: pf + h.file, tris: xfTris(h.tris, X.pose), printTris: h.tris, mod: k }));
    (X.m.rods || []).forEach(r => model.rods.push({ ...r, a: XF.apply(X.pose, r.a), b: XF.apply(X.pose, r.b), role: k === 0 && r.role === 'input' ? 'input' : k && !links.some(o => o.src === k) && r.role === 'output' ? 'output' : undefined }));
    (X.m.extras || []).forEach(x => model.extras.push(x.line ? { ...x, line: x.line.map(p => XF.apply(X.pose, p)) } : { ...x, tris: xfTris(x.tris, X.pose) }));
    (X.m.checks || []).forEach(c => { if (k === 0 || c.st !== 'ok' || !/토크|모터/.test(c.txt)) model.checks.push({ st: c.st, txt: `${k + 1}번 ${X.name}: ${c.txt}` }); });
    (X.m.bom || []).forEach(b => { if (k > 0 && /모터|드라이버|아두이노|전원|배터리|어댑터|스위치|퓨즈|점퍼|버튼/.test(b[0])) return; addBom(b[0], b[1], b[2] || ''); });
    (X.m.steps || []).forEach(s => steps.push(`[${k + 1}번 ${X.name}] ${s}`));
  });
  // 이음 부품은 앞(A) 또는 뒤(B) 축과 함께 돎
  links.forEach(lk => (lk.parts || []).forEach(q => model.parts.push({ name: `이음 ${lk.src + 1}→${lk.k + 1}: ${q.name}`, file: q.file, tris: q.tris, mod: -1,
    motion: t => { const c = chain(t).phi[lk.k]; return q.slide ? XF.mul(q.frame, XF.T(c ? c.a : 0, 0, 0)) : XF.mul(q.frame, XF.Rz((q.ph || 0) + (c ? (q.spin === 'A' ? c.a : c.b) : 0))); } })));
  ties.forEach(tk => tk.parts.forEach(q => model.parts.push({ name: `고리 ${tk.src + 1}→${tk.k + 1}: ${q.name}`, file: q.file, tris: q.tris, mod: -1,
    motion: t => { const a = tk.qa.of(chain(t).th[tk.src]); return XF.mul(q.frame, XF.Rz(q.spin === 'A' ? a : a * tk.r)); } })));
  if (base) asmBase(M, model, addBom, steps);
  // 기구끼리 겹침 (처음 자세의 상자)
  const boxOf = k => { const ts = model.parts.filter(p => p.mod === k).map(p => xfTris(p.tris, p.motion(0))).concat(model.housing.filter(h => h.mod === k && h.assembly !== false).map(h => h.tris)); return trisBounds([].concat(...ts)); };
  const bx = M.map((_, k) => boxOf(k));
  for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) {
    const ov = [0, 1, 2].map(a => Math.min(bx[i].hi[a], bx[j].hi[a]) - Math.max(bx[i].lo[a], bx[j].lo[a]));
    if (ov.every(v => v > 0.5)) model.checks.push({ st: 'warn', txt: `${i + 1}번과 ${j + 1}번 기구의 자리가 겹칩니다 (${ov.map(v => fmt(v, 0)).join('×')} mm). 이음을 벨트로 바꾸거나 놓는 방향(각도)을 돌려 보세요.` });
  }
  // 한 방향으로만 도는 기구(래칫)가 거꾸로 돌려지는지
  { const T = m0Period(M[0].m), c = chain(T);
    M.forEach((X, k) => { if (k && X.d.kind === 'linkage' && X.d.type === 'ratchet' && links[k - 1].ok && links[k - 1].L.kind !== 'rack' && c.th[k] / (X.P.rate || 1) < -1e-6)
      model.checks.push({ st: 'bad', txt: `${k + 1}번 래칫 기구가 거꾸로 돌려져 멈춤쇠에 걸립니다. 이음을 기어 물림↔벨트로 바꾸거나 기어를 하나 더 넣어 방향을 뒤집으세요.` }); }); }
  // 끝 출력과 비
  // 끝 기구(갈래 끝)마다 입력 1바퀴에 몇 바퀴 도는지
  const leaves = M.map((_, k) => k).filter(k => k && !links.some(o => o.src === k));
  const thAt = (k, th0) => { if (!k) return th0; const lk = links[k - 1]; if (!lk.ok) return null; const p = thAt(lk.src, th0); return p === null ? null : -lk.qa.of(p) * asmRatio(lk.L); };
  const m0 = M[0].m, rpm = m0.thOf ? m0.thOf(1) * 60 / (2 * PI) : (M[0].d.rpm || 0);
  model.hud = [['입력', fmt(rpm, 1) + ' rpm'], ['기구', M.length + '개' + (leaves.length > 1 ? ` · 갈래 ${leaves.length}` : '')]];
  leaves.forEach(k => { const rev = thAt(k, 2 * PI); if (rev === null) return;
    model.hud.push([`${k + 1}번 ${M[k].name} 입력`, Math.abs(rev) < 1e-6 ? '왕복 (제자리로 돌아옴)' : `입력 1바퀴에 ${fmt(Math.abs(rev) / (2 * PI), 3)}바퀴`]);
    if (leaves.length === 1) M[k].P.list.filter(q => q.role === 'out').forEach(q => { const f = q.of; model.hud.push([`끝 출력 ${q.label || q.id}`, q.kind === 'rot' ? `${fmt((f.range[1] - f.range[0]) / D2R, 0)}° 범위` : `${fmt(f.range[1] - f.range[0], 1)} mm 행정`]); }); });
  if (ties.length) model.hud.push(['닫힌 고리', ties.map(tk => `${tk.src + 1}→${tk.k + 1}${tk.ok ? '' : ' 잠김'}`).join(', ')]);
  model.table = { head: ['#', '기구', '이음', '출력'], rows: M.map((X, k) => ({ part: X.first, cells: [String(k + 1), X.name, (k ? (links[k - 1].ok ? `${links[k - 1].src + 1}번에서 · ${ASM_KINDS[links[k - 1].L.kind]}` : '이어지지 않음') : '동력원') + ties.filter(tk => tk.k === k).map(tk => ` + 고리 ${tk.src + 1}번`).join(''), X.P.list.filter(q => q.role === 'out').map(q => q.label || q.id).join(', ') || '끝 동작'] })) };
  model.bom = [...bom.values()]; model.steps = steps;
  model.kit = m0.kit; model.shaftRows = null;
  model.period = m0.period; model.thOf = m0.thOf;
  model.scad = () => '// 조립 작업대: 부품별 STL을 쓰세요. (조립은 assembly.stl)\n';
  model.mods = M.map(X => ({ name: X.name, ports: X.P.list.map(q => ({ id: q.id, role: q.role, kind: q.kind, label: q.label })) }));
  model.notes.push('조립 작업대: 기구를 한 줄 또는 갈래로 이어 함께 돌립니다. 각 기구 받침은 따로 있어 실제 장치에서는 판이나 프로파일에 함께 고정합니다.');
  return model;
}
// 공통 바탕판: 모든 기구 아래 한 판을 깔고, 높이 있는 기구는 바닥판 네 모서리를 기둥으로 받침 (M3 볼트, 기둥 양끝은 M3 탭 2.8 mm)
function asmBase(M, model, addBom, steps) {
  const all = model.parts.filter(p => p.mod >= 0).map(p => trisBounds(xfTris(p.tris, p.motion(0)))).concat(model.housing.map(h => trisBounds(h.tris)));
  const zTop = Math.min(...all.map(b => b.lo[2])) - 0.5, T = 5, feet = [], hung = [];
  M.forEach((X, k) => {
    const F = X.m.feet; if (!F) return;
    if (X.pose[10] < 0.99) { hung.push(k + 1); return; }
    F.pts.forEach(([x, y]) => { const w = XF.apply(X.pose, [x, y, F.z]); feet.push({ k, x: w[0], y: w[1], h: +(w[2] - zTop).toFixed(1) }); });
  });
  if (!feet.length) return;
  const xs = feet.map(f => f.x), ys = feet.map(f => f.y), x0 = Math.min(...xs) - 10, x1 = Math.max(...xs) + 10, y0 = Math.min(...ys) - 10, y1 = Math.max(...ys) + 10;
  const tl = asmPlateTiles(x0, y0, x1, y1, feet, T, zTop);
  tl.parts.forEach(h => model.housing.push({ ...h, mod: -1 }));
  const posts = new Map();
  feet.forEach(f => { if (f.h < 1) return; const key = fmt(f.h, 1);
    if (!posts.has(key)) posts.set(key, { h: f.h, n: 0, tris: extrudeTris(rectPts(-5, -5, 5, 5), [circlePts(1.4, 20)], f.h) });
    const P = posts.get(key); P.n++;
    model.housing.push({ name: `기둥 ${key} mm`, file: `post_${key}`, mod: -1, tris: moveTris(P.tris, f.x, f.y, zTop), printTris: P.tris }); });
  const np = [...posts.values()].reduce((a, p) => a + p.n, 0);
  if (tl.bolts) { addBom('M3 볼트 12 mm + 너트 (바탕판 조각 잇기)', tl.bolts); addBom(`바탕판 이음띠 (28 mm 폭, 4 mm 두께)`, tl.strips, '출력 부품'); }
  addBom('M3 볼트 (바탕판·기둥 고정)', feet.length + np, '바탕판 아래에서 기둥(또는 기구 다리)으로, 기구 바닥판 위에서 기둥으로 · 길이 10 정도, 다리 바로 고정은 다리 높이 + 5');
  [...posts.values()].forEach(p => addBom(`출력 기둥 ${fmt(p.h, 1)} mm (10×10)`, p.n, '출력 부품, 양끝 M3 탭'));
  const W = x1 - x0, H = y1 - y0;
  model.checks.push({ st: 'ok', txt: `공통 바탕판 <em>${fmt(W, 0)}×${fmt(H, 0)} mm</em>, 기둥 ${np}개${tl.n > 1 ? ` · 출력판(${BED.x} mm)보다 커서 <em>${tl.nx}×${tl.ny} 조각</em>으로 나누고 아래 이음띠 ${tl.strips}개를 M3 볼트 ${tl.bolts}개로 잇습니다 (합판·알루미늄 판 한 장으로 바꿔도 됨)` : ''}` });
  if (tl.n > 1) steps.unshift(`바탕판 조각을 맞대어 놓고 아래에서 이음띠를 대어 M3 볼트·너트로 잇습니다.`);
  if (hung.length) model.checks.push({ st: 'warn', txt: `${hung.join(', ')}번 기구는 기울어지거나 뒤집혀 있어 바탕판 기둥으로 받치지 못합니다. 따로 받침(브래킷)이나 위쪽 틀에 고정하세요.` });
  steps.unshift(`공통 바탕판에 기둥을 M3 볼트로 세우고, 각 기구 바닥판 네 모서리를 기둥 위에 M3 볼트로 고정합니다.`);
}
/* 닫힌 고리: mods[k].tie = { src, from, zA, zB } 로 k 번 입력축을 src 번 출력축에 벨트로 한 번 더 이음.
 두 길(사슬과 고리)이 k 번 입력을 같은 각도로 돌려야 함. 다르면 잠김 → 맞는 풀리 잇수를 찾아 알려 줌 */
function asmTies(mods, M, links, chain, model, addBom, steps) {
  const ties = [], T0 = m0Period(M[0].m), N = 96;
  mods.forEach((md, k) => {
    const T = md.tie; if (!T || T.src === undefined || T.src === null || T.src === '') return;
    const si = Math.round(+T.src); if (!(si >= 0 && si < M.length) || si === k) return;
    const A = M[si], B = M[k], sn = si + 1, qa = A.P.list.find(q => q.id === (T.from || 'out') && q.role === 'out') || A.P.list.find(q => q.role === 'out');
    const bad = txt => model.checks.push({ st: 'bad', txt: `닫힌 고리 ${sn}→${k + 1}번: ${txt}` });
    if (!qa || qa.kind !== 'rot') return bad(`${sn}번 ${A.name}에 회전 출력축이 없습니다.`);
    if (!B.pin) return bad(`${k + 1}번 입력축을 찾지 못했습니다.`);
    const u = V3.unit(xfDir(A.pose, qa.dir)), oT = XF.apply(A.pose, qa.at), dw = V3.unit(xfDir(B.pose, B.pin.dir)), oB = XF.apply(B.pose, B.pin.at), par = V3.dot(u, dw);
    if (Math.abs(par) < 0.999) return bad(`두 축이 나란하지 않아 벨트로 이을 수 없습니다 (사이각 ${fmt(Math.acos(Math.min(1, Math.abs(par))) / D2R, 0)}°). 놓는 방향을 바꾸거나 고리를 빼세요.`);
    const zA = ASM_PULLEY.includes(+T.zA) ? +T.zA : 20, zB = ASM_PULLEY.includes(+T.zB) ? +T.zB : 20, r = zA / zB, sg = Math.sign(par);
    // 두 길 비교: 고리로 돌린 각도 sg·a·r 와 사슬로 돌린 각도 th[k]
    let err = 0, saa = 0, sab = 0; const sm = [];
    for (let i = 0; i <= N; i++) { const c = chain(T0 * i / N), a = qa.of(c.th[si]), b = c.th[k]; sm.push([a, b]); err = Math.max(err, Math.abs(sg * a * r - b)); saa += a * a; sab += a * b; }
    const tk = { k, src: si, qa, r, ok: err < 0.02, parts: [] }; ties.push(tk);
    if (!tk.ok) {
      const need = saa > 1e-9 ? sab / saa * sg : NaN, lin = isFinite(need) && sm.every(([a, b]) => Math.abs(sg * a * need - b) < 0.02);
      let hint = '이 두 기구는 회전비가 일정하지 않아(간헐·왕복 운동) 고리로 이을 수 없습니다.';
      if (lin && need > 0) { let best = null; for (const x of ASM_PULLEY) for (const y of ASM_PULLEY) { const e = Math.abs(x / y - need), w = Math.abs(x - zA) + Math.abs(y - zB); if (!best || e < best.e - 1e-9 || e < best.e + 1e-9 && w < best.w) best = { x, y, e, w }; }
        hint = best.e < 1e-6 ? `풀리를 <em>${best.x}T:${best.y}T</em>로 바꾸면 맞습니다.` : `필요한 비 ${fmt(need, 3)}에 딱 맞는 GT2 풀리 짝이 없습니다 (가장 가까운 ${best.x}T:${best.y}T).`; }
      else if (lin && need < 0) hint = '두 길의 도는 방향이 반대입니다. 사슬 쪽 이음 하나를 기어 물림↔벨트로 바꿔 방향을 뒤집으세요.';
      return bad(`두 길로 돌리는 각도가 최대 ${fmt(err / D2R, 0)}° 어긋나 기구가 잠깁니다. ${hint}`);
    }
    // 벨트 자리: 앞 출력축 위로 층을 올려 (그 축의 이음·고리 수만큼)
    const used = links.filter(o => o.ok && o.src === si && o.qa === qa).length + ties.filter(o => o !== tk && o.src === si && o.qa === qa).length;
    const d = V3.sub(oB, oT), pp = V3.sub(d, V3.mul(u, V3.dot(d, u))), C = V3.len(pp), rA = zA * 2 / (2 * PI), rB = zB * 2 / (2 * PI);
    if (C < rA + rB + 4) { tk.ok = false; return bad(`두 축 사이가 ${fmt(C, 1)} mm로 풀리(${zA}T·${zB}T)를 걸기에 너무 가깝습니다.`); }
    const s = Math.max(0, sg > 0 ? V3.dot(d, u) : 0) + 10 + 18 * used, F = frameOf(V3.add(oT, V3.mul(u, s)), u, V3.unit(pp)), pz = 9.5;
    const Ln = beltLen(C, rA, rB), Lb = ASM_BELTS.find(x => x >= Ln - 0.5) || Math.ceil(Ln / 2) * 2, slack = Lb - Ln;
    const pA = STD.pulley.mk({ z: String(zA), d: qa.shaft ? qa.shaft.d : 5, dcut: 'dcut' })[0], pB = STD.pulley.mk({ z: String(zB), d: B.pin.shaft ? B.pin.shaft.d : 5, dcut: 'dcut' })[0];
    tk.parts = [{ name: `GT2 풀리 ${zA}T`, file: `tie${k + 1}_pulley_${zA}T`, tris: pA.tris, frame: XF.mul(F, XF.T(0, 0, -pz)), spin: 'A' },
      { name: `GT2 풀리 ${zB}T`, file: `tie${k + 1}_pulley_${zB}T`, tris: pB.tris, frame: XF.mul(F, XF.T(C, 0, -pz)), spin: 'B' }];
    model.extras.push({ line: beltLoop(C, rA + 0.6, rB + 0.6).map(p => XF.apply(F, p)), color: '#7a5bc9' });
    const top = V3.add(oT, V3.mul(u, s + 6));
    model.rods.push({ a: oT, b: top, d: qa.shaft ? qa.shaft.d : 5 }, { a: oB, b: V3.add(oB, V3.mul(u, V3.dot(V3.sub(top, oB), u))), d: B.pin.shaft ? B.pin.shaft.d : 5 });
    addBom(`GT2 풀리 ${zA}T`, 1, '닫힌 고리'); addBom(`GT2 풀리 ${zB}T`, 1, '닫힌 고리'); addBom(`GT2 폐루프 벨트 ${Lb} mm (폭 6)`, 1, '닫힌 고리');
    if (slack > 1) addBom('GT2 아이들러 풀리 20T (구멍 5) + M5 볼트', 1, '닫힌 고리 벨트 장력');
    model.checks.push({ st: 'ok', txt: `닫힌 고리 ${sn}→${k + 1}번: 두 길의 각도가 맞습니다 (어긋남 ${fmt(err / D2R, 2)}°). GT2 ${zA}T:${zB}T, 축 사이 ${fmt(C, 1)} mm, 벨트 <em>${Lb} mm</em>${slack > 1 ? ` · ${fmt(slack, 1)} mm 남아 아이들러로 장력을 줍니다` : ''}. 부하는 두 길이 나눠 받습니다.` });
    if (slack > 20) model.checks.push({ st: 'warn', txt: `닫힌 고리 ${sn}→${k + 1}번: 벨트가 ${fmt(slack, 0)} mm나 남아 아이들러를 크게 밀어야 합니다. 풀리 잇수를 바꾸거나(비는 같게) 기구 놓는 방향을 바꿔 축 사이를 늘리세요.` });
    if (sg < 0) model.checks.push({ st: 'warn', txt: `닫힌 고리 ${sn}→${k + 1}번: ${k + 1}번 입력축이 반대쪽을 향해 있어 기구를 꿰뚫는 관통 축(양쪽으로 나온 축)이 필요합니다.` });
    steps.push(`닫힌 고리: ${sn}번 출력축과 ${k + 1}번 입력축에 GT2 풀리(${zA}T, ${zB}T)를 같은 높이로 끼우고, 기구를 처음 자세에 둔 채 ${Lb} mm 벨트를 겁니다${slack > 1 ? ' (아이들러로 장력)' : ''}.`);
  });
  return ties;
}
// 바탕판을 출력판에 들어가게 조각으로 나눔. 이음선 아래에 이음띠를 대고 양쪽을 M3 볼트로 조임 (이음선은 다리 구멍을 피해 옮김)
function asmPlateTiles(x0, y0, x1, y1, feet, T, zTop) {
  const lim = BED.x - 10, nx = Math.ceil((x1 - x0) / lim), ny = Math.ceil((y1 - y0) / lim), hole = (x, y) => circlePts(1.7, 20, x, y);
  const seams = (a0, a1, n, key) => { const out = [a0];
    for (let i = 1; i < n; i++) { let s0 = a0 + (a1 - a0) * i / n, best = s0;
      for (let d = 0; d <= 30; d += 1) { const ok = c => feet.every(f => Math.abs(f[key] - c) > 7); if (ok(s0 + d)) { best = s0 + d; break; } if (ok(s0 - d)) { best = s0 - d; break; } }
      out.push(best); }
    out.push(a1); return out; };
  const xs = seams(x0, x1, nx, 'x'), ys = seams(y0, y1, ny, 'y'), parts = [], H = feet.map(f => [f.x, f.y]), strips = [];
  const along = (a, b) => { const n = Math.max(2, Math.ceil((b - a - 30) / 60) + 1); return Array.from({ length: n }, (_, i) => a + 15 + (b - a - 30) * i / (n - 1)); };
  const far = (x, y) => feet.every(f => Math.hypot(f.x - x, f.y - y) > 8);
  for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) { const sx = xs[i], hs = along(ys[j], ys[j + 1]).filter(y => far(sx - 8, y) && far(sx + 8, y));
    strips.push({ r: [sx - 14, ys[j] + 3, sx + 14, ys[j + 1] - 3], h: hs.flatMap(y => [[sx - 8, y], [sx + 8, y]]) }); }
  for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) { const sy = ys[j], a = xs[i] + (i ? 16 : 3), b = xs[i + 1] - (i < nx - 1 ? 16 : 3), hs = along(a - 3, b + 3).filter(x => far(x, sy - 8) && far(x, sy + 8));
    strips.push({ r: [a, sy - 14, b, sy + 14], h: hs.flatMap(x => [[x, sy - 8], [x, sy + 8]]) }); }
  strips.forEach(st => H.push(...st.h));
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const r = [xs[i], ys[j], xs[i + 1], ys[j + 1]], hs = H.filter(([x, y]) => x > r[0] + 2.5 && x < r[2] - 2.5 && y > r[1] + 2.5 && y < r[3] - 2.5);
    const t = extrudeTris(rectPts(...r), hs.map(([x, y]) => hole(x, y)), T), w = Math.round(r[2] - r[0]), h = Math.round(r[3] - r[1]);
    parts.push({ name: nx * ny > 1 ? `바탕판 조각 ${j + 1}-${i + 1}` : '공통 바탕판', file: nx * ny > 1 ? `base_tile_${j + 1}_${i + 1}_${w}x${h}` : `base_common_${w}x${h}`,
      tris: moveTris(t, 0, 0, zTop - T), printTris: moveTris(t, -r[0], -r[1], 0) });
  }
  strips.forEach((st, k) => { const [a, b, c, d] = st.r, t = extrudeTris(rectPts(a, b, c, d), st.h.map(([x, y]) => hole(x, y)), 4);
    parts.push({ name: `바탕판 이음띠 ${k + 1}`, file: `base_splice_${k + 1}_${Math.round(Math.max(c - a, d - b))}`, tris: moveTris(t, 0, 0, zTop - T - 4), printTris: moveTris(t, -a, -b, 0) }); });
  return { parts, n: nx * ny, nx, ny, strips: strips.length, bolts: strips.reduce((s, st) => s + st.h.length, 0) };
}
// 직선 출력 → 랙·피니언 → 뒤 기구 입력. 틀 Fr: x = 움직임 방향 u, y = 이가 향하는 쪽 n, z = 피니언 축 w
function asmRackLink(A, B, L, qa, lk, k, model, steps, sn = k) {
  const m = L.m || 1, zp = Math.max(10, Math.round(L.zB || 16)), bw = 6, gP = { m, z: zp, pa: 20, x: autoShift(zp), b: bw, backlash: 0.1 };
  const r = m * zp / 2, cy = r + gP.x * m, u = V3.unit(xfDir(A.pose, qa.dir));
  const w = Math.abs(u[2]) < 0.9 ? V3.unit(V3.sub([0, 0, 1], V3.mul(u, u[2]))) : V3.unit(V3.cross(u, xfDir(A.pose, [1, 0, 0]))), n = V3.cross(w, u);
  const bb = boxXf(partBox(A.m.parts[qa.part]), A.pose), c = [0, 1, 2].map(i => (bb.lo[i] + bb.hi[i]) / 2), en = [0, 1, 2].reduce((a, i) => a + Math.abs(n[i]) * (bb.hi[i] - bb.lo[i]) / 2, 0);
  const [lo, hi] = qa.of.range, p = PI * m, ra = r + m * (1 + gP.x), nR = Math.ceil((hi - lo) / p) + 2 * Math.ceil(ra / p) + 2;
  const RO = rackOutline({ m, pa: 20, backlash: 0.1, nR, H: 5 }), sh = -Math.round((lo + hi) / 2 / p) * p;
  const O = V3.sub(V3.add(c, V3.mul(n, en - RO.yb + 0.3)), V3.mul(w, bw / 2)), Fr = XF.basis(u, n, w, O);
  const oP = XF.apply(Fr, [0, cy, bw]), g = 12, dB = B.pin.shaft ? B.pin.shaft.d : 5;
  const R = alignRot(V3.unit(B.pin.dir), V3.mul(w, -1)), p0 = XF.apply(R, B.pin.at), tgt = V3.add(oP, V3.mul(w, g));
  B.pose = XF.mul(XF.T(tgt[0] - p0[0], tgt[1] - p0[1], tgt[2] - p0[2]), R);
  Object.assign(lk, { ok: true, wA: w, oA: oP, g, side: 0, plane: 0, dB, F: Fr, rack: { r, nR } });
  lk.parts = [{ name: `랙 m${m} ${nR}T`, file: `link${k}_rack_m${m}_n${nR}`, tris: moveTris(extrudeTris(RO.pts, [], bw), sh, 0, 0), frame: Fr, slide: true },
    { name: `피니언 ${zp}T`, file: `link${k}_pinion_m${m}_z${zp}`, tris: extrudeTris(gearOutline(gP).pts, [borePts(dB + 0.1, 0.5, 32)], bw), frame: XF.mul(Fr, XF.T(0, cy, 0)), spin: 'B', ph: -PI / 2 }];
  const oB = XF.apply(B.pose, B.pin.at);
  model.rods.push({ a: XF.apply(Fr, [0, cy, -1]), b: oB, d: dB });
  const sw = (hi - lo) / r;
  model.checks.push({ st: 'ok', txt: `${sn}→${k + 1}번 랙·피니언: 모듈 ${m}, 피니언 ${zp}T(반지름 ${fmt(r, 1)} mm), 랙 ${nR}T · 행정 ${fmt(hi - lo, 1)} mm → 피니언 <em>±${fmt(sw / 2 / D2R, 0)}°</em> 왕복 회전` });
  if (sw > 2 * PI) model.checks.push({ st: 'warn', txt: `${k + 1}번 입력이 한 행정에 한 바퀴 넘게(${fmt(sw / D2R, 0)}°) 돕니다. 왕복 회전이라 크랭크처럼 한 바퀴를 도는 기구는 되돌아 돕니다.` });
  else model.checks.push({ st: 'warn', txt: `${k + 1}번 ${B.name}의 입력이 ${fmt(sw / D2R, 0)}°만 오가며 흔들립니다. 한 바퀴를 돌아야 하는 기구라면 피니언 잇수를 줄이거나 행정을 늘리세요.` });
  steps.push(`${sn}번 ${A.name}의 움직이는 부품 옆에 랙을 붙이고(접착·M3), ${k + 1}번 입력축에 ${zp}T 피니언을 끼워 랙에 물립니다.`);
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
