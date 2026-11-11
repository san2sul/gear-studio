/* ================= Motion-to-Machine 스튜디오: 요구사항 → 기구 추천 =================
 분류(운동 형태·목적·특성·제약), 요구사항 명세서(값마다 출처), 규칙 기반 해석, 기구 지식 표(M2M_KB),
 역산(요구치 → 기구 치수)과 측정(만든 모델에서 실제 행정·각도를 다시 잼), 추천 점수.
 AI는 명세서 초안만 만들 수 있고, 치수·운동은 모두 여기와 기존 엔진이 결정적으로 계산함 */
const M2M_MOTIONS = {
  rotate: { ko: '연속 회전', hint: '바퀴·롤러·믹서처럼 계속 돎' },
  intermittent: { ko: '돌다 멈춤 (간헐 회전)', hint: '한 칸씩 돌고 멈춤' },
  swing: { ko: '흔들기 (요동)', hint: '정해진 각도를 오감' },
  recip: { ko: '직선 왕복', hint: '앞뒤·위아래로 반복' },
  linear: { ko: '직선 이동', hint: '한 방향으로 정해진 거리' },
  lift: { ko: '들어 올리기', hint: '물건을 위로 올림' },
  vibrate: { ko: '진동', hint: '빠르게 떨림' },
  grip: { ko: '잡기·놓기', hint: '집었다 놓음' },
};
const M2M_PURPOSES = { move: '이동·운반', push: '밀기·당기기', grip: '잡기·고정', mix: '회전·교반', cut: '절단·압축', feed: '정렬·분류·공급', position: '위치 결정', other: '기타' };
// 운동마다 꼭 필요한 특성과 질문 (값이 없으면 질문으로)
const M2M_NEED = {
  rotate: [['rpm', '출력이 1분에 몇 바퀴 돌아야 하나요?', 'rpm']],
  intermittent: [['steps', '한 바퀴를 몇 칸으로 나눠 멈추나요?', '칸'], ['period_s', '한 칸 움직이는 데 몇 초 걸리면 되나요?', '초']],
  swing: [['angle_deg', '몇 도를 오가야 하나요?', '°'], ['period_s', '한 번 왕복에 몇 초인가요?', '초']],
  recip: [['stroke_mm', '몇 mm를 오가야 하나요?', 'mm'], ['period_s', '한 번 왕복에 몇 초인가요?', '초']],
  linear: [['stroke_mm', '몇 mm를 움직여야 하나요?', 'mm'], ['speed_mms', '1초에 몇 mm 움직이면 되나요?', 'mm/s']],
  lift: [['stroke_mm', '몇 mm 들어 올려야 하나요?', 'mm'], ['load_N', '얼마나 무거운 것을 드나요?', 'N (1 kg ≈ 9.8 N)']],
  vibrate: [['freq_hz', '1초에 몇 번 떨면 되나요?', 'Hz']],
  grip: [['stroke_mm', '집는 물건의 폭은 몇 mm인가요?', 'mm']],
};
const M2M_TRAITS = { stroke_mm: ['행정·거리', 'mm'], angle_deg: ['각도', '°'], steps: ['칸 수', '칸'], period_s: ['주기', '초'], rpm: ['회전수', 'rpm'], speed_mms: ['속도', 'mm/s'], load_N: ['하중', 'N'], force_N: ['힘', 'N'], freq_hz: ['진동수', 'Hz'] };
const M2M_SRC = { user: '내가 줌', ai: 'AI 추정', default: '기본값', calc: '계산', missing: '비어 있음' };
function m2mSpec(text = '') {
  return { schema: 'm2m.spec/1', text, motion: { value: null, source: 'missing' }, purpose: { value: 'other', source: 'default' }, traits: {}, limits: { box_mm: null, make: 'fdm' } };
}
const m2mVal = (S, k) => S.traits[k] && S.traits[k].value != null && isFinite(S.traits[k].value) ? +S.traits[k].value : null;
// ---- 규칙 기반 해석: 낱말과 숫자·단위만 봄 (AI를 못 쓸 때도 동작) ----
const M2M_WORDS = [
  ['grip', /잡[았고기는다아]|집[었고기는어게]|그리퍼|집게|grip|grab|pick/i],
  ['vibrate', /진동|떨[리림게]|흔들흔들|vibrat|shak/i],
  ['intermittent', /간헐|멈췄다|멈추[고며]|칸씩|한 ?칸|정지했다|돌다가? ?멈|index|indexing|step/i],
  ['swing', /요동|흔들|왔다 ?갔다|열리|닫히|여닫|와이퍼|까딱|좌우로 ?움직|오가|swing|oscillat|wiper|rock/i],
  ['recip', /왕복|피스톤|앞뒤로|위아래로|밀었다|밀고 ?당|두드리|찍[었고]|reciproc|back and forth|piston|stamp|tap/i],
  ['lift', /들어 ?올|올리|승강|끌어 ?올|감아 ?올|리프트|lift|hoist|raise/i],
  ['linear', /직선|이동|밀어|전진|슬라이드|옮기|보내|이송|linear|slide|move|push/i],
  ['rotate', /회전|돌[리려아게고]|바퀴|감속|증속|믹서|교반|젓|rpm|rotat|spin|turn/i],
];
const M2M_PWORDS = [['grip', /잡|집|고정|grip|hold/i], ['push', /밀|당기|누르|push|pull|press/i], ['mix', /섞|교반|젓|mix|stir/i], ['cut', /자르|절단|압축|찍|cut|press/i],
  ['feed', /분류|정렬|공급|하나씩|sort|feed/i], ['position', /위치|각도 ?맞|자세|position/i], ['move', /옮기|운반|이송|나르|올리|move|carry|convey/i]];
function m2mParse(text) {
  const S = m2mSpec(text), t = String(text || ''), set = (k, v, note) => { if (v == null || !isFinite(v)) return; S.traits[k] = { value: +(+v).toPrecision(6), source: 'user', ...(note ? { note } : {}) }; };
  let mo = null; for (const [id, re] of M2M_WORDS) if (re.test(t)) { mo = id; break; }
  if (mo === 'linear' && /마다|반복|계속|왕복|되돌아|돌아오/.test(t)) mo = 'recip';
  if (mo) S.motion = { value: mo, source: 'user' };
  for (const [id, re] of M2M_PWORDS) if (re.test(t)) { S.purpose = { value: id, source: 'user' }; break; }
  const num = '(\\d+(?:[.,]\\d+)?)', f = s => +String(s).replace(',', '.');
  // 크기 W×D×H
  const bx = t.match(new RegExp(num + '\\s*[x×*]\\s*' + num + '(?:\\s*[x×*]\\s*' + num + ')?\\s*(mm|cm|밀리|센티)?', 'i'));
  let rest = t;
  if (bx) { const k = /cm|센티/i.test(bx[4] || '') ? 10 : 1; S.limits.box_mm = [f(bx[1]) * k, f(bx[2]) * k, bx[3] ? f(bx[3]) * k : null]; rest = t.replace(bx[0], ' '); }
  // 속도 mm/s (먼저 떼어 내어 길이로 잘못 읽지 않게)
  const sp = rest.match(new RegExp(num + '\\s*(mm|cm)\\s*/\\s*(s|초)', 'i')) || rest.match(new RegExp('(?:1|한)\\s*초에\\s*' + num + '\\s*(mm|cm|센티|밀리)', 'i'));
  if (sp) { set('speed_mms', f(sp[1]) * (/cm|센티/i.test(sp[2]) ? 10 : 1)); rest = rest.replace(sp[0], ' '); }
  // 길이
  const L = [...rest.matchAll(new RegExp(num + '\\s*(mm|밀리|cm|센티|m(?![a-z/])|미터)', 'gi'))].map(m => f(m[1]) * (/cm|센티/i.test(m[2]) ? 10 : /^m$|미터/i.test(m[2]) ? 1000 : 1));
  if (L.length) set('stroke_mm', L[0]);
  // 각도
  const A = rest.match(new RegExp(num + '\\s*(°|도(?!록))', 'i'));
  if (A) { const a = f(A[1]); if (mo === 'intermittent') { set('angle_deg', a); if (a > 0 && 360 % a < 1e-6) set('steps', 360 / a); } else set('angle_deg', a); }
  // 칸 수
  const st = rest.match(new RegExp(num + '\\s*(칸|등분|번 ?멈|단계|positions?|steps?)', 'i')); if (st) set('steps', Math.round(f(st[1])));
  // 시간: N초마다, 주기 N초, N분
  const tm = rest.match(new RegExp(num + '\\s*(초|s(?:ec)?\\b|분(?!당))', 'i')); if (tm) set('period_s', f(tm[1]) * (/분/.test(tm[2]) ? 60 : 1));
  // 빈도: 1초에 N번 / 분당 N번(바퀴) / N rpm / N Hz
  const hz = rest.match(new RegExp(num + '\\s*hz', 'i')) || rest.match(new RegExp('(?:1|한)\\s*초에\\s*' + num + '\\s*(?:번|회)', 'i'));
  if (hz) { mo === 'vibrate' ? set('freq_hz', f(hz[1])) : set('period_s', 1 / f(hz[1])); }
  const rpm = rest.match(new RegExp(num + '\\s*rpm', 'i')) || rest.match(new RegExp('(?:분당|1분에|일 ?분에)\\s*' + num + '\\s*(?:번|회|바퀴|회전)', 'i'));
  if (rpm) { if (mo === 'rotate' || !mo) set('rpm', f(rpm[1])); else set('period_s', 60 / f(rpm[1])); }
  // 힘·무게
  const fN = rest.match(new RegExp(num + '\\s*(N|뉴턴)(?![a-z])', '')); if (fN) set(mo === 'lift' ? 'load_N' : 'force_N', f(fN[1]));
  const kg = rest.match(new RegExp(num + '\\s*(kg|킬로|g(?![a-z])|그램)', 'i'));
  if (kg) { const N = f(kg[1]) * (/^g$|그램/i.test(kg[2]) ? 0.001 : 1) * 9.81; set(mo === 'lift' ? 'load_N' : 'force_N', N, `${kg[1]} ${kg[2]} × 9.81`); }
  return S;
}
// 빠진 필수 값 → 질문
function m2mQuestions(S) {
  if (!S.motion.value) return [{ key: 'motion', ask: '어떤 움직임에 가장 가깝나요?', choices: Object.entries(M2M_MOTIONS).map(([k, v]) => [k, v.ko]) }];
  const out = (M2M_NEED[S.motion.value] || []).filter(([k]) => m2mVal(S, k) === null && !(k === 'steps' && m2mVal(S, 'angle_deg'))).map(([key, ask, unit]) => ({ key, ask, unit }));
  return out;
}
// 빈 값은 기본값으로 채운 사본 (출처 default)
const M2M_DEF = { stroke_mm: 30, angle_deg: 60, steps: 4, period_s: 2, rpm: 30, speed_mms: 5, load_N: 5, force_N: 5, freq_hz: 20 };
function m2mFilled(S) {
  const T = JSON.parse(JSON.stringify(S));
  if (!T.motion.value) T.motion = { value: 'recip', source: 'default' };
  for (const [k] of M2M_NEED[T.motion.value] || []) if (m2mVal(T, k) === null) T.traits[k] = { value: M2M_DEF[k], source: 'default' };
  if (T.motion.value === 'intermittent' && m2mVal(T, 'steps') === null) T.traits.steps = { value: Math.round(360 / (m2mVal(T, 'angle_deg') || 90)), source: 'calc' };
  return T;
}
// ---- 기구 지식 표 ----
const m2mLk = (t, mut) => { const D = linkageDefault(); D.type = t; D.drive.motor = 'auto'; if (mut) mut(D); return D; };
const rpmOfPeriod = S => +(60 / (m2mVal(S, 'period_s') || 2)).toFixed(2);
// 4절 링크: 흔들 각도 맞추기 (크랭크 b, 흔들이 d를 찾음, 전달각 35° 이상)
function m2mFourbar(target) {
  let best = null; const a = 60, c = 55;
  for (let d = 25; d <= 70; d += 2.5) for (let b = 4; b <= 30; b += 0.5) {
    const F = { a, b, c, d, p: 0, q: 0 }; if (!grashof(F).ok || grashof(F).type !== 'crank-rocker') continue;
    let lo = Infinity, hi = -Infinity, mu = Infinity, ok = true;
    for (let i = 0; i < 120; i++) { const ps = linkPose({ type: 'fourbar', fourbar: F }, 2 * PI * i / 120); if (!ps) { ok = false; break; } const p = ps.psi / D2R; lo = Math.min(lo, p); hi = Math.max(hi, p); mu = Math.min(mu, ps.mu / D2R, 180 - ps.mu / D2R); }
    if (!ok || mu < 35) continue; const e = Math.abs(hi - lo - target);
    if (!best || e < best.e - 0.05 || (Math.abs(e - best.e) <= 0.05 && mu > best.mu)) best = { F, e, mu };
  }
  return best;
}
const M2M_KB = [
  { id: 'slider', ko: '크랭크-슬라이더', motions: ['recip'], purposes: ['push', 'cut', 'feed'], diff: 1,
    principle: '돌아가는 크랭크가 연결봉으로 슬라이더를 밀고 당깁니다. 행정은 크랭크 반경의 두 배입니다.', io: '회전 → 직선 왕복', vars: '크랭크 반경 r, 연결봉 L', range: { stroke_mm: [6, 120] },
    pros: ['구조가 단순하고 튼튼함', '큰 힘을 전달'], cons: ['속도가 사인 곡선이라 끝에서 느려짐', '멈춤 구간을 만들 수 없음'], examples: ['피스톤', '왕복 톱', '펀치'],
    synth: S => { const s = m2mVal(S, 'stroke_mm'), r = +(s / 2).toFixed(2); return m2mLk('slider', D => { D.slider.r = r; D.slider.L = Math.max(30, Math.ceil(r * 3.5)); D.rpm = rpmOfPeriod(S); D.drive.F = m2mVal(S, 'force_N') ?? 5; }); },
    measure: (D, M) => ({ stroke_mm: M.range }) },
  { id: 'yoke', ko: '스카치 요크', motions: ['recip'], purposes: ['push', 'feed'], diff: 1,
    principle: '크랭크 핀이 홈 안을 미끄러지며 요크를 순수한 사인 운동으로 왕복시킵니다.', io: '회전 → 직선 왕복', vars: '반경 r', range: { stroke_mm: [6, 100] },
    pros: ['길이가 짧고 운동이 정확한 사인 곡선'], cons: ['홈의 마찰과 마모', '큰 힘에 약함'], examples: ['밸브 구동', '시험 장비'],
    synth: S => m2mLk('yoke', D => { D.yoke.r = +(m2mVal(S, 'stroke_mm') / 2).toFixed(2); D.rpm = rpmOfPeriod(S); D.drive.F = m2mVal(S, 'force_N') ?? 5; }),
    measure: (D, M) => ({ stroke_mm: M.range }) },
  { id: 'cam', ko: '캠과 종동절', motions: ['recip'], purposes: ['push', 'feed', 'cut'], diff: 2, kind: 'cam',
    principle: '모양을 깎은 원판(캠)이 돌며 종동절을 정해진 변위 곡선대로 밀어 올리고 내립니다.', io: '회전 → 정해진 직선 변위(멈춤 가능)', vars: '기초원 Rb, 상승 h, 구간 각도', range: { stroke_mm: [2, 40] },
    pros: ['멈춤 구간과 속도 곡선을 마음대로', '동기화에 좋음'], cons: ['스프링으로 눌러야 함', '행정이 크면 캠이 커짐'], examples: ['엔진 밸브', '자동 기계 이송'],
    synth: S => { const D = camDefault(), h = m2mVal(S, 'stroke_mm'); D.rpm = rpmOfPeriod(S); D.Rb = Math.max(20, Math.ceil(h * 1.6)); D.motion.segs = D.motion.segs.map(g => ({ ...g, h: g.h ? h : 0 })); return D; },
    measure: D => ({ stroke_mm: Math.max(...D.motion.segs.map(g => g.h || 0)), period_s: 60 / D.rpm }) },
  { id: 'fourbar', ko: '4절 링크 (크랭크-흔들이)', motions: ['swing'], purposes: ['position', 'move', 'other'], diff: 2,
    principle: '한 바퀴 도는 크랭크가 연결 막대로 흔들이를 정해진 각도만큼 흔듭니다. 링크 길이로 각도를 정합니다.', io: '회전 → 요동', vars: '링크 a·b·c·d', range: { angle_deg: [15, 110] },
    pros: ['핀 이음뿐이라 출력하기 쉬움', '궤적·각도를 넓게 설계'], cons: ['각도가 커지면 전달각이 나빠짐'], examples: ['와이퍼', '흔들 의자', '펌프 잭'],
    synth: S => { const b = m2mFourbar(m2mVal(S, 'angle_deg')); if (!b) return null; return m2mLk('fourbar', D => { Object.assign(D.fourbar, b.F); D.rpm = rpmOfPeriod(S); }); },
    measure: (D, M) => ({ angle_deg: M.range }) },
  { id: 'geneva', ko: '제네바 기구', motions: ['intermittent'], purposes: ['feed', 'position'], diff: 2,
    principle: '구동핀이 한 바퀴마다 바퀴의 홈 하나를 밀어 1/n 바퀴 돌리고, 나머지 동안 잠금 원판이 바퀴를 붙잡습니다.', io: '회전 → 간헐 회전(1바퀴에 1칸)', vars: '홈 수 n(3~8), 중심거리', range: { steps: [3, 8] },
    pros: ['멈춘 동안 확실히 잠김', '위치가 정확'], cons: ['칸 수가 3~8로 정해짐', '시작·끝 충격'], examples: ['영사기 필름 이송', '회전 작업대'],
    synth: S => { const n = Math.round(m2mVal(S, 'steps')); if (n < 3 || n > 8) return null; return m2mLk('geneva', D => { D.geneva.n = n; D.rpm = rpmOfPeriod(S); }); },
    measure: (D, M) => ({ steps: Math.round(360 / Math.abs(M.y[M.y.length - 1] - M.y[0])) }) },
  { id: 'intgear', ko: '간헐 기어 (이 빠진 기어)', motions: ['intermittent'], purposes: ['feed', 'position'], diff: 2,
    principle: '이가 일부만 있는 구동 기어가 한 바퀴마다 정해진 잇수만큼만 피동 기어를 돌립니다.', io: '회전 → 간헐 회전', vars: '구동 잇수 k, 피동 잇수 z2', range: { steps: [2, 20] },
    pros: ['칸 수를 잇수로 자유롭게'], cons: ['멈춘 동안 잠금이 약함'], examples: ['카운터', '종이 이송'],
    synth: S => { const n = Math.round(m2mVal(S, 'steps')); if (n < 2 || n > 20) return null; const z2 = n * Math.max(1, Math.round(20 / n)), k = z2 / n; return m2mLk('intgear', D => { D.intgear.z2 = z2; D.intgear.k = k; D.rpm = rpmOfPeriod(S); }); },
    measure: (D, M) => ({ steps: Math.round(360 / Math.abs(M.y[M.y.length - 1] - M.y[0])) }) },
  { id: 'screw', ko: '리드스크루와 너트', motions: ['linear', 'lift'], purposes: ['push', 'position', 'move'], diff: 1, atLeast: ['stroke_mm'],
    principle: '나사가 한 바퀴 돌 때 너트가 리드만큼 곧게 나아갑니다. 거꾸로는 잘 돌지 않아 멈춰도 버팁니다.', io: '회전 → 정밀 직선 이동', vars: '나사 지름 d, 피치 p, 줄 수', range: { stroke_mm: [5, 250], speed_mms: [0.2, 40] },
    pros: ['정밀하고 큰 힘', '멈춰도 내려가지 않음'], cons: ['느림', '긴 나사는 휨'], examples: ['3D 프린터 Z축', '바이스', '잭'],
    synth: S => { const v = m2mVal(S, 'speed_mms') ?? 2, s = m2mVal(S, 'stroke_mm'); return m2mLk('screw', D => { D.screw.p = 2; D.screw.starts = v > 4 ? 2 : 1; D.screw.len = Math.ceil(s + 20); D.rpm = +(v * 60 / (D.screw.p * D.screw.starts)).toFixed(4); D.drive.F = m2mVal(S, 'load_N') ?? m2mVal(S, 'force_N') ?? 5; }); },
    measure: (D, M) => ({ stroke_mm: D.screw.len - 20, speed_mms: Math.abs(M.y[M.y.length - 1] - M.y[0]) * D.rpm / 60 }) },
  { id: 'winch', ko: '윈치·도르래', motions: ['lift'], purposes: ['move'], diff: 1,
    principle: '드럼이 줄을 감아 물건을 들어 올립니다. 드럼 둘레만큼 한 바퀴에 올라갑니다.', io: '회전 → 끌어 올림', vars: '드럼 반경 r, 높이', range: { stroke_mm: [10, 400] },
    pros: ['긴 거리를 가볍게'], cons: ['멈추면 내려갈 수 있어 브레이크·웜이 필요', '흔들림'], examples: ['크레인', '블라인드'],
    synth: S => { const s = m2mVal(S, 'stroke_mm'); return m2mLk('winch', D => { D.winch.travel = Math.ceil(s); D.winch.H = Math.max(70, Math.ceil(s + 30)); D.drive.F = m2mVal(S, 'load_N') ?? 5; D.rpm = 30; }); },
    measure: D => ({ stroke_mm: D.winch.travel }) },
  { id: 'rack', ko: '랙과 피니언', motions: ['linear'], purposes: ['push', 'move'], diff: 1, kind: 'rack', atLeast: ['stroke_mm'],
    principle: '피니언이 돌면 이가 박힌 막대(랙)가 곧게 움직입니다. 피니언 한 바퀴에 π×모듈×잇수만큼 갑니다.', io: '회전 ↔ 직선', vars: '모듈, 피니언 잇수, 랙 길이', range: { stroke_mm: [10, 300], speed_mms: [2, 200] },
    pros: ['빠르고 길게 움직임'], cons: ['백래시', '멈추면 밀림'], examples: ['미닫이문', '조향 장치'],
    synth: S => { const s = m2mVal(S, 'stroke_mm'), v = m2mVal(S, 'speed_mms') ?? 10, m = 1.5, z1 = 14, per = PI * m * z1; return rackPair({ ...m2mPQ, m, z1, nR: Math.ceil(s / (PI * m)) + 6, H: 5, rpm: +(v * 60 / per).toFixed(4) }); },
    measure: D => ({ stroke_mm: (D.nR - 6) * PI * D.m, speed_mms: PI * D.m * D.z1 * D.rpm / 60 }) },
  { id: 'spur', ko: '평기어 한 쌍', motions: ['rotate'], purposes: ['mix', 'move', 'other'], diff: 1, kind: 'pair',
    principle: '잇수 비만큼 속도가 바뀌고 힘(토크)은 거꾸로 바뀝니다. 방향은 반대가 됩니다.', io: '회전 → 회전(속도·토크 변환)', vars: '모듈, 잇수 z1·z2', range: { ratio: [1 / 6, 6] },
    pros: ['효율이 높고(약 95%) 단순'], cons: ['한 단에 6:1 정도까지'], examples: ['시계', '감속기'],
    synth: S => { const r = (m2mVal(S, 'rpm') || 30), src = 60, i = src / r; if (i > 6 || i < 1 / 6) return null; let best = null; for (let z1 = 12; z1 <= 40; z1++) { const z2 = Math.round(z1 * i); if (z2 < 12 || z2 > 120) continue; const e = Math.abs(src * z1 / z2 - r); if (!best || e < best.e - 1e-9) best = { z1, z2, e }; } return best && pairDesign({ ...m2mPQ, z1: best.z1, z2: best.z2, rpm: src }); },
    measure: D => ({ rpm: D.rpm * D.gears[0].z / D.gears[1].z }) },
];
const m2mPQ = { m: 1.5, pa: 20, b: 8, bl: 0.1, x1: 0, x2: 0, bore1: 5, bore2: 5, d1: true, d2: true, on2: true, autoX: true, rpm: 60, helix: 0, herring: false };
// 한 후보 평가: 역산 → 모델 만들기 → 다시 재기 → 요구치와 비교
function m2mEval(K, S) {
  const C = { id: K.id, ko: K.ko, pass: false, score: 0, why: [], warn: [], design: null, got: {}, checks: [] };
  const fits = K.motions.includes(S.motion.value);
  if (!fits) { C.warn.push(`${K.io}라서 "${M2M_MOTIONS[S.motion.value].ko}"과 맞지 않습니다.`); return C; }
  for (const [k, [lo, hi]] of Object.entries(K.range || {})) { const v = m2mVal(S, k); if (v !== null && (v < lo || v > hi)) { C.warn.push(`${M2M_TRAITS[k][0]} ${fmt(v, 1)} ${M2M_TRAITS[k][1]}는 이 기구의 범위(${fmt(lo, 1)}~${fmt(hi, 1)})를 벗어납니다.`); return C; } }
  let D; try { D = K.synth(S); } catch (e) { D = null; }
  if (!D) { C.warn.push('요구치에 맞는 치수를 찾지 못했습니다.'); return C; }
  let M; try { M = buildModel(D); } catch (e) { C.warn.push('모델을 만들 수 없습니다: ' + (e && e.message || e)); return C; }
  const LM = D.kind === 'linkage' ? linkMotion(D) : null;
  if (LM && !LM.ok) { C.warn.push('한 바퀴를 다 돌지 못합니다(링크가 걸림).'); return C; }
  C.design = D; C.got = K.measure(D, LM, M);
  if (LM && C.got.period_s === undefined && m2mVal(S, 'period_s') !== null) C.got.period_s = 60 / D.rpm;
  // 요구치 대비 결과 (계산값, 1% 안이면 통과)
  C.rows = Object.entries(C.got).map(([k, v]) => { const want = m2mVal(S, k); const least = (K.atLeast || []).includes(k), err = want ? (least ? Math.max(0, want - v) : Math.abs(v - want)) / Math.abs(want) : null;
    return { key: k, want, wantSrc: S.traits[k] ? S.traits[k].source : 'missing', got: v, least, ok: err === null ? null : err <= 0.01 + 1e-9, err }; });
  if (LM) { const T = linkLoadT(D, LM); if (isFinite(T)) C.rows.push({ key: 'torque', got: T / 1000, unit: 'N·m', want: null, ok: null }); }
  C.parts = M.parts.length + (M.housing || []).length; C.motor = M.kit && M.kit.title || null;
  C.checks = (M.checks || []).filter(c => c.st !== 'ok').map(c => ({ st: c.st, txt: String(c.txt).replace(/<[^>]+>/g, '') }));
  const bad = C.checks.some(c => c.st === 'bad'), miss = C.rows.some(r => r.ok === false);
  C.pass = !bad && !miss;
  const b = trisBounds([].concat(...M.parts.map(p => p.motion ? xfTris(p.tris, p.motion(0)) : p.tris), ...(M.housing || []).filter(h => h.assembly !== false).map(h => h.tris)));
  C.size = [0, 1, 2].map(a => +(b.hi[a] - b.lo[a]).toFixed(0));
  const box = S.limits.box_mm; if (box) { const over = C.size.some((v, i) => box[i] && v > box[i]); if (over) { C.warn.push(`크기 ${C.size.join('×')} mm가 정한 공간(${box.filter(Boolean).join('×')} mm)보다 큽니다.`); C.pass = false; } }
  // 점수: 통과가 먼저, 그다음 목적 맞음·쉬움·부품 수·크기
  const pur = K.purposes.includes(S.purpose.value);
  C.score = (C.pass ? 0.6 : 0) + (pur ? 0.15 : 0) + 0.1 * (3 - K.diff) / 2 + 0.1 * Math.max(0, 1 - C.parts / 40) + 0.05 * Math.max(0, 1 - Math.max(...C.size) / 300);
  C.score = +C.score.toFixed(3);
  if (C.pass) C.why.push('요구치를 모두 만족합니다(계산값으로 확인).');
  if (pur) C.why.push(`${M2M_PURPOSES[S.purpose.value]}에 흔히 쓰입니다.`);
  C.why.push(K.diff === 1 ? '구조가 단순합니다.' : '부품 맞춤이 조금 더 필요합니다.');
  C.why.push(`부품 ${C.parts}개, 크기 약 ${C.size.join('×')} mm.`);
  return C;
}
function m2mRecommend(S0) {
  // 움직임을 모르면 추천하지 않음 (기본값으로 채워 엉뚱한 기구를 내놓지 않게)
  if (!S0.motion || !S0.motion.value) return { spec: S0, list: [], rejected: [], blocked: 'motion' };
  const S = m2mFilled(S0);
  const all = M2M_KB.map(K => m2mEval(K, S));
  return { spec: S, list: all.filter(c => c.design).sort((a, b) => b.score - a.score), rejected: all.filter(c => !c.design && K_fits(c, S)) };
}
const K_fits = (c, S) => { const K = M2M_KB.find(k => k.id === c.id); return K && K.motions.includes(S.motion.value); };
