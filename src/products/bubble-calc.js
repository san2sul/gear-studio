// ---- 관문 3 공학 계산 (비누방울 총 B안) ----
// 모든 식은 결정적. 재료·마찰·효율처럼 알 수 없는 값은 BUB_ASSUME에 모아 '가정값'으로 표시하고, 원리 시험·시제품 시험으로 확인함.
const BUB_ASSUME = {
  rhoLiq: [1000, 'kg/m³', '비누액 밀도'], muLiq: [0.002, 'Pa·s', '비누액 점도(물의 2배)'], dragK: [3, '배', '링 구멍·가장자리·표면장력 때문에 끌림을 평판 계산의 3배로 잡음'],
  muShaft: [0.35, '', '출력 부품 구멍과 3 mm 축 사이 마찰 계수'], startK: [2, '배', '처음 돌 때 마찰(정지 마찰)'], etaGear: [0.85, '', '출력 평기어 한 쌍 효율'],
  rhoPLA: [1.24, 'g/cm³', 'PLA 밀도(속 채움 100%로 계산 → 무겁게 잡음)'], cq: [0.02, '', '팬 토크 계수 Cq (작은 4날 팬)'], rhoAir: [1.2, 'kg/m³', '공기 밀도'], slip: [0.5, '', '팬 날개 피치 대비 실제 바람 비율'],
  airLo: [1, 'm/s', '방울을 부풀릴 바람 하한(원리 시험으로 확인)'], airHi: [4, 'm/s', '막이 터지지 않을 바람 상한(원리 시험으로 확인)'], sigPLA: [15, 'MPa', 'PLA 출력 기어 허용 굽힘 응력(반복 하중, 보수적)'],
  fSwitch: [1.5, 'N', '마이크로 스위치 누르는 힘'], kSpring: [0.3, 'N/mm', '권장 복귀 스프링 상수'], preSpring: [3, 'mm', '스프링 초기 압축'], fReturnNeed: [0.3, 'N', '방아쇠가 돌아오는 데 필요한 힘(미끄럼 마찰)'],
  i0Fan: [0.15, 'A', '130 모터 무부하 전류'], i0N20: [0.04, 'A', 'N20 모터 무부하 전류(3 V)'], capAA: [2000, 'mAh', 'AA 알칼리 2개 직렬 용량(0.2 A 안팎)'], lifeNeed: [1, '시간', '연속 사용 시간 최소'],
};
const bA = k => BUB_ASSUME[k][0];
// 닫힌 메쉬 부피 (mm³): 원점 사면체 부피 합. 삼각형 = [x,y,z 꼭짓점 3개를 이은 9개 수]
function trisVolume(tris) { let v = 0; for (const t of tris) { const [ax, ay, az, bx, by, bz, cx, cy, cz] = t; v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6; } return Math.abs(v); }
// Lewis 치형 계수 (압력각 20°, 표준 이)
const LEWIS_Y = [[12, 0.245], [13, 0.261], [14, 0.277], [15, 0.290], [16, 0.296], [17, 0.303], [18, 0.309], [19, 0.314], [20, 0.322], [22, 0.331], [24, 0.337], [26, 0.346], [28, 0.353], [30, 0.359], [34, 0.371], [38, 0.384], [43, 0.397], [50, 0.409], [60, 0.422], [75, 0.435], [100, 0.447]];
function lewisY(z) { const T = LEWIS_Y; if (z <= T[0][0]) return T[0][1]; for (let i = 1; i < T.length; i++) if (z <= T[i][0]) { const [z0, y0] = T[i - 1], [z1, y1] = T[i]; return y0 + (y1 - y0) * (z - z0) / (z1 - z0); } return T.at(-1)[1]; }
// 직류 모터 직선 모델: 정격(rpm, T)과 무부하 rpm → 멈춤 토크. 전압에 비례해 줄임
function dcMotor(Mo, volt) { const k = volt / Mo.volt, n0 = Mo.rpmNL * k, Ts = Mo.T * Mo.rpmNL / (Mo.rpmNL - Mo.rpm) * k; return { n0, Ts, speedAt: T => Math.max(0, n0 * (1 - T / Ts)) }; }
function bubbleEngCalc(D, M, opt = {}) {
  const G = bubbleGeom(D), rows = [], row = (key, ko, value, unit, need, ok, how, assume) => rows.push({ key, ko, value, unit, need, ok, how, assume });
  const part = n => M.parts.find(p => p.name === n), mass = n => trisVolume(part(n).tris) / 1000 * bA('rhoPLA');   // g
  // 1) 바퀴 모터: 부하 토크
  const Rw = G.wheelR / 1000, s = Math.max(0, Math.min(2 * G.wheelR, G.tray.level + G.wheelR)) / 1000;   // 잠긴 깊이 m
  const seg = Rw * Rw * Math.acos((Rw - s) / Rw) - (Rw - s) * Math.sqrt(Math.max(0, 2 * Rw * s - s * s)), rm = Rw - s / 2, chord = 2 * Math.sqrt(Math.max(0, 2 * Rw * s - s * s));
  const w2 = D.wheelRpm * 2 * PI / 60, v = w2 * rm, Re = bA('rhoLiq') * v * Math.max(chord, 1e-3) / bA('muLiq'), Cf = Re > 0 ? 1.328 / Math.sqrt(Re) : 0;
  const Tdrag = 0.5 * bA('rhoLiq') * v * v * Cf * 2 * seg * rm * bA('dragK') * 1000;   // N·mm
  const mWheel = mass('링 바퀴') + mass('큰 기어'), Tfric = bA('muShaft') * mWheel / 1000 * 9.81 * 1.5;   // 축 반지름 1.5 mm → N·mm
  const ratio = D.z2 / D.z1, TLrun = (Tdrag + Tfric) / (ratio * bA('etaGear')), TLstart = (Tdrag + Tfric * bA('startK')) / (ratio * bA('etaGear'));
  const n20 = dcMotor(MOTORS.n20_300, D.volt), margin = n20.Ts / TLstart, nPred = n20.speedAt(TLrun), wheelPred = nPred / ratio;
  row('torque', '바퀴 모터 토크 여유(처음 돌 때)', margin, '배', '≥ 2', margin >= 2, `멈춤 토크 ${fmt(n20.Ts, 1)} N·mm ÷ 걸리는 토크 ${fmt(TLstart, 2)} N·mm (끌림 ${fmt(Tdrag, 3)} + 축 마찰 ${fmt(Tfric * bA('startK'), 2)} N·mm를 감속 ${D.z2}:${D.z1}, 효율 ${bA('etaGear')}로 나눔). 잠긴 깊이 ${fmt(s * 1000, 1)} mm, 바퀴+기어 ${fmt(mWheel, 1)} g`, ['rhoLiq', 'muLiq', 'dragK', 'muShaft', 'startK', 'etaGear', 'rhoPLA']);
  row('wheel_pred', '부하를 넣은 링 바퀴 회전수', wheelPred, 'rpm', `목표 ${D.wheelRpm} ±15%`, Math.abs(wheelPred - D.wheelRpm) <= 0.15 * D.wheelRpm, `모터 직선 모델: 무부하 ${fmt(n20.n0, 0)} rpm × (1 − ${fmt(TLrun, 2)}/${fmt(n20.Ts, 1)}) = ${fmt(nPred, 0)} rpm ÷ ${fmt(ratio, 2)}. 설계는 모터 ${fmt(D.motRpm, 0)} rpm(80% 가정)으로 잇수를 정함`, ['etaGear']);
  // 2) 팬: 공기 토크로 회전수, 날개 피치로 바람
  const m130 = dcMotor(MOTORS.m130, D.volt), Dm = 2 * G.fanR / 1000; let nf = m130.n0;
  for (let i = 0; i < 20; i++) { const Ta = bA('cq') * bA('rhoAir') * (nf / 60) ** 2 * Dm ** 5 * 1000; nf = m130.speedAt(Ta); }
  const Tair = bA('cq') * bA('rhoAir') * (nf / 60) ** 2 * Dm ** 5 * 1000, pitch = 4.5 * 360 / 50, vAir = pitch / 1000 * nf / 60 * bA('slip');
  row('air', '팬 바람 세기(링 자리)', vAir, 'm/s', `${bA('airLo')}~${bA('airHi')}`, vAir >= bA('airLo') && vAir <= bA('airHi'), `날개 피치 ${fmt(pitch, 1)} mm(두께 4.5 mm에 50° 비틀림) × 회전수 ${fmt(nf, 0)} rpm × 비율 ${bA('slip')}. 팬 회전수는 공기 토크 ${fmt(Tair, 4)} N·mm를 넣은 모터 직선 모델`, ['cq', 'rhoAir', 'slip', 'airLo', 'airHi']);
  // 3) 기어 이 굽힘 (Lewis): 바퀴가 걸려 모터가 멈춘 최악의 경우
  const Ft = n20.Ts / (D.m * D.z1 / 2), b = 4, sig1 = Ft / (b * D.m * lewisY(D.z1)), sig2 = Ft / (b * D.m * lewisY(D.z2)), sf = bA('sigPLA') / Math.max(sig1, sig2);
  row('gear', '기어 이 굽힘 강도 안전율(모터 멈춤)', sf, '배', '≥ 2', sf >= 2, `이 끝 힘 ${fmt(Ft, 2)} N = 멈춤 토크 ÷ 피니언 반지름 ${fmt(D.m * D.z1 / 2, 1)} mm. 응력 = 힘 ÷ (이폭 ${b} × 모듈 ${D.m} × Y). 피니언 Y ${fmt(lewisY(D.z1), 3)} → ${fmt(sig1, 1)} MPa, 큰 기어 ${fmt(sig2, 1)} MPa, 허용 ${bA('sigPLA')} MPa`, ['sigPLA']);
  // 4) 방아쇠: 당기는 힘과 되돌아오는 힘
  const stroke = (M.measures && M.measures.trigStroke) || 2, pull = (bA('fSwitch') + bA('kSpring') * (bA('preSpring') + stroke)) * 1.1, need = opt.trigForceMax || 15, ret = bA('kSpring') * bA('preSpring');
  row('trig_pull', '방아쇠 당기는 힘', pull, 'N', `≤ ${need}`, pull <= need, `(스위치 ${bA('fSwitch')} N + 스프링 ${bA('kSpring')} N/mm × (초기 ${bA('preSpring')} + 행정 ${stroke}) mm) × 마찰 1.1. 기준은 요청서의 당기는 힘${opt.trigForceMax ? '' : '(정하지 않아 15 N)'}`, ['fSwitch', 'kSpring', 'preSpring']);
  row('trig_ret', '방아쇠 되돌아오는 힘', ret, 'N', `≥ ${bA('fReturnNeed')}`, ret >= bA('fReturnNeed'), `스프링 ${bA('kSpring')} N/mm × 초기 압축 ${bA('preSpring')} mm. 권장 스프링: 바깥 지름 4~5 mm, 자유 길이 10 mm, 상수 약 ${bA('kSpring')} N/mm (자리는 상세 설계에서 만듦)`, ['kSpring', 'preSpring', 'fReturnNeed']);
  // 5) 건전지
  const iFan = bA('i0Fan') + (MOTORS.m130.amp - bA('i0Fan')) * Math.min(1, Tair / MOTORS.m130.T), iN20 = bA('i0N20') + (MOTORS.n20_300.amp - bA('i0N20')) * Math.min(1, TLrun / MOTORS.n20_300.T), I = (iFan + iN20) * 1000, life = bA('capAA') / I;
  row('battery', '건전지 연속 사용 시간', life, '시간', `≥ ${bA('lifeNeed')}`, life >= bA('lifeNeed'), `용량 ${bA('capAA')} mAh ÷ 전류 ${fmt(I, 0)} mA (팬 ${fmt(iFan * 1000, 0)} + 바퀴 ${fmt(iN20 * 1000, 0)} mA, 무부하 전류 + 부하 비례)`, ['i0Fan', 'i0N20', 'capAA', 'lifeNeed']);
  return { rows, pred: { wheelRpm: wheelPred, fanRpm: nf, air: vAir }, ok: rows.every(r => r.ok) };
}
