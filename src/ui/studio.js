/* ---- 동작으로 설계 (스튜디오 쉬운 흐름) ----
 1 프로젝트 → 2 동작 정의 → 3 추천·비교 → 4 설계 → 5 시뮬레이션·검증 → 6 제작
 상태는 프로젝트 하나(P)에 모두 담고, 바뀔 때마다 이 브라우저에 저장함 */
const ST_STEPS = ['프로젝트', '동작 정의', '추천·비교', '설계', '시뮬레이션', '제작'];
const ST_KEY = 'm2m.projects', stLS = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }, del(k) { try { localStorage.removeItem(k); } catch { } } };
let P = null, stStep = 0, stExpert = false, stRec = null, stRecKey = '', stAI = null, stBusy = false;
const stAIP = (async () => { try { return window.claude && window.claude.use ? await window.claude.use('sample') : null; } catch { return null; } })();
stAIP.then(s => { stAI = s; if (stStep === 1) stRender(); });
const ST_EX = [['비누방울 총', '총모양의 형상. 방아쇠를 당기면 총 입구에서 비누방울이 만들어져 나가야 함'], ['상자 밀어내기', '컨베이어 위 상자를 3초마다 옆으로 40mm 밀어내고 싶어'], ['와이퍼', '와이퍼처럼 80도를 2초에 한 번 흔들고 싶어'], ['회전 작업대', '회전 작업대를 6칸으로 나눠 한 칸씩 돌다 멈추게, 한 칸에 2초'], ['작은 승강기', '500g 물건을 150mm 들어 올리기']];
function stReqOf(t) { const R = m2mRequest(t); delete R.spec; return R; }
function stNew(name, text = '') { return { schema: 'm2m.project/1', id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name || '새 프로젝트', updated: new Date().toISOString(), spec: text ? m2mParse(text) : m2mSpec(''), req: text ? stReqOf(text) : null, chosen: null, design: null, step: 1, history: [] }; }
function stSave() { if (!P) return; P.updated = new Date().toISOString(); P.step = stStep; stLS.set('m2m.p.' + P.id, P);
  const L = stLS.get(ST_KEY, []).filter(x => x.id !== P.id); L.unshift({ id: P.id, name: P.name, updated: P.updated, motion: P.spec.motion.value, chosen: P.chosen, step: stStep }); stLS.set(ST_KEY, L.slice(0, 50)); }
function stOpen(Q) { P = Q; stRec = null; stRecKey = ''; stStep = Math.max(1, Math.min(5, Q.step || 1)); if (P.design) { try { setDesign(JSON.parse(JSON.stringify(P.design))); } catch { } } stSave(); stRender(); }
function stLog(what) { if (!P) return; P.history = (P.history || []).concat([{ at: new Date().toISOString(), what }]).slice(-50); }
const stBadge = (k, t) => `<span class="bdg b-${k}">${t}</span>`;
const ST_STATE = { ok: ['ok', '검사 통과'], bad: ['bad', '미달'], calc: ['calc', '계산됨'], assume: ['assume', '가정값'], unv: ['mute', '미검증'], none: ['mute', '미구현'], ai: ['ai', 'AI 추정'], user: ['user', '내가 줌'] };
const stB = s => stBadge(...ST_STATE[s]);
const srcB = src => src === 'user' ? stB('user') : src === 'ai' ? stB('ai') : src === 'calc' ? stB('calc') : src === 'default' ? stB('assume') : stBadge('mute', '비어 있음');
function stCan(i) { if (i <= 1) return true; if (!P) return false; if (stIsProd()) return true; if (i === 2) return !!P.spec.motion.value; return !!P.design; }
function stGo(i) { if (!stCan(i)) return; stStep = i; stSave(); stRender();
  if (i === 2 && !P.chosen && stIsProd() && stCanBuild()) setDesign(stBubDesign());   // 개념안: 3D·치수까지 만든 B안을 미리 보여 줌
  if (i === 2 && !P.chosen && !stIsProd()) { const c = stRecRun().list[0]; if (c) setDesign(JSON.parse(JSON.stringify(c.design))); } }   // 추천에 들어가면 1순위를 3D로 먼저 보여 줌
function stTraitKeys(S) { const need = (M2M_NEED[S.motion.value] || []).map(x => x[0]); return [...new Set(need.concat(Object.keys(S.traits)))]; }
function stRender() {
  $('stSteps').innerHTML = (stIsProd() ? ST_PSTEPS : ST_STEPS).map((t, i) => `<button data-st="${i}" aria-current="${i === stStep ? 'step' : 'false'}"${stCan(i) ? '' : ' disabled'}><b>${i + 1}</b>${t}</button>`).join('');
  $('stExpert').checked = stExpert;
  const H = (stIsProd() ? [stHome, stDefine, stConcepts, stPDesign, stPSim, stPMake] : [stHome, stDefine, stRecommend, stDesign, stSim, stMake])[stStep];
  try { $('stBody').innerHTML = H(); } catch (e) { $('stBody').innerHTML = `<p class="hint">이 단계를 그리지 못했습니다: ${escH(e && e.message || e)}</p>`; }
  $('stNext').textContent = stNextHint();
}
function stNextHint() {
  if (stStep === 0) return '다음: 새 프로젝트를 만들거나 예제를 고르세요.';
  if (!P) return '';
  if (stIsProd()) return stPHint();
  if (stStep === 1) { const q = m2mQuestions(P.spec); return !P.spec.motion.value ? '다음: 원하는 움직임을 글로 쓰거나 아래 그림 카드에서 고르세요.' : q.length ? `다음: 빠진 값 ${q.length}개를 채우면 더 정확해집니다. 비워 두면 기본값(가정값)으로 계산합니다.` : '다음: “기구 추천 보기”를 누르세요.'; }
  if (stStep === 2) return P.chosen ? '다음: 고른 기구의 치수를 다듬거나 바로 시뮬레이션으로 가세요.' : '다음: 후보를 눌러 3D로 보고, 마음에 드는 것을 “이걸로 설계”하세요.';
  if (stStep === 3) return '다음: 값을 바꾸면 기구 치수가 다시 계산됩니다. 끝나면 시뮬레이션에서 요구치와 비교하세요.';
  if (stStep === 4) return '다음: 모두 통과했으면 제작 단계에서 파일을 받으세요.';
  return '파일을 받거나 프로젝트를 저장하세요. 앞 단계로 돌아가 바꾸면 여기도 다시 계산됩니다.';
}
// 1. 프로젝트
function stHome() {
  const L = stLS.get(ST_KEY, []);
  return `<fieldset><legend>내 프로젝트</legend>
    <div class="row"><button class="btn primary" data-act="new">새 프로젝트</button><button class="btn" data-act="openFile">파일 열기</button><input type="file" id="stFile" accept=".json,application/json" hidden></div>
    ${L.length ? `<div class="alts">${L.map(x => `<div class="stCard"><div class="row" style="align-items:center"><b style="flex:1">${escH(x.name)}</b><span class="pill">${x.step + 1}. ${ST_STEPS[x.step] || ''}</span></div>
      <p class="hint">${x.motion ? escH(M2M_MOTIONS[x.motion] ? M2M_MOTIONS[x.motion].ko : x.motion) : '동작 미정'}${x.chosen ? ' · ' + escH((M2M_KB.find(k => k.id === x.chosen) || {}).ko || x.chosen) : ''} · ${new Date(x.updated).toLocaleString('ko-KR')}</p>
      <div class="row"><button class="btn" data-act="open" data-id="${x.id}">열기</button><button class="btn" data-act="dup" data-id="${x.id}">복제</button><button class="btn" data-act="del" data-id="${x.id}">지우기</button></div></div>`).join('')}</div>` : '<p class="hint">아직 프로젝트가 없습니다.</p>'}
  </fieldset>
  <fieldset><legend>예제로 시작</legend><div class="alts">${ST_EX.map(([n, t], i) => `<button class="alt" data-act="ex" data-i="${i}"><span class="pill">예제</span><span>${escH(n)}<br><small>${escH(t)}</small></span><span></span></button>`).join('')}</div></fieldset>
  <p class="hint">프로젝트는 이 브라우저에 저장됩니다. 다른 기기로 옮기려면 제작 단계에서 프로젝트 파일(.m2m.json)을 받으세요.</p>`;
}
// 제품 요청서 카드: 해석 결과를 그대로 고칠 수 있는 양식. 고치면 출처가 '내가 줌'이 되고 개념안·설계에 다시 반영됨
function stReqCard(R) {
  if (R.kind !== 'product') return `<fieldset><legend>제품 요청서</legend><p class="hint">움직임 하나를 만드는 요청으로 읽었어요. 모양·조작·효과가 있는 제품이라면 바꾸세요.</p>
    <div class="row"><button class="btn" data-act="rqProd">제품 요청으로 다루기</button></div></fieldset>`;
  const q = m2mRequestQuestions(R), opt = (tbl, v, none) => `<option value=""${!v ? ' selected' : ''}>${none}</option>` + Object.entries(tbl).map(([k, x]) => `<option value="${k}"${k === v ? ' selected' : ''}>${escH(x[0])}</option>`).join('');
  const prm = (grp, o) => Object.entries(o || {}).map(([k, x]) => { const [n, u] = M2M_PNAME[k] || [k, ''], [lo, hi] = M2M_PRANGE[k] || [0, 1e9];
    return `<label class="f">${n} <span class="u">${u}</span><span class="row" style="gap:6px;align-items:center"><input type="number" step="any" data-rqp="${grp}:${k}" data-lo="${lo}" data-hi="${hi}" value="${x.value}" style="width:80px">${srcB(x.source)}</span></label>`; }).join('');
  const inp = R.inputs[0], fxOn = k => R.effects.some(e => e.kind === k), fxSrc = k => (R.effects.find(e => e.kind === k) || {}).source;
  return `<fieldset><legend>제품 요청서</legend><p class="hint">글에서 읽은 내용이에요. 칸을 고치면 개념안과 설계에 다시 반영됩니다. 출처 표시는 고친 칸부터 “내가 줌”이 됩니다.</p>
    <div class="tblWrap"><table class="vt"><tbody>
      <tr><td>모양</td><td><select data-rq="shape">${opt(M2M_SHAPES, R.shape.value, '정하지 않음')}</select>${R.shape.value ? `<div class="grid2" style="margin-top:6px">${prm('shape', R.shape.params)}</div>` : ''}</td><td>${srcB(R.shape.source)}</td></tr>
      <tr><td>사람 입력</td><td><select data-rq="input">${opt(M2M_INPUTS, inp && inp.kind, '정하지 않음')}</select>${inp ? `<div class="grid2" style="margin-top:6px">${prm('input', inp.params)}</div>` : ''}</td><td>${srcB(inp ? inp.source : 'missing')}</td></tr>
      <tr><td>결과 효과</td><td>${Object.entries(M2M_EFFECTS).map(([k, x]) => `<label class="chk"><input type="checkbox" data-rqfx="${k}"${fxOn(k) ? ' checked' : ''}> ${escH(x[0])}${fxOn(k) ? ' ' + srcB(fxSrc(k)) : ''}</label>`).join(' ')}
        ${R.effects.some(e => e.kind === 'motion') ? `<p class="hint">움직임: ${escH(M2M_MOTIONS[P.spec.motion.value] ? M2M_MOTIONS[P.spec.motion.value].ko : '?')}</p>` : ''}</td><td>${R.effects.length ? '' : srcB('missing')}</td></tr>
      <tr><td>동력</td><td><select data-rq="power"><option value=""${!R.power.value ? ' selected' : ''}>정하지 않음</option><option value="hand"${R.power.value === 'hand' ? ' selected' : ''}>손힘만</option><option value="battery"${R.power.value === 'battery' ? ' selected' : ''}>건전지·모터 가능</option></select></td><td>${srcB(R.power.source)}</td></tr>
    </tbody></table></div>
    ${stPartsCard(R)}
    ${stExtraCard(R)}
    ${q.length ? `<p class="hint">아직 비어 있는 칸: ${q.map(x => escH(x.ask)).join(' / ')}</p>` : ''}
    <div class="row">${m2mDecompose(R).ok ? `<button class="btn primary" data-go="2">기능 분해와 개념안 보기</button>` : ''}<button class="btn" data-act="rqMotion">움직임 하나로 다루기</button></div>
    ${m2mDecompose(R).ok ? '' : `<p class="hint">고른 효과는 아직 <b>기능 분해</b> 템플릿이 없어요 ${stB('none')}. 지금은 “비누방울”만 개념안·설계·시뮬레이션·제작까지 이어집니다. 아래에서 움직임 하나씩은 설계할 수 있어요.</p>`}</fieldset>`;
}
// 2. 동작 정의
function stDefine() {
  const S = P.spec, mo = S.motion.value, q = m2mQuestions(S), keys = mo ? stTraitKeys(S) : [];
  const traitRow = k => { const t = S.traits[k], [ko, u] = M2M_TRAITS[k] || [k, '']; return `<tr><td>${ko}</td><td><input type="number" step="any" data-tr="${k}" value="${t && t.value != null ? t.value : ''}" placeholder="${M2M_DEF[k] ?? ''}" style="width:90px"> <span class="u">${u}</span></td><td>${srcB(t ? t.source : 'missing')}</td></tr>`; };
  return `<fieldset><legend>무엇을 어떻게 움직이고 싶으세요?</legend>
    <label class="f">프로젝트 이름<input id="stName" value="${escH(P.name)}"></label>
    <textarea id="stText" rows="3" placeholder="예: 컨베이어 위 상자를 3초마다 옆으로 40mm 밀어내고 싶어">${escH(S.text || '')}</textarea>
    <div class="row"><button class="btn primary" data-act="parse">글 해석하기</button>${stAI ? `<button class="btn" data-act="ai"${stBusy ? ' disabled' : ''}>${stBusy ? 'AI가 읽는 중…' : 'AI로 해석하기'}</button>` : ''}</div>
    <p class="hint">${stAI ? '“글 해석하기”는 낱말과 숫자만 읽습니다. “AI로 해석하기”는 문장의 뜻까지 읽지만, 결과는 AI 추정으로 표시되니 확인하세요.' : '낱말과 숫자·단위를 읽어 명세서를 만듭니다. (이 화면에서는 AI 해석을 쓸 수 없습니다)'}</p>
  </fieldset>
  ${P.req ? stReqCard(P.req) : ''}
  ${stIsProd() ? '<details><summary>움직임 하나만 따로 설계하기</summary>' : ''}<fieldset><legend>${stIsProd() ? '제품 안의 움직임 하나 고르기' : '움직임의 종류'}</legend><div class="moGrid">${Object.entries(M2M_MOTIONS).map(([k, v]) => `<button class="moCard" data-mo="${k}" aria-pressed="${k === mo}">${M2M_ICON[k] || ''}<b>${v.ko}</b><small>${v.hint}</small></button>`).join('')}</div>
    ${mo ? `<p class="hint">고른 것: <b>${M2M_MOTIONS[mo].ko}</b> ${srcB(S.motion.source)}</p>` : ''}</fieldset>
  ${q.length && mo ? `<fieldset class="ask"><legend>빠진 값 ${q.length}개</legend>${q.map(x => `<label class="f">${escH(x.ask)} <span class="u">${escH(x.unit || '')}</span><input type="number" step="any" data-tr="${x.key}" placeholder="비우면 ${M2M_DEF[x.key]} (가정값)"></label>`).join('')}</fieldset>` : ''}
  ${mo ? `<fieldset><legend>요구사항 명세서</legend>
    <table class="vt"><thead><tr><th>항목</th><th>값</th><th>출처</th></tr></thead><tbody>${keys.map(traitRow).join('')}</tbody></table>
    <div class="grid2" style="margin-top:8px"><label class="f">목적<select id="stPur">${asmOpts(Object.entries(M2M_PURPOSES), S.purpose.value)}</select></label>
      <label class="f">들어갈 공간 <span class="u">가로×세로×높이 mm</span><input id="stBox" placeholder="예: 200x150x120" value="${S.limits.box_mm ? S.limits.box_mm.filter(v => v).join('x') : ''}"></label></div>
    ${stExpert ? `<details><summary>명세서 JSON</summary><pre class="json">${escH(JSON.stringify(S, null, 1))}</pre></details>` : ''}
    <div class="row" style="margin-top:8px"><button class="btn primary" data-act="toRec">기구 추천 보기</button></div></fieldset>` : ''}${stIsProd() ? '</details>' : ''}`;
}
const M2M_ICON = {
  rotate: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="11"/><path d="M31 20l-3-4m3 4l3-4"/></svg>', intermittent: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="11"/><path d="M20 9v6M31 20h-6M20 31v-6M9 20h6"/></svg>',
  swing: '<svg viewBox="0 0 40 40"><path d="M20 32L10 12M20 32L30 12"/><path d="M12 10a12 12 0 0 1 16 0"/></svg>', recip: '<svg viewBox="0 0 40 40"><path d="M6 20h28M10 15l-4 5 4 5M30 15l4 5-4 5"/></svg>',
  linear: '<svg viewBox="0 0 40 40"><path d="M6 20h26M27 14l6 6-6 6"/></svg>', lift: '<svg viewBox="0 0 40 40"><path d="M20 34V8M14 13l6-6 6 6"/><rect x="13" y="26" width="14" height="8"/></svg>',
  vibrate: '<svg viewBox="0 0 40 40"><path d="M6 20l4-6 4 12 4-12 4 12 4-12 4 12 4-6"/></svg>', grip: '<svg viewBox="0 0 40 40"><path d="M12 8v14l6 8M28 8v14l-6 8"/></svg>' };
// 3. 추천·비교
function stRecRun() { const key = JSON.stringify(P.spec); if (stRec && stRecKey === key) return stRec; stRec = m2mRecommend(P.spec); stRecKey = key; return stRec; }
function stTorque(c) { const r = (c.rows || []).find(x => x.key === 'torque'); return r ? fmt(r.got, 3) + ' N·m' : '—'; }
function stRecommend() {
  const R = stRecRun(), L = R.list;
  if (!L.length) return `<fieldset><legend>추천</legend><p class="hint">이 요구를 만족하는 기구가 아직 없습니다.</p>${R.rejected.map(c => `<p class="hint">· ${escH(c.ko)}: ${escH(c.warn.join(' '))}</p>`).join('')}<div class="row"><button class="btn" data-go="1">요구사항 고치기</button></div></fieldset>`;
  const filled = Object.entries(R.spec.traits).filter(([k, t]) => t.source === 'default');
  return `${filled.length ? `<p class="hint">${stB('assume')} 비어 있던 ${filled.map(([k]) => M2M_TRAITS[k] ? M2M_TRAITS[k][0] : k).join(', ')}은(는) 기본값으로 계산했습니다.</p>` : ''}
  <fieldset><legend>후보 비교</legend><div class="tblWrap"><table class="vt"><thead><tr><th>기구</th><th>요구치</th><th>부품</th><th>크기 mm</th><th>필요 토크</th>${stExpert ? '<th>점수</th>' : ''}</tr></thead><tbody>
    ${L.map(c => `<tr${c.id === P.chosen ? ' class="sel"' : ''}><td>${escH(c.ko)}</td><td>${c.pass ? stB('ok') : stB('bad')}</td><td>${c.parts}</td><td>${c.size.join('×')}</td><td>${stTorque(c)}</td>${stExpert ? `<td>${c.score}</td>` : ''}</tr>`).join('')}</tbody></table></div>
    <p class="hint">요구치 칸은 만든 기구를 다시 계산해 잰 결과입니다. 필요 토크는 입력축에 걸리는 한 바퀴 중 최댓값(마찰 제외)입니다.</p></fieldset>
  ${L.map((c, i) => { const K = M2M_KB.find(k => k.id === c.id); return `<div class="stCard${c.id === P.chosen ? ' on' : ''}">
    <div class="row" style="align-items:center"><span class="pill">${i + 1}</span><b style="flex:1">${escH(c.ko)}</b>${c.pass ? stB('ok') : stB('bad')}</div>
    <p class="hint">${escH(K.io)} · ${escH(K.principle)}</p>
    <ul class="why">${c.why.map(w => `<li>${escH(w)}</li>`).join('')}${c.warn.map(w => `<li class="w">${escH(w)}</li>`).join('')}${c.checks.filter(x => x.st === 'bad').map(x => `<li class="w">${escH(x.txt)}</li>`).join('')}</ul>
    <details><summary>장단점과 쓰임</summary><p class="hint">좋은 점: ${K.pros.map(escH).join(', ')}<br>아쉬운 점: ${K.cons.map(escH).join(', ')}<br>쓰임: ${K.examples.map(escH).join(', ')}<br>주요 변수: ${escH(K.vars)}</p></details>
    <div class="row"><button class="btn" data-act="peek" data-id="${c.id}">3D로 보기</button><button class="btn primary" data-act="pick" data-id="${c.id}">이걸로 설계</button></div></div>`; }).join('')}
  ${R.rejected.length ? `<details><summary>맞지 않는 기구 ${R.rejected.length}개</summary>${R.rejected.map(c => `<p class="hint">· ${escH(c.ko)}: ${escH(c.warn.join(' '))}</p>`).join('')}</details>` : ''}`;
}
// 4. 설계
function stCand() { const R = stRecRun(); return R.list.find(c => c.id === P.chosen) || null; }
function stDesign() {
  const K = M2M_KB.find(k => k.id === P.chosen), c = stCand(), S = P.spec, keys = stTraitKeys(S);
  if (!K) return '<p class="hint">먼저 추천에서 기구를 고르세요.</p>';
  const D = P.design, par = D && D.kind === 'linkage' ? Object.entries(D[D.type] || {}) : D && D.kind === 'cam' ? [['Rb', D.Rb], ['상승 h', Math.max(...D.motion.segs.map(g => g.h || 0))]] : D && D.kind === 'rack' ? [['모듈', D.m], ['피니언 잇수', D.z1], ['랙 잇수', D.nR]] : D && D.gears ? D.gears.map(g => [g.name + ' 잇수', g.z]) : [];
  return `<fieldset><legend>${escH(K.ko)} · 요구치로 설계</legend>
    <p class="hint">요구치를 바꾸면 기구 치수를 다시 역산하고 3D가 바로 바뀝니다.</p>
    <table class="vt"><tbody>${keys.map(k => { const t = S.traits[k], [ko, u] = M2M_TRAITS[k] || [k, '']; return `<tr><td>${ko}</td><td><input type="number" step="any" data-tr="${k}" data-redo="1" value="${t && t.value != null ? t.value : M2M_DEF[k] ?? ''}" style="width:90px"> <span class="u">${u}</span></td><td>${srcB(t ? t.source : 'default')}</td></tr>`; }).join('')}</tbody></table>
    ${c && !c.pass ? `<p class="hint" style="color:var(--bad)">이 값으로는 요구치를 만족하지 못합니다: ${escH(c.warn.concat(c.checks.filter(x => x.st === 'bad').map(x => x.txt)).join(' '))}</p>` : ''}</fieldset>
  <fieldset><legend>계산된 기구 치수 ${stB('calc')}</legend><table class="vt"><tbody>${par.map(([k, v]) => `<tr><td>${escH(k)}</td><td>${typeof v === 'number' ? fmt(v, 2) : escH(v)}</td></tr>`).join('')}<tr><td>입력 회전수</td><td>${D && D.rpm ? fmt(D.rpm, 2) + ' rpm' : '—'}</td></tr>${c && c.motor ? `<tr><td>추천 동력원</td><td>${escH(c.motor)}</td></tr>` : ''}</tbody></table>
    <div class="row" style="margin-top:8px"><button class="btn" data-act="expert"${D && (D.kind === 'linkage' || D.kind === 'cam') ? '' : ' disabled'}>전문 도구에서 치수 직접 다듬기</button><button class="btn primary" data-go="4">시뮬레이션·검증으로</button></div>
    ${D && (D.kind === 'linkage' || D.kind === 'cam') ? '' : `<p class="hint">${stB('none')} 이 기구는 아직 전문 도구에서 직접 다듬기를 지원하지 않습니다.</p>`}</fieldset>`;
}
// 5. 시뮬레이션·검증
function stSim() {
  const c = stCand(), S = P.spec; if (!c) return '<p class="hint">먼저 기구를 고르세요.</p>';
  const unit = k => M2M_TRAITS[k] ? M2M_TRAITS[k][1] : k === 'torque' ? 'N·m' : '';
  const rows = (c.rows || []).map(r => { const ko = r.key === 'torque' ? '입력축 필요 토크' : (M2M_TRAITS[r.key] || [r.key])[0], want = r.want === null ? '—' : `${r.least ? '≥ ' : ''}${fmt(r.want, 3)} ${unit(r.key)} ${srcB(r.wantSrc)}`;
    return `<tr><td>${ko}</td><td>${want}</td><td>${fmt(r.got, 3)} ${unit(r.key)}</td><td>${r.ok === true ? stB('ok') : r.ok === false ? stB('bad') : stB('calc')}</td></tr>`; }).join('');
  const chk = (model && model.checks || []).filter(x => x.st !== 'ok');
  return `<fieldset><legend>요구치 대비 결과</legend><div class="tblWrap"><table class="vt"><thead><tr><th>항목</th><th>요구</th><th>결과(계산)</th><th>상태</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint">결과는 만든 기구를 입력 한 바퀴 360점에서 다시 풀어 잰 값이고, 차이가 1% 안이면 통과입니다.</p></fieldset>
  <fieldset><legend>무엇이 검증되었나</legend><table class="vt"><tbody>
    <tr><td>움직임(위치·각도)</td><td>${stB('ok')}</td><td class="hint">3D 화면의 움직임은 기구학 해를 그대로 그린 것입니다. 단순 애니메이션이 아닙니다.</td></tr>
    <tr><td>부품 간섭</td><td>${chk.some(x => /겹|간섭/.test(x.txt)) ? stB('bad') : stB('ok')}</td><td class="hint">층마다 2D 단면으로 검사합니다. 3D 아래 “간섭 검사”로 다시 볼 수 있습니다.</td></tr>
    <tr><td>필요 토크·모터</td><td>${stB('calc')}</td><td class="hint">준정적 계산(속도비 × 부하). 마찰과 가속은 넣지 않았습니다.</td></tr>
    <tr><td>힘·마찰·변형·응력</td><td>${stB('none')}</td><td class="hint">동역학과 구조 해석은 아직 하지 않습니다.</td></tr>
    <tr><td>실제 출력 맞춤</td><td>${fitOn() ? stB('calc') : stB('unv')}</td><td class="hint">${fitOn() ? '프린터 보정이 적용되어 있습니다.' : '프린터 보정을 하지 않았습니다(전문 도구 → 프린터 보정).'}</td></tr>
  </tbody></table></fieldset>
  ${chk.length ? `<fieldset><legend>검사 결과에서 확인할 것 ${chk.length}개</legend>${chk.map(x => `<p class="hint">${x.st === 'bad' ? stB('bad') : stBadge('warn', '주의')} ${x.txt}</p>`).join('')}</fieldset>` : ''}
  <div class="row"><button class="btn" data-go="3">설계로 돌아가기</button><button class="btn primary" data-go="5">제작으로</button></div>`;
}
// 6. 제작
function stMake() {
  const bom = (model && model.bom) || [];
  return `<fieldset><legend>부품표</legend><div class="tblWrap"><table class="vt"><thead><tr><th>부품</th><th>개수</th><th>메모</th></tr></thead><tbody>${bom.slice(0, 30).map(b => `<tr><td>${escH(b[0])}</td><td>${b[1]}</td><td class="hint">${escH(b[2] || '')}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint">출력 부품은 STL 묶음에 들어 있습니다. 구입 부품의 제조사·가격은 정하지 않습니다(대표 치수만).</p></fieldset>
  <fieldset><legend>파일</legend><div class="row"><button class="btn primary" data-act="zip">STL 묶음 저장 (.zip)</button><button class="btn" data-act="saveProj">프로젝트 파일 저장</button></div>
    <p class="hint">STL 묶음에는 부품별 STL, 출력판 배치, 조립 상태, 부품표·조립 순서, 설계 파일이 들어 있습니다.</p></fieldset>
  <fieldset><legend>더 하기</legend><div class="row"><button class="btn" data-act="expert"${P.design && (P.design.kind === 'linkage' || P.design.kind === 'cam') ? '' : ' disabled'}>전문 도구에서 다듬기</button><button class="btn" data-act="toAsm"${P.design && P.design.kind === 'linkage' ? '' : ' disabled'}>조립 작업대에 넣기</button></div>
    <p class="hint">여러 동작을 한 장치로 묶는 것은 조립 작업대(전문 도구)에서 합니다. 여러 동작을 한꺼번에 정의하는 흐름은 ${stB('none')}입니다.</p></fieldset>`;
}
// ---- 동작 ----
function stUseCand(c, go) { P.chosen = c.id; P.design = JSON.parse(JSON.stringify(c.design)); setDesign(JSON.parse(JSON.stringify(c.design))); if (go) stStep = 3; stSave(); stRender(); }
function stRedo() {   // 요구치가 바뀜 → 추천 다시, 고른 기구가 있으면 그 기구로 다시 설계
  stRec = null; if (!P.chosen) return; const c = stRecRun().list.find(x => x.id === P.chosen);
  if (c) { P.design = JSON.parse(JSON.stringify(c.design)); setDesign(JSON.parse(JSON.stringify(c.design)), false); }
  else { const K = M2M_KB.find(k => k.id === P.chosen), e = K && m2mEval(K, m2mFilled(P.spec)); toast('이 값으로는 고른 기구를 만들 수 없습니다' + (e && e.warn.length ? ': ' + e.warn[0] : '')); }
}
async function stAIParse() {
  const text = $('stText').value.trim(); if (!text || !stAI || stBusy) return; stBusy = true; stRender();
  const prompt = `You read a person's description of a wanted machine or product (often Korean) and fill a request form as JSON. Reply with JSON only.
Schema: {"kind": "product" if it describes a whole product (a shape, something a person operates, or an effect such as bubbles, wind, light) else "motion",
"shape": one of ${JSON.stringify(Object.keys(M2M_SHAPES))} or null, "input": one of ${JSON.stringify(Object.keys(M2M_INPUTS))} or null,
"effects": array of ${JSON.stringify(Object.keys(M2M_EFFECTS))} (may be empty), "power": "hand" | "battery" | null,
"motion": one of ${JSON.stringify(Object.keys(M2M_MOTIONS))} or null, "purpose": one of ${JSON.stringify(Object.keys(M2M_PURPOSES))},
"traits": {optional numbers: "stroke_mm","angle_deg","steps","period_s","rpm","speed_mms","load_N","force_N","freq_hz"}, "box_mm": [w,d,h] or null, "note": short Korean sentence on anything assumed}.
Rules: only fill what the text states or clearly implies; power is null unless the text says hand-only or mentions battery/motor/electric; motion is the single main mechanical motion, or null for a product whose result is an effect; convert units (1 kg weight = 9.81 N, cm to mm). Do not invent numbers.
Text: ${JSON.stringify(text)}`;
  const R = m2mRequest(text), S = R.spec; delete R.spec;
  try {
    const r = await stAI.json(prompt, { modelTier: 'quick' }) || {};
    // 규칙이 읽은 값은 '내가 줌' 그대로, 규칙이 못 읽은 칸만 AI 값으로 채우고 'AI 추정'으로 표시
    if (M2M_MOTIONS[r.motion] && !S.motion.value) S.motion = { value: r.motion, source: 'ai' };
    if (M2M_PURPOSES[r.purpose] && S.purpose.source !== 'user') S.purpose = { value: r.purpose, source: 'ai' };
    for (const [k, v] of Object.entries(r.traits || {})) if (M2M_TRAITS[k] && isFinite(+v) && +v > 0 && !S.traits[k]) S.traits[k] = { value: +v, source: 'ai' };
    if (Array.isArray(r.box_mm) && !S.limits.box_mm && r.box_mm.every(v => v == null || isFinite(+v))) S.limits.box_mm = r.box_mm.map(v => v == null ? null : +v);
    if (!R.shape.value && M2M_SHAPES[r.shape]) R.shape = m2mReqShape(r.shape, 'ai');
    if (!R.inputs.length && M2M_INPUTS[r.input]) R.inputs = [m2mReqInput(r.input, 'ai')];
    for (const k of Array.isArray(r.effects) ? r.effects : []) if (M2M_EFFECTS[k] && !R.effects.some(e => e.kind === k)) R.effects.push({ id: k, kind: k, source: 'ai' });
    if (!R.power.value && (r.power === 'hand' || r.power === 'battery')) R.power = { value: r.power, source: 'ai' };
    if (S.motion.value && !R.effects.some(e => e.kind === 'motion')) R.effects.push({ id: 'motion', kind: 'motion', motion: S.motion.value, source: S.motion.source });
    if (R.kind !== 'product' && (r.kind === 'product' || R.shape.value || R.inputs.length || R.effects.some(e => e.kind !== 'motion'))) R.kind = 'product';
    stLog('AI 해석'); if (r.note) toast('AI: ' + String(r.note).slice(0, 140));
  } catch (e) { toast(e && e.code === 'not_granted' ? 'AI 사용을 허락하지 않아 글 해석만 씁니다' : 'AI 해석에 실패해 글 해석만 씁니다'); }
  P.spec = S; P.req = R; stReqApply();
  stBusy = false; stRec = null; stSave(); stRender();
}
$('modeEasy').onclick = () => selectTab('studio');
$('modeExpert').onclick = () => selectTab(stLastTab || 'box');
let stLastTab = 'box';
$('stExpert').onchange = () => { stExpert = $('stExpert').checked; stRender(); };
$('stSteps').addEventListener('click', e => { const b = e.target.closest('button[data-st]'); if (b) stGo(+b.dataset.st); });
$('stBody').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.go) return stGo(+b.dataset.go);
  if (b.dataset.mo) { P.spec.motion = { value: b.dataset.mo, source: 'user' }; stRec = null; stSave(); return stRender(); }
  const a = b.dataset.act, id = b.dataset.id;
  if (a === 'new') { stOpen(stNew()); }
  else if (a === 'ex') { const [n, t] = ST_EX[+b.dataset.i]; stOpen(stNew(n, t)); }
  else if (a === 'open') { const Q = stLS.get('m2m.p.' + id, null); if (Q) stOpen(Q); else toast('프로젝트를 찾지 못했습니다'); }
  else if (a === 'dup') { const Q = stLS.get('m2m.p.' + id, null); if (Q) { const N = { ...JSON.parse(JSON.stringify(Q)), id: stNew().id, name: Q.name + ' 사본' }; P = N; stSave(); P = null; stRender(); } }
  else if (a === 'del') { if (!confirm('이 프로젝트를 지울까요?')) return; stLS.del('m2m.p.' + id); stLS.set(ST_KEY, stLS.get(ST_KEY, []).filter(x => x.id !== id)); if (P && P.id === id) P = null; stRender(); }
  else if (a === 'openFile') $('stFile').click();
  else if (a === 'parse') { const t = $('stText').value; const R = m2mRequest(t), S = R.spec; if (!S.motion.value && P.spec.motion.value) S.motion = P.spec.motion; P.spec = S; delete R.spec; P.req = R; stReqApply(); stLog('글 해석'); stRec = null; stSave(); stRender(); if (R.kind === 'product') toast('제품 요청으로 읽었습니다. 요청서를 확인하세요'); else if (!S.motion.value) toast('움직임 종류를 알아내지 못했습니다. 아래 카드에서 고르세요'); }
  else if (a === 'pw' && P.req) { P.req.power = { value: b.dataset.v, source: 'user' }; stReqApply(); stSave(); stRender(); }
  else if (a === 'ai') stAIParse();
  else if (a === 'toRec') { stGo(2); }
  else if (a === 'peek') { const c = stRecRun().list.find(x => x.id === id); if (c) setDesign(JSON.parse(JSON.stringify(c.design))); }
  else if (a === 'pick') { const c = stRecRun().list.find(x => x.id === id); if (c) { stLog('기구 선택: ' + c.ko); stUseCand(c, true); } }
  else if (a === 'expert') { const D = JSON.parse(JSON.stringify(P.design)); if (D.kind === 'linkage') { kD = D; selectTab('link'); } else if (D.kind === 'cam') { cD = D; selectTab('cam'); } toast('전문 도구에서 바꾼 치수는 스튜디오의 요구치 검증에 들어가지 않습니다'); }
  else if (a === 'toAsm') { const d = JSON.parse(JSON.stringify(P.design)); if (!aD) aD = asmDefault(); aD = { version: 1, kind: 'asm', mods: [{ design: d }] }; selectTab('asm'); toast('조립 작업대에 1번 기구로 넣었습니다'); }
  else if (a === 'zip') { if (P.design) { setDesign(JSON.parse(JSON.stringify(P.design)), false); exportZip(); } }
  else if (a === 'saveProj') saveFile(`${P.name.replace(/[\\/:*?"<>|\s]+/g, '_')}.m2m.json`, new TextEncoder().encode(JSON.stringify(P, null, 1)));
});
$('stBody').addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'stFile') { const f = el.files && el.files[0]; if (!f) return; f.text().then(t => { try { const Q = JSON.parse(t); if (Q.schema !== 'm2m.project/1' || !Q.spec) throw new Error('프로젝트 파일이 아닙니다'); Q.id = Q.id || stNew().id; stOpen(Q); toast('프로젝트를 열었습니다'); } catch (err) { toast('열 수 없습니다: ' + (err && err.message || err)); } }); return; }
  if (!P) return;
  if (el.id === 'stName') { P.name = el.value.trim() || '이름 없음'; stSave(); return; }
  if (el.id === 'stText') { P.spec.text = el.value; stSave(); return; }
  if (el.id === 'stPur') { P.spec.purpose = { value: el.value, source: 'user' }; stRec = null; stSave(); return; }
  if (el.id === 'stBox') { const m = el.value.match(/(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)(?:\D+(\d+(?:\.\d+)?))?/); P.spec.limits.box_mm = m ? [+m[1], +m[2], m[3] ? +m[3] : null] : null; stRec = null; stSave(); if (stStep >= 3) { stRedo(); } stRender(); return; }
  const k = el.dataset.tr; if (!k) return;
  const v = parseFloat(el.value);
  if (el.value.trim() === '' ) delete P.spec.traits[k];
  else if (!(v > 0)) { toast(`${(M2M_TRAITS[k] || [k])[0]}은(는) 0보다 큰 수여야 합니다`); el.value = P.spec.traits[k] ? P.spec.traits[k].value : ''; return; }
  else { P.spec.traits[k] = { value: v, source: 'user' }; if (k === 'angle_deg' && P.spec.motion.value === 'intermittent' && 360 % v < 1e-6) P.spec.traits.steps = { value: 360 / v, source: 'calc' }; }
  stLog(`${(M2M_TRAITS[k] || [k])[0]} → ${el.value}`); stRec = null;
  if (el.dataset.redo) stRedo();
  stSave(); stRender();
});
