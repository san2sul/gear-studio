/* ================= 부품(같은 축의 기어는 한 덩어리) ================= */
function partsOf(D) {
  const parts = [];
  D.shafts.forEach((s, si) => {
    const gi = D.gears.map((g, i) => i).filter(i => D.gears[i].shaft === si).sort((a, b) => D.gears[a].zpos - D.gears[b].zpos);
    if (!gi.length) return;
    const z0 = D.gears[gi[0]].zpos;
    const hubs = [];
    for (let k = 0; k + 1 < gi.length; k++) {
      const A = D.gears[gi[k]], B = D.gears[gi[k + 1]];
      const za = A.zpos + A.b, zb = B.zpos;
      if (zb > za + 1e-6) hubs.push({ z: za - z0, h: zb - za, r: Math.min(gearDims(A).rf, gearDims(B).rf) - 0.4 });
    }
    parts.push({ shaft: si, gears: gi, z0, hubs, name: 'P' + (parts.length + 1) });
  });
  return parts;
}
