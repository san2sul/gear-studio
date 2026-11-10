/* ================= 상자 하우징 (바닥·벽·덮개, 옆면 축 구멍 지원) =================
 holes: [{face:'floor'|'lid'|'+x'|'-x'|'+y'|'-y', u, v, d}]  floor/lid: u=x,v=y / ±x: u=y,v=z / ±y: u=x,v=z */
/* ================= 공간 모양 (사각 상자 · 원통 · 직접 그린 외곽선) =================
 box = { W, H, D, wall, shape: 'rect'|'cyl'|'poly', pts: [[x,y]…] (poly, 상자 좌표 mm), keys: 원통 링기어 고정 홈 여부 }
 원통은 지름 W(=H), 중심 (W/2, H/2). 다각형의 W·H는 꼭짓점의 최대 X·Y */
const shapeOf = box => (box && box.shape) || 'rect';
const SHAPE_CACHE = new WeakMap();
function boxOuter(box) {
  const s = shapeOf(box);
  if (s === 'cyl') return circlePts(box.W / 2, 128, box.W / 2, box.H / 2);
  if (s === 'poly') return ccw(box.pts.map(p => [+p[0], +p[1]]));
  return [[0, 0], [box.W, 0], [box.W, box.H], [0, box.H]];
}
function offsetPoly(P, d) {   // 반시계 다각형을 안쪽으로 d만큼 (꼭짓점은 마이터, 아주 뾰족하면 길이 제한)
  const n = P.length, unit = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  return P.map((b, i) => {
    const a = P[(i + n - 1) % n], c = P[(i + 1) % n], u = unit([b[0] - a[0], b[1] - a[1]]), v = unit([c[0] - b[0], c[1] - b[1]]);
    const n1 = [-u[1], u[0]], n2 = [-v[1], v[0]], f = d / Math.max(1 + n1[0] * n2[0] + n1[1] * n2[1], 0.25);
    return [b[0] + (n1[0] + n2[0]) * f, b[1] + (n1[1] + n2[1]) * f];
  });
}
// 원 + 바깥쪽 네모 홈(dep > 0) n개. 원통 하우징 안쪽과 링기어 바깥을 맞물려 링이 돌지 않게 함
function keyedCircle(R, cx, cy, dep, n = 4, halfW = 3) {
  const pts = [], ha = Math.asin(Math.min(0.9, halfW / R)), M = Math.max(8, Math.round(96 / n));
  for (let k = 0; k < n; k++) {
    const c = 2 * PI * k / n + PI / 4, P = (r, t) => pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
    P(R, c - ha); P(R + dep, c - ha); P(R + dep, c + ha); P(R, c + ha);
    for (let j = 1; j < M; j++) P(R, c + ha + (2 * PI / n - 2 * ha) * j / M);
  }
  return pts;
}
const keyDepth = box => Math.max(0, Math.min(1.5, box.wall - 1.2));
function boxInner(box) {
  const s = shapeOf(box), w = box.wall;
  if (s === 'cyl') return box.keys && keyDepth(box) > 0.5 ? keyedCircle(box.W / 2 - w, box.W / 2, box.H / 2, keyDepth(box)) : circlePts(box.W / 2 - w, 128, box.W / 2, box.H / 2);
  if (s === 'poly') return offsetPoly(boxOuter(box), w);
  return [[w, w], [box.W - w, w], [box.W - w, box.H - w], [w, box.H - w]];
}
function shapeGeo(box) {   // 바깥 외곽선과 안쪽에 들어가는 가장 큰 원(배치 탐색 가지치기용)
  let g = SHAPE_CACHE.get(box);
  if (!g) {
    const O = boxOuter(box);
    let best = { r: -1, c: [box.W / 2, box.H / 2] };
    if (shapeOf(box) === 'poly') {
      const xs = O.map(p => p[0]), ys = O.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      let step = Math.max(x1 - x0, y1 - y0) / 40;
      for (let x = x0; x <= x1; x += step) for (let y = y0; y <= y1; y += step) if (pointInPoly(x, y, O)) { const r = segDist(x, y, O); if (r > best.r) best = { r, c: [x, y] }; }
      for (let it = 0; it < 30; it++, step *= 0.7) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = best.c[0] + dx * step, y = best.c[1] + dy * step;
        if (pointInPoly(x, y, O)) { const r = segDist(x, y, O); if (r > best.r) best = { r, c: [x, y] }; }
      }
    } else best = { r: Math.min(box.W, box.H) / 2, c: [box.W / 2, box.H / 2] };
    g = { O, rIn: best.r, cIn: best.c };
    SHAPE_CACHE.set(box, g);
  }
  return g;
}
// 점 (x, y)에 반지름 r 원이 벽 안쪽에 들어가는지
function fitsIn(box, x, y, r) {
  const s = shapeOf(box), w = box.wall, e = 1e-6;
  if (s === 'cyl') return Math.hypot(x - box.W / 2, y - box.H / 2) + r <= box.W / 2 - w + e;
  if (s === 'poly') { const O = shapeGeo(box).O; return pointInPoly(x, y, O) && segDist(x, y, O) >= r + w - e; }
  return x - r >= w - e && x + r <= box.W - w + e && y - r >= w - e && y + r <= box.H - w + e;
}
// 외곽선 검사: 꼭짓점 3개 이상, 꼬이지 않음, 벽 두께만큼 줄여도 모양이 남음
function polyProblem(pts, wall) {
  if (!pts || pts.length < 3) return '꼭짓점이 3개 이상이어야 합니다.';
  const P = ccw(pts), n = P.length, X = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (X(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return '외곽선의 변이 서로 엇갈립니다.'; }
  if (Math.abs(area2(P)) < 1) return '외곽선 넓이가 너무 작습니다.';
  const I = offsetPoly(P, wall);
  if (area2(I) <= 0 || I.some(q => !pointInPoly(q[0], q[1], P) || segDist(q[0], q[1], P) < wall * 0.9)) return `벽 두께(${wall} mm)를 빼면 안쪽 공간이 꼬입니다. 너무 좁은 곳이나 짧은 변을 넓혀 주세요.`;
  return '';
}
function shapeTxt(box) {
  const s = shapeOf(box);
  return s === 'cyl' ? `원통 Ø${box.W}×${box.D} mm` : s === 'poly' ? `직접 그린 ${box.pts.length}각형 공간 (높이 ${box.D} mm)` : `상자 ${box.W}×${box.H}×${box.D} mm`;
}
// 모양 하우징: 바닥·옆벽(외곽선 − 안쪽) 한 몸, 덮개 따로. 구멍은 바닥·덮개만
function shapeHousing(box, holes) {
  const O = boxOuter(box), I = boxInner(box), w = box.wall;
  const hl = f => holes.filter(h => h.face === f).map(h => h.pts || circlePts(h.d / 2, 32, h.u, h.v));
  return { body: extrudeTris(O, hl('floor'), w).concat(xfTris(extrudeTris(O, [ccw(I)], box.D - 2 * w), XF.T(0, 0, w))), lid: extrudeTris(O, hl('lid'), w) };
}
// OpenSCAD: housing_shell()(바닥+옆벽), housing_plate()(덮개 판)
function scadShell(box) {
  if (shapeOf(box) === 'rect') return `module housing_shell() difference() { cube([BOX[0], BOX[1], BOX[2] - BOX[3]]); translate([BOX[3], BOX[3], BOX[3]]) cube([BOX[0] - 2*BOX[3], BOX[1] - 2*BOX[3], BOX[2]]); }
module housing_plate() cube([BOX[0], BOX[1], BOX[3]]);`;
  const pl = P => '[' + P.map(p => `[${fmt(p[0], 3)}, ${fmt(p[1], 3)}]`).join(', ') + ']';
  return `// 하우징 외곽선 (${shapeTxt(box)}). OUT = 바깥, INN = 안쪽(벽 두께만큼 줄인 선${box.keys ? ', 링기어 고정 홈 포함' : ''})
OUT = ${pl(boxOuter(box))};
INN = ${pl(boxInner(box))};
module housing_shell() difference() { linear_extrude(BOX[2] - BOX[3]) polygon(OUT); translate([0, 0, BOX[3]]) linear_extrude(BOX[2]) polygon(INN); }
module housing_plate() linear_extrude(BOX[3]) polygon(OUT);`;
}
function boxHousing(box, holes) {
  if (shapeOf(box) !== 'rect') return shapeHousing(box, holes);
  const { W, H, D, wall } = box;
  const hl = f => holes.filter(h => h.face === f).map(h => h.pts || circlePts(h.d / 2, 32, h.u, h.v));
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const floor = extrudeTris(rect(0, 0, W, H), hl('floor'), wall);
  const lid = extrudeTris(rect(0, 0, W, H), hl('lid'), wall);
  const side = ['+x', '-x', '+y', '-y'].some(f => holes.some(h => h.face === f));
  let walls;
  if (!side) walls = xfTris(extrudeTris(rect(0, 0, W, H), [rect(wall, wall, W - wall, H - wall)], D - 2 * wall), XF.T(0, 0, wall));
  else {
    const h = D - 2 * wall;
    // ±x 벽: 지역 (u=y, v=z, w=x)
    const xw = (face, x0) => xfTris(extrudeTris(rect(0, wall, H, wall + h), hl(face), wall), XF.basis([0, 1, 0], [0, 0, 1], [1, 0, 0], [x0, 0, 0]));
    // ±y 벽: 지역 (u=x, v=z, w=-y)
    const yw = (face, y0) => xfTris(extrudeTris(rect(wall, wall, W - wall, wall + h), hl(face), wall), XF.basis([1, 0, 0], [0, 0, 1], [0, -1, 0], [0, y0 + wall, 0]));
    walls = [].concat(xw('-x', 0), xw('+x', W - wall), yw('-y', 0), yw('+y', H - wall));
  }
  return { body: floor.concat(walls), lid };
}
