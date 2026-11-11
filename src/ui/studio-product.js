/* ---- 스튜디오: 제품 요청 흐름 (기능 분해 → 개념안 → 설계 → 시뮬레이션 → 제작) ----
 지금은 '비누방울' 효과만 템플릿이 있고, 개념안 중 B(모터형)만 치수·3D·껍데기까지 만듦 */
const ST_PSTEPS = ['프로젝트', '제품 정의', '개념안', '설계', '시뮬레이션', '제작'];
function stPHint() {
  const q = m2mRequestQuestions(P.req);
  return [q.length ? `다음: 요청서의 빈 칸 ${q.length}개에 답하거나 바로 “기능 분해와 개념안 보기”를 누르세요.` : '다음: “기능 분해와 개념안 보기”를 누르세요.',
    P.chosen ? '다음: 고른 안의 치수를 다듬거나 시뮬레이션으로 가세요. (오른쪽 3D는 B안 미리 보기)' : '다음: 개념안을 비교하고 “이 안으로 설계”를 누르세요. 오른쪽 3D는 B안 미리 보기입니다.',
    '다음: 값을 바꾸면 치수·3D·껍데기가 다시 계산됩니다. 끝나면 시뮬레이션에서 확인하세요.', '다음: 미달이 없으면 제작 단계에서 파일을 받으세요.', '파일을 받고, 출력해 실험한 결과를 기록하세요.'][Math.max(0, stStep - 1)];
}
const ST_FLOW = { hand: '사람 손', trigger: '방아쇠 움직임', power: '전기', liquid: '비누액', film: '비누막', 'film@muzzle': '총구의 비누막', drive: '동력', 'air@muzzle': '총구의 바람' };
function stIsProd() { return !!(P && P.req && m2mDecompose(P.req).ok); }
const BUB_IN = [['ringD', '링 지름', 'mm', 10, 50], ['rings', '링 개수', '개', 3, 10], ['wheelRpm', '링 바퀴 회전수', 'rpm', 10, 90], ['volt', '건전지 전압', 'V', 1.5, 6]];
function stBubDesign() { const p = {}; for (const [k] of BUB_IN) if (P.bub && P.bub[k] != null) p[k] = P.bub[k]; return bubbleDesign(p); }
function stUseBubble() { P.chosen = 'B'; P.design = stBubDesign(); setDesign(JSON.parse(JSON.stringify(P.design))); }
// 3. 개념안
function stConcepts() {
  const K = m2mConcepts(P.req), Dc = K.decomp, pw = P.req.power.value;
  const flow = Dc.funcs.map(f => `<tr><td>${escH(f.ko)}</td><td class="hint">${f.in ? escH(ST_FLOW[f.in] || f.in) : '—'} → ${f.out ? escH(ST_FLOW[f.out] || f.out) : '—'}</td><td>${f.cond === 'motor' ? '모터를 쓰면' : f.cond === 'hand' ? '손힘 기구가 있으면' : '항상'}</td></tr>`).join('');
  const card = (c, i) => `<div class="stCard${c.id && c.id === P.chosen ? ' on' : ''}">
    <div class="row" style="align-items:center"><span class="pill">${i + 1}</span><b style="flex:1">${c.id ? c.id + '안 · ' : ''}${escH(c.ko)}</b>${c.built ? stB('calc') : stB('none')}</div>
    <ul class="why">${c.sols.map(([f, x]) => `<li>${escH(f)}: <b>${escH(x)}</b></li>`).join('')}</ul>
    ${c.pros.length ? `<p class="hint">좋은 점: ${c.pros.map(escH).join(', ')}</p>` : ''}${c.cons.length ? `<p class="hint">아쉬운 점: ${c.cons.map(escH).join(', ')}</p>` : ''}
    ${c.built ? `<div class="row"><button class="btn primary" data-act="cpick" data-id="${c.id}">이 안으로 설계</button></div>` : `<p class="hint">${stB('none')} 이 안은 비교까지만 됩니다. 치수 역산·3D·껍데기는 아직 B안만 만들었어요.</p>`}</div>`;
  return `<fieldset><legend>기능 분해 ${stB('calc')}</legend><p class="hint">“비누방울”은 아래 기능으로 나눠집니다. 조건이 붙은 기능은 고른 해법에 따라 들어가거나 빠집니다.</p>
    <div class="tblWrap"><table class="vt"><thead><tr><th>기능</th><th>받는 것 → 내놓는 것</th><th>언제</th></tr></thead><tbody>${flow}</tbody></table></div>
    ${Dc.gaps.length ? `<p class="hint" style="color:var(--bad)">${Dc.gaps.map(escH).join(' / ')}</p>` : ''}</fieldset>
  <fieldset><legend>개념안 비교</legend><p class="hint">해법 조합 ${K.combos}개를 만들어 맞지 않는 것을 걸렀어요.${pw ? '' : ' 동력을 정하지 않아 손힘형과 모터형을 모두 보여 줍니다.'}</p>
    <div class="tblWrap"><table class="vt"><thead><tr><th>개념안</th><th>부품 수</th><th>구입 부품</th><th>점수</th><th>설계·3D</th></tr></thead><tbody>
    ${K.list.map(c => `<tr${c.id && c.id === P.chosen ? ' class="sel"' : ''}><td>${c.id ? c.id + '안 ' : ''}${escH(c.ko)}</td><td>${c.parts}</td><td class="hint">${c.buy.map(escH).join(', ') || '없음'}</td><td>${fmt(c.score, 2)}</td><td>${c.built ? stB('calc') : stB('none')}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint">점수는 규칙으로 매깁니다: 확실성(연속 회전·팬이 높음) + 부품이 적을수록. 실험으로 얻은 값이 아닙니다.</p></fieldset>
  ${K.list.map(card).join('')}
  ${K.rejected.length ? `<details><summary>빠진 개념안 ${K.rejected.length}개</summary>${K.rejected.map(c => `<p class="hint">· ${c.id}안 ${escH(c.ko)}: ${escH(c.why.join(', '))}</p>`).join('')}</details>` : ''}`;
}
// 4. 설계 (B안)
function stPDesign() {
  if (!P.design || P.design.kind !== 'bubble') return '<p class="hint">먼저 개념안에서 B안을 고르세요.</p>';
  const D = P.design, G = bubbleGeom(D), src = k => P.bub && P.bub[k] != null ? 'user' : 'default';
  const calc = [['링 중심 반지름', fmt(D.R, 1) + ' mm', '링 사이 살 4 mm, 허브와 3 mm 띄우는 최소값'], ['링 바퀴 지름', fmt(2 * G.wheelR, 0) + ' mm', ''], ['감속 기어', `z${D.z2} : z${D.z1} (m${D.m})`, `모터 ${fmt(D.motRpm, 0)} rpm ÷ 목표 ${D.wheelRpm} rpm에 가장 가까운 잇수`],
    ['바퀴 모터 회전수', fmt(D.motRpm, 0) + ' rpm ' + stB('assume'), `N20 300 rpm(6 V형)을 ${D.volt} V로: 전압 비례 × 부하 80% 어림`], ['팬 지름', fmt(2 * G.fanR, 0) + ' mm', '큰 기어 이끝과 2 mm 이상 띄움'], ['비누액 통', `액면 ${fmt(G.tray.level, 1)} mm (바퀴 축 기준)`, '맨 아래 링이 잠기도록']];
  return `<fieldset><legend>B안 · 요구치로 설계</legend><p class="hint">값을 바꾸면 치수를 다시 역산하고 3D와 껍데기가 바로 바뀝니다.</p>
    <table class="vt"><tbody>${BUB_IN.map(([k, ko, u, lo, hi]) => `<tr><td>${ko}</td><td><input type="number" step="any" data-bp="${k}" data-lo="${lo}" data-hi="${hi}" value="${D[k]}" style="width:80px"> <span class="u">${u}</span></td><td>${srcB(src(k))}</td></tr>`).join('')}</tbody></table></fieldset>
  <fieldset><legend>계산된 치수 ${stB('calc')}</legend><div class="tblWrap"><table class="vt"><tbody>${calc.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td class="hint">${c}</td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:8px"><button class="btn primary" data-go="4">시뮬레이션·검증으로</button></div></fieldset>`;
}
// 5. 시뮬레이션·검증
function stPSim() {
  if (!model || model.kind !== 'bubble') return '<p class="hint">먼저 설계를 만드세요.</p>';
  const V = model.verify || [], chk = model.checks.filter(c => /사이|겹치지|누릅니다/.test(c.txt));
  return `<fieldset><legend>요구치 대비 결과</legend><div class="tblWrap"><table class="vt"><thead><tr><th>항목</th><th>요구</th><th>결과(계산)</th><th>상태</th><th>계산 방법</th></tr></thead><tbody>
    ${V.map(r => `<tr><td>${escH(r.ko)}</td><td>${r.want == null ? '—' : (r.key === 'wet_s' ? '< ' : r.key === 'dip' ? '> ' : r.key === 'air' ? '≥ ' : '') + fmt(r.want, 2) + ' ' + r.unit}</td><td>${fmt(r.got, 2)} ${r.unit}</td><td>${r.ok === true ? stB('ok') : r.ok === false ? stB('bad') : stB('calc')}</td><td class="hint">${escH(r.how)}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint">“막이 5초 안에 마르지 않는다”와 바퀴 모터 회전수는 가정값입니다.</p></fieldset>
  <fieldset><legend>부품 사이 거리 ${stB('calc')}</legend>${chk.map(c => `<p class="hint">${c.st === 'ok' ? stB('ok') : stB('bad')} ${c.txt}</p>`).join('')}
    <p class="hint">도는 부품은 도는 범위(원) 전체로 계산했습니다.</p></fieldset>
  <fieldset><legend>무엇이 검증되었나</legend><table class="vt"><tbody>
    <tr><td>바퀴·기어·팬의 회전과 감속비</td><td>${stB('ok')}</td><td class="hint">잇수로 계산하고 3D에 같은 값으로 돌립니다(팬만 천천히 보여 줌).</td></tr>
    <tr><td>타이밍(막 생김 → 총구 → 바람)</td><td>${stB('calc')}</td><td class="hint">링이 액에서 나와 맨 위까지 반 바퀴. 팬은 계속 돌아 링이 맨 위에 올 때마다 바람을 받습니다.</td></tr>
    <tr><td>부품 간섭·껍데기 안에 들어감</td><td>${stB('calc')}</td><td class="hint">치수 공식으로 계산(위 표). 삼각형 단위 간섭 검사는 ${stB('none')}.</td></tr>
    <tr><td>비누막이 생기는지, 방울 크기·개수</td><td>${stB('unv')}</td><td class="hint">유체·막 계산은 하지 않습니다. 출력해서 실험하세요.</td></tr>
    <tr><td>모터 실제 회전수(3 V)</td><td>${stB('assume')}</td><td class="hint">카탈로그 6 V 값을 전압 비례로 어림. 실제로 재서 설계에 넣으세요.</td></tr>
    <tr><td>물 새는지·방수</td><td>${stB('unv')}</td><td class="hint">통을 기울였을 때 넘치는지는 아직 계산하지 않습니다.</td></tr>
  </tbody></table></fieldset>
  <div class="row"><button class="btn" data-go="3">설계로 돌아가기</button><button class="btn primary" data-go="5">제작으로</button></div>`;
}
// 6. 제작
function stPMake() {
  if (!model || model.kind !== 'bubble') return '<p class="hint">먼저 설계를 만드세요.</p>';
  return `<fieldset><legend>부품표</legend><div class="tblWrap"><table class="vt"><thead><tr><th>부품</th><th>개수</th><th>메모</th></tr></thead><tbody>${model.bom.map(b => `<tr><td>${escH(b[0])}</td><td>${b[1]}</td><td class="hint">${escH(b[2] || '')}</td></tr>`).join('')}</tbody></table></div></fieldset>
  <fieldset><legend>조립 순서</legend><ol class="steps-ol">${model.steps.map(t => `<li>${escH(t)}</li>`).join('')}</ol></fieldset>
  <fieldset><legend>파일</legend><div class="row"><button class="btn primary" data-act="zip">STL 묶음 저장 (.zip)</button><button class="btn" data-act="saveProj">프로젝트 파일 저장</button></div>
    <p class="hint">출력 부품 6종과 껍데기 4조각(머리 몸체, 앞 덮개, 몸통 왼쪽·오른쪽 반)이 출력 방향으로 눕혀져 들어 있습니다. 통과 바퀴는 물에 닿으니 PETG를 권장합니다.</p></fieldset>
  <fieldset><legend>실험 기록</legend><p class="hint">출력해서 시험해 본 결과를 남기세요. 다음 설계 때 참고합니다.</p>
    <div class="row">${[['ok', '방울이 잘 나옴'], ['small', '나오지만 작음'], ['none', '안 나옴']].map(([v, l]) => `<button class="btn" data-act="ptest" data-v="${v}">${l}</button>`).join('')}</div>
    ${(P.tests || []).length ? `<ul class="why">${P.tests.map(t => `<li>${escH(new Date(t.at).toLocaleString())} · ${escH({ ok: '방울이 잘 나옴', small: '나오지만 작음', none: '안 나옴' }[t.result] || t.result)} (링 ${t.ringD} mm, ${t.wheelRpm} rpm)</li>`).join('')}</ul>` : ''}</fieldset>`;
}
$('stBody').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !P) return; const a = b.dataset.act;
  if (a === 'cpick' && b.dataset.id === 'B') { stUseBubble(); stLog('개념안 선택: B안'); stStep = 3; stSave(); stRender(); }
  else if (a === 'ptest') { P.tests = (P.tests || []).concat([{ at: new Date().toISOString(), result: b.dataset.v, ringD: P.design.ringD, wheelRpm: P.design.wheelRpm }]); stSave(); stRender(); }
  else if (a === 'zip' && P.design && P.design.kind === 'bubble') $('xHousing').checked = true;
}, true);
$('stBody').addEventListener('change', e => {
  const el = e.target, k = el.dataset.bp; if (!k || !P) return;
  const v = parseFloat(el.value), lo = +el.dataset.lo, hi = +el.dataset.hi;
  if (!(v >= lo && v <= hi)) { toast(`${el.closest('tr').cells[0].textContent}은(는) ${lo}~${hi} 사이여야 합니다`); el.value = P.design[k]; return; }
  P.bub = { ...(P.bub || {}), [k]: k === 'rings' ? Math.round(v) : v }; P.design = stBubDesign(); setDesign(JSON.parse(JSON.stringify(P.design)), false); stSave(); stRender();
});
