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
    ['버튼을 누르면 뚜껑이 90도 열리는 상자 모양 장난감, 건전지 사용', 'product', 'box', 'button', ['motion'], 'battery'],
    ['손잡이를 돌리면 인형 날개가 흔들리게, 손힘으로만', 'product', 'figure', 'handle', ['motion'], 'hand'],
    ['스위치를 켜면 바람이 나오는 원통 모양 선풍기', 'product', 'tube', 'switch', ['wind'], null],
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
  ok(C.m2mRequestQuestions(C.m2mRequest(P[4][0])).length === 0, '요청서: 움직임 하나 문장에 제품 질문을 함');
  ok(C.m2mRequest('컨베이어 위 상자를 3초마다 옆으로 40mm 밀어내고 싶어').kind === 'motion', '요청서: 옮기는 물건(상자)을 제품 모양으로 읽음'); }
{ // 13. 비누방울 총 (G2~G6): 기능 분해, 개념안 걸러내기, B안 역산·검사·껍데기·출력 크기
  const R = C.m2mRequest('총모양의 형상. 방아쇠를 당기면 총 입구에서 비누방울이 만들어져 나가야 함'), Dc = C.m2mDecompose(R);
  ok(Dc.ok && !Dc.gaps.length && ['wet_film', 'move_film', 'make_air', 'store_liquid'].every(f => Dc.funcs.some(x => x.id === f)), '비누방울: 기능 분해');
  R.power = { value: 'battery', source: 'user' }; let K = C.m2mConcepts(R);
  ok(K.list[0] && K.list[0].id === 'B' && K.list[0].built === 'bubbleB', `비누방울: 건전지 가능이면 1순위 B (${K.list[0] && K.list[0].id})`);
  ok(['A', 'B', 'C'].every(id => K.list.some(c => c.id === id)), '비누방울: A·B·C가 모두 나와야 함');
  R.power = { value: 'hand', source: 'user' }; K = C.m2mConcepts(R);
  ok(K.list.every(c => !c.motor) && K.rejected.some(c => c.id === 'B'), '비누방울: 손힘만이면 모터 안 탈락');
  for (const p of [{}, { ringD: 30 }, { rings: 8, ringD: 20 }, { wheelRpm: 60 }]) {
    const D = C.bubbleDesign(p), M = C.buildModel(D), tag = JSON.stringify(p);
    ok(M.verify.every(r => r.ok !== false), `비누방울 ${tag}: 검증 미달 ${M.verify.filter(r => r.ok === false).map(r => r.key)}`);
    ok(!M.checks.some(c => c.st === 'bad'), `비누방울 ${tag}: 검사 ${M.checks.filter(c => c.st === 'bad').map(c => c.txt)}`);
    const w = M.verify.find(r => r.key === 'wheel_rpm'); ok(Math.abs(w.got - D.wheelRpm) / D.wheelRpm <= 0.05, `비누방울 ${tag}: 회전수 ${w.got}`);
    ok(M.housing.length === 4 && M.parts.filter(q => !q.noExport).length === 6, `비누방울 ${tag}: 부품 수`);
    // 출력 부품·껍데기가 출력판(220×220×250)에 들어가는지 (출력 방향 기준)
    const big = M.parts.filter(q => !q.noExport).concat(M.housing).filter(q => { const t = q.print ? C.xfTris(q.tris, q.print) : q.tris, b = C.trisBounds(t), d = [0, 1, 2].map(a => b.hi[a] - b.lo[a]); return d[0] > 220 || d[1] > 220 || d[2] > 250; });
    ok(!big.length, `비누방울 ${tag}: 출력판보다 큰 부품 ${big.map(q => q.name)}`); }
  const D30 = C.bubbleDesign({ ringD: 30 }), D25 = C.bubbleDesign({}); ok(D30.R > D25.R, '비누방울: 링을 키우면 바퀴 반지름이 커져야 함'); }
{ // 14. 요청서 추가 항목: 잴 수 있는 항목은 계산해 비교, 나머지는 미검증
  const M = C.buildModel(C.bubbleDesign({})), ev = x => C.m2mExtraEval(x, M);
  ok(ev({ key: 'len', op: '≤', value: 100 }).state === 'bad' && ev({ key: 'len', op: '≤', value: 300 }).state === 'ok', `추가 항목: 길이 비교 (${M.measures.len})`);
  ok(ev({ key: 'liquid', op: '≥', value: 20 }).state === 'ok', `추가 항목: 비누액 ${M.measures.liquid}`);
  ok(ev({ key: 'rate', op: '≥', value: 4 }).state === 'ok' && ev({ key: 'rate', op: '≥', value: 6 }).state === 'bad', '추가 항목: 방울 자리');
  ok(ev({ key: 'weight', op: '≤', value: 300 }).state === 'unv' && ev({ key: null, label: '색', op: '=', value: '파랑' }).state === 'unv', '추가 항목: 계산 못 하는 것은 미검증'); }
{ // 15. 부위별 사양과 동작: 3D와 이은 부위는 설계 입력·잰 값과 비교, 나머지는 미검증
  const R = C.m2mRequest('총모양의 형상. 방아쇠를 당기면 총 입구에서 비누방울이 만들어져 나가야 함');
  ok(R.parts.length === 5 && R.parts.map(p => p.link).join() === 'muzzle,trigger,grip,body,wheel', `부위: 총 기본 부위 ${R.parts.map(p => p.name)}`);
  ok(C.m2mRequest('버튼을 누르면 비누방울이 나오는 장난감').parts.length === 0, '부위: 모양이 없으면 기본 부위 없음');
  const M = C.buildModel(C.bubbleDesign({ muzzleD: 38 })), P = n => R.parts.find(p => p.link === n);
  ok(!M.checks.some(c => c.st === 'bad'), '부위: 총구 38 mm도 검사 통과');
  ok(C.m2mSpecEval({ key: 'muzzleD', op: '=', value: 38 }, M).state === 'ok' && C.m2mSpecEval({ key: 'muzzleD', op: '=', value: 30 }, M).state === 'bad', `부위: 총구 지름 비교 (${M.measures.muzzleD})`);
  ok(C.m2mSpecEval({ key: 'trigForce', op: '≤', value: 10 }, M).state === 'unv' && C.m2mSpecEval({ key: null, label: '색', op: '=', value: '빨강' }, M).state === 'unv' && C.m2mSpecEval({ key: 'muzzleD', op: '=', value: '' }, M).state === 'none', '부위: 계산 못 하는 사양은 미검증, 빈 값은 정하지 않음');
  ok(C.m2mMotionEval(P('trigger'), { kind: 'linear', traits: { stroke_mm: 2 } }, M).state === 'ok' && C.m2mMotionEval(P('trigger'), { kind: 'linear', traits: { stroke_mm: 20 } }, M).state === 'bad', '부위: 방아쇠 행정 비교');
  ok(C.m2mMotionEval(P('wheel'), { kind: 'rotate', traits: { rpm: 40 } }, M).state === 'ok' && C.m2mMotionEval(P('wheel'), { kind: 'swing', traits: {} }, M).state === 'bad', '부위: 링 바퀴 회전 비교');
  ok(C.m2mMotionEval(P('grip'), { kind: 'rotate', traits: {} }, M).state === 'bad' && C.m2mMotionEval(P('grip'), { kind: 'none', traits: {} }, M).state === 'ok', '부위: 고정 부위');
  ok(C.m2mMotionEval({ name: '뚜껑', link: '' }, { kind: 'swing', traits: {} }, M).state === 'unv', '부위: 3D와 잇지 않은 부위는 미검증');
  const big = C.buildModel(C.bubbleDesign({ muzzleD: 60 })); ok(big.checks.some(c => c.st === 'bad' && /총구/.test(c.txt)), '부위: 총구가 너무 크면 검사 실패'); }
{ // 16. 대화로 요청서 완성: 규칙 추출기·완성도·배운 표현
  const long = C.m2mRequest('권총 모양 비누방울 장난감. 링 지름 3cm, 링 8개, 1초에 5번, 전체 길이 150mm, 손잡이 100도, 비누액 50mL 이상, 건전지 사용, 무게 300g 이하');
  const g = k => (C.m2mSlotGet(long, k) || {}).value;
  ok(g('ringD') === 30 && g('rings') === 8 && g('rate') === 5 && g('gunLen') === 150 && g('gripAngle') === 100 && g('liquid') === 50 && g('weight') === 300, `대화: 긴 글에서 수치 읽기 ${['ringD', 'rings', 'rate', 'gunLen', 'gripAngle', 'liquid', 'weight'].map(g)}`);
  ok(C.m2mReqMissing(long).join() === 'inputs', '대화: 남은 칸은 사람 입력뿐 ' + C.m2mReqMissing(long));
  const R = C.m2mRequest('총모양의 형상. 방아쇠를 당기면 총 입구에서 비누방울이 만들어져 나가야 함'), pr = C.m2mReqProgress(R);
  ok(pr.total === 8 && pr.done === 3 && C.m2mReqMissing(R)[0] === 'power', `대화: 완성도 ${JSON.stringify(pr)}`);
  const ans = (t, k) => C.m2mApplyFound(R, C.m2mExtract(t, R, k), 'user').map(f => f.slot + '=' + f.value).join();
  ok(ans('건전지 써도 돼요', 'power') === 'power=battery' && ans('30', 'ringD') === 'ringD=30' && ans('15센티 정도', 'gunLen') === 'gunLen=150' && ans('넉넉히 40ml', 'liquid') === 'liquid=40', '대화: 짧은 답을 물은 칸에 넣기');
  ok(C.m2mExtract('3초마다 40mm 밀기', R, null).length === 0, '대화: 초·관계없는 숫자는 읽지 않음');
  const out = C.m2mExtract('링 지름 80mm', R, null); ok(out[0] && out[0].err && C.m2mApplyFound(R, out, 'user').length === 0, '대화: 범위 밖은 넣지 않음');
  // AI가 채운 표현을 배우면 다음부터 규칙이 읽음 (값은 AI 추정으로 표시)
  const L = C.m2mLearn([], '방울은 큼직하게 해줘', [{ slot: 'ringD', value: 35, phrase: '큼직하게', how: 'ai' }], []);
  ok(L.added.length === 1, '대화: 표현 배우기');
  const R2 = C.m2mRequest('총 모양 비누방울'), f2 = C.m2mExtract('방울은 큼직하게', R2, null, L.lex); C.m2mApplyFound(R2, f2, 'user');
  ok((C.m2mSlotGet(R2, 'ringD') || {}).value === 35 && C.m2mSlotGet(R2, 'ringD').source === 'ai', '대화: 배운 표현으로 읽기');
  const L2 = C.m2mLearn([], '물통은 50 정도 들어가게', [{ slot: 'liquid', value: 50, phrase: '물통은 50', how: 'ai' }], []);
  ok(L2.added[0] && L2.added[0].value === null && L2.added[0].phrase === '물통은', '대화: 숫자 앞 낱말 배우기'); }
{ // 17. 공학 계산 (관문 3): 결정적 식 + 가정값
  const D = C.bubbleDesign({}), M = C.buildModel(D), E = C.bubbleEngCalc(D, M), r = k => E.rows.find(x => x.key === k);
  ok(E.rows.length === 7 && E.rows.every(x => isFinite(x.value) && x.how && Array.isArray(x.assume)), '계산: 7항목 모두 수치·근거');
  ok(Math.abs(C.trisVolume(C.extrudeTris([[0, 0], [10, 0], [10, 10], [0, 10]], [], 5)) - 500) < 1e-6, '계산: 부피 10×10×5 = 500');
  ok(Math.abs(C.lewisY(12) - 0.245) < 1e-9 && C.lewisY(36) > 0.37 && C.lewisY(36) < 0.385, '계산: Lewis Y');
  const m = C.dcMotor(C.MOTORS.n20_300, 3); ok(Math.abs(m.n0 - 150) < 1e-9 && Math.abs(m.Ts - 37.5) < 1e-9 && Math.abs(m.speedAt(18.75) - 75) < 1e-9, '계산: 모터 직선 모델');
  ok(r('torque').ok && r('gear').ok && r('air').ok && r('battery').ok && r('trig_pull').ok && r('trig_ret').ok, '계산: 기본 설계는 강도·토크·바람·전지·방아쇠 통과');
  ok(!r('wheel_pred').ok && r('wheel_pred').value > 45, `계산: 80% 가정으로 정한 잇수면 바퀴가 빨리 돈다 (${r('wheel_pred').value})`);
  const D2 = C.bubbleDesign({ motRpm: r('wheel_pred').value * D.z2 / D.z1 }), M2 = C.buildModel(D2), E2 = C.bubbleEngCalc(D2, M2);
  ok(E2.rows.find(x => x.key === 'wheel_pred').ok && D2.motRpmSrc === 'calc' && !M2.checks.some(c => c.st === 'bad'), `계산: 계산값으로 잇수를 다시 정하면 목표 회전수 (z${D2.z2}, ${E2.rows.find(x => x.key === 'wheel_pred').value})`);
  ok(!C.bubbleEngCalc(D, M, { trigForceMax: 3 }).rows.find(x => x.key === 'trig_pull').ok, '계산: 당기는 힘 기준을 낮추면 미달');
  const Rd = C.bubbleReadiness(D2, M2, null, [], E2); ok(Rd.rows.filter(x => x.gate === 3).every(x => x.state === 'ok'), '계산: 준비도 관문 3 통과'); }
console.log(fail ? `${fail}개 실패` : '모두 통과'); process.exit(fail ? 1 : 0);
