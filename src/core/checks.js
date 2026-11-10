/* ================= 검사 ================= */
function analyze(D, kin) {
  const out = [];
  const ws = kin.w, wIn = ws[D.input], wOut = ws[D.output];
  if (D.gears.length > 1) {
    const ratio = Math.abs(wIn / wOut);
    const sameDir = Math.sign(wIn) === Math.sign(wOut);
    let st = 'ok', txt = `변속비(입력:출력) <em>${ratioTxt(ratio)}</em> · 출력 <em>${fmt(Math.abs(wOut) * 60 / 2 / PI, 1)} rpm</em> · ${sameDir ? '입력과 같은 방향' : '입력과 반대 방향'}`;
    if (D.target) {
      const tr = D.target.ratio, err = Math.abs(ratio - tr) / tr * 100;
      txt += ` · 목표 대비 <em>${err.toFixed(2)}%</em>`;
      if (err > D.target.tol + 1e-6) st = 'warn';
      if (D.target.dir === 'same' && !sameDir || D.target.dir === 'opposite' && sameDir) st = 'bad';
    }
    out.push({ st, txt });
  }
  for (const [i, j] of D.meshes) {
    const A = D.gears[i], B = D.gears[j];
    const mg = meshGeom(A, B);
    const sa = D.shafts[A.shaft], sb = D.shafts[B.shaft];
    const dist = Math.hypot(sb.x - sa.x, sb.y - sa.y);
    const e = mg.eps;
    let st = e >= 1.2 ? 'ok' : e >= 1.05 ? 'warn' : 'bad';
    if (Math.abs(dist - mg.cd) > 0.01) st = 'bad';
    out.push({ st, txt: `${A.name}–${B.name} 물림률 <em>${e.toFixed(2)}</em>${e < 1.2 ? ' (1.2 이상 권장)' : ''}${overlapTxt(A)} · 중심거리 <em>${fmt(mg.cd, 3)} mm</em>` });
  }
  D.gears.forEach(g => {
    const I = gearOutlineInfo(g), s = D.shafts[g.shaft], bo = boreOf(s);
    if (I.pointed) out.push({ st: 'warn', txt: `${g.name}: 이끝이 뾰족해져 이끝원을 ${fmt(I.ra * 2, 2)} mm로 잘랐습니다. 전위계수를 줄이세요.` });
    if (bo.d > 0 && I.rf - bo.d / 2 < 1.2) out.push({ st: 'bad', txt: `${g.name}: 축 구멍(${fmt(bo.d, 2)} mm)이 이뿌리에 너무 가깝습니다. 구멍을 줄이거나 잇수/모듈을 키우세요.` });
    const zlim = 2 / Math.sin(g.pa * D2R) ** 2 * (1 - g.x);
    if (g.z < zlim - 0.5) out.push({ st: 'warn', txt: `${g.name}: 잇수 ${g.z}는 언더컷 한계(${zlim.toFixed(1)})보다 작습니다. 전위를 주면 이뿌리가 튼튼해집니다.` });
  });
  if (D.box) {
    const { D: Dd, wall } = D.box;
    let fit = true;
    D.gears.forEach(g => {
      const s = D.shafts[g.shaft], ra = gearOutlineInfo(g).ra;
      if (!fitsIn(D.box, s.x, s.y, ra) || g.zpos < wall - 1e-6 || g.zpos + g.b > Dd - wall + 1e-6) fit = false;
    });
    out.push({ st: fit ? 'ok' : 'bad', txt: fit ? `${shapeTxt(D.box).replace(/([\d.]+[×x][\d.×]+ mm|높이 [\d.]+ mm)/, '<em>$1</em>')} 안에 모든 기어가 들어갑니다` : '일부 기어가 벽을 넘습니다' });
  }
  return out;
}

// 회전시키며 치형 다각형끼리 겹치는지 검사
function interference(D, kin, steps = 36) {
  const res = [];
  const outl = D.gears.map(g => gearOutline(g, 8).pts);
  for (const [i, j] of D.meshes) {
    const A = D.gears[i], B = D.gears[j], sa = D.shafts[A.shaft], sb = D.shafts[B.shaft];
    const ia = gearOutlineInfo(A), ib = gearOutlineInfo(B);
    const wa = kin.w[A.shaft], wb = kin.w[B.shaft];
    const T = (2 * PI / A.z) / Math.max(1e-9, Math.abs(wa));
    let hits = 0;
    for (let s = 0; s < steps; s++) {
      const t = T * s / steps, pa = kin.phase[i] + wa * t, pb = kin.phase[j] + wb * t;
      const tf = (pts, ph, cx, cy) => { const c = Math.cos(ph), sn = Math.sin(ph); return pts.map(([x, y]) => [cx + x * c - y * sn, cy + x * sn + y * c]); };
      const PA = tf(outl[i], pa, sa.x, sa.y), PB = tf(outl[j], pb, sb.x, sb.y);
      let hit = false;
      for (const [x, y] of PA) { if (Math.hypot(x - sb.x, y - sb.y) < ib.ra && pointInPoly(x, y, PB)) { hit = true; break; } }
      if (!hit) for (const [x, y] of PB) { if (Math.hypot(x - sa.x, y - sa.y) < ia.ra && pointInPoly(x, y, PA)) { hit = true; break; } }
      if (hit) hits++;
    }
    res.push({ pair: `${A.name}–${B.name}`, hits, steps });
  }
  return res;
}

function ratioTxt(r) { return r >= 1 ? `${fmt(r, 3)} : 1` : `1 : ${fmt(1 / r, 3)}`; }
function fmt(v, d = 2) { const t = (+v).toFixed(d); return t.includes('.') ? t.replace(/\.?0+$/, '') : t; }
