/* ---- 캠 ---- */
let cD = null, cTimer = 0, chartScale = null, dragIdx = -1;
const CAM_HINT = {
  disk: '돌아가는 원판의 윤곽을 종동절이 따라가며 직선(또는 스윙) 운동을 만듭니다. 가장 흔한 캠입니다.',
  groove: '원판 앞면에 판 홈을 롤러가 따라갑니다. 스프링 없이 양쪽으로 확실하게 움직입니다.',
  barrel: '원통 둘레의 홈을 핀이 따라가며 축과 나란한 방향으로 움직입니다. 긴 행정에 좋습니다.',
  face: '원통 윗면 높낮이를 둥근 끝 막대가 따라가며 축과 나란한 방향으로 움직입니다.',
};
function renderCamForm() {
  const D = cD;
  $('camTypeSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === D.camType));
  $('camFolSeg').hidden = D.camType !== 'disk';
  $('camFolSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === D.follower));
  $('camHint').textContent = CAM_HINT[D.camType];
  const disk = D.camType === 'disk', swing = disk && D.follower === 'swing', roller = D.camType === 'groove' || D.camType === 'barrel' || (disk && (D.follower === 'roller' || swing));
  $('cRbL').textContent = disk || D.camType === 'groove' ? '기초원 반지름' : '경로 반지름';
  $('cRrL').textContent = D.camType === 'barrel' ? '핀 반지름' : '롤러 반지름';
  $('cRrW').hidden = !roller; $('cEW').hidden = !(disk && (D.follower === 'roller' || D.follower === 'knife'));
  $('cTW').hidden = !(disk || D.camType === 'groove'); $('cDgW').hidden = D.camType !== 'barrel';
  $('cSwDW').hidden = $('cSwLW').hidden = !swing;
  $('cRb').value = D.Rb; $('cRr').value = D.Rr; $('cE').value = D.e; $('cT').value = D.T; $('cDg').value = D.dg; $('cSd').value = D.shaftD; $('cRpm').value = D.rpm;
  $('cSwD').value = D.swing.d; $('cSwL').value = D.swing.L; $('cLobes').value = D.motion.lobes || 1;
  $('camModeSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === D.motion.mode));
  const prog = D.motion.mode !== 'custom', u = swing ? '°' : 'mm';
  $('camSegs').hidden = !prog; $('camAddSeg').hidden = !prog; $('camPtsBox').hidden = prog;
  const opt = (v, t, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${t}</option>`;
  $('camSegs').innerHTML = D.motion.segs.map((sg, i) => `<div class="stcard" data-i="${i}" style="padding:8px;gap:6px">
    <div style="display:grid;grid-template-columns:1fr 1.3fr auto;gap:8px;align-items:end">
      <label class="f">구간 ${i + 1}<select data-k="kind">${opt('rise', '상승', sg.kind)}${opt('dwell', '정지', sg.kind)}${opt('return', '하강', sg.kind)}</select></label>
      <label class="f">운동 법칙<select data-k="law"${sg.kind === 'dwell' ? ' disabled' : ''}>${Object.entries(CAM_LAW_KO).map(([k, t]) => opt(k, t, sg.law)).join('')}</select></label>
      <button class="x" data-act="del" aria-label="구간 ${i + 1} 삭제">삭제</button></div>
    <div class="grid2">
      <label class="f">각도 <span class="u">°</span><input type="number" data-k="ang" value="${sg.ang}" min="1" step="5"></label>
      <label class="f">변위 <span class="u">${u}</span><input type="number" data-k="h" value="${sg.h}" step="0.5"${sg.kind === 'dwell' ? ' disabled' : ''}></label></div></div>`).join('');
  const tot = D.motion.segs.reduce((a, sg) => a + (+sg.ang || 0), 0);
  $('camChartHint').textContent = prog ? `구간 각도 합 ${fmt(tot, 1)}° (360°가 아니면 비례로 맞춥니다). 그래프: 실선 변위, 점선 속도, 옅은 선 가속도.`
    : '점을 끌어 곡선을 바꾸고, 빈 곳을 누르면 점이 생기고, 점을 두 번 누르면 지워집니다. 곡선은 점을 부드럽게 잇는 주기 곡선입니다.';
  $('camPtsTxt').value = D.motion.pts.map(p => `${fmt(p[0], 1)}, ${fmt(p[1], 2)}`).join('\n');
  renderCamChart();
}
function renderCamChart() {
  const svg = $('camChart'), D = cD, lobes = Math.max(1, Math.round(D.motion.lobes || 1)), M = camMotion(D.motion, 720);
  const n = Math.round(720 / lobes), sArr = M.s.slice(0, n + 1), v = M.s1.slice(0, n + 1), a = M.s2.slice(0, n + 1);
  const custom = D.motion.mode === 'custom';
  let lo = Math.min(0, ...sArr, ...(custom ? D.motion.pts.map(p => p[1]) : [])), hi = Math.max(1, ...sArr, ...(custom ? D.motion.pts.map(p => p[1]) : []));
  if (dragIdx >= 0 && chartScale) [lo, hi] = chartScale; else { const pad = (hi - lo) * 0.15; lo -= pad; hi += pad; chartScale = [lo, hi]; }
  const X0 = 34, X1 = 322, Y0 = 10, Y1 = 166, X = d => X0 + d / 360 * (X1 - X0), Y = s => Y1 - (s - lo) / (hi - lo) * (Y1 - Y0);
  const path = (arr, sc, off) => arr.map((s, i) => `${i ? 'L' : 'M'}${X(i / (arr.length - 1) * 360).toFixed(1)},${(sc ? (Y1 + Y0) / 2 - s * sc : Y(s)).toFixed(1)}`).join('');
  const vm = Math.max(...v.map(Math.abs)) || 1, am = Math.max(...a.map(Math.abs)) || 1, half = (Y1 - Y0) / 2 * 0.9;
  const ticks = [0, 90, 180, 270, 360].map(d => `<line x1="${X(d)}" x2="${X(d)}" y1="${Y0}" y2="${Y1}" stroke="var(--line)" stroke-width="0.6"/><text x="${X(d)}" y="${Y1 + 14}" font-size="10" text-anchor="middle" fill="var(--mute)">${lobes > 1 ? fmt(d / lobes, 0) : d}°</text>`).join('');
  const ys = [lo, (lo + hi) / 2, hi].map(s => `<text x="${X0 - 4}" y="${Y(s) + 3}" font-size="10" text-anchor="end" fill="var(--mute)">${fmt(s, 1)}</text>`).join('');
  const zero = `<line x1="${X0}" x2="${X1}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--line)"/>`;
  const pts = custom ? D.motion.pts.map((p, i) => `<circle data-p="${i}" cx="${X(p[0])}" cy="${Y(p[1])}" r="6.5" fill="var(--accent)" stroke="var(--panel)" stroke-width="2" style="cursor:grab"/>`).join('') : '';
  svg.innerHTML = `<rect x="0" y="0" width="340" height="190" fill="transparent" data-bg="1"/>${ticks}${ys}${zero}
    <path d="${path(a, half / am)}" fill="none" stroke="var(--mute)" stroke-opacity=".35" stroke-width="1"/>
    <path d="${path(v, half / vm)}" fill="none" stroke="var(--steel)" stroke-dasharray="4 3" stroke-width="1.2"/>
    <path d="${path(sArr)}" fill="none" stroke="var(--accent)" stroke-width="2.2"/>${pts}`;
  svg._map = { X0, X1, Y0, Y1, lo, hi };
}
function svgPoint(e) { const svg = $('camChart'), p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); const m = svg._map;
  return [Math.max(0, Math.min(359.9, (q.x - m.X0) / (m.X1 - m.X0) * 360)), m.lo + (m.Y1 - q.y) / (m.Y1 - m.Y0) * (m.hi - m.lo)]; }
$('camChart').addEventListener('pointerdown', e => {
  if (cD.motion.mode !== 'custom') return;
  const c = e.target.closest('circle[data-p]');
  if (c) { dragIdx = +c.dataset.p; $('camChart').setPointerCapture(e.pointerId); e.preventDefault(); return; }
  const [d, s] = svgPoint(e); cD.motion.pts.push([+d.toFixed(1), +s.toFixed(2)]); cD.motion.pts.sort((p, q) => p[0] - q[0]);
  renderCamForm(); rebuildCam(200);
});
$('camChart').addEventListener('pointermove', e => {
  if (dragIdx < 0) return;
  const [d, s] = svgPoint(e), P = cD.motion.pts;
  const prev = P[dragIdx - 1], next = P[dragIdx + 1];
  P[dragIdx] = [+Math.max(prev ? prev[0] + 1 : 0, Math.min(next ? next[0] - 1 : 359.9, d)).toFixed(1), +s.toFixed(2)];
  renderCamChart(); rebuildCam(250);
});
const endDrag = () => { if (dragIdx >= 0) { dragIdx = -1; renderCamForm(); } };
$('camChart').addEventListener('pointerup', endDrag); $('camChart').addEventListener('pointercancel', endDrag);
$('camChart').addEventListener('dblclick', e => {
  const c = e.target.closest('circle[data-p]'); if (!c || cD.motion.pts.length <= 3) return;
  cD.motion.pts.splice(+c.dataset.p, 1); renderCamForm(); rebuildCam();
});
function rebuildCam(delay = 0) {
  clearTimeout(cTimer);
  cTimer = setTimeout(() => { alts = []; $('altBox').innerHTML = ''; try { setDesign(JSON.parse(JSON.stringify(cD)), false); } catch (e) { toast('이 캠은 만들 수 없습니다: ' + (e && e.message || e)); } }, delay);
}
$('camTypeSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; cD.camType = b.dataset.v;
  if (cD.camType !== 'disk' && cD.follower === 'swing') { cD.follower = 'roller'; cD.motion.segs.forEach(sg => { if (sg.kind !== 'dwell') sg.h = Math.max(1, Math.round(sg.h / 1.6)); }); }
  renderCamForm(); rebuildCam(); });
$('camFolSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
  const wasSwing = cD.follower === 'swing'; cD.follower = b.dataset.v;
  if ((cD.follower === 'swing') !== wasSwing) cD.motion.segs.forEach(sg => { if (sg.kind !== 'dwell') sg.h = cD.follower === 'swing' ? Math.min(30, sg.h * 1.6) : Math.max(1, Math.round(sg.h / 1.6)); });
  renderCamForm(); rebuildCam(); });
$('camModeSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; cD.motion.mode = b.dataset.v; renderCamForm(); rebuildCam(); });
$('camPresets').innerHTML = Object.entries(CAM_PRESETS).map(([k, p]) => `<button class="btn" data-k="${k}" style="padding:7px 10px;font-size:12.5px">${p.label}</button>`).join('');
$('camPresets').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; CAM_PRESETS[b.dataset.k].apply(cD); renderCamForm(); rebuildCam(); });
const camNum = { cRb: 'Rb', cRr: 'Rr', cE: 'e', cT: 'T', cDg: 'dg', cSd: 'shaftD', cRpm: 'rpm' };
for (const [id, k] of Object.entries(camNum)) $(id).addEventListener('input', () => { const v = num(id); if (isFinite(v)) { cD[k] = v; rebuildCam(300); } });
$('cSwD').addEventListener('input', () => { const v = num('cSwD'); if (isFinite(v)) { cD.swing.d = v; rebuildCam(300); } });
$('cSwL').addEventListener('input', () => { const v = num('cSwL'); if (isFinite(v)) { cD.swing.L = v; rebuildCam(300); } });
$('cLobes').addEventListener('input', () => { const v = Math.round(num('cLobes')); if (v >= 1 && v <= 8) { cD.motion.lobes = v; renderCamChart(); rebuildCam(300); } });
$('camSegs').addEventListener('input', e => { const r = e.target.closest('.stcard'); if (!r || e.target.type !== 'number') return; const v = parseFloat(e.target.value); if (!isFinite(v)) return; cD.motion.segs[+r.dataset.i][e.target.dataset.k] = v; renderCamChart(); rebuildCam(300); });
$('camSegs').addEventListener('change', e => { const r = e.target.closest('.stcard'); if (!r || e.target.tagName !== 'SELECT') return; cD.motion.segs[+r.dataset.i][e.target.dataset.k] = e.target.value; renderCamForm(); rebuildCam(); });
$('camSegs').addEventListener('click', e => { const b = e.target.closest('[data-act="del"]'); if (!b || cD.motion.segs.length <= 1) return; cD.motion.segs.splice(+b.closest('.stcard').dataset.i, 1); renderCamForm(); rebuildCam(); });
$('camAddSeg').onclick = () => { cD.motion.segs.push({ kind: 'dwell', ang: 30, h: 0, law: 'cycloid' }); renderCamForm(); rebuildCam(); };
$('camPtsApply').onclick = () => {
  const pts = $('camPtsTxt').value.split(/\n+/).map(l => l.split(/[,\s\t]+/).filter(Boolean).map(Number)).filter(p => p.length >= 2 && p.every(isFinite)).map(p => [((p[0] % 360) + 360) % 360, p[1]]).sort((a, b) => a[0] - b[0]);
  if (pts.length < 3) { toast('점이 3개 이상 필요합니다. 한 줄에 "각도, 변위" 형식으로 넣으세요.'); return; }
  cD.motion.pts = pts; renderCamForm(); rebuildCam();
};
