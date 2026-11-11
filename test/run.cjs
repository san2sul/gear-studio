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
const OUT = { slider: 'lin', yoke: 'lin', fourbar: 'rot', jansen: null, geneva: 'rot', ratchet: 'rot', screw: 'lin', diff: 'rot', vib: null, intgear: 'rot', winch: 'lin', gripper: null, ujoint: 'rot', conveyor: 'rot' };
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
  const B = M.housing.filter(h => h.mod === -1); ok(B.some(h => /base_common|base_tile/.test(h.file)), '조립: 공통 바탕판 없음');
  B.forEach(h => ok(openEdges(h.tris) === 0, `조립: ${h.file} 메시가 열려 있음`));
  const N = C.buildModel({ ...C.asmDefault(), base: false }); ok(!N.housing.some(h => /base_common/.test(h.file)), '조립: 바탕판 끄기'); }
// 6. 직선 출력 → 랙·피니언
for (const [a, z] of [['slider', 16], ['yoke', 12], ['screw', 12]]) {
  const M = C.buildModel({ kind: 'asm', mods: [{ design: lk(a, 'auto') }, { design: lk('fourbar'), link: { kind: 'belt', zB: z, m: 1 } }] });
  ok(M.checks.some(c => /랙·피니언/.test(c.txt)) && !M.checks.some(c => c.st === 'bad'), `랙 ${a}: ${M.checks.filter(c => c.st === 'bad').map(c => c.txt).join(' / ')}`);
  M.parts.filter(p => p.mod === -1).forEach(p => ok(openEdges(p.tris) === 0, `랙 ${a}: ${p.file} 메시가 열려 있음`));
  const c = M.chain(0.7); ok(Math.abs(c.phi[1].b - c.phi[1].a * 2 / z) < 1e-9, `랙 ${a}: 비가 맞지 않음`);
}
// 7. 갈래: 한 출력에 두 기구 (벨트 + 기어 층), 부하 합, 각도, 축 직결 둘은 막음
{ const A = { kind: 'asm', mods: [{ design: lk('geneva', 'auto') }, { design: lk('slider'), link: { kind: 'belt', zA: 20, zB: 20 } }, { design: lk('fourbar'), src: 0, link: { kind: 'mesh', zA: 20, zB: 30, m: 1 } }, { design: lk('ratchet'), src: 1, link: { kind: 'belt', zB: 16, m: 1 } }] };
  const M = C.buildModel(A), bad = M.checks.filter(c => c.st === 'bad');
  ok(!bad.length, `갈래: ${bad.map(c => c.txt).join(' / ')}`);
  ok(M.srcs.join() === '-1,0,0,1', '갈래: 이을 기구 번호');
  const L = M.loads; ok(Math.abs(L.req[0] - (L.own[0] + L.req[1] * L.gain[1] + L.req[2] * L.gain[2])) < 1e-6, '갈래: 부하가 합쳐지지 않음');
  const c = M.chain(0.4); ok(Math.abs(c.phi[2].b - c.phi[2].a * -20 / 30) < 1e-9 && Math.abs(c.phi[1].b - c.phi[1].a) < 1e-9, '갈래: 각도 비');
  ok(M.hud.some(h => /갈래 2/.test(h[1])), '갈래: 표시');
  const n = re => M.parts.filter(p => p.mod === -1 && re.test(p.name));
  ok(n(/이음 1→2/).length === 2 && n(/이음 1→3/).length === 2 && n(/이음 2→4/).length === 2, '갈래: 이음 부품 이름');
  // 같은 축의 풀리와 기어는 층이 달라 겹치지 않음
  const wb = p => { const T = p.motion(0), P = p.tris; let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const t9 of P) for (let j = 0; j < 9; j += 3) { const x = t9[j], y = t9[j + 1], z = t9[j + 2], q = [T[0] * x + T[1] * y + T[2] * z + T[3], T[4] * x + T[5] * y + T[6] * z + T[7], T[8] * x + T[9] * y + T[10] * z + T[11]];
      for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], q[a]); hi[a] = Math.max(hi[a], q[a]); } } return { lo, hi }; };
  const pa = wb(n(/이음 1→2/)[0]), ga = wb(n(/이음 1→3/)[0]);
  ok([0, 1, 2].some(a => Math.min(pa.hi[a], ga.hi[a]) - Math.max(pa.lo[a], ga.lo[a]) <= 0.01), '갈래: 같은 축의 풀리와 기어가 겹침');
  const S = C.buildModel({ kind: 'asm', mods: [{ design: lk('geneva', 'auto') }, { design: lk('fourbar'), link: { kind: 'shaft' } }, { design: lk('fourbar'), src: 0, link: { kind: 'shaft' } }] });
  ok(S.checks.some(c => c.st === 'bad' && /이미 다른 기구/.test(c.txt)), '갈래: 축 직결 둘을 막지 않음'); }
// 8. 크기별 규칙: 등급 안내, 큰 바탕판은 출력판에 드는 조각으로, 작은 모듈 경고
{ const M = C.buildModel(C.asmDefault()); ok(M.size && M.checks.some(c => /크기 등급/.test(c.txt)), '크기: 등급 없음');
  const T = M.housing.filter(h => /base_tile|base_splice/.test(h.file)); ok(T.length >= 3, '크기: 큰 바탕판이 나뉘지 않음');
  T.forEach(h => { const b = C.trisBounds(h.printTris); ok(b.hi[0] - b.lo[0] <= 220 && b.hi[1] - b.lo[1] <= 220, `크기: ${h.file} 출력판을 넘음`); ok(openEdges(h.tris) === 0, `크기: ${h.file} 메시가 열려 있음`); });
  ok(!M.checks.some(c => /출력판\(220×220 mm\)보다 큰 부품/.test(c.txt)), '크기: 나눈 뒤에도 판보다 큰 부품');
  const W = C.buildModel({ kind: 'asm', mods: [{ design: lk('geneva', 'auto') }, { design: lk('fourbar'), link: { kind: 'mesh', zA: 30, zB: 30, m: 0.4 } }] });
  ok(W.checks.some(c => c.st === 'warn' && /모듈 0.4/.test(c.txt)), '크기: 작은 모듈 경고 없음'); }
// 9. 닫힌 고리: 맞는 비면 통과하고 고리 풀리가 함께 돌며, 틀린 비면 잠김 + 맞는 잇수를 알려 줌
{ const mk = tie => ({ kind: 'asm', mods: [{ design: lk('diff', 'auto') }, { design: lk('conveyor'), link: { kind: 'belt', zA: 20, zB: 40 } }, { design: lk('conveyor'), src: 0, from: 'out2', link: { kind: 'belt', zA: 20, zB: 20 }, tie }] });
  const G = C.buildModel(mk({ src: 1, zA: 40, zB: 20 }));
  ok(G.checks.some(c => c.st === 'ok' && /닫힌 고리 2→3번: 두 길의 각도가 맞습니다/.test(c.txt)) && !G.checks.some(c => c.st === 'bad'), `고리: ${G.checks.filter(c => c.st === 'bad').map(c => c.txt).join(' / ')}`);
  const P = G.parts.filter(p => /^고리/.test(p.name)); ok(P.length === 2, '고리: 풀리 없음');
  P.forEach(p => ok(openEdges(p.tris) === 0, `고리: ${p.file} 메시가 열려 있음`));
  const B = C.buildModel(mk({ src: 1, zA: 20, zB: 20 }));
  ok(B.checks.some(c => c.st === 'bad' && /잠깁니다/.test(c.txt) && /40T:20T/.test(c.txt)), '고리: 잠김·잇수 안내 없음'); }
// 10. 프린터 보정: 시험편 메시가 닫혀 있고, 보정하면 구멍은 커지고 바깥은 작아지며, 끄면 원래대로
{ const T = C.fitCoupon(); ok(T.length === 10, '보정: 시험편 개수'); T.forEach(p => ok(openEdges(p.tris) === 0, `보정: ${p.name} 메시가 열려 있음`));
  const blk = () => C.extrudeTris([[0, 0], [20, 0], [20, 20], [0, 20]], [Array.from({ length: 64 }, (_, i) => [10 + 5 * Math.cos(i * Math.PI / 32), 10 + 5 * Math.sin(i * Math.PI / 32)])], 6);
  const span = (t, f) => { let lo = 1e9, hi = -1e9; t.forEach(q => { for (let j = 0; j < 9; j += 3) if (f(q[j], q[j + 1])) { lo = Math.min(lo, q[j]); hi = Math.max(hi, q[j]); } }); return hi - lo; };
  const inner = (x, y) => Math.hypot(x - 10, y - 10) < 7, outer = (x, y) => !inner(x, y);
  const a = blk(); C.fitSet({ outer: 0.1, hole: 0.15, backlash: 0.1 }); const b = blk(), g1 = C.gearOutline({ m: 1, z: 20, pa: 20, x: 0, backlash: 0 }).pts; C.fitSet({});
  const g0 = C.gearOutline({ m: 1, z: 20, pa: 20, x: 0, backlash: 0 }).pts, ar = P => Math.abs(P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
  ok(Math.abs(span(b, outer) - (span(a, outer) - 0.2)) < 0.02, '보정: 바깥이 줄지 않음'); ok(Math.abs(span(b, inner) - (span(a, inner) + 0.3)) < 0.03, '보정: 구멍이 커지지 않음');
  ok(ar(g1) < ar(g0) - 0.5, '보정: 기어 백래시가 더해지지 않음'); ok(Math.abs(span(blk(), outer) - span(a, outer)) < 1e-9, '보정: 끈 뒤 원래대로가 아님'); }
// 11. 동작 스튜디오: 문장 → 운동·값, 추천 1순위가 요구치를 만족(다시 잰 계산값), 모든 기구가 기본 요구로 만들어짐
{ const cases = [
    ['컨베이어 위 상자를 3초마다 옆으로 40mm 밀어내고 싶어', 'recip', { stroke_mm: 40, period_s: 3 }, ['slider', 'yoke', 'cam']],
    ['와이퍼처럼 80도를 2초에 한 번 흔들고 싶어', 'swing', { angle_deg: 80, period_s: 2 }, ['fourbar']],
    ['회전 작업대를 6칸으로 나눠 한 칸씩 돌다 멈추게', 'intermittent', { steps: 6 }, ['geneva', 'intgear']],
    ['500g 물건을 150mm 들어 올리기', 'lift', { stroke_mm: 150 }, ['screw', 'winch']],
    ['분당 20바퀴로 천천히 돌리는 믹서', 'rotate', { rpm: 20 }, ['spur']],
    ['1초에 5mm씩 100mm 직선 이동', 'linear', { speed_mms: 5, stroke_mm: 100 }, ['rack', 'screw']],
    ['200x150x120 mm 안에서 피스톤처럼 20mm 왕복, 1초에 2번', 'recip', { stroke_mm: 20, period_s: 0.5 }, ['slider', 'yoke', 'cam']],
    ['4 cm 앞뒤로 왕복', 'recip', { stroke_mm: 40 }, ['slider', 'yoke', 'cam']],
    ['90도씩 돌다가 멈추는 인덱서', 'intermittent', { steps: 4, angle_deg: 90 }, ['geneva', 'intgear']],
    ['2kg 상자를 30 cm 끌어올리는 윈치', 'lift', { stroke_mm: 300 }, ['screw', 'winch']] ];
  for (const [t, mo, want, top] of cases) { const S = C.m2mParse(t);
    ok(S.motion.value === mo, `스튜디오 "${t}": 운동 ${S.motion.value}`);
    for (const [k, v] of Object.entries(want)) ok(S.traits[k] && Math.abs(S.traits[k].value - v) < 1e-6, `스튜디오 "${t}": ${k} ${S.traits[k] && S.traits[k].value}`);
    const R = C.m2mRecommend(S), c = R.list[0];
    ok(c && top.includes(c.id) && c.pass, `스튜디오 "${t}": 1순위 ${c && c.id} ${c && c.pass}`);
    if (c) c.rows.filter(r => r.want !== null).forEach(r => ok(r.ok, `스튜디오 "${t}": ${c.id} ${r.key} ${r.want} → ${r.got}`)); }
  ok(C.m2mQuestions(C.m2mParse('뭔가 만들고 싶어'))[0].key === 'motion', '스튜디오: 운동을 모르면 먼저 물음');
  ok(C.m2mQuestions(C.m2mParse('왕복 운동')).map(q => q.key).join() === 'stroke_mm,period_s', '스튜디오: 빠진 값 질문');
  const S2 = C.m2mParse('피스톤처럼 왕복, 행정 500mm'); ok(!C.m2mRecommend(S2).list.some(c => c.id === 'slider'), '스튜디오: 범위 밖 기구가 후보에 남음');
  for (const K of C.M2M_KB) { const S = C.m2mFilled({ ...C.m2mSpec(''), motion: { value: K.motions[0], source: 'user' } }); const c = C.m2mEval(K, S); ok(c.design && c.pass, `스튜디오 기구 ${K.id}: ${c.warn.join(' / ')} ${c.checks && c.checks.filter(x => x.st === 'bad').map(x => x.txt).join(' / ')}`); } }
{ // 12. 제품 요청서 (G1): 모양·사람 입력·효과·동력을 다섯 칸으로, 움직임을 모르면 추천 안 함
  const P = [
    ['총모양의 형상. 방아쇠를 당기면 총 입구에서 비누방울이 만들어져 나가야 함', 'product', 'gun', 'trigger', ['bubble'], null],
    ['버튼을 누르면 상자 뚜껑이 90도 열리는 장난감, 건전지 사용', 'product', 'box', 'button', ['motion'], 'battery'],
    ['손잡이를 돌리면 인형 날개가 흔들리게, 손힘으로만', 'product', 'figure', 'handle', ['motion'], 'hand'],
    ['스위치를 켜면 바람이 나오는 원통 선풍기', 'product', 'tube', 'switch', ['wind'], null],
    ['와이퍼처럼 80도를 2초에 한 번 흔들고 싶어', 'motion', null, null, ['motion'], null] ];
  for (const [t, kind, shape, input, fx, power] of P) { const R = C.m2mRequest(t);
    ok(R.kind === kind, `요청서 "${t}": 종류 ${R.kind}`);
    ok(R.shape.value === shape, `요청서 "${t}": 모양 ${R.shape.value}`);
    ok((R.inputs[0] ? R.inputs[0].kind : null) === input, `요청서 "${t}": 입력 ${R.inputs[0] && R.inputs[0].kind}`);
    ok(R.effects.map(e => e.kind).join() === fx.join(), `요청서 "${t}": 효과 ${R.effects.map(e => e.kind)}`);
    ok(R.power.value === power, `요청서 "${t}": 동력 ${R.power.value}`); }
  const B = C.m2mRequest(P[0][0]);
  ok(B.spec.purpose.value !== 'push', '요청서: 비누방울 "나가야"를 밀기로 읽음');
  ok(C.m2mRequestQuestions(B).some(q => q.key === 'power'), '요청서: 동력을 모르면 물어야 함');
  const RB = C.m2mRecommend(B.spec); ok(RB.blocked === 'motion' && RB.list.length === 0, '요청서: 움직임을 모르는데 추천함');
  ok(C.m2mRequestQuestions(C.m2mRequest(P[4][0])).length === 0, '요청서: 움직임 하나 문장에 제품 질문을 함'); }
console.log(fail ? `${fail}개 실패` : '모두 통과'); process.exit(fail ? 1 : 0);
