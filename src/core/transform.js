/* ================= 좌표 변환 (3×4 행렬, 행 우선) ================= */
const XF = {
  I: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
  T: (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z],
  Rz: a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0]; },
  Rx: a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0]; },
  basis: (ex, ey, ez, t = [0, 0, 0]) => [ex[0], ey[0], ez[0], t[0], ex[1], ey[1], ez[1], t[1], ex[2], ey[2], ez[2], t[2]],
  mul(A, B) {
    const o = new Array(12);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      let v = A[r * 4] * B[c] + A[r * 4 + 1] * B[4 + c] + A[r * 4 + 2] * B[8 + c];
      if (c === 3) v += A[r * 4 + 3];
      o[r * 4 + c] = v;
    }
    return o;
  },
  inv(A) {   // 강체 변환의 역
    const t = [A[3], A[7], A[11]], o = [A[0], A[4], A[8], 0, A[1], A[5], A[9], 0, A[2], A[6], A[10], 0];
    for (let r = 0; r < 3; r++) o[r * 4 + 3] = -(o[r * 4] * t[0] + o[r * 4 + 1] * t[1] + o[r * 4 + 2] * t[2]);
    return o;
  },
  apply: (A, p) => [A[0] * p[0] + A[1] * p[1] + A[2] * p[2] + A[3], A[4] * p[0] + A[5] * p[1] + A[6] * p[2] + A[7], A[8] * p[0] + A[9] * p[1] + A[10] * p[2] + A[11]],
};
const xfChain = (...xs) => xs.reduce((a, b) => XF.mul(a, b));
XF.chain3 = (A, B, C) => XF.mul(XF.mul(A, B), C);
function xfTris(tris, A) {
  return tris.map(t => { const o = new Array(9); for (let k = 0; k < 9; k += 3) { const p = XF.apply(A, [t[k], t[k + 1], t[k + 2]]); o[k] = p[0]; o[k + 1] = p[1]; o[k + 2] = p[2]; } return o; });
}
function trisBounds(tris) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (let k = 0; k < 9; k++) { const a = k % 3; if (t[k] < lo[a]) lo[a] = t[k]; if (t[k] > hi[a]) hi[a] = t[k]; }
  return { lo, hi };
}
