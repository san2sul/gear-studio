/* ================= 설계 데이터 =================
 design = { box:{W,H,D,wall}|null, rpm, shafts:[{x,y,d,role,fixed}], gears:[{name,shaft,m,z,pa,x,b,backlash,zpos}],
            meshes:[[gi,gj]], input:shaftIdx, output:shaftIdx, target:{ratio,dir}, settings:{clear} } */

function shaftBore(s) { return s.fixed ? { d: s.d + 0.1, dcut: 0.5 } : { d: s.d + 0.35, dcut: 0 }; }

// 운동학: 축별 각속도, 기어별 초기 위상
function kinematics(D) {
  const n = D.shafts.length, w = new Array(n).fill(null), phase = new Array(D.gears.length).fill(null);
  const w0 = D.rpm * 2 * PI / 60;
  w[D.input] = w0;
  D.gears.forEach((g, i) => { if (g.shaft === D.input) phase[i] = 0; });
  let changed = true, guard = 0;
  while (changed && guard++ < 50) {
    changed = false;
    for (const [i, j] of D.meshes) {
      for (const [A, B] of [[i, j], [j, i]]) {
        const ga = D.gears[A], gb = D.gears[B];
        if (phase[A] === null || phase[B] !== null) continue;
        const sa = D.shafts[ga.shaft], sb = D.shafts[gb.shaft];
        const th = Math.atan2(sb.y - sa.y, sb.x - sa.x);
        phase[B] = th + PI + PI / gb.z - (ga.z / gb.z) * (phase[A] - th);
        if (w[gb.shaft] === null) w[gb.shaft] = -w[ga.shaft] * ga.z / gb.z;
        D.gears.forEach((g, k) => { if (g.shaft === gb.shaft && phase[k] === null) phase[k] = 0; });
        changed = true;
      }
    }
  }
  return { w: w.map(v => v ?? 0), phase: phase.map(v => v ?? 0) };
}
