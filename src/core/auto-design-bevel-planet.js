/* ================= 자동 설계: 직각(베벨) · 유성 ================= */
function bevelAuto(P) {
  // P.ratio = 입력:출력 (1 이상 감속, 1 미만 가속). 입력축은 바닥으로 들어오는 수직축
  const R = P.ratio, Rr = R >= 1 ? R : 1 / R;
  const mods = MODULES.filter(m => m >= P.minM - 1e-9).reverse(), out = [];
  // 작은 기어의 등가 잇수가 언더컷 한계 근처 이상이 되도록 시작 잇수를 잡음
  const zs0 = Math.max(P.zmin, Math.ceil(2 / Math.sin(P.pa * D2R) ** 2 * Math.cos(Math.atan(1 / Rr)) - 0.3));
  for (const m of mods) {
    let found = null;
    for (let zs = zs0; zs <= zs0 + 25 && !found; zs++) {
      const zc = Math.round(zs * Rr);
      for (const zb of [zc, zc - 1, zc + 1]) {
        if (zb < zs) continue;
        const ratio = zb / zs; if (Math.abs(ratio - Rr) / Rr > P.tol) continue;
        const zin = R >= 1 ? zs : zb, zout = R >= 1 ? zb : zs;
        // 입력을 수직축에 두는 배치와 수평축에 두는 배치 중 들어가는 쪽
        found = bevelFit({ m, z1: zin, z2: zout, input: 1, P }) || bevelFit({ m, z1: zout, z2: zin, input: 2, P });
        if (found) break;
      }
    }
    if (found) { out.push(found); if (out.length >= 3) break; }
  }
  return out;
}
function bevelFit({ m, z1, z2, input, P }) {
  const d1 = Math.atan2(z1, z2), d2 = PI / 2 - d1, A = m * z1 / 2 / Math.sin(d1);
  const F = Math.floor(Math.min(A / 3, 10 * m) * 100) / 100;
  if (F < 3) return null;
  const hub = Math.min(8, Math.max(3, 1.5 * P.shaftD));
  const base = { m, pa: P.pa, backlash: P.backlash, F, hub };
  const B1 = bevelInfo({ ...base, z: z1, delta: d1, bore: P.shaftD + 0.1 }), B2 = bevelInfo({ ...base, z: z2, delta: d2, bore: P.shaftD + 0.1 });
  for (const B of [B1, B2]) if (B.k * B.rf - (P.shaftD + 0.1) / 2 < 1.2) return null;
  const { W, H, D, wall } = P, c = P.clear;
  const Ox = W - wall - c - B2.H, Oy = H / 2;
  const Oz = Math.max(wall + c + B1.H, wall + c + B2.ra);
  if (Ox - B1.ra < wall + c) return null;
  if (Math.max(B1.ra, B2.ra) > H / 2 - wall - c) return null;
  if (Oz + B2.ra > D - wall - c) return null;
  return { version: 2, kind: 'bevel', m, pa: P.pa, z1, z2, input, F, backlash: P.backlash, hub, shaftD: P.shaftD,
    bore1: +(P.shaftD + 0.1).toFixed(2), bore2: +(P.shaftD + 0.1).toFixed(2), dcut1: 0.5, dcut2: 0.5, rpm: P.rpm,
    box: { W, H, D, wall }, O: [+Ox.toFixed(3), +Oy.toFixed(3), +Oz.toFixed(3)],
    target: { func: 'rightangle', ratio: P.ratio >= 1 ? P.ratio : P.ratio, tol: P.tol * 100 }, summary: { m } };
}

function planetaryAuto(P) {
  const R = P.ratio, out = [];
  if (R < 2.5) return out;
  const mods = MODULES.filter(m => m >= P.minM - 1e-9).reverse();
  const { W, H, D, wall } = P, box = P._box || boxOfP(P);
  let inner = Math.min(W, H) - 2 * wall - 0.6;          // 링기어 바깥(하우징 안쪽에 끼움)
  let cen = [W / 2, H / 2], ringOuter = { w: W - 2 * wall - 0.6, h: H - 2 * wall - 0.6 };
  if (shapeOf(box) !== 'rect' || P.fixIn || P.fixOut) {
    // 유성 감속기는 입력·출력이 같은 축선. 고정점이 있으면 그 자리, 없으면 공간 안 가장 넓은 곳에 둠
    if (P.fixIn && P.fixOut && Math.hypot(P.fixIn[0] - P.fixOut[0], P.fixIn[1] - P.fixOut[1]) > 0.5) return out;
    if (shapeOf(box) === 'cyl') box.keys = true;
    cen = (P.fixIn || P.fixOut || shapeGeo(box).cIn).slice();
    const I = ccw(boxInner(box));
    if (!pointInPoly(cen[0], cen[1], I)) return out;
    inner = 2 * segDist(cen[0], cen[1], I) - 0.6;
    ringOuter = { pts: offsetPoly(I, 0.3).map(q => [+(q[0] - cen[0]).toFixed(3), +(q[1] - cen[1]).toFixed(3)]) };
  }
  const pinD = P.shaftD, gap = 1, tc = Math.max(3, 1.2 * pinD), z0 = wall + 0.5;
  const bAvail = D - wall - 0.8 - z0 - gap - tc;
  for (const N of [3, 4, 5]) {
    let found = null;
    for (const m of mods) {
      const b = +Math.min(bAvail, 10 * m).toFixed(2);
      if (b < 3) continue;
      const cands = [];
      for (let zs = P.zmin; zs <= 80; zs++) {
        const zpc = zs * (R - 2) / 2;
        for (const zp of [Math.floor(zpc), Math.ceil(zpc)]) {
          if (zp < P.zmin) continue;
          const zr = zs + 2 * zp, ratio = 1 + zr / zs;
          if (Math.abs(ratio - R) / R > P.tol || (zs + zr) % N) continue;
          cands.push({ zs, zp, zr, err: Math.abs(ratio - R) / R });
        }
      }
      cands.sort((x, y) => x.zr - y.zr || x.err - y.err);
      for (const c of cands) {
        const d = { m, pa: P.pa, zs: c.zs, zp: c.zp, N, b, backlash: P.backlash };
        const G = planetaryGeom(d), rap = gearOutlineInfo(G.planet).ra;
        if (2 * G.a * Math.sin(PI / N) - 2 * rap < 1) continue;
        const ringRoot = gearOutlineInfo(G.ring).ra;
        if (inner / 2 - ringRoot < 2) break;                 // 더 큰 조합은 더더욱 안 들어감
        if (gearOutlineInfo(G.sun).rf - (P.shaftD + 0.1) / 2 < 1.2) continue;
        if (gearOutlineInfo(G.planet).rf - (pinD + 0.35) / 2 < 1.2) continue;
        const Rc = Math.min(G.a + pinD / 2 + 3, inner / 2 - 0.5);
        if (Rc < G.a + pinD / 2 + 1.5) continue;
        found = { version: 2, kind: 'planetary', m, pa: P.pa, zs: c.zs, zp: c.zp, N, b, backlash: P.backlash, pinD, shaftD: P.shaftD,
          sunBore: +(P.shaftD + 0.1).toFixed(2), outBore: +(P.shaftD + 0.1).toFixed(2), rpm: P.rpm, gap,
          box, center: cen, z0, ringOuter,
          carrier: { tc, Rc: +Rc.toFixed(3), bossR: P.shaftD / 2 + 3, bossTop: D + 6 },
          target: { func: 'planetary', ratio: R, tol: P.tol * 100 }, summary: { m, n: 1 } };
        break;
      }
      if (found) break;
    }
    if (found) out.push(found);
  }
  out.sort((x, y) => y.m * y.b - x.m * x.b || x.N - y.N);
  return out;
}

// 직접 설계 탭용
function bevelPair(Q) {
  const d1 = Math.atan2(Q.z1, Q.z2), A = Q.m * Q.z1 / 2 / Math.sin(d1);
  return { version: 2, kind: 'bevel', m: Q.m, pa: Q.pa, z1: Q.z1, z2: Q.z2, F: Q.F > 0 ? Q.F : Math.floor(Math.min(A / 3, 10 * Q.m) * 100) / 100, input: 1, backlash: Q.bl, hub: Q.hub, spiral: Q.spiral || 0,
    shaftD: Q.bore1 || 4, bore1: Q.bore1, bore2: Q.bore2, dcut1: Q.d1 ? 0.5 : 0, dcut2: Q.d2 ? 0.5 : 0, rpm: Q.rpm, box: null, O: [0, 0, 0], target: null, summary: { m: Q.m } };
}
function planetaryPair(Q) {
  const d = { m: Q.m, pa: Q.pa, zs: Q.zs, zp: Q.zp, N: Q.N, b: Q.b, backlash: Q.bl };
  const G = planetaryGeom(d), ringRoot = gearOutlineInfo(G.ring).ra;
  const Rc = G.a + Q.pinD / 2 + 3;
  return { version: 2, kind: 'planetary', ...d, pinD: Q.pinD, shaftD: Q.sunBore, sunBore: Q.sunBore, outBore: Q.sunBore, rpm: Q.rpm, gap: 1,
    box: null, center: [0, 0], z0: 0, ringOuter: { r: +(ringRoot + Math.max(3, 2 * Q.m)).toFixed(3) },
    carrier: { tc: Math.max(3, 1.2 * Q.pinD), Rc, bossR: Q.sunBore / 2 + 3, bossTop: Q.b + 1 + Math.max(3, 1.2 * Q.pinD) + 6 }, target: null, summary: { m: Q.m } };
}
