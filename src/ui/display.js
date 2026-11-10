/* ---- 표시 ---- */
function setDesign(D, refit = true) {
  const keepView = !refit && design && design.kind === D.kind && (D.kind === 'train' || D.kind === 'cam' || D.kind === 'linkage');
  design = D; model = buildModel(D); simT = 0;
  buildScene(keepView); renderReport(); updateToTrain(); drawShapeEd();
  if (D.kind === 'train' && $('paneTrain').style.display !== 'none') renderSkip();
}
function renderReport(extra = []) {
  const items = model.checks.concat(extra);
  $('checks').innerHTML = items.map(it => `<li class="${it.st}"><span>${it.txt}</span></li>`).join('');
  $('gtable').innerHTML = `<thead><tr>${model.table.head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${model.table.rows.map(r =>
    `<tr>${r.cells.map((c, i) => `<td>${i === 0 ? `<span class="sw" style="background:${partColor(colorIdx(r.part))}"></span>` : ''}${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
  $('hud').innerHTML = `<div class="card">${model.hud.map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join('')}</div>`;
  $('legend').innerHTML = model.kind === 'std' ? '' : `<div><i style="background:${css('--ok')}"></i>입력축</div>${model.single ? '' : `<div><i style="background:${css('--bad')}"></i>출력축</div>`}`;
  $('check').disabled = !model.interference;
  $('tblTitle').textContent = model.kind === 'linkage' ? '링크 치수' : model.kind === 'cam' ? '부품' : '기어 사양';
  const K = model.kit, kb = $('kitBox');
  kb.hidden = !K;
  const tbl = rows => `<table>${rows.map(r => `<tr>${r.map(c => `<td>${escH(c)}</td>`).join('')}</tr>`).join('')}</table>`;
  if (K) kb.innerHTML = (model.shaftRows ? `<h2>축·결합·지지</h2>${tbl(model.shaftRows)}` : '')
    + (model.bom ? `<h2 style="margin-top:14px">부품 목록</h2>${tbl(model.bom.map(b => [b[0], '×' + b[1], b[2]]))}` : '')
    + (model.steps ? `<h2 style="margin-top:14px">조립 순서</h2><ol style="margin:6px 0 0;padding-left:20px;font-size:13px">${model.steps.map(t => `<li>${escH(t)}</li>`).join('')}</ol>` : '')
    + `<h2 style="margin-top:14px">배선과 제어 · ${escH(K.driver)}</h2>${K.rows.length ? tbl(K.rows) : ''}<ul>${K.notes.map(n => `<li>${escH(n)}</li>`).join('')}</ul>${K.ino ? `<div class="row" style="margin-top:8px"><button class="btn" id="inoSave">아두이노 코드 저장 (.ino)</button><button class="btn" id="inoCopy">코드 복사</button></div><pre>${escH(K.ino)}</pre>` : ''}`;
  if (K && K.ino) {
    $('inoSave').onclick = () => saveFile('motor_control.ino', K.ino);
    $('inoCopy').onclick = async () => { try { await navigator.clipboard.writeText(K.ino); toast('코드를 복사했습니다'); } catch { toast('복사하지 못했습니다. 저장 버튼을 쓰세요.'); } };
  }
}
function escH(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

/* ---- 입력 ---- */
function boxParams() {
  const sh = shape, dia = num('bDia');
  const W = sh === 'cyl' ? dia : sh === 'poly' ? Math.max(...polyPts.map(q => q[0])) : num('bW');
  const H = sh === 'cyl' ? dia : sh === 'poly' ? Math.max(...polyPts.map(q => q[1])) : num('bH');
  const fx = k => $(k).checked && isFinite(num(k + 'X')) && isFinite(num(k + 'Y')) ? [num(k + 'X'), num(k + 'Y')] : null;
  const P = { W, H, D: num('bD'), shape: sh, pts: sh === 'poly' ? polyPts.map(q => q.slice()) : undefined, fixIn: fx('fixIn'), fixOut: fx('fixOut'), wall: num('bWall'), func, ratio: Math.max(0.1, num('bRatio') || 1), dir: $('bDir').value,
    tol: Math.max(0.001, num('bTol') / 100), minM: num('bMinM'), zmin: Math.max(6, Math.round(num('bZmin'))), pa: +$('bPa').value,
    maxStages: Math.min(4, Math.max(1, Math.round(num('bStages')))), shaftD: num('bShaft'), clear: num('bClear'), backlash: num('bBacklash'),
    rpm: num('bRpm'), gap: 1, endGap: 0.8, helix: Math.max(0, Math.min(45, num('bHelix') || 0)), herring: $('bHerring').checked };
  P._box = boxOfP(P);
  P.drive = driveParams();
  const MD = motorOf(P.drive);
  if (MD && MD.kind !== 'hand' && (func === 'reduce' || func === 'increase' || func === 'transfer' || func === 'reverse')) P.endGap = driveEndGap(P.drive, P.wall);   // 바닥 안쪽 나사 머리·서보 윗면 자리
  return P;
}
/* ---- 동력원 ---- */
let driveOpts = [], driveSel = null;
function driveCustom() { return { rpm: num('dcRpm'), T: num('dcT') * 10, volt: num('dcVolt'), d: num('dcD'), dcut: num('dcCut'), len: num('dcLen'), boss: num('dcBoss'), pitch: num('dcPitch'), body: num('dcBody') }; }
function driveParams() {
  if (!$('dOn').checked || !driveSel) return null;
  return { motor: driveSel.id, custom: driveSel.id === 'custom' ? driveCustom() : undefined, load: { T: num('dT') * 10, rpm: num('dN') }, bear: $('dBear').checked, support: $('dSup').value, mat: $('dMat').value, link: $('dLink').value, mount: $('dMount').value, join: $('dJoin').value, fasten: $('dFasten').value };
}
// 추천 목록: 자동이면 상위 4개, 직접 고른 경우에도 고른 것 + 대안 3개를 늘 보여 줌
function recShown(opts, cur, auto) {
  if (auto || !cur) return opts.slice(0, 4);
  const others = opts.filter(o => o !== cur), good = others.filter(o => o.st !== 'bad');
  return [cur, ...(good.length ? good : others).slice(0, 3)];
}
function recNote(cur, auto) {
  if (auto || !cur || cur.st === 'ok') return auto || !cur ? '' : '<p class="hint" style="margin:6px 0 0">다른 선택</p>';
  return cur.st === 'bad' ? `<p class="hint" style="color:var(--bad);margin:6px 0 0">고른 동력원으로는 어렵습니다${cur.why ? ` (${cur.why})` : ''}. 아래 대안을 누르면 바로 바뀝니다.</p>`
    : '<p class="hint" style="color:var(--warn);margin:6px 0 0">여유가 적습니다. 아래 대안도 살펴보세요.</p>';
}
function recCard(o, cur, best, sub) {
  return `<button class="alt" data-id="${o.id}" aria-pressed="${o === cur}"><span class="pill" style="${o.st === 'ok' ? '' : `background:var(--${o.st === 'warn' ? 'warn' : 'bad'});color:#fff`}">${o.st === 'ok' ? (o === best ? '추천' : '가능') : o.st === 'warn' ? '빠듯' : '부족'}</span>${sub}</button>`;
}
function updateDrive() {
  const on = $('dOn').checked; $('dWrap').hidden = !on;
  $('bRpm').disabled = on; if (!on) { $('bRatio').disabled = !['reduce', 'increase', 'planetary', 'rightangle'].includes(func); driveSel = null; return; }
  const sel = $('dMotor').value; $('dCustom').hidden = sel !== 'custom';
  const Msel = sel === 'auto' ? null : motorOf({ motor: sel, custom: sel === 'custom' ? driveCustom() : undefined });
  $('dLink').disabled = !!Msel && !canRemote(Msel); $('dMount').disabled = !!Msel && !canClamp(Msel);
  const T = num('dT') * 10, n = num('dN');
  if (!(T > 0 && n > 0)) { $('dRec').innerHTML = '<p class="hint" style="color:var(--bad)">부하 토크와 출력 회전수를 0보다 크게 넣으세요.</p>'; driveSel = null; return; }
  driveOpts = motorOptions({ T, rpm: n }, Math.min(4, Math.max(1, Math.round(num('bStages')) || 3)), sel === 'custom' ? driveCustom() : null, sel);
  driveSel = sel === 'auto' ? driveOpts[0] : driveOpts.find(o => o.id === sel) || driveOpts[0];
  const auto = sel === 'auto', shown = recShown(driveOpts, driveSel, auto), sub = o => `<span><b>${o.M.short}</b> · ${o.M.kind === 'hand' ? '입력' : '모터'} ${fmt(o.n, o.n < 20 ? 1 : 0)} rpm → ${ratioTxt(o.ratio)}</span><small>토크 여유 ${fmt(o.margin, 1)}배${o.why ? ' · ' + o.why : ''}</small>`;
  $('dRec').innerHTML = shown.map((o, k) => recCard(o, driveSel, driveOpts[0], sub(o)) + (k === 0 && !auto ? recNote(driveSel, auto) : '')).join('');
  $('dRec').querySelectorAll('.alt').forEach(b => b.onclick = () => { $('dMotor').value = b.dataset.id; updateDrive(); scheduleBox(0); });
  // 위의 변속비·입력 회전수·기능을 동력원에 맞춤
  const r = driveSel.ratio;
  let f = func;
  if (Math.abs(r - 1) < 0.03) { if (f === 'reduce' || f === 'increase' || f === 'planetary') f = 'transfer'; }
  else if (r > 1) { if (f === 'increase' || f === 'transfer' || f === 'reverse' || f === 'planetary' && (r < 3 || r > 8) || f === 'rightangle' && r > 3) f = 'reduce'; }
  else if (f !== 'rightangle' || r < 1 / 3) f = 'increase';
  if (f !== func) setFunc(f);
  $('bRatio').value = +(f === 'increase' ? 1 / r : r).toFixed(3);
  $('bRpm').value = +driveSel.n.toFixed(2);
  $('bRatio').disabled = true;
}
function boxFail(msg, live) { $('altBox').innerHTML = `<p class="hint" style="color:var(--bad)">${msg}</p>`; if (!live) toast(msg); }
function runBox(live = false) {
  const P = boxParams();
  if (!(P.W >= 20 && P.H >= 20 && P.D >= 8)) return boxFail('공간은 가로·세로(지름) 20 mm, 높이 8 mm 이상이어야 합니다.', live);
  if (P.shape === 'poly') { const why = polyProblem(P.pts, P.wall); if (why) return boxFail('외곽선을 고쳐 주세요: ' + why, live); }
  if (P.shape !== 'rect' && func === 'rightangle') return boxFail('직각 전환(베벨)은 옆벽으로 축이 나가야 해서 사각 상자에서만 설계합니다.', live);
  for (const [k, ko] of [['fixIn', '입력축'], ['fixOut', '출력축']]) if (P[k] && !fitsIn(P._box, P[k][0], P[k][1], P.shaftD / 2 + 1)) return boxFail(`고정한 ${ko} 자리 (${fmt(P[k][0], 1)}, ${fmt(P[k][1], 1)})가 벽 안쪽에 있지 않습니다.`, live);
  if ((func === 'reduce' || func === 'increase') && P.ratio < 1) return boxFail('감속기·가속기의 변속비는 1 이상으로 넣으세요.', live);
  if (func === 'planetary' && P.ratio < 2.5) return boxFail('유성 감속기의 변속비는 2.5 이상이어야 합니다 (링 고정, 캐리어 출력 구조의 최소는 약 3).', live);
  $('runBox').disabled = true; $('runBox').textContent = '계산 중…';
  setTimeout(() => {
    try {
      alts = func === 'rightangle' ? bevelAuto(P) : func === 'planetary' ? planetaryAuto(P) : autoDesign(P);
      if (P.drive) alts = driveAlts(alts, P);
      if (!alts.length) {
        $('altBox').innerHTML = '<p class="hint" style="color:var(--bad)">이 조건으로는 설계를 찾지 못했습니다. 화면의 모델은 이전 결과입니다.' + (P.fixIn || P.fixOut ? (func === 'planetary' ? ' 유성 감속기는 입력·출력이 한 축선이라 고정한 점이 기어 중심이 됩니다. 공간 가운데 쪽으로 옮기거나 고정을 풀어 보세요.' : ' 고정한 축 자리를 옮기거나 고정을 풀어 보세요.') : '') + (P.drive && P.endGap > 3 ? ` 고른 동력원 때문에 바닥 쪽 ${fmt(P.endGap, 1)} mm를 비워 두어야 합니다${isServo(motorOf(P.drive)) ? ' (서보 윗면과 스플라인 자리)' : ''}. 공간 높이를 늘려 보세요.` : '') + '</p>';
        if (!live) toast(func === 'planetary' ? '이 상자에 맞는 유성기어 조합이 없습니다. 상자 가로·세로를 키우거나 변속비·최소 모듈을 낮춰 보세요.'
          : func === 'rightangle' ? '이 상자에 맞는 베벨기어가 없습니다. 상자를 키우거나 변속비·최소 모듈을 낮춰 보세요.'
          : '조건에 맞는 기어 배치를 찾지 못했습니다. 상자를 키우거나 최소 모듈·잇수를 낮추거나 허용오차를 넓혀 보세요.');
      } else { altIdx = 0; renderAlts(); setDesign(alts[0]); }
    } finally { $('runBox').disabled = false; $('runBox').textContent = '최적 기어 설계'; }
  }, 20);
}
function altLabel(d) {
  if (d.kind === 'bevel') return [`<b>m ${d.m}</b> · 베벨 ${d.z1}/${d.z2}`, ratioTxt(d.input === 2 ? d.z1 / d.z2 : d.z2 / d.z1)];
  if (d.kind === 'planetary') return [`<b>m ${d.m}</b> · 선 ${d.zs} 유성 ${d.zp}×${d.N}`, ratioTxt(1 + (d.zs + 2 * d.zp) / d.zs)];
  const k = kinematics(d);
  return [`<b>m ${d.summary.m}</b> · ${d.summary.n}단${d.summary.idler ? '+아이들러' : ''} · 기어 ${d.gears.length}개`, ratioTxt(Math.abs(k.w[d.input] / k.w[d.output]))];
}
function renderAlts() {
  $('altBox').innerHTML = alts.map((d, i) => { const [a, b] = altLabel(d);
    return `<button class="alt" data-i="${i}" aria-pressed="${i === altIdx}"><span class="pill">${i === 0 ? '추천' : '대안'}</span><span>${a}</span><small>${b}</small></button>`; }).join('');
  $('altBox').querySelectorAll('.alt').forEach(b => b.onclick = () => { altIdx = +b.dataset.i; renderAlts(); setDesign(alts[altIdx]); });
}
function runPair() {
  const m = num('pM'), pa = num('pPa'), rpm = num('pRpm'), bl = num('pBl');
  if (!(m > 0)) { toast('모듈은 0보다 커야 합니다.'); return; }
  if (ptype === 'rack') {
    const Q = { m, pa, b: num('pB') || 8, bl, z1: Math.round(num('rZ')), autoX: $('pAutoX').checked, x1: num('pX1') || 0, nR: Math.round(num('rN')), H: num('rH') || 5, bore1: num('rBore') || 0, d1: true, rpm };
    if (Q.z1 < 6 || Q.nR < 4) { toast('피니언 잇수는 6 이상, 랙 잇수는 4 이상이어야 합니다.'); return; }
    setDesign(rackPair(Q)); return;
  }
  if (ptype === 'cycloid') {
    const Q = { N: Math.round(num('yN')), R: num('yR'), rp: num('yRp'), e: num('yE'), T: num('yT'), bl: num('yBl') || 0, nOut: Math.round(num('yNo')), rOut: num('yRo2'), Ro: num('yRo') || 0, shaftD: num('ySd'), rpm };
    if (!(Q.N >= 5) || !(Q.R > 0) || !(Q.e > 0) || !(Q.rp > 0)) { toast('링 핀 수는 5 이상, 반지름·편심은 0보다 커야 합니다.'); return; }
    setDesign(cycloidPair(Q)); return;
  }
  if (ptype === 'worm') {
    const Q = { m, pa, b: num('pB') || 0, bl, n: +$('wN').value, q: num('wQ'), z2: Math.round(num('wZ')), Lw: num('wL') || 0, bore1: num('wB1') || 0, bore2: num('wB2') || 0, rpm };
    if (!(Q.q >= 5) || Q.z2 < 15) { toast('직경계수 q는 5 이상, 휠 잇수는 15 이상이어야 합니다.'); return; }
    $('runPair').disabled = true; $('runPair').textContent = '맞물림 계산 중…';
    setTimeout(() => { try { setDesign(wormPair(Q)); } finally { $('runPair').disabled = false; $('runPair').textContent = '기어 생성'; } }, 20);
    return;
  }
  if (ptype === 'planet') {
    const Q = { m, pa, b: num('pB') || 8, bl, zs: Math.round(num('qZs')), zp: Math.round(num('qZp')), N: Math.round(num('qN')), sunBore: num('qSunBore'), pinD: num('qPin'), rpm };
    if (Q.zs < 6 || Q.zp < 6 || Q.N < 2) { toast('잇수는 6 이상, 유성기어는 2개 이상이어야 합니다.'); return; }
    setDesign(planetaryPair(Q)); return;
  }
  const Q = { m, pa, b: num('pB'), bl, z1: Math.round(num('pZ1')), z2: Math.round(num('pZ2')), x1: num('pX1') || 0, x2: num('pX2') || 0,
    bore1: num('pBore1') || 0, bore2: num('pBore2') || 0, d1: $('pD1').checked, d2: $('pD2').checked, on2: $('pOn2').checked, autoX: $('pAutoX').checked, rpm,
    helix: Math.max(-45, Math.min(45, num('pHelix') || 0)), herring: $('pHerring').checked };
  if (Q.z1 < 5 || (Q.on2 || ptype === 'bevel') && Q.z2 < 5) { toast('잇수는 5 이상이어야 합니다.'); return; }
  if (ptype === 'bevel') { setDesign(bevelPair({ ...Q, F: Q.b, hub: num('pHub') || 0, spiral: Math.max(-40, Math.min(40, num('pSpiral') || 0)) })); return; }
  if (!(Q.b > 0)) { toast('이 폭을 넣으세요.'); return; }
  setDesign(pairDesign(Q));
}
function updatePlanetInfo() {
  const zs = Math.round(num('qZs')), zp = Math.round(num('qZp')), N = Math.round(num('qN')), zr = zs + 2 * zp;
  const ok = (zs + zr) % N === 0;
  $('qInfo').innerHTML = `링기어 z<sub>r</sub> = ${zr} · 변속비 ${fmt(1 + zr / zs, 3)} : 1 · 조립 조건 (z<sub>s</sub>+z<sub>r</sub>)/N = ${fmt((zs + zr) / N, 2)} ${ok ? '✓' : '✗ 정수가 아니어서 같은 간격으로 넣을 수 없습니다'}`;
}
