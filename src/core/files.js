/* ================= 파일 생성 ================= */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {   // 무압축(store) ZIP
  const enc = new TextEncoder(), chunks = [], central = [];
  let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true);
    h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    chunks.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
    c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((s, a) => s + a.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  const all = [...chunks, ...central, new Uint8Array(e.buffer)];
  const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0)); let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}

// 삼각형 배열 [[ax,ay,az,bx,...,cz],...] → 바이너리 STL
function stlBinary(tris, name = 'gear') {
  const buf = new ArrayBuffer(84 + tris.length * 50), dv = new DataView(buf);
  const hdr = new TextEncoder().encode(('gear-studio ' + name).slice(0, 79));
  new Uint8Array(buf).set(hdr, 0);
  dv.setUint32(80, tris.length, true);
  let o = 84;
  for (const t of tris) {
    const ux = t[3] - t[0], uy = t[4] - t[1], uz = t[5] - t[2], vx = t[6] - t[0], vy = t[7] - t[1], vz = t[8] - t[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
    dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true); o += 12;
    for (let k = 0; k < 9; k++) { dv.setFloat32(o, t[k], true); o += 4; }
    o += 2;
  }
  return new Uint8Array(buf);
}

/* 프린터 보정 (프린터 보정 탭에서 시험편을 재어 정함, 기본은 0)
 outer: 바깥 테두리를 안쪽으로 줄이는 양(mm, 넘쳐 나오는 만큼), hole: 구멍을 키우는 양(mm, 반지름), backlash: 모든 기어 백래시에 더하는 양(mm) */
const FIT = { outer: 0, hole: 0, backlash: 0 };
function fitSet(f) { const c = (v, a, b) => Math.min(b, Math.max(a, +v || 0)); FIT.outer = c(f && f.outer, -0.3, 0.3); FIT.hole = c(f && f.hole, -0.3, 0.3); FIT.backlash = c(f && f.backlash, 0, 0.4); return FIT; }
function fitZero(fn) { const s = { ...FIT }; fitSet({}); try { return fn(); } finally { fitSet(s); } }
const fitOn = () => !!(FIT.outer || FIT.hole || FIT.backlash);
// 다각형을 안쪽(+d)·바깥쪽(−d)으로 옮김. 짧은 변에서 생기는 작은 꼬임(변 방향이 뒤집힌 곳)은 걷어 냄
function fitOffset(P, d) {
  if (!d || !P || P.length < 3) return P;
  const ar = p => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
  let Q = P.filter((p, i) => { const q = P[(i + 1) % P.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4; });
  if (ar(Q) < 0) Q = Q.slice().reverse();
  let R = offsetPoly(Q, d), O = Q;
  for (let it = 0; it < 20; it++) {
    const n = R.length, bad = []; if (n < 3) return P;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n, e1 = [R[j][0] - R[i][0], R[j][1] - R[i][1]], e0 = [O[j][0] - O[i][0], O[j][1] - O[i][1]]; if (e1[0] * e0[0] + e1[1] * e0[1] <= 0) bad.push(i); }
    if (!bad.length) break;
    const drop = new Set(); bad.forEach(i => { const j = (i + 1) % n; if (drop.has(i)) return; R[i] = [(R[i][0] + R[j][0]) / 2, (R[i][1] + R[j][1]) / 2]; drop.add(j); });
    R = R.filter((_, i) => !drop.has(i)); O = O.filter((_, i) => !drop.has(i));
  }
  return R.length >= 3 && ar(R) > 0 ? R : P;
}
// 두 다각형 꼭짓점-변 사이 가장 짧은 거리 (대략)
function polyGap(A, B) {
  const ds = (p, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], l = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l)); return Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy); };
  let m = Infinity; for (const p of A) for (let i = 0; i < B.length; i++) m = Math.min(m, ds(p, B[i], B[(i + 1) % B.length]));
  for (const p of B) for (let i = 0; i < A.length; i++) m = Math.min(m, ds(p, A[i], A[(i + 1) % A.length]));
  return m;
}
// 2D 다각형(구멍 포함) 압출 → 삼각형. tri2d: 외곽+구멍 삼각분할 함수 주입. 프린터 보정(FIT)이 있으면 테두리·구멍을 옮겨 깎음
function extrudeTris(outer, holes, h, tri2d = TRI2D) {
  if (FIT.outer || FIT.hole) { const o0 = outer; outer = fitOffset(outer, FIT.outer);
    // 구멍은 테두리와 다른 구멍에서 0.4 mm 넘게 떨어져 있도록 키우는 양을 줄임
    if (FIT.hole) holes = holes.map((H, i) => { if (!H || H.length < 3) return H; const room = Math.min(polyGap(H, outer), ...holes.filter((G, j) => j !== i && G && G.length > 2).map(G => polyGap(H, G) / 2)) - 0.4;
      const h = FIT.hole > 0 ? Math.min(FIT.hole, Math.max(0, room)) : FIT.hole; return h ? fitOffset(H, -h) : H; });
    if (!outer) outer = o0; }
  const area = p => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
  if (area(outer) < 0) outer = outer.slice().reverse();
  holes = holes.map(H => area(H) > 0 ? H.slice().reverse() : H);
  const faces = tri2d(outer, holes);         // 인덱스 삼각형 (평면 점 배열 기준)
  const flat = outer.concat(...holes), tris = [];
  for (const [a, b, c] of faces) {
    const A = flat[a], B = flat[b], C = flat[c];
    const cw = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]) < 0;
    const [P1, P2, P3] = cw ? [A, C, B] : [A, B, C];
    tris.push([P1[0], P1[1], h, P2[0], P2[1], h, P3[0], P3[1], h]);          // 윗면 (+z)
    tris.push([P1[0], P1[1], 0, P3[0], P3[1], 0, P2[0], P2[1], 0]);          // 아랫면 (-z)
  }
  const wall = (loop) => {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length];
      tris.push([a[0], a[1], 0, b[0], b[1], 0, b[0], b[1], h]);
      tris.push([a[0], a[1], 0, b[0], b[1], h, a[0], a[1], h]);
    }
  };
  wall(outer); holes.forEach(wall);
  return tris;
}
// 기어 압출: 헬리컬은 높이에 따라 비틀고(θ = z·tanβ / r), 헤링본은 가운데에서 되돌아옴
const overlapTxt = g => g.helix ? ` + 겹침 물림률 <em>${(g.b * Math.sin(Math.abs(g.helix) * D2R) / (PI * g.m) / (g.herring ? 2 : 1)).toFixed(2)}</em>` : '';
const spiralTxt = g => { if (!g.spiral) return ''; const B = bevelInfo(g); return ` + 겹침 물림률 <em>${(g.F * Math.tan(Math.abs(g.spiral) * D2R) / (PI * g.m * (1 - g.F / (2 * B.A)))).toFixed(2)}</em> (스파이럴 ${fmt(Math.abs(g.spiral), 1)}°)`; };
const gearKindKo = g => !g.helix ? '평기어' : `${g.herring ? '헤링본' : '헬리컬'} β${g.helix > 0 ? '+' : '−'}${fmt(Math.abs(g.helix), 1)}°`;
function gearTwist(g) {
  if (g._twist) return g._twist;
  if (!g.helix) return null;
  const r = gearOutlineInfo(g).r, k = Math.tan(g.helix * D2R) / r, b = g.b;
  return g.herring ? z => k * (b / 2 - Math.abs(z - b / 2)) : z => k * z;
}
function gearExtrude(g, holes, tri2d = TRI2D) {
  const outer = g._outline || gearOutline(g).pts, th = gearTwist(g);
  if (!th) return extrudeTris(outer, holes, g.b, tri2d);
  const b = g.b, tot = Math.abs(th(g.herring ? b / 2 : b)) / D2R;
  const n = Math.max(4, Math.ceil(tot / (g._step || 1.5))) * (g.herring ? 2 : 1);
  const rot = (loop, z) => { const t = th(z), c = Math.cos(t), s2 = Math.sin(t); return loop.map(([x, y]) => [x * c - y * s2, x * s2 + y * c, z]); };
  const O = ccw(outer), Hs = holes.map(cw), tris = [];
  const cap = (z, up) => { const t = th(z), c = Math.cos(t), s2 = Math.sin(t), R = l => l.map(([x, y]) => [x * c - y * s2, x * s2 + y * c]);
    return capTris(R(O), Hs.map(R), z, up); };
  tris.push(...cap(0, false), ...cap(b, true));
  for (let i = 0; i < n; i++) {
    const z0 = b * i / n, z1 = b * (i + 1) / n;
    tris.push(...loftWall(rot(O, z0), rot(O, z1)));
    Hs.forEach(H => tris.push(...loftWall(rot(H, z0), rot(H, z1))));
  }
  return tris;
}
function moveTris(tris, dx, dy, dz, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return tris.map(t => { const o = new Array(9); for (let k = 0; k < 9; k += 3) { o[k] = t[k] * c - t[k + 1] * s + dx; o[k + 1] = t[k] * s + t[k + 1] * c + dy; o[k + 2] = t[k + 2] + dz; } return o; });
}
const circlePts = (r, n = 48, cx = 0, cy = 0) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(2 * PI * i / n), cy + r * Math.sin(2 * PI * i / n)]);

// 부품 하나의 삼각형 (부품 좌표: 축 중심 원점, 바닥 z=0). phases: 기어별 회전
function partTris(D, part, phases, tri2d = TRI2D) {
  const s = D.shafts[part.shaft], bo = boreOf(s), bore = borePts(bo.d, bo.dcut, 40, bo.dd);
  let tris = [];
  for (const gi of part.gears) {
    const g = D.gears[gi], ph = phases ? phases[gi] : 0;
    const t = gearExtrude(g, bore ? [bore] : [], tri2d);
    tris = tris.concat(moveTris(t, 0, 0, g.zpos - part.z0, ph));
  }
  for (const hb of part.hubs) { const hbo = hb.bore ? borePts(hb.bore.d, hb.bore.dcut, 40, hb.bore.dd) : bore;
    tris = tris.concat(moveTris(extrudeTris(circlePts(hb.r, 64), hbo ? [hbo] : [], hb.h, tri2d), 0, 0, hb.z)); }
  return tris;
}

function pinTris(D, s, tri2d = TRI2D, extra = 0) {
  const len = D.box.D + (s.fixed ? 12 : 0) + extra;   // 입력·출력 축은 기어의 D컷에 맞춰 평면을 깎은 D축
  return extrudeTris(s.fixed && !s.jBore ? borePts(s.d - 0.05, 0.55, 40) : circlePts(s.d / 2 - 0.05, 32), [], len, tri2d);
}

function scadSource(D, kin, parts, hs) {
  const L = [];
  L.push('// 기어 설계실에서 생성한 파라메트릭 OpenSCAD 소스 (OpenSCAD 2021.01 이상)');
  L.push('// GEARS 표의 숫자를 바꾸고 F6 렌더 → File > Export > STL');
  L.push('// mode: "assembly" 조립 상태 | "plate" 출력판 배치 | "part" 부품 하나(part_index)' + (D.box ? ' | "housing_body" | "housing_lid"' : ''));
  L.push('mode = "plate";');
  L.push('part_index = 0;');
  L.push('res = 10;   // 치형 곡선 분할 수');
  L.push('');
  L.push('// [부품번호, 모듈 m, 잇수 z, 압력각(°), 전위계수 x, 이폭 b, 백래시, 부품 안 높이 z, 위상(°), 나선각 β(°), 헤링본 0|1]');
  L.push('GEARS = [');
  parts.forEach((p, pi) => p.gears.forEach(gi => { const g = D.gears[gi];
    L.push(`  [${pi}, ${g.m}, ${g.z}, ${g.pa}, ${g.x}, ${g.b}, ${g.backlash}, ${+(g.zpos - p.z0).toFixed(3)}, ${+(kin.phase[gi] * 180 / PI).toFixed(3)}, ${g.helix || 0}, ${g.herring ? 1 : 0}],   // ${g.name}`); }));
  L.push('];');
  L.push('// [축 X, 축 Y, 바닥 Z, 구멍 지름, D컷 깊이, 양쪽 D컷 0|1]');
  L.push('PARTS = [');
  parts.forEach(p => { const s = D.shafts[p.shaft], bo = boreOf(s); L.push(`  [${s.x}, ${s.y}, ${+p.z0.toFixed(3)}, ${+bo.d.toFixed(3)}, ${bo.dcut}, ${bo.dd ? 1 : 0}],   // ${p.name} (${roleKo(s.role)})`); });
  L.push('];');
  L.push('// [부품번호, 시작 z, 높이, 반지름] 같은 축 기어 사이를 잇는 허브');
  L.push('HUBS = [   // [부품번호, 시작 z, 높이, 반지름, 구멍 지름(-1 = 부품 구멍), D컷, 양쪽D]');
  parts.forEach((p, pi) => p.hubs.forEach(h => L.push(`  [${pi}, ${+h.z.toFixed(3)}, ${+h.h.toFixed(3)}, ${+h.r.toFixed(3)}, ${h.bore ? h.bore.d : -1}, ${h.bore ? h.bore.dcut : 0}, ${h.bore && h.bore.dd ? 1 : 0}],`)));
  L.push('];');
  if (D.box) {
    L.push(`BOX = [${D.box.W}, ${D.box.H}, ${D.box.D}, ${D.box.wall}];   // ${shapeOf(D.box) === 'cyl' ? '지름, 지름' : '가로, 세로'}, 높이, 벽`);
    L.push('SHAFTS = [');
    D.shafts.forEach(s => L.push(`  [${s.x}, ${s.y}, ${s.d}, ${s.fixed ? 1 : 0}],   // ${roleKo(s.role)}`));
    L.push('];');
  }
  L.push('// 멈춤나사 블록 [부품번호, z, 반폭, 높이, 회전(°)]: M3 무두볼트가 축의 D컷 평면을 누름');
  L.push(`SETSCREW = [${(hs && hs.set || []).map(k => `[${k.part}, ${k.z}, ${k.a}, ${k.hh}, ${k.ph}]`).join(', ')}];`);
  L.push(`
${SCAD_LIB}
module setscrew_block(d, dcut, a, hh) difference() {
  translate([-a, -a, 0]) cube([2*a, 2*a, hh]);
  translate([0, 0, -1]) linear_extrude(hh + 2) bore2d(d, dcut);
  translate([0, 0, hh/2]) rotate([0, 90, 0]) cylinder(r = 1.25, h = a + 1, $fn = 20);
}
module part(i) {
  P = PARTS[i];
  for (g = GEARS) if (g[0] == i) translate([0, 0, g[7]]) rotate(g[8]) spur_gear(g[1], g[2], g[3], g[4], g[5], g[6], P[3], P[4], g[9], g[10], P[5]);
  for (h = HUBS) if (h[0] == i) translate([0, 0, h[1]]) linear_extrude(h[2]) difference() { circle(r = h[3], $fn = 64); if (h[4] > 0) bore2d(h[4], h[5], h[6]); else bore2d(P[3], P[4], P[5]); }
  for (k = SETSCREW) if (k[0] == i) translate([0, 0, k[1]]) rotate(k[4]) setscrew_block(P[3], P[4], k[2], k[3]);
}
function part_r(i) = max([ for (g = GEARS) if (g[0] == i) g[1]*(g[2]/2 + 1 + g[4]) ]);
`);
  if (D.box) {
    const H = f => '[' + hs.holes.filter(h => h.face === f && !h.pts).map(h => `[${h.u}, ${h.v}, ${h.d}]`).join(', ') + ']';
    const PH = '[' + hs.holes.filter(h => h.face === 'floor' && h.pts).map(h => '[' + h.pts.map(q => `[${q[0]}, ${q[1]}]`).join(', ') + ']').join(', ') + ']';
    const B = f => '[' + hs.boss.filter(b => b.face === f).map(b => `[${b.x}, ${b.y}, ${+b.ro.toFixed(3)}, ${+b.h.toFixed(3)}]`).join(', ') + ']';
    L.push(`// 바닥·덮개 구멍 [X, Y, 지름]${hs.motor ? ` (바닥: 축 구멍 + ${hs.motor.name} 앞 돌출부·고정 나사)` : ''}, 베어링 받침 [X, Y, 바깥 반지름, 높이]
FLOOR_HOLES = ${H('floor')};
FLOOR_POLYS = ${PH};   // 서보 몸통 구멍 등 다각형 구멍
POST_R = ${hs.fasten ? 4.5 : 3.5}; POST_HOLE = ${hs.fasten ? 4.0 : 2.6};   // ${hs.fasten ? '인서트 너트' : '셀프 태핑'}
LID_HOLES = ${H('lid')};
FLOOR_BOSS = ${B('floor')};
LID_BOSS = ${B('lid')};
POSTS = [${hs.fix ? hs.fix.posts.map(p => `[${p[0]}, ${p[1]}]`).join(', ') : ''}];   // 덮개 나사 기둥 (M3 셀프 태핑 구멍 2.6)
EARS = [${hs.fix ? hs.fix.ears.map(e => `[${e.v[0]}, ${e.v[1]}, ${e.c[0]}, ${e.c[1]}]`).join(', ') : ''}];   // 설치 귀 [꼭짓점 X, Y, 구멍 X, Y] (M4)
LEG_H = ${hs.fix ? hs.fix.legH : 0};   // 받침 다리 높이 (0 = 없음)
${scadShell(D.box)}
module housing_body() {
  difference() {
    union() {
      housing_shell();
      for (b = FLOOR_BOSS) translate([b[0], b[1], -b[3]]) cylinder(r = b[2], h = b[3] + 0.01, $fn = 48);
      for (p = POSTS) translate([p[0], p[1], BOX[3] - 0.01]) cylinder(r = POST_R, h = BOX[2] - 2*BOX[3] + 0.01, $fn = 32);
      for (e = EARS) linear_extrude(BOX[3]) hull() { translate([e[0], e[1]]) circle(r = 5.5, $fn = 24); translate([e[2], e[3]]) circle(r = 5.5, $fn = 24); }
    }
    for (h = FLOOR_HOLES) translate([h[0], h[1], -20]) cylinder(d = h[2], h = BOX[3] + 20.5, $fn = 32);
    for (p = POSTS) translate([p[0], p[1], BOX[3]]) cylinder(d = POST_HOLE, h = BOX[2], $fn = 20);
    for (q = FLOOR_POLYS) translate([0, 0, -1]) linear_extrude(BOX[3] + 2) polygon(q);
    for (e = EARS) translate([e[2], e[3], -1]) cylinder(d = 4.5, h = BOX[3] + 2, $fn = 24);
  }
}
module leg() difference() { cylinder(r = 5, h = LEG_H, $fn = 32); translate([0, 0, -1]) cylinder(r = 2.3, h = LEG_H + 2, $fn = 24); }
module housing_lid() {
  difference() {
    union() { housing_plate(); for (b = LID_BOSS) translate([b[0], b[1], BOX[3] - 0.01]) cylinder(r = b[2], h = b[3] + 0.01, $fn = 48); }
    for (h = LID_HOLES) translate([h[0], h[1], -1]) cylinder(d = h[2], h = BOX[3] + 40, $fn = 32);
  }
}
`);
    if (hs.motor && hs.motor.acc && hs.motor.acc.length) {
      L.push('// 모터 연결 부품 (앱이 만든 형상 그대로): ' + hs.motor.acc.map((q, k) => `${k} = ${q.name}`).join(', '));
      hs.motor.acc.forEach((q, k) => L.push(scadMesh('acc_' + k, q.tris)));
      L.push('module accessory(k) {' + hs.motor.acc.map((q, k) => ` if (k == ${k}) acc_${k}();`).join('') + ' }');
    }
    if (hs.hub) L.push(`// 출력 허브: D컷 구멍 + M3 구멍 4개 플랜지
HUB_D = ${hs.hub.d};
module output_hub() {
  d = HUB_D; rh = d/2 + 4.5; rf = d/2 + 13; R = d/2 + 9;
  difference() { cylinder(r = rh, h = 9, $fn = 48); translate([0, 0, -1]) linear_extrude(11) bore2d(d + 0.1, 0.5); }
  translate([0, 0, 6]) difference() { cylinder(r = rf, h = 3, $fn = 64); translate([0, 0, -1]) cylinder(r = rh - 1, h = 5, $fn = 40);
    for (k = [0:3]) rotate(45 + 90*k) translate([R, 0, -1]) cylinder(r = 1.7, h = 5, $fn = 20); }
}
`);
    if (hs.crank) L.push(`// 손 크랭크: 허브(D컷) + 팔 + 손잡이
CRANK = [${hs.crank.d}, ${hs.crank.arm}];   // 축 지름, 팔 길이
module crank() {
  d = CRANK[0]; A = CRANK[1]; rh = d/2 + 4;
  difference() { cylinder(r = rh, h = 10, $fn = 48); translate([0, 0, -1]) linear_extrude(12) bore2d(d + 0.15, 0.5); }
  translate([0, 0, 5]) linear_extrude(5) hull() { translate([(d + 0.15)/2 + 6, 0]) circle(r = 5, $fn = 32); translate([A, 0]) circle(r = 5, $fn = 32); }
  translate([A, 0, 9.99]) cylinder(r = 4.5, h = 22, $fn = 32);
}
`);
  }
  L.push(`if (mode == "assembly") {
  for (i = [0:len(PARTS)-1]) translate([PARTS[i][0], PARTS[i][1], PARTS[i][2]]) part(i);${D.box ? `
  %housing_body();
  %translate([0, 0, BOX[2] - BOX[3]]) housing_lid();` : ''}
} else if (mode == "part") {
  part(part_index);${D.box ? `
} else if (mode == "housing_body") {
  housing_body();
} else if (mode == "housing_lid") {
  housing_lid();` : ''}${hs && hs.crank ? `
} else if (mode == "crank") {
  crank();` : ''}${hs && hs.motor && hs.motor.acc && hs.motor.acc.length ? `
} else if (mode == "accessory") {
  accessory(part_index);` : ''}${hs && hs.hub ? `
} else if (mode == "output_hub") {
  output_hub();` : ''}${hs && hs.fix && hs.fix.legH ? `
} else if (mode == "leg") {
  leg();` : ''}
} else {
  // 간단한 한 줄 배치
  for (i = [0:len(PARTS)-1]) translate([ (i == 0 ? 0 : sum_r(i)) , 0, 0]) part(i);
}
function sum_r(i) = i == 0 ? 0 : sum_r(i-1) + part_r(i-1) + part_r(i) + 4;
`);
  return L.join('\n');
}
// 삼각형 묶음 → OpenSCAD polyhedron (점 공유, 면은 바깥에서 볼 때 시계 방향)
function scadMesh(name, tris) {
  const idx = new Map(), pts = [], faces = [];
  const id = (x, y, z) => { const k = x.toFixed(3) + ',' + y.toFixed(3) + ',' + z.toFixed(3); let i = idx.get(k); if (i === undefined) { i = pts.length; idx.set(k, i); pts.push(k); } return i; };
  for (const t of tris) { const a = id(t[0], t[1], t[2]), b = id(t[3], t[4], t[5]), c = id(t[6], t[7], t[8]); if (a !== b && b !== c && a !== c) faces.push(`[${a},${c},${b}]`); }
  return `module ${name}() polyhedron(points = [${pts.map(p => '[' + p + ']').join(',')}], faces = [${faces.join(',')}], convexity = 6);`;
}
function roleKo(r) { return { input: '입력축', output: '출력축', idler: '아이들러', mid: '중간축', main: '축' }[r] || r; }
