/* ================= 베벨기어 ================= */
// g: {m, z, pa, backlash, delta(rad), F, bore, dcut, hub}
function bevelInfo(g) {
  const r = g.m * g.z / 2, c = Math.cos(g.delta);
  const A = r / Math.sin(g.delta), H = r / Math.tan(g.delta), k = 1 - g.F / A;
  const v = { m: g.m, z: g.z / c, pa: g.pa, x: 0, backlash: g.backlash };
  const vi = gearOutlineInfo(v);
  // 등가 평기어(뒷원뿔 전개면)의 점을 꼭짓점에서 뒷면 평면(z=0)으로 중심 투영
  const rv = r / c, sn = Math.sin(g.delta), proj = rr => rr * c * H / (H - (rr - rv) * sn);
  const ra = proj(vi.ra), rf = proj(vi.rf);      // 뒷면(heel)의 이끝/이뿌리 반지름
  const zt = (1 - k) * H;                         // 앞면(toe) 높이
  const rh = Math.min(k * rf - 0.6, (g.bore || 0) / 2 + 3.5);
  const hub = rh >= (g.bore || 0) / 2 + 1.2 ? Math.max(0, Math.min(g.hub || 0, k * H - zt - 2)) : 0;
  return { r, A, H, k, v, vi, ra, rf, zt, rh, hub, c, proj };
}
function bevelHeel(g) {
  const B = bevelInfo(g), { tooth } = toothPolar(B.v, 10), pts = [], step = 2 * PI / g.z;
  for (let k = 0; k < g.z; k++) for (const [rr, t] of tooth) { const a = t / B.c + k * step, q = B.proj(rr); pts.push([q * Math.cos(a), q * Math.sin(a)]); }
  return pts;
}
// 지역 좌표: 뒷면 z=0, 꼭짓점 (0,0,H)
// 스파이럴 베벨(근사): 피치 원뿔 위에서 이 줄이 원호를 그리며 옆으로 s(u)만큼 밀림 → 높이 z에서 회전각 θ = s(u)/r(u)
// spiral: 이폭 가운데에서의 나선각(°), 부호 = 방향 (맞물리는 짝은 반대 부호)
function bevelTwist(g) {
  if (!g.spiral) return null;
  const B = bevelInfo(g), sg = Math.sign(g.spiral), tp = Math.tan(Math.abs(g.spiral) * D2R), Rc = 0.9 * B.A, F = g.F;
  // 회전각은 꼭짓점에서의 거리 R(구면)로 정함 → 맞물리는 짝과 같은 구면에서 같은 만큼 밀림 (평면 z로 정하면 이끝·이뿌리가 어긋남)
  return (rho, z) => { const R = Math.hypot(rho, B.H - z), u = B.A - R; return sg * (tp * u + ((u - F / 2) ** 2 - (F / 2) ** 2) / (2 * Rc)) / (B.r * R / B.A); };
}
function bevelTris(g) {
  const B = bevelInfo(g), heel = ccw(bevelHeel(g)), tw = bevelTwist(g);
  const layer = z => { const kz = (B.H - z) / B.H; return heel.map(([x, y]) => { x *= kz; y *= kz; if (!tw) return [x, y]; const t = tw(Math.hypot(x, y), z), c = Math.cos(t), sn = Math.sin(t); return [x * c - y * sn, x * sn + y * c]; }); };
  const toe = layer(B.zt);
  const bore = borePts(g.bore, g.dcut), tris = [];
  const nL = tw ? 16 : 1;
  for (let j = 0; j < nL; j++) { const z0 = B.zt * j / nL, z1 = B.zt * (j + 1) / nL; tris.push(...loftWall(at(layer(z0), z0), at(layer(z1), z1))); }
  tris.push(...capTris(layer(0), bore ? [bore] : [], 0, false));
  const top = B.zt + B.hub;
  if (B.hub > 0) {
    const hc = circlePts(B.rh, 64);
    tris.push(...capTris(toe, [hc], B.zt, true), ...loftWall(at(hc, B.zt), at(hc, top)), ...capTris(hc, bore ? [bore] : [], top, true));
  } else tris.push(...capTris(toe, bore ? [bore] : [], B.zt, true));
  if (bore) { const bl = cw(bore); tris.push(...loftWall(at(bl, 0), at(bl, top))); }
  return tris;
}
