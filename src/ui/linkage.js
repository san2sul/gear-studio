/* ---- 크랭크 기구 ---- */
let kD = null, kTimer = 0;
const LK_HINT = { slider: '크랭크가 돌면 연결 막대가 슬라이더를 앞뒤로 밉니다 (엔진·펌프·톱질 운동). 편심 e를 주면 갈 때와 올 때 속도가 달라집니다(급속귀환).',
  yoke: '크랭크 핀이 요크의 세로 홈을 밀어 요크가 정확한 사인 곡선으로 왕복합니다. 연결 막대가 없어 짧고, 행정은 크랭크 반지름의 두 배입니다.',
  fourbar: '네 막대(고정 a, 크랭크 b, 커플러 c, 흔들이 d)로 회전을 흔들림이나 특별한 곡선 운동으로 바꿉니다. 가장 짧은 막대를 크랭크로 두면 크랭크가 한 바퀴를 돕니다.',
  jansen: '테오 얀센의 다리 링크입니다. 크랭크 하나로 다리 끝이 바닥을 평평하게 밀고 들어 올리는 보행 궤적(빨간 선)을 그립니다. 크랭크 길이로 전체 크기가 정해집니다.',
  geneva: '구동판이 한 바퀴 도는 동안 핀이 바퀴 홈에 들어가 바퀴를 360/n° 돌리고, 나머지는 잠금 원판이 바퀴를 붙잡아 멈춥니다 (필름 이송·분할 테이블).',
  ratchet: '톱니바퀴가 한 방향(반시계)으로만 돌고, 거꾸로 돌리면 멈춤쇠가 톱니에 걸려 막습니다. 멈춤쇠 꼬리는 고무줄로 당겨 둡니다.',
  screw: '사다리꼴 나사를 돌리면 너트가 안내 기둥을 따라 곧게 오르내립니다. 리드(한 바퀴 이동량)가 작을수록 정밀하고 힘이 큽니다.',
  intgear: '이를 일부만 남긴 구동 기어가 한 바퀴 도는 동안, 남은 이가 지나갈 때만 종동 기어가 돌고 나머지는 멈춥니다 (간단한 간헐 이송).',
  vib: '반원 모양 추가 돌면 무게 중심이 원을 그려 바닥판 전체를 흔듭니다 (진동 모터·진동 피더·체). 빠를수록 세게 흔듭니다.',
  winch: '드럼이 줄을 감으면 도르래를 지나 짐(추)이 올라갑니다. 드럼 반지름이 작을수록 힘이 덜 들고 느리게 올라갑니다.',
  gripper: '4절 링크가 손가락 하나를 흔들고, 맞물린 기어가 다른 손가락을 반대로 돌려 두 손가락이 함께 집었다 놓습니다.',
  ujoint: '십자(스파이더)로 이은 두 요크가 꺾인 축 사이에 회전을 전합니다. 꺾일수록 출력 속도가 한 바퀴에 두 번 출렁입니다.',
  conveyor: '세로로 선 두 드럼에 벨트를 걸어 수평으로 돌립니다. 벨트의 밀대가 물건을 한 방향으로 계속 밀어 보냅니다.',
  diff: '모터가 캐리어를 돌리면 두 출력(아래 A, 위 B)이 함께 돌되, 한쪽이 느려지면 다른 쪽이 그만큼 빨라집니다 (자동차 바퀴 코너링). 평기어로 층을 쌓아 만듭니다.' };
const LK_FIELDS = { lkVR: ['vib', 'R'], lkVn: ['vib', 'n'], lkIm: ['intgear', 'm'], lkIz1: ['intgear', 'z1'], lkIk: ['intgear', 'k'], lkIz2: ['intgear', 'z2'], lkWr: ['winch', 'r'], lkWH: ['winch', 'H'], lkWL: ['winch', 'L'], lkWt: ['winch', 'travel'], lkGb: ['gripper', 'b'], lkGc: ['gripper', 'c'], lkGd: ['gripper', 'd'], lkGpa: ['gripper', 'a'], lkGm: ['gripper', 'm'], lkGz: ['gripper', 'z'], lkGL: ['gripper', 'Lf'], lkUb: ['ujoint', 'beta'], lkUH: ['ujoint', 'H'], lkUL: ['ujoint', 'L'], lkCR: ['conveyor', 'R'], lkCL: ['conveyor', 'L'], lkCh: ['conveyor', 'h'], lkCn: ['conveyor', 'n'], lkYr: ['yoke', 'r'], lkJm: ['jansen', 'm'], lkGn: ['geneva', 'n'], lkGa: ['geneva', 'a'], lkRz: ['ratchet', 'z'], lkRR: ['ratchet', 'R'], lkRh: ['ratchet', 'h'], lkRL: ['ratchet', 'L'], lkSdia: ['screw', 'd'], lkSp: ['screw', 'p'], lkSs: ['screw', 'starts'], lkSL: ['screw', 'len'], lkDm: ['diff', 'm'], lkDzs: ['diff', 'zs'], lkDzp: ['diff', 'zp'], lkDzm: ['diff', 'zm'], lkDzc: ['diff', 'zc'], lkDdv: ['diff', 'dv'], lkR: ['slider', 'r'], lkL: ['slider', 'L'], lkE: ['slider', 'e'], lkA: ['fourbar', 'a'], lkB: ['fourbar', 'b'], lkC: ['fourbar', 'c'], lkD: ['fourbar', 'd'], lkP: ['fourbar', 'p'], lkQ: ['fourbar', 'q'], lkW: [null, 'w'], lkT: [null, 't'], lkPin: [null, 'pinD'], lkSd: [null, 'sd'], lkRpm: [null, 'rpm'], lkGS: ['goal', 'stroke'], lkGW: ['goal', 'swing'], lkGQ: ['goal', 'Q'] };
function renderLinkForm() {
  const D = kD;
  $('lkTypeSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === D.type));
  $('lkHint').textContent = LK_HINT[D.type];
  linkFix(D);
  [['lkSlider', 'slider'], ['lkYoke', 'yoke'], ['lkFour', 'fourbar'], ['lkJansen', 'jansen'], ['lkGeneva', 'geneva'], ['lkRatchet', 'ratchet'], ['lkScrew', 'screw'], ['lkDiff', 'diff'], ['lkVib', 'vib'], ['lkInt', 'intgear'], ['lkWinch', 'winch'], ['lkGrip', 'gripper'], ['lkUj', 'ujoint'], ['lkConv', 'conveyor']].forEach(([id, ty]) => $(id).hidden = D.type !== ty);
  $('lkGoalFs').hidden = !['slider', 'yoke', 'fourbar'].includes(D.type);
  $('lkGSW').hidden = D.type === 'fourbar'; $('lkGWW').hidden = D.type !== 'fourbar'; $('lkGQ').closest('label').hidden = D.type === 'yoke';
  for (const [id, [g, k]] of Object.entries(LK_FIELDS)) $(id).value = g ? D[g][k] : D[k];
  renderLinkChart(); renderLinkDrive();
}
function linkDriveFix(D) { D.drive = Object.assign({ motor: 'none', F: 5, T: 5, mount: 'face', red: 'auto' }, D.drive || {}); return D; }
function renderLinkDrive() {
  const D = linkDriveFix(kD), dr = D.drive;
  $('lkMotor').value = dr.motor; $('lkF').value = dr.F; $('lkTq').value = dr.T; $('lkMount').value = dr.mount; $('lkRed').value = String(dr.red);
  const force = !!LK_FORCE[D.type]; $('lkFW').hidden = !force; $('lkTW').hidden = force;
  $('lkFL').textContent = { slider: '슬라이더 부하 힘', yoke: '요크 부하 힘', jansen: '다리 끝 힘', screw: '너트 미는 힘', winch: '들어 올릴 짐 (무게)', gripper: '손가락 끝 잡는 힘', conveyor: '벨트로 미는 힘' }[D.type] || '';
  $('lkTL').textContent = { fourbar: '흔들이 부하 토크', geneva: '바퀴 부하 토크', ratchet: '바퀴 부하 토크', diff: '출력 하나의 부하 토크', intgear: '종동 기어 부하 토크', vib: '마찰 토크', ujoint: '출력 부하 토크' }[D.type] || '';
  const sel = dr.motor === 'auto' || dr.motor === 'none' ? null : MOTORS[dr.motor];
  $('lkMount').disabled = !!sel && !canClamp(sel); $('lkSd').disabled = dr.motor !== 'none';
  if (dr.motor === 'none') { $('lkRec').innerHTML = ''; return; }
  const auto = dr.motor === 'auto', opts = linkMotorOptions(D), cur = auto ? opts[0] : opts.find(o => o.id === dr.motor), shown = recShown(opts, cur, auto);
  const sub = o => `<span><b>${o.M.short}</b>${o.red > 1 ? ` + 감속 ${o.red}:1` : ''} · 입력 ${fmt(o.n, o.n < 20 ? 1 : 0)} rpm</span><small>토크 여유 ${fmt(o.margin, 1)}배${o.why ? ' · ' + o.why : ''}</small>`;
  let html = shown.map((o, k) => recCard(o, cur, opts[0], sub(o)) + (k === 0 && !auto ? recNote(cur, auto) : '')).join('');
  // 부하를 줄여 지금 모터를 살리는 대안 (여유 1.5배가 되는 부하)
  if (cur && cur.margin < 1.5) {
    const force = !!LK_FORCE[D.type], key = force ? 'F' : 'T', v = Math.floor(dr[key] * cur.margin / 1.5 * 10) / 10;
    if (v > 0) html += `<button class="alt" data-load="${v}" data-key="${key}"><span class="pill" style="background:var(--steel);color:#fff">부하</span><span><b>${cur.M.short}</b> 그대로 · ${$(force ? 'lkFL' : 'lkTL').textContent} ${fmt(v, 1)} ${force ? 'N' : 'N·cm'}로 낮추기</span><small>지금 ${fmt(dr[key], 1)} → 여유 1.5배</small></button>`;
  }
  $('lkRec').innerHTML = html;
  $('lkRec').querySelectorAll('.alt').forEach(b => b.onclick = () => {
    if (b.dataset.load) { kD.drive[b.dataset.key] = +b.dataset.load; if (auto) kD.drive.motor = cur.id; } else kD.drive.motor = b.dataset.id;
    renderLinkDrive(); rebuildLink(); });
}
function renderLinkChart() {
  const svg = $('lkChart'), D = kD, M = linkMotion(D, 360);
  if (!M.ok) { svg.innerHTML = '<text x="170" y="95" font-size="12" text-anchor="middle" fill="var(--bad)">크랭크가 한 바퀴를 돌지 못하는 치수입니다</text>'; $('lkChartHint').textContent = ''; return; }
  const ys = M.y.slice(0, 361), lo = M.min - M.range * 0.12 - 1e-6, hi = M.max + M.range * 0.12 + 1e-6;
  const X0 = 34, X1 = 322, Y0 = 10, Y1 = 166, X = d => X0 + d / 360 * (X1 - X0), Y = v => Y1 - (v - lo) / (hi - lo) * (Y1 - Y0);
  const vm = Math.max(...M.v.map(Math.abs)) || 1, half = (Y1 - Y0) / 2 * 0.9;
  const path = ys.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  const vpath = M.v.concat([M.v[0]]).map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${((Y1 + Y0) / 2 - v / vm * half).toFixed(1)}`).join('');
  const ticks = [0, 90, 180, 270, 360].map(d => `<line x1="${X(d)}" x2="${X(d)}" y1="${Y0}" y2="${Y1}" stroke="var(--line)" stroke-width="0.6"/><text x="${X(d)}" y="${Y1 + 14}" font-size="10" text-anchor="middle" fill="var(--mute)">${d}°</text>`).join('');
  const yl = [lo, (lo + hi) / 2, hi].map(v => `<text x="${X0 - 4}" y="${Y(v) + 3}" font-size="10" text-anchor="end" fill="var(--mute)">${fmt(v, 0)}</text>`).join('');
  svg.innerHTML = `${ticks}${yl}<path d="${vpath}" fill="none" stroke="var(--steel)" stroke-dasharray="4 3" stroke-width="1.2"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.2"/>`;
  const fr = `전진 ${fmt(M.fwdDeg, 0)}° / 귀환 ${fmt(360 - M.fwdDeg, 0)}°`;
  $('lkChartHint').textContent = ({
    slider: `실선: 슬라이더 위치(mm), 점선: 속도. 가로축은 크랭크 각도. 행정 ${fmt(M.range, 1)} mm, ${fr}.`,
    yoke: `실선: 요크 위치(mm), 점선: 속도. 순수한 사인 운동이라 전진·귀환이 같습니다. 행정 ${fmt(M.range, 1)} mm.`,
    fourbar: `실선: 흔들이 각도(°), 점선: 각속도. 흔들림 ${fmt(M.range, 1)}°, ${fr} (크랭크 각).`,
    jansen: `실선: 발끝 높이(mm), 점선: 수직 속도. 들어 올림 ${fmt(M.range, 1)} mm. 발이 바닥에 닿아 있는 구간이 평평하게 보입니다.`,
    geneva: `실선: 휠 각도(°), 점선: 각속도. 입력 한 바퀴에 ${fmt(M.range, 1)}° 돌고 나머지는 멈춰 있습니다.`,
    ratchet: `실선: 래칫 휠 각도(°), 점선: 각속도. 레버 한 번 왕복에 ${fmt(M.range, 1)}° 전진하고 되돌아가지 않습니다.`,
    screw: `실선: 너트 위치(mm), 점선: 속도. 입력 한 바퀴에 ${fmt(M.range, 1)} mm 이동합니다.`,
    intgear: `실선: 종동 기어 각도(°), 점선: 각속도. 입력 한 바퀴에 ${fmt(M.max - M.min, 1)}° 돌고 나머지는 멈춰 있습니다.`,
    vib: `실선: 위아래로 흔드는 힘(N), 점선: 그 변화. 한 바퀴에 한 번 오르내리며, 최대 ${fmt(M.max, 3)} N입니다 (회전수 제곱에 비례).`,
    winch: `실선: 짐 높이(mm), 점선: 속도. 드럼 한 바퀴에 ${fmt(M.max - M.min, 1)} mm 올라갑니다.`,
    gripper: `실선: 두 손가락 사이(mm), 점선: 벌어지는 속도. ${fmt(M.min, 1)} mm까지 오므렸다 ${fmt(M.max, 1)} mm까지 벌립니다.`,
    ujoint: `실선: 출력 각도(°), 점선: 출력 속도 비. 직선에서 조금씩 벗어나는 만큼 출력이 출렁입니다.`,
    conveyor: `실선: 밀대 이동 거리(mm), 점선: 속도. 드럼 한 바퀴에 ${fmt(M.max - M.min, 1)} mm 보냅니다.`,
    diff: `실선: 출력 A 각도(°), 점선: 각속도. 입력 한 바퀴에 A가 ${fmt(M.range, 1)}° 돕니다. B는 3D 화면에서 확인하세요.`
  })[D.type] || '';
}
function rebuildLink(delay = 0, refit = false) {
  clearTimeout(kTimer);
  kTimer = setTimeout(() => { alts = []; $('altBox').innerHTML = ''; try { setDesign(JSON.parse(JSON.stringify(kD)), refit); } catch (e) { toast('이 기구는 만들 수 없습니다: ' + (e && e.message || e)); } }, delay);
}
$('tabLink').onclick = () => selectTab('link');
$('lkTypeSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; kD.type = b.dataset.v; renderLinkForm(); rebuildLink(0, true); });
$('paneLink').addEventListener('input', e => { const f = LK_FIELDS[e.target.id]; if (!f) return; const v = num(e.target.id); if (!isFinite(v)) return;
  if (f[0]) kD[f[0]][f[1]] = v; else kD[f[1]] = v; renderLinkChart(); if (f[0] !== 'goal') { renderLinkDrive(); rebuildLink(350); } });
['lkMotor', 'lkMount', 'lkRed'].forEach(id => $(id).addEventListener('change', () => { linkDriveFix(kD); kD.drive[{ lkMotor: 'motor', lkMount: 'mount', lkRed: 'red' }[id]] = $(id).value; renderLinkDrive(); rebuildLink(); }));
['lkF', 'lkTq'].forEach(id => $(id).addEventListener('input', () => { const v = num(id); if (!(v >= 0)) return; linkDriveFix(kD); kD.drive[id === 'lkF' ? 'F' : 'T'] = v; renderLinkDrive(); rebuildLink(350); }));
$('lkSynth').onclick = () => { $('lkSynth').disabled = true; $('lkSynth').textContent = '찾는 중…';
  setTimeout(() => { try { kD = linkSynth(kD); renderLinkForm(); const M = linkMotion(kD);
    $('lkSynthMsg').textContent = M.ok ? (kD.type === 'yoke' ? `행정 ${fmt(M.range, 1)} mm로 맞췄습니다.` : kD.type === 'slider' ? `행정 ${fmt(M.range, 1)} mm, 급속귀환비 ${fmt(M.Q, 2)}로 맞췄습니다.` : `흔들림 ${fmt(M.range, 1)}°, 급속귀환비 ${fmt(M.Q, 2)}, 전달각 ${fmt(M.muMin, 0)}~${fmt(M.muMax, 0)}°로 맞췄습니다.`) : '맞는 치수를 찾지 못했습니다. 목표를 조금 바꿔 보세요.';
    rebuildLink(); } finally { $('lkSynth').disabled = false; $('lkSynth').textContent = '목표에 맞춰 치수 찾기'; } }, 20); };