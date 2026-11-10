/* ================= 기어 기하 (단위 mm, 각도 rad) ================= */
const PI = Math.PI, D2R = PI / 180;
const inv = a => Math.tan(a) - a;
function invInverse(v) {            // inv(a)=v 를 뉴턴법으로 풀기
  let a = Math.cbrt(3 * v);
  for (let i = 0; i < 40; i++) { const t = Math.tan(a); a -= (inv(a) - v) / (t * t); }
  return a;
}
function autoShift(z) { return z < 17 ? +Math.min(0.6, (17 - z) / 17).toFixed(3) : 0; }

// 헬리컬: 입력 m·α는 치직각(normal) 값. 치형 계산은 축직각(transverse) 값으로 바꿔서 함
function tvx(g) { if (!g.helix) return g; const c = Math.cos(g.helix * D2R); return { ...g, m: g.m / c, pa: Math.atan(Math.tan(g.pa * D2R) / c) / D2R, helix: 0 }; }
function gearDims(g) {
  g = tvx(g);
  const a = g.pa * D2R, r = g.m * g.z / 2;
  return { a, r, rb: r * Math.cos(a), ra: r + g.m * (1 + g.x), rf: r - g.m * (1.25 - g.x) };
}

// 두 기어의 물림: 중심거리, 물림 압력각, 물림률
function meshGeom(g1, g2) {
  g1 = tvx(g1); g2 = tvx(g2);
  const a = g1.pa * D2R, zs = g1.z + g2.z, xs = g1.x + g2.x;
  const aw = Math.abs(xs) < 1e-9 ? a : invInverse(2 * Math.tan(a) * xs / zs + inv(a));
  const cd = g1.m * zs / 2 * Math.cos(a) / Math.cos(aw);
  const d1 = gearOutlineInfo(g1), d2 = gearOutlineInfo(g2);
  const eps = (Math.sqrt(d1.ra ** 2 - d1.rb ** 2) + Math.sqrt(d2.ra ** 2 - d2.rb ** 2) - cd * Math.sin(aw)) / (PI * g1.m * Math.cos(a));
  return { cd, aw, eps };
}

// 치형 반각 함수 및 유효 이끝원(뾰족해지는 경우 잘라냄)
// internal=true: 내접(링)기어. 이 경우 '이'는 링기어의 이홈 모양이고 이끝/이뿌리가 뒤바뀜
function gearOutlineInfo(g) {
  g = tvx(g);
  const a = g.pa * D2R, r = g.m * g.z / 2, rb = r * Math.cos(a);
  const ra0 = g.internal ? r + 1.25 * g.m : r + g.m * (1 + g.x);
  const rf = g.internal ? r - g.m : r - g.m * (1.25 - g.x);
  const s = g.internal ? g.m * PI / 2 + (g.backlash || 0) : g.m * (PI / 2 + 2 * g.x * Math.tan(a)) - (g.backlash || 0);
  const psi = s / (2 * r) + inv(a);
  const half = rho => psi - inv(Math.acos(Math.min(1, rb / rho)));
  const r0 = Math.max(rb, rf);
  let ra = ra0, pointed = false;
  const minHalf = 0.12 / ra0;              // 이끝 폭 최소 약 0.24 mm
  if (half(ra0) < minHalf) {
    let lo = r0, hi = ra0;
    for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (half(mid) > minHalf) lo = mid; else hi = mid; }
    ra = lo; pointed = true;
  }
  return { a, r, rb, ra, rf, r0, half, pointed };
}

// 이 하나의 극좌표 [반지름, 각도] 목록 (0번 이 중심이 각도 0, 다음 이 직전까지의 이뿌리 원호 포함)
// z가 정수가 아니어도 됨 (베벨기어의 등가 평기어)
function toothPolar(g, res = 12) {
  const I = gearOutlineInfo(g), { rb, ra, rf, r0, half } = I;
  const out = [], step = 2 * PI / g.z, h0 = half(r0), hT = half(ra);
  const u0 = Math.sqrt(Math.max(0, (r0 / rb) ** 2 - 1)), u1 = Math.sqrt((ra / rb) ** 2 - 1);
  const rhos = [];
  for (let i = 0; i <= res; i++) { const u = u0 + (u1 - u0) * i / res; rhos.push(rb * Math.sqrt(1 + u * u)); }
  rhos[0] = r0; rhos[res] = ra;
  const rootN = Math.max(2, Math.round(12 / Math.sqrt(g.z)));
  if (rf < r0 - 1e-6) out.push([rf, -h0]);
  for (const rho of rhos) out.push([rho, -half(rho)]);
  for (let j = 1; j < 3; j++) out.push([ra, -hT + 2 * hT * j / 3]);
  for (let i = rhos.length - 1; i >= 0; i--) out.push([rhos[i], half(rhos[i])]);
  if (rf < r0 - 1e-6) out.push([rf, h0]);
  for (let j = 1; j < rootN; j++) out.push([rf, h0 + (step - 2 * h0) * j / rootN]);
  return { tooth: out, info: I };
}

// 2D 외곽선 (반시계), 0번 이의 중심이 +X 방향
function gearOutline(g, res = 12) {
  const { tooth, info } = toothPolar(g, res), pts = [], step = 2 * PI / g.z;
  for (let k = 0; k < g.z; k++) for (const [rr, t] of tooth) pts.push([rr * Math.cos(t + k * step), rr * Math.sin(t + k * step)]);
  return { pts, info };
}

function borePts(d, dcut, n = 40, dd = false) {
  const R = d / 2, out = [];
  if (!(d > 0)) return null;
  if (dd && dcut > 0 && dcut < R) {   // 양쪽 D컷 (28BYJ-48 같은 모터 축)
    const f = R - dcut, t1 = Math.acos(f / R), h = n >> 1;
    for (let i = 0; i <= h; i++) { const t = t1 + (PI - 2 * t1) * i / h; out.push([R * Math.cos(t), R * Math.sin(t)]); }
    for (let i = 0; i <= h; i++) { const t = PI + t1 + (PI - 2 * t1) * i / h; out.push([R * Math.cos(t), R * Math.sin(t)]); }
  } else if (dcut > 0 && dcut < R) {
    const f = R - dcut, t1 = Math.acos(f / R);
    for (let i = 0; i <= n; i++) { const t = t1 + (2 * PI - 2 * t1) * i / n; out.push([R * Math.cos(t), R * Math.sin(t)]); }
  } else for (let i = 0; i < n; i++) { const t = 2 * PI * i / n; out.push([R * Math.cos(t), R * Math.sin(t)]); }
  return out;
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
