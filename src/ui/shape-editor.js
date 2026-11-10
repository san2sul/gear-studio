/* ---- 공간 모양 편집기 ----
 상자 좌표(mm, Y 위쪽)를 그대로 SVG에 그림. 꼭짓점·고정축 점을 끌어 옮기고, 변을 누르면 꼭짓점 추가, 꼭짓점 두 번 누르면 삭제 */
function edBox() { const P = boxParams(); return P._box; }
function setShape(v) {
  shape = v; $('shapeSeg').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === v));
  $('bWWrap').hidden = $('bHWrap').hidden = v !== 'rect'; $('bDiaWrap').hidden = v !== 'cyl';
  $('polyPresets').hidden = $('polyPtsBox').hidden = v !== 'poly';
  $('shapeHint').textContent = v === 'poly' ? '꼭짓점(네모)을 끌어 모양을 바꾸고, 변을 누르면 꼭짓점이 생기며, 꼭짓점을 두 번 누르면 지워집니다. 점선은 벽 안쪽 선입니다.'
    : v === 'cyl' ? '원통 안에 기어를 배치합니다. 유성 감속기는 링기어가 하우징 홈에 끼워져 돌지 않습니다.' : '사각 상자 안에 기어를 배치합니다.';
  syncPolyTxt(); drawShapeEd();
}
function syncPolyTxt() { $('polyTxt').value = polyPts.map(q => `${fmt(q[0], 1)}, ${fmt(q[1], 1)}`).join('\n'); }
function fixDefaults(k) {
  if (!$(k).checked || (isFinite(num(k + 'X')) && isFinite(num(k + 'Y')))) return;
  const G = shapeGeo(edBox()), off = k === 'fixOut' && func !== 'planetary' ? G.rIn * 0.5 : 0;
  $(k + 'X').value = Math.round(G.cIn[0] + off); $(k + 'Y').value = Math.round(G.cIn[1]);
}
function drawShapeEd() {
  const svg = $('shapeEd'); if (!svg || $('paneBox').style.display === 'none') return;
  let box; try { box = edBox(); } catch { return; }
  if (!(box.W > 0 && box.H > 0)) return;
  const O = boxOuter(box), mg = Math.max(box.W, box.H) * 0.06 + 4, x0 = -mg, y0 = -mg, w = box.W + 2 * mg, h = box.H + 2 * mg, u = Math.max(w, h) / 100;
  svg.setAttribute('viewBox', `${x0} ${y0} ${w} ${h}`);
  const path = P => 'M' + P.map(q => `${q[0].toFixed(2)} ${q[1].toFixed(2)}`).join('L') + 'Z';
  const vs = 'vector-effect="non-scaling-stroke"';
  let g = '';
  for (let x = 0; x <= box.W + 1e-6; x += 10) g += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y0 + h}" stroke="var(--line)" stroke-width="0.5" ${vs} opacity=".5"/>`;
  for (let y = 0; y <= box.H + 1e-6; y += 10) g += `<line x1="${x0}" y1="${y}" x2="${x0 + w}" y2="${y}" stroke="var(--line)" stroke-width="0.5" ${vs} opacity=".5"/>`;
  g += `<path d="${path(O)}" fill="var(--sunk)" stroke="var(--ink)" stroke-width="1.5" ${vs}/>`;
  let inner = null; try { inner = boxInner(box); } catch {}
  if (inner && (shape !== 'poly' || !polyProblem(polyPts, box.wall))) g += `<path d="${path(inner)}" fill="none" stroke="var(--mute)" stroke-width="1" stroke-dasharray="4 3" ${vs}/>`;
  // 현재 설계의 기어 배치
  const D = design;
  if (D && D.box && (D.kind === 'gearbox' || D.kind === 'planetary')) {
    if (D.kind === 'gearbox') D.gears.forEach(gr => { const sft = D.shafts[gr.shaft], ra = gearOutlineInfo(gr).ra;
      g += `<circle cx="${sft.x}" cy="${sft.y}" r="${ra}" fill="var(--steel)" fill-opacity=".12" stroke="var(--steel)" stroke-width="1" ${vs}/>`; });
    else { const [cx, cy] = D.center, ro = D.ringOuter.pts ? D.ringOuter.pts.map(q => [q[0] + cx, q[1] + cy]) : null;
      if (ro) g += `<path d="${path(ro)}" fill="var(--steel)" fill-opacity=".12" stroke="var(--steel)" stroke-width="1" ${vs}/>`;
      g += `<circle cx="${cx}" cy="${cy}" r="${D.carrier.Rc}" fill="none" stroke="var(--steel)" stroke-width="1" ${vs}/>`; }
    const sh = D.kind === 'gearbox' ? D.shafts : [{ x: D.center[0], y: D.center[1], role: 'input' }];
    sh.forEach(sft => g += `<circle cx="${sft.x}" cy="${sft.y}" r="${1.1 * u}" fill="${sft.role === 'input' ? 'var(--ok)' : sft.role === 'output' ? 'var(--bad)' : 'var(--ink)'}"/>`);
  }
  if (shape === 'poly') {
    polyPts.forEach((q, i) => { const n = polyPts[(i + 1) % polyPts.length];
      g += `<line class="edg" data-e="${i}" x1="${q[0]}" y1="${q[1]}" x2="${n[0]}" y2="${n[1]}" stroke="transparent" stroke-width="${3 * u}" style="cursor:copy"/>`; });
    polyPts.forEach((q, i) => g += `<rect class="vtx" data-v="${i}" x="${q[0] - 1.6 * u}" y="${q[1] - 1.6 * u}" width="${3.2 * u}" height="${3.2 * u}" fill="var(--panel)" stroke="var(--ink)" stroke-width="1.5" ${vs} style="cursor:move"/>`);
  }
  for (const [k, col] of [['fixIn', 'var(--ok)'], ['fixOut', 'var(--bad)']]) if ($(k).checked && isFinite(num(k + 'X')) && isFinite(num(k + 'Y')))
    g += `<circle class="fix" data-f="${k}" cx="${num(k + 'X')}" cy="${num(k + 'Y')}" r="${2.4 * u}" fill="${col}" fill-opacity=".35" stroke="${col}" stroke-width="2" ${vs} style="cursor:move"/>`;
  svg.innerHTML = `<g id="edG" transform="translate(0 ${box.H}) scale(1 -1)">${g}</g>`;
}
function edPoint(e) { const gEl = $('edG'), p = $('shapeEd').createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(gEl.getScreenCTM().inverse()); return [Math.max(0, Math.round(q.x)), Math.max(0, Math.round(q.y))]; }
$('shapeEd').addEventListener('pointerdown', e => {
  const t = e.target;
  if (t.classList.contains('vtx')) edDrag = { kind: 'v', i: +t.dataset.v };
  else if (t.classList.contains('fix')) edDrag = { kind: 'f', k: t.dataset.f };
  else if (t.classList.contains('edg')) { const i = +t.dataset.e; polyPts.splice(i + 1, 0, edPoint(e)); edDrag = { kind: 'v', i: i + 1 }; drawShapeEd(); }
  else return;
  $('shapeEd').setPointerCapture(e.pointerId); e.preventDefault();
});
$('shapeEd').addEventListener('pointermove', e => {
  if (!edDrag) return;
  const q = edPoint(e);
  if (edDrag.kind === 'v') polyPts[edDrag.i] = q; else { $(edDrag.k + 'X').value = q[0]; $(edDrag.k + 'Y').value = q[1]; }
  drawShapeEd();
});
const edEnd = () => { if (!edDrag) return; edDrag = null; syncPolyTxt(); drawShapeEd(); scheduleBox(0); };
$('shapeEd').addEventListener('pointerup', edEnd); $('shapeEd').addEventListener('pointercancel', edEnd);
$('shapeEd').addEventListener('dblclick', e => { const t = e.target; if (!t.classList.contains('vtx') || polyPts.length <= 3) return; polyPts.splice(+t.dataset.v, 1); syncPolyTxt(); drawShapeEd(); scheduleBox(0); });
$('shapeSeg').querySelectorAll('button').forEach(b => b.onclick = () => {
  if (b.dataset.v === shape) return;
  setShape(b.dataset.v);
  for (const k of ['fixIn', 'fixOut']) { $(k + 'X').value = $(k + 'Y').value = ''; fixDefaults(k); }   // 모양이 바뀌면 고정점을 새 공간 안으로
  scheduleBox(0);
});
$('polyPresets').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; polyPts = POLY_PRESETS[b.dataset.k].map(q => q.slice()); syncPolyTxt(); drawShapeEd(); scheduleBox(0); });
$('polyApply').onclick = () => {
  const pts = $('polyTxt').value.split('\n').map(l => l.split(/[,\s]+/).filter(Boolean).map(Number)).filter(a => a.length >= 2 && a.every(isFinite)).map(a => [Math.max(0, a[0]), Math.max(0, a[1])]);
  if (pts.length < 3) { toast('한 줄에 "X, Y" 하나씩, 3줄 이상 넣으세요.'); return; }
  polyPts = pts; syncPolyTxt(); drawShapeEd(); scheduleBox(0);
};
// 값을 바꾸면 바로 다시 설계
function scheduleBox(delay = 450) {
  drawShapeEd();
  if (!$('bLive').checked) return;
  clearTimeout(boxTimer); boxTimer = setTimeout(() => runBox(true), delay);
}
$('paneBox').addEventListener('input', e => { if (e.target.matches('input[type=number]') && !e.target.closest('#polyPtsBox')) scheduleBox(); });
$('paneBox').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'fixIn' || t.id === 'fixOut') fixDefaults(t.id);
  if (t.id === 'bLive') { if (t.checked) scheduleBox(0); return; }
  if (t.matches('input[type=checkbox], select')) scheduleBox(0);
});
$('funcSeg').addEventListener('click', e => { if (e.target.closest('button')) { if ($('dOn').checked) updateDrive(); scheduleBox(0); } });
$('paneBox').addEventListener('input', e => { if (e.target.closest('#dWrap') || e.target.id === 'bStages') if ($('dOn').checked) updateDrive(); }, true);
$('paneBox').addEventListener('change', e => { if (e.target.closest('#dWrap') || e.target.id === 'dOn') updateDrive(); }, true);
setShape('rect');

if (initThree()) requestAnimationFrame(loop);
runBox();
</script>
