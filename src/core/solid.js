/* ================= 입체 조립 도우미 ================= */
const TRI2D = (o, h) => THREE.ShapeUtils.triangulateShape(o.map(p => new THREE.Vector2(p[0], p[1])), h.map(H => H.map(p => new THREE.Vector2(p[0], p[1]))));
const area2 = p => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
const ccw = p => area2(p) < 0 ? p.slice().reverse() : p;
const cw = p => area2(p) > 0 ? p.slice().reverse() : p;
// 평면 z에 덮개면. up=true 이면 +z를 향함
function capTris(outer, holes, z, up) {
  outer = ccw(outer); holes = holes.map(cw);
  const flat = outer.concat(...holes), tris = [];
  for (const [a, b, c] of TRI2D(outer, holes)) {
    let A = flat[a], B = flat[b], C = flat[c];
    const isCCW = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]) > 0;
    if (isCCW !== up) [B, C] = [C, B];
    tris.push([A[0], A[1], z, B[0], B[1], z, C[0], C[1], z]);
  }
  return tris;
}
// 두 고리(3D, 같은 점 수)를 잇는 옆면. 위에서 볼 때 반시계 고리 → 바깥을 향함
function loftWall(L0, L1) {
  const tris = [], n = L0.length;
  for (let i = 0; i < n; i++) {
    const a = L0[i], b = L0[(i + 1) % n], c = L1[(i + 1) % n], d = L1[i];
    tris.push([...a, ...b, ...c], [...a, ...c, ...d]);
  }
  return tris;
}
const at = (loop, z) => loop.map(p => [p[0], p[1], z]);
