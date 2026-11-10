/* ================= 동력원·부하·제어 =================
 대표값입니다(같은 이름도 제품마다 다름). 토크 T는 N·mm, 회전수는 부하가 걸린 상태의 대략값.
 holes: 축 중심 기준 나사 구멍 위치(mm), screw: 구멍 지름, headH: 나사 머리 높이, boss: 모터 앞면의 돌출 원통 */
const MOTORS = {
  nema17: { name: 'NEMA17 스테퍼 (17HS4401급, 12 V)', short: 'NEMA17', kind: 'stepper', volt: 12, amp: 1.7, rpmLo: 5, rpmHi: 600, rpmGood: 150, steps: 200,
    torqueAt: n => n <= 150 ? 300 : Math.max(110, 300 - (n - 150) * 0.42),
    shaft: { d: 5, dcut: 0.5, len: 22 }, boss: { d: 22, h: 2 }, holes: [[15.5, 15.5], [-15.5, 15.5], [-15.5, -15.5], [15.5, -15.5]], screw: 3.4, headH: 2.0, screwName: 'M3',
    body: { type: 'box', w: 42.3, h: 42.3, L: 40, cx: 0, cy: 0 }, driver: 'A4988' },
  byj48: { name: '28BYJ-48 스테퍼 (5 V)', short: '28BYJ-48', kind: 'stepper', volt: 5, amp: 0.24, rpmLo: 1, rpmHi: 15, rpmGood: 10, steps: 4096,
    torqueAt: n => n <= 8 ? 30 : Math.max(14, 30 - (n - 8) * 2.2),
    shaft: { d: 5, dcut: 1, dd: true, len: 9 }, boss: { d: 9.5, h: 1.5 }, holes: [[17.5, -8], [-17.5, -8]], screw: 4.2, headH: 2.8, screwName: 'M4',
    body: { type: 'cyl', r: 14, L: 19, cx: 0, cy: -8 }, driver: 'ULN2003' },
  n20_30: { name: 'N20 기어드 DC 30 rpm (6 V)', short: 'N20 30rpm', kind: 'dc', volt: 6, amp: 0.1, rpm: 25, rpmNL: 30, T: 90,
    shaft: { d: 3, dcut: 0.5, len: 9 }, boss: { d: 4, h: 0.8 }, holes: [[4.5, 0], [-4.5, 0]], screw: 1.8, headH: 1.2, screwName: 'M1.6',
    body: { type: 'flatcyl', r: 6, flat: 5, L: 24 }, driver: 'TB6612FNG' },
  n20_100: { name: 'N20 기어드 DC 100 rpm (6 V)', short: 'N20 100rpm', kind: 'dc', volt: 6, amp: 0.1, rpm: 80, rpmNL: 100, T: 35,
    shaft: { d: 3, dcut: 0.5, len: 9 }, boss: { d: 4, h: 0.8 }, holes: [[4.5, 0], [-4.5, 0]], screw: 1.8, headH: 1.2, screwName: 'M1.6',
    body: { type: 'flatcyl', r: 6, flat: 5, L: 24 }, driver: 'TB6612FNG' },
  n20_300: { name: 'N20 기어드 DC 300 rpm (6 V)', short: 'N20 300rpm', kind: 'dc', volt: 6, amp: 0.1, rpm: 240, rpmNL: 300, T: 15,
    shaft: { d: 3, dcut: 0.5, len: 9 }, boss: { d: 4, h: 0.8 }, holes: [[4.5, 0], [-4.5, 0]], screw: 1.8, headH: 1.2, screwName: 'M1.6',
    body: { type: 'flatcyl', r: 6, flat: 5, L: 24 }, driver: 'TB6612FNG' },
  m130: { name: '130 DC 모터 (3 V, 기어 없음)', short: '130 DC', kind: 'dc', volt: 3, amp: 0.5, rpm: 7000, rpmNL: 9000, T: 0.5,
    shaft: { d: 2, dcut: 0, len: 8 }, boss: { d: 6.5, h: 1.5 }, holes: [[7.5, 0], [-7.5, 0]], screw: 2.2, headH: 1.4, screwName: 'M2',
    body: { type: 'flatcyl', r: 10.2, flat: 7.6, L: 25 }, driver: 'TB6612FNG' },
  sg90c: { name: 'SG90 연속 회전 서보 (360°형, 5 V)', short: 'SG90 360°', kind: 'servo', cont: true, volt: 5, amp: 0.7, rpm: 40, rpmNL: 55, T: 70,
    shaft: { d: 4.8, len: 3 }, boss: { d: 11.8, h: 4 }, holes: [], screw: 2, headH: 0, screwName: 'M2',
    servo: { bw: 22.8, bh: 12.4, ox: -5.9, ew: 32.3, ears: [[-5.9 - 13.9, 0], [-5.9 + 13.9, 0]], pilot: 1.7, top: 6.6, L: 22.8, center: 2.3, screwName: 'M2', centerName: 'M2' }, driver: 'servo' },
  mg996c: { name: 'MG996R 연속 회전 서보 (360°형, 6 V)', short: 'MG996R 360°', kind: 'servo', cont: true, volt: 6, amp: 2.5, rpm: 50, rpmNL: 62, T: 350,
    shaft: { d: 5.9, len: 4 }, boss: { d: 14, h: 5 }, holes: [], screw: 3, headH: 0, screwName: 'M3',
    servo: { bw: 40.7, bh: 19.7, ox: -10.2, ew: 54.5, ears: [[-10.2 - 24.2, -5], [-10.2 - 24.2, 5], [-10.2 + 24.2, -5], [-10.2 + 24.2, 5]], pilot: 2.6, top: 10.5, L: 37.2, center: 3.2, screwName: 'M3', centerName: 'M3' }, driver: 'servo' },
  sg90: { name: 'SG90 각도 서보 (0~180°, 5 V)', short: 'SG90', kind: 'servo', cont: false, volt: 5, amp: 0.7, rpm: 100, rpmNL: 100, T: 70,
    shaft: { d: 4.8, len: 3 }, boss: { d: 11.8, h: 4 }, holes: [], screw: 2, headH: 0, screwName: 'M2',
    servo: { bw: 22.8, bh: 12.4, ox: -5.9, ew: 32.3, ears: [[-5.9 - 13.9, 0], [-5.9 + 13.9, 0]], pilot: 1.7, top: 6.6, L: 22.8, center: 2.3, screwName: 'M2', centerName: 'M2' }, driver: 'servo' },
  mg996: { name: 'MG996R 각도 서보 (0~180°, 6 V)', short: 'MG996R', kind: 'servo', cont: false, volt: 6, amp: 2.5, rpm: 120, rpmNL: 120, T: 350,
    shaft: { d: 5.9, len: 4 }, boss: { d: 14, h: 5 }, holes: [], screw: 3, headH: 0, screwName: 'M3',
    servo: { bw: 40.7, bh: 19.7, ox: -10.2, ew: 54.5, ears: [[-10.2 - 24.2, -5], [-10.2 - 24.2, 5], [-10.2 + 24.2, -5], [-10.2 + 24.2, 5]], pilot: 2.6, top: 10.5, L: 37.2, center: 3.2, screwName: 'M3', centerName: 'M3' }, driver: 'servo' },
  m370: { name: '370 DC 모터 (6~12 V, 기어 없음)', short: '370 DC', kind: 'dc', volt: 12, amp: 0.8, rpm: 4500, rpmNL: 5500, T: 5,
    shaft: { d: 2.3, dcut: 0, len: 10 }, boss: { d: 10, h: 2 }, holes: [[8.5, 0], [-8.5, 0]], screw: 2.7, headH: 1.8, screwName: 'M2.5',
    body: { type: 'flatcyl', r: 12.2, flat: 10.5, L: 30.5 }, driver: 'TB6612FNG' },
  m775: { name: '775 DC 모터 (12~24 V, 기어 없음)', short: '775 DC', kind: 'dc', volt: 12, amp: 3, rpm: 8000, rpmNL: 10000, T: 40, bigAmp: true,
    shaft: { d: 5, dcut: 0, len: 17 }, boss: { d: 17.5, h: 4.5 }, holes: [[14.5, 0], [-14.5, 0]], screw: 4.2, headH: 2.8, screwName: 'M4',
    body: { type: 'cyl', r: 21, L: 66, cx: 0, cy: 0 }, driver: 'TB6612FNG' },
  tt: { name: 'TT 기어드 DC 모터 (3~6 V, 1:48)', short: 'TT 모터', kind: 'dc', volt: 6, amp: 0.25, rpm: 150, rpmNL: 200, T: 80,
    shaft: { d: 5.4, dcut: 0.85, dd: true, len: 9 }, boss: { d: 7, h: 1 }, holes: [[-14, 0], [-31, 0]], screw: 3.2, headH: 2.0, screwName: 'M3',
    body: { type: 'box', w: 64.5, h: 22.5, L: 18.8, cx: -21.25, cy: 0 }, driver: 'TB6612FNG' },
  crank: { name: '손 크랭크 (팔 40 mm, 손힘 20 N)', short: '손 크랭크', kind: 'hand', rpm: 60, T: 800, arm: 40, att: 'crank' },
  handwheel: { name: '핸드휠 (지름 100 mm, 손힘 20 N)', short: '핸드휠', kind: 'hand', rpm: 30, T: 1000, arm: 50, att: 'wheel' },
  spring: { name: '태엽 동력 모듈 (장난감용, 한 번 감아 약 20초)', short: '태엽', kind: 'hand', rpm: 60, T: 40, att: 'flange', src: '태엽 모듈 출력축',
    note: '태엽은 풀릴수록 힘이 줄어듭니다. 토크는 다 감았을 때의 대략값이고, 끝 무렵에는 절반 이하로 떨어집니다.' },
  water: { name: '소형 수차 (수돗물 낙차 0.5 m, 약 0.5 W)', short: '수차', kind: 'hand', rpm: 60, T: 80, att: 'flange', src: '수차 축',
    note: '수차는 물 양과 낙차에 따라 힘이 크게 달라집니다. 회전수와 토크를 직접 재서 넣으려면 "직접 입력"을 쓰세요. 물이 튀는 쪽에 기어가 젖지 않게 막으세요.' },
  wind: { name: '소형 풍차 (날개 지름 200 mm, 바람 5 m/s, 약 0.5 W)', short: '풍차', kind: 'hand', rpm: 400, T: 12, att: 'flange', src: '풍차 날개 축',
    note: '풍차의 힘은 바람 속도의 세제곱에 비례합니다(바람이 두 배면 힘은 약 8배). 약한 바람에서는 크게 줄어듭니다.' },
  air: { name: '소형 공압 모터 (0.5 MPa 압축공기)', short: '공압 모터', kind: 'hand', rpm: 3000, T: 200, att: 'flange', src: '공압 모터 축',
    note: '공압 모터는 빠르고 힘이 커서 출력한 기어가 쉽게 닳습니다. 감압 밸브로 압력을 낮춰 시작하고, 배기 소음에 대비하세요.' },
  stirling: { name: '스털링 엔진 모형 (알코올 램프, 약 0.3 W)', short: '스털링 엔진', kind: 'hand', rpm: 500, T: 6, att: 'flange', src: '스털링 엔진 플라이휠 축',
    note: '불을 쓰므로 PLA 부품을 엔진 열원에서 멀리 두고(60 °C에서 휨), 어른이 지켜보는 곳에서 쓰세요.' },
  steam: { name: '증기기관 모형 (약 1 W)', short: '증기기관', kind: 'hand', rpm: 800, T: 12, att: 'flange', src: '증기기관 플라이휠 축',
    note: '뜨거운 증기와 불을 씁니다. 출력한 부품은 보일러에서 멀리 두고, 어른이 지켜보는 곳에서 쓰세요.' },
  engine: { name: '소형 가솔린 엔진 (25~50 cc, 약 1 kW)', short: '가솔린 엔진', kind: 'hand', rpm: 6000, T: 1500, att: 'flange', src: '엔진 출력축', danger: true,
    note: '실제 엔진은 힘과 속도가 커서 출력한 플라스틱 기어·축으로는 위험합니다. 이 앱의 결과는 모양 확인용으로만 쓰고, 실제 동력 전달은 금속 기어와 전문 설계를 쓰세요.' },
  custom: { name: '직접 입력한 DC 모터', short: '내 모터', kind: 'dc' }
};
const BEARINGS = { 3: ['623', 10, 4], 4: ['624', 13, 5], 5: ['625', 16, 5], 6: ['626', 19, 6], 7: ['627', 22, 7], 8: ['608', 22, 7] };
function motorOf(dr) {
  if (!dr) return null;
  if (dr.motor === 'custom') { const c = dr.custom || {};
    const d = +c.d || 3, flat = Math.max(0, +c.dcut || 0), sp = +c.pitch || 0;
    return { ...MOTORS.custom, volt: +c.volt || 6, amp: 0.5, rpm: +c.rpm || 100, rpmNL: (+c.rpm || 100) * 1.2, T: +c.T || 20,
      shaft: { d, dcut: flat, len: +c.len || 8 }, boss: { d: +c.boss || d + 2, h: 1 }, holes: sp > 0 ? [[sp / 2, 0], [-sp / 2, 0]] : [], screw: +c.screw || 2.2, headH: (+c.screw || 2.2) * 0.65, screwName: 'M' + Math.max(1.6, Math.round(((+c.screw || 2.2) - 0.2) * 2) / 2),
      body: { type: 'flatcyl', r: Math.max(+c.body || 0, +c.boss || 0, sp + 4, d + 6) / 2, flat: Math.max(+c.body || 0, +c.boss || 0, sp + 4, d + 6) / 2, L: 25 }, driver: 'TB6612FNG' }; }
  return MOTORS[dr.motor] || null;
}
const gearEta = n => Math.pow(0.98, n);
// 부하 load = {T: N·mm, rpm}, 각 동력원으로 필요한 변속비(입력:출력)와 토크 여유를 계산
function motorOptions(load, maxStages = 3, custom, include) {
  const maxR = Math.min(400, Math.pow(6, maxStages)), out = [];
  const stagesOf = r => Math.max(1, Math.ceil(Math.log(Math.max(r, 1 / r)) / Math.log(6) - 1e-9));
  for (const id of Object.keys(MOTORS)) {
    const M = motorOf({ motor: id, custom });
    if (id === 'custom' && !custom) continue;
    if (M.kind === 'servo' && !M.cont && id !== include) continue;   // 각도 서보는 직접 고를 때만
    const cands = M.kind === 'stepper' ? Array.from({ length: 40 }, (_, i) => M.rpmLo * Math.pow(M.rpmHi / M.rpmLo, i / 39)) : [M.rpm];
    let best = null;
    for (const n of cands) {
      const r = n / load.rpm, st = stagesOf(r), Tin = M.kind === 'stepper' ? M.torqueAt(n) : M.T;
      const ok = r <= maxR && r >= 1 / 6, Tout = Tin * r * gearEta(st), margin = Tout / load.T;
      const e = { id, M, n, ratio: r, stages: st, Tin, Tout, margin, fits: ok };
      const key = x => (x.fits ? 0 : 2) + (x.margin >= 2 ? 0 : x.margin >= 1.2 ? 0.5 : 1);
      const pref = x => M.rpmGood ? Math.abs(Math.log(x.n / M.rpmGood)) : Math.abs(Math.log(x.margin / 3));   // 스테퍼는 부드럽게 도는 속도 근처를 선호
      if (!best || key(e) < key(best) || key(e) === key(best) && (e.stages < best.stages || e.stages === best.stages && pref(e) < pref(best))) best = e;
    }
    best.st = !best.fits || M.danger ? 'bad' : best.margin >= 1.5 ? 'ok' : best.margin >= 1 ? 'warn' : 'bad';
    best.why = M.danger ? '출력한 기어로는 위험합니다 (모양 확인용)' : !best.fits ? (best.ratio > maxR ? `변속비 ${fmt(best.ratio, 0)}:1이 너무 큽니다` : '모터가 너무 느립니다') : best.margin < 1 ? '힘이 모자랍니다' : best.margin < 1.5 ? '여유가 적습니다' : '';
    out.push(best);
  }
  const rank = e => ({ ok: 0, warn: 1, bad: 2 })[e.st];
  out.sort((a, b) => rank(a) - rank(b) || (a.M.kind === 'hand') - (b.M.kind === 'hand') || a.stages - b.stages || Math.abs(Math.log(a.margin / 3)) - Math.abs(Math.log(b.margin / 3)));
  return out;
}
// 설계의 실제 변속비(입력:출력)와 효율
function designRatio(D) {
  if (D.kind === 'bevel') return { r: D.input === 2 ? D.z1 / D.z2 : D.z2 / D.z1, eta: 0.95 };
  if (D.kind === 'planetary') return { r: 1 + (D.zs + 2 * D.zp) / D.zs, eta: 0.97 };
  const k = kinematics(D); return { r: Math.abs(k.w[D.input] / k.w[D.output]), eta: gearEta(D.meshes.length) };
}
// 납작 원통(앞뒤가 깎인 원통) 외곽선: N20·130 모터 몸통
function flatcylPts(r, flat, cx = 0, cy = 0, n = 48) {
  const out = [];
  for (let i = 0; i < n; i++) { const t = 2 * PI * i / n; let x = r * Math.cos(t), y = r * Math.sin(t); if (Math.abs(y) > flat) y = Math.sign(y) * flat; out.push([cx + x, cy + y]); }
  return out;
}
const rotPts = (P, a, cx = 0, cy = 0) => { const c = Math.cos(a), s = Math.sin(a); return P.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]); };
// GT2 타이밍 풀리 외곽선 (근사형): 바깥지름 OD, 이홈 반지름 0.555
function gt2Pts(z) {
  const PD = 2 * z / PI, ro = PD / 2 - 0.254, rc = ro - 0.1, rn = 0.555, N = z * 16, out = [];
  for (let i = 0; i < N; i++) {
    const t = 2 * PI * i / N; let r = ro;
    for (let k = 0; k < z; k++) { const a = 2 * PI * k / z, cx = rc * Math.cos(a), cy = rc * Math.sin(a);
      const ux = Math.cos(t), uy = Math.sin(t), b = ux * cx + uy * cy, c2 = cx * cx + cy * cy - rn * rn, disc = b * b - c2;
      if (disc > 0) { const t0 = b - Math.sqrt(disc); if (t0 > 0 && t0 < r) r = t0; } }
    out.push([r * Math.cos(t), r * Math.sin(t)]);
  }
  return out;
}
const PULLEY = { z: 20, H: 15 };   // 20T, 높이 15 (허브 6 + 플랜지 1 + 이 7 + 플랜지 1)
function pulleyTris(boreP) {
  const B = [boreP];
  return extrudeTris(circlePts(Math.max(5.6, 0), 40), B, 6)
    .concat(moveTris(extrudeTris(circlePts(8, 48), B, 1), 0, 0, 6))
    .concat(moveTris(extrudeTris(gt2Pts(PULLEY.z), B, 7), 0, 0, 7))
    .concat(moveTris(extrudeTris(circlePts(8, 48), B, 1), 0, 0, 14));
}
const GT2_LOOPS = [100, 110, 122, 140, 158, 200, 232, 280, 300, 400];
const isServo = M => M && M.kind === 'servo';
const canClamp = M => M && M.body && (M.body.type === 'flatcyl' || M.body.type === 'cyl') && M.kind === 'dc';
const canRemote = M => M && (M.kind === 'stepper' || M.kind === 'dc') && M.holes.length >= 2 && Math.min(...M.holes.map(h => Math.hypot(h[0], h[1]))) >= 15;
function linkOf(dr) { const M = motorOf(dr); if (!M || M.kind === 'hand' || isServo(M)) return 'direct'; return dr.link === 'coupling' || dr.link === 'belt' ? (canRemote(M) ? dr.link : 'direct') : 'direct'; }
function mountOf(dr) { const M = motorOf(dr); return linkOf(dr) === 'direct' && dr.mount === 'clamp' && canClamp(M) ? 'clamp' : isServo(M) ? 'servo' : 'face'; }
// 기어 아래 빈 높이(바닥 안쪽 나사 머리·서보 윗면을 피함)
function driveEndGap(dr, wall) {
  const M = motorOf(dr); if (!M || M.kind === 'hand') return 0.8;
  if (isServo(M)) return Math.max(0.8, M.servo.top - wall + 1 + M.shaft.len);
  const head = mountOf(dr) === 'face' && linkOf(dr) === 'direct' ? M.headH : Math.max(M.headH || 0, 2.0);
  return Math.max(0.8, head + 0.6);
}
// 바닥에서 피해야 할 구멍들 [x, y, r]
function floorBusy(D, skip) {
  const b = [];
  D.shafts.forEach((q, i) => { if (i === skip) return; const br = bearingFor(D, q, i); b.push([q.x, q.y, br ? br.OD / 2 + 0.1 : q.d / 2 + 0.4]); });
  return b;
}
const clearOf = (busy, x, y, r) => busy.every(([bx, by, br]) => Math.hypot(x - bx, y - by) >= br + r);
// 모터 마운트 계획: 직접(앞면 나사·클램프·서보) / 커플링 / 벨트
function motorMount(D, parts) {
  const M = motorOf(D.drive), s = D.shafts[D.input], box = D.box, w = box.wall, link = linkOf(D.drive), mount = mountOf(D.drive);
  const fz = D.drive.fasten === 'insert';
  const out = { M, link, mount, holes: [], polys: [], problems: [], inputFloor: null, parts: [], housing: [], extras: [], bom: [], legDrop: 0 };
  const busy = floorBusy(D, link === 'direct' ? D.input : -1);
  const angles = Array.from({ length: 24 }, (_, k) => (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 15 * D2R);
  const faceHoles = (cx, cy, a, extra = []) => {   // 모터 앞면 나사 구멍 (바닥 안쪽, 다른 구멍과 떨어짐)
    const hs = rotPts(M.holes, a, cx, cy).map(([x, y]) => ({ x, y, d: M.screw }));
    return hs.every(h => fitsIn(box, h.x, h.y, M.screw + 0.3) && clearOf(busy.concat(extra), h.x, h.y, M.screw + 0.8)) ? hs : null; };
  const p = parts.find(q => q.shaft === D.input), g0 = D.gears[p.gears[0]], rf0 = gearOutlineInfo(g0).rf;
  const downHub = (z0, r, bore) => {   // 입력 기어 아래로 허브를 내림 (짧은 모터 축도 깊게 물림)
    if (p.z0 > z0 + 0.2 && r >= (bore ? bore.d : boreOf(s).d) / 2 + 0.8) { const dz = p.z0 - z0;
      p.hubs = p.hubs.map(h => ({ ...h, z: h.z + dz })); p.hubs.unshift({ z: 0, h: dz, r, bore }); p.z0 = z0; } };
  const topOfPart = Math.max(...p.gears.map(i => D.gears[i].zpos + D.gears[i].b));
  if (link === 'direct' && mount === 'face') {
    if (!fitsIn(box, s.x, s.y, M.boss.d / 2 + 0.6)) out.problems.push(`모터 앞 돌출부(지름 ${M.boss.d} mm)가 바닥 안쪽에 들어가지 않습니다`);
    for (const a of angles) { const hs = faceHoles(s.x, s.y, a); if (hs) { out.holes = hs; out.ang = a; break; } }
    if (M.holes.length && !out.holes.length) out.problems.push(`${M.screwName} 고정 나사 자리가 벽이나 다른 축에 걸립니다. 입력축을 공간 가운데 쪽에 고정하거나 공간을 넓혀 보세요`);
    out.inputFloor = M.boss.d + 0.5;
    const minHole = out.holes.length ? Math.min(...out.holes.map(h => Math.hypot(h.x - s.x, h.y - s.y))) : 99;
    downHub(w + 0.4, Math.min(rf0 - 0.4, boreOf(s).d / 2 + 3.5, minHole - M.screw - 0.4));
    out.engage = Math.min(M.shaft.len, topOfPart) - p.z0;
    out.extras.push({ tris: motorBodyTris(M, s.x, s.y, 0, out.ang || 0), color: '#59616a' });
    out.legDrop = M.body.L;
    out.bom.push([`${M.screwName} 나사 (모터 앞면 고정)`, out.holes.length, `길이 ${fmt(w + 3, 0)}~${fmt(w + 5, 0)} mm, 하우징 안쪽에서 끼움`]);
  } else if (mount === 'clamp') {
    const B = M.body, Rb = B.r, Ro = Rb + 2.7, pil = fz ? 4.0 : 2.6;
    for (const a of angles) { const hs = rotPts([[0, Rb + 6], [0, -(Rb + 6)]], a, s.x, s.y).map(([x, y]) => ({ x, y, d: 3.4 }));
      if (hs.every(h => fitsIn(box, h.x, h.y, 3.6) && clearOf(busy, h.x, h.y, 3.4))) { out.holes = hs; out.ang = a; break; } }
    if (!out.holes.length) out.problems.push('모터 클램프의 고정 나사 자리가 벽이나 다른 축에 걸립니다. 입력축을 가운데 쪽에 두세요');
    out.inputFloor = M.boss.d + 0.5;
    downHub(w + 0.4, Math.min(rf0 - 0.4, boreOf(s).d / 2 + 3.5));
    out.engage = Math.min(M.shaft.len, topOfPart) - p.z0;
    const a = out.ang || 0, T = t => xfTris(t, XF.mul(XF.T(s.x, s.y, 0), XF.Rz(a)));
    const clamp = clampTris(M, fz);
    out.housing.push({ name: '모터 클램프', file: `motor_clamp_${M.short.replace(/\W+/g, '')}`, tris: T(clamp), print: XF.basis([1, 0, 0], [0, -1, 0], [0, 0, -1]) });
    out.extras.push({ tris: motorBodyTris(M, s.x, s.y, 0, a), color: '#59616a' });
    out.legDrop = M.body.L;
    out.bom.push([`M3 나사 (클램프를 바닥에)`, 2, fz ? '인서트 너트에 조임' : '클램프 구멍에 셀프 태핑, 하우징 안쪽에서'], ['M3×12 나사 + 너트 (클램프 조임)', 1, '']);
    if (fz) out.bom.push(['M3 인서트 너트', 2, '클램프 윗면']);
  } else if (mount === 'servo') {
    const V = M.servo, pad = 0.25;
    const rect = [[V.ox - V.bw / 2 - pad, -V.bh / 2 - pad], [V.ox + V.bw / 2 + pad, -V.bh / 2 - pad], [V.ox + V.bw / 2 + pad, V.bh / 2 + pad], [V.ox - V.bw / 2 - pad, V.bh / 2 + pad]];
    for (const a of angles) {
      const R = rotPts(rect, a, s.x, s.y), E = rotPts(V.ears, a, s.x, s.y);
      if (R.every(([x, y]) => fitsIn(box, x, y, 0.8)) && E.every(([x, y]) => fitsIn(box, x, y, 2.5))
        && busy.every(([bx, by, br]) => segDist(bx, by, R) >= br + 1.2 && !pointInPoly(bx, by, R)) && E.every(([x, y]) => clearOf(busy, x, y, 2))) {
        out.polys.push(R); out.holes = E.map(([x, y]) => ({ x, y, d: V.pilot })); out.ang = a; break; }
    }
    if (!out.polys.length) out.problems.push('서보 몸통 구멍이 벽이나 다른 축에 걸립니다. 입력축을 가운데 쪽에 두거나 공간을 넓히세요');
    out.inputFloor = 0;
    const spline = { d: +(M.shaft.d - 0.1).toFixed(2), dcut: 0 };
    downHub(V.top + 0.3, Math.min(rf0 - 0.4, M.shaft.d / 2 + 3), spline);
    out.engage = Math.min(M.shaft.len, p.hubs[0] && p.hubs[0].bore ? p.hubs[0].h : 0) - 0.0;
    out.extras.push({ tris: motorBodyTris(M, s.x, s.y, 0, out.ang || 0), color: '#2c3e66' });
    out.legDrop = M.servo.L - M.servo.top;
    out.bom.push([`${V.screwName} 나사 (서보 귀를 바닥 밑면에)`, V.ears.length, '바닥 구멍에 셀프 태핑'], [`${V.centerName} 서보 중심 나사`, 1, '서보에 들어 있는 나사로 기어를 스플라인에 고정']);
  } else {   // 커플링·벨트: 모터를 간격 기둥(스페이서)으로 바닥 아래에 매달고, 입력축은 베어링으로 받침
    const brIn = bearingFor(D, s, D.input), hbF = brIn ? Math.max(0, brIn.B - w) : 0, len = M.shaft.len;
    const eM = Math.max(3, Math.min(10, len - M.boss.h - 1));
    const spR = M.screw / 2 + 1.8, spBusy = (cx, cy, a) => rotPts(M.holes, a, cx, cy);
    let Hb, cx = s.x, cy = s.y, beltC = null, beltA = 0;
    if (link === 'coupling') {
      const OD = Math.max(M.shaft.d, s.d) + 9, Lc = eM + 1 + 8;
      Hb = Math.ceil(len - eM + Lc + 1 + hbF);   // 커플링 윗면이 바닥 받침보다 1 mm 아래
      const z0 = -Hb + len - eM;
      for (const a of angles) { const hs = faceHoles(cx, cy, a, [[s.x, s.y, OD / 2 + 0.5]]); if (hs) { out.holes = hs; out.ang = a; break; } }
      const cb = { d: +(M.shaft.d + 0.15).toFixed(2), dcut: M.shaft.dcut ? +(M.shaft.dcut - 0.05).toFixed(2) : 0, dd: !!M.shaft.dd };
      const cp = extrudeTris(circlePts(OD / 2, 48), [borePts(cb.d, cb.dcut, 40, cb.dd)], eM).concat(moveTris(extrudeTris(circlePts(OD / 2, 48), [], 1), 0, 0, eM), moveTris(extrudeTris(circlePts(OD / 2, 48), [borePts(s.d + 0.1, 0.5)], 8), 0, 0, eM + 1));
      out.parts.push({ name: '커플링', file: `coupling_${fmt(M.shaft.d, 1)}to${s.d}`, tris: cp, z: z0, x: s.x, y: s.y, w: 'in' });
      out.inputPin = { z0: z0 + eM + 1, OD };
      out.engage = Math.min(eM, len - M.boss.h - 0.5);
      out.coupling = { OD, Lc, eM, z0 };
      out.bom.push(['커플링 (출력, 또는 시판 5→' + s.d + ' mm 커플링)', 1, '']);
    } else {
      Hb = Math.ceil(PULLEY.H + M.boss.h + 1.5 + hbF);
      let found = null;
      for (const L of GT2_LOOPS) { const C = (L - 40) / 2; if (C < 18) continue;
        for (const a of angles) { const mx = s.x + C * Math.cos(a), my = s.y + C * Math.sin(a);
          const band = [[s.x, s.y], [mx, my]];
          for (const b of angles) { const H = spBusy(mx, my, b);
            if (!H.every(([x, y]) => fitsIn(box, x, y, spR + 0.3) && clearOf(busy, x, y, M.screw + 0.8))) continue;
            if (H.some(([x, y]) => Math.hypot(x - s.x, y - s.y) < 8 + spR + 1 || Math.hypot(x - mx, y - my) < 8 + spR + 0.5)) continue;
            const segD = ([x, y]) => { const dx = mx - s.x, dy = my - s.y, t = Math.max(0, Math.min(1, ((x - s.x) * dx + (y - s.y) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - s.x - t * dx, y - s.y - t * dy); };
            if (H.some(q => segD(q) < 11.7 + spR + 0.2)) continue;
            found = { L, C, a, mx, my, b }; break; }
          if (found) break; }
        if (found) break; }
      if (!found) { out.problems.push('벨트로 떨어뜨린 모터의 고정 자리를 바닥 안에서 찾지 못했습니다. 공간을 넓히거나 직접 장착을 쓰세요'); found = { L: 158, C: 59, a: 0, mx: s.x + 59, my: s.y, b: 0 }; }
      else out.holes = spBusy(found.mx, found.my, found.b).map(([x, y]) => ({ x, y, d: M.screw }));
      cx = found.mx; cy = found.my; out.ang = found.b; beltC = found.C; beltA = found.a;
      const z0 = -Hb + M.boss.h + 0.5;
      const mb = { d: +(M.shaft.d + 0.15).toFixed(2), dcut: M.shaft.dcut ? +(M.shaft.dcut - 0.05).toFixed(2) : 0, dd: !!M.shaft.dd };
      out.parts.push({ name: '모터 풀리', file: `pulley_GT2_${PULLEY.z}T_motor`, tris: pulleyTris(borePts(mb.d, mb.dcut, 40, mb.dd)), z: z0, x: cx, y: cy, w: 'in' },
        { name: '입력 풀리', file: `pulley_GT2_${PULLEY.z}T_d${s.d}`, tris: pulleyTris(borePts(s.d + 0.1, 0.5)), z: z0, x: s.x, y: s.y, w: 'in' });
      out.inputPin = { z0 };
      out.engage = Math.min(PULLEY.H, len - M.boss.h - 0.5);
      out.belt = { L: found.L, C: found.C, z0 };
      // 벨트 보호 덮개: 두 풀리를 감싸는 벽, 위쪽 귀가 간격 기둥에 걸림
      const ux = Math.cos(beltA), uy = Math.sin(beltA);
      const G = capsulePts([s.x, s.y], [cx, cy], 11.7), Gi = capsulePts([s.x, s.y], [cx, cy], 10.1);
      let guard = moveTris(extrudeTris(G, [Gi], Hb - 0.4), 0, 0, -Hb + 0.2);
      const Hs = out.holes.slice().sort((p1, p2) => Math.hypot(p1.x - s.x, p1.y - s.y) - Math.hypot(p2.x - s.x, p2.y - s.y)).slice(0, 2);
      Hs.forEach(h => { const k = Math.max(0, Math.min(1, ((h.x - s.x) * ux + (h.y - s.y) * uy) / found.C)), px = s.x + ux * found.C * k, py = s.y + uy * found.C * k;
        const dx = h.x - px, dy = h.y - py, dl = Math.hypot(dx, dy) || 1, ex = px + dx / dl * 10.9, ey = py + dy / dl * 10.9;
        guard = guard.concat(moveTris(extrudeTris(capsulePts([ex, ey], [h.x, h.y], spR + 1.6), [circlePts(spR + 0.25, 24, h.x, h.y)], 2), 0, 0, -2.2)); });
      out.housing.push({ name: '벨트 보호 덮개', file: 'belt_guard', tris: guard, print: XF.basis([1, 0, 0], [0, -1, 0], [0, 0, -1]) });
      out.extras.push({ tris: moveTris(extrudeTris(capsulePts([s.x, s.y], [cx, cy], 7.1), [capsulePts([s.x, s.y], [cx, cy], 6.37)], 6), 0, 0, z0 + 7.5), color: '#202326' });
      out.bom.push([`GT2 닫힌 벨트 (폭 6 mm, 둘레 ${found.L} mm)`, 1, `풀리 중심거리 ${fmt(found.C, 1)} mm`], ['GT2 20T 풀리 (출력 또는 시판)', 2, '']);
    }
    // 간격 기둥: 모터 나사 자리마다 관 하나, 긴 나사가 하우징 안쪽 → 기둥 → 모터 앞면
    if (link === 'coupling' && !out.holes.length) out.problems.push(`${M.screwName} 고정 나사 자리가 벽이나 다른 축에 걸립니다. 입력축을 공간 가운데 쪽에 두세요`);
    out.holes.forEach((h, k) => out.housing.push({ name: '간격 기둥', file: `spacer_${k + 1}_h${Hb}`, tris: moveTris(extrudeTris(circlePts(spR, 32, h.x, h.y), [circlePts(M.screw / 2, 20, h.x, h.y)], Hb), 0, 0, -Hb) }));
    out.extras.push({ tris: moveTris(motorBodyTris(M, cx, cy, 0, out.ang || 0), 0, 0, -Hb), color: '#59616a' });
    out.Hb = Hb; out.mc = [cx, cy]; out.legDrop = Hb + M.body.L;
    out.bom.push([`${M.screwName} 긴 나사 (모터 고정)`, out.holes.length, `길이 ${fmt(w + Hb + 4, 0)} mm 정도, 하우징 안쪽 → 간격 기둥 → 모터`]);
  }
  out.mbore = mount === 'servo' ? { d: M.servo.center, dcut: 0 } : link === 'direct' ? { d: +(M.shaft.d + 0.15).toFixed(2), dcut: M.shaft.dcut ? +(M.shaft.dcut - 0.05).toFixed(2) : 0, dd: !!M.shaft.dd } : null;
  return out;
}
// 원통형 DC 모터 클램프 (부품 좌표: 축 중심, 바닥 밑면 z=0에서 아래로)
function clampTris(M, fz) {
  const B = M.body, Rb = B.r, Ro = Rb + 2.7, pil = fz ? 4.0 : 2.6;
  const inner = flatcylPts(Rb + 0.2, B.flat + 0.2), ti = Math.asin(0.75 / (Rb + 0.2)), to = Math.asin(0.75 / Ro), C = [];
  for (let i = 0; i <= 40; i++) { const t = to + (2 * PI - 2 * to) * i / 40; C.push([Ro * Math.cos(t), Ro * Math.sin(t)]); }
  for (let i = 0; i <= 40; i++) { const t = 2 * PI - ti - (2 * PI - 2 * ti) * i / 40, r = Math.min(Rb + 0.2, (B.flat + 0.2) / Math.max(1e-6, Math.abs(Math.sin(t)))); C.push([r * Math.cos(t), r * Math.sin(t)]); }
  const ear = (y1, len) => xfTris(extrudeTris([[Ro - 1, -17], [Ro + 7, -17], [Ro + 7, -3], [Ro - 1, -3]], [circlePts(1.7, 20, Ro + 3.5, -10)], len), XF.basis([1, 0, 0], [0, 0, 1], [0, -1, 0], [0, y1, 0]));
  return extrudeTris(capsulePts([0, -(Rb + 6)], [0, Rb + 6], Rb + 3.2), [inner, circlePts(pil / 2, 20, 0, Rb + 6), circlePts(pil / 2, 20, 0, -(Rb + 6))], 3).map(t => t.map((v, k) => k % 3 === 2 ? v - 3 : v))
    .concat(moveTris(extrudeTris(C, [], 14), 0, 0, -17), ear(6.75, 6), ear(-0.75, 6));
}
function bearingFor(D, s, i) {
  if (!D.drive || !D.drive.bear || !s.fixed) return null;
  if (i === D.input && motorOf(D.drive).kind !== 'hand' && linkOf(D.drive) === 'direct') return null;
  const b = BEARINGS[Math.round(s.d)]; if (!b || Math.abs(s.d - Math.round(s.d)) > 0.01) return null;
  return { name: b[0], OD: b[1], B: b[2] };
}
function motorBodyTris(M, x, y, z, ang) {   // 표시용 모터 몸통 (앞면이 z, 아래로)
  const B = M.body, T = t => xfTris(t, XF.mul(XF.T(x, y, z), XF.Rz(ang || 0)));
  if (isServo(M)) { const V = M.servo;
    return T(moveTris(extrudeTris([[V.ox - V.bw / 2, -V.bh / 2], [V.ox + V.bw / 2, -V.bh / 2], [V.ox + V.bw / 2, V.bh / 2], [V.ox - V.bw / 2, V.bh / 2]], [], V.L), 0, 0, V.top - V.L)
      .concat(moveTris(extrudeTris(V.ears.length > 2 ? [[V.ox - V.ew / 2, -V.bh / 2], [V.ox + V.ew / 2, -V.bh / 2], [V.ox + V.ew / 2, V.bh / 2], [V.ox - V.ew / 2, V.bh / 2]] : [[V.ox - V.ew / 2, -2.5], [V.ox + V.ew / 2, -2.5], [V.ox + V.ew / 2, 2.5], [V.ox - V.ew / 2, 2.5]], V.ears.map(([ex, ey]) => circlePts(1, 12, ex, ey)), 2.5), 0, 0, -2.5))
      .concat(moveTris(extrudeTris(circlePts(M.shaft.d / 2, 24), [], M.shaft.len), 0, 0, V.top))); }
  const out = B.type === 'cyl' ? extrudeTris(circlePts(B.r, 40, B.cx, B.cy), [], B.L) : B.type === 'flatcyl' ? extrudeTris(flatcylPts(B.r, B.flat), [], B.L)
    : extrudeTris([[B.cx - B.w / 2, B.cy - B.h / 2], [B.cx + B.w / 2, B.cy - B.h / 2], [B.cx + B.w / 2, B.cy + B.h / 2], [B.cx - B.w / 2, B.cy + B.h / 2]], [], B.L);
  return T(moveTris(out, 0, 0, -B.L).concat(moveTris(extrudeTris(circlePts(M.boss.d / 2, 32), [], M.boss.h), 0, 0, -0.01)));
}
// 제어·전원 부품 (전동식): 드라이버, 아두이노, 전원(배터리 또는 어댑터), 스위치, 퓨즈, 버튼
function powerRows(M) {
  const A = Math.max(1, M.amp * 2), bat = M.volt <= 6 ? `AA 건전지 ${Math.round(M.volt / 1.5)}개 홀더 또는 ${M.volt} V 어댑터` : `${M.volt} V 어댑터 또는 ${Math.ceil(M.volt / 3.7)}S 리튬 배터리`;
  return [['Arduino Uno 또는 Nano', 1, '속도·방향 제어 (PWM·스텝 신호)'], [`전원: ${bat}`, 1, `${fmt(A, 1)} A 이상${M.kind === 'stepper' || M.amp > 0.5 ? ', USB 전원으로는 모터를 돌리지 마세요' : ''}`],
    ['전원 스위치 (토글 또는 슬라이드)', 1, '전원 + 선에'], [`퓨즈 ${fmt(Math.max(0.5, Math.ceil(M.amp * 1.5 * 2) / 2), 1)} A + 홀더`, 1, '전원 + 선, 스위치 다음 (과전류 차단)'], ['푸시 버튼', 1, 'D2 ↔ GND (정지·시작)'], ['점퍼선·브레드보드', 1, '']];
}
// 핸드휠: 허브(D컷) + 바퀴살 4개 + 테 + 손잡이
function wheelTris(d, dcut, R) {
  const bore = borePts(d + 0.15, dcut), rh = d / 2 + 4;
  let T = extrudeTris(circlePts(rh, 48), [bore], 10).concat(moveTris(extrudeTris(circlePts(R, 96), [circlePts(R - 5, 96)], 6), 0, 0, 4));
  for (let k = 0; k < 4; k++) { const a = k * PI / 2; T = T.concat(moveTris(extrudeTris(capsulePts([(rh - 1) * Math.cos(a), (rh - 1) * Math.sin(a)], [(R - 3) * Math.cos(a), (R - 3) * Math.sin(a)], 3), [], 5), 0, 0, 4.5)); }
  return T.concat(moveTris(extrudeTris(circlePts(4.5, 32, R - 2.5, 0), [], 22), 0, 0, 9.99));
}
// 동력 연결 플랜지: 외부 동력(태엽·수차·풍차·엔진 등)의 축이나 판을 M3 나사 4개로 붙임
function flangeTris(d, dcut) {
  const bore = borePts(d + 0.15, dcut), Rf = Math.max(20, d / 2 + 14);
  return extrudeTris(circlePts(d / 2 + 4, 48), [bore], 12).concat(moveTris(extrudeTris(circlePts(Rf, 64), [bore, ...[0, 1, 2, 3].map(k => circlePts(1.6, 20, (Rf - 5) * Math.cos(k * PI / 2 + PI / 4), (Rf - 5) * Math.sin(k * PI / 2 + PI / 4)))], 4), 0, 0, 11.99));
}
// 손 크랭크: 허브(D컷) + 팔 + 손잡이, 부품 좌표(축 중심, 바닥 z=0)
function crankTris(d, dcut, arm) {
  const bore = borePts(d + 0.15, dcut), rh = d / 2 + 4, x0 = (d + 0.15) / 2 + 6;   // 팔은 구멍에서 1 mm 떨어져 시작
  return extrudeTris(circlePts(rh, 48), [bore], 10)
    .concat(moveTris(extrudeTris(capsulePts([x0, 0], [arm, 0], 5), [], 5), 0, 0, 5))
    .concat(moveTris(extrudeTris(circlePts(4.5, 32, arm, 0), [], 22), 0, 0, 9.99));
}

// 배선과 아두이노 코드
function driveKit(D, info) {
  const M = motorOf(D.drive), nM = D.rpm, nOut = info.nOut;
  const head = `// 기어 설계실에서 만든 제어 예시 (Arduino Uno/Nano)\n// 동력원: ${M.name}\n// 모터 ${fmt(nM, 1)} rpm → 변속비 ${fmt(info.r, 3)}:1 → 출력축 약 ${fmt(nOut, 1)} rpm\n// 시리얼 모니터(115200)에서 s = 정지/시작, r = 방향 바꾸기. D2 버튼(GND로 연결)도 정지/시작입니다.\n`;
  const btn = `bool buttonPressed() {          // D2 버튼, 떨림 방지
  static bool last = HIGH; static unsigned long t = 0;
  bool v = digitalRead(PIN_BTN);
  if (v != last && millis() - t > 30) { t = millis(); last = v; return v == LOW; }
  return false;
}`;
  if (M.kind === 'hand') return { driver: '없음', rows: [], ino: null, notes: M.att === 'flange' ? [`${M.short}은(는) 전기 배선이 필요 없습니다. 덮개 위로 나온 입력축에 동력 연결 플랜지(input_flange)를 끼우고, ${M.src}을(를) 플랜지의 M3 구멍 4개에 고정하세요. 두 축의 중심을 잘 맞춰야 합니다.`, ...(M.note ? [M.note] : [])]
    : [`${M.short}은(는) 전기 배선이 필요 없습니다. ${M.att === 'wheel' ? '핸드휠' : '크랭크'}을 입력축 윗부분(덮개 위로 나온 D컷 축)에 끼워 돌리세요.`] };
  if (isServo(M)) {
    const big = M.amp > 1;
    const rows = [['서보 갈색(−)', '전원 − 와 아두이노 GND'], ['서보 빨강(+)', big ? `별도 ${M.volt} V 전원 + (2 A 이상, USB 5 V 금지)` : '5 V (여러 개면 별도 5 V 전원)'], ['서보 주황(신호)', 'D9'], ['전원 +와 − 사이', '470 µF 전해 콘덴서'], ['버튼', 'D2 ↔ GND']];
    if (M.cont) return { driver: '서보 직결 (드라이버 없음)', rows, notes: ['연속 회전 서보는 1500 µs에서 멈춥니다. 멈춰야 할 때 조금씩 돌면 STOP_US 값을 1~10씩 바꿔 맞추세요.', '속도는 펄스 폭이 1500에서 멀수록 빨라집니다. 부하가 걸리면 느려지니 실제로 재서 SPEED_US를 조정하세요.'],
      ino: head + `#include <Servo.h>
const int PIN_SERVO = 9, PIN_BTN = 2;
const int STOP_US = 1500;          // 정지 펄스 (서보마다 조금 다름)
const int SPEED_US = ${Math.round(Math.min(500, Math.max(60, 500 * nM / (M.rpmNL || nM))))};          // 정지에서 벗어나는 폭: 클수록 빠름 (최대 약 500)
bool running = true, forward = true, flip = false;
int now_us = STOP_US; unsigned long lastRamp = 0;
Servo sv;

${btn}

void setup() {
  pinMode(PIN_BTN, INPUT_PULLUP);
  sv.attach(PIN_SERVO); sv.writeMicroseconds(STOP_US);
  Serial.begin(115200); Serial.println(F("s: stop/start, r: reverse"));
}

void loop() {
  if (Serial.available()) { char c = Serial.read(); if (c == 's') running = !running; if (c == 'r') flip = true; }
  if (buttonPressed()) running = !running;
  if (millis() - lastRamp >= 4) {                // 부드럽게 출발·정지
    lastRamp = millis();
    int goal = (running && !flip) ? STOP_US + (forward ? SPEED_US : -SPEED_US) : STOP_US;
    now_us += goal > now_us ? 2 : goal < now_us ? -2 : 0;
    if (abs(goal - now_us) < 2) now_us = goal;
    if (flip && now_us == STOP_US) { forward = !forward; flip = false; }
    sv.writeMicroseconds(now_us);
  }
}
` };
    const span = 180 / info.r;
    return { driver: '서보 직결 (드라이버 없음)', rows, notes: [`각도 서보는 0~180°만 돕니다. 변속비 ${fmt(info.r, 2)}:1을 거치면 출력축은 약 ${fmt(span, 1)}° 범위를 움직입니다.`, '서보 각도와 출력 각도는 변속비만큼 다르고, 방향은 기어 수에 따라 바뀝니다. 코드의 OUT_A·OUT_B에 원하는 출력 각도를 넣으세요.'],
      ino: head.replace(/모터 .* rpm\n/, `서보 0~180° → 변속비 ${fmt(info.r, 3)}:1 → 출력축 약 ${fmt(span, 1)}° 범위\n`) + `#include <Servo.h>
const int PIN_SERVO = 9, PIN_BTN = 2;
const float RATIO = ${fmt(info.r, 4)};     // 서보 : 출력 변속비
const float OUT_A = 0, OUT_B = ${fmt(Math.min(span, 90), 1)};   // 출력축이 오갈 두 각도 (°, 0 ~ ${fmt(span, 1)})
const int STEP_MS = 15;                    // 1° 움직이는 데 걸리는 시간 (클수록 느림)
bool running = true; float outDeg = OUT_A, goal = OUT_B; unsigned long last = 0;
Servo sv;

${btn}

void setup() { pinMode(PIN_BTN, INPUT_PULLUP); sv.attach(PIN_SERVO); sv.write(constrain(OUT_A * RATIO, 0, 180)); Serial.begin(115200); }

void loop() {
  if (Serial.available() && Serial.read() == 's') running = !running;
  if (buttonPressed()) running = !running;
  if (!running || millis() - last < STEP_MS) return;
  last = millis();
  float stepOut = 1.0 / RATIO;                // 서보 1° = 출력 1/RATIO °
  outDeg += goal > outDeg ? stepOut : -stepOut;
  if (abs(goal - outDeg) < stepOut) { outDeg = goal; goal = (goal == OUT_B) ? OUT_A : OUT_B; }
  sv.write(constrain(outDeg * RATIO, 0, 180));
}
` };
  }
  if (M.kind === 'stepper' && M.driver === 'A4988') {
    let micro = 16; while (micro > 1 && nM * M.steps * micro / 60 > 6000) micro /= 2;
    const ms = { 16: ['5V', '5V', '5V'], 8: ['5V', '5V', '연결 안 함'], 4: ['연결 안 함', '5V', '연결 안 함'], 2: ['5V', '연결 안 함', '연결 안 함'], 1: ['연결 안 함', '연결 안 함', '연결 안 함'] }[micro];
    const vref = (M.amp * 0.7 * 8 * 0.068).toFixed(2);
    return { driver: 'A4988 스테퍼 드라이버', rows: [
      ['A4988 VMOT', `${M.volt} V 전원 +  (VMOT–GND 사이에 100 µF 콘덴서)`], ['A4988 GND (전원 쪽)', '전원 −, 아두이노 GND'],
      ['A4988 VDD / GND', '아두이노 5V / GND'], ['A4988 STEP', 'D3'], ['A4988 DIR', 'D4'], ['A4988 EN', 'D8'],
      ['A4988 MS1 / MS2 / MS3', ms.join(' / ') + ` (1/${micro} 마이크로스텝)`], ['A4988 RESET ↔ SLEEP', '서로 연결'],
      ['A4988 1A / 1B', '모터 코일 A (17HS4401: 검정 / 초록)'], ['A4988 2A / 2B', '모터 코일 B (빨강 / 파랑)'], ['버튼', 'D2 ↔ GND']],
      notes: [`드라이버의 작은 가변저항으로 전류를 맞추세요: Vref ≈ ${vref} V (정격의 70%, 감지저항 0.068 Ω 기준. 보드마다 다르니 확인).`, '모터 선을 꽂거나 뺄 때는 반드시 전원을 끄세요. 드라이버가 망가집니다.'],
      ino: head + `const int PIN_STEP = 3, PIN_DIR = 4, PIN_EN = 8, PIN_BTN = 2;
const long STEPS_PER_REV = ${M.steps}L * ${micro};   // 1/${micro} 마이크로스텝
const float TARGET_RPM = ${fmt(nM, 2)};            // 모터 회전수 (출력 ${fmt(nOut, 2)} rpm)
const float RAMP_RPM_PER_S = ${fmt(Math.max(20, nM * 2), 0)};        // 가속도: 1초에 올리는 rpm
bool running = true, forward = true, flip = false;
float rpm = 0; unsigned long stepUs = 0, lastStep = 0, lastRamp = 0;

${btn}

void setup() {
  pinMode(PIN_STEP, OUTPUT); pinMode(PIN_DIR, OUTPUT); pinMode(PIN_EN, OUTPUT); pinMode(PIN_BTN, INPUT_PULLUP);
  digitalWrite(PIN_EN, LOW); digitalWrite(PIN_DIR, HIGH);
  Serial.begin(115200); Serial.println(F("s: stop/start, r: reverse"));
}

void loop() {
  unsigned long now = micros();
  if (Serial.available()) { char c = Serial.read(); if (c == 's') running = !running; if (c == 'r') flip = true; }
  if (buttonPressed()) running = !running;
  if (now - lastRamp >= 2000) {                  // 2 ms 마다 속도를 조금씩 바꿈
    lastRamp = now;
    float goal = (running && !flip) ? TARGET_RPM : 0, d = RAMP_RPM_PER_S * 0.002;
    rpm = goal > rpm ? min(goal, rpm + d) : max(goal, rpm - d);
    if (flip && rpm == 0) { forward = !forward; digitalWrite(PIN_DIR, forward ? HIGH : LOW); flip = false; }
    stepUs = rpm > 0.2 ? (unsigned long)(60000000.0 / (rpm * STEPS_PER_REV)) : 0;
    digitalWrite(PIN_EN, (rpm == 0 && !running) ? HIGH : LOW);   // 멈추면 코일 전류를 끔
  }
  if (stepUs && now - lastStep >= stepUs) {
    lastStep = now;
    digitalWrite(PIN_STEP, HIGH); delayMicroseconds(2); digitalWrite(PIN_STEP, LOW);
  }
}
` };
  }
  if (M.kind === 'stepper') {   // 28BYJ-48 + ULN2003
    return { driver: 'ULN2003 드라이버 보드', rows: [['ULN2003 IN1 / IN2 / IN3 / IN4', 'D8 / D9 / D10 / D11'], ['ULN2003 + / −', '5 V 전원 + / − (아두이노 GND와 연결)'], ['모터 5핀 커넥터', 'ULN2003 보드 소켓에 그대로 꽂기'], ['버튼', 'D2 ↔ GND']],
      notes: ['28BYJ-48은 15 rpm 정도가 한계입니다. 더 빠르게 돌리면 탈조(헛돎)가 생깁니다.', '모터 전원은 USB 5 V보다 별도 5 V 어댑터가 안정적입니다.'],
      ino: head + `const int PINS[4] = {8, 9, 10, 11};   // IN1..IN4
const int PIN_BTN = 2;
const long STEPS_PER_REV = 4096;          // 하프스텝 기준 (실제 약 4076)
const float TARGET_RPM = ${fmt(Math.min(nM, 15), 2)};       // 모터 회전수 (출력 ${fmt(nOut, 2)} rpm)
const byte SEQ[8] = {0b1000, 0b1100, 0b0100, 0b0110, 0b0010, 0b0011, 0b0001, 0b1001};
bool running = true, forward = true;
int phase = 0; unsigned long lastStep = 0;
const unsigned long STEP_US = 60000000.0 / (TARGET_RPM * STEPS_PER_REV);

${btn}

void coils(byte b) { for (int i = 0; i < 4; i++) digitalWrite(PINS[i], (b >> (3 - i)) & 1); }

void setup() {
  for (int i = 0; i < 4; i++) pinMode(PINS[i], OUTPUT);
  pinMode(PIN_BTN, INPUT_PULLUP);
  Serial.begin(115200); Serial.println(F("s: stop/start, r: reverse"));
}

void loop() {
  if (Serial.available()) { char c = Serial.read(); if (c == 's') running = !running; if (c == 'r') forward = !forward; }
  if (buttonPressed()) running = !running;
  if (!running) { coils(0); return; }       // 멈추면 코일을 꺼서 열을 줄임
  unsigned long now = micros();
  if (now - lastStep >= STEP_US) {
    lastStep = now;
    phase = (phase + (forward ? 1 : 7)) % 8;
    coils(SEQ[phase]);
  }
}
` };
  }
  // DC 모터 + TB6612FNG
  const duty = Math.round(Math.min(255, 255 * (nM / (M.rpmNL || nM * 1.2)) * 1.15));
  return { driver: 'TB6612FNG 모터 드라이버', rows: [['TB6612 VM', `모터 전원 + (${M.volt} V)`], ['TB6612 VCC', '아두이노 5V'], ['TB6612 GND', '전원 −, 아두이노 GND'],
    ['TB6612 PWMA', 'D5'], ['TB6612 AIN1 / AIN2', 'D7 / D6'], ['TB6612 STBY', 'D8'], ['TB6612 AO1 / AO2', '모터 두 선 (반대로 돌면 바꿔 꽂기)'], ['버튼', 'D2 ↔ GND'], ['(선택) 가변저항 10 kΩ', '가운데 다리 A0, 양 끝 5V·GND']],
    notes: ['DC 모터는 부하에 따라 속도가 변합니다. 정확한 속도가 필요하면 엔코더 달린 모터나 스테퍼를 쓰세요.', 'USE_KNOB을 1로 바꾸면 A0 가변저항으로 속도를 조절합니다.', 'TB6612는 모터당 1.2 A까지입니다. 더 큰 모터는 BTS7960 같은 드라이버를 쓰세요.'],
    ino: head + `const int PIN_PWM = 5, PIN_IN1 = 7, PIN_IN2 = 6, PIN_STBY = 8, PIN_BTN = 2, PIN_KNOB = A0;
#define USE_KNOB 0
const int TARGET_DUTY = ${duty};         // 0~255. 정격 부하에서 약 ${fmt(nM, 0)} rpm 이 되도록 잡은 값, 실제로 재서 조정하세요
bool running = true, forward = true, flip = false;
int duty = 0; unsigned long lastRamp = 0;

${btn}

void drive(int d) {
  digitalWrite(PIN_IN1, forward ? HIGH : LOW); digitalWrite(PIN_IN2, forward ? LOW : HIGH);
  analogWrite(PIN_PWM, d);
}

void setup() {
  pinMode(PIN_PWM, OUTPUT); pinMode(PIN_IN1, OUTPUT); pinMode(PIN_IN2, OUTPUT); pinMode(PIN_STBY, OUTPUT); pinMode(PIN_BTN, INPUT_PULLUP);
  digitalWrite(PIN_STBY, HIGH);
  Serial.begin(115200); Serial.println(F("s: stop/start, r: reverse"));
}

void loop() {
  if (Serial.available()) { char c = Serial.read(); if (c == 's') running = !running; if (c == 'r') flip = true; }
  if (buttonPressed()) running = !running;
  if (millis() - lastRamp >= 5) {               // 부드럽게 출발·정지
    lastRamp = millis();
    int goal = TARGET_DUTY;
#if USE_KNOB
    goal = analogRead(PIN_KNOB) / 4;
#endif
    if (!running || flip) goal = 0;
    duty += goal > duty ? 1 : goal < duty ? -1 : 0;
    if (flip && duty == 0) { forward = !forward; flip = false; }
    drive(duty);
  }
}
` };
}
// 동력원 검사·HUD·배선을 모델에 붙임
function driveAttach(D, model) {
  const M = motorOf(D.drive); if (!M) return;
  const { r, eta } = designRatio(D), nM = D.rpm, nOut = nM / r;
  const Tin = M.kind === 'stepper' ? M.torqueAt(nM) : M.T, Tout = Tin * r * eta, load = D.drive.load, margin = Tout / load.T;
  const st = margin >= 1.5 ? 'ok' : margin >= 1 ? 'warn' : 'bad', sp = Math.abs(nOut - load.rpm) / load.rpm;
  model.checks.unshift({ st, txt: `${M.short}: 출력 토크 <em>${fmt(Tout / 10, 2)} N·cm</em> (부하 ${fmt(load.T / 10, 2)} N·cm) · 여유 <em>${fmt(margin, 2)}배</em>${margin < 1 ? ' · 힘이 모자랍니다. 다른 동력원이나 더 큰 변속비를 고르세요' : margin < 1.5 ? ' · 1.5배 이상 권장' : ''}` },
    { st: sp <= 0.1 ? 'ok' : 'warn', txt: `출력 회전수 <em>${fmt(nOut, 2)} rpm</em> (목표 ${fmt(load.rpm, 2)} rpm${sp > 0.1 ? `, ${fmt(sp * 100, 0)}% 차이` : ''})` });
  model.hud.unshift(['동력원', M.short], ['토크 여유', fmt(margin, 2) + '배']);
  model.kit = driveKit(D, { r, nOut });
  model.kit.title = M.name;
  if (M.bigAmp) model.kit.notes.push(`${M.short}는 전류가 ${M.amp} A 이상이라 TB6612FNG(1.2 A)로는 부족합니다. BTS7960 같은 큰 드라이버를 쓰고 코드의 핀을 그 드라이버에 맞게 바꾸세요.`);
  if (M.kind !== 'hand') model.kit.notes.push('안전: 전원선에 스위치와 퓨즈(모터 정격 전류의 1.5~2배)를 다세요. 돌아가는 출력부·벨트에 손가락이 닿지 않게 덮개를 씌우고, 처음 켤 때는 손을 떼고 지켜보세요.');
  if (isServo(M) && !M.cont) model.hud.push(['출력 각도', '약 ' + fmt(180 / r, 1) + '°']);
}

// 고정 구조: 덮개 나사 기둥, 설치 귀(나사 구멍), 모터가 아래로 나오면 받침 다리
function housingFix(D, mm, MD) {
  const box = D.box, w = box.wall, I = ccw(boxInner(box)), O = ccw(boxOuter(box)), rp = D.drive && D.drive.fasten === 'insert' ? 4.5 : 3.5, out = { posts: [], ears: [] };
  const busy = [];   // 기둥이 피해야 할 원 [x, y, r]
  D.gears.forEach(g => { const s = D.shafts[g.shaft]; busy.push([s.x, s.y, gearOutlineInfo(g).ra + 0.6]); });
  D.shafts.forEach(s => busy.push([s.x, s.y, s.d / 2 + 1.5]));
  if (mm) { mm.holes.forEach(h => busy.push([h.x, h.y, h.d + 0.5]));
    mm.polys.forEach(R => { const cx = R.reduce((a, q) => a + q[0], 0) / R.length, cy = R.reduce((a, q) => a + q[1], 0) / R.length; busy.push([cx, cy, Math.max(...R.map(q => Math.hypot(q[0] - cx, q[1] - cy))) + 0.5]); });
    if (mm.inputFloor) { const s = D.shafts[D.input]; busy.push([s.x, s.y, mm.inputFloor / 2 + 0.5]); } }
  const C = offsetPoly(I, rp * 0.55), cand = [];
  for (let i = 0; i < C.length; i++) { const a = C[i], b = C[(i + 1) % C.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 3));
    for (let k = 0; k < n; k++) cand.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  const free = cand.filter(p => busy.every(([x, y, r]) => Math.hypot(p[0] - x, p[1] - y) >= r + rp));
  const pick = (pts, n, minD, first) => { const sel = []; if (!pts.length) return sel;
    sel.push(pts.reduce((b, p) => first(p) < first(b) ? p : b));
    while (sel.length < n) { let best = null, bd = -1;
      for (const p of pts) { const d = Math.min(...sel.map(q => Math.hypot(p[0] - q[0], p[1] - q[1]))); if (d > bd) { bd = d; best = p; } }
      if (bd < minD) break; sel.push(best); }
    return sel; };
  out.posts = pick(free, 4, 18, p => p[0] + p[1]).map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]);
  // 설치 귀: 바깥 꼭짓점에서 바깥쪽으로 5 mm
  const Oo = offsetPoly(O, -5.5), ec = [];
  O.forEach((v, i) => { const c = Oo[i]; if (pointInPoly(c[0], c[1], O) || segDist(c[0], c[1], O) < 2.25 + 1.5) return; ec.push({ v, c }); });
  const eSel = pick(ec.map(e => e.c), 4, 25, p => p[0] + p[1]);
  out.ears = eSel.map(c => { const e = ec.find(q => q.c === c); return { v: e.v.map(x => +x.toFixed(2)), c: c.map(x => +x.toFixed(2)) }; });
  out.legH = mm ? Math.ceil(mm.legDrop + 3) : 0;
  return out;
}
// 멈춤나사 블록 (부품 좌표, 축 중심, z 0..hh): D컷 평면(+x)을 향해 M3 탭 구멍(2.5)
function setscrewTris(bd, dcut, a, hh) {
  const R = bd / 2, f = R - dcut, th = Math.acos(f / R), yf = R * Math.sin(th), P = [[-a, -a], [f, -a], [f, -yf]];
  for (let i = 1; i < 32; i++) { const t = -th - (2 * PI - 2 * th) * i / 32; P.push([R * Math.cos(t), R * Math.sin(t)]); }
  P.push([f, yf], [f, a], [-a, a]);
  const back = extrudeTris(P, [], hh);
  const front = xfTris(extrudeTris([[-a, 0], [a, 0], [a, hh], [-a, hh]], [circlePts(1.25, 20, 0, hh / 2)], a - f), XF.basis([0, 1, 0], [0, 0, 1], [1, 0, 0], [f, 0, 0]));
  return back.concat(front);
}
function earTris(e, w) { return extrudeTris(capsulePts(e.v, e.c, 5.5), [circlePts(2.25, 24, e.c[0], e.c[1])], w); }
// 출력 허브: D컷 구멍 + 나사 4개 플랜지 (바퀴·팔·풀리를 붙임)
function outHubTris(d) {
  const rh = d / 2 + 4.5, rf = d / 2 + 13, R = d / 2 + 9;
  const holes = [0, 1, 2, 3].map(k => circlePts(1.7, 20, R * Math.cos(k * PI / 2 + PI / 4), R * Math.sin(k * PI / 2 + PI / 4)));
  return extrudeTris(circlePts(rh, 48), [borePts(d + 0.1, 0.5)], 9).concat(moveTris(extrudeTris(circlePts(rf, 64), [circlePts(rh - 1, 40)].concat(holes), 3), 0, 0, 6));
}
// 공차 시험편: 왼쪽부터 고정 핀 구멍, 회전 구멍, 하우징 구멍, D컷 구멍, 베어링 구멍 +0.10/+0.15/+0.20
function fitTestTris(d, OD) {
  const xs = [], hs = [], gap = 3; let x = 4;
  const add = (pts, r) => { x += r; hs.push(pts.map(([a, b]) => [a + x, b + 8])); x += r + gap; };
  [[d + 0.05, 0], [d + 0.35, 0], [d + 0.4, 0], [d + 0.1, 0.5]].forEach(([dd, c]) => add(borePts(dd, c, 32), dd / 2));
  if (OD) [0.1, 0.15, 0.2].forEach(e => add(circlePts((OD + e) / 2, 48), (OD + e) / 2));
  const W = x + 1;
  return extrudeTris([[0, 0], [W, 0], [W, 16 + Math.max(0, (OD || 0) - 10)], [0, 16 + Math.max(0, (OD || 0) - 10)]].map(p => p), hs.map(h => h.map(([a, b]) => [a, b + Math.max(0, (OD || 0) - 10) / 2])), 4);
}
// 기어 이 굽힘(루이스 식)과 축 비틀림 검사. 부하 토크 × 사용계수 1.5
const MATS = { pla: { ko: 'PLA', tooth: 18, shaft: 10 }, petg: { ko: 'PETG', tooth: 14, shaft: 8 }, nylon: { ko: '나일론', tooth: 20, shaft: 12 } };
function strengthChecks(D, kin) {
  const L = D.drive.load, mat = MATS[D.drive.mat] || MATS.pla, wo = Math.abs(kin.w[D.output]), out = [];
  const Tsh = k => L.T * 1.5 * wo / Math.max(1e-9, Math.abs(kin.w[k]));
  let worst = null;
  D.gears.forEach(g => { if (!D.meshes.some(([a, b]) => D.gears[a] === g || D.gears[b] === g)) return;
    const Y = PI * Math.max(0.05, 0.154 - 0.912 / g.z), Ft = 2 * Tsh(g.shaft) / (g.m * g.z), sig = Ft / (g.b * g.m * Y);
    if (!worst || sig > worst.sig) worst = { g, sig }; });
  if (worst) { const sf = mat.tooth / worst.sig;
    out.push({ st: sf >= 1.5 ? 'ok' : sf >= 1 ? 'warn' : 'bad', txt: `이 강도(${mat.ko}): 가장 힘든 ${worst.g.name}의 굽힘 응력 <em>${fmt(worst.sig, 1)} MPa</em> · 안전율 <em>${fmt(sf, 1)}</em>${sf < 1.5 ? ' · 모듈이나 이폭을 키우세요 (최소 모듈을 올리면 됩니다)' : ''}` }); }
  const so = D.shafts[D.output], tau = 16 * L.T * 1.5 / (PI * so.d ** 3);
  out.push({ st: tau <= mat.shaft ? 'ok' : tau <= 120 ? 'warn' : 'bad', txt: `출력축 비틀림 응력 <em>${fmt(tau, 1)} MPa</em>${tau <= mat.shaft ? ' · 출력한 축도 견딥니다' : tau <= 120 ? ' · 출력한 축은 약하니 금속 D축을 쓰세요' : ' · 금속 축도 위험합니다. 축 지름을 키우세요'}` });
  return out;
}
// 동작 기구 동력원: 입력 부품(크랭크·구동판·톱니바퀴·나사·피니언)을 모터 축에 바로 끼움. 각도 서보는 한 바퀴를 못 돌아 제외
const LK_MOTORS = ['nema17', 'byj48', 'n20_30', 'n20_100', 'n20_300', 'tt', 'm370', 'sg90c', 'mg996c'];
const LK_FORCE = { slider: 1, yoke: 1, jansen: 1, screw: 1 };   // 부하를 힘(N)으로 받는 기구, 나머지는 토크(N·cm)
// 입력축에 걸리는 최대 토크 N·mm
function linkLoadT(D, M) {
  if (!M || !M.ok) return NaN;
  const dr = D.drive || {}, F = +dr.F || 0, T = (+dr.T || 0) * 10;
  if (D.type === 'screw') { const S = D.screw, L = S.p * S.starts, eta = screwEta(S); return F * L / (2 * PI * eta); }
  if (D.type === 'diff') return 2 * T * D.diff.zm / D.diff.zc;
  if (D.type === 'ratchet') return T;
  if (D.type === 'jansen') return F * Math.max(...M.vP);
  const vmax = Math.max(...M.v.map(Math.abs));
  return LK_FORCE[D.type] ? F * vmax : T * vmax * D2R;
}
// 감속 기어 한 단(바닥판 밑): 피니언 12T, 큰 기어 12·i T, 이폭 6 mm. 서보는 직결만
const LK_RED = [2, 3, 4, 5], RED_Z1 = 12, RED_GT = 6, RED_ETA = 0.92;
function redModule(Tm) {   // 피니언 굽힘 응력(루이스, Y≈0.25)이 20 MPa 이하가 되는 가장 작은 모듈
  for (const m of [1, 1.25, 1.5, 2, 2.5]) if (Tm / (m * RED_Z1 / 2) / (RED_GT * m * 0.25) <= 20) return m;
  return 3;
}
function linkMotorOptions(D) {
  const M = linkMotion(D, 180), Treq = Math.max(0.5, (linkLoadT(D, M) || 0) + (+(D.drive || {}).extraT || 0)), n0 = Math.max(0.1, D.rpm), out = [];
  const rq = (D.drive || {}).red, fixed = rq === undefined || rq === 'auto' ? 0 : Math.max(1, Math.round(+rq) || 1);
  for (const id of LK_MOTORS) {
    const Mo = MOTORS[id], vars = [];
    for (const i of isServo(Mo) ? [1] : fixed ? [fixed] : [1, ...LK_RED]) {
      const nm = Mo.kind === 'stepper' ? Math.min(Mo.rpmHi, Math.max(Mo.rpmLo, n0 * i)) : Mo.rpm, n = nm / i;
      const Tm = Mo.kind === 'stepper' ? Mo.torqueAt(nm) : Mo.T, Tin = Tm * i * (i > 1 ? RED_ETA : 1), margin = Tin / Treq, sp = Math.abs(Math.log(n / n0));
      const st = margin < 1 ? 'bad' : sp > Math.log(1.5) || margin < 1.5 ? 'warn' : 'ok';
      vars.push({ id, M: Mo, red: i, nm, n, Tm, Tin, Treq, margin, sp, st, why: margin < 1 ? '힘이 모자랍니다' : sp > Math.log(1.5) ? `입력이 ${fmt(n, n < 20 ? 1 : 0)} rpm으로 돕니다` : margin < 1.5 ? '여유가 적습니다' : '' });
    }
    const rank = e => ({ ok: 0, warn: 1, bad: 2 })[e.st];
    vars.sort((a, b) => rank(a) - rank(b) || (a.st === 'bad' ? b.margin - a.margin : a.sp + 0.15 * Math.abs(Math.log(a.margin / 3)) + 0.12 * (a.red > 1) - b.sp - 0.15 * Math.abs(Math.log(b.margin / 3)) - 0.12 * (b.red > 1)));
    out.push(vars[0]);
  }
  const rank = e => ({ ok: 0, warn: 1, bad: 2 })[e.st];
  out.sort((a, b) => rank(a) - rank(b) || a.sp + 0.15 * Math.abs(Math.log(a.margin / 3)) + 0.12 * (a.red > 1) - b.sp - 0.15 * Math.abs(Math.log(b.margin / 3)) - 0.12 * (b.red > 1));
  return out;
}
function linkDrive(D) {
  const dr = D.drive; if (!dr || !dr.motor || dr.motor === 'none') return null;
  const opts = linkMotorOptions(D), sel = dr.motor === 'auto' ? opts[0] : opts.find(o => o.id === dr.motor) || opts[0];
  return { ...sel, opts, mount: sel.red > 1 ? 'red' : isServo(sel.M) ? 'servo' : dr.mount === 'clamp' && canClamp(sel.M) ? 'clamp' : 'face' };
}
// 볼록 다각형 두 개가 겹치는 깊이 (분리축). 0 이하 = 떨어짐
function convexPen(A, B) {
  let m = Infinity;
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length]; let nx = b[1] - a[1], ny = a[0] - b[0]; const l = Math.hypot(nx, ny); if (l < 1e-9) continue; nx /= l; ny /= l;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const p of A) { const v = p[0] * nx + p[1] * ny; if (v < a0) a0 = v; if (v > a1) a1 = v; }
    for (const p of B) { const v = p[0] * nx + p[1] * ny; if (v < b0) b0 = v; if (v > b1) b1 = v; }
    m = Math.min(m, Math.min(a1, b1) - Math.max(a0, b0)); if (m <= 0) return m;
  }
  return m;
}
// 오목한 다각형끼리 겹치는지 (변 교차 또는 한쪽 점이 다른 쪽 안)
function polyOverlap(A, B) {
  const bb = P => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of P) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; };
  const a = bb(A), b = bb(B); if (a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]) return false;
  const ix = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
  const inBox = p => p[0] >= ix[0] && p[0] <= ix[2] && p[1] >= ix[1] && p[1] <= ix[3];
  const EA = [], EB = [];
  for (let i = 0; i < A.length; i++) { const p = A[i], q = A[(i + 1) % A.length]; if (inBox(p) || inBox(q) || segBoxCross(p, q, ix)) EA.push([p, q]); }
  for (let i = 0; i < B.length; i++) { const p = B[i], q = B[(i + 1) % B.length]; if (inBox(p) || inBox(q) || segBoxCross(p, q, ix)) EB.push([p, q]); }
  const cr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  for (const [p, q] of EA) for (const [r, s] of EB) if (cr(p, q, r) * cr(p, q, s) < 0 && cr(r, s, p) * cr(r, s, q) < 0) return true;
  return pointInPoly(A[0][0], A[0][1], B) || pointInPoly(B[0][0], B[0][1], A);
}
function segBoxCross(p, q, b) { return !(Math.max(p[0], q[0]) < b[0] || Math.min(p[0], q[0]) > b[2] || Math.max(p[1], q[1]) < b[1] || Math.min(p[1], q[1]) > b[3]); }
const trisXY = tris => { const P = []; for (const t of tris) P.push([t[0], t[1]], [t[3], t[4]], [t[6], t[7]]); return hull2(P); };
const trisZ = tris => { let lo = Infinity, hi = -Infinity; for (const t of tris) for (let k = 2; k < 9; k += 3) { if (t[k] < lo) lo = t[k]; if (t[k] > hi) hi = t[k]; } return [lo, hi]; };
// 입력 한 바퀴(또는 한 주기) 동안 부품끼리 겹치는지. 부품은 바닥 모양(볼록 껍질, 또는 오목한 외곽선 clash)과 높이 구간으로 봄
function linkClash(model, K, N = 72) {
  const B = [];
  model.parts.forEach(p => (p.clash || [{ h: trisXY(p.tris), z: trisZ(p.tris) }]).forEach(c => B.push({ name: p.name, h: c.h, z: c.z, cc: c.cc, m: p.motion, own: p.own })));
  model.housing.filter(h => h.assembly !== false && h.name !== '바닥판' && !h.noClash).forEach(h => B.push({ name: h.name, h: trisXY(h.tris), z: trisZ(h.tris), fixed: true, own: h.own }));
  (model.clashFixed || []).forEach(b => B.push({ ...b, fixed: true }));
  (model.pinBodies || []).forEach(q => B.push({ name: q.name, h: circlePts(q.r, 16), z: [q.z0, q.z1], at: q.at, own: q.own, pin: true }));
  const T = K.period, hits = new Map();
  for (let i = 0; i < N; i++) {
    const tt = T * i / N, P = B.map(b => b.m ? (x => b.h.map(p => [x[0] * p[0] + x[1] * p[1] + x[3], x[4] * p[0] + x[5] * p[1] + x[7]]))(b.m(tt))
      : b.at ? (([cx, cy]) => b.h.map(p => [p[0] + cx, p[1] + cy]))(b.at(tt)) : b.h);
    for (let a = 0; a < B.length; a++) for (let c = a + 1; c < B.length; c++) {
      const A = B[a], C = B[c];
      if (A.name === C.name || A.fixed && C.fixed || A.own && A.own.includes(C.name) || C.own && C.own.includes(A.name) || A.pin && C.pin) continue;
      if (Math.min(A.z[1], C.z[1]) - Math.max(A.z[0], C.z[0]) <= 0.05) continue;
      const k = A.name + ' ↔ ' + C.name; if (hits.has(k)) continue;
      if (A.cc || C.cc ? polyOverlap(P[a], P[c]) : convexPen(P[a], P[c]) > 0.05) hits.set(k, Math.round(360 * i / N));
    }
  }
  return [...hits].map(([k, deg]) => ({ pair: k, deg }));
}