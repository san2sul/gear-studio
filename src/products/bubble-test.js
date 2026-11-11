// ---- 관문 2 원리 시험편: 계산으로 알 수 없는 '비누막이 생기고 방울이 되는가'를 작게 출력해 실험 ----
// 링 막대 A(구멍 지름 3가지), 링 막대 B(판 두께 3가지), 팬 시험대(링까지 거리 홈 3개). 제품과 같은 팬·모터를 씀
const BUB_TEST_DIST = [10, 20, 30];
function bubbleTestKit(D) {
  const G = bubbleGeom(D), dA = [D.ringD - 5, D.ringD, D.ringD + 5].map(v => Math.max(10, v)), tB = [1.6, 2.4, 3.2], Hs = Math.max(...dA) + 12, HAND = 30;
  // 막대 A: 판 두께는 제품 링 바퀴와 같게, 구멍 지름만 바꿈
  let x = HAND; const holes = []; for (const d of dA) { x += d / 2 + 6; holes.push(circlePts(d / 2, 72, x, Hs / 2)); x += d / 2 + 6; }
  const stripA = extrudeTris(rectPts(0, 0, x + 4, Hs), holes, D.wheelT), lenA = x + 4;
  // 막대 B: 구멍 지름은 설계값, 판 두께만 바꿈 (토막을 0.5 mm 겹쳐 이어 붙임)
  let stripB = extrudeTris(rectPts(0, 0, HAND + 0.5, Hs), [], 2.4); x = HAND;
  for (const t of tB) { const L = D.ringD + 12; stripB = stripB.concat(extrudeTris(rectPts(x - 0.5, 0, x + L, Hs), [circlePts(D.ringD / 2, 72, x + L / 2, Hs / 2)], t)); x += L; }
  const lenB = x;
  // 팬 시험대: 팬 앞면 y = 0, 팬 축 높이 = 막대가 홈에 섰을 때 구멍 가운데 높이
  const M = MOTORS.m130.body, zA = 3 + Hs / 2, g = Math.max(...tB, D.wheelT) + 0.6, rc = M.r + 0.3;
  const yMot = -6.5, base = extrudeTris(rectPts(-40, yMot - M.L - 6, 40, Math.max(...BUB_TEST_DIST) + g / 2 + 8), [], 3);
  let stand = base;
  for (const d of BUB_TEST_DIST) for (const [y0, y1] of [[d - g / 2 - 3, d - g / 2], [d + g / 2, d + g / 2 + 3]]) stand = stand.concat(moveTris(extrudeTris(rectPts(-35, y0, 35, y1), [], 10), 0, 0, 3));
  const U = [[-rc - 3, 3], [rc + 3, 3], [rc + 3, zA]]; for (let i = 0; i <= 24; i++) { const a = -PI * i / 24; U.push([rc * Math.cos(a), zA + rc * Math.sin(a)]); } U.push([-rc - 3, zA]);
  for (const yEnd of [yMot - 3, yMot - M.L + 9]) stand = stand.concat(xfTris(extrudeTris(U, [], 6), BYp(yEnd)));
  return { dA, tB, dists: BUB_TEST_DIST, Hs, zA, gap: g, design: { ringD: D.ringD, wheelT: D.wheelT, dist: BUB_FAN_DIST },
    parts: [{ name: '링 막대 A (구멍 지름)', file: `T1_ring_strip_d${dA.join('-')}`, tris: stripA, size: [lenA, Hs] }, { name: '링 막대 B (판 두께)', file: `T2_ring_strip_t${tB.join('-')}_d${D.ringD}`, tris: stripB, size: [lenB, Hs] },
      { name: '팬 시험대', file: `T3_fan_stand_dist${BUB_TEST_DIST.join('-')}`, tris: stand }, { name: '팬', file: `T4_fan_d${fmt(2 * G.fanR, 0)}`, tris: bubbleFanTris(G.fanR) }] };
}
// 시험 결과 P.ptest = {A:{지름:'ok'|'few'|'no'}, B:{두께:…}, dist: 10|20|30|null} → 가장 잘 된 값
function bubbleTestBest(T) {
  if (!T) return null; const sc = { ok: 2, few: 1, no: 0 }, best = o => { const e = Object.entries(o || {}).filter(([, v]) => v in sc); if (!e.length) return null; e.sort((a, b) => sc[b[1]] - sc[a[1]]); return sc[e[0][1]] > 0 ? +e[0][0] : null; };
  return { ringD: best(T.A), wheelT: best(T.B), dist: T.dist ? +T.dist : null };
}
// ---- 작동 준비도: 관문별 항목 상태. ok 통과 · bad 미달 · test 실험 필요 · none 아직 앱에 없음 ----
function bubbleReadiness(D, M, T, tests) {
  const rows = [], add = (gate, item, state, how) => rows.push({ gate, item, state, how });
  const clr = M.checks.filter(c => c.st !== 'warn' && c.st !== 'info'), badC = clr.filter(c => c.st === 'bad').length, badV = (M.verify || []).filter(r => r.ok === false).length;
  add(1, '요청서 꼭 정할 칸', 'ok', '요청서 단계에서 확인');
  add(5, '치수·회전수 요구치', badV ? 'bad' : 'ok', badV ? `미달 ${badV}개` : '모두 맞음 (계산)');
  add(5, '부품 사이 거리(회전 원 기준)', badC ? 'bad' : 'ok', badC ? `미달 ${badC}개` : '모두 1 mm 이상 (계산)');
  const r = T && T.A ? T.A[D.ringD] : null, t = T && T.B ? T.B[D.wheelT] : null;
  add(2, `링 ${D.ringD} mm에 비누막·방울이 생김`, r ? (r === 'no' ? 'bad' : 'ok') : 'test', r ? { ok: '시험: 잘 나옴', few: '시험: 조금 나옴', no: '시험: 안 나옴' }[r] : '링 막대 A로 실험하세요');
  add(2, `판 두께 ${D.wheelT} mm에서 막이 유지됨`, t ? (t === 'no' ? 'bad' : 'ok') : 'test', t ? { ok: '시험: 잘 나옴', few: '시험: 조금 나옴', no: '시험: 안 나옴' }[t] : '링 막대 B로 실험하세요');
  const dist = T && T.dist ? +T.dist : null;
  add(2, `팬 거리 ${BUB_FAN_DIST} mm에서 방울이 떨어져 나감`, dist == null ? 'test' : dist === BUB_FAN_DIST ? 'ok' : 'bad', dist == null ? '팬 시험대로 실험하세요' : dist === BUB_FAN_DIST ? '시험에서 가장 잘 된 거리와 같음' : `시험에서는 ${dist} mm가 가장 잘 됨 → 설계의 팬 거리는 아직 바꿀 수 없음(미구현)`);
  for (const x of ['모터 토크 대 부하(안전율)', '팬 바람 세기', '기어 이 굽힘 강도', '방아쇠 스프링과 스위치 누르는 힘', '건전지 사용 시간']) add(3, x, 'none', '공학 계산 단계에서 만들 예정');
  for (const x of ['나사 보스·맞춤 핀', '프린터 보정(공차) 적용', '회로도·전선 통로', '물과 전기 분리', '방아쇠 안내 홈·복귀 스프링 자리']) add(4, x, 'none', '상세 설계 단계에서 만들 예정');
  for (const x of ['삼각형 단위 간섭', '조립 순서대로 들어가는지', '출력 가능성(오버행·두께)']) add(5, x, 'none', '검증 단계에서 만들 예정');
  const last = (tests || []).slice(-1)[0]; add(6, '시제품에서 방울이 나옴', last ? (last.result === 'ok' ? 'ok' : 'bad') : 'test', last ? `마지막 기록: ${{ ok: '잘 나옴', small: '작게 나옴', none: '안 나옴' }[last.result] || last.result}` : '시제품을 출력해 시험하세요');
  const gOK = g => rows.filter(x => x.gate === g).every(x => x.state === 'ok');
  const level = !gOK(5) && rows.some(x => x.gate === 5 && x.state === 'bad') ? 0 : gOK(1) && rows.filter(x => x.gate === 5 && x.state !== 'none').every(x => x.state === 'ok') ? (gOK(2) && gOK(3) && gOK(4) && gOK(5) ? (gOK(6) ? 3 : 2) : 1) : 0;
  return { rows, level, label: ['아직 움직이는 모형도 안 됨', '움직이는 모형까지', '시제품을 만들어 볼 단계', '작동하는 제품'][level] };
}
