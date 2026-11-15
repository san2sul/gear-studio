/* ---- 동력원 연결 (캠 · 기어 직접 설계 · 자유 조립 공통) ---- */
const PW_KEY = 'gearStudio.power';
try { const v = JSON.parse(localStorage.getItem(PW_KEY) || 'null'); if (v && typeof v === 'object') PW = v; } catch { }
function pwGroup() { return design && !design.drive ? PW_KINDS[design.kind] : null; }
function pwCur() { const g = pwGroup(); return g ? (PW[g] = { ...pwDefault(), ...(PW[g] || {}) }) : null; }
function pwSave() { try { localStorage.setItem(PW_KEY, JSON.stringify(PW)); } catch { } }
function pwRender() {
  const pane = $('panePower'), g = pwGroup(), tabOn = ['panePair', 'paneTrain', 'paneCam'].some(id => $(id).style.display !== 'none');
  if (!g || !tabOn) { pane.style.display = 'none'; return; }
  pane.style.display = 'flex';
  const p = pwCur(), force = pwLoadKind(design) === 'F';
  $('pwOn').checked = !!p.on; $('pwWrap').hidden = !p.on;
  if (!p.on) return;
  $('pwMotor').innerHTML = [['auto', '자동 추천 (전동)'], ...PW_MOTORS.map(id => [id, MOTORS[id].name])].map(([v, t]) => `<option value="${v}"${v === p.motor ? ' selected' : ''}>${t}</option>`).join('');
  $('pwEnd').value = p.end || 'auto';
  $('pwLoadL').textContent = force ? (design.kind === 'rack' ? '랙을 미는 힘' : '종동절이 미는 힘') : design.kind === 'cam' ? '흔들이 부하 토크' : '출력축 부하 토크';
  $('pwLoadU').textContent = force ? 'N' : 'N·cm';
  if (document.activeElement !== $('pwLoad')) $('pwLoad').value = force ? p.F : p.T;
  const W = model.power; if (!W) { $('pwRec').innerHTML = ''; $('pwHint').textContent = ''; return; }
  const pill = st => `<span class="pill" style="background:var(--${st === 'ok' ? 'ok' : st === 'warn' ? 'warn' : 'bad'});color:#fff">${st === 'ok' ? '적합' : st === 'warn' ? '주의' : '부적합'}</span>`;
  $('pwRec').innerHTML = W.opts.slice(0, 5).map(o => `<button class="alt" data-pw="${o.id}" aria-pressed="${o.id === W.sel.id}">${pill(o.st)}<span><b>${o.M.short}</b> · 입력 ${fmt(o.n, o.n < 20 ? 1 : 0)} rpm</span><small>토크 여유 ${fmt(o.margin, 1)}배${o.why ? ' · ' + o.why : ''}</small></button>`).join('');
  const made = model.parts.filter(q => /^power_/.test(q.file)).map(q => q.name);
  $('pwHint').textContent = `입력축에 필요한 토크 ${fmt(W.load.T / 10, 2)} N·cm · ${fmt(W.load.rpm, 1)} rpm. 만든 부품: ${made.join(', ')}. ${W.sel.M.kind === 'hand' ? '' : '모터는 회색 모형으로 보이며 출력하지 않습니다.'}`;
}
function pwApply() { pwSave(); if (design) setDesign(design, false); }
$('pwOn').onchange = () => { const p = pwCur(); if (!p) return; p.on = $('pwOn').checked; pwSave(); if (design) setDesign(design, true); };
$('pwMotor').onchange = () => { const p = pwCur(); if (!p) return; p.motor = $('pwMotor').value; pwApply(); };
$('pwEnd').onchange = () => { const p = pwCur(); if (!p) return; p.end = $('pwEnd').value; pwSave(); if (design) setDesign(design, true); };
$('pwLoad').oninput = () => { const p = pwCur(), v = num('pwLoad'); if (!p || !isFinite(v) || v < 0) return; p[pwLoadKind(design) === 'F' ? 'F' : 'T'] = v; clearTimeout(pwApply.h); pwApply.h = setTimeout(pwApply, 400); };
$('pwRec').onclick = e => { const b = e.target.closest('[data-pw]'), p = pwCur(); if (!b || !p) return; p.motor = b.dataset.pw; pwApply(); };
