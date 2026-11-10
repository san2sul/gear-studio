// 시험: 모든 동작 기구 × 동력원이 만들어지고 메시가 닫혀 있는지, 규격 부품이 모두 닫힌 메시인지
const C = require('./core.cjs');
let fail = 0; const ok = (c, msg) => { if (!c) { fail++; console.log('FAIL', msg); } };
function openEdges(tris) {
  const E = new Map(), key = p => p.map(v => v.toFixed(3)).join(',');
  for (const t of tris) { const P = [key(t.slice(0, 3)), key(t.slice(3, 6)), key(t.slice(6, 9))]; for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) { const k = P[a] + '|' + P[b]; E.set(k, (E.get(k) || 0) + 1); } }
  let bad = 0; for (const [k, c] of E) { const [a, b] = k.split('|'); if ((E.get(b + '|' + a) || 0) !== c) bad++; } return bad;
}
// 1. 동작 기구
for (const ty of C.LK_TYPES) for (const [mo, red] of [['none', 'auto'], ['auto', 'auto'], ['nema17', 3], ['n20_30', 'auto'], ['sg90c', 'auto'], ['tt', 'auto']]) {
  const D = C.linkageDefault(); D.type = ty; D.drive.motor = mo; D.drive.red = red;
  let M; try { M = C.buildModel(D); } catch (e) { ok(false, `${ty}/${mo}: ${e.message}`); continue; }
  const clash = M.checks.find(c => /움직이는 동안/.test(c.txt));
  ok(clash && clash.st === 'ok', `${ty}/${mo}/${red}: 움직이는 동안 겹침 ${clash && clash.txt.replace(/<[^>]+>/g, '')}`);
  M.parts.concat(M.housing).forEach(h => ok(openEdges(h.tris) === 0, `${ty}/${mo}: ${h.file} 메시가 열려 있음`));
  ok(Array.isArray(M.bom) && M.bom.length > 0, `${ty}/${mo}: 부품 목록 없음`);
}
// 2. 규격 부품: 모든 종류 × 선택지
for (const [cat, S] of Object.entries(C.STD)) {
  const p = {}; S.f.forEach(([k, , v]) => p[k] = v);
  const vs = [p]; S.f.forEach(([k, , v, o]) => { if (Array.isArray(o)) o.forEach(x => { const val = Array.isArray(x) ? x[0] : x; if (val !== v) vs.push({ ...p, [k]: val }); }); });
  for (const q of vs) { let M; try { M = C.buildModel({ kind: 'std', items: [{ cat, p: q, n: 1 }] }); } catch (e) { ok(false, `${cat} ${JSON.stringify(q)}: ${e.message}`); continue; }
    ok(M.parts.length > 0, `${cat}: 부품 없음`); M.parts.forEach(pt => ok(openEdges(pt.tris) === 0, `${cat} ${JSON.stringify(q)}: 메시가 열려 있음`)); }
}
// 3. 구입 부품 모형
{ const D = C.linkageDefault(); D.type = 'jansen'; const M = C.buildModel(D), P = C.proxyParts(M.bom);
  ok(P.some(p => /motor_/.test(p.file)) && P.some(p => /screw_/.test(p.file)), '얀센: 모터·볼트 모형이 없음'); P.forEach(p => ok(openEdges(p.tris) === 0, `모형 ${p.file} 메시가 열려 있음`)); }
// 4. 연결점(포트): 모든 동작 기구에 입력이 있고, 출력 값이 이어짐
const OUT = { slider: 'lin', yoke: 'lin', fourbar: 'rot', jansen: null, geneva: 'rot', ratchet: 'rot', screw: 'lin', diff: 'rot' };
for (const ty of C.LK_TYPES) for (const mo of ['none', 'auto']) {
  const D = C.linkageDefault(); D.type = ty; D.drive.motor = mo; const M = C.buildModel(D), P = C.modelPorts(D, M);
  ok(P.list.some(q => q.role === 'in') && Math.abs(P.rate) > 0, `${ty}/${mo}: 입력 포트 없음`);
  const outs = P.list.filter(q => q.role === 'out');
  ok(OUT[ty] ? outs.length && outs[0].kind === OUT[ty] : !outs.length, `${ty}/${mo}: 출력 포트 ${outs.map(q => q.kind)}`);
  outs.forEach(q => { let mx = 0; for (let i = 1; i <= 360; i++) mx = Math.max(mx, Math.abs(q.of(i * Math.PI / 180) - q.of((i - 1) * Math.PI / 180))); ok(mx < (q.kind === 'rot' ? 0.3 : 3), `${ty}/${mo}: ${q.id} 값이 튐 ${mx}`); });
}
{ const D = C.linkageDefault(); D.type = 'geneva'; const P = C.modelPorts(D, C.buildModel(D)), q = P.list.find(x => x.role === 'out');
  ok(Math.abs(Math.abs(q.of(2 * Math.PI)) - Math.PI / 2) < 0.02, '제네바: 입력 한 바퀴에 90°가 아님'); }
// 5. 조립 작업대: 이음 종류마다 만들어지고, 이음 부품 메시가 닫혀 있고, 사슬 각도가 비대로 이어짐
const lk = (ty, mo = 'none') => { const D = C.linkageDefault(); D.type = ty; D.drive.motor = mo; return D; };
for (const [kind, zA, zB] of [['shaft', 0, 0], ['mesh', 18, 27], ['belt', 16, 40]]) {
  const A = { kind: 'asm', mods: [{ design: lk('ratchet', 'auto') }, { design: lk('geneva'), link: { kind, zA, zB, m: 1 } }, { design: lk('slider'), link: { kind: 'belt', zA: 20, zB: 20 } }] };
  let M; try { M = C.buildModel(A); } catch (e) { ok(false, `조립 ${kind}: ${e.message}`); continue; }
  ok(!M.checks.some(c => c.st === 'bad'), `조립 ${kind}: ${M.checks.filter(c => c.st === 'bad').map(c => c.txt).join(' / ')}`);
  M.parts.filter(p => p.mod === -1).forEach(p => ok(openEdges(p.tris) === 0, `조립 ${kind}: ${p.file} 메시가 열려 있음`));
  const r = kind === 'shaft' ? 1 : zA / zB, c1 = M.chain(0.5), a = Math.abs(c1.phi[1].a), b = Math.abs(c1.phi[1].b);
  ok(Math.abs(b - a * r) < 1e-6, `조립 ${kind}: 비가 맞지 않음 ${a} ${b}`);
  ok(M.bom.length > 0 && M.parts.length > 5, `조립 ${kind}: 부품표·부품 없음`);
}
{ const M = C.buildModel(C.asmDefault()); ok(M.kind === 'asm' && M.table.rows.length === 2, '조립 기본값');
  ok(M.loads.req[0] > M.loads.own[0] && M.checks.some(c => /동력원이 감당할/.test(c.txt)), '조립: 뒤 기구 부하가 1번에 더해지지 않음');
  const B = M.housing.filter(h => h.mod === -1); ok(B.some(h => /base_common/.test(h.file)), '조립: 공통 바탕판 없음');
  B.forEach(h => ok(openEdges(h.tris) === 0, `조립: ${h.file} 메시가 열려 있음`));
  const N = C.buildModel({ ...C.asmDefault(), base: false }); ok(!N.housing.some(h => /base_common/.test(h.file)), '조립: 바탕판 끄기'); }
// 6. 직선 출력 → 랙·피니언
for (const [a, z] of [['slider', 16], ['yoke', 12], ['screw', 12]]) {
  const M = C.buildModel({ kind: 'asm', mods: [{ design: lk(a, 'auto') }, { design: lk('fourbar'), link: { kind: 'belt', zB: z, m: 1 } }] });
  ok(M.checks.some(c => /랙·피니언/.test(c.txt)) && !M.checks.some(c => c.st === 'bad'), `랙 ${a}: ${M.checks.filter(c => c.st === 'bad').map(c => c.txt).join(' / ')}`);
  M.parts.filter(p => p.mod === -1).forEach(p => ok(openEdges(p.tris) === 0, `랙 ${a}: ${p.file} 메시가 열려 있음`));
  const c = M.chain(0.7); ok(Math.abs(c.phi[1].b - c.phi[1].a * 2 / z) < 1e-9, `랙 ${a}: 비가 맞지 않음`);
}
console.log(fail ? `${fail}개 실패` : '모두 통과'); process.exit(fail ? 1 : 0);
