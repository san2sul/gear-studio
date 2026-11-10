/* ---- 자유 조립 ---- */
let tD = null, tTimer = 0;
const OPP = { '+x': '-x', '-x': '+x', '+y': '-y', '-y': '+y', '+z': '-z', '-z': '+z' };
const esc = v => String(v ?? '').replace(/"/g, '&quot;');
// 각 단이 만드는 축 S(k+1)의 방향
function shaftAxes(D) {
  const ax = [D.input.axis];
  D.stages.forEach(st => { const f = ax[+st.from] || ax[0]; ax.push(st.type === 'bevel' ? st.dir : f); });
  return ax;
}
function normalizeTrain(D) {
  D.stages.forEach((st, k) => {
    if (!(+st.from >= 0 && +st.from <= k)) st.from = k;
    const ax = shaftAxes(D)[+st.from];
    if (st.type === 'bevel') { if (!perpAxes(ax).includes(st.dir)) st.dir = perpAxes(ax)[0]; if (st.apex !== '-') st.apex = '+'; st.idler = false; }
    if (st.idler && (+st.from === 0 || D.stages[+st.from - 1].type !== 'spur')) st.idler = false;
  });
  D.supports = D.supports || {}; D.supports.walls = D.supports.walls || []; D.supports.skip = D.supports.skip || [];
}
function stageCard(st, k, ax) {
  const fromAx = ax[+st.from], bev = st.type === 'bevel';
  const opt = (v, t, cur) => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${t}</option>`;
  const fromOpts = ax.slice(0, k + 1).map((a, i) => opt(i, `S${i} (${AXIS_KO[a]} 축)`, st.from)).join('');
  const [u] = AXIS_UV[fromAx];
  const f = (key, label, val, attrs = '') => `<label class="f">${label}<input type="number" data-k="${key}" value="${esc(val)}" ${attrs}></label>`;
  return `<div class="stcard" data-i="${k}">
    <header><b>${k + 1}단 · ${bev ? '베벨기어' : '평기어'}</b><span class="pill">S${st.from} → S${k + 1}</span><span class="sp"></span><button class="x" data-act="del" aria-label="${k + 1}단 삭제">삭제</button></header>
    <div class="grid2">
      <label class="f">출발 축<select data-k="from">${fromOpts}</select></label>
      ${f('m', '모듈 m <span class="u">mm</span>', st.m, 'min="0.3" step="0.25"')}
    </div>
    <div class="grid3">
      ${f('zA', `구동 잇수 (S${st.from})`, st.zA, `min="5" step="1"${st.idler ? ' disabled' : ''}`)}
      ${f('zB', `피동 잇수 (S${k + 1})`, st.zB, 'min="5" step="1"')}
      ${bev ? f('b', '이 폭 F <span class="u">0=자동</span>', st.b, 'min="0" step="0.5"') : f('b', '이 폭 b <span class="u">mm</span>', st.b, 'min="1" step="0.5"')}
    </div>
    <div class="grid3">
      ${bev
        ? `<label class="f">새 축 방향<select data-k="dir">${perpAxes(fromAx).map(a => opt(a, AXIS_KO[a], st.dir)).join('')}</select></label>
           <label class="f">맞물림 쪽<select data-k="apex">${opt('+', AXIS_KO[fromAx] + ' 쪽', st.apex)}${opt('-', AXIS_KO[OPP[fromAx]] + ' 쪽', st.apex)}</select></label>`
        : `${f('angle', `방향 각도 <span class="u">° (0=${AXIS_KO[u]})</span>`, st.angle ?? 0, 'step="15"')}
           <label class="f">층 쌓기<select data-k="stack">${opt('+', AXIS_KO[fromAx] + ' 쪽', st.stack)}${opt('-', AXIS_KO[OPP[fromAx]] + ' 쪽', st.stack)}</select></label>`}
      ${f('offset', '층 간격 추가 <span class="u">mm</span>', st.offset ?? 0, 'step="0.5"')}
    </div>
    ${bev ? `<div class="grid3"><label class="f">층 쌓기<select data-k="stack">${opt('+', AXIS_KO[fromAx] + ' 쪽', st.stack)}${opt('-', AXIS_KO[OPP[fromAx]] + ' 쪽', st.stack)}</select></label>
      ${f('hub', '허브 <span class="u">mm</span>', st.hub ?? 4, 'min="0" step="0.5"')}
      ${f('sd', '층 위치 s <span class="u">빈칸=자동</span>', st.sd ?? '', 'step="0.5"')}</div>
      <div class="grid2">${f('spiral', '스파이럴 나선각 <span class="u">° 0=직선</span>', st.spiral ?? 0, 'min="-40" max="40" step="5"')}<span></span></div>`
      : `<div class="grid2"><label class="chk" style="align-self:end;padding-bottom:6px"><input type="checkbox" data-k="internal"${st.internal ? ' checked' : ''}${st.idler ? ' disabled' : ''}> 피동을 링(내접) 기어로</label>
      ${st.internal ? `<label class="f">링 받침판 쪽<select data-k="web">${opt('-', AXIS_KO[OPP[fromAx]] + ' 쪽', st.web || '-')}${opt('+', AXIS_KO[fromAx] + ' 쪽', st.web || '-')}</select></label>` : '<span></span>'}</div>
      <div class="grid2">${f('helix', '나선각 β <span class="u">° 0=평</span>', st.helix ?? 0, `min="-45" max="45" step="5"${st.idler ? ' disabled' : ''}`)}
      <label class="chk" style="align-self:end;padding-bottom:6px"><input type="checkbox" data-k="herring"${st.herring ? ' checked' : ''}${st.idler ? ' disabled' : ''}> 헤링본 (V자)</label></div>
      <div class="grid2">${f('sd', '층 위치 s <span class="u">빈칸=자동</span>', st.sd ?? '', 'step="0.5"')}
      <label class="chk" style="align-self:end;padding-bottom:6px"><input type="checkbox" data-k="idler"${st.idler ? ' checked' : ''}${+st.from === 0 ? ' disabled' : ''}> S${st.from}의 피동 기어로 바로 구동</label></div>`}
  </div>`;
}
function goalFromBox() {
  const r = Math.max(0.1, num('bRatio') || 1), f = func;
  if (f === 'rightangle') return { func: r >= 1 ? 'reduce' : 'increase', ratio: +(r >= 1 ? r : 1 / r).toFixed(3), dir: 'any', tol: num('bTol') || 3 };
  return { func: f === 'planetary' ? 'reduce' : f, ratio: r, dir: f === 'reverse' ? 'opposite' : $('bDir').value, tol: num('bTol') || 3 };
}
function renderGoalForm() {
  const g = tD.goal || (tD.goal = { func: 'none', ratio: 5, dir: 'any', tol: 3 });
  $('tgFunc').value = g.func; $('tgRatio').value = g.ratio; $('tgDir').value = g.dir; $('tgTol').value = g.tol;
  const hasR = g.func === 'reduce' || g.func === 'increase', hasD = g.func !== 'reverse' && g.func !== 'none';
  $('tgRatioW').style.opacity = hasR ? 1 : 0.4; $('tgRatio').disabled = !hasR; $('tgDirW').style.opacity = hasD ? 1 : 0.4; $('tgDir').disabled = !hasD;
  $('tgRatioU').textContent = g.func === 'increase' ? '출력이 n배 빠름' : '입력 : 출력 = n : 1';
  $('tFit').disabled = g.func === 'none';
  $('tTorque').value = tD.torque ?? 10; $('tRev').checked = !!tD.reverse;
  const on = !!(tD.enclose && tD.enclose.on); $('tEnc').checked = on;
  let info = '켜면 기어박스 탭에서 고른 공간 모양·크기 안에 기어열을 가장 넉넉한 자리에 넣고, 바닥판을 공간 모양에 맞추고, 하우징과 축 구멍을 만듭니다.';
  if (on) { const P = boxParams(), why = P.shape === 'poly' ? polyProblem(P.pts, P.wall) : '';
    info = why ? '기어박스 탭의 외곽선에 문제가 있어 공간에 넣지 못했습니다: ' + why : `지금 공간: ${shapeTxt(P._box)}${P.fixIn ? ` · 입력축 고정 (${fmt(P.fixIn[0], 1)}, ${fmt(P.fixIn[1], 1)})` : ''}. 결과는 아래 검사 결과에 나옵니다.`; }
  $('tEncInfo').textContent = info;
}
function renderTrainForm() {
  normalizeTrain(tD);
  renderGoalForm();
  $('tRpm').value = tD.rpm; $('tPa').value = tD.pa; $('tBl').value = tD.backlash; $('tShaft').value = tD.shaftD; $('tGap').value = tD.gap; $('tClear').value = tD.clear;
  $('tAxis').innerHTML = Object.keys(AXIS_KO).map(a => `<option value="${a}"${a === tD.input.axis ? ' selected' : ''}>${AXIS_KO[a]} ${a === '+z' ? '(위로 선 축)' : a[1] === 'z' ? '' : '(누운 축)'}</option>`).join('');
  const ax = shaftAxes(tD);
  $('stList').innerHTML = tD.stages.map((st, k) => stageCard(st, k, ax)).join('') || '<p class="hint">단이 없습니다. 아래에서 추가하세요.</p>';
  $('tBase').checked = tD.supports.base !== false; $('tEnds').checked = tD.supports.ends !== false;
  $('wallList').innerHTML = tD.supports.walls.map((w, i) => `<div class="wallrow" data-w="${i}">
    <label class="f">벽 ${i + 1} 면<select data-k="normal">${['x', 'y', 'z'].map(n => `<option value="${n}"${n === w.normal ? ' selected' : ''}>${n.toUpperCase()} (${n === 'z' ? '선반' : '세운 벽'})</option>`).join('')}</select></label>
    <label class="f">위치 <span class="u">${w.normal.toUpperCase()} = mm</span><input type="number" data-k="pos" value="${esc(w.pos)}" step="1"></label>
    <button class="btn" data-act="delw" aria-label="벽 ${i + 1} 삭제">삭제</button></div>`).join('');
  renderSkip();
}
function renderSkip() {
  const n = tD.stages.length + 1, sk = new Set(tD.supports.skip), ax = shaftAxes(tD);
  $('skipGrid').innerHTML = Array.from({ length: n }, (_, i) => `<span>S${i} ${AXIS_KO[ax[i]]}</span>` +
    ['lo', 'hi'].map(e => `<label class="chk"><input type="checkbox" data-s="${i}:${e}"${sk.has(`${i}:${e}`) ? '' : ' checked'}> ${e === 'lo' ? '− 끝' : '+ 끝'}</label>`).join('')).join('');
}
function rebuildTrain(delay = 0) {
  clearTimeout(tTimer);
  tTimer = setTimeout(() => {
    normalizeTrain(tD);
    if (tD.enclose && tD.enclose.on) {   // 기어박스 탭의 공간을 그때그때 가져옴
      const P = boxParams();
      tD.enclose.box = P.shape === 'poly' && polyProblem(P.pts, P.wall) ? null : JSON.parse(JSON.stringify(P._box));
      tD.enclose.fixIn = P.fixIn; renderGoalForm();
    }
    alts = []; $('altBox').innerHTML = '';
    try { setDesign(JSON.parse(JSON.stringify(tD)), false); }
    catch (e) { toast('이 구성은 만들 수 없습니다: ' + (e && e.message || e)); }
  }, delay);
}
function onStageInput(e) {
  const el = e.target, card = el.closest('.stcard'); if (!card || !el.dataset.k) return;
  const st = tD.stages[+card.dataset.i], k = el.dataset.k;
  if (el.type === 'checkbox') st[k] = el.checked;
  else if (el.tagName === 'SELECT') st[k] = k === 'from' ? +el.value : el.value;
  else if (k === 'sd') st.sd = el.value === '' ? null : +el.value;
  else { const v = parseFloat(el.value); if (!isFinite(v)) return; st[k] = (k === 'zA' || k === 'zB') ? Math.max(5, Math.round(v)) : k === 'helix' ? Math.max(-45, Math.min(45, v)) : k === 'spiral' ? Math.max(-40, Math.min(40, v)) : v; }
  if (k === 'xA' || k === 'zA') delete st.xA;
  if (k === 'zB') delete st.xB;
  const structural = el.tagName === 'SELECT' || el.type === 'checkbox';
  if (structural) renderTrainForm();
  rebuildTrain(structural ? 0 : 300);
}
$('stList').addEventListener('input', e => { if (e.target.tagName === 'INPUT' && e.target.type === 'number') onStageInput(e); });
$('stList').addEventListener('change', e => { if (e.target.tagName !== 'INPUT' || e.target.type !== 'number') onStageInput(e); });
$('stList').addEventListener('click', e => {
  const b = e.target.closest('[data-act="del"]'); if (!b) return;
  const k = +b.closest('.stcard').dataset.i, gone = new Set([k + 1]);
  // 지운 단이 만든 축에서 출발하는 단도 함께 지움, 뒤쪽 축 번호는 당김
  const keep = [];
  tD.stages.forEach((st, i) => { if (i === k) return; if (gone.has(+st.from)) { gone.add(i + 1); return; } keep.push([i, st]); });
  const newIdx = new Map([[0, 0]]); keep.forEach(([i], n) => newIdx.set(i + 1, n + 1));
  tD.stages = keep.map(([, st]) => ({ ...st, from: newIdx.get(+st.from) }));
  tD.supports.skip = [];
  if (gone.size > 1) toast(`지운 단에 이어진 ${gone.size - 1}개 단도 함께 지웠습니다`);
  renderTrainForm(); rebuildTrain();
});
function addStage(type) {
  const last = tD.stages.length, ax = shaftAxes(tD), from = last, pm = tD.stages[last - 1];
  const m = pm ? pm.m : 1.25;
  tD.stages.push(type === 'spur'
    ? { type, from, zA: 13, zB: 26, m, b: 7, angle: 0, stack: '+', offset: 0 }
    : { type, from, zA: 16, zB: 16, m, b: 0, dir: perpAxes(ax[from])[0], apex: '+', stack: '+', offset: 0, hub: 4 });
  renderTrainForm(); rebuildTrain();
}
$('addSpur').onclick = () => addStage('spur');
$('addBevel').onclick = () => addStage('bevel');
for (const id of ['tgFunc', 'tgDir']) $(id).onchange = () => { tD.goal = { ...tD.goal, [id === 'tgFunc' ? 'func' : 'dir']: $(id).value }; renderGoalForm(); rebuildTrain(); };
for (const id of ['tgRatio', 'tgTol']) $(id).oninput = () => { const v = num(id); if (isFinite(v) && v > 0) { tD.goal = { ...tD.goal, [id === 'tgRatio' ? 'ratio' : 'tol']: v }; rebuildTrain(400); } };
$('tTorque').oninput = () => { const v = num('tTorque'); if (isFinite(v) && v >= 0) { tD.torque = v; rebuildTrain(400); } };
$('tRev').onchange = () => { tD.reverse = $('tRev').checked; rebuildTrain(); };
$('tEnc').onchange = () => { tD.enclose = { on: $('tEnc').checked }; renderGoalForm(); rebuildTrain(); };
$('tGoBox').onclick = () => selectTab('box');
$('tFit').onclick = () => {
  const b = $('tFit'); b.disabled = true; b.textContent = '찾는 중…';
  setTimeout(() => {
    try {
      const R = trainFitGoal(JSON.parse(JSON.stringify(tD)));
      if (R.D) { const keep = { enclose: tD.enclose, goal: tD.goal, torque: tD.torque, reverse: tD.reverse }; tD = { ...R.D, ...keep }; renderTrainForm(); rebuildTrain(); }
      $('tFitMsg').textContent = R.msg; toast(R.msg);
    } finally { b.disabled = tD.goal.func === 'none'; b.textContent = '목표에 맞게 잇수·방향 자동 맞춤'; }
  }, 30);
};
$('bTrainIn').onclick = () => {
  if (!tD) tD = defaultTrain();
  tD.goal = goalFromBox(); tD.enclose = { on: true };
  selectTab('train');
  toast('자유 조립 기어열에 기어박스 공간과 기능을 적용했습니다. 목표가 안 맞으면 "자동 맞춤"을 누르세요.');
};
const tNum = { tRpm: 'rpm', tPa: 'pa', tBl: 'backlash', tShaft: 'shaftD', tGap: 'gap', tClear: 'clear' };
for (const [id, k] of Object.entries(tNum)) $(id).oninput = () => { const v = num(id); if (isFinite(v)) { tD[k] = v; rebuildTrain(300); } };
$('tAxis').onchange = () => { tD.input.axis = $('tAxis').value; renderTrainForm(); rebuildTrain(); };
$('tBase').onchange = () => { tD.supports.base = $('tBase').checked; rebuildTrain(); };
$('tEnds').onchange = () => { tD.supports.ends = $('tEnds').checked; rebuildTrain(); };
$('addWall').onclick = () => {
  const b = model && model.kind === 'train' ? trisBounds([].concat(...model.parts.map(p => xfTris(p.tris, p.motion(0))))) : null;
  tD.supports.walls.push({ normal: 'x', pos: b ? Math.round(b.hi[0] + 6) : 40 });
  renderTrainForm(); rebuildTrain();
};
$('wallList').addEventListener('input', e => { const r = e.target.closest('.wallrow'); if (!r || e.target.dataset.k !== 'pos') return; const v = parseFloat(e.target.value); if (isFinite(v)) { tD.supports.walls[+r.dataset.w].pos = v; rebuildTrain(300); } });
$('wallList').addEventListener('change', e => { const r = e.target.closest('.wallrow'); if (!r || e.target.dataset.k !== 'normal') return; tD.supports.walls[+r.dataset.w].normal = e.target.value; rebuildTrain(); });
$('wallList').addEventListener('click', e => { const b = e.target.closest('[data-act="delw"]'); if (!b) return; tD.supports.walls.splice(+b.closest('.wallrow').dataset.w, 1); renderTrainForm(); rebuildTrain(); });
$('skipGrid').addEventListener('change', e => { const k = e.target.dataset.s; if (!k) return; const sk = new Set(tD.supports.skip); e.target.checked ? sk.delete(k) : sk.add(k); tD.supports.skip = [...sk]; rebuildTrain(); });
$('tReset').onclick = () => { tD = defaultTrain(); renderTrainForm(); rebuildTrain(); };
document.querySelectorAll('.toTrain').forEach(b => b.onclick = () => {
  const T = design && toTrain(design);
  if (!T) { toast('유성기어는 자유 조립으로 옮길 수 없습니다 (평기어·베벨기어만 가능)'); return; }
  if (design.box && $('paneBox').style.display !== 'none') { T.goal = goalFromBox(); T.enclose = { on: true }; T.supports.base = false; }   // 기어박스 결과는 공간·기능을 그대로 이어받음
  tD = T; selectTab('train'); rebuildTrain();
  toast('자유 조립으로 옮겼습니다. 잇수와 층을 바꿔 보세요.');
});
function updateToTrain() { document.querySelectorAll('.toTrain').forEach(b => b.hidden = !design || ['train', 'planetary', 'rack', 'worm', 'cam', 'cycloid'].includes(design.kind)); }
