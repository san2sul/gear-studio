// ===== 그림·사진·스케치로 요청서 만들기 =====
// 자료는 작게 줄여 P.media에 저장. AI(이미지 가능할 때)가 모양·부위·움직임·적힌 숫자를 요청서 칸으로 옮김(AI 추정).
// 칸 값 검사·완성 판단은 대화와 같은 규칙(M2M_SLOTS)이 함. AI가 없으면 첨부 자료로만 보관.
const SK_W = 800, SK_H = 480, MEDIA_MAX = 4;
let stSk = { strokes: [], tool: 'pen', cur: null }, stImgOK = null;
stAIP.then(async s => { try { stImgOK = !!(s && s.limits && (await s.limits()).images); } catch { stImgOK = false; } if (stStep === 1 && P) stRender(); });
const SK_TOOLS = [['pen', '펜'], ['line', '직선'], ['arrow', '움직임 화살표'], ['ref', '기준선'], ['erase', '지우개']];
function stMediaCard() {
  if (P && P.req && !stIsProd()) return '';
  const M = (P && P.media) || [], ai = stAI && stImgOK;
  return `<fieldset id="mdCard"><legend>그림·사진·스케치로 설명하기</legend>
    <p class="hint">모양, 부위, 움직이는 방향(화살표), 치수를 그림으로 보여 주세요. 스케치에 <b>기준선</b>을 긋고 실제 길이를 적으면 다른 치수를 그 비율로 어림합니다.</p>
    <div class="row" style="gap:4px;flex-wrap:wrap">${SK_TOOLS.map(([k, l]) => `<button class="btn${stSk.tool === k ? ' primary' : ''}" data-act="skTool" data-k="${k}" aria-pressed="${stSk.tool === k}">${l}</button>`).join('')}
      <button class="btn" data-act="skUndo" aria-label="되돌리기">↶</button><button class="btn" data-act="skClear">모두 지우기</button></div>
    <canvas id="skCv" width="${SK_W}" height="${SK_H}" style="width:100%;aspect-ratio:${SK_W}/${SK_H};touch-action:none;background:#fff;border:1px solid var(--line);border-radius:8px;cursor:crosshair" aria-label="스케치 판"></canvas>
    <div class="row" style="gap:6px;align-items:center;flex-wrap:nowrap"><label class="hint" style="margin:0;white-space:nowrap">기준선 길이</label><input id="skRefMm" type="number" step="any" min="1" placeholder="mm" value="${escH(stSk.refMm || '')}" style="width:72px"><span class="u">mm</span>
      <button class="btn primary" data-act="skSave" style="margin-left:auto">스케치 넣기</button></div>
    <div class="row" style="gap:6px;align-items:center"><label class="btn" style="cursor:pointer">사진·그림 올리기<input id="mdFile" type="file" accept="image/*" multiple style="display:none"></label><span class="hint" style="margin:0">최대 ${MEDIA_MAX}개, 긴 변 1024 px로 줄여 저장</span></div>
    ${M.length ? `<div class="mdGrid">${M.map((m, i) => `<figure class="mdItem"><img src="${m.src}" alt="${escH(m.kind === 'sketch' ? '스케치' : m.name || '올린 그림')}"><figcaption><input data-md="${i}" value="${escH(m.note || '')}" placeholder="설명 (예: 옆에서 본 모습)"><button class="btn" data-act="mdDel" data-i="${i}" aria-label="지우기">✕</button></figcaption>${m.refMm ? `<span class="hint">기준선 ${m.refMm} mm</span>` : ''}</figure>`).join('')}</div>` : ''}
    ${M.length ? (ai ? `<div class="row"><button class="btn primary" data-act="mdAI"${stBusy ? ' disabled' : ''}>${stBusy ? 'AI가 그림을 읽는 중…' : 'AI로 그림 해석해 요청서 채우기'}</button></div>
      <p class="hint">AI가 읽은 값은 ${stB('ai')}로 표시되고, 범위 밖이면 넣지 않습니다. 사진 속 크기는 기준이 없으면 어림이라, 빈 칸과 함께 대화에서 다시 물어요.</p>`
      : `<p class="hint">이 화면에서는 AI가 그림을 읽을 수 없어 ${stB('none')}, 그림은 요청서의 첨부 자료로만 남습니다. 내용은 위 대화나 글로 적어 주세요.</p>`) : ''}
  </fieldset>`;
}
// ---- 스케치 판 ----
function skDraw() {
  const cv = $('skCv'); if (!cv) return; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, SK_W, SK_H);
  for (const s of stSk.strokes.concat(stSk.cur ? [stSk.cur] : [])) skStroke(g, s);
}
function skStroke(g, s) {
  const p = s.pts; if (!p.length) return; g.lineCap = 'round'; g.lineJoin = 'round';
  const col = s.tool === 'ref' ? '#d0342c' : s.tool === 'arrow' ? '#1f6fd1' : s.tool === 'erase' ? '#fff' : '#1b232b';
  g.strokeStyle = col; g.fillStyle = col; g.lineWidth = s.tool === 'erase' ? 18 : s.tool === 'pen' ? 3 : 3.5;
  g.beginPath(); g.moveTo(p[0][0], p[0][1]);
  if (s.tool === 'pen' || s.tool === 'erase') for (const q of p) g.lineTo(q[0], q[1]); else g.lineTo(p.at(-1)[0], p.at(-1)[1]);
  g.stroke();
  const a = p[0], b = p.at(-1), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  if (s.tool === 'arrow' && Math.hypot(b[0] - a[0], b[1] - a[1]) > 8) { g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[0] - 16 * Math.cos(ang - 0.45), b[1] - 16 * Math.sin(ang - 0.45)); g.lineTo(b[0] - 16 * Math.cos(ang + 0.45), b[1] - 16 * Math.sin(ang + 0.45)); g.closePath(); g.fill(); }
  if (s.tool === 'ref') { for (const q of [a, b]) { g.beginPath(); g.moveTo(q[0] - 8 * Math.sin(ang), q[1] + 8 * Math.cos(ang)); g.lineTo(q[0] + 8 * Math.sin(ang), q[1] - 8 * Math.cos(ang)); g.stroke(); }
    if (stSk.refMm) { g.font = '600 18px sans-serif'; g.fillText(`${stSk.refMm} mm`, (a[0] + b[0]) / 2 + 8, (a[1] + b[1]) / 2 - 10); } }
}
function skPos(e) { const cv = $('skCv'), r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * SK_W / r.width, (e.clientY - r.top) * SK_H / r.height]; }
$('stBody').addEventListener('pointerdown', e => { if (e.target.id !== 'skCv') return; e.preventDefault(); e.target.setPointerCapture(e.pointerId);
  if (stSk.tool === 'ref') stSk.strokes = stSk.strokes.filter(s => s.tool !== 'ref');   // 기준선은 하나만
  stSk.cur = { tool: stSk.tool, pts: [skPos(e)] }; skDraw(); });
$('stBody').addEventListener('pointermove', e => { if (e.target.id !== 'skCv' || !stSk.cur) return; const q = skPos(e);
  if (stSk.cur.tool === 'pen' || stSk.cur.tool === 'erase') stSk.cur.pts.push(q); else stSk.cur.pts[1] = q; skDraw(); });
const skEnd = e => { if (!stSk.cur) return; if (stSk.cur.pts.length > 1 || stSk.cur.tool === 'pen') stSk.strokes.push(stSk.cur); stSk.cur = null; skDraw(); };
$('stBody').addEventListener('pointerup', skEnd); $('stBody').addEventListener('pointercancel', skEnd);
// 그림 줄이기: 긴 변 1024 px, JPEG(사진) 또는 PNG(스케치)
function mdShrink(src, png) { return new Promise((ok, no) => { const im = new Image(); im.onload = () => { const k = Math.min(1, 1024 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.82)); }; im.onerror = () => no(new Error('그림을 읽지 못했습니다')); im.src = src; }); }
function mdBlob(src) { const [h, b] = src.split(','), bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: h.slice(5, h.indexOf(';')) }); }
function mdAdd(m) { if (!P) P = stNew(); P.media = (P.media || []).concat([{ id: 'm' + Date.now().toString(36), at: new Date().toISOString(), ...m }]).slice(-MEDIA_MAX); stLog('그림 자료 추가'); stSave(); }
async function stMediaAI() {
  if (!stAI || !stImgOK || stBusy || !(P.media || []).length) return; stBusy = true; stRender();
  let R = P.req; const fresh = !R || !stIsProd();
  const slots = Object.fromEntries(Object.entries(M2M_SLOTS).filter(([k, S]) => S.cat || !R || m2mSlotOn(R, k)).map(([k, S]) => [k, S.cat ? { ko: S.ko, choices: S.choices().map(c => c[0]) } : { ko: S.ko, unit: S.unit, range: S.range }]));
  const notes = P.media.map((m, i) => `image ${i + 1}: ${m.kind === 'sketch' ? 'hand sketch' : 'uploaded picture'}${m.note ? ' — ' + m.note : ''}${m.refMm ? ` — the red reference line is ${m.refMm} mm long` : ''}`).join('\n');
  const prompt = `You look at pictures and sketches of a small product a person wants to 3D-print and build, and fill a request form. Reply with JSON only:
{"summary":"<one Korean sentence describing the product and what it should do, in plain words>","fills":[{"slot":"<slot key>","value":<choice key or number in the slot unit>,"phrase":"<short Korean note on where in the picture you saw it>"}],"parts":[{"name":"<Korean part name seen in the picture>","link":one of ${JSON.stringify(Object.keys(M2M_PLINKS))} or "","motion":one of ${JSON.stringify(Object.keys(M2M_MOTIONS))} or "none"}],"reply":"<one or two Korean sentences: what you understood and what is unclear>"}
Slots: ${JSON.stringify(slots)}
Pictures:
${notes}
Blue arrows in sketches mean motion; a red line with end ticks is a reference length. Read numbers written in the pictures. Only give sizes you can read or measure against the reference line; never guess a size without a reference. Leave out what you cannot see.${R ? `\nAlready in the form: ${JSON.stringify(stChatFilled(R))}` : ''}`;
  let r = null;
  try { r = await stAI.json(prompt, { modelTier: 'default', images: P.media.map(m => mdBlob(m.src)) }) || {}; }
  catch (e) { stBusy = false; toast(e && e.code === 'not_granted' ? 'AI 사용을 허락하지 않아 그림을 읽지 못했습니다' : 'AI가 그림을 읽지 못했습니다'); stRender(); return; }
  if (fresh) { const t = String(r.summary || '').slice(0, 300) || '그림으로 설명한 제품'; const N = m2mRequest(t), S = N.spec; delete N.spec; const toAI = o => { if (o && typeof o === 'object') for (const k in o) { if (k === 'source' && o[k] === 'user') o[k] = 'ai'; else toAI(o[k]); } }; toAI(N); toAI(S); N.kind = 'product'; P.spec = S; P.req = R = N; P.chat = []; P.chatAsk = null; stChatPush('app', `그림에서 읽은 설명: “${t}”`); }
  const fills = (Array.isArray(r.fills) ? r.fills : []).filter(f => f && M2M_SLOTS[f.slot]).map(f => { const v = M2M_SLOTS[f.slot].cat ? String(f.value) : +f.value; return { slot: f.slot, value: v, phrase: String(f.phrase || ''), how: 'ai', err: m2mSlotCheck(f.slot, v) }; });
  const done = m2mApplyFound(R, fills, 'ai');
  const added = [];
  for (const q of Array.isArray(r.parts) ? r.parts.slice(0, 12) : []) { const name = String(q.name || '').trim().slice(0, 30); if (!name) continue; R.parts = R.parts || [];
    const link = M2M_PLINKS[q.link] ? q.link : '', ex = R.parts.find(p => link && p.link === link || p.name === name);
    const mo = M2M_MOTIONS[q.motion] ? q.motion : null;
    if (ex) { if (mo && !ex.motions.length) ex.motions.push({ kind: mo, when: '', traits: {}, source: 'ai' }); continue; }
    R.parts.push({ id: 'pt' + Date.now().toString(36) + added.length, name, link, source: 'ai', specs: [], motions: mo ? [{ kind: mo, when: '', traits: {}, source: 'ai' }] : [] }); added.push(name); }
  const bad = fills.filter(f => f.err).map(f => `${M2M_SLOTS[f.slot].ko} ${f.value}: ${f.err}`);
  stChatPush('ai', String(r.reply || '').slice(0, 300), { read: done.map(f => m2mSlotText(f.slot, f.value) + (f.phrase ? ` (${f.phrase.slice(0, 40)})` : '')).concat(added.map(n => '부위: ' + n)), bad });
  stLog('AI 그림 해석'); stBusy = false; stChatQuestion(); stReqApply(); stRec = null; stSave(); stRender();
  const c = $('chCard'); if (c) c.scrollIntoView({ block: 'start' });
  if (stIsProd()) stSuggest(true);
}
$('stBody').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return; const a = b.dataset.act;
  if (a === 'skTool') { stSk.tool = b.dataset.k; stRender(); }
  else if (a === 'skUndo') { stSk.strokes.pop(); skDraw(); }
  else if (a === 'skClear') { stSk.strokes = []; skDraw(); }
  else if (a === 'skSave') { if (!stSk.strokes.some(s => s.tool !== 'erase')) { toast('먼저 그림을 그려 주세요'); return; }
    const ref = stSk.strokes.some(s => s.tool === 'ref'), mm = parseFloat($('skRefMm').value); if (ref && !(mm > 0)) { toast('기준선의 실제 길이(mm)를 적어 주세요'); $('skRefMm').focus(); return; }
    stSk.refMm = ref ? mm : ''; skDraw(); const src = await mdShrink($('skCv').toDataURL('image/png'), true); mdAdd({ kind: 'sketch', src, refMm: ref ? mm : null }); stSk.strokes = []; stSk.refMm = ''; stRender(); toast('스케치를 넣었습니다'); }
  else if (a === 'mdDel' && P) { P.media.splice(+b.dataset.i, 1); stSave(); stRender(); }
  else if (a === 'mdAI' && P) stMediaAI();
});
$('stBody').addEventListener('change', async e => {
  const el = e.target;
  if (el.id === 'skRefMm') { stSk.refMm = parseFloat(el.value) > 0 ? +el.value : ''; skDraw(); return; }
  if (el.dataset && el.dataset.md && P && P.media) { const m = P.media[+el.dataset.md]; if (m) { m.note = el.value.slice(0, 120); stSave(); } return; }
  if (el.id === 'mdFile') { const fs = [...el.files].slice(0, MEDIA_MAX); for (const f of fs) { if (!/^image\//.test(f.type)) continue;
      try { const src = await mdShrink(URL.createObjectURL(f), /png|gif/.test(f.type)); mdAdd({ kind: 'upload', src, name: f.name.slice(0, 60) }); } catch (err) { toast(err.message); } }
    stRender(); }
});
// ===== AI 보강 제안 =====
// AI는 빠진 것, 서로 맞지 않는 값, 출력·조립·안전에 어려운 점을 '제안'으로만 냄. 사람이 받아들일 때만 요청서에 들어감.
// 값 제안은 앱이 칸 범위로 다시 검사하고, 범위 밖이면 버림. 글 요구사항(note)은 설계 계산에 아직 쓰이지 않음(미검증).
function stSuggCard() {
  if (!P || !P.req || !stIsProd()) return '';
  const R = P.req, L = P.sugg || [], open = L.filter(x => x.state === 'open'), N = R.notes || [];
  if (!stAI && !L.length && !N.length) return '';
  const what = x => x.kind === 'value' ? `${M2M_SLOTS[x.slot].ko}: ${(() => { const c = m2mSlotGet(R, x.slot); return c && c.value != null && c.value !== '' ? escH(String(M2M_SLOTS[x.slot].cat ? M2M_SLOTS[x.slot].show(c.value) : c.value)) + ' → ' : '비어 있음 → '; })()}<b>${escH(M2M_SLOTS[x.slot].cat ? M2M_SLOTS[x.slot].show(x.value) : x.value + ' ' + M2M_SLOTS[x.slot].unit)}</b>`
    : x.kind === 'part' ? `부위 추가: <b>${escH(x.name)}</b>` : `요구사항 추가: <b>${escH(x.text)}</b>`;
  return `<fieldset id="sgCard"><legend>AI 보강 제안</legend>
    <p class="hint">그림·글·지금 요청서를 보고 AI가 빠진 것, 맞지 않는 값, 출력·조립·안전에서 어려운 점을 제안합니다. <b>받아들이기</b>를 눌러야 요청서에 들어가고 ${stB('ai')}로 표시됩니다. 값은 앱이 범위를 다시 검사합니다.</p>
    ${open.length ? `<ul class="sgList">${L.map((x, i) => x.state !== 'open' ? '' : `<li><div>${what(x)}<div class="hint" style="margin:2px 0 0">${escH(x.why || '')}</div></div><span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn primary" data-act="sgTake" data-i="${i}">받아들이기</button><button class="btn" data-act="sgNo" data-i="${i}">아니요</button></span></li>`).join('')}</ul>
      ${open.length > 1 ? `<div class="row"><button class="btn" data-act="sgAll">모두 받아들이기</button></div>` : ''}` : L.length ? '<p class="hint">남은 제안이 없어요.</p>' : ''}
    ${N.length ? `<p class="hint" style="margin-bottom:2px">덧붙인 요구사항 ${stB('unv')} <span>(설계 계산에는 아직 쓰이지 않아요. 상세 설계·시험에서 확인)</span></p><ul class="sgNotes">${N.map((n, i) => `<li>${escH(n.text)} ${srcB(n.source)} <button class="btn" data-act="sgNoteDel" data-i="${i}" aria-label="지우기">✕</button></li>`).join('')}</ul>` : ''}
    ${stAI ? `<div class="row"><button class="btn" data-act="sgAsk"${stBusy ? ' disabled' : ''}>${stBusy ? 'AI가 살펴보는 중…' : L.length ? '다시 제안 받기' : '요청서 보강 제안 받기'}</button></div>` : ''}
  </fieldset>`;
}
function stSuggPrompt(R, withImg) {
  const filled = stChatFilled(R), miss = m2mReqMissing(R).concat(m2mReqMissing(R, true)).map(k => k + ' (' + M2M_SLOTS[k].ko + ')');
  const slots = Object.fromEntries(Object.entries(M2M_SLOTS).filter(([k, S]) => S.cat || m2mSlotOn(R, k)).map(([k, S]) => [k, S.cat ? { ko: S.ko, choices: S.choices().map(c => c[0]) } : { ko: S.ko, unit: S.unit, range: S.range }]));
  return `You review a request form for a small product that a hobbyist will 3D-print (FDM, PLA) and assemble at home with small DC motors and AA batteries. Suggest how to make the request more complete and more likely to become a working product. Reply with JSON only:
{"items":[{"kind":"value","slot":"<slot key>","value":<choice key or number in slot unit>,"why":"<one short Korean sentence>"} | {"kind":"part","name":"<Korean part name>","link":one of ${JSON.stringify(Object.keys(M2M_PLINKS))} or "","why":"..."} | {"kind":"note","text":"<short Korean requirement, under 60 characters>","why":"..."}]}
At most 6 items, most useful first. Look for: important empty slots with a sensible value; values that conflict with each other or with the pictures; things hard to print or assemble; safety for children (pinch points, liquid near electronics, battery access); missing everyday needs (refilling, cleaning, switching off). Do not repeat values already in the form unless you suggest changing them. Do not calculate gear ratios or forces; the app does that.
Slots: ${JSON.stringify(slots)}
Product description: ${JSON.stringify((P.spec && P.spec.text) || '')}
Filled: ${JSON.stringify(filled)}
Empty: ${JSON.stringify(miss)}
Parts: ${JSON.stringify((R.parts || []).map(p => p.name))}
Extra requirements: ${JSON.stringify((R.notes || []).map(n => n.text))}${withImg ? '\nThe attached pictures are the person\'s own drawings or photos of the product (blue arrows = motion, red line = reference length).' : ''}`;
}
async function stSuggest(withImg) {
  if (!stAI || stBusy || !P || !P.req || !stIsProd()) return; const R = P.req, imgs = withImg && stImgOK && (P.media || []).length ? P.media.map(m => mdBlob(m.src)) : null;
  stBusy = true; stRender(); let r;
  try { r = await stAI.json(stSuggPrompt(R, !!imgs), imgs ? { modelTier: 'default', images: imgs } : { modelTier: 'default' }) || {}; }
  catch (e) { stBusy = false; toast(e && e.code === 'not_granted' ? 'AI 사용을 허락하지 않아 제안을 받지 못했습니다' : 'AI가 제안을 만들지 못했습니다'); stRender(); return; }
  stBusy = false; P.sugg = stSuggClean(R, r.items); stLog('AI 보강 제안 ' + P.sugg.length + '개'); stSave(); stRender();
  const c = $('sgCard'); if (c) c.scrollIntoView({ block: 'nearest' });
}
// AI 답 정리: 모르는 칸·범위 밖 값·이미 같은 값·빈 글은 버림
function stSuggClean(R, items) {
  const out = [];
  for (const x of Array.isArray(items) ? items.slice(0, 8) : []) { if (!x) continue; const why = String(x.why || '').slice(0, 160);
    if (x.kind === 'value' && M2M_SLOTS[x.slot]) { const S = M2M_SLOTS[x.slot], v = S.cat ? String(x.value) : +x.value; if (m2mSlotCheck(x.slot, v)) continue;
      if (!S.cat && !m2mSlotOn(R, x.slot)) continue; const c = m2mSlotGet(R, x.slot); if (c && c.value === v) continue; out.push({ kind: 'value', slot: x.slot, value: v, why, state: 'open' }); }
    else if (x.kind === 'part' && String(x.name || '').trim()) { const name = String(x.name).trim().slice(0, 30); if ((R.parts || []).some(p => p.name === name)) continue; out.push({ kind: 'part', name, link: M2M_PLINKS[x.link] ? x.link : '', why, state: 'open' }); }
    else if (x.kind === 'note' && String(x.text || '').trim()) out.push({ kind: 'note', text: String(x.text).trim().slice(0, 80), why, state: 'open' }); }
  return out.slice(0, 6);
}
function stSuggTake(x) {
  const R = P.req; if (x.state !== 'open') return '';
  if (x.kind === 'value') { if (m2mSlotCheck(x.slot, x.value)) { x.state = 'no'; return ''; } m2mApplyFound(R, [{ slot: x.slot, value: x.value, how: 'ai' }], 'ai', true); }
  else if (x.kind === 'part') { R.parts = R.parts || []; R.parts.push({ id: 'pt' + Date.now().toString(36) + R.parts.length, name: x.name, link: x.link, source: 'ai', specs: [], motions: [] }); }
  else R.notes = (R.notes || []).concat([{ text: x.text, source: 'ai' }]);
  x.state = 'took'; return x.kind === 'value' ? m2mSlotText(x.slot, x.value) : x.kind === 'part' ? '부위: ' + x.name : '요구사항: ' + x.text;
}
function stSuggDone(took) {
  if (took.length) { stChatPush('app', '보강 제안을 요청서에 넣었어요.', { read: took }); if (P.chatAsk && !stChatAsk()) stChatQuestion(); else if (P.chatAsk && stChatAsk() !== P.chatAsk) stChatQuestion(); }
  stLog('보강 제안 반영'); stReqApply(); stRec = null; stSave(); stRender();
}
$('stBody').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !P) return; const a = b.dataset.act, L = P.sugg || [];
  if (a === 'sgAsk') stSuggest(true);
  else if (a === 'sgTake') { const x = L[+b.dataset.i]; if (x) stSuggDone([stSuggTake(x)].filter(Boolean)); }
  else if (a === 'sgAll') stSuggDone(L.map(stSuggTake).filter(Boolean));
  else if (a === 'sgNo') { const x = L[+b.dataset.i]; if (x) { x.state = 'no'; stSave(); stRender(); } }
  else if (a === 'sgNoteDel' && P.req && P.req.notes) { P.req.notes.splice(+b.dataset.i, 1); stSave(); stRender(); }
});
