/* ================= 자동 설계 ================= */
const MODULES = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6, 8];

function stageCombos(R, n, P) {
  if (R === 1) {
    const out = [];
    for (let z = Math.max(P.zmin, 17); z <= 60; z++) out.push({ st: [[z, z]], err: 0, size: 2 * z });
    for (let z = P.zmin; z < 17; z++) out.push({ st: [[z, z]], err: 0, size: 200 + z });
    return out;
  }
  const rs = Math.pow(R, 1 / n), pairs = [];
  for (let zp = P.zmin; zp <= P.zmin + 18; zp++) {
    const zc = Math.round(zp * rs);
    for (let zg = zc - 1; zg <= zc + 1; zg++) if (zg >= P.zmin && zg > zp) pairs.push([zp, zg]);
  }
  const out = [], seen = new Set();
  const rmin = Math.min(...pairs.map(q => q[1] / q[0])), rmax = Math.max(...pairs.map(q => q[1] / q[0]));
  const rec = (k, from, acc, ratio) => {
    if (k === n) {
      const err = Math.abs(ratio - R) / R;
      if (err <= P.tol) {
        const key = acc.map(p => p.join('/')).join('|');
        if (!seen.has(key)) { seen.add(key); out.push({ st: acc.slice(), err, size: acc.reduce((s, p) => s + p[0] + p[1], 0) + Math.max(...acc.map(p => p[1])) }); }
      }
      return;
    }
    const rem = n - k - 1;
    for (let pi = from; pi < pairs.length; pi++) {
      const p = pairs[pi], r2 = ratio * p[1] / p[0];
      if (r2 * Math.pow(rmin, rem) > R * (1 + P.tol) || r2 * Math.pow(rmax, rem) < R * (1 - P.tol)) continue;
      acc.push(p); rec(k + 1, pi, acc, r2); acc.pop();
    }
  };
  rec(0, 0, [], 1);
  out.sort((a, b) => (a.size + a.err * 400) - (b.size + b.err * 400));
  return out;
}

function buildChain(combo, m, b, needIdler, P) {
  const shafts = [{ role: 'main', d: P.shaftD }], gears = [], meshes = [], edges = [];
  const n = combo.length, L = n;
  const zOf = l => P.wall + P.endGap + l * (b + P.gap);
  let cur = 0;
  for (let s = 0; s < n; s++) {
    const [zp, zg] = combo[s], layer = s;   // 단마다 한 층씩 쌓음
    const hx = +P.helix || 0;   // 맞물리는 기어는 반대 방향 나선 (축 번호 홀짝)
    const mk = (z, shaft) => ({ name: '', shaft, m, z, pa: P.pa, x: autoShift(z), b, backlash: P.backlash, zpos: zOf(layer), layer, helix: shaft % 2 ? -hx : hx, herring: !!(hx && P.herring) });
    const gp = gears.push(mk(zp, cur)) - 1;
    if (needIdler && s === n - 1) {
      const zi = Math.max(zp, Math.min(17, zg));
      const si = shafts.push({ role: 'idler', d: P.shaftD }) - 1;
      const gi = gears.push(mk(zi, si)) - 1;
      const so = shafts.push({ role: 'main', d: P.shaftD }) - 1;
      const gg = gears.push(mk(zg, so)) - 1;
      meshes.push([gp, gi], [gi, gg]);
      edges.push({ p: cur, c: si, cd: meshGeom(gears[gp], gears[gi]).cd }, { p: si, c: so, cd: meshGeom(gears[gi], gears[gg]).cd });
      cur = so;
    } else {
      const so = shafts.push({ role: 'main', d: P.shaftD }) - 1;
      const gg = gears.push(mk(zg, so)) - 1;
      meshes.push([gp, gg]);
      edges.push({ p: cur, c: so, cd: meshGeom(gears[gp], gears[gg]).cd });
      cur = so;
    }
  }
  return { shafts, gears, meshes, edges, first: 0, last: cur, layers: L };
}

function boxOfP(P) { const b = { W: P.W, H: P.H, D: P.D, wall: P.wall }; if (P.shape && P.shape !== 'rect') { b.shape = P.shape; if (P.shape === 'poly') b.pts = P.pts; } return b; }
// 모양이 사각이 아니거나 축 위치가 고정되면: 상자 좌표에서 직접 배치를 찾음
// 고정된 끝 축은 그 자리에 두고, 마지막 축이 고정이면 끝에서 두 번째 축을 두 원의 교점으로 정해 정확히 닿게 함
function layoutAbs(C, P) {
  const box = P._box || boxOfP(P), G = shapeGeo(box);
  const ra = C.gears.map(g => gearOutlineInfo(g).ra), rodR = P.shaftD / 2;
  for (const g of C.gears) if (gearDims(g).rf - (P.shaftD + 0.35) / 2 < 1.2) return null;
  if (Math.max(...ra) + P.clear > G.rIn - P.wall + 1e-6) return null;
  const swap = P.func === 'increase', fixF = swap ? P.fixOut : P.fixIn, fixL = swap ? P.fixIn : P.fixOut;
  const meshSet = new Set(C.meshes.map(([i, j]) => i + ',' + j).concat(C.meshes.map(([i, j]) => j + ',' + i)));
  const pos = new Array(C.shafts.length).fill(null);
  const gearsOn = C.shafts.map((_, s) => C.gears.map((g, i) => i).filter(i => C.gears[i].shaft === s));
  const meshesWith = (i, t) => gearsOn[t].some(j => meshSet.has(i + ',' + j));
  const fits = s => gearsOn[s].every(i => fitsIn(box, pos[s][0], pos[s][1], ra[i] + P.clear)) && fitsIn(box, pos[s][0], pos[s][1], rodR + 1);
  const ok = s => {
    const [x, y] = pos[s];
    for (let t = 0; t < C.shafts.length; t++) {
      if (t === s || !pos[t]) continue;
      const dd = Math.hypot(pos[t][0] - x, pos[t][1] - y);
      for (const i of gearsOn[s]) {
        if (!meshesWith(i, t) && dd < ra[i] + rodR + P.clear) return false;
        for (const j of gearsOn[t]) { if (meshSet.has(i + ',' + j)) continue; if (C.gears[i].layer === C.gears[j].layer && dd < ra[i] + ra[j] + P.clear) return false; }
      }
      for (const j of gearsOn[t]) if (!meshesWith(j, s) && dd < ra[j] + rodR + P.clear) return false;
    }
    return true;
  };
  const E = C.edges, nE = E.length, ANG = []; for (let d = 0; d < 360; d += 15) ANG.push(d * D2R);
  const circX = (p, r1, q, r2) => {
    const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy);
    if (d < 1e-9 || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a)), mx = p[0] + a * dx / d, my = p[1] + a * dy / d;
    return [[mx - h * dy / d, my + h * dx / d], [mx + h * dy / d, my - h * dx / d]];
  };
  let nodes = 0, budget = 0;
  const place = (s, q, next) => { pos[s] = q; if (fits(s) && ok(s) && next()) return true; pos[s] = null; return false; };
  const rec = e => {
    if (e === nE) return true;
    if (++nodes > budget) return false;
    const { p, c, cd } = E[e];
    if (fixL && e === nE - 1) return Math.abs(Math.hypot(pos[p][0] - fixL[0], pos[p][1] - fixL[1]) - cd) < 0.01 && place(c, fixL.slice(), () => rec(e + 1));
    if (fixL && e === nE - 2) { for (const q of circX(pos[p], cd, fixL, E[e + 1].cd)) if (place(c, q, () => rec(e + 1))) return true; return false; }
    for (const a of ANG) if (place(c, [pos[p][0] + cd * Math.cos(a), pos[p][1] + cd * Math.sin(a)], () => rec(e + 1))) return true;
    return false;
  };
  // 첫 축 후보
  let starts;
  if (fixF) starts = [fixF.slice()];
  else if (fixL && nE === 1) starts = ANG.map(a => [fixL[0] + E[0].cd * Math.cos(a), fixL[1] + E[0].cd * Math.sin(a)]);
  else {
    starts = [];
    const xs = G.O.map(q => q[0]), ys = G.O.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const st = Math.max(1, Math.max(x1 - x0, y1 - y0) / 14);
    for (let x = x0 + st / 2; x < x1; x += st) for (let y = y0 + st / 2; y < y1; y += st) {
      pos[0] = [x, y]; if (fits(0)) starts.push([x, y]); pos[0] = null;
    }
    const [cx, cy] = G.cIn;   // 벽 가까운 곳부터 (기어열이 안쪽으로 뻗을 자리가 남도록)
    starts.sort((a, b) => Math.hypot(b[0] - cx, b[1] - cy) - Math.hypot(a[0] - cx, a[1] - cy));
    if (starts.length > 36) { const k = starts.length / 36; starts = Array.from({ length: 36 }, (_, i) => starts[Math.floor(i * k)]); }
  }
  for (const q of starts) {
    budget = nodes + 1500;
    pos.fill(null);
    if (place(0, q, () => rec(0))) return pos.map(([x, y]) => [x, y]);
    if (nodes > 40000) break;
  }
  return null;
}
function layoutChain(C, P) {
  if ((P.shape && P.shape !== 'rect') || P.fixIn || P.fixOut) return layoutAbs(C, P);
  const Wi = P.W - 2 * P.wall - 2 * P.clear, Hi = P.H - 2 * P.wall - 2 * P.clear;
  const ra = C.gears.map(g => gearOutlineInfo(g).ra);
  // 축 구멍이 이뿌리 안쪽에 들어가는지
  for (const g of C.gears) if (gearDims(g).rf - (P.shaftD + 0.35) / 2 < 1.2) return null;
  const meshSet = new Set(C.meshes.map(([i, j]) => i + ',' + j).concat(C.meshes.map(([i, j]) => j + ',' + i)));
  const pos = new Array(C.shafts.length).fill(null);
  pos[0] = [0, 0];
  const gearsOn = s => C.gears.map((g, i) => i).filter(i => C.gears[i].shaft === s);
  const rodR = P.shaftD / 2;
  const meshesWith = (i, t) => gearsOn(t).some(j => meshSet.has(i + ',' + j));
  const ok = (s) => {
    const [x, y] = pos[s];
    for (let t = 0; t < C.shafts.length; t++) {
      if (t === s || !pos[t]) continue;
      const dd = Math.hypot(pos[t][0] - x, pos[t][1] - y);
      for (const i of gearsOn(s)) {
        if (!meshesWith(i, t) && dd < ra[i] + rodR + P.clear) return false;      // 내 기어 vs 남의 축
        for (const j of gearsOn(t)) {
          if (meshSet.has(i + ',' + j)) continue;
          if (C.gears[i].layer === C.gears[j].layer && dd < ra[i] + ra[j] + P.clear) return false;
        }
      }
      for (const j of gearsOn(t)) if (!meshesWith(j, s) && dd < ra[j] + rodR + P.clear) return false;   // 남의 기어 vs 내 축
    }
    return true;
  };
  const bbox = () => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    C.gears.forEach((g, i) => { const p = pos[g.shaft]; if (!p) return; x0 = Math.min(x0, p[0] - ra[i]); x1 = Math.max(x1, p[0] + ra[i]); y0 = Math.min(y0, p[1] - ra[i]); y1 = Math.max(y1, p[1] + ra[i]); });
    return { x0, y0, x1, y1 };
  };
  { const b = bbox(); if (b.x1 - b.x0 > Wi || b.y1 - b.y0 > Hi) return null; }
  const ANG = []; for (let d = 0; d < 360; d += 15) ANG.push(d * D2R);
  let nodes = 0;
  const rec = e => {
    if (e === C.edges.length) return true;
    if (++nodes > 40000) return false;
    const { p, c, cd } = C.edges[e];
    const angs = e === 0 ? ANG.filter(a => a <= PI / 2 + 1e-9) : ANG;
    for (const a of angs) {
      pos[c] = [pos[p][0] + cd * Math.cos(a), pos[p][1] + cd * Math.sin(a)];
      const b = bbox();
      if (b.x1 - b.x0 <= Wi && b.y1 - b.y0 <= Hi && ok(c) && rec(e + 1)) return true;
      pos[c] = null;
    }
    return false;
  };
  if (!rec(0)) return null;
  const b = bbox(), ox = P.W / 2 - (b.x0 + b.x1) / 2, oy = P.H / 2 - (b.y0 + b.y1) / 2;
  return pos.map(([x, y]) => [x + ox, y + oy]);
}

function autoDesign(P) {
  const R = (P.func === 'reduce' || P.func === 'increase') ? Math.max(1, P.ratio) : 1;
  let dir = P.dir; if (P.func === 'reverse') dir = 'opposite';
  const mods = MODULES.filter(m => m >= P.minM - 1e-9).reverse();
  const results = [];
  const maxN = R === 1 ? 1 : P.maxStages;
  for (let n = 1; n <= maxN; n++) {
    const combos = stageCombos(R, n, P).slice(0, 14);
    if (!combos.length) continue;
    const needIdler = dir === 'same' ? n % 2 === 1 : dir === 'opposite' ? n % 2 === 0 : false;
    const L = n;
    const avail = P.D - 2 * P.wall - 2 * P.endGap - (L - 1) * P.gap;
    let found = null;
    for (const m of mods) {
      const b = +Math.min(avail / L, 10 * m).toFixed(2);
      if (b < 3) continue;
      for (const cb of combos) {
        const C = buildChain(cb.st, m, b, needIdler, P);
        const pos = layoutChain(C, P);
        if (pos) { found = { C, pos, m, b, n, err: cb.err, combo: cb.st, needIdler }; break; }
      }
      if (found) break;
    }
    if (found) results.push(found);
  }
  // 굽힘 강도는 대략 모듈×이폭에 비례 → 강도 점수가 높고 단수가 적은 설계를 추천
  const score = r => r.m * r.b * (1 - 0.08 * (r.n - 1)) * (r.needIdler ? 0.95 : 1);
  results.sort((a, b) => score(b) - score(a) || a.err - b.err);
  return results.map(r => chainToDesign(r, P));
}

function chainToDesign(r, P) {
  const { C, pos } = r;
  const swap = P.func === 'increase';
  const input = swap ? C.last : C.first, output = swap ? C.first : C.last;
  const shafts = C.shafts.map((s, i) => ({ x: +pos[i][0].toFixed(3), y: +pos[i][1].toFixed(3), d: P.shaftD,
    role: i === input ? 'input' : i === output ? 'output' : s.role === 'idler' ? 'idler' : 'mid', fixed: i === input || i === output }));
  const gears = C.gears.map(g => ({ ...g }));
  // 이름: 축 번호 순
  const order = [...shafts.keys()];
  gears.forEach(g => { g.name = ''; });
  let k = 1; order.forEach(s => gears.forEach(g => { if (g.shaft === s) g.name = 'G' + (k++); }));
  return {
    version: 1, kind: 'gearbox',
    box: P._box || boxOfP(P),
    rpm: P.rpm, shafts, gears, meshes: C.meshes, input, output,
    target: { func: P.func, ratio: P.func === 'increase' ? 1 / P.ratio : (P.func === 'reduce' ? P.ratio : 1), dir: P.func === 'reverse' ? 'opposite' : P.dir, tol: P.tol * 100 },
    settings: { clear: P.clear },
    summary: { m: r.m, b: r.b, n: r.n, idler: r.needIdler }
  };
}

function pairDesign(Q) {
  const hx = +Q.helix || 0, hb = !!(hx && Q.herring);
  const g1 = { name: 'G1', shaft: 0, m: Q.m, z: Q.z1, pa: Q.pa, x: Q.autoX ? autoShift(Q.z1) : Q.x1, b: Q.b, backlash: Q.bl, zpos: 0, layer: 0, helix: hx, herring: hb };
  const shafts = [{ x: 0, y: 0, d: Q.bore1, role: 'input', fixed: Q.d1, boreOverride: true }];
  const gears = [g1], meshes = [];
  if (Q.on2) {
    const g2 = { name: 'G2', shaft: 1, m: Q.m, z: Q.z2, pa: Q.pa, x: Q.autoX ? autoShift(Q.z2) : Q.x2, b: Q.b, backlash: Q.bl, zpos: 0, layer: 0, helix: -hx, herring: hb };
    const cd = meshGeom(g1, g2).cd;
    shafts.push({ x: +cd.toFixed(4), y: 0, d: Q.bore2, role: 'output', fixed: Q.d2, boreOverride: true });
    gears.push(g2); meshes.push([0, 1]);
  }
  return { version: 1, kind: 'pair', box: null, rpm: Q.rpm, shafts, gears, meshes, input: 0, output: Q.on2 ? 1 : 0,
    target: null, settings: { clear: 1 }, summary: {} };
}
// 직접 설계는 입력한 구멍 지름을 그대로 사용
function boreOf(s) { if (s.mBore) return s.mBore; if (s.jBore) return s.jBore; if (s.supBore) return s.supBore; return s.boreOverride ? { d: s.d, dcut: s.fixed ? 0.5 : 0 } : shaftBore(s); }
