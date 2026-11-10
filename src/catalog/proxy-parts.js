// ---- 구입 부품 출력 모형: 부품 목록(BOM)의 나사·너트·축·베어링·벨트·모터를 시험 조립용으로 출력
// 실제 부품을 사기 전에 구멍·길이·자리를 맞춰 보는 용도. 강도가 필요한 곳은 진짜 부품을 쓰세요
const prof60 = u => u < 0.0625 ? 0 : u < 0.4375 ? (u - 0.0625) / 0.375 : u < 0.5625 ? 1 : u < 0.9375 ? 1 - (u - 0.5625) / 0.375 : 0;
const M_PITCH = { 1.6: 0.35, 2: 0.4, 2.5: 0.45, 3: 0.5, 4: 0.7, 5: 0.8, 6: 1 }, M_NUT = { 1.6: 3.2, 2: 4, 2.5: 5, 3: 5.5, 4: 7, 5: 8, 6: 10 };
const hexPts = (s, cx = 0, cy = 0) => Array.from({ length: 6 }, (_, k) => { const a = PI / 6 + k * PI / 3, r = s / Math.sqrt(3); return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
function screwProxy(d, L, headless) {   // 육각 홈 머리 볼트(나사산은 M3 이상만). 머리 윗면이 바닥(출력 방향)
  const p = M_PITCH[d] || d * 0.17, hd = +(d * 1.75).toFixed(2), hh = d, sock = hexPts(Math.max(0.9, d * 0.8));
  const shank = d >= 3 ? threadTris({ d: d - 0.1, p, h: 0.6 * p, prof: prof60, n: 32 }, headless ? 0 : hh - 0.01, L + 0.01) : moveTris(extrudeTris(circlePts(d / 2 - 0.05, 24), [], L + 0.01), 0, 0, headless ? 0 : hh - 0.01);
  if (headless) return shank;
  return extrudeTris(circlePts(hd / 2, 40), [sock], hh * 0.5).concat(moveTris(extrudeTris(circlePts(hd / 2, 40), [], hh * 0.5), 0, 0, hh * 0.5)).concat(shank);
}
function nutProxy(d) {
  const s = M_NUT[d] || d * 1.8, m = +(d * 0.8).toFixed(2), p = M_PITCH[d] || d * 0.17;
  return d >= 3 ? threadTris({ d: d + 0.2, p, h: 0.6 * p, prof: prof60, n: 32 }, 0, m, { outer: hexPts(s), clr: 0 }) : extrudeTris(hexPts(s), [circlePts(d / 2 + 0.15, 20)], m);
}
function motorProxy(M) {   // 모터 모형: 앞면 나사 구멍(탭 지름), 돌출부, D컷 축. 앞면이 위
  if (isServo(M)) return motorBodyTris(M, 0, 0, 0, 0);
  const B = M.body, out = B.type === 'cyl' ? circlePts(B.r, 48, B.cx, B.cy) : B.type === 'flatcyl' ? flatcylPts(B.r, B.flat) : rectPts(B.cx - B.w / 2, B.cy - B.h / 2, B.cx + B.w / 2, B.cy + B.h / 2);
  const fh = Math.min(6, B.L / 2), holes = (M.holes || []).filter(([x, y]) => pointInPoly(x, y, out)).map(([x, y]) => circlePts(M.screw * 0.42, 16, x, y));
  const ears = (M.holes || []).filter(([x, y]) => !pointInPoly(x, y, out));   // 28BYJ-48처럼 몸통 밖의 귀
  let T = moveTris(extrudeTris(out, [], B.L - fh + 0.01), 0, 0, -B.L).concat(moveTris(extrudeTris(out, holes, fh), 0, 0, -fh));
  if (ears.length) { const e = hull2(ears.flatMap(([x, y]) => circlePts(M.screw / 2 + 3, 20, x, y)).concat(circlePts(5, 16)));
    T = T.concat(moveTris(extrudeTris(e, ears.map(([x, y]) => circlePts(M.screw / 2 + 0.2, 20, x, y)), 1.2), 0, 0, -1.2)); }
  T = T.concat(moveTris(extrudeTris(circlePts(M.boss.d / 2, 40), [], M.boss.h + 0.01), 0, 0, -0.01));
  return T.concat(moveTris(extrudeTris(borePts(M.shaft.d - 0.05, M.shaft.dcut || 0, 32, !!M.shaft.dd), [], M.shaft.len - M.boss.h + 0.01), 0, 0, M.boss.h - 0.01));
}
function proxyParts(bom) {
  const out = [], seen = new Set(), num = (re, t) => { const m = t.match(re); return m ? +m[1] : NaN; };
  const add = (file, tris, n, note) => { if (seen.has(file)) { out.find(o => o.file === file).n += n; return; } seen.add(file); out.push({ file, tris, n, note }); };
  for (const [name, n0, det = ''] of bom || []) {
    const n = +n0 || 1, all = name + ' ' + det, mo = Object.values(MOTORS).find(M => M.name === name);
    if (mo) { if (mo.body || mo.servo) add(`motor_${mo.short.replace(/\W+/g, '')}`, motorProxy(mo), n, `${mo.short} 모형: 앞면 나사 구멍·돌출부·축 위치를 맞춰 보는 용도`); continue; }
    const md = num(/M(\d+(?:\.\d+)?)/, name);
    if (isFinite(md) && /인서트/.test(name)) { const od = num(/바깥 (\d+(?:\.\d+)?)/, name) || 4, l = num(/길이 (\d+(?:\.\d+)?)/, name) || 5;
      add(`insert_M${md}`, extrudeTris(Array.from({ length: 24 }, (_, k) => { const r = k % 2 ? od / 2 : od / 2 - 0.25, a = k * PI / 12; return [r * Math.cos(a), r * Math.sin(a)]; }), [circlePts(md / 2 + 0.1, 20)], l), n, `M${md} 인서트 너트 모형 (바깥 ${od} mm)`); continue; }
    if (isFinite(md) && /나사|볼트/.test(name)) {
      const L = num(/×(\d+(?:\.\d+)?)/, name) || num(/길이 (\d+(?:\.\d+)?)/, det) || 10, headless = /무두/.test(name);
      add(`screw_M${md}x${fmt(L, 0)}${headless ? '_set' : ''}`, screwProxy(md, Math.round(L), headless), n, `M${md}×${fmt(L, 0)} ${headless ? '무두볼트' : '볼트'} 모형${md < 3 ? ' (나사산 없음, 길이·머리 확인용)' : ''}`);
      if (/너트/.test(name)) add(`nut_M${md}`, nutProxy(md), n, `M${md} 너트 모형`);
      continue; }
    if (isFinite(md) && /너트/.test(name)) { add(`nut_M${md}`, nutProxy(md), n, `M${md} 너트 모형`); continue; }
    const bd = num(/베어링 (\d+)/, name);
    if (isFinite(bd)) { const b = Object.entries(BEARINGS).find(([, v]) => +v[0] === bd); if (b) { const [d, [nm, OD, Bw]] = b;
      add(`bearing_${nm}`, extrudeTris(circlePts(OD / 2 - 0.05, 48), [circlePts(+d / 2 + 0.1, 32)], Bw).concat(moveTris(extrudeTris(circlePts(OD / 2 - 1.2, 48), [circlePts(+d / 2 + 1.2, 32)], 0.4), 0, 0, Bw - 0.01)), n, `${nm} 베어링 모형 (${d}×${OD}×${Bw}, 돌지 않음, 자리 맞춤용)`); } continue; }
    const bu = name.match(/부싱 (\d+(?:\.\d+)?)×(\d+(?:\.\d+)?)/);
    if (bu) { add(`bushing_${bu[1]}x${bu[2]}`, extrudeTris(circlePts(+bu[2] / 2, 32), [circlePts(+bu[1] / 2 + 0.1, 24)], 6), n, `부싱 모형 ${bu[1]}×${bu[2]}×6`); continue; }
    const er = num(/E링 \(축 Ø(\d+(?:\.\d+)?)/, name);
    if (isFinite(er)) { const ri = er * 0.4, ro = er * 0.5 + 2, C = [];
      for (let k = 0; k <= 32; k++) { const a = PI / 5 + (2 * PI - 2 * PI / 5) * k / 32; C.push([ro * Math.cos(a), ro * Math.sin(a)]); }
      for (let k = 32; k >= 0; k--) { const a = PI / 4 + (2 * PI - PI / 2) * k / 32; C.push([ri * Math.cos(a), ri * Math.sin(a)]); }
      add(`ering_${er}`, extrudeTris(C, [], 1), n, `E링 모형 (축 Ø${er}, 두께 1 mm로 키움)`); continue; }
    const sd = num(/Ø(\d+(?:\.\d+)?)/, name);
    if (isFinite(sd) && /축/.test(name) && !/핀/.test(name)) { const L = num(/길이 (\d+(?:\.\d+)?)/, det) || 40, round = /둥근/.test(name);
      add(`shaft_d${sd}_L${fmt(L, 0)}${round ? '' : '_dcut'}`, extrudeTris(borePts(sd - 0.05, round ? 0 : 0.5, 32), [], L), n, `Ø${sd}${round ? '' : ' D컷'} 축 모형 ${fmt(L, 0)} mm (세워서 출력)`); continue; }
    const belt = num(/둘레 (\d+)/, all), bc = num(/중심거리 (\d+(?:\.\d+)?)/, all);
    if (/벨트/.test(name) && isFinite(belt)) { const C = isFinite(bc) ? bc : belt / 4, r = Math.max(5, (belt - 2 * C) / (2 * PI));
      add(`belt_GT2_L${belt}`, extrudeTris(capsulePts([0, 0], [C, 0], r + 0.7), [capsulePts([0, 0], [C, 0], r - 0.7)], 6), n, `GT2 벨트 모형 (둘레 ${belt} mm, 이 없음, TPU로 출력)`); continue; }
  }
  return out;
}