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
function stIsProd() { return !!(P && P.req && P.req.kind === 'product'); }
const stCanBuild = () => !!(P && P.req && m2mDecompose(P.req).ok);
// 요청서가 바뀜 → 고른 개념안이 여전히 살아 있으면 설계를 다시 계산, 탈락했으면 선택을 풂
function stReqApply() {
  if (!P || !P.req) return;
  if (!stIsProd() || !stCanBuild()) { if (P.design && P.design.kind === 'bubble') { P.chosen = null; P.design = null; } return; }
  if (P.chosen === 'B') { const ok = m2mConcepts(P.req).list.some(c => c.id === 'B');
    if (!ok) { P.chosen = null; P.design = null; toast('요청서가 바뀌어 B안이 조건에 맞지 않게 되었습니다. 개념안을 다시 고르세요'); }
    else { P.design = stBubDesign(); setDesign(JSON.parse(JSON.stringify(P.design)), false); } }
}
// 요청서 추가 항목 표: 고르는 항목(앱이 재거나 설계에 씀) + 직접 쓰는 항목(메모, 미검증)
function stExtraCard(R) {
  const X = R.extra || [], st = x => { const E = M2M_EXTRA[x.key]; return !E ? stB('unv') : E.noCalc ? stB('unv') : stB('calc'); };
  const row = (x, i) => { const E = M2M_EXTRA[x.key];
    return `<tr><td>${E ? escH(E.ko) : `<input data-rx="${i}:label" value="${escH(x.label || '')}" placeholder="항목 이름" style="width:84px">`}</td>
      <td><span class="row" style="gap:4px;align-items:center;flex-wrap:nowrap"><select data-rx="${i}:op" style="width:46px">${['=', '≤', '≥'].map(o => `<option${o === x.op ? ' selected' : ''}>${o}</option>`).join('')}</select>
        <input data-rx="${i}:value" ${E ? 'type="number" step="any"' : ''} value="${escH(x.value ?? '')}" style="width:64px">${E ? `<span class="u">${E.unit}</span>` : `<input data-rx="${i}:unit" value="${escH(x.unit || '')}" placeholder="단위" style="width:44px">`}</span></td>
      <td>${st(x)}</td><td><button class="btn" data-act="rxDel" data-i="${i}" aria-label="지우기">✕</button></td></tr>`; };
  const used = new Set(X.map(x => x.key).filter(Boolean));
  return `<details${X.length ? ' open' : ''}><summary>추가 항목 ${X.length ? X.length + '개' : ''}</summary>
    <p class="hint">요청서에 없는 요구를 더하세요. 직접 넣은 값이라 모두 “내가 줌”입니다. ${stB('calc')}는 앱이 설계에 쓰거나 재서 확인하는 항목, ${stB('unv')}는 기록만 하고 확인하지 않는 항목입니다.</p>
    ${X.length ? `<div class="tblWrap"><table class="vt"><tbody>${X.map(row).join('')}</tbody></table></div>` : ''}
    <div class="row"><select id="rxNew">${Object.entries(M2M_EXTRA).filter(([k]) => !used.has(k)).map(([k, E]) => `<option value="${k}">${escH(E.ko)} (${E.unit})</option>`).join('')}<option value="">직접 쓰기…</option></select><button class="btn" data-act="rxAdd">항목 추가</button></div></details>`;
}
// 설계 전 단계에서 막혔을 때 보여 줄 안내
function stPNeed() {
  if (!stCanBuild()) return `<fieldset><legend>아직 이어지지 않아요</legend><p class="hint">요청서의 결과 효과에 맞는 기능 분해 템플릿이 아직 없어요 ${stB('none')}. 지금은 “비누방울”만 설계·시뮬레이션·제작까지 이어집니다.</p><div class="row"><button class="btn" data-go="1">요청서로 돌아가기</button></div></fieldset>`;
  const K = m2mConcepts(P.req), b = K.list.find(c => c.built);
  return `<fieldset><legend>먼저 개념안을 고르세요</legend><p class="hint">설계·시뮬레이션·제작은 고른 개념안으로 만듭니다.${b ? ` 지금 조건에서 끝까지 만들 수 있는 안은 <b>${b.id}안 ${escH(b.ko)}</b>입니다.` : ' 지금 조건(손힘만)에 맞는 안은 아직 비교까지만 됩니다(3D·치수 미구현).'}</p>
    <div class="row">${b ? `<button class="btn primary" data-act="cpick" data-id="${b.id}">${b.id}안으로 설계 시작</button>` : ''}<button class="btn" data-go="2">개념안 보기</button><button class="btn" data-go="1">요청서 고치기</button></div></fieldset>`;
}
const BUB_IN = [['ringD', '링 지름', 'mm', 10, 50], ['rings', '링 개수', '개', 3, 10], ['wheelRpm', '링 바퀴 회전수', 'rpm', 10, 90], ['volt', '건전지 전압', 'V', 1.5, 6]];
function stBubDesign() { const p = {}; for (const [k] of BUB_IN) if (P.bub && P.bub[k] != null) p[k] = P.bub[k];
  for (const x of (P.req && P.req.extra) || []) { const v = +x.value; if (!isFinite(v) || !M2M_EXTRA[x.key]) continue;   // 요청서 추가 항목 중 설계 입력
    if (x.key === 'ringD' && v >= 10 && v <= 50) p.ringD = v; if (x.key === 'rings' && v >= 3 && v <= 10) p.rings = Math.round(v); }
  const rate = ((P.req && P.req.extra) || []).find(x => x.key === 'rate' && +x.value > 0);
  if (rate) { const need = +rate.value * 60 / (p.rings || BUB_DEF.rings); if (rate.op !== '≤' && need > (p.wheelRpm || BUB_DEF.wheelRpm)) p.wheelRpm = Math.min(90, +need.toFixed(1)); }
  const sp = P.req && P.req.shape.value === 'gun' && P.req.shape.params || {}; if (sp.length) p.gunLen = sp.length.value; if (sp.gripAngle) p.gripAngle = sp.gripAngle.value;   // 요청서의 총 길이·손잡이 각도
  return bubbleDesign(p); }
function stUseBubble() { P.chosen = 'B'; P.design = stBubDesign(); setDesign(JSON.parse(JSON.stringify(P.design))); }
// 3. 개념안
function stConcepts() {
  if (!stCanBuild()) return stPNeed();
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
  if (!P.design || P.design.kind !== 'bubble') return stPNeed();
  const D = P.design, G = bubbleGeom(D), fromReq = k => ((P.req.extra || []).some(x => x.key === k) || (k === 'wheelRpm' && (P.req.extra || []).some(x => x.key === 'rate'))), src = k => P.bub && P.bub[k] != null || fromReq(k) ? 'user' : 'default';
  const calc = [['링 중심 반지름', fmt(D.R, 1) + ' mm', '링 사이 살 4 mm, 허브와 3 mm 띄우는 최소값'], ['링 바퀴 지름', fmt(2 * G.wheelR, 0) + ' mm', ''], ['감속 기어', `z${D.z2} : z${D.z1} (m${D.m})`, `모터 ${fmt(D.motRpm, 0)} rpm ÷ 목표 ${D.wheelRpm} rpm에 가장 가까운 잇수`],
    ['바퀴 모터 회전수', fmt(D.motRpm, 0) + ' rpm ' + stB('assume'), `N20 300 rpm(6 V형)을 ${D.volt} V로: 전압 비례 × 부하 80% 어림`], ['팬 지름', fmt(2 * G.fanR, 0) + ' mm', '큰 기어 이끝과 2 mm 이상 띄움'], ['비누액 통', `액면 ${fmt(G.tray.level, 1)} mm (바퀴 축 기준)`, '맨 아래 링이 잠기도록']];
  const sp = P.req.shape.value === 'gun' ? P.req.shape.params : null;
  return `${sp ? `<fieldset><legend>요청서에서 온 값</legend><p class="hint">총 길이 ${D.gunLen} mm, 손잡이 각도 ${D.gripAngle}° ${srcB(sp.length.source)} · 바꾸려면 <button class="btn" data-go="1">요청서 고치기</button></p></fieldset>` : ''}<fieldset><legend>B안 · 요구치로 설계</legend><p class="hint">값을 바꾸면 치수를 다시 역산하고 3D와 껍데기가 바로 바뀝니다.</p>
    <table class="vt"><tbody>${BUB_IN.map(([k, ko, u, lo, hi]) => `<tr><td>${ko}</td><td><input type="number" step="any" data-bp="${k}" data-lo="${lo}" data-hi="${hi}" value="${D[k]}" style="width:80px"${fromReq(k) ? ' disabled title="요청서 추가 항목에서 정함"' : ''}>${fromReq(k) ? ' <span class="hint">요청서</span>' : ''} <span class="u">${u}</span></td><td>${srcB(src(k))}</td></tr>`).join('')}</tbody></table></fieldset>
  <fieldset><legend>계산된 치수 ${stB('calc')}</legend><div class="tblWrap"><table class="vt"><tbody>${calc.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td class="hint">${c}</td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:8px"><button class="btn primary" data-go="4">시뮬레이션·검증으로</button></div></fieldset>`;
}
// 5. 시뮬레이션·검증
function stPSim() {
  if (!P.design || !model || model.kind !== 'bubble') return stPNeed();
  const V = model.verify || [], chk = model.checks.filter(c => /사이|겹치지|누릅니다/.test(c.txt));
  return `<fieldset><legend>요구치 대비 결과</legend><div class="tblWrap"><table class="vt"><thead><tr><th>항목</th><th>요구</th><th>결과(계산)</th><th>상태</th><th>계산 방법</th></tr></thead><tbody>
    ${V.map(r => `<tr><td>${escH(r.ko)}</td><td>${r.want == null ? '—' : (r.key === 'wet_s' ? '< ' : r.key === 'dip' ? '> ' : r.key === 'air' ? '≥ ' : '') + fmt(r.want, 2) + ' ' + r.unit}</td><td>${fmt(r.got, 2)} ${r.unit}</td><td>${r.ok === true ? stB('ok') : r.ok === false ? stB('bad') : stB('calc')}</td><td class="hint">${escH(r.how)}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint">“막이 5초 안에 마르지 않는다”와 바퀴 모터 회전수는 가정값입니다.</p></fieldset>
  ${(P.req.extra || []).length ? `<fieldset><legend>요청서 추가 항목</legend><div class="tblWrap"><table class="vt"><thead><tr><th>항목</th><th>요구</th><th>결과</th><th>상태</th><th>방법</th></tr></thead><tbody>
    ${P.req.extra.map(x => { const E = M2M_EXTRA[x.key], r = m2mExtraEval(x, model); return `<tr><td>${escH(E ? E.ko : x.label || '이름 없음')}</td><td>${escH(x.op)} ${escH(x.value ?? '')} ${escH(E ? E.unit : x.unit || '')}</td><td>${r.got == null ? '—' : fmt(r.got, 1) + ' ' + (E ? E.unit : '')}</td><td>${stB(r.state)}</td><td class="hint">${escH(r.how)}</td></tr>`; }).join('')}</tbody></table></div></fieldset>` : ''}
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
  if (!P.design || !model || model.kind !== 'bubble') return stPNeed();
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
  if (a === 'rxAdd' && P.req) { const k = $('rxNew').value, E = M2M_EXTRA[k]; P.req.extra = (P.req.extra || []).concat([E ? { key: k, op: E.op, value: '', source: 'user' } : { key: null, label: '', op: '=', value: '', unit: '', source: 'user' }]); stSave(); stRender(); }
  else if (a === 'rxDel' && P.req) { P.req.extra.splice(+b.dataset.i, 1); stReqApply(); stSave(); stRender(); }
  else if (a === 'rqProd' && P.req) { P.req.kind = 'product'; stSave(); stRender(); }
  else if (a === 'rqMotion' && P.req) { P.req.kind = 'motion'; stReqApply(); stStep = 1; stSave(); stRender(); }
  else if (a === 'cpick' && b.dataset.id === 'B') { stUseBubble(); stLog('개념안 선택: B안'); stStep = 3; stSave(); stRender(); }
  else if (a === 'ptest') { P.tests = (P.tests || []).concat([{ at: new Date().toISOString(), result: b.dataset.v, ringD: P.design.ringD, wheelRpm: P.design.wheelRpm }]); stSave(); stRender(); }
  else if (a === 'zip' && P.design && P.design.kind === 'bubble') $('xHousing').checked = true;
}, true);
$('stBody').addEventListener('change', e => {
  const el = e.target; if (!P || !P.req) return; const R = P.req;
  if (el.dataset.rx) { const [i, f] = el.dataset.rx.split(':'), x = R.extra && R.extra[+i]; if (!x) return; const E = M2M_EXTRA[x.key];
    if (f === 'value' && E) { const v = parseFloat(el.value); if (el.value.trim() !== '' && !(v >= E.range[0] && v <= E.range[1])) { toast(`${E.ko}은(는) ${E.range[0]}~${E.range[1]} ${E.unit} 사이여야 합니다`); el.value = x.value; return; } x.value = el.value.trim() === '' ? '' : v; }
    else x[f] = el.value; stReqApply(); stLog('요청서 추가 항목'); stSave(); stRender(); return; }
  if (el.dataset.rq || el.dataset.rqp || el.dataset.rqfx) {
    if (el.dataset.rq === 'shape') R.shape = el.value ? m2mReqShape(el.value, 'user') : { value: null, source: 'missing' };
    else if (el.dataset.rq === 'input') R.inputs = el.value ? [m2mReqInput(el.value, 'user')] : [];
    else if (el.dataset.rq === 'power') R.power = el.value ? { value: el.value, source: 'user' } : { value: null, source: 'missing' };
    else if (el.dataset.rqfx) { const k = el.dataset.rqfx; R.effects = R.effects.filter(x => x.kind !== k); if (el.checked) R.effects.push({ id: k, kind: k, source: 'user' }); }
    else { const [g, k] = el.dataset.rqp.split(':'), v = parseFloat(el.value), lo = +el.dataset.lo, hi = +el.dataset.hi, o = g === 'shape' ? R.shape.params : R.inputs[0] && R.inputs[0].params;
      if (!o || !o[k]) return; if (!(v >= lo && v <= hi)) { toast(`${(M2M_PNAME[k] || [k])[0]}은(는) ${lo}~${hi} 사이여야 합니다`); el.value = o[k].value; return; } o[k] = { value: v, source: 'user' }; }
    stReqApply(); stLog('요청서 고침'); stSave(); stRender(); return; }
});
$('stBody').addEventListener('change', e => {
  const el = e.target, k = el.dataset.bp; if (!k || !P) return;
  const v = parseFloat(el.value), lo = +el.dataset.lo, hi = +el.dataset.hi;
  if (!(v >= lo && v <= hi)) { toast(`${el.closest('tr').cells[0].textContent}은(는) ${lo}~${hi} 사이여야 합니다`); el.value = P.design[k]; return; }
  P.bub = { ...(P.bub || {}), [k]: k === 'rings' ? Math.round(v) : v }; P.design = stBubDesign(); setDesign(JSON.parse(JSON.stringify(P.design)), false); stSave(); stRender();
});
