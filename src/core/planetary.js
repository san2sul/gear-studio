/* ================= 유성기어 ================= */
// 캐리어: 판(지역 z=plateZ부터) + 위로 출력 보스. 유성 핀은 판의 구멍에 끼우는 별도 부품
function carrierTris(C) {
  const { a, N, pinR, plateZ, tc, Rc, bossR, bossTop, bore, dcut } = C;
  const tris = [], holes = [];
  for (let i = 0; i < N; i++) holes.push(circlePts(pinR, 28, a * Math.cos(2 * PI * i / N), a * Math.sin(2 * PI * i / N)));
  const disk = circlePts(Rc, 96), boss = circlePts(bossR, 48), bp = borePts(bore, dcut);
  tris.push(...capTris(disk, holes.concat(bp ? [bp] : []), plateZ, false), ...loftWall(at(disk, plateZ), at(disk, plateZ + tc)));
  tris.push(...capTris(disk, [boss].concat(holes), plateZ + tc, true), ...loftWall(at(boss, plateZ + tc), at(boss, bossTop)), ...capTris(boss, bp ? [bp] : [], bossTop, true));
  for (const h of holes) { const c = cw(h); tris.push(...loftWall(at(c, plateZ), at(c, plateZ + tc))); }
  if (bp) { const c = cw(bp); tris.push(...loftWall(at(c, plateZ), at(c, bossTop))); }
  return tris;
}

function planetaryGeom(d) {
  const zr = d.zs + 2 * d.zp;
  const sun = { name: 'S', m: d.m, z: d.zs, pa: d.pa, x: 0, b: d.b, backlash: d.backlash };
  const planet = { name: 'P', m: d.m, z: d.zp, pa: d.pa, x: 0, b: d.b, backlash: d.backlash };
  const ring = { name: 'R', m: d.m, z: zr, pa: d.pa, x: 0, b: d.b, backlash: d.backlash, internal: true };
  const a = d.m * (d.zs + d.zp) / 2;
  return { zr, sun, planet, ring, a, ratio: 1 + zr / d.zs };
}
function internalEps(planet, ring, a) {
  const al = planet.pa * D2R, ip = gearOutlineInfo(planet), rr = ring.m * ring.z / 2, rbr = rr * Math.cos(al);
  const rTip = Math.max(rr - ring.m, rbr);
  return (Math.sqrt(ip.ra ** 2 - ip.rb ** 2) - Math.sqrt(rTip ** 2 - rbr ** 2) + a * Math.sin(al)) / (PI * planet.m * Math.cos(al));
}

/* ================= 모델: 설계 → 부품·움직임·검사 =================
 model = { parts:[{name,file,tris,motion(t)->XF,print?:XF}], housing:[{name,file,tris}], rods:[{a,b,d,role}],
           hud:[[k,v]], checks:[{st,txt}], table:{head,rows}, interference:()=>[...]|null, scad:()=>string, notes:[...] } */