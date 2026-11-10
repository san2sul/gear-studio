/* ---- 동작으로 찾기 ---- */
const PQ = { m: 1.5, pa: 20, b: 8, bl: 0.1, x1: 0, x2: 0, bore1: 5, bore2: 5, d1: true, d2: true, on2: true, autoX: true, rpm: 60, helix: 0, herring: false };
const lkD = t => { const D = linkageDefault(); D.type = t; D.drive.motor = 'none'; return D; };
const MECH = {
  spur: { t: '평기어 감속', s: '속도를 줄이고 힘을 키움', go: 'box:reduce', mk: () => pairDesign({ ...PQ, z1: 12, z2: 30 }) },
  increase: { t: '증속 기어', s: '느린 입력 → 빠른 출력', go: 'box:increase', mk: () => pairDesign({ ...PQ, z1: 30, z2: 12 }) },
  reverse: { t: '방향 반전', s: '회전 방향을 거꾸로', go: 'box:reverse', mk: () => pairDesign({ ...PQ, z1: 18, z2: 18 }) },
  bevel: { t: '베벨기어', s: '회전축을 직각으로', go: 'pair:bevel', mk: () => bevelPair({ ...PQ, z1: 16, z2: 24, F: 8, hub: 0, spiral: 0 }) },
  worm: { t: '웜기어', s: '큰 감속 · 거꾸로 안 돎', go: 'pair:worm', mk: () => wormPair({ m: 1.5, pa: 20, b: 0, bl: 0.1, n: 1, q: 10, z2: 24, Lw: 0, bore1: 5, bore2: 5, rpm: 60 }) },
  rack: { t: '랙과 피니언', s: '회전 ↔ 직선 이동', go: 'pair:rack', mk: () => rackPair({ ...PQ, z1: 14, nR: 20, H: 5 }) },
  planet: { t: '유성기어', s: '같은 축에서 큰 감속 · 교반', go: 'pair:planet', mk: () => planetaryPair({ m: 1.5, pa: 20, b: 8, bl: 0.1, zs: 12, zp: 12, N: 3, sunBore: 5, pinD: 3, rpm: 60 }) },
  belt: { t: '풀리·벨트', s: '떨어진 축으로 회전 전달', go: 'box:transfer', note: '기어박스 탭의 동력원에서 연결 방식을 벨트로 고르세요' },
  slider: { t: '크랭크·슬라이더', s: '회전 → 직선 왕복 (피스톤)', go: 'link:slider', mk: () => lkD('slider') },
  yoke: { t: '스카치 요크', s: '연속 회전 → 직선 왕복', go: 'link:yoke', mk: () => lkD('yoke') },
  fourbar: { t: '4절 링크', s: '회전 → 요동 또는 복잡한 궤적', go: 'link:fourbar', mk: () => lkD('fourbar') },
  cam: { t: '캠과 종동절', s: '회전 → 정해진 변위·정지·왕복', go: 'cam', mk: () => camDefault() },
  geneva: { t: '제네바 기구', s: '연속 회전 → 간헐 회전', go: 'link:geneva', mk: () => lkD('geneva') },
  screw: { t: '리드스크루', s: '회전 → 정밀 직선 이동', go: 'link:screw', mk: () => lkD('screw') },
  ratchet: { t: '래칫 기구', s: '한 방향 운동 허용·역회전 방지', go: 'link:ratchet', mk: () => lkD('ratchet') },
  jansen: { t: '얀센 링크', s: '회전 → 보행 동작', go: 'link:jansen', mk: () => lkD('jansen') },
  diff: { t: '차동 기어', s: '하나의 입력 → 서로 다른 두 출력', go: 'link:diff', mk: () => lkD('diff') },
  vib: { t: '편심추 진동', s: '회전 → 빠른 진동', soon: true }, intgear: { t: '간헐 기어', s: '이 빠진 기어로 돌다 멈춤', soon: true },
  winch: { t: '윈치·도르래', s: '줄을 감아 들어 올림', soon: true }, gripper: { t: '그리퍼', s: '집기·놓기', soon: true },
  ujoint: { t: '유니버설 조인트', s: '꺾인 축으로 회전 전달', soon: true }, conveyor: { t: '벨트 컨베이어', s: '연속 이송', soon: true }
};
const FIND_MOTION = [['① 연속 회전', '선풍기, 바퀴, 믹서, 컨베이어 롤러', ['spur', 'planet', 'belt', 'conveyor']], ['② 직선 운동', '자동문, 슬라이딩 테이블, 프린터 헤드, 승강 장치', ['rack', 'screw', 'conveyor']],
  ['③ 직선 왕복', '피스톤, 왕복 펌프, 왕복 톱', ['slider', 'yoke', 'cam']], ['④ 회전 왕복 (요동)', '와이퍼, 흔들 의자, 로봇 관절', ['fourbar', 'cam']],
  ['⑤ 간헐 운동·정지', '필름 이송, 자동 포장기, 회전 작업대', ['geneva', 'ratchet', 'cam', 'intgear']], ['⑥ 진동', '진동 선별기, 진동 피더, 마사지기', ['vib', 'cam']]];
const FIND_FUNC = [['회전 변환', '감속, 증속, 역회전, 직각 회전', ['spur', 'increase', 'reverse', 'bevel', 'worm']], ['방향 전환', '회전축 방향 바꾸기', ['bevel', 'ujoint']],
  ['밀기·당기기', '전진, 후진, 압축, 인장', ['rack', 'screw']], ['들어 올리기', '승강, 하강, 높이 조절', ['screw', 'worm', 'winch']], ['잡기·놓기', '집기, 파지, 해제', ['gripper', 'cam']],
  ['열기·닫기', '문, 뚜껑, 집게 개폐', ['fourbar', 'rack']], ['접기·펼치기', '다리, 날개, 지지대 전개', ['fourbar', 'jansen']], ['회전 위치 결정', '일정 각도 회전 후 정지', ['geneva', 'ratchet']],
  ['흔들기', '좌우·상하 반복 요동', ['fourbar', 'cam']], ['두드리기', '반복 타격, 누르기', ['cam', 'slider']], ['절단·가공', '자르기, 뚫기, 이송', ['slider', 'screw', 'increase']],
  ['이송·운반', '연속·간헐 이송', ['conveyor', 'geneva', 'ratchet']], ['혼합·교반', '젓기, 회전 혼합', ['planet', 'diff']], ['펌핑', '흡입, 압축, 토출', ['slider', 'yoke']],
  ['보행·이동', '걷기, 구르기', ['jansen', 'spur']], ['궤적 생성', '원, 타원, 곡선 경로', ['fourbar', 'cam', 'jansen']]];
const thumbCache = new Map(); let thumbR = null, thumbQ = [];
function thumbOf(id) {
  if (thumbCache.has(id) || !MECH[id].mk || !window.THREE) return;
  if (!thumbR) { thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); thumbR.setSize(300, 200, false); }
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.8));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.75); d1.position.set(1, -1.5, 2.5); sc.add(d1);
  const g = new THREE.Group(); sc.add(g);
  try {
    const M = buildModel(MECH[id].mk());
    M.parts.forEach((p, k) => { const m = new THREE.Mesh(trisToGeom(p.tris), new THREE.MeshStandardMaterial({ color: new THREE.Color(partColor(k)), metalness: 0.15, roughness: 0.55, side: THREE.DoubleSide })); m.matrixAutoUpdate = false; m.matrix.copy(toM4(p.motion(0))); g.add(m); });
    if (M.frame) M.housing.filter(h => h.assembly !== false).forEach(h => g.add(new THREE.Mesh(trisToGeom(h.tris), new THREE.MeshStandardMaterial({ color: new THREE.Color(css('--mute')), transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }))));
    const cam = new THREE.PerspectiveCamera(35, 1.5, 0.5, 5000); cam.up.set(0, 0, 1);
    const b = new THREE.Box3().setFromObject(g), c = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).length() / 2, dist = r / Math.sin(17.5 * D2R) * 0.8;
    cam.position.set(c.x + dist * 0.35, c.y - dist * 0.7, c.z + dist * 0.62); cam.lookAt(c);
    thumbR.render(sc, cam); thumbCache.set(id, thumbR.domElement.toDataURL('image/png'));
  } catch (e) { thumbCache.set(id, null); }
  g.traverse(o => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); });
}
function findGo(id) {
  const M = MECH[id]; if (!M || M.soon) return;
  const [tab, v] = M.go.split(':');
  if (tab === 'link') { selectTab('link'); kD.type = v; renderLinkForm(); rebuildLink(0, true); }
  else if (tab === 'pair') { selectTab('pair'); setType(v); runPair(); }
  else if (tab === 'box') { selectTab('box'); setFunc(v); runBox(false); }
  else selectTab(tab);
  if (M.note) toast(M.note);
}
function renderFind() {
  const card = id => { const M = MECH[id], src = thumbCache.get(id);
    return `<button class="fcard" data-id="${id}"${M.soon ? ' disabled' : ''}>${src ? `<img alt="" src="${src}">` : '<span class="ph"></span>'}<b>${M.t}${M.soon ? ' (준비 중)' : ''}</b><small>${M.s}</small></button>`; };
  $('findGallery').innerHTML = Object.keys(MECH).map(card).join('');
  const rows = L => L.map(([t, ex, ids]) => `<div class="frow"><b>${t}</b><p>${ex}</p><div class="chips">${ids.map(id => `<button class="chip" data-id="${id}"${MECH[id].soon ? ' disabled title="준비 중"' : ''}>${MECH[id].t}</button>`).join('')}</div></div>`).join('');
  $('findMotion').innerHTML = rows(FIND_MOTION); $('findFunc').innerHTML = rows(FIND_FUNC);
  $('paneFind').querySelectorAll('[data-id]').forEach(b => b.onclick = () => findGo(b.dataset.id));
  // 그림은 하나씩 천천히 만들어 화면이 멈추지 않게 함
  thumbQ = Object.keys(MECH).filter(id => MECH[id].mk && !thumbCache.has(id));
  const step = () => { if (!thumbQ.length || $('paneFind').style.display === 'none') return; const id = thumbQ.shift(); thumbOf(id);
    const img = thumbCache.get(id), el = $('findGallery').querySelector(`[data-id="${id}"] .ph`);
    if (img && el) el.outerHTML = `<img alt="" src="${img}">`; setTimeout(step, 30); };
  setTimeout(step, 60);
}
$('tabFind').onclick = () => selectTab('find');
$('tabBox').onclick = () => selectTab('box');
$('tabPair').onclick = () => selectTab('pair');
$('tabTrain').onclick = () => selectTab('train');
$('tabCam').onclick = () => selectTab('cam');
function setFunc(v) {
  func = v; $('funcSeg').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === v));
  $('funcHint').textContent = FUNC_HINT[func];
  const hasRatio = ['reduce', 'increase', 'planetary', 'rightangle'].includes(func);
  $('ratioWrap').style.opacity = hasRatio ? 1 : 0.4; $('bRatio').disabled = !hasRatio;
  const hasDir = ['reduce', 'increase', 'transfer'].includes(func);
  $('dirWrap').style.opacity = hasDir ? 1 : 0.4; $('bDir').disabled = !hasDir;
  if (func === 'reverse') $('bDir').value = 'opposite';
  $('ratioUnit').textContent = func === 'increase' ? '출력이 n배 빠름' : func === 'rightangle' ? '입력 : 출력 = n : 1 (n<1 가속)' : '입력 : 출력 = n : 1';
  if (func === 'planetary' && (num('bRatio') < 3 || num('bRatio') > 5)) $('bRatio').value = 4;
  if (func === 'rightangle' && num('bRatio') > 3) $('bRatio').value = 2;
  if ($('dOn') && $('dOn').checked) $('bRatio').disabled = true;
}
$('funcSeg').querySelectorAll('button').forEach(b => b.onclick = () => setFunc(b.dataset.v));
function updateRWInfo() {
  const m = num('pM');
  if (ptype === 'rack') $('rInfo').textContent = `피니언 1바퀴에 랙이 ${fmt(PI * m * Math.round(num('rZ')), 2)} mm 움직입니다. 랙 길이 ${fmt(PI * m * Math.round(num('rN')), 1)} mm. 이 폭은 위 공통 값을 씁니다.`;
  if (ptype === 'cycloid') { const N = Math.round(num('yN')), R = num('yR'), e = num('yE');
    $('yInfo').textContent = `변속비 ${N - 1} : 1 (원판 로브 ${N - 1}개) · 편심 한계 R/N = ${fmt(R / N, 2)} mm${e >= R / N ? ' ✗ 편심을 줄이세요' : ' ✓'} · 링 핀은 하우징과 한 몸으로 출력됩니다.`; }
  if (ptype === 'worm') { const n = +$('wN').value, q = num('wQ'), z = Math.round(num('wZ')), g = Math.atan(n / q) / D2R;
    $('wInfo').textContent = `변속비 ${fmt(z / n, 2)} : 1 · 리드각 ${fmt(g, 1)}° (${g < 6 ? '역회전 잠김' : '역회전 가능'}) · 중심거리 ${fmt((q + z) * m / 2, 2)} mm. 이 폭(0=자동)은 휠 폭입니다. 모듈은 웜 축방향 모듈.`; }
}
function setType(v) {
  ptype = v; $('typeSeg').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === v));
  const bevel = v === 'bevel', planet = v === 'planet', rack = v === 'rack', worm = v === 'worm', cyc = v === 'cycloid';
  $('fsSpur').style.display = planet || rack || worm || cyc ? 'none' : 'flex';
  $('fsCyc').style.display = cyc ? 'flex' : 'none'; $('pCommon').hidden = cyc; $('fsPlanet').style.display = planet ? 'flex' : 'none';
  $('fsRack').style.display = rack ? 'flex' : 'none'; $('fsWorm').style.display = worm ? 'flex' : 'none';
  if (worm && num('pB') > 0 && num('pB') < 6) $('pB').value = 0;
  if (rack && !(num('pB') > 0)) $('pB').value = 8;
  updateRWInfo();
  ['pX1Wrap', 'pX2Wrap', 'pAutoXWrap', 'pOn2Wrap', 'pHelixWrap'].forEach(id => $(id).hidden = bevel);
  $('pHubWrap').hidden = !bevel; $('pSpiralWrap').hidden = !bevel;
  $('pBUnit').textContent = bevel ? 'F, mm (0 = 원추거리의 1/3)' : 'b, mm';
  $('lg1').textContent = bevel ? '기어 1 (구동, 수직축)' : '기어 1 (구동)';
  $('lg2').textContent = bevel ? '기어 2 (피동, 수평축)' : '기어 2 (피동)';
  if (bevel) { $('pB').value = 0; if (num('pZ2') > 3 * num('pZ1')) $('pZ2').value = 2 * num('pZ1'); }
  else if (!(num('pB') > 0)) $('pB').value = 8;
  if (planet) updatePlanetInfo();
}
$('typeSeg').querySelectorAll('button').forEach(b => b.onclick = () => setType(b.dataset.v));
['qZs', 'qZp', 'qN'].forEach(id => $(id).oninput = updatePlanetInfo);
['rZ', 'rN', 'wN', 'wQ', 'wZ', 'pM', 'yN', 'yR', 'yE'].forEach(id => $(id).addEventListener('input', updateRWInfo));
setFunc('reduce');
$('runBox').onclick = () => runBox(false);
$('runPair').onclick = runPair;
$('play').onclick = () => { playing = !playing; $('play').textContent = playing ? '일시정지' : '재생'; };
$('showBox').onchange = () => { if (boxGroup) boxGroup.visible = $('showBox').checked; };
$('fit').onclick = fitView;
$('check').onclick = () => {
  if (!model || !model.interference) return;
  const r = model.interference();
  const extra = r.map(x => ({ st: x.hits ? 'bad' : 'ok', txt: x.hits ? `${x.pair} 회전 중 간섭 <em>${x.hits}/${x.steps}</em> 위치. 백래시를 늘리세요.` : `${x.pair} 한 피치 회전 동안 치형 간섭 없음 (<em>${x.steps}</em>개 위치 검사)` }));
  renderReport(extra);
  toast(r.some(x => x.hits) ? '간섭이 발견되었습니다' : '간섭 없이 맞물려 돕니다');
};
$('expZip').onclick = exportZip;
$('expJson').onclick = () => design && saveFile(baseName() + '.json', JSON.stringify(design, null, 2));
$('impJson').onclick = () => $('fileIn').click();
$('fileIn').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const D = JSON.parse(await f.text());
    const ok = D.kind === 'linkage' ? D.type && (D.slider || D.fourbar) : D.kind === 'cycloid' ? D.N && D.R : D.kind === 'cam' ? D.motion && D.camType : D.kind === 'train' ? Array.isArray(D.stages) && D.input : D.kind === 'rack' ? D.z1 && D.nR : D.kind === 'worm' ? D.n && D.z2 : D.kind === 'bevel' ? D.z1 && D.z2 : D.kind === 'planetary' ? D.zs && D.zp : D.gears && D.shafts;
    if (!ok) throw 0;
    alts = []; $('altBox').innerHTML = '';
    if (D.kind === 'train') { tD = D; selectTab('train'); }
    if (D.kind === 'cam') { cD = D; selectTab('cam'); }
    if (D.kind === 'linkage') { kD = linkDriveFix(D); selectTab('link'); }
    setDesign(JSON.parse(JSON.stringify(D))); toast('설계 파일을 불러왔습니다');
  } catch { toast('설계 파일 형식이 아닙니다. 이 앱에서 저장한 .json 파일을 여세요.'); }
  e.target.value = '';
};
