/* ---- 규격 부품 ---- */
let stdCur = null, stdBasket = [];
const stdOpt = o => Array.isArray(o) ? o : [o, o];
function renderStd() {
  if (!stdCur) stdCur = { cat: 'bolt', p: {} };
  const groups = {}; Object.entries(STD).forEach(([k, S]) => (groups[S.g] = groups[S.g] || []).push([k, S.t]));
  $('stdCat').innerHTML = Object.entries(groups).map(([g, L]) => `<optgroup label="${g}">${L.map(([k, t]) => `<option value="${k}"${k === stdCur.cat ? ' selected' : ''}>${t}</option>`).join('')}</optgroup>`).join('');
  const S = STD[stdCur.cat];
  S.f.forEach(([k, , v]) => { if (stdCur.p[k] === undefined) stdCur.p[k] = v; });
  Object.keys(stdCur.p).forEach(k => { if (!S.f.some(f => f[0] === k)) delete stdCur.p[k]; });
  $('stdFields').innerHTML = S.f.map(([k, lab, , o]) => Array.isArray(o)
    ? `<label class="f">${lab}<select data-k="${k}">${o.map(x => { const [v, t] = stdOpt(x); return `<option value="${v}"${String(stdCur.p[k]) === String(v) ? ' selected' : ''}>${t}</option>`; }).join('')}</select></label>`
    : `<label class="f">${lab} <span class="u">${o}</span><input type="number" data-k="${k}" value="${stdCur.p[k]}" min="0.5" step="0.5"></label>`).join('');
  $('stdNote').textContent = S.note || '';
  $('stdFields').querySelectorAll('[data-k]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
    stdCur.p[el.dataset.k] = el.tagName === 'SELECT' ? el.value : +el.value; clearTimeout(stdT); stdT = setTimeout(stdPreview, 300); }));
  $('stdList').innerHTML = stdBasket.length ? stdBasket.map((it, i) => `<div class="alt" style="cursor:default"><span class="pill">×${it.n}</span><span>${STD[it.cat].t} · ${Object.entries(it.p).map(([k, v]) => { const f = STD[it.cat].f.find(q => q[0] === k), o = f && f[3]; return Array.isArray(o) ? stdOpt(o.find(x => String(stdOpt(x)[0]) === String(v)) || v)[1] : v + (o && o !== '개' ? ' ' + o : ''); }).join(' · ')}</span><button class="btn" data-del="${i}">빼기</button></div>`).join('') : '<p class="hint">아직 담은 부품이 없습니다.</p>';
  $('stdList').querySelectorAll('[data-del]').forEach(b => b.onclick = () => { stdBasket.splice(+b.dataset.del, 1); renderStd(); });
}
let stdT = 0;
function stdItem() { return { cat: stdCur.cat, p: { ...stdCur.p }, n: Math.max(1, Math.round(num('stdN')) || 1) }; }
function stdPreview() { try { setDesign({ kind: 'std', items: [stdItem()] }); } catch (e) { toast('이 치수로는 만들 수 없습니다'); } }
function stdZipOf(items, name) {
  const M = buildModel({ kind: 'std', items }), files = [], enc = t => new TextEncoder().encode(t.replace(/\r?\n/g, '\r\n'));
  M.parts.forEach(p => files.push({ name: `parts/${p.file}${p.n > 1 ? '_x' + p.n : ''}.stl`, data: stlBinary(p.tris, p.file) }));
  files.push({ name: 'std_parts.scad', data: M.scad() });
  files.push({ name: 'README.txt', data: enc(['규격 부품 출력 모형', '', '파일 이름의 _xN은 출력할 개수입니다. 바닥 z=0으로 출력 방향에 놓여 있습니다.', '실제 부품을 사기 전에 구멍·길이·자리·조립 순서를 시험하는 모형입니다. 힘을 받는 곳에는 진짜 부품을 쓰세요.', '', ...M.parts.map(p => `- ${p.file}: ${p.name} ×${p.n}`), '', ...M.notes.map(n => '- ' + n)].join('\n')) });
  saveFile(name, makeZip(files));
}
$('tabStd').onclick = () => selectTab('std');
$('stdCat').onchange = () => { stdCur = { cat: $('stdCat').value, p: {} }; renderStd(); stdPreview(); };
$('stdN').oninput = () => {};
$('stdAdd').onclick = () => { stdBasket.push(stdItem()); renderStd(); toast('목록에 담았습니다'); };
$('stdOne').onclick = () => { const it = stdItem(), M = buildModel({ kind: 'std', items: [it] });
  if (M.parts.length === 1) saveFile(`${M.parts[0].file}.stl`, stlBinary(M.parts[0].tris, M.parts[0].file)); else stdZipOf([it], `${it.cat}.zip`); };
$('stdZip').onclick = () => { if (!stdBasket.length) return toast('먼저 부품을 목록에 담으세요'); stdZipOf(stdBasket, 'standard_parts.zip'); };
$('stdShow').onclick = () => { if (!stdBasket.length) return toast('먼저 부품을 목록에 담으세요'); setDesign({ kind: 'std', items: stdBasket.slice() }); };
$('stdClear').onclick = () => { stdBasket = []; renderStd(); };