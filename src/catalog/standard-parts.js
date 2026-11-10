/* ================= 규격 부품 라이브러리 =================
 시중 규격 부품을 출력용 모형으로 만듦. 모두 대표 치수(제조사마다 조금씩 다름). 출력 방향: 바닥 z=0
 STD[cat] = { g: 분류, t: 이름, f: [[키, 이름, 기본값, 선택지 배열 | 단위 문자열]], mk: p => [{ name, tris }], note } */
const ext = (o, h, H, z0 = 0) => moveTris(extrudeTris(o, h, H), 0, 0, z0);
const sideXZ = (tris, y0 = 0) => xfTris(tris, XF.basis([1, 0, 0], [0, 0, 1], [0, -1, 0], [0, y0, 0]));   // 평면 그림 (x, z) 을 y 방향 두께로
const alongX = (tris, x0 = 0) => xfTris(tris, XF.basis([0, 1, 0], [0, 0, 1], [1, 0, 0], [x0, 0, 0]));    // 평면 그림 (y, z) 을 x 방향으로
const ringPts = (r, n = 48, cx = 0, cy = 0) => circlePts(r, n, cx, cy);
// 원 둘레에 반원 홈(풀리·스프로킷 이 자리)을 판 외곽선: 반지름 Ro, 홈 중심 반지름 Rc, 홈 반지름 rr
function notchPts(z, Ro, Rc, rr, per = 14) {
  const out = [], N = z * per;
  for (let i = 0; i < N; i++) {
    const f = 2 * PI * i / N; let r = Ro;
    for (let j = 0; j < z; j++) { let d = f - 2 * PI * j / z; d -= 2 * PI * Math.round(d / (2 * PI));
      const s = Rc * Math.sin(d); if (Math.abs(d) < PI / 2 && Math.abs(s) < rr) { const rn = Rc * Math.cos(d) - Math.sqrt(rr * rr - s * s); if (rn < r) r = rn; } }
    out.push([r * Math.cos(f), r * Math.sin(f)]);
  }
  return out;
}
// 나선 관 (스프링): 코일 반지름 R, 선 지름 wd, 피치, 감김 수. 양 끝은 평평하게 막음
function helixTube(R, wd, pitch, turns, n = 28, m = 12) {
  const N = Math.max(8, Math.round(turns * n)), rings = [], r = wd / 2;
  for (let i = 0; i <= N; i++) {
    const a = 2 * PI * turns * i / N, z = r + pitch * turns * i / N, c = Math.cos(a), s = Math.sin(a);
    const T = [-R * s, R * c, pitch / (2 * PI)], tl = Math.hypot(...T), t = T.map(v => v / tl), nr = [c, s, 0], b = [t[1] * nr[2] - t[2] * nr[1], t[2] * nr[0] - t[0] * nr[2], t[0] * nr[1] - t[1] * nr[0]];
    rings.push(Array.from({ length: m }, (_, k) => { const q = 2 * PI * k / m, u = Math.cos(q) * r, v = Math.sin(q) * r; return [R * c + u * nr[0] + v * b[0], R * s + u * nr[1] + v * b[1], z + u * nr[2] + v * b[2]]; }));
  }
  const tris = [];
  for (let i = 0; i < N; i++) for (let k = 0; k < m; k++) { const a = rings[i][k], b2 = rings[i][(k + 1) % m], c2 = rings[i + 1][(k + 1) % m], d = rings[i + 1][k]; tris.push([...a, ...d, ...c2], [...a, ...c2, ...b2]); }
  const cap = (ring, flip) => { const c = ring.reduce((s, p) => [s[0] + p[0] / m, s[1] + p[1] / m, s[2] + p[2] / m], [0, 0, 0]);
    for (let k = 0; k < m; k++) { const a = ring[k], b2 = ring[(k + 1) % m]; tris.push(flip ? [...c, ...b2, ...a] : [...c, ...a, ...b2]); } };
  cap(rings[0], false); cap(rings[N], true);
  return tris;
}
const M_LIST = ['1.6', '2', '2.5', '3', '4', '5', '6'];
const WASHER = { 1.6: [1.7, 4, 0.3], 2: [2.2, 5, 0.3], 2.5: [2.7, 6, 0.5], 3: [3.2, 7, 0.5], 4: [4.3, 9, 0.8], 5: [5.3, 10, 1], 6: [6.4, 12, 1.6] };
const INSERT = { 2: [3.6, 3], 2.5: [4, 4], 3: [4.6, 5], 4: [5.6, 6], 5: [6.4, 7] };
// 깊은 홈 볼 베어링 [안, 바깥, 폭]
const BRG = { 681: [1, 3, 1], 682: [2, 5, 1.5], 683: [3, 7, 2], 684: [4, 9, 2.5], 685: [5, 11, 3], 686: [6, 13, 3.5], 687: [7, 14, 3.5], 688: [8, 16, 4], 689: [9, 17, 4],
  623: [3, 10, 4], 624: [4, 13, 5], 625: [5, 16, 5], 626: [6, 19, 6], 627: [7, 22, 7], 608: [8, 22, 7], 609: [9, 24, 7], 6000: [10, 26, 8], 6001: [12, 28, 8], 6002: [15, 32, 9],
  6200: [10, 30, 9], 6201: [12, 32, 10], 6202: [15, 35, 11], MR63: [3, 6, 2.5], MR74: [4, 7, 2.5], MR85: [5, 8, 2.5], MR105: [5, 10, 4], MR115: [5, 11, 4], MR128: [8, 12, 3.5] };
const FBRG = { F623: [3, 10, 4, 11.5, 1], F624: [4, 13, 5, 15, 1], F625: [5, 16, 5, 18, 1], F688: [8, 16, 5, 18, 1.1], F608: [8, 22, 7, 25, 1.5], F695: [5, 13, 4, 15, 1] };
const THRUST = { 'F8-16M': [8, 16, 5], 'F10-18M': [10, 18, 5.5], 51100: [10, 24, 9], 51101: [12, 26, 9], 51102: [15, 28, 9] };
const ONEWAY = { HF0612: [6, 10, 12], HF0812: [8, 12, 12], HF1012: [10, 14, 12] };
const LMUU = { LM6UU: [6, 12, 19], LM8UU: [8, 15, 24], LM10UU: [10, 19, 29], LM12UU: [12, 21, 30] };
function bearingTris(d, D, B) {   // 바깥 고리 + 안 고리 + 그 사이 얕은 홈(실드 모양)
  const g = (D - d) / 2;
  return ext(ringPts(D / 2), [ringPts(d / 2 + 0.1, 32)], B - 0.3).concat(ext(ringPts(D / 2), [ringPts(D / 2 - g * 0.22, 48)], 0.31, B - 0.31), ext(ringPts(d / 2 + g * 0.22, 32), [ringPts(d / 2 + 0.1, 32)], 0.31, B - 0.31));
}
function boltTris(d, L, head) {
  const p = M_PITCH[d] || d * 0.17, hd = +(d * 1.75).toFixed(2), sock = hexPts(Math.max(0.9, d * 0.8));
  const hh = head === 'hex' ? +(d * 0.7).toFixed(2) : head === 'flat' ? +(d * 0.6).toFixed(2) : d;
  const shank = d >= 3 ? threadTris({ d: d - 0.1, p, h: 0.6 * p, prof: prof60, n: 32 }, hh - 0.01, L + 0.01) : ext(ringPts(d / 2 - 0.05, 24), [], L + 0.01, hh - 0.01);
  if (head === 'hex') return ext(hexPts(M_NUT[d] || d * 1.8), [], hh).concat(shank);
  if (head === 'flat') { const T = []; const n = 6; for (let i = 0; i < n; i++) { const r = d + (d / 2 - 0.05 - d) * (i + 1) / n; T.push(...ext(ringPts(d - (d / 2) * i / n, 40), i ? [] : [sock], hh / n + 0.01, hh * i / n)); } return T.concat(shank); }
  return ext(ringPts(hd / 2, 40), [sock], hh * 0.5).concat(ext(ringPts(hd / 2, 40), [], hh * 0.5, hh * 0.5), shank);
}
function profile2020Pts(S = 20, so = 6.2, sd = 6.1, sw = 11, lip = 1.8) {   // 2020 알루미늄 프로파일 단면 (T홈 4개)
  const h = S / 2, P = [];
  for (let k = 0; k < 4; k++) {
    const side = [[-h, -h], [-so / 2, -h], [-so / 2, -h + lip], [-sw / 2, -h + lip], [-sw / 2 + 2, -h + sd], [sw / 2 - 2, -h + sd], [sw / 2, -h + lip], [so / 2, -h + lip], [so / 2, -h]];
    P.push(...rotPts(side, k * PI / 2));
  }
  return P;
}
const STD = {
  bolt: { g: '체결', t: '볼트', f: [['d', '규격 M', '3', M_LIST], ['L', '길이', 10, 'mm'], ['head', '머리', 'socket', [['socket', '육각 홈(렌치)'], ['hex', '육각'], ['flat', '접시']]]],
    mk: p => [{ name: `M${p.d}×${p.L} 볼트`, tris: boltTris(+p.d, +p.L, p.head) }], note: 'M3 이상은 나사산이 있어 출력한 너트와 조여 볼 수 있습니다. 레이어 0.12 mm 권장.' },
  setscrew: { g: '체결', t: '무두볼트(멈춤나사)', f: [['d', '규격 M', '3', M_LIST], ['L', '길이', 4, 'mm']], mk: p => [{ name: `M${p.d}×${p.L} 무두볼트`, tris: screwProxy(+p.d, +p.L, true) }] },
  nut: { g: '체결', t: '너트', f: [['d', '규격 M', '3', M_LIST], ['type', '모양', 'hex', [['hex', '육각'], ['nylon', '나일론 (높은 육각)'], ['square', '사각']]]],
    mk: p => { const d = +p.d, s = M_NUT[d] || d * 1.8, m = +(d * (p.type === 'nylon' ? 1.2 : 0.8)).toFixed(2), pt = M_PITCH[d] || d * 0.17, out = p.type === 'square' ? rectPts(-s / 2, -s / 2, s / 2, s / 2) : hexPts(s);
      return [{ name: `M${d} 너트`, tris: d >= 3 ? threadTris({ d: d + 0.2, p: pt, h: 0.6 * pt, prof: prof60, n: 32 }, 0, m, { outer: out, clr: 0 }) : ext(out, [ringPts(d / 2 + 0.15, 20)], m) }]; } },
  washer: { g: '체결', t: '와셔', f: [['d', '규격 M', '3', M_LIST], ['type', '종류', 'flat', [['flat', '평와셔'], ['spring', '스프링와셔']]]],
    mk: p => { const [di, Do, t] = WASHER[p.d]; if (p.type === 'spring') { const ri = di / 2, ro = di / 2 + Math.max(1, (Do - di) / 3), C = [];
        for (let k = 0; k <= 36; k++) { const a = 0.15 + (2 * PI - 0.3) * k / 36; C.push([ro * Math.cos(a), ro * Math.sin(a)]); } for (let k = 36; k >= 0; k--) { const a = 0.15 + (2 * PI - 0.3) * k / 36; C.push([ri * Math.cos(a), ri * Math.sin(a)]); }
        return [{ name: `M${p.d} 스프링와셔`, tris: ext(C, [], Math.max(0.8, +p.d * 0.25)) }]; }
      return [{ name: `M${p.d} 평와셔`, tris: ext(ringPts(Do / 2), [ringPts(di / 2, 32)], Math.max(0.6, t)) }]; }, note: '얇은 와셔는 출력할 수 있게 두께를 0.6 mm 이상으로 잡았습니다.' },
  insert: { g: '체결', t: '인서트 너트', f: [['d', '규격 M', '3', ['2', '2.5', '3', '4', '5']]],
    mk: p => { const [od, l] = INSERT[p.d]; return [{ name: `M${p.d} 인서트 너트`, tris: ext(Array.from({ length: 24 }, (_, k) => { const r = k % 2 ? od / 2 : od / 2 - 0.3, a = k * PI / 12; return [r * Math.cos(a), r * Math.sin(a)]; }), [ringPts(+p.d / 2 + 0.1, 20)], l) }]; },
    note: '부품에 낼 구멍은 바깥 지름보다 0.2~0.4 mm 작게 잡고, 납땜 인두로 녹여 넣습니다.' },
  spacer: { g: '체결', t: '스페이서·스탠드오프', f: [['d', '규격 M', '3', M_LIST], ['L', '길이', 10, 'mm'], ['type', '종류', 'standoff', [['standoff', '육각 스탠드오프 (양쪽 암나사)'], ['spacer', '둥근 스페이서 (관통)']]]],
    mk: p => { const d = +p.d, L = +p.L, pt = M_PITCH[d] || d * 0.17;
      return [{ name: `M${d}×${L} ${p.type === 'spacer' ? '스페이서' : '스탠드오프'}`, tris: p.type === 'spacer' ? ext(ringPts(d + 1), [ringPts(d / 2 + 0.2, 24)], L)
        : d >= 3 ? threadTris({ d: d + 0.2, p: pt, h: 0.6 * pt, prof: prof60, n: 32 }, 0, L, { outer: hexPts(M_NUT[d] || d * 1.8), clr: 0 }) : ext(hexPts(M_NUT[d] || d * 1.8), [ringPts(d / 2 + 0.15, 20)], L) }]; } },
  tnut: { g: '체결', t: 'T너트 (2020 프로파일)', f: [['d', '규격 M', '5', ['3', '4', '5']]],
    mk: p => { const d = +p.d, hole = [ringPts(d / 2 + 0.15, 24)]; return [{ name: `2020용 M${d} T너트`, tris: ext(rectPts(-5, -5, 5, 5), hole, 2).concat(ext(rectPts(-2.9, -5, 2.9, 5), hole, 1.8, 2 - 0.01)) }]; } },
  lbracket: { g: '체결', t: 'L형 브래킷', f: [['a', '한 변', 20, 'mm'], ['w', '폭', 20, 'mm'], ['t', '두께', 3, 'mm'], ['hd', '구멍', 5.2, 'mm']],
    mk: p => { const a = +p.a, w = +p.w, t = +p.t, hd = +p.hd;
      const base = ext(rectPts(0, 0, a, w), [ringPts(hd / 2, 24, (a + t) / 2, w / 2)], t);
      const up = xfTris(ext(rectPts(0, t, w, a), [ringPts(hd / 2, 24, w / 2, (a + t) / 2)], t), XF.basis([0, 1, 0], [0, 0, 1], [1, 0, 0]));
      return [{ name: `L형 브래킷 ${a}×${a}×${w}`, tris: base.concat(up) }]; }, note: '2020 프로파일 코너 브래킷은 한 변 20, 구멍 5.2(M5)로 두면 됩니다.' },
  shaft: { g: '축·고정', t: '축', f: [['d', '지름', 5, 'mm'], ['L', '길이', 50, 'mm'], ['type', '단면', 'dcut', [['round', '둥근 축'], ['dcut', 'D컷'], ['dd', '양쪽 D컷']]]],
    mk: p => [{ name: `Ø${p.d}×${p.L} 축`, tris: ext(borePts(+p.d - 0.05, p.type === 'round' ? 0 : Math.max(0.4, +p.d * 0.1), 40, p.type === 'dd'), [], +p.L) }], note: '세워서 출력하세요. 굵기 정확도는 수평보다 좋고, 힘을 받는 축은 금속을 쓰세요.' },
  pin: { g: '축·고정', t: '핀 (평행·스프링)', f: [['d', '지름', 3, 'mm'], ['L', '길이', 16, 'mm'], ['type', '종류', 'dowel', [['dowel', '평행 핀'], ['spring', '스프링 핀 (틈 있는 관)']]]],
    mk: p => { const d = +p.d, L = +p.L; if (p.type === 'dowel') return [{ name: `Ø${d}×${L} 평행 핀`, tris: ext(ringPts(d / 2 - 0.03, 32), [], L) }];
      const ro = d / 2, ri = Math.max(0.3, ro - Math.max(0.5, d * 0.12)), C = []; for (let k = 0; k <= 32; k++) { const a = 0.25 + (2 * PI - 0.5) * k / 32; C.push([ro * Math.cos(a), ro * Math.sin(a)]); } for (let k = 32; k >= 0; k--) { const a = 0.25 + (2 * PI - 0.5) * k / 32; C.push([ri * Math.cos(a), ri * Math.sin(a)]); }
      return [{ name: `Ø${d}×${L} 스프링 핀`, tris: ext(C, [], L) }]; } },
  key: { g: '축·고정', t: '평행 키', f: [['b', '폭×높이', '3', ['2', '3', '4', '5', '6']], ['L', '길이', 12, 'mm']],
    mk: p => { const b = +p.b, L = +p.L; return [{ name: `${b}×${b}×${L} 키`, tris: ext(capsulePts([-L / 2 + b / 2, 0], [L / 2 - b / 2, 0], b / 2 - 0.02), [], b - 0.02) }]; }, note: '끝이 둥근 A형 키입니다. 축과 구멍에 키홈(폭 b, 깊이 b/2)을 내야 합니다.' },
  snapring: { g: '축·고정', t: '스냅링 (C형·E형)', f: [['d', '축 지름', 8, 'mm'], ['type', '종류', 'c', [['c', 'C형 (축용)'], ['e', 'E형']]]],
    mk: p => { const d = +p.d, C = [];
      if (p.type === 'e') { const ri = d * 0.4, ro = d * 0.5 + 2; for (let k = 0; k <= 32; k++) { const a = PI / 5 + (2 * PI - 2 * PI / 5) * k / 32; C.push([ro * Math.cos(a), ro * Math.sin(a)]); } for (let k = 32; k >= 0; k--) { const a = PI / 4 + (2 * PI - PI / 2) * k / 32; C.push([ri * Math.cos(a), ri * Math.sin(a)]); } return [{ name: `E링 (축 Ø${d})`, tris: ext(C, [], 1) }]; }
      const ri = d * 0.47, ro = ri + Math.max(1.2, d * 0.12), g = 0.5; for (let k = 0; k <= 40; k++) { const a = g + (2 * PI - 2 * g) * k / 40; C.push([ro * Math.cos(a), ro * Math.sin(a)]); } for (let k = 40; k >= 0; k--) { const a = g + (2 * PI - 2 * g) * k / 40; C.push([ri * Math.cos(a), ri * Math.sin(a)]); }
      const lug = a => ringPts(1.6, 20, (ro + 0.6) * Math.cos(a), (ro + 0.6) * Math.sin(a));
      return [{ name: `C형 스냅링 (축 Ø${d})`, tris: ext(C, [], 1).concat(ext(lug(g + 0.25), [ringPts(0.6, 12, (ro + 0.6) * Math.cos(g + 0.25), (ro + 0.6) * Math.sin(g + 0.25))], 1), ext(lug(-g - 0.25), [ringPts(0.6, 12, (ro + 0.6) * Math.cos(-g - 0.25), (ro + 0.6) * Math.sin(-g - 0.25))], 1)) }]; },
    note: '두께를 1 mm로 키운 모형입니다. 실제 스냅링은 탄성이 있어야 해서 금속을 쓰세요.' },
  collar: { g: '축·고정', t: '축 칼라', f: [['d', '구멍', 8, 'mm'], ['OD', '바깥 지름', 16, 'mm'], ['W', '폭', 8, 'mm']],
    mk: p => [{ name: `Ø${p.d} 축 칼라`, tris: ext(ringPts(+p.OD / 2), [ringPts(+p.d / 2 + 0.1, 32)], +p.W) }], note: '멈춤나사 구멍은 출력 뒤 옆에서 2.5 mm로 뚫고 M3 탭을 내세요.' },
  bearing: { g: '베어링·부싱', t: '깊은 홈 볼 베어링', f: [['k', '규격', '608', Object.keys(BRG)]], mk: p => { const [d, D, B] = BRG[p.k]; return [{ name: `${p.k} 베어링 (${d}×${D}×${B})`, tris: bearingTris(d, D, B) }]; } },
  fbearing: { g: '베어링·부싱', t: '플랜지 베어링', f: [['k', '규격', 'F623', Object.keys(FBRG)]],
    mk: p => { const [d, D, B, Df, Bf] = FBRG[p.k]; return [{ name: `${p.k} 플랜지 베어링`, tris: ext(ringPts(Df / 2), [ringPts(d / 2 + 0.1, 32)], Math.max(0.8, Bf)).concat(moveTris(bearingTris(d, D, B), 0, 0, 0)) }]; } },
  thrust: { g: '베어링·부싱', t: '스러스트 베어링', f: [['k', '규격', 'F8-16M', Object.keys(THRUST)]],
    mk: p => { const [d, D, H] = THRUST[p.k], w = H * 0.3; return [{ name: `${p.k} 스러스트 베어링`, tris: ext(ringPts(D / 2), [ringPts(d / 2 + 0.1, 32)], w).concat(ext(ringPts(D / 2 - 0.8), [ringPts(d / 2 + 0.9, 32)], H - 2 * w + 0.02, w - 0.01), ext(ringPts(D / 2), [ringPts(d / 2 + 0.1, 32)], w, H - w)) }]; } },
  oneway: { g: '베어링·부싱', t: '원웨이 베어링', f: [['k', '규격', 'HF0612', Object.keys(ONEWAY)]],
    mk: p => { const [d, D, L] = ONEWAY[p.k]; return [{ name: `${p.k} 원웨이 베어링`, tris: ext(ringPts(D / 2, 40), [ringPts(d / 2 + 0.1, 32)], L) }]; }, note: '모양만 같은 모형입니다. 한 방향으로만 도는 기능은 없습니다.' },
  pillow: { g: '베어링·부싱', t: '필로우 블록 (KP08 등)', f: [['k', '규격', 'KP08', ['KP08', 'KFL08', 'KP000']]],
    mk: p => { const S = { KP08: [8, 55, 13, 42, 15, 22, 5], KFL08: [8, 48, 27, 37, 0, 0, 5], KP000: [10, 67, 15, 50, 17, 26, 6.5] }[p.k], [d, L, W, hs, Hc, Rb, sh] = S;
      if (p.k === 'KFL08') return [{ name: 'KFL08 플랜지 베어링 유닛', tris: ext(hull2([...ringPts(5, 24, -hs / 2, 0), ...ringPts(5, 24, hs / 2, 0), ...ringPts(13.5, 40)]), [ringPts(sh / 2, 20, -hs / 2, 0), ringPts(sh / 2, 20, hs / 2, 0), ringPts(d / 2 + 0.1, 32)], 4).concat(ext(ringPts(11, 40), [ringPts(d / 2 + 0.1, 32)], 10, 3.99)) }];
      const base = ext(rectPts(-L / 2, -W / 2, L / 2, W / 2), [capsulePts([-hs / 2 - 1.5, 0], [-hs / 2 + 1.5, 0], sh / 2), capsulePts([hs / 2 - 1.5, 0], [hs / 2 + 1.5, 0], sh / 2)], 4);
      const head = sideXZ(ext(hull2([...rectPts(-Rb / 1.6, 3.99, Rb / 1.6, 4), ...ringPts(Rb / 2 + 2, 40, 0, Hc)]), [ringPts(d / 2 + 0.1, 32, 0, Hc)], W - 2), W / 2 - 1);
      return [{ name: `${p.k} 필로우 블록`, tris: base.concat(head) }]; }, note: '축 높이는 KP08 15 mm, KP000 17 mm(바닥에서)입니다.' },
  bushing: { g: '베어링·부싱', t: '오일리스 부싱', f: [['d', '안지름', 8, 'mm'], ['D', '바깥 지름', 10, 'mm'], ['L', '길이', 10, 'mm'], ['fl', '플랜지', 'no', [['no', '없음'], ['yes', '있음']]]],
    mk: p => { const d = +p.d, D = +p.D, L = +p.L, f = p.fl === 'yes' ? ext(ringPts(D / 2 + 2), [ringPts(d / 2 + 0.1, 32)], 1.5) : [];
      return [{ name: `부싱 ${d}×${D}×${L}`, tris: f.concat(ext(ringPts(D / 2), [ringPts(d / 2 + 0.1, 32)], L - (f.length ? 1.49 : 0), f.length ? 1.49 : 0)) }]; } },
  lmuu: { g: '직선 운동', t: '리니어 부싱 (LMUU)', f: [['k', '규격', 'LM8UU', Object.keys(LMUU)]],
    mk: p => { const [d, D, L] = LMUU[p.k]; return [{ name: p.k, tris: ext(ringPts(D / 2), [ringPts(d / 2 + 0.1, 32)], L * 0.15).concat(ext(ringPts(D / 2 - 0.5), [ringPts(d / 2 + 0.1, 32)], 1.2, L * 0.15 - 0.01), ext(ringPts(D / 2), [ringPts(d / 2 + 0.1, 32)], L * 0.7 - 2.38, L * 0.15 + 1.18), ext(ringPts(D / 2 - 0.5), [ringPts(d / 2 + 0.1, 32)], 1.2, L * 0.85 - 1.21), ext(ringPts(D / 2), [ringPts(d / 2 + 0.1, 32)], L * 0.15, L * 0.85 - 0.02)) }]; } },
  sk: { g: '직선 운동', t: '축 지지대 (SK)', f: [['k', '규격', 'SK8', ['SK8', 'SK10', 'SK12']]],
    mk: p => { const [d, h, E, W, H, hs] = { SK8: [8, 20, 42, 14, 32.8, 32], SK10: [10, 20, 42, 14, 32.8, 32], SK12: [12, 23, 42, 14, 37.5, 32] }[p.k];
      const prof = [[-E / 2, 0], [E / 2, 0], [E / 2, 6], [9, 6], [9, H], [-9, H], [-9, 6], [-E / 2, 6]];
      const body = sideXZ(ext(prof, [ringPts(d / 2 + 0.05, 32, 0, h)], W), W / 2);
      return [{ name: `${p.k} 축 지지대 (축 높이 ${h})`, tris: body }]; }, note: '바닥 고정 나사(M5) 구멍은 출력 뒤 위에서 뚫으세요 (간격 32 mm).' },
  rail: { g: '직선 운동', t: '리니어 레일·블록 (MGN)', f: [['k', '규격', 'MGN12', ['MGN9', 'MGN12']], ['L', '레일 길이', 100, 'mm']],
    mk: p => { const [rw, rh, P, bw, bl, bh, bs] = { MGN9: [9, 6.5, 20, 20, 39.9, 8, 15], MGN12: [12, 8, 25, 27, 45.4, 10, 20] }[p.k], L = +p.L;
      const n = Math.max(1, Math.floor((L - 10) / P) + 1), x0 = (L - (n - 1) * P) / 2;
      const rail = ext(rectPts(0, -rw / 2, L, rw / 2), Array.from({ length: n }, (_, i) => ringPts(1.75, 20, x0 + i * P, 0)), rh);
      const blk = ext(rectPts(-bl / 2, -bw / 2, bl / 2, bw / 2), [[-bs / 2, -bs / 2], [bs / 2, -bs / 2], [bs / 2, bs / 2], [-bs / 2, bs / 2]].map(([x, y]) => ringPts(1.25, 16, x, y)), bh);
      return [{ name: `${p.k} 레일 ${L} mm`, tris: rail }, { name: `${p.k} 블록`, tris: blk }]; }, note: '블록 밑의 레일 홈은 단순화했습니다. 나사 구멍 위치와 높이 확인용입니다.' },
  pulley: { g: '동력 전달', t: 'GT2 풀리', f: [['z', '잇수', '20', ['16', '20', '24', '30', '36', '40', '60']], ['d', '구멍', 5, 'mm'], ['dcut', '구멍 모양', 'dcut', [['round', '둥근'], ['dcut', 'D컷']]]],
    mk: p => { const z = +p.z, PD = 2 * z / PI, Ro = PD / 2 - 0.254, B = [borePts(+p.d + 0.15, p.dcut === 'dcut' ? 0.5 : 0, 40)], fr = Ro + 1, hub = Math.max(+p.d / 2 + 3, Math.min(fr - 1, +p.d / 2 + 4.5));
      return [{ name: `GT2 ${z}T 풀리 (구멍 ${p.d})`, tris: ext(ringPts(hub, 40), B, 6).concat(ext(ringPts(fr, 64), B, 1, 5.99), ext(notchPts(z, Ro, Ro + 0.15, 0.6, 10), B, 7, 6.98), ext(ringPts(fr, 64), B, 1, 13.97)) }]; } },
  belt: { g: '동력 전달', t: 'GT2 닫힌 벨트', f: [['L', '둘레', 200, ['100', '110', '122', '140', '158', '200', '232', '280', '300', '400']]],
    mk: p => { const L = +p.L, z = Math.round(L / 2), r = L / (2 * PI), outer = ringPts(r + 0.63, Math.max(96, z * 2));
      const tooth = []; for (let i = 0; i < z * 8; i++) { const f = 2 * PI * i / (z * 8), u = (i % 8) / 8, rr = u > 0.25 && u < 0.75 ? r - 0.75 - 0.13 : r - 0.13; tooth.push([rr * Math.cos(f), rr * Math.sin(f)]); }
      return [{ name: `GT2 벨트 ${L} mm`, tris: ext(outer, [tooth], 6) }]; }, note: 'TPU로 출력하세요. 둘레를 맞춰 보는 모형입니다.' },
  sprocket: { g: '동력 전달', t: '스프로킷 (#25 체인)', f: [['z', '잇수', 15, '개'], ['d', '구멍', 5, 'mm']],
    mk: p => { const z = Math.max(8, Math.round(+p.z)), pt = 6.35, dr = 3.3, Rp = pt / 2 / Math.sin(PI / z), Ro = Rp + 0.3 * pt, B = [borePts(+p.d + 0.15, 0.5, 40)];
      return [{ name: `#25 스프로킷 ${z}T`, tris: ext(notchPts(z, Ro, Rp, dr / 2 + 0.1, 16), B, 2.8).concat(ext(ringPts(Math.min(Rp - dr, +p.d / 2 + 5), 40), B, 6, 2.79)) }]; }, note: '#25(피치 6.35 mm) 체인용 대략 치형입니다.' },
  coupling: { g: '동력 전달', t: '커플링', f: [['d1', '구멍 1', 5, 'mm'], ['d2', '구멍 2', 8, 'mm'], ['type', '종류', 'rigid', [['rigid', '고정형'], ['jaw', '조 커플링 (반쪽 2개 + 스파이더)']]]],
    mk: p => { const d1 = +p.d1, d2 = +p.d2, OD = Math.max(d1, d2) + 10;
      if (p.type === 'rigid') return [{ name: `커플링 ${d1}→${d2}`, tris: ext(ringPts(OD / 2), [borePts(d1 + 0.1, 0.5, 32)], 10).concat(ext(ringPts(OD / 2), [], 1, 9.99), ext(ringPts(OD / 2), [borePts(d2 + 0.1, 0.5, 32)], 10, 10.98)) }];
      const sector = (a0, a1, r0, r1) => { const P = []; for (let k = 0; k <= 8; k++) P.push([r1 * Math.cos(a0 + (a1 - a0) * k / 8), r1 * Math.sin(a0 + (a1 - a0) * k / 8)]); for (let k = 8; k >= 0; k--) P.push([r0 * Math.cos(a0 + (a1 - a0) * k / 8), r0 * Math.sin(a0 + (a1 - a0) * k / 8)]); return P; };
      const half = (d, ph) => ext(ringPts(OD / 2), [borePts(d + 0.1, 0.5, 32)], 10).concat(...[0, 1, 2].map(k => ext(sector(ph + k * 2 * PI / 3 + 0.08, ph + k * 2 * PI / 3 + PI / 3 - 0.08, Math.max(d, d2, d1) / 2 + 1, OD / 2), [], 6, 9.99)));
      const spider = ext(ringPts(Math.max(d1, d2) / 2 + 1.2, 32), [ringPts(Math.max(d1, d2) / 2 + 0.6, 32)], 5).concat(...[0, 1, 2, 3, 4, 5].map(k => ext(sector(k * PI / 3 - 0.07, k * PI / 3 + 0.07, Math.max(d1, d2) / 2 + 1.1, OD / 2 - 0.3), [], 5)));
      return [{ name: `조 커플링 반쪽 ${d1}`, tris: half(d1, 0) }, { name: `조 커플링 반쪽 ${d2}`, tris: half(d2, PI / 3) }, { name: '스파이더 (TPU)', tris: spider }]; } },
  ujoint: { g: '동력 전달', t: '유니버설 조인트', f: [['d', '축 구멍', 5, 'mm']],
    mk: p => { const d = +p.d, R = d / 2 + 5, pw = 6, pt = 3, H = 12, pin = 3;
      const yoke = () => { const T = ext(ringPts(R, 40), [borePts(d + 0.1, 0.5, 32)], 8);
        [1, -1].forEach(sg => T.push(...sideXZ(ext([[-pw / 2, 7.99], [pw / 2, 7.99], [pw / 2, 8 + H - pw / 2], ...Array.from({ length: 11 }, (_, k) => { const a = PI * k / 10; return [pw / 2 * Math.cos(a), 8 + H - pw / 2 + pw / 2 * Math.sin(a)]; }), [-pw / 2, 8 + H - pw / 2]].filter((q, i, A) => i === 0 || Math.hypot(q[0] - A[i - 1][0], q[1] - A[i - 1][1]) > 1e-6), [ringPts(pin / 2 + 0.2, 20, 0, 8 + H - pw / 2)], pt), sg > 0 ? R : -R + pt))); return T; };
      const L = 2 * (R - pt) - 0.6, cr = alongX(ext(ringPts(pin / 2, 20, 0, pin / 2 + 2), [], 2 * R + 2), -R - 1), body = ext(rectPts(-L / 2, -L / 2, L / 2, L / 2).map(q => q), [], 4);
      return [{ name: '유니버설 조인트 요크', tris: yoke() }, { name: '유니버설 조인트 요크', tris: yoke() }, { name: '십자 블록', tris: body.concat(cr.map(t => t.map((v, k) => k % 3 === 2 ? v - pin / 2 : v)), xfTris(cr, XF.Rz(PI / 2)).map(t => t.map((v, k) => k % 3 === 2 ? v - pin / 2 : v))) }]; },
    note: '요크 2개와 십자 블록 1개입니다. 십자 블록의 축(Ø3)은 지름 3 mm 금속봉으로 바꿔 끼우면 더 튼튼합니다.' },
  link: { g: '링크·연결', t: '링크 막대', f: [['L', '구멍 간격', 40, 'mm'], ['n', '구멍 수', 2, '개'], ['w', '폭', 10, 'mm'], ['t', '두께', 4, 'mm'], ['hd', '구멍 지름', 4.3, 'mm']],
    mk: p => { const L = +p.L, n = Math.max(2, Math.round(+p.n)), hd = +p.hd; return [{ name: `링크 ${L} mm`, tris: linkBar([0, 0], [L, 0], +p.w, Array.from({ length: n }, (_, i) => [L * i / (n - 1), 0, hd]), +p.t) }]; } },
  rodend: { g: '링크·연결', t: '로드엔드 (볼 조인트)', f: [['d', '규격 M', '4', ['3', '4', '5', '6']]],
    mk: p => { const d = +p.d, R = d + 2.5, W = d + 1.5, Ls = d * 3, pt = M_PITCH[d] || 0.5;
      const eye = sideXZ(ext(ringPts(R, 40, 0, R), [ringPts(d / 2 + 0.15, 32, 0, R)], W), W / 2);
      const stud = threadTris({ d: d - 0.1, p: pt, h: 0.6 * pt, prof: prof60, n: 32 }, 0, Ls).map(t => t.map((v, k) => k % 3 === 0 ? v : v));
      const studX = xfTris(stud, XF.basis([0, 0, 1], [0, 1, 0], [-1, 0, 0], [-R + 0.6, 0, R]));
      return [{ name: `M${d} 로드엔드`, tris: eye.concat(studX) }]; }, note: '눈 구멍과 수나사 자리만 같은 모형입니다. 실제 볼 회전은 없습니다.' },
  hinge: { g: '링크·연결', t: '힌지 (경첩)', f: [['W', '길이', 30, 'mm'], ['B', '날개 폭', 15, 'mm'], ['t', '두께', 2, 'mm']],
    mk: p => { const W = +p.W, B = +p.B, t = +p.t, rk = t + 1.2, seg = W / 5, pinR = 1.1;
      const leaf = (ks, sg) => { let T = ext(rectPts(0, sg > 0 ? rk : -B, W, sg > 0 ? B : -rk), [ringPts(1.6, 16, W * 0.25, sg * (B + rk) / 2), ringPts(1.6, 16, W * 0.75, sg * (B + rk) / 2)], t);
        T = T.concat(ext(rectPts(0, sg > 0 ? 0.01 : -rk - 0.01, W, sg > 0 ? rk + 0.01 : -0.01), [], t));
        ks.forEach(k => { const x0 = k * seg + (k ? 0.2 : 0), x1 = (k + 1) * seg - (k < 4 ? 0.2 : 0); T = T.concat(alongX(ext(ringPts(rk, 32, 0, rk), [ringPts(pinR + 0.15, 16, 0, rk)], x1 - x0), x0)); });
        return T; };
      return [{ name: '힌지 날개 A', tris: leaf([0, 2, 4], 1) }, { name: '힌지 날개 B', tris: leaf([1, 3], -1) }]; }, note: '두 날개를 맞대고 Ø2 금속봉(또는 출력한 핀)을 끼워 씁니다.' },
  spring: { g: '탄성', t: '스프링', f: [['type', '종류', 'comp', [['comp', '압축'], ['ext', '인장'], ['tor', '비틀림']]], ['D', '바깥 지름', 10, 'mm'], ['wd', '선 지름', 1.2, 'mm'], ['L', '길이', 20, 'mm']],
    mk: p => { const D = +p.D, wd = Math.max(0.8, +p.wd), L = +p.L, R = D / 2 - wd / 2;
      if (p.type === 'comp') { const pitch = Math.max(wd * 1.6, D * 0.35), turns = Math.max(2, (L - wd) / pitch); return [{ name: `압축 스프링 Ø${D}×${L}`, tris: helixTube(R, wd, pitch, turns) }]; }
      const pitch = wd * 1.05, turns = Math.max(2, (L - wd) / pitch), T = helixTube(R, wd, pitch, turns);
      if (p.type === 'ext') { const hook = z => ext(ringPts(R + wd / 2, 32), [ringPts(R - wd / 2, 32)], wd, z); return [{ name: `인장 스프링 Ø${D}×${L}`, tris: T.concat(hook(-wd + 0.01), hook(L - 0.01)) }]; }
      return [{ name: `비틀림 스프링 Ø${D}`, tris: T.concat(xfTris(ext(ringPts(wd / 2, 12), [], D * 0.9), XF.basis([0, 1, 0], [0, 0, 1], [1, 0, 0], [R, 0, wd / 2]))) }]; },
    note: '모양·치수 확인용입니다. 탄성이 필요하면 TPU로 출력하거나 실제 스프링을 쓰세요.' },
  profile: { g: '구조', t: '2020 알루미늄 프로파일', f: [['L', '길이', 60, 'mm']],
    mk: p => [{ name: `2020 프로파일 ${p.L} mm`, tris: ext(profile2020Pts(), [ringPts(2.1, 24)], +p.L) }], note: '가운데 구멍 4.2 mm는 M5 탭 자리입니다.' },
  wheel: { g: '기타', t: '바퀴', f: [['D', '지름', 40, 'mm'], ['W', '폭', 10, 'mm'], ['d', '구멍', 5, 'mm']],
    mk: p => { const D = +p.D, W = +p.W, B = [borePts(+p.d + 0.15, 0.5, 40)], g = Math.min(2, W / 4);
      return [{ name: `바퀴 Ø${D}`, tris: ext(ringPts(D / 2, 96), B, (W - g) / 2).concat(ext(ringPts(D / 2 - 1.5, 96), B, g, (W - g) / 2 - 0.01), ext(ringPts(D / 2, 96), B, (W - g) / 2, (W + g) / 2 - 0.02)) }]; }, note: '가운데 홈에 O링을 끼우면 미끄럼 방지 타이어가 됩니다.' },
  foot: { g: '기타', t: '고무 발', f: [['D', '지름', 16, 'mm'], ['H', '높이', 6, 'mm']],
    mk: p => { const D = +p.D, H = +p.H, T = []; for (let i = 0; i < 4; i++) T.push(...ext(ringPts(D / 2 - i * D * 0.04, 48), [ringPts(1.7, 20)], H / 4 + 0.01, i * H / 4)); return [{ name: `고무 발 Ø${D}`, tris: T }]; }, note: 'TPU로 출력하고 M3 나사로 바닥에 고정합니다.' },
  motor: { g: '모터 모형', t: '모터', f: [['k', '모터', 'nema17', Object.keys(MOTORS).filter(k => MOTORS[k].body || MOTORS[k].servo).map(k => [k, MOTORS[k].short])]],
    mk: p => [{ name: `${MOTORS[p.k].short} 모형`, tris: motorProxy(MOTORS[p.k]) }], note: '앞면 나사 구멍(탭 지름)·돌출부·축 모양을 맞춰 보는 모형입니다.' },
};
// 규격 부품 모델: 담은 부품들을 x 방향으로 나란히 놓음
function stdModel(D) {
  const parts = [], rows = [], notes = []; let x = 0;
  (D.items || []).forEach(it => {
    const S = STD[it.cat]; if (!S) return;
    let pcs; try { pcs = S.mk(it.p); } catch (e) { notes.push(`${S.t}: 만들 수 없는 치수입니다`); return; }
    pcs.forEach((pc, j) => { const b = trisBounds(pc.tris), w = b.hi[0] - b.lo[0], t0 = moveTris(pc.tris, -b.lo[0], -(b.lo[1] + b.hi[1]) / 2, -b.lo[2]);
      const file = [it.cat, ...Object.values(it.p)].join('_').replace(/[^\w.-]+/g, '') + (pcs.length > 1 ? '_' + (j + 1) : '');
      parts.push({ name: pc.name, file, tris: t0, motion: (xx => () => XF.T(xx, 0, 0))(x), n: it.n || 1 }); rows.push({ part: parts.length - 1, cells: [pc.name, `×${it.n || 1}`, S.g] }); x += w + 6; });
    if (S.note && !notes.includes(S.note)) notes.push(S.note);
  });
  const model = { kind: 'std', parts, housing: [], rods: [], extras: [], notes, checks: notes.map(n => ({ st: 'ok', txt: n })), single: true, interference: null,
    hud: [['부품', String(parts.length) + '개']], table: { head: ['부품', '개수', '분류'], rows } };
  model.scad = () => '// 기어 설계실: 규격 부품 모형 (polyhedron). part 번호를 바꿔 하나씩 F6 → STL\npart = 0;\n' + parts.map((p, i) => scadMesh(`p${i}`, p.tris)).join('\n') + '\n' + parts.map((p, i) => `if (part == ${i}) p${i}();   // ${p.name} ×${p.n}`).join('\n') + '\n';
  return model;
}
function lkScrew(D, model, K, M) {
  const { t, z1, bt } = K, checks = model.checks, S = D.screw, R0 = S.d / 2, h = S.p / 2, L = S.p * S.starts, len = S.len;
  const zA = z1 + t, rc = Math.max(K.hubR0, R0 + 1), rj = +(R0 - h - 0.3).toFixed(2), jl = 6, Hn = Math.max(10, 4 * S.p), gx = R0 + 10, Wy = Math.max(2 * R0 + 10, 16);
  const travel = Math.max(1, len - Hn - 4), thMax = 2 * PI * travel / L;
  K.thOf = tt => { const x = K.wv * tt / thMax, f = x - 2 * Math.floor(x / 2); return thMax * (f <= 1 ? f : 2 - f); };
  K.period = 2 * thMax / Math.max(1e-9, K.wv);
  const sc = K.driver(circlePts(rc, 48)).concat(threadTris(S, zA - 0.01, len), moveTris(extrudeTris(circlePts(rj, 32), [], jl + 0.01), 0, 0, zA + len - 0.01));
  model.parts.push({ name: '리드스크루', file: `leadscrew_Tr${S.d}x${L}${S.starts > 1 ? `P${S.p}` : ''}_L${len}`, tris: sc, motion: tt => XF.Rz(K.thOf(tt)), own: ['너트'] });
  const zn0 = zA + len - 2 - Hn, Ro = R0 + 0.9;
  const nut = moveTris(extrudeTris(rectPts(-gx - 6, -Wy / 2, gx + 6, Wy / 2), [circlePts(Ro - 0.3, 48), circlePts(4.25, 32, -gx, 0), circlePts(4.25, 32, gx, 0)], Hn), 0, 0, zn0)
    .concat(threadTris(S, zn0, Hn, { Ro, clr: 0.3 }));
  model.parts.push({ name: '너트', file: `nut_Tr${S.d}x${L}`, tris: nut, motion: tt => XF.T(0, 0, -L * K.thOf(tt) / (2 * PI)), own: ['리드스크루', '안내 기둥'] });
  const zB = zA + len + 1;
  [-gx, gx].forEach((x, k) => model.housing.push({ name: '안내 기둥', file: `guide_post_${k + 1}`, own: ['너트'],
    tris: moveTris(extrudeTris(circlePts(4, 32, x, 0), [], zB - bt + 0.01), 0, 0, bt - 0.01).concat(moveTris(extrudeTris(circlePts(2, 20, x, 0), [], 3.5), 0, 0, zB)) }));
  model.housing.push({ name: '윗판', file: 'top_bridge', own: ['리드스크루'], tris: moveTris(extrudeTris(rectPts(-gx - 6, -6, gx + 6, 6), [circlePts(rj + 0.25, 32), circlePts(2.2, 20, -gx, 0), circlePts(2.2, 20, gx, 0)], t), 0, 0, zB) });
  K.grow(-gx - 10, -Wy / 2 - 4); K.grow(gx + 10, Wy / 2 + 4);
  const dm = S.d - h, lam = Math.atan(L / (PI * dm)), mu = 0.2 / Math.cos(15 * D2R), eta = screwEta(S), lock = Math.tan(lam) < mu;
  const steps = K.MO && K.MO.kind === 'stepper' ? K.MO.steps : 0, v = K.rpm * L / 60;
  checks.unshift({ st: 'ok', txt: `한 바퀴에 <em>${fmt(L, 2)} mm</em> (Tr${S.d}×${L}${S.starts > 1 ? ` P${S.p}, ${S.starts}줄` : ''}) · 이동 속도 <em>${fmt(v, 2)} mm/s</em> · 행정 <em>${fmt(travel, 1)} mm</em>${steps ? ` · 한 스텝 <em>${fmt(L / steps, 4)} mm</em>` : ''}` });
  checks.push({ st: lock ? 'ok' : 'warn', txt: `리드각 <em>${fmt(lam / D2R, 1)}°</em> · 효율 약 <em>${fmt(eta * 100, 0)}%</em> · ${lock ? '모터를 꺼도 너트가 저절로 내려가지 않습니다 (자동 잠김)' : '리드가 커서 무거운 짐이면 너트가 저절로 돌아 내려올 수 있습니다'}` });
  if (K.MO) { const Tin = K.dv.Tin; checks.push({ st: 'ok', txt: `모터로 낼 수 있는 미는 힘 약 <em>${fmt(2 * PI * Tin * eta / L, 0)} N</em> (부하 ${fmt(D.drive.F, 1)} N)` }); }
  model.hud = [['나사', fmt(K.rpm, 1) + ' rpm'], ['리드', fmt(L, 2) + ' mm'], ['속도', fmt(v, 2) + ' mm/s'], ['행정', fmt(travel, 0) + ' mm']];
  model.table = linkTbl([[`리드스크루 Tr${S.d}×${L}`, `나사 길이 ${len} mm · 끝 축 Ø${fmt(2 * rj, 1)}`, `피치 ${S.p} · ${S.starts}줄`, boreTxt(K)], ['너트', `${fmt(2 * gx + 12, 0)}×${fmt(Wy, 0)}×${Hn} mm`, '암나사 +0.3', '안내 구멍 Ø8.5 ×2']]);
  model.asm = ['안내 기둥 두 개를 바닥판에 세워 붙입니다.', '너트를 나사에 돌려 끼우고 안내 기둥에 꿰어 내립니다.', '윗판을 기둥 끝 돌기에 끼워 나사 끝 축을 받칩니다.'];
  model.glue = '안내 기둥을 바닥판에 붙임';
  model.notes.push('나사는 세워서(받침 쪽이 아래) 출력하고, 너트는 눕혀 출력하세요. 나사산이 거칠면 너트를 몇 번 왕복시켜 길들이고 그리스를 바르세요.', '애니메이션은 너트가 위아래 끝 사이를 왕복하도록 모터가 방향을 바꾸는 모습입니다.');
  return [circlePts(5, 20, -gx, 0), circlePts(5, 20, gx, 0)];
}