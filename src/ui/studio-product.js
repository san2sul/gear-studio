/* ---- 스튜디오: 제품 요청 흐름 (기능 분해 → 개념안 → 설계 → 시뮬레이션 → 제작) ----
 지금은 '비누방울' 효과만 템플릿이 있고, 개념안 중 B(모터형)만 치수·3D·껍데기까지 만듦 */
const ST_PSTEPS = ['프로젝트', '제품 정의', '개념안', '설계', '시뮬레이션', '제작'];
function stPHint() {
  const q = m2mRequestQuestions(P.req);
  return [q.length ? `다음: 요청서의 빈 칸 ${q.length}개에 답하거나 바로 “기능 분해와 개념안 보기”를 누르세요.` : '다음: “기능 분해와 개념안 보기”를 누르세요.',
    P.chosen ? (P.chosen === 'B' ? '다음: 고른 B안의 치수를 다듬거나 시뮬레이션으로 가세요.' : '고른 안은 아직 3D가 없어요(미구현). 오른쪽 3D는 B안 미리 보기입니다.') : '다음: 개념안을 비교하고 “이 안으로 설계”를 누르세요. 오른쪽 3D는 B안 미리 보기입니다.',
    P.chosen && P.chosen !== 'B' ? '고른 안은 아직 3D 설계가 없어요(미구현). 오른쪽 3D는 B안 미리 보기입니다.' : '다음: 값을 바꾸면 치수·3D·껍데기가 다시 계산됩니다. 끝나면 시뮬레이션에서 확인하세요.', '다음: 미달이 없으면 제작 단계에서 파일을 받으세요.', '파일을 받고, 출력해 실험한 결과를 기록하세요.'][Math.max(0, stStep - 1)];
}
const ST_FLOW = { hand: '사람 손', trigger: '방아쇠 움직임', power: '전기', liquid: '비누액', film: '비누막', 'film@muzzle': '총구의 비누막', drive: '동력', 'air@muzzle': '총구의 바람' };
function stIsProd() { return !!(P && P.req && P.req.kind === 'product'); }
const stCanBuild = () => !!(P && P.req && m2mDecompose(P.req).ok);
// 개념안 이름표: 이름 있는 안은 A·B·C, 이름 없는 조합은 고른 해법으로 구별
const stCKey = c => c.id || 'X:' + c.sols.map(x => x[1]).join('/');
const stChosenC = () => P && P.chosen && P.req ? m2mConcepts(P.req).list.find(c => stCKey(c) === P.chosen) || null : null;
// 요청서가 바뀜 → 고른 개념안이 여전히 살아 있으면 설계를 다시 계산, 탈락했으면 선택을 풂
function stReqApply() {
  if (!P || !P.req) return;
  if (!stIsProd() || !stCanBuild()) { if (P.design && P.design.kind === 'bubble') { P.chosen = null; P.design = null; } return; }
  if (P.chosen && P.chosen !== 'B' && !stChosenC()) { P.chosen = null; toast('요청서가 바뀌어 고른 개념안이 조건에 맞지 않게 되었습니다. 개념안을 다시 고르세요'); }
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
// 부위별 사양과 동작 카드: 부위 → 사양 줄(이름, 비교, 값, 단위) + 동작 줄(종류, 언제, 값)
function stPartsCard(R) {
  const PT = R.parts || [];
  const specRow = (pi, x, si) => { const E = x.key && M2M_PSPEC[x.key];
    return `<tr><td>${E ? escH(E.ko) + (E.noCalc ? ' ' + stB('unv') : '') : `<input data-ps="${pi}:${si}:label" value="${escH(x.label || '')}" placeholder="사양 이름" style="width:100%;min-width:60px">`}</td>
      <td><span class="row" style="gap:3px;align-items:center;flex-wrap:nowrap"><select data-ps="${pi}:${si}:op" style="width:40px;padding-left:2px;padding-right:0">${['=', '≤', '≥'].map(o => `<option${o === x.op ? ' selected' : ''}>${o}</option>`).join('')}</select>
        <input data-ps="${pi}:${si}:value" ${E ? `type="number" step="any" title="${E.range[0]}~${E.range[1]} ${E.unit}"` : ''} value="${escH(x.value ?? '')}" style="width:52px">${E ? `<span class="u">${E.unit}</span>` : `<input data-ps="${pi}:${si}:unit" value="${escH(x.unit || '')}" placeholder="단위" style="width:38px">`}</span></td>
      <td style="width:30px"><button class="btn" data-act="psDel" data-p="${pi}" data-i="${si}" aria-label="사양 지우기">✕</button></td></tr>`; };
  const moRow = (pi, m, mi) => { const need = M2M_NEED[m.kind] || [];
    return `<tr><td colspan="2"><div class="row" style="gap:4px;flex-wrap:nowrap"><select data-pm="${pi}:${mi}:kind" style="width:108px;flex:none"><option value="none"${m.kind === 'none' ? ' selected' : ''}>움직이지 않음</option>${Object.entries(M2M_MOTIONS).map(([k, x]) => `<option value="${k}"${k === m.kind ? ' selected' : ''}>${escH(x.ko)}</option>`).join('')}</select>
        <input data-pm="${pi}:${mi}:when" value="${escH(m.when || '')}" placeholder="언제 (예: 당기는 동안)" style="flex:1;min-width:0"></div>
        ${need.length ? `<div class="row" style="gap:8px;margin-top:4px">${need.map(([k, , u]) => `<label class="hint" style="display:inline-flex;gap:4px;align-items:center">${escH(M2M_TRAITS[k][0])} <input type="number" step="any" data-pm="${pi}:${mi}:t.${k}" value="${escH(m.traits && m.traits[k] != null ? m.traits[k] : '')}" style="width:52px"> ${u}</label>`).join('')}</div>` : ''}</td>
      <td style="width:30px"><button class="btn" data-act="pmDel" data-p="${pi}" data-i="${mi}" aria-label="동작 지우기">✕</button></td></tr>`; };
  const part = (pt, pi) => { const used = new Set(pt.specs.map(x => x.key).filter(Boolean)), keys = Object.entries(M2M_PSPEC).filter(([k, E]) => !used.has(k) && pt.link && E.link === pt.link);
    return `<div class="stPart" data-pi="${pi}"><div class="row" style="align-items:center;gap:6px;flex-wrap:nowrap"><input data-pp="${pi}:name" value="${escH(pt.name)}" placeholder="부위 이름" style="flex:1;min-width:0;font-weight:600"><button class="btn" data-act="ppDel" data-p="${pi}" aria-label="부위 지우기">✕</button></div>
      <div class="row" style="align-items:center;gap:6px;flex-wrap:nowrap"><select data-pp="${pi}:link" style="flex:1;min-width:0"><option value="">3D 부품과 잇지 않음</option>${Object.entries(M2M_PLINKS).map(([k, ko]) => `<option value="${k}"${k === pt.link ? ' selected' : ''}>3D 부품: ${escH(ko)}</option>`).join('')}</select>${pt.link ? stB('calc') : stB('unv')}</div>
      <table class="vt"><tbody><tr><th colspan="3">사양</th></tr>${pt.specs.map((x, si) => specRow(pi, x, si)).join('') || '<tr><td colspan="3" class="hint">아직 없음</td></tr>'}
        <tr><th colspan="3">동작</th></tr>${pt.motions.map((m, mi) => moRow(pi, m, mi)).join('') || '<tr><td colspan="3" class="hint">아직 없음</td></tr>'}</tbody></table>
      <div class="row" style="gap:6px;flex-wrap:nowrap"><select id="psNew${pi}" style="flex:1;min-width:0">${keys.map(([k, E]) => `<option value="${k}">${escH(E.ko)} (${E.unit})</option>`).join('')}<option value="">직접 쓰기…</option></select><button class="btn" data-act="psAdd" data-p="${pi}">+ 사양</button><button class="btn" data-act="pmAdd" data-p="${pi}">+ 동작</button></div></div>`; };
  return `<details${PT.length ? ' open' : ''} id="stParts"><summary>부위별 사양과 동작 ${PT.length ? PT.length + '곳' : ''}</summary>
    <p class="hint">제품을 부위로 나눠 부위마다 사양과 동작을 적으세요. 3D 부품과 이은 부위는 ${stB('calc')} 값을 설계에 쓰거나 3D 치수·움직임과 비교하고, 잇지 않은 부위와 직접 쓴 사양은 ${stB('unv')} 기록만 합니다. 값을 비운 줄은 쓰지 않습니다.</p>
    ${PT.map(part).join('')}
    <div class="row" style="gap:6px;flex-wrap:nowrap"><input id="ppNew" placeholder="새 부위 이름 (예: 물통 뚜껑)" style="flex:1;min-width:0"><button class="btn" data-act="ppAdd">+ 부위</button></div>
    ${R.shape.value && M2M_PART_TPL[R.shape.value] && !PT.length ? `<div class="row"><button class="btn" data-act="ppTpl">${escH(M2M_SHAPES[R.shape.value][0])} 기본 부위 넣기</button></div>` : ''}</details>`;
}
// 설계 전 단계에서 막혔을 때 보여 줄 안내
function stPNeed() {
  if (!stCanBuild()) return `<fieldset><legend>아직 이어지지 않아요</legend><p class="hint">요청서의 결과 효과에 맞는 기능 분해 템플릿이 아직 없어요 ${stB('none')}. 지금은 “비누방울”만 설계·시뮬레이션·제작까지 이어집니다.</p><div class="row"><button class="btn" data-go="1">요청서로 돌아가기</button></div></fieldset>`;
  const K = m2mConcepts(P.req), b = K.list.find(c => c.built), ch = stChosenC();
  if (ch && !ch.built) return `<fieldset><legend>고른 안: ${ch.id ? ch.id + '안 · ' : ''}${escH(ch.ko)} ${stB('none')}</legend>
    <p class="hint">이 안은 개념 비교까지만 되어 있어요. 치수 역산, 3D, 껍데기, 시뮬레이션, STL은 아직 만들지 않았습니다(미구현). 아래는 이 안의 구성입니다.</p>
    <ul class="why">${ch.sols.map(([f, x]) => `<li>${escH(f)}: <b>${escH(x)}</b></li>`).join('')}</ul>
    <p class="hint">부품 ${ch.parts}개 · 구입 부품: ${ch.buy.map(escH).join(', ') || '없음'}</p>
    <div class="row">${b ? `<button class="btn primary" data-act="cpick" data-id="${b.id}">${b.id}안으로 바꿔 설계</button>` : ''}<button class="btn" data-go="2">개념안 다시 고르기</button><button class="btn" data-go="1">요청서 고치기</button></div></fieldset>`;
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
  for (const pt of (P.req && P.req.parts) || []) {   // 부위별 사양·동작 (가장 나중 = 가장 우선)
    for (const x of pt.specs) { const E = M2M_PSPEC[x.key], v = +x.value; if (E && E.design && x.op === '=' && x.value !== '' && v >= E.range[0] && v <= E.range[1]) p[E.design] = x.key === 'rings' ? Math.round(v) : v; }
    for (const m of pt.motions) if (pt.link === 'wheel' && m.kind === 'rotate' && m.traits && +m.traits.rpm >= 10 && +m.traits.rpm <= 90) p.wheelRpm = +m.traits.rpm; }
  return bubbleDesign(p); }
// 부위에서 정한 설계 입력 키 (설계 단계에서 잠금 표시)
function stPartKeys() { const K = new Set();
  for (const pt of (P.req && P.req.parts) || []) { for (const x of pt.specs) { const E = M2M_PSPEC[x.key]; if (E && E.design && x.op === '=' && x.value !== '') K.add(E.design); }
    for (const m of pt.motions) if (pt.link === 'wheel' && m.kind === 'rotate' && m.traits && m.traits.rpm !== '' && m.traits.rpm != null) K.add('wheelRpm'); }
  return K; }
function stUseBubble() { P.chosen = 'B'; P.design = stBubDesign(); setDesign(JSON.parse(JSON.stringify(P.design))); }
// 3. 개념안
function stConcepts() {
  if (!stCanBuild()) return stPNeed();
  const K = m2mConcepts(P.req), Dc = K.decomp, pw = P.req.power.value;
  const flow = Dc.funcs.map(f => `<tr><td>${escH(f.ko)}</td><td class="hint">${f.in ? escH(ST_FLOW[f.in] || f.in) : '—'} → ${f.out ? escH(ST_FLOW[f.out] || f.out) : '—'}</td><td>${f.cond === 'motor' ? '모터를 쓰면' : f.cond === 'hand' ? '손힘 기구가 있으면' : '항상'}</td></tr>`).join('');
  const on = c => stCKey(c) === P.chosen, pick = (c, cls = '') => `<button class="btn${cls}" data-act="cpick" data-id="${escH(stCKey(c))}">${on(c) ? '고름 ✓' : c.built ? '이 안으로 설계' : '이 안 고르기'}</button>`;
  const card = (c, i) => `<div class="stCard${on(c) ? ' on' : ''}">
    <div class="row" style="align-items:center"><span class="pill">${i + 1}</span><b style="flex:1">${c.id ? c.id + '안 · ' : ''}${escH(c.ko)}</b>${c.built ? stB('calc') : stB('none')}</div>
    <ul class="why">${c.sols.map(([f, x]) => `<li>${escH(f)}: <b>${escH(x)}</b></li>`).join('')}</ul>
    ${c.pros.length ? `<p class="hint">좋은 점: ${c.pros.map(escH).join(', ')}</p>` : ''}${c.cons.length ? `<p class="hint">아쉬운 점: ${c.cons.map(escH).join(', ')}</p>` : ''}
    ${c.built ? '' : `<p class="hint">${stB('none')} 고를 수는 있지만 치수 역산·3D·껍데기는 아직 B안만 만들었어요.</p>`}<div class="row">${pick(c, c.built ? ' primary' : '')}</div></div>`;
  return `<fieldset><legend>기능 분해 ${stB('calc')}</legend><p class="hint">“비누방울”은 아래 기능으로 나눠집니다. 조건이 붙은 기능은 고른 해법에 따라 들어가거나 빠집니다.</p>
    <div class="tblWrap"><table class="vt"><thead><tr><th>기능</th><th>받는 것 → 내놓는 것</th><th>언제</th></tr></thead><tbody>${flow}</tbody></table></div>
    ${Dc.gaps.length ? `<p class="hint" style="color:var(--bad)">${Dc.gaps.map(escH).join(' / ')}</p>` : ''}</fieldset>
  <fieldset><legend>개념안 비교</legend><p class="hint">해법 조합 ${K.combos}개를 만들어 맞지 않는 것을 걸렀어요.${pw ? '' : ' 동력을 정하지 않아 손힘형과 모터형을 모두 보여 줍니다.'}</p>
    <div class="tblWrap"><table class="vt"><thead><tr><th>개념안</th><th>부품 수</th><th>구입 부품</th><th>점수</th><th>설계·3D</th><th></th></tr></thead><tbody>
    ${K.list.map(c => `<tr${on(c) ? ' class="sel"' : ''}><td>${c.id ? c.id + '안 ' : ''}${escH(c.ko)}</td><td>${c.parts}</td><td class="hint">${c.buy.map(escH).join(', ') || '없음'}</td><td>${fmt(c.score, 2)}</td><td>${c.built ? stB('calc') : stB('none')}</td><td>${pick(c)}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint">점수는 규칙으로 매깁니다: 확실성(연속 회전·팬이 높음) + 부품이 적을수록. 실험으로 얻은 값이 아닙니다.</p></fieldset>
  ${K.list.map(card).join('')}
  ${K.rejected.length ? `<details><summary>빠진 개념안 ${K.rejected.length}개</summary>${K.rejected.map(c => `<p class="hint">· ${c.id}안 ${escH(c.ko)}: ${escH(c.why.join(', '))}</p>`).join('')}</details>` : ''}`;
}
// 4. 설계 (B안)
function stPDesign() {
  if (!P.design || P.design.kind !== 'bubble') return stPNeed();
  const D = P.design, G = bubbleGeom(D), fromReq = k => (stPartKeys().has(k) || (P.req.extra || []).some(x => x.key === k) || (k === 'wheelRpm' && (P.req.extra || []).some(x => x.key === 'rate'))), src = k => P.bub && P.bub[k] != null || fromReq(k) ? 'user' : 'default';
  const calc = [['링 중심 반지름', fmt(D.R, 1) + ' mm', '링 사이 살 4 mm, 허브와 3 mm 띄우는 최소값'], ['링 바퀴 지름', fmt(2 * G.wheelR, 0) + ' mm', ''], ['감속 기어', `z${D.z2} : z${D.z1} (m${D.m})`, `모터 ${fmt(D.motRpm, 0)} rpm ÷ 목표 ${D.wheelRpm} rpm에 가장 가까운 잇수`],
    ['바퀴 모터 회전수', fmt(D.motRpm, 0) + ' rpm ' + stB('assume'), `N20 300 rpm(6 V형)을 ${D.volt} V로: 전압 비례 × 부하 80% 어림`], ['팬 지름', fmt(2 * G.fanR, 0) + ' mm', '큰 기어 이끝과 2 mm 이상 띄움'], ['비누액 통', `액면 ${fmt(G.tray.level, 1)} mm (바퀴 축 기준)`, '맨 아래 링이 잠기도록']];
  const sp = P.req.shape.value === 'gun' ? P.req.shape.params : null;
  return `${sp ? `<fieldset><legend>요청서에서 온 값</legend><p class="hint">총 길이 ${D.gunLen} mm, 손잡이 각도 ${D.gripAngle}° ${srcB(sp.length.source)} · 바꾸려면 <button class="btn" data-go="1">요청서 고치기</button></p></fieldset>` : ''}<fieldset><legend>B안 · 요구치로 설계</legend><p class="hint">값을 바꾸면 치수를 다시 역산하고 3D와 껍데기가 바로 바뀝니다.</p>
    <table class="vt"><tbody>${BUB_IN.map(([k, ko, u, lo, hi]) => `<tr><td>${ko}</td><td><input type="number" step="any" data-bp="${k}" data-lo="${lo}" data-hi="${hi}" value="${D[k]}" style="width:80px"${fromReq(k) ? ' disabled title="요청서(부위 사양·추가 항목)에서 정함"' : ''}>${fromReq(k) ? ' <span class="hint">요청서</span>' : ''} <span class="u">${u}</span></td><td>${srcB(src(k))}</td></tr>`).join('')}</tbody></table></fieldset>
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
  ${stPartsSim()}
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
function stPartsSim() {
  const PT = (P.req.parts || []).filter(pt => pt.specs.some(x => x.value !== '' && x.value != null) || pt.motions.length); if (!PT.length) return '';
  const rows = PT.map(pt => {
    const sp = pt.specs.filter(x => x.value !== '' && x.value != null).map(x => { const E = M2M_PSPEC[x.key], r = m2mSpecEval(x, model); return `<tr><td>${escH(pt.name)}</td><td>${escH(E ? E.ko : x.label || '이름 없음')}</td><td>${x.value === '' ? '—' : escH(x.op + ' ' + x.value + ' ' + (E ? E.unit : x.unit || ''))}</td><td>${r.got == null ? '—' : fmt(r.got, 1) + ' ' + (E ? E.unit : '')}</td><td>${stB(r.state)}</td><td class="hint">${escH(r.how)}</td></tr>`; });
    const mo = pt.motions.map(m => { const r = m2mMotionEval(pt, m, model), tr = Object.entries(m.traits || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${M2M_TRAITS[k][0]} ${v} ${M2M_TRAITS[k][1]}`);
      return `<tr><td>${escH(pt.name)}</td><td>동작${m.when ? ' · ' + escH(m.when) : ''}</td><td>${escH(m.kind === 'none' ? '움직이지 않음' : (M2M_MOTIONS[m.kind] || {}).ko || '?')}${tr.length ? '<br><span class="hint">' + escH(tr.join(', ')) + '</span>' : ''}</td><td>${escH(r.got || '—')}</td><td>${stB(r.state)}</td><td class="hint">${escH(r.how)}</td></tr>`; });
    return sp.concat(mo).join(''); }).join('');
  return `<fieldset><legend>부위별 사양과 동작</legend><div class="tblWrap"><table class="vt"><thead><tr><th>부위</th><th>항목</th><th>요구</th><th>결과(3D)</th><th>상태</th><th>방법</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint">치수는 1%, 회전수는 5%(기어 잇수가 정수라서) 안이면 맞음으로 봅니다. 언제 움직이는지(“당기는 동안”)는 기록만 하고 확인하지 않습니다 ${stB('unv')}.</p></fieldset>`;
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
  else if (/^(pp|ps|pm)(Add|Del|Tpl)$/.test(a || '') && P.req) { const R = P.req, PT = R.parts = R.parts || [], pi = +b.dataset.p, pt = PT[pi];
    if (a === 'ppAdd') { const n = $('ppNew').value.trim(); if (!n) { toast('부위 이름을 먼저 쓰세요'); $('ppNew').focus(); return; } PT.push({ id: 'pt' + Date.now().toString(36), name: n, link: '', source: 'user', specs: [], motions: [] }); }
    else if (a === 'ppTpl') R.parts = m2mPartsFrom(R.shape.value);
    else if (a === 'ppDel') PT.splice(pi, 1);
    else if (a === 'psAdd') { const k = $('psNew' + pi).value, E = M2M_PSPEC[k]; pt.specs.push(E ? { key: k, op: E.op, value: '', source: 'user' } : { key: null, label: '', op: '=', value: '', unit: '', source: 'user' }); }
    else if (a === 'psDel') pt.specs.splice(+b.dataset.i, 1);
    else if (a === 'pmAdd') pt.motions.push({ kind: 'rotate', when: '', traits: {}, source: 'user' });
    else if (a === 'pmDel') pt.motions.splice(+b.dataset.i, 1);
    stReqApply(); stLog('요청서 부위'); stSave(); stRender(); }
  else if (a === 'rqProd' && P.req) { P.req.kind = 'product'; stSave(); stRender(); }
  else if (a === 'rqMotion' && P.req) { P.req.kind = 'motion'; stReqApply(); stStep = 1; stSave(); stRender(); }
  else if (a === 'cpick' && b.dataset.id === 'B') { stUseBubble(); stLog('개념안 선택: B안'); stStep = 3; stSave(); stRender(); }
  else if (a === 'cpick' && b.dataset.id) { P.chosen = b.dataset.id; P.design = null; const c = stChosenC(); stLog('개념안 선택: ' + (c ? (c.id ? c.id + '안 ' : '') + c.ko : P.chosen)); toast('골랐어요. 이 안은 아직 3D 설계가 없어 비교 정보만 이어집니다'); stSave(); stRender(); }
  else if (a === 'ptest') { P.tests = (P.tests || []).concat([{ at: new Date().toISOString(), result: b.dataset.v, ringD: P.design.ringD, wheelRpm: P.design.wheelRpm }]); stSave(); stRender(); }
  else if (a === 'zip' && P.design && P.design.kind === 'bubble') $('xHousing').checked = true;
}, true);
$('stBody').addEventListener('change', e => {
  const el = e.target; if (!P || !P.req) return; const R = P.req;
  if (el.dataset.rx) { const [i, f] = el.dataset.rx.split(':'), x = R.extra && R.extra[+i]; if (!x) return; const E = M2M_EXTRA[x.key];
    if (f === 'value' && E) { const v = parseFloat(el.value); if (el.value.trim() !== '' && !(v >= E.range[0] && v <= E.range[1])) { toast(`${E.ko}은(는) ${E.range[0]}~${E.range[1]} ${E.unit} 사이여야 합니다`); el.value = x.value; return; } x.value = el.value.trim() === '' ? '' : v; }
    else x[f] = el.value; stReqApply(); stLog('요청서 추가 항목'); stSave(); stRender(); return; }
  if (el.dataset.pp || el.dataset.ps || el.dataset.pm) { const PT = R.parts || [];
    if (el.dataset.pp) { const [pi, f] = el.dataset.pp.split(':'), pt = PT[+pi]; if (!pt) return; pt[f] = f === 'name' ? el.value.trim() || pt.name : el.value; pt.source = 'user'; }
    else if (el.dataset.ps) { const [pi, si, f] = el.dataset.ps.split(':'), x = PT[+pi] && PT[+pi].specs[+si]; if (!x) return; const E = M2M_PSPEC[x.key];
      if (f === 'value' && E) { const v = parseFloat(el.value); if (el.value.trim() !== '' && !(v >= E.range[0] && v <= E.range[1])) { toast(`${E.ko}은(는) ${E.range[0]}~${E.range[1]} ${E.unit} 사이여야 합니다`); el.value = x.value; return; } x.value = el.value.trim() === '' ? '' : v; }
      else x[f] = el.value; x.source = 'user'; }
    else { const [pi, mi, f] = el.dataset.pm.split(':'), m = PT[+pi] && PT[+pi].motions[+mi]; if (!m) return;
      if (f.startsWith('t.')) { const v = parseFloat(el.value); if (el.value.trim() !== '' && !(v > 0)) { toast('0보다 큰 수를 넣으세요'); el.value = m.traits[f.slice(2)] ?? ''; return; } m.traits = { ...m.traits, [f.slice(2)]: el.value.trim() === '' ? '' : v }; }
      else { m[f] = el.value; if (f === 'kind') m.traits = {}; } m.source = 'user'; }
    stReqApply(); stLog('요청서 부위'); stSave(); stRender(); return; }
  if (el.dataset.rq || el.dataset.rqp || el.dataset.rqfx) {
    if (el.dataset.rq === 'shape') { R.shape = el.value ? m2mReqShape(el.value, 'user') : { value: null, source: 'missing' };
      if ((R.parts || []).every(pt => pt.source === 'default' && pt.specs.every(x => x.value === '') && pt.motions.every(m => m.source === 'default'))) R.parts = el.value ? m2mPartsFrom(el.value) : []; }   // 손대지 않은 기본 부위만 바꿈
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
