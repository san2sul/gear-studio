/* ---- 조립 작업대 ---- */
let aD = null, aTimer = 0;
const asmOpts = (list, cur) => list.map(([v, t]) => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${t}</option>`).join('');
function asmPortsOf(k) {   // k 번 기구(0부터)의 출력 포트 목록 (마지막 계산 결과에서)
  const mm = model && model.kind === 'asm' && model.mods && model.mods[k];
  return mm ? mm.ports.filter(q => q.role === 'out') : [];
}
function renderAsm() {
  if (!aD) aD = asmDefault();
  const d0 = aD.mods[0] && aD.mods[0].design;
  $('asmMotor').innerHTML = asmOpts([['auto', '자동 추천'], ['none', '없음 (손·외부 축)'], ...LK_MOTORS.map(id => [id, MOTORS[id].short])], d0 && d0.drive ? d0.drive.motor : 'none');
  $('asmRpm').value = d0 ? d0.rpm : 30; $('asmBase').checked = aD.base !== false;
  $('asmAddType').innerHTML = asmOpts(LK_TYPES.map(t => [t, LK_KO[t]]), 'slider');
  $('asmList').innerHTML = aD.mods.map((md, k) => {
    const d = md.design, L = asmLinkFix(md.link), outs = k ? asmPortsOf(k - 1) : [];
    const qf = outs.find(q => q.id === (md.from || 'out')) || outs[0], lin = !!qf && qf.kind === 'lin';
    L.kind = lin ? 'rack' : L.kind === 'rack' ? 'mesh' : L.kind;
    const kinds = Object.entries(ASM_KINDS).filter(([v]) => lin ? v === 'rack' : v !== 'rack');
    const typeSel = d.kind === 'linkage' ? `<select data-k="${k}" data-f="type">${asmOpts(LK_TYPES.map(t => [t, LK_KO[t]]), d.type)}</select>` : `<b>${escH(asmName(d))}</b>`;
    const link = !k ? '<p class="hint" style="margin:0">동력원이 이 기구의 입력축을 돌립니다.</p>' : `<div class="grid2">
      <label class="f">앞 기구 출력<select data-k="${k}" data-f="from">${outs.length ? asmOpts(outs.map(q => [q.id, q.label || q.id]), md.from || 'out') : '<option value="out">출력축</option>'}</select></label>
      <label class="f">이음<select data-k="${k}" data-f="kind">${asmOpts(kinds, L.kind)}</select></label>
      ${L.kind === 'belt' ? `<label class="f">앞 풀리 잇수<select data-k="${k}" data-f="zA">${asmOpts(ASM_PULLEY.map(z => [z, z + 'T']), L.zA)}</select></label><label class="f">뒤 풀리 잇수<select data-k="${k}" data-f="zB">${asmOpts(ASM_PULLEY.map(z => [z, z + 'T']), L.zB)}</select></label>` : ''}
      ${L.kind === 'mesh' ? `<label class="f">앞 기어 잇수<input type="number" data-k="${k}" data-f="zA" value="${L.zA}" min="10" step="1"></label><label class="f">뒤 기어 잇수<input type="number" data-k="${k}" data-f="zB" value="${L.zB}" min="10" step="1"></label><label class="f">모듈<input type="number" data-k="${k}" data-f="m" value="${L.m}" min="0.5" step="0.25"></label>` : ''}
      ${L.kind === 'rack' ? `<label class="f">피니언 잇수<input type="number" data-k="${k}" data-f="zB" value="${L.zB}" min="10" step="1"></label><label class="f">모듈<input type="number" data-k="${k}" data-f="m" value="${L.m}" min="0.5" step="0.25"></label>` : ''}
      ${L.kind !== 'shaft' && L.kind !== 'rack' ? `<label class="f">놓는 방향<select data-k="${k}" data-f="ang">${asmOpts([['auto', '자동 (안 겹치게)'], ...[0, 45, 90, 135, 180, 225, 270, 315].map(a => [a, a + '°'])], L.ang)}</select></label>` : ''}
    </div>`;
    return `<div class="asmCard"><div class="row" style="align-items:center"><span class="pill">${k + 1}</span>${typeSel}<span style="flex:1"></span>
      <button class="btn" data-mv="${k}" data-d="-1"${k ? '' : ' disabled'}>위로</button><button class="btn" data-mv="${k}" data-d="1"${k < aD.mods.length - 1 ? '' : ' disabled'}>아래로</button><button class="btn" data-del="${k}"${aD.mods.length > 1 ? '' : ' disabled'}>빼기</button>
      <button class="btn" data-edit="${k}"${d.kind === 'linkage' ? '' : ' disabled'}>치수 다듬기</button></div>${link}</div>`;
  }).join('');
}
function asmRebuild(delay = 0, refit = false) {
  clearTimeout(aTimer);
  aTimer = setTimeout(() => { alts = []; $('altBox').innerHTML = '';
    try { setDesign(JSON.parse(JSON.stringify(aD)), refit); renderAsm(); } catch (e) { toast('조립을 만들 수 없습니다: ' + (e && e.message || e)); } }, delay);
}
function asmFixDrive() { aD.mods.forEach((m, k) => { if (k && m.design.drive) m.design.drive.motor = 'none'; }); }
let asmEditing = -1;
$('tabAsm').onclick = () => selectTab('asm');
$('asmMotor').onchange = () => { const d = aD.mods[0].design; if (d.drive) { d.drive.motor = $('asmMotor').value; asmRebuild(); } };
$('asmRpm').oninput = () => { const v = num('asmRpm'); if (v > 0) { aD.mods[0].design.rpm = v; asmRebuild(400); } };
$('asmAdd').onclick = () => { const d = linkageDefault(); d.type = $('asmAddType').value; d.drive.motor = 'none'; aD.mods.push({ design: d, from: 'out', link: { kind: 'belt', zA: 20, zB: 20, m: 1, ang: 'auto' } }); asmRebuild(0, true); };
$('asmFromLink').onclick = () => { if (!kD) return toast('먼저 동작 기구 탭에서 기구를 만드세요');
  const d = JSON.parse(JSON.stringify(kD)); if (aD.mods.length) d.drive.motor = 'none';
  aD.mods.push({ design: d, from: 'out', link: { kind: 'belt', zA: 20, zB: 20, m: 1, ang: 'auto' } }); asmRebuild(0, true); toast('동작 기구 탭의 설계를 끝에 넣었습니다'); };
$('asmBase').onchange = () => { aD.base = $('asmBase').checked; asmRebuild(); };
$('asmReset').onclick = () => { aD = asmDefault(); asmRebuild(0, true); };
$('asmList').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.del) { aD.mods.splice(+b.dataset.del, 1); if (aD.mods[0]) delete aD.mods[0].link; asmRebuild(0, true); }
  else if (b.dataset.mv) { const k = +b.dataset.mv, j = k + +b.dataset.d, A = aD.mods; [A[k].design, A[j].design] = [A[j].design, A[k].design];
    const d0 = A.find(m => m.design.drive && m.design.drive.motor !== 'none'); const mo = d0 ? d0.design.drive.motor : 'none';
    A.forEach((m, i) => { if (m.design.drive) m.design.drive.motor = i ? 'none' : mo; }); asmRebuild(0, true); }
  else if (b.dataset.edit) { asmEditing = +b.dataset.edit; kD = JSON.parse(JSON.stringify(aD.mods[asmEditing].design)); selectTab('link'); $('lkBack').hidden = false;
    toast('치수를 고친 뒤 위의 “조립 작업대로 돌아가기”를 누르세요'); }
});
$('asmList').addEventListener('change', e => {
  const el = e.target, k = +el.dataset.k, f = el.dataset.f; if (!f) return; const md = aD.mods[k];
  if (f === 'type') { md.design.type = el.value; }
  else if (f === 'from') md.from = el.value;
  else { md.link = asmLinkFix(md.link); md.link[f] = f === 'kind' || (f === 'ang' && el.value === 'auto') ? el.value : +el.value;
    if (f === 'kind' && el.value === 'belt') { md.link.zA = ASM_PULLEY.includes(md.link.zA) ? md.link.zA : 20; md.link.zB = ASM_PULLEY.includes(md.link.zB) ? md.link.zB : 20; } }
  asmRebuild(0, f === 'type' || f === 'kind');
});
$('lkBack').onclick = () => { if (asmEditing >= 0 && aD && aD.mods[asmEditing]) { const d = JSON.parse(JSON.stringify(kD)); if (asmEditing) d.drive.motor = 'none'; aD.mods[asmEditing].design = d; }
  asmEditing = -1; $('lkBack').hidden = true; selectTab('asm'); asmRebuild(0, true); };
