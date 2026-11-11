// ===== 대화로 요청서 완성하기 =====
// 앱이 빈 칸을 하나씩 묻고, 답은 규칙(m2mExtract)으로 먼저 읽고, 규칙이 못 읽은 말만 AI가 칸 값으로 옮김.
// AI가 옮긴 표현은 '배운 표현'으로 저장 → 다음부터는 AI 없이 규칙이 읽음.
const ST_LEX_KEY = 'm2m.lex';
M2M_LEX = stLS.get(ST_LEX_KEY, []);
const stChatOK = () => !P.req || stIsProd();
// 지금 물을 칸: 앞에서 물은 칸이 아직 비었으면 그것, 아니면 꼭 채울 칸의 첫째
function stChatAsk() { if (!P.req) return null; const miss = m2mReqMissing(P.req), opt = m2mReqMissing(P.req, true);
  return P.chatAsk && (miss.includes(P.chatAsk) || opt.includes(P.chatAsk)) ? P.chatAsk : miss[0] || null; }
function stChatFilled(R) { return Object.keys(M2M_SLOTS).filter(k => m2mSlotOn(R, k) || M2M_SLOTS[k].cat).map(k => { const S = M2M_SLOTS[k];
  if (S.cat) { if (!S.has(R)) return null; const v = k === 'effects' ? R.effects.filter(e => e.kind !== 'motion').map(e => M2M_EFFECTS[e.kind][0]).join(', ') : k === 'inputs' ? M2M_INPUTS[R.inputs[0].kind][0] : k === 'power' ? S.show(R.power.value) : S.show(R.shape.value); return v ? `${S.ko}: ${v}` : null; }
  const x = m2mSlotGet(R, k); return x ? m2mSlotText(k, x.value) : null; }).filter(Boolean); }
function stChatPush(role, text, more = {}) { P.chat = (P.chat || []).concat([{ role, text, at: new Date().toISOString(), ...more }]).slice(-80); }
function stChatQuestion() { const k = stChatAsk(); P.chatAsk = k;
  if (k) { const S = M2M_SLOTS[k]; stChatPush('app', S.ask + (S.cat ? '' : ` (${S.range[0]}~${S.range[1]} ${S.unit})`), { ask: k }); }
  else stChatPush('app', '꼭 정할 칸을 모두 채웠어요. 요청서를 확인하고 “기능 분해와 개념안 보기”로 넘어가세요. 더 정하고 싶은 칸은 아래에서 고를 수 있어요.', { done: true }); }
// 글 해석으로 요청서를 처음 만들었을 때
function stChatStart() { if (!P.req || !stIsProd()) return; P.chat = []; P.chatAsk = null;
  const got = stChatFilled(P.req); stChatPush('app', '요청서를 만들었어요.', { read: got }); stChatQuestion(); }
const ST_SKIP = /^(상관\s?없|아무거나|기본|몰라|모르겠|패스|넘어|알아서|괜찮아요?$)/;
async function stChatSend(text) {
  text = String(text || '').trim(); if (!text || stBusy) return;
  let R = P.req, read = [], bad = [], ai = null, learned = [];
  const asked = stChatAsk();
  if (!R || !stIsProd()) {   // 첫 문장: 요청서를 만듦
    const N = m2mRequest(text), S = N.spec; delete N.spec; if (!S.motion.value && P.spec.motion.value) S.motion = P.spec.motion; P.spec = S; P.req = R = N; P.chat = []; P.chatAsk = null;
    stChatPush('user', text); read = stChatFilled(R); stLog('대화: 요청서 만듦');
    if (R.kind !== 'product') { stChatPush('app', '움직임 하나를 설계하는 요청으로 읽었어요. 아래 “움직임의 종류”와 명세서에서 이어 가세요.', { read }); stReqApply(); stSave(); stRender(); return; }
  } else {
    stChatPush('user', text);
    if (asked && ST_SKIP.test(text)) { R.skip = (R.skip || []).concat([asked]); read = [`${M2M_SLOTS[asked].ko}: 기본값 쓰기`]; }
    else { const F = m2mExtract(text, R, asked), done = m2mApplyFound(R, F, 'user'); read = done.map(f => m2mSlotText(f.slot, f.value) + (f.how === 'lex' ? ' (배운 표현)' : '')); bad = F.filter(f => f.err).map(f => `${M2M_SLOTS[f.slot].ko} ${f.value}: ${f.err}`);
      // 규칙이 아무것도 못 읽었거나 AI가 더 읽을 수 있을 때 AI에게 물음
      if (stAI && P.chatAI !== false) { stBusy = true; stRender();
        try { const r = await stAI.json(stChatPrompt(R, text, asked, done), { modelTier: 'quick' }) || {};
          const fills = (Array.isArray(r.fills) ? r.fills : []).filter(f => f && M2M_SLOTS[f.slot] && !done.some(d => d.slot === f.slot) && (M2M_SLOTS[f.slot].cat || m2mSlotOn(R, f.slot)))
            .map(f => { const v = M2M_SLOTS[f.slot].cat ? String(f.value) : +f.value; return { slot: f.slot, value: v, phrase: String(f.phrase || ''), how: 'ai', err: m2mSlotCheck(f.slot, v) }; });
          const aiDone = m2mApplyFound(R, fills, 'ai', true); bad = bad.concat(fills.filter(f => f.err).map(f => `AI: ${M2M_SLOTS[f.slot].ko} ${f.value}: ${f.err}`));
          const L = m2mLearn(M2M_LEX, text, aiDone, done); M2M_LEX = L.lex; learned = L.added; if (learned.length) stLS.set(ST_LEX_KEY, M2M_LEX);
          ai = { text: String(r.reply || '').slice(0, 300), read: aiDone.map(f => m2mSlotText(f.slot, f.value)) };
        } catch (e) { ai = { text: e && e.code === 'not_granted' ? 'AI 사용을 허락하지 않아 규칙으로만 읽었어요.' : 'AI가 답하지 못해 규칙으로만 읽었어요.', read: [] }; }
        stBusy = false; }
    }
    stLog('대화');
  }
  stChatPush('app', read.length ? '읽은 것' : ai ? '규칙으로 읽은 값은 없어요.' : '읽은 값이 없어요. 숫자와 단위(mm, mL, 번 …)를 넣거나 아래에서 골라 주세요.', { read, bad });
  if (ai && (ai.text || ai.read.length)) stChatPush('ai', ai.text, { read: ai.read, learned: learned.map(l => `“${l.phrase}” → ${M2M_SLOTS[l.slot].ko}${l.value != null ? ' ' + (M2M_SLOTS[l.slot].cat ? M2M_SLOTS[l.slot].show(l.value) : l.value + ' ' + M2M_SLOTS[l.slot].unit) : ''}`) });
  stChatQuestion(); stReqApply(); stRec = null; stSave(); stRender();
  const log = $('chLog'); if (log) log.scrollTop = log.scrollHeight; const inp = $('chIn'); if (inp) inp.focus();
}
function stChatPrompt(R, text, asked, done) {
  const slots = Object.fromEntries(Object.entries(M2M_SLOTS).filter(([k, S]) => S.cat || m2mSlotOn(R, k)).map(([k, S]) => [k, S.cat ? { ko: S.ko, choices: S.choices().map(c => c[0]) } : { ko: S.ko, unit: S.unit, range: S.range }]));
  const conv = (P.chat || []).slice(-9, -1).map(c => (c.role === 'user' ? '사람: ' : '앱: ') + c.text + (c.read && c.read.length ? ' [' + c.read.join(', ') + ']' : '')).join('\n');
  return `You help a person finish a request form for a small 3D-printed product. The app already read the latest message with fixed rules; you find values the rules missed. Reply with JSON only:
{"fills":[{"slot":"<slot key>","value":<choice key, or a number in the slot unit>,"phrase":"<exact words copied from the latest message that say this>"}],"reply":"<one or two short Korean sentences: what you understood, or one practical tip. Do not ask a question; the app asks the next one.>"}
Slots: ${JSON.stringify(slots)}
Already filled: ${JSON.stringify(stChatFilled(R))}
Rules already read from this message: ${JSON.stringify(done.map(f => f.slot))} (do not repeat these).
Only fill what the latest message (read with the conversation) states or clearly implies. Convert units (cm to mm, L to mL, kg to g). Never invent numbers; a vague word such as "크게" may map to a typical value only when the person clearly asks for that. An empty fills list is fine.
The app asked: ${JSON.stringify(asked ? M2M_SLOTS[asked].ask : '')}
Conversation:
${conv}
Latest message: ${JSON.stringify(text)}`;
}
function stChatCard() {
  if (!stChatOK()) return '';
  const R = P.req, k = R ? stChatAsk() : null, S = k && M2M_SLOTS[k], pr = R ? m2mReqProgress(R) : { done: 0, total: 0 }, opt = R ? m2mReqMissing(R, true) : [];
  const msg = c => `<div class="chMsg ${c.role}"><b>${c.role === 'user' ? '나' : c.role === 'ai' ? 'AI' : '앱'}</b><div>${escH(c.text)}${c.read && c.read.length ? `<div class="chRead">${c.read.map(x => `<span class="chip">${escH(x)}</span>`).join('')}</div>` : ''}${c.bad && c.bad.length ? `<div class="hint" style="color:var(--bad)">범위 밖이라 넣지 않음: ${c.bad.map(escH).join(' / ')}</div>` : ''}${c.learned && c.learned.length ? `<div class="hint">배운 표현(다음부터 AI 없이 읽음): ${c.learned.map(escH).join(', ')}</div>` : ''}</div></div>`;
  return `<fieldset id="chCard"><legend>대화로 요청서 완성하기</legend>
    ${R ? `<div class="row" style="align-items:center;gap:8px"><div class="chBar"><i style="width:${pr.total ? 100 * pr.done / pr.total : 0}%"></i></div><span class="hint" style="margin:0">꼭 정할 칸 ${pr.done}/${pr.total}</span></div>` : `<p class="hint">만들고 싶은 것을 한 문장으로 쓰세요. 요청서를 만들고 빈 칸을 하나씩 물어볼게요.</p>`}
    ${(P.chat || []).length ? `<div id="chLog" class="chLog">${P.chat.map(msg).join('')}</div>` : ''}
    ${S ? `${(P.chat || []).length ? '' : `<p class="chAsk">${escH(S.ask)}</p>`}${S.cat ? `<div class="row" style="gap:6px">${S.choices().map(([v, l]) => `<button class="btn" data-act="chPick" data-k="${k}" data-v="${v}">${escH(l)}</button>`).join('')}</div>` : ''}` : ''}
    <div class="row" style="gap:6px;flex-wrap:nowrap"><input id="chIn" placeholder="${R ? '답을 쓰세요 (예: 3cm, 1초에 5번, 건전지 써도 돼요)' : '예: 총 모양이고 방아쇠를 당기면 비누방울이 나와야 해'}" style="flex:1;min-width:0"${stBusy ? ' disabled' : ''}><button class="btn primary" data-act="chSend"${stBusy ? ' disabled' : ''}>${stBusy ? 'AI가 읽는 중…' : '보내기'}</button>${S ? `<button class="btn" data-act="chSkip">상관없음</button>` : ''}</div>
    ${R && !k && opt.length ? `<div class="row" style="gap:6px;align-items:center"><span class="hint" style="margin:0">더 정하기:</span>${opt.map(o => `<button class="btn" data-act="chAskK" data-k="${o}">${escH(M2M_SLOTS[o].ko)}</button>`).join('')}</div>` : ''}
    ${R && !k && pr.total && pr.done === pr.total && m2mDecompose(R).ok ? `<div class="row"><button class="btn primary" data-go="2">기능 분해와 개념안 보기</button></div>` : ''}
    <p class="hint">${stAI ? `답은 먼저 규칙으로 읽고, 규칙이 못 읽은 말만 AI가 칸에 옮깁니다 ${stB('ai')}. <label class="chk"><input type="checkbox" id="chAI"${P.chatAI === false ? '' : ' checked'}> AI 함께 쓰기</label>` : '이 화면에서는 AI를 쓸 수 없어 규칙(낱말·숫자·단위)과 배운 표현으로만 읽습니다.'}</p>
    ${M2M_LEX.length ? `<details><summary>배운 표현 ${M2M_LEX.length}개</summary><p class="hint">AI가 칸에 옮긴 말 가운데 규칙이 못 읽던 표현입니다. 이 표현으로 읽은 값은 ${stB('ai')}로 표시됩니다.</p><table class="vt"><tbody>${M2M_LEX.map((l, i) => `<tr><td>“${escH(l.phrase)}”</td><td>${escH(M2M_SLOTS[l.slot] ? M2M_SLOTS[l.slot].ko : l.slot)}${l.value != null ? ' = ' + escH(M2M_SLOTS[l.slot] && M2M_SLOTS[l.slot].cat ? M2M_SLOTS[l.slot].show(l.value) : l.value + ' ' + (M2M_SLOTS[l.slot] || {}).unit) : ' (숫자 앞 낱말)'}</td><td><button class="btn" data-act="lexDel" data-i="${i}" aria-label="지우기">✕</button></td></tr>`).join('')}</tbody></table></details>` : ''}
  </fieldset>`;
}
$('stBody').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !P) return; const a = b.dataset.act;
  if (a === 'chSend') { const v = $('chIn').value; stChatSend(v); }
  else if (a === 'chSkip') stChatSend('상관없음');
  else if (a === 'chPick' && P.req) { const k = b.dataset.k, v = b.dataset.v; stChatPush('user', M2M_SLOTS[k].show(v)); m2mSlotSet(P.req, k, v, 'user'); if (P.req.kind !== 'product') P.req.kind = 'product';
    stChatPush('app', '읽은 것', { read: [m2mSlotText(k, v)] }); P.chatAsk = null; stChatQuestion(); stReqApply(); stRec = null; stSave(); stRender(); }
  else if (a === 'chAskK' && P.req) { P.chatAsk = b.dataset.k; stChatQuestion(); stSave(); stRender(); }
  else if (a === 'lexDel') { M2M_LEX.splice(+b.dataset.i, 1); stLS.set(ST_LEX_KEY, M2M_LEX); stRender(); }
});
$('stBody').addEventListener('keydown', e => { if (e.target.id === 'chIn' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); stChatSend(e.target.value); } });
$('stBody').addEventListener('change', e => { if (e.target.id === 'chAI' && P) { P.chatAI = e.target.checked; stSave(); } });
