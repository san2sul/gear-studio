// ---- 차동 기어(평기어식): 모터 피니언 → 캐리어. 해 기어 A(아래 출력), B(위 출력), 유성 a·b가 서로 맞물려 A와 B의 속도 차를 허용
function lkDiff(D, model, K, M) {
  const { t, z1, bt, free, press, pd } = K, checks = model.checks, G = diffGeo(D), sd = D.sd, dv = (D.diff.dv || 0) / 100;
  const gr = z => ({ m: G.m, z, pa: 20, x: 0, backlash: 0.15 }), ol = (z, ph, res = 6) => rotPts(gearOutline(gr(z), res).pts, ph);
  const zp = G.zp, zs = G.zs, ro = G.ro, Cd = G.Cd;
  const pose = tt => linkPose(D, K.thOf(tt));
  // 위상 (평기어 맞물림 규칙)
  const ph = (dir, phA, zA, zB) => dir + PI + PI / zB - (zA / zB) * (phA - dir);
  const phc = ph(0, 0, G.zm, G.zc), phA = 0;
  const pl = [0, PI].flatMap(a0 => { const aa = a0, ab = a0 + G.dl, Pa = [ro * Math.cos(aa), ro * Math.sin(aa)], Pb = [ro * Math.cos(ab), ro * Math.sin(ab)];
    const fa = ph(aa, phA, zs, zp), fb = ph(Math.atan2(Pb[1] - Pa[1], Pb[0] - Pa[0]), fa, zp, zp); return [{ k: 'a', al: aa, f0: fa }, { k: 'b', al: ab, f0: fb }]; });
  const b1 = pl[1], phB = ph(b1.al + PI, b1.f0, zp, zs);
  // 모터 피니언 (입력)
  model.parts.push({ name: '모터 피니언', file: `pinion_z${G.zm}_m${G.m}`, tris: K.driver(ol(G.zm, 0)), motion: tt => XF.Rz(K.thOf(tt)), print: K.hub ? K.flip : undefined, clash: [{ h: ol(G.zm, 0, 3), z: [z1, z1 + t], cc: true }] });
  const cM = tt => XF.mul(XF.T(Cd, 0, 0), XF.Rz(pose(tt).tc)), pinP = pl.map(q => [ro * Math.cos(q.al), ro * Math.sin(q.al)]);
  const cBoss = moveTris(extrudeTris(circlePts(sd / 2 + 3, 32), [circlePts((sd + 0.4) / 2, 28)], z1 - bt - 0.1 + 0.01), 0, 0, bt + 0.1);
  model.parts.push({ name: '캐리어 기어', file: `carrier_gear_z${G.zc}`, tris: moveTris(extrudeTris(ol(G.zc, phc), [circlePts((sd + 0.4) / 2, 28), ...pinP.map(p => circlePts(press / 2, 24, ...p))], t), 0, 0, z1).concat(cBoss),
    motion: cM, clash: [{ h: ol(G.zc, phc, 3), z: [z1, z1 + t], cc: true }] });
  const Rt = ro + G.m * (zp / 2 + 1) + 3, zT = K.zL(4);
  model.parts.push({ name: '캐리어 윗판', file: 'carrier_top', tris: moveTris(extrudeTris(circlePts(Rt, 64), [circlePts((sd + 0.4) / 2, 28), ...pinP.map(p => circlePts(press / 2, 24, ...p))], t), 0, 0, zT), motion: cM });
  const sunBore = borePts(sd + 0.1, 0.5);
  model.parts.push({ name: '해 기어 A', file: `sun_A_z${zs}`, tris: moveTris(extrudeTris(ol(zs, phA), [sunBore], t), 0, 0, K.zL(1)), motion: tt => XF.mul(XF.T(Cd, 0, 0), XF.Rz(pose(tt).tA)), clash: [{ h: ol(zs, phA, 3), z: [K.zL(1), K.zL(1) + t], cc: true }] });
  model.parts.push({ name: '해 기어 B', file: `sun_B_z${zs}`, tris: moveTris(extrudeTris(ol(zs, phB), [sunBore], t), 0, 0, K.zL(3)), motion: tt => XF.mul(XF.T(Cd, 0, 0), XF.Rz(pose(tt).tB)), clash: [{ h: ol(zs, phB, 3), z: [K.zL(3), K.zL(3) + t], cc: true }] });
  pl.forEach((q, i) => {
    const z0 = K.zL(q.k === 'a' ? 1 : 2), H = 2 * t + K.cl, nm = `유성 ${q.k}${i < 2 ? 1 : 2}`;
    const rot = tt => { const p = pose(tt), tS = q.k === 'a' ? p.tA : p.tB; return q.f0 + p.tc - (tS - p.tc) * zs / zp; };
    const mot = tt => { const p = pose(tt), a = q.al + p.tc; return XF.mul(XF.T(Cd + ro * Math.cos(a), ro * Math.sin(a), 0), XF.Rz(rot(tt) - q.f0)); };
    model.parts.push({ name: nm, file: `planet_${q.k}${i < 2 ? 1 : 2}_z${zp}`, tris: moveTris(extrudeTris(ol(zp, q.f0), [circlePts(free / 2, 24)], H), 0, 0, z0), motion: mot, clash: [{ h: ol(zp, q.f0, 3), z: [z0, z0 + H], cc: true }] });
    K.pin(`유성 핀 ${q.k}${i < 2 ? 1 : 2}`, z1, zT + t, tt => { const a = q.al + pose(tt).tc; return [Cd + ro * Math.cos(a), ro * Math.sin(a)]; }, ['캐리어 기어', '캐리어 윗판', nm]);
  });
  model.plateHoles.push([Cd, 0, sd + 0.4]);
  model.rods.push({ a: [Cd, 0, -15], b: [Cd, 0, K.zL(1) + t], d: sd, role: 'output' }, { a: [Cd, 0, K.zL(3)], b: [Cd, 0, zT + t + 15], d: sd, role: 'output' });
  model.dropExtra = 15;
  K.grow(Cd, 0, G.m * (G.zc / 2 + 1) + 4); K.grow(0, 0, G.m * (G.zm / 2 + 1) + 4);
  const nc = K.rpm * G.zm / G.zc, rfC = gearOutlineInfo(gr(G.zc)).rf;
  checks.unshift({ st: 'ok', txt: `캐리어 <em>${fmt(nc, 2)} rpm</em> (모터 ${fmt(K.rpm, 1)} rpm × ${G.zm}/${G.zc}) · 출력 A <em>${fmt(nc * (1 + dv), 2)} rpm</em> · 출력 B <em>${fmt(nc * (1 - dv), 2)} rpm</em> · A + B = 2 × 캐리어` });
  checks.push({ st: zs % 2 === 0 ? 'ok' : 'bad', txt: zs % 2 === 0 ? `해 기어 잇수 ${zs}(짝수)라 유성 두 쌍이 맞은편에서 함께 물립니다` : `해 기어 잇수 ${zs}가 홀수라 맞은편 유성이 물리지 않습니다. 짝수로 하세요` });
  checks.push({ st: ro + press / 2 + 1.2 <= rfC ? 'ok' : 'bad', txt: ro + press / 2 + 1.2 <= rfC ? `유성 핀 구멍이 캐리어 기어 이뿌리 안쪽에 있습니다 (여유 ${fmt(rfC - ro - press / 2, 1)} mm)` : '유성 핀 구멍이 캐리어 기어 이에 걸립니다. 캐리어 잇수를 늘리세요' });
  model.hud = [['모터', fmt(K.rpm, 1) + ' rpm'], ['캐리어', fmt(nc, 2) + ' rpm'], ['출력 A (아래)', fmt(nc * (1 + dv), 2) + ' rpm'], ['출력 B (위)', fmt(nc * (1 - dv), 2) + ' rpm']];
  model.table = linkTbl([[`모터 피니언`, `z ${G.zm} · m ${G.m}`, `두께 ${t}`, boreTxt(K)], ['캐리어 기어', `z ${G.zc} · 중심거리 ${fmt(Cd, 2)}`, `두께 ${t}`, `핀 ${fmt(press, 2)} ×4`], ['캐리어 윗판', `지름 ${fmt(2 * Rt, 1)}`, `두께 ${t}`, `핀 ${fmt(press, 2)} ×4`],
    ['해 기어 A', `z ${zs}`, `두께 ${t} · 2층`, `Ø${sd} D컷 (아래 출력)`], ['해 기어 B', `z ${zs}`, `두께 ${t} · 4층`, `Ø${sd} D컷 (위 출력)`], { part: 5, c: ['유성 a·b ×2', `z ${zp} · 궤도 반지름 ${fmt(ro, 2)}`, `두께 ${fmt(2 * t + K.cl, 1)}`, `핀 ${fmt(free, 2)}`] }]);
  model.asm = ['출력축 A(아래)를 바닥판 구멍에 끼우고 캐리어 기어와 해 기어 A를 차례로 꿰습니다.', '유성 핀 4개를 캐리어 기어에 눌러 끼우고 유성 a(아래 두 층)와 b(위 두 층)를 번갈아 끼웁니다.', '해 기어 B와 출력축 B를 올리고 캐리어 윗판을 핀 끝에 눌러 끼웁니다.'];
  model.bomExtra = [[`Ø${sd} D컷 축 (출력)`, 2, '아래 A는 바닥판 밑으로 15 mm, 위 B는 윗판 위로 15 mm 나옴']];
  model.notes.push(`출력 속도 차(설정 ${D.diff.dv}%)는 바퀴가 도는 길이 차이(코너링)를 흉내 낸 것입니다. 한쪽 출력을 손으로 잡으면 다른 쪽이 두 배 빨리 돕니다.`);
  return [circlePts(sd / 2 + 4.5, 24, Cd, 0)];
}
// ---- 마무리: 바닥판·다리·핀·검사·배선·부품 목록
function linkFinish(D, model, K, M, zones) {
  K.mount(zones);
  const { MO, mt, bt, cb, z1, t, servo, dv } = K, checks = model.checks;
  model.rods.unshift({ a: [0, 0, MO ? K.shBot : -10], b: [0, 0, Math.min(K.shTop, z1 + t)], d: K.shD, role: 'input' });
  const ext = K.ext, x0 = ext.lo[0] - 4, y0 = ext.lo[1] - 4, x1 = ext.hi[0] + 4, y1 = ext.hi[1] + 4, R = rectPts(x0, y0, x1, y1);
  const feet = [[x0 + 4, y0 + 4], [x1 - 4, y0 + 4], [x0 + 4, y1 - 4], [x1 - 4, y1 - 4]], fh = D.cornerHoles ? feet.map(([x, y]) => circlePts(1.7, 20, x, y)) : [];
  const hs = fh.concat([K.red ? circlePts((D.sd + 0.3) / 2, 32) : MO ? (servo ? mt.cut : circlePts((MO.boss.d + 0.5) / 2, 40)) : circlePts((D.sd + 0.4) / 2, 40)].concat(model.plateHoles.map(([x, y, d]) => circlePts(d / 2, 24, x, y))));
  const sm = mt ? mt.holes.map(h => circlePts(h.d / 2, 20, h.x, h.y)) : [];
  let plate = cb ? extrudeTris(R, hs.concat(sm), bt - cb + 0.01).concat(moveTris(extrudeTris(R, hs.concat(mt.holes.map(h => circlePts(h.cb / 2, 24, h.x, h.y))), cb), 0, 0, bt - cb))
    : extrudeTris(R, hs.concat(sm), bt);
  const drop = Math.max(mt ? mt.drop : 0, model.dropExtra || 0), legH = drop > 0 ? Math.ceil(drop + 3) : 0;
  if (legH) [[x0, y0], [x1 - 8, y0], [x0, y1 - 8], [x1 - 8, y1 - 8]].forEach(([lx, ly]) => { plate = plate.concat(moveTris(extrudeTris(rectPts(lx, ly, lx + 8, ly + 8), D.cornerHoles ? [circlePts(1.7, 20, lx + 4, ly + 4)] : [], legH + 0.01), 0, 0, -legH)); });
  model.housing.unshift({ name: '바닥판', file: 'base_plate', tris: plate, print: legH ? K.flip : undefined });
  const pg = new Map(); K.pins.forEach(pn => { const k = fmt(pn.L, 1); pg.set(k, (pg.get(k) || 0) + 1); });
  pg.forEach((n, k) => model.housing.push({ name: '핀', file: `pin_d${K.pd}_L${k}${n > 1 ? '_x' + n : ''}`, tris: extrudeTris(circlePts(K.pd / 2 - 0.05, 24), [], +k), assembly: false }));
  model.frame = true; model.motion = M; model.single = false; model.interference = null;
  model.feet = { pts: feet, z: legH ? -legH : 0, holes: !!D.cornerHoles };
  model.linkInfo = { bore: K.bore, hub: K.hub, spl: K.spl, cen: servo ? +(MO.servo.center + 0.2).toFixed(2) : 0, shD: K.shD, z1 };
  model.period = K.period; model.thOf = K.thOf;
  if (!model.hud) model.hud = [['입력', fmt(K.rpm, 1) + ' rpm']];
  const inName = model.parts[0].name;
  const RD = K.red;
  if (MO) {
    const eng = RD ? RD.eng : Math.min(K.shTop, z1 + t) - Math.max(K.hub ? K.hub.z0 : z1, K.shBot);
    checks.unshift({ st: dv.margin >= 1.5 ? 'ok' : dv.margin >= 1 ? 'warn' : 'bad', txt: `${MO.short}: 토크 <em>${fmt(dv.Tin / 10, 2)} N·cm</em> (입력축에 걸리는 최대 ${fmt(dv.Treq / 10, 2)} N·cm) · 여유 <em>${fmt(dv.margin, 2)}배</em>${dv.margin < 1 ? ' · 힘이 모자랍니다. 다른 모터를 고르세요' : dv.margin < 1.5 ? ' · 1.5배 이상 권장' : ''}` });
    if (dv.sp > Math.log(1.1)) checks.splice(1, 0, { st: 'warn', txt: `${MO.short}는 입력을 <em>${fmt(K.rpm, 1)} rpm</em>으로 돌립니다 (목표 ${fmt(D.rpm, 1)} rpm)` });
    if (RD) {
      const sig = dv.Tm / (RD.m * RD.z1 / 2) / (RD.gt * RD.m * 0.25);
      checks.push({ st: sig <= 20 ? 'ok' : 'warn', txt: `감속 기어 <em>${RD.z1}T → ${RD.z2}T (${RD.i}:1)</em> · 모듈 ${RD.m} · 중심거리 ${fmt(RD.a, 1)} mm · 모터 ${fmt(dv.nm, 1)} rpm → 입력 ${fmt(K.rpm, 1)} rpm · 피니언 굽힘 응력 ${fmt(sig, 1)} MPa` });
      checks.push({ st: eng >= 4 ? 'ok' : eng >= 2.5 ? 'warn' : 'bad', txt: `모터 축이 감속 피니언에 물리는 길이 <em>${fmt(eng, 1)} mm</em> · 큰 기어와 피니언은 바닥판 밑, 모터는 그 아래 브래킷에 매달림` });
    } else checks.push({ st: eng >= 4 ? 'ok' : eng >= 2.5 ? 'warn' : 'bad', txt: `모터 축이 ${inName}에 물리는 길이 <em>${fmt(eng, 1)} mm</em>${servo ? ' · 서보 중심 나사로 고정' : ''}${K.raised ? ' · 긴 모터 축에 맞춰 입력 부품을 올리고 아래에 허브를 달았습니다' : K.hub ? ' · 허브가 모터 돌출부 구멍 속까지 내려갑니다' : ''}` });
    model.hud.unshift(['동력원', MO.short], ...(RD ? [['감속', `${RD.i} : 1`]] : []), ['토크 여유', fmt(dv.margin, 2) + '배']);
    model.kit = driveKit({ drive: { motor: dv.id }, rpm: RD ? dv.nm : K.rpm }, { r: RD ? RD.i : 1, nOut: K.rpm }); model.kit.title = MO.name;
    if (MO.bigAmp) model.kit.notes.push(`${MO.short}는 전류가 ${MO.amp} A 이상이라 TB6612FNG(1.2 A)로는 부족합니다. BTS7960 같은 큰 드라이버를 쓰세요.`);
    model.kit.notes.push('안전: 전원선에 스위치와 퓨즈(모터 정격 전류의 1.5~2배)를 다세요. 움직이는 부품 사이에 손가락이 끼지 않게 하고, 처음 켤 때는 손을 떼고 지켜보세요.');
  } else model.kit = { driver: '없음', rows: [], ino: null, notes: [`모터 없이 Ø${D.sd} D컷 축만 둡니다. 바닥판 아래에서 모터나 손잡이로 축을 돌리세요. 동력원에서 모터를 고르면 마운트와 배선이 함께 만들어집니다.`] };
  const V = servo && MO.servo, bom = [];
  if (MO) { bom.push([MO.name, 1, RD ? `모터 ${fmt(dv.nm, 1)} rpm → 입력 ${fmt(K.rpm, 1)} rpm` : `입력 ${fmt(K.rpm, 1)} rpm`]);
    if (MO.driver !== 'servo') bom.push([({ A4988: 'A4988 드라이버', ULN2003: 'ULN2003 드라이버 보드', TB6612FNG: 'TB6612FNG 드라이버' })[MO.driver], 1, '']);
    model.bomPower = powerRows(MO); }
  if (RD) bom.push([`${MO.screwName} 나사 (모터 앞면을 브래킷에)`, MO.holes.length, `길이 ${fmt(RD.tb + 3, 0)}~${fmt(RD.tb + 5, 0)} mm, 브래킷 위에서 끼움`],
    ['M3 나사 (브래킷 기둥을 바닥판에)', 4, `길이 ${fmt(bt - cb + 8, 0)} mm 정도, 바닥판 위에서 기둥 구멍에 셀프 태핑`],
    [`Ø${D.sd} D컷 축 (입력)`, 1, `길이 ${fmt(z1 + t - RD.zf, 0)} mm: 브래킷 밑면부터 ${inName} 윗면까지`]);
  if (MO && dv.mount === 'face') bom.push([`${MO.screwName} 나사 (모터 앞면을 바닥판에)`, mt.holes.length, `길이 ${fmt(bt - cb + 3, 0)}~${fmt(bt - cb + 5, 0)} mm, 위에서 끼우면 머리가 자리파기에 묻힘`]);
  if (MO && dv.mount === 'clamp') bom.push(['M3 나사 (클램프를 바닥판에)', 2, `길이 ${fmt(bt - cb + 6, 0)} mm, 클램프 구멍에 셀프 태핑`], ['M3×12 나사 + 너트 (클램프 조임)', 1, '']);
  if (servo) bom.push([`${V.screwName} 나사 (서보 귀를 바닥판 밑면에)`, V.ears.length, '바닥판 구멍에 셀프 태핑'], [`${V.centerName} 서보 중심 나사`, 1, `서보에 들어 있는 나사로 ${inName}을(를) 스플라인에 고정`]);
  if (!MO) bom.push([`Ø${D.sd} D컷 축 (입력)`, 1, `바닥판 아래에서 돌림, 위 끝은 ${inName} 윗면(바닥판 위 ${fmt(z1 + t, 1)} mm)까지`]);
  if (K.pins.length) bom.push([`Ø${K.pd} 핀 (금속봉 또는 출력한 핀)`, K.pins.length, K.pins.map(q => `${q.n} ${fmt(q.L, 1)} mm`).join(', ')]);
  (model.bomExtra || []).forEach(b => bom.push(b));
  if (model.glue) bom.push(['순간접착제', 1, model.glue]);
  if (model.bomPower) bom.push(...model.bomPower);
  model.bom = bom;
  model.steps = [K.pins.length ? 'test/fit_test.stl(공차 시험편)을 먼저 뽑아 핀이 한쪽 구멍엔 꽉, 다른 쪽 구멍엔 헐겁게 맞는지 확인합니다. 안 맞으면 핀 지름을 0.1 mm씩 고쳐 다시 내보냅니다.' : 'test/fit_test.stl(공차 시험편)을 먼저 뽑아 구멍 맞춤을 확인합니다.'];
  if (RD) model.steps.push(`모터 앞면을 브래킷 밑면에 대고(돌출부가 큰 구멍에 들어감) 브래킷 위에서 ${MO.screwName} 나사로 고정합니다.`,
    `감속 피니언을 모터 축에 끼웁니다 (D컷 방향을 맞춤). 피니언 윗면이 브래킷 윗면보다 ${fmt(RD.zg1 - RD.zb, 1)} mm 위에 오게 합니다.`,
    `입력축(Ø${D.sd} D컷)을 바닥판 위에서 가운데 구멍으로 내리며 바닥판 밑에서 감속 큰 기어를 끼우고, 큰 기어 윗면을 바닥판 밑면에서 0.4 mm 띄웁니다. 축 아래 끝은 브래킷 구멍에 들어갑니다.`,
    '브래킷 기둥 4개를 바닥판 밑에 대고 위에서 M3 나사로 고정합니다. 피니언과 큰 기어가 물렸는지 손으로 돌려 봅니다.');
  else if (MO) model.steps.push(servo ? `서보를 바닥판 밑에서 사각 구멍으로 밀어 올리고, 귀를 ${V.screwName} 나사로 바닥판 밑면에 고정합니다.`
    : dv.mount === 'clamp' ? '모터를 클램프에 끼우고 M3×12 나사로 조인 뒤, 클램프를 바닥판 밑에 대고 위에서 M3 나사 2개로 고정합니다.'
    : `모터 앞면을 바닥판 밑에 대고(돌출부가 가운데 구멍에 들어감) 위에서 ${MO.screwName} 나사로 고정합니다. 나사 머리는 자리파기에 묻힙니다.`);
  model.steps.push(...(model.asm || []), RD ? `${inName}을(를) 입력축 위쪽 D컷에 맞춰 끼우고 순간접착제로 고정합니다. 큰 기어와 ${inName}이(가) 바닥판을 위아래에서 잡아 축이 빠지지 않습니다.` : MO ? (servo ? `${inName}의 아래 구멍을 서보 스플라인에 눌러 끼우고 중심 나사로 고정합니다. 서보가 연속 회전형인지 확인하세요.` : `${inName}을(를) 모터 축에 끼웁니다 (D컷 방향을 맞춤). 헐거우면 순간접착제를 한 방울 씁니다.`) : `입력축을 바닥판 아래에서 끼우고 ${inName}을(를) D컷에 맞춰 끼웁니다.`);
  if (K.pins.length) model.steps.push('핀을 꽉 끼는 구멍에 눌러 넣어 부품을 잇습니다. 아래층 부품부터 위로 쌓습니다.');
  model.steps.push('전원 없이 입력을 손으로 한 바퀴 돌려 걸림이 없는지 보고, 그다음 ' + (MO ? '배선표대로 연결해 아두이노 코드로 시험합니다.' : '모터나 손잡이를 연결합니다.'));
  model.fitTest = fitTestTris(K.pins.length ? K.pd : D.sd, null);
  if (K.pins.length) model.notes.push(`핀 구멍: 한쪽은 꽉(+0.05 mm), 다른 쪽은 헐겁게(+0.3 mm) 잡혀 있어 핀이 한 부품에 고정되고 다른 부품이 돕니다. 핀 대신 Ø${K.pd} 금속봉을 써도 됩니다.`);
  if (legH) model.notes.push(`${MO && mt.drop >= (model.dropExtra || 0) ? `모터가 바닥판 밑으로 ${fmt(mt.drop, 0)} mm 나와서` : '출력축이 바닥판 밑으로 나와서'} 바닥판 네 귀퉁이에 높이 ${legH} mm 다리를 달았습니다.`);
  if (M.ok) {
    const hits = linkClash(model, K);
    checks.push(hits.length ? { st: 'bad', txt: `움직이는 동안 겹칩니다: ${hits.slice(0, 3).map(h => `<em>${h.pair}</em> (${h.deg}°)`).join(', ')} · ${D.type === 'slider' ? '연결 막대를 길게 하거나 크랭크를 짧게 하세요' : '치수를 바꿔 보세요'}` }
      : { st: 'ok', txt: '움직이는 동안 부품끼리 겹치지 않습니다' });
  }
  model.scad = () => linkageScad(D, model);
}
const LK_BUILD = { slider: lkSlider, yoke: lkYoke, fourbar: lkFourbar, jansen: lkJansen, geneva: lkGeneva, ratchet: lkRatchet, screw: lkScrew, diff: lkDiff };
function linkageModel(D) {
  linkFix(D);
  const model = { kind: 'linkage', parts: [], housing: [], rods: [], notes: [], extras: [], checks: [], clashFixed: [], plateHoles: [], pinBodies: [] };
  const K = linkCtx(D, model), M = linkMotion(D);
  if (!M.ok) model.checks.push({ st: 'bad', txt: D.type === 'slider' ? '연결 막대가 너무 짧아 크랭크가 한 바퀴를 돌지 못합니다. 막대 길이 L ≥ 크랭크 반지름 r + |편심 e| 이어야 합니다.' : '이 치수로는 입력이 한 바퀴를 돌지 못합니다 (어느 자리에서 링크가 닿지 않음).' });
  const zones = LK_BUILD[D.type](D, model, K, M) || [];
  linkFinish(D, model, K, M, zones);
  return model;
}
const LK_KO = { slider: '크랭크·슬라이더', yoke: '스카치 요크', fourbar: '4절 링크', jansen: '얀센 링크', geneva: '제네바 기구', ratchet: '래칫 기구', screw: '리드스크루', diff: '차동 기어' };
function linkageScad(D, model) {
  const K = model.linkInfo, hubH = K.hub ? +(K.z1 - K.hub.z0).toFixed(2) : 0, param = D.type === 'slider' || D.type === 'fourbar', S = D.type === 'slider' ? D.slider : D.fourbar;
  const meshes = model.housing.concat(param ? model.parts.filter(p => /slider|^red_/.test(p.file)) : model.parts).filter(h => h.assembly !== false);
  return `// 기어 설계실: ${LK_KO[D.type]} (OpenSCAD 2021.01 이상)
// ${param ? '치수를 바꾸고 F6 → STL. 크랭크·링크는 앱의 STL과 같은 치수로 다시 만들고, 바닥판·레일·마운트는 앱에서 정한 모양(polyhedron)입니다' : '부품은 앱의 STL과 같은 모양(polyhedron)입니다. part 값을 바꿔 하나씩 F6 → STL'}
part = "${model.parts[0].file}";   // ${model.parts.map(p => p.file).concat(model.housing.filter(h => h.assembly !== false).map(h => h.file)).join(' | ')}
${param ? `W = ${D.w}; T = ${D.t}; PIN = ${D.pinD}; SHAFT = ${K.shD};
BORE = ${K.bore.d}; BCUT = ${K.bore.dcut}; BDD = ${K.bore.dd ? 1 : 0};   // 크랭크 축 구멍 (모터 축 + 여유)
HUBR = ${K.hub ? fmt(K.hub.r, 2) : 0}; HUBH = ${hubH};   // 크랭크 아래 허브
SPL = ${K.spl}; CEN = ${K.cen};   // 서보: 스플라인 깊이, 중심 나사 구멍
${D.type === 'slider' ? `R = ${S.r}; L = ${S.L}; E = ${S.e};` : `A = ${S.a}; B = ${S.b}; C = ${S.c}; Dl = ${S.d}; PX = ${S.p || 0}; PY = ${S.q || 0};`}
module bore2d(d, dcut, dd = 0) { if (dcut > 0) intersection() { circle(d = d, $fn = 40); translate([-d, -d]) square([1.5*d - dcut, 2*d]); if (dd) translate([dcut - d/2, -d]) square([2*d, 2*d]); } else circle(d = d, $fn = 40); }
module bar(len, w, h1, h2, t) linear_extrude(t) difference() { hull() { circle(r = w/2, $fn = 40); translate([len, 0]) circle(r = w/2, $fn = 40); } circle(d = h1, $fn = 28); translate([len, 0]) circle(d = h2, $fn = 28); }
module crank_part(r) { CR = max(W/2, SHAFT/2 + 3); difference() {
  union() { translate([0, 0, HUBH]) linear_extrude(T) hull() { circle(r = CR, $fn = 32); translate([r, 0]) circle(r = CR, $fn = 32); }
    if (HUBH > 0) cylinder(r = HUBR, h = HUBH + 0.01, $fn = 40); }
  translate([0, 0, -1]) linear_extrude(CEN > 0 ? HUBH + SPL + 1 : HUBH + T + 2) bore2d(BORE, BCUT, BDD);
  if (CEN > 0) translate([0, 0, -1]) cylinder(d = CEN, h = HUBH + T + 2, $fn = 24);
  translate([r, 0, HUBH - 1]) cylinder(d = PIN + 0.05, h = T + 2, $fn = 28); } }
${D.type === 'slider' ? `module rod() bar(L, W, PIN + 0.3, PIN + 0.3, T);
if (part == "${model.parts[0].file}") crank_part(R);
if (part == "${model.parts[1].file}") rod();` : `module coupler() linear_extrude(T) difference() { hull() { circle(r = W/2, $fn = 40); translate([C, 0]) circle(r = W/2, $fn = 40); translate([PX, PY]) circle(r = W/2, $fn = 40); } circle(d = PIN + 0.3, $fn = 28); translate([C, 0]) circle(d = PIN + 0.3, $fn = 28); if (PX != 0 || PY != 0) translate([PX, PY]) circle(d = PIN + 0.3, $fn = 28); }
module rocker() bar(Dl, W, PIN + 0.3, PIN + 0.05, T);
if (part == "${model.parts[0].file}") crank_part(B);
if (part == "${model.parts[1].file}") coupler();
if (part == "${model.parts[2].file}") rocker();`}` : ''}
${meshes.map(h => `${scadMesh('m_' + h.file.replace(/\W/g, '_'), h.tris)}\nif (part == "${h.file}") m_${h.file.replace(/\W/g, '_')}();`).join('\n')}
`;
}
// 동력원 설계: 각 대안에 동력원을 붙이고, 모터 나사 자리가 들어가는 설계를 앞으로 (없으면 입력축 자리를 옮겨 다시 설계)
function driveAlts(alts, P) {
  const func = P.func;
    const M = motorOf(P.drive);
    alts.forEach(a => { a.drive = JSON.parse(JSON.stringify(P.drive));
      if (M.kind === 'stepper') a.rpm = +Math.min(M.rpmHi, Math.max(M.rpmLo, P.drive.load.rpm * designRatio(a).r)).toFixed(3); });   // 스테퍼는 실제 변속비에 맞춰 속도를 다시 잡음
    if (M.kind !== 'hand' && alts[0] && alts[0].kind === 'gearbox') {   // 모터 나사 자리가 들어가는 설계를 앞으로
      const okM = a => { try { const mm = motorMount(a, partsOf(a)); return !mm.problems.length; } catch { return false; } };
      let good = alts.filter(okM);
      if (!good.length && !P.fixIn) {   // 큰 모터: 입력축을 나사 자리가 들어가는 곳에 고정해 다시 설계
        const G = shapeGeo(P._box), R = Math.max(...M.holes.map(h => Math.hypot(h[0], h[1]))) + M.screw + 0.5;
        const cands = [G.cIn];
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]) cands.push([P.wall + R + (sx + 1) / 2 * (P.W - 2 * P.wall - 2 * R), P.wall + R + (sy + 1) / 2 * (P.H - 2 * P.wall - 2 * R)]);
        for (const c of cands) {
          if (!fitsIn(P._box, c[0], c[1], R)) continue;
          const Q = { ...P, fixIn: c }; Q._box = P._box;
          const more = (func === 'planetary' ? [] : autoDesign(Q)).map(a => { a.drive = JSON.parse(JSON.stringify(P.drive));
            if (M.kind === 'stepper') a.rpm = +Math.min(M.rpmHi, Math.max(M.rpmLo, P.drive.load.rpm * designRatio(a).r)).toFixed(3); return a; });
          good = more.filter(okM); if (good.length) break;
        }
      }
      alts = good.concat(alts.filter(a => !good.includes(a)));
    }
  return alts;
}
function buildModel(D, opt = {}) {
  const m = buildModel0(D);
  if (D.drive && ['gearbox', 'bevel', 'planetary'].includes(D.kind)) driveAttach(D, m);
  if (!opt.sub) sizeRules(D, m);
  return m;
}
/* ---- 크기별 규칙 ----
 전체 크기로 등급(초소형·탁상·큰·아주 큰)을 정하고, 그 크기에서 지켜야 할 것을 알려 줌.
 출력판(BED)보다 큰 출력 부품, FDM으로 뽑기 힘든 작은 모듈·가는 축도 따로 짚음 */
const BED = { x: 220, y: 220, z: 250 };
const SIZE_CLASS = [
  { max: 30, ko: '초소형', tip: '0.2 mm 노즐(또는 레진 프린터)과 0.1 mm 층 높이를 쓰고, 축은 금속 핀(2–3 mm)으로, 구멍은 출력 뒤 드릴로 다듬으세요.' },
  { max: 220, ko: '탁상', tip: '보통 FDM(0.4 mm 노즐, PLA·PETG)으로 한 판에 뽑을 수 있는 크기입니다.' },
  { max: 600, ko: '큰', tip: '바탕은 알루미늄 프로파일(2020)이나 합판으로, 축은 강 봉으로 하고, 출력 부품은 PETG·채움 40% 이상, 벽 4겹 이상을 쓰세요. 판보다 큰 부품은 나눠 출력해 볼트로 잇습니다.' },
  { max: Infinity, ko: '아주 큰', tip: '출력 부품은 기어·이음·브래킷 같은 작은 부품에만 쓰고, 뼈대는 금속(프로파일·강판)으로 만드세요. 무게가 커서 모터에 브레이크나 웜 감속을 두고, 끼임 방지 덮개와 비상 정지 스위치를 다세요.' },
];
function sizeRules(D, m) {
  if (!m || !m.parts || !m.checks) return;
  const live = m.parts.filter(p => !p.noExport && p.tris && p.tris.length), hs = (m.housing || []).filter(h => h.assembly !== false && h.tris && h.tris.length);
  if (!live.length && !hs.length) return;
  const all = trisBounds([].concat(...live.map(p => p.motion ? xfTris(p.tris, p.motion(0)) : p.tris), ...hs.map(h => h.tris)));
  const dim = [0, 1, 2].map(a => all.hi[a] - all.lo[a]), L = Math.max(...dim), C = SIZE_CLASS.find(c => L <= c.max);
  m.size = { dim, cls: C.ko };
  m.checks.push({ st: L > 600 ? 'warn' : 'ok', txt: `크기 등급 <em>${C.ko}</em> (전체 ${dim.map(v => fmt(v, 0)).join('×')} mm): ${C.tip}` });
  // 출력판보다 큰 출력 부품 (어느 방향으로 눕혀도 안 들어가는 것)
  const seen = new Set(), big = [];
  live.concat(m.housing || []).forEach(p => { if (p.noExport || seen.has(p.file)) return; seen.add(p.file);
    const b = trisBounds(p.printTris || p.tris), d = [0, 1, 2].map(a => b.hi[a] - b.lo[a]).sort((x, y) => x - y);
    if (d[1] > BED.x || d[2] > Math.max(BED.y, BED.z)) big.push(`${p.name} ${fmt(d[2], 0)}×${fmt(d[1], 0)}`); });
  if (big.length) m.checks.push({ st: 'warn', txt: `출력판(${BED.x}×${BED.y} mm)보다 큰 부품 ${big.length}개: ${big.slice(0, 4).join(', ')}${big.length > 4 ? ' …' : ''} mm. 나눠 출력해 볼트·도브테일로 잇거나 판재·프로파일로 바꾸세요.` });
  // 작은 이·가는 축 (FDM 한계)
  const ms = [], walk = (o, k) => { if (!o || typeof o !== 'object') return; for (const [key, v] of Object.entries(o)) { if (key === 'drive') continue; if (key === 'm' && typeof v === 'number' && v > 0) ms.push(v); else walk(v, key); } };
  walk(D);
  const mMin = ms.length ? Math.min(...ms) : Infinity, dMin = Math.min(...(m.rods || []).map(r => r.d).filter(v => v > 0));
  if (mMin < 0.5) m.checks.push({ st: 'warn', txt: `모듈 ${fmt(mMin, 2)} 기어는 0.4 mm 노즐로는 이가 뭉개집니다. 레진(SLA) 프린터나 0.2 mm 노즐을 쓰거나 모듈을 0.5 이상으로 키우세요.` });
  else if (mMin < 0.8) m.checks.push({ st: 'ok', txt: `모듈 ${fmt(mMin, 2)}: 0.4 mm 노즐이면 층 높이 0.12 mm 이하, 첫 층 확장(코끼리 발) 보정을 켜세요.` });
  if (dMin < 3) m.checks.push({ st: 'warn', txt: `축 지름 ${fmt(dMin, 1)} mm는 출력하면 부러지기 쉽습니다. 강 핀·바늘 롤러 핀을 끼우세요.` });
}
function buildModel0(D) {
  if (D.kind === 'train') return trainModel(D);
  if (D.kind === 'bevel') return bevelModel(D);
  if (D.kind === 'planetary') return planetaryModel(D);
  if (D.kind === 'rack') return rackModel(D);
  if (D.kind === 'cam') return camModel(D);
  if (D.kind === 'linkage') return linkageModel(D);
  if (D.kind === 'std') return stdModel(D);
  if (D.kind === 'asm') return asmModel(D);
  if (D.kind === 'cycloid') return cycloidModel(D);
  if (D.kind === 'worm') return wormModel(D);
  return spurModel(D);
}
const rpmOf = w => Math.abs(w) * 60 / 2 / PI;

function spurModel(D) {
  const kin = kinematics(D), parts = partsOf(D);
  const model = { kind: 'spur', parts: [], housing: [], rods: [], notes: [], extras: [] };
  const MD = D.drive && D.box ? motorOf(D.drive) : null, hand = MD && MD.kind === 'hand';
  const LK = MD && !hand ? linkOf(D.drive) : null, JN = (D.drive && D.drive.join) || 'dcut', FZ = D.drive && D.drive.fasten === 'insert';
  if (LK === 'direct') {   // 입력 기어 구멍을 모터 축 모양으로 (서보는 중심 나사 구멍, 스플라인은 아래 허브에)
    const sh = MD.shaft; D.shafts[D.input].mBore = isServo(MD) ? { d: MD.servo.center, dcut: 0 } : { d: +(sh.d + 0.15).toFixed(2), dcut: sh.dcut ? +(sh.dcut - 0.05).toFixed(2) : 0, dd: !!sh.dd };
  } else delete D.shafts[D.input].mBore;
  // 축과 기어 결합: D컷(기본) / 압입(둥근 축, 구멍 -0.05) / 멈춤나사(D컷 + 출력 기어 허브에 M3 무두볼트) / 스냅링(D컷 + E링)
  D.shafts.forEach((s, i) => { delete s.jBore; if (D.drive && JN === 'press' && s.fixed && !(LK === 'direct' && i === D.input)) s.jBore = { d: +(s.d - 0.05).toFixed(2), dcut: 0 }; });
  // 중간축·아이들러 지지: 고정 핀 위에서 기어가 돎. 부싱/베어링을 고르면 기어 구멍을 그 바깥지름으로 키움
  const sup = (D.drive && D.drive.support) || 'pin', supInfo = [];
  D.shafts.forEach((s, i) => {
    delete s.supBore; if (s.fixed || sup === 'pin' || !D.drive) return;
    const rf = Math.min(...D.gears.filter(g => g.shaft === i).map(g => gearOutlineInfo(g).rf));
    const br = BEARINGS[Math.round(s.d)], h = Math.max(...D.gears.filter(g => g.shaft === i).map(g => g.zpos + g.b)) - Math.min(...D.gears.filter(g => g.shaft === i).map(g => g.zpos));
    if (sup === 'bear' && br && Math.abs(s.d - Math.round(s.d)) < 0.01 && rf - (br[1] + 0.1) / 2 >= 1.5 && h >= br[2]) {
      s.supBore = { d: br[1] + 0.1, dcut: 0 }; supInfo[i] = { kind: 'bear', name: br[0], n: h >= 2 * br[2] ? 2 : 1, OD: br[1], B: br[2] };
    } else if (rf - (s.d + 2.1) / 2 >= 1.5) { s.supBore = { d: s.d + 2.1, dcut: 0 }; supInfo[i] = { kind: 'bush', OD: s.d + 2, L: h }; }
  });
  const mm = MD && !hand ? motorMount(D, parts) : null, dIn = mm && mm.link === 'direct';
  parts.forEach(p => {
    const s = D.shafts[p.shaft];
    model.parts.push({ name: p.name, file: `${p.name}_${p.gears.map(i => D.gears[i].name + 'z' + D.gears[i].z).join('+')}_${s.role}`,
      tris: partTris(D, p, kin.phase), motion: t => XF.mul(XF.T(s.x, s.y, p.z0), XF.Rz(kin.w[p.shaft] * t)) });
  });
  const zTop = D.box ? D.box.D : Math.max(...D.gears.map(g => g.zpos + g.b));
  D.shafts.forEach((s, i) => {
    const out = s.role === 'input' || s.role === 'output';
    if (dIn && i === D.input) { const z = isServo(MD) ? MD.servo.top : 0; model.rods.push({ a: [s.x, s.y, z], b: [s.x, s.y, z + MD.shaft.len], d: MD.shaft.d, role: s.role }); return; }
    if (mm && i === D.input) { model.rods.push({ a: [s.x, s.y, mm.inputPin.z0], b: [s.x, s.y, zTop], d: s.d, role: s.role }); return; }
    model.rods.push({ a: [s.x, s.y, D.box ? 0 : -3], b: [s.x, s.y, zTop + (out ? 12 : 0) + (D.box ? 0 : 3)], d: s.d, role: s.role });
  });
  let hs = null;
  if (D.box) {
    const w = D.box.wall, holes = [], boss = [];
    D.shafts.forEach((s, i) => {
      const br = bearingFor(D, s, i);
      ['floor', 'lid'].forEach(face => {
        let d = br ? br.OD + 0.15 : s.d + (s.fixed ? 0.4 : 0.05);
        if (dIn && i === D.input && face === 'floor') { if (!mm.inputFloor) return; d = mm.inputFloor; }
        holes.push({ face, u: s.x, v: s.y, d: +d.toFixed(3) });
        if (br && br.B > w + 0.01) boss.push({ face, x: s.x, y: s.y, ro: br.OD / 2 + 2, ri: (br.OD + 0.15) / 2, h: br.B - w });
      });
      if (br) model.notes.push(`${roleKo(s.role)}: 베어링 ${br.name} (안지름 ${s.d}, 바깥 ${br.OD}, 폭 ${br.B} mm)을 바닥과 덮개 구멍에 하나씩 눌러 끼웁니다. 구멍은 바깥지름 +0.15 mm${br.B > w ? `, 벽보다 두꺼운 만큼(${fmt(br.B - w, 1)} mm) 바깥으로 받침이 튀어나옵니다` : ''}.`);
    });
    if (mm) { mm.holes.forEach(h => holes.push({ face: 'floor', u: +h.x.toFixed(3), v: +h.y.toFixed(3), d: h.d })); mm.polys.forEach(R => holes.push({ face: 'floor', pts: R.map(q => [+q[0].toFixed(3), +q[1].toFixed(3)]) })); }
    const fix = D.drive ? housingFix(D, mm, MD) : null;
    if (fix) fix.posts.forEach(([x, y]) => holes.push({ face: 'lid', u: x, v: y, d: 3.4 }));
    const h = boxHousing(D.box, holes);
    if (fix) {
      fix.posts.forEach(([x, y]) => { h.body = h.body.concat(moveTris(extrudeTris(circlePts(FZ ? 4.5 : 3.5, 32, x, y), [circlePts(FZ ? 2.0 : 1.3, 20, x, y)], D.box.D - 2 * w), 0, 0, w)); });
      fix.ears.forEach(e => { h.body = h.body.concat(earTris(e, w)); });
      if (fix.legH) fix.ears.forEach((e, k) => model.housing.push({ name: '받침 다리', file: `leg_${k + 1}_h${fix.legH}`, tris: moveTris(extrudeTris(circlePts(5, 32, e.c[0], e.c[1]), [circlePts(2.3, 24, e.c[0], e.c[1])], fix.legH), 0, 0, -fix.legH), print: XF.T(0, 0, fix.legH) }));
    }
    const ring = b => extrudeTris(circlePts(b.ro, 48, b.x, b.y), [circlePts(b.ri, 32, b.x, b.y)], b.h);
    boss.forEach(b => { if (b.face === 'floor') h.body = h.body.concat(moveTris(ring(b), 0, 0, -b.h)); else h.lid = h.lid.concat(moveTris(ring(b), 0, 0, w)); });
    model.housing.push({ name: '하우징 본체', file: 'housing_body', tris: h.body }, { name: '덮개', file: 'housing_lid', tris: xfTris(h.lid, XF.T(0, 0, D.box.D - D.box.wall)), print: XF.T(0, 0, -(D.box.D - D.box.wall)) });
    const hbOf = i => { const b = boss.find(q => q.face === 'floor' && D.shafts[i].x === q.x && D.shafts[i].y === q.y); return b ? b.h : 0; };
    const topH = i => { const b = boss.find(q => q.face === 'lid' && D.shafts[i].x === q.x && D.shafts[i].y === q.y); return b ? b.h : 0; };
    const pinLen = model.pinLen = {};
    D.shafts.forEach((s, i) => { if (dIn && i === D.input) return;
      if (mm && i === D.input) { pinLen[i] = +(D.box.D + topH(i) - mm.inputPin.z0).toFixed(1);
        model.housing.push({ name: '입력축', file: `shaft_${i + 1}_input_d${s.d}D_L${fmt(pinLen[i], 0)}`, tris: extrudeTris(borePts(s.d - 0.05, 0.55, 40), [], pinLen[i]), assembly: false }); return; }
      const ex = hbOf(i) + (hand && i === D.input && D.drive && !(Math.hypot(s.x - D.shafts[D.output].x, s.y - D.shafts[D.output].y) > MD.arm + 5 + s.d / 2 + 14) ? 12 : 0);
      pinLen[i] = D.box.D + (s.fixed ? 12 : 0) + ex;
      model.housing.push({ name: '축 핀', file: `shaft_${i + 1}_${s.role}_d${s.d}${s.fixed ? 'D' : ''}_L${fmt(pinLen[i], 0)}`, tris: pinTris(D, s, TRI2D, ex), assembly: false }); });
    const hs0 = {};
    if (D.drive) {
      // 축 칼라(스페이서): 기어 부품 위아래 빈틈을 메워 기어가 축 방향으로 밀리거나 빠지지 않게 함 (0.3 mm 여유)
      model.shaftRows = [];
      parts.forEach(p => {
        const s = D.shafts[p.shaft], i = p.shaft, top = Math.max(...p.gears.map(k => D.gears[k].zpos + D.gears[k].b));
        const rf = Math.min(...p.gears.map(k => gearOutlineInfo(D.gears[k]).rf)), br = bearingFor(D, s, i);
        const ro = Math.min(rf - 0.6, br ? s.d / 2 + 1.6 : s.d / 2 + 3), ri = s.d / 2 + 0.2;
        const sp = [];
        if (!(dIn && i === D.input)) sp.push([D.box.wall, p.z0 - D.box.wall - 0.3]); else sp.push([0, 0]);
        sp.push([top + 0.3, D.box.D - D.box.wall - top - 0.3]);
        if (JN === 'setscrew' && i === D.output) {   // 출력 기어에 멈춤나사 블록: 나사가 축의 D컷 평면을 누름
          let done = false;
          for (const k of sp[0][1] >= sp[1][1] ? [0, 1] : [1, 0]) {
            const gap = sp[k][1] + 0.3, hh = Math.min(8, gap - 0.3), zb = k === 0 ? -hh : top - p.z0, za = p.z0 + zb;
            let rA = rf - 0.6; D.gears.forEach(g => { if (g.shaft === i || g.zpos > za + hh || g.zpos + g.b < za) return; const q = D.shafts[g.shaft]; rA = Math.min(rA, Math.hypot(q.x - s.x, q.y - s.y) - gearOutlineInfo(g).ra - 0.4); });
            const bo = boreOf(s), f = bo.d / 2 - bo.dcut, a = Math.min(rA / Math.SQRT2, f + 5);
            if (!(hh >= 5 && a - f >= 2.8)) continue;
            const ph = kin.phase[p.gears[0]], t = setscrewTris(bo.d, bo.dcut, a, hh);
            const mp = model.parts.find(q => q.name === p.name); mp.tris = mp.tris.concat(moveTris(t, 0, 0, zb, ph));
            sp[k] = k === 0 ? [sp[0][0], sp[0][1] - hh] : [sp[1][0] + hh, sp[1][1] - hh];
            (hs0.set = hs0.set || []).push({ part: parts.indexOf(p), z: +(zb).toFixed(3), a: +a.toFixed(3), hh: +hh.toFixed(3), ph: +(ph * 180 / PI).toFixed(3) });
            model.setscrew = done = true; break;
          }
          if (!done) model.setscrewFail = true;
        }
        sp.forEach(([z, h], k) => {
          // 다른 축 기어가 이 높이에서 지나가면 칼라를 그만큼 가늘게
          let r = ro;
          D.gears.forEach(g => { if (g.shaft === i || g.zpos > z + h || g.zpos + g.b < z) return;
            const q = D.shafts[g.shaft]; r = Math.min(r, Math.hypot(q.x - s.x, q.y - s.y) - gearOutlineInfo(g).ra - 0.4); });
          if (h < 0.6 || r - ri < 0.8) return;
          const t = extrudeTris(circlePts(r, 40), [circlePts(ri, 32)], +h.toFixed(2));
          model.parts.push({ name: '칼라', file: `collar_${p.name}_${k ? 'top' : 'bottom'}_h${fmt(h, 1)}`, tris: t, motion: () => XF.T(s.x, s.y, z), collar: true }); });
        const SI = supInfo[i];
        const jtxt = JN === 'press' ? '압입(구멍 −0.05 mm)으로 헛돌지 않음' : JN === 'setscrew' && i === D.output ? 'D컷 + M3 멈춤나사' : 'D컷으로 헛돌지 않음';
        model.shaftRows.push([`${p.name} ${roleKo(s.role)}`,
          dIn && i === D.input ? (isServo(MD) ? `서보 스플라인 ${MD.shaft.d} mm에 눌러 끼우고 중심 나사로 고정` : `모터 축 ${MD.shaft.d} mm ${MD.shaft.dd ? '양쪽 D컷' : MD.shaft.dcut ? 'D컷' : '둥근 축(접착 권장)'}에 직접 끼움`)
            : `${s.d} mm ${s.fixed ? (s.jBore ? '둥근' : 'D컷') + ' 축, 길이 ' + fmt(pinLen[i], 0) + ' mm (금속축 권장)' : '고정 핀, 길이 ' + fmt(D.box.D, 0) + ' mm'}${mm && i === D.input ? (mm.link === 'coupling' ? ' · 아래 끝이 커플링으로 모터와 연결' : ' · 아래 끝에 GT2 풀리, 벨트로 모터와 연결') : ''}`,
          s.fixed ? (dIn && i === D.input ? (isServo(MD) ? '서보 내부 베어링이 받침' : '모터 베어링이 받침') : br ? `베어링 ${br.name} ×2 (바닥·덮개)` : '하우징 구멍(+0.4 mm)이 받침') : SI ? (SI.kind === 'bear' ? `기어 안 베어링 ${SI.name} ×${SI.n}` : `황동 부싱 ${s.d}×${fmt(SI.OD, 0)} mm, 길이 ${fmt(SI.L, 1)} mm`) : '기어가 핀 위에서 돎 (+0.35 mm)',
          s.fixed ? `${jtxt} · 칼라로 빠짐 방지${JN === 'snap' ? ' · 하우징 밖 E링 2개' : ''}` : '칼라로 높이 고정']);
      });
      model.notes.push('칼라(collar_*)는 기어 위아래 빈틈을 메우는 고리입니다. 기어를 축에 끼운 뒤 위아래에 끼우면 기어가 밀리거나 빠지지 않습니다.');
      if (sup !== 'pin' && supInfo.some(x => x && x.kind === 'bush')) model.notes.push('중간축 기어 구멍은 황동 부싱 바깥지름 +0.1 mm라 부싱을 눌러 끼웁니다. 부싱이 없으면 같은 크기로 출력한 관을 써도 됩니다.');
    }
    model.notes.push(mm ? `입력 기어 구멍은 모터 축(${MD.shaft.d} mm${MD.shaft.dd ? ' 양쪽 D컷' : MD.shaft.dcut ? ' D컷' : ''})에 맞췄습니다. 출력 기어 구멍은 D컷(0.5 mm 평면)이라 축과 함께 돕니다.` : '입력·출력 기어 구멍은 D컷(0.5 mm 평면)이라 축과 함께 돕니다. 하우징의 해당 축 구멍은 +0.4 mm로 헐겁게 잡혀 있습니다.', '나머지 축은 하우징에 끼워 고정(+0.05 mm)되고, 기어가 축 위에서 +0.35 mm 여유로 돕니다.');
    hs = { holes, boss, fix, set: hs0.set, fasten: FZ };
    if (mm) {
      model.extras.push(...mm.extras); model.housing.push(...mm.housing);
      const sIn = D.shafts[D.input];
      mm.parts.forEach(q => model.parts.push({ name: q.name, file: q.file, tris: q.tris, motion: t => XF.mul(XF.T(q.x, q.y, q.z), XF.Rz(kin.w[D.input] * t)) }));
      model.notes.push(mm.link === 'coupling' ? `모터는 간격 기둥 ${mm.holes.length}개(높이 ${mm.Hb} mm)로 바닥 아래에 매달고, 커플링이 모터 축과 입력축을 잇습니다. 입력축은 바닥·덮개 베어링이 받칩니다.`
        : mm.link === 'belt' ? `모터는 입력축에서 ${fmt(mm.belt.C, 1)} mm 떨어진 곳에 간격 기둥 ${mm.holes.length}개로 매달고, GT2 벨트(둘레 ${mm.belt.L} mm)로 입력축 풀리를 돌립니다 (1:1). 벨트 보호 덮개를 꼭 끼우세요.`
        : mm.mount === 'clamp' ? `모터 몸통을 클램프에 끼우고 M3 나사로 조입니다. 클램프는 M3 나사 2개로 바닥 밑면에 붙습니다.`
        : mm.mount === 'servo' ? `서보 몸통을 바닥 사각 구멍에 아래에서 끼우고 귀를 ${MD.servo.screwName} 나사로 고정합니다. 입력 기어 아래 허브가 서보 스플라인에 끼워지고, 서보 중심 나사가 기어를 붙잡습니다.`
        : `모터는 바닥 밑면에 붙고, ${MD.screwName} 나사 ${mm.holes.length}개를 하우징 안쪽에서 끼워 고정합니다. 모터 몸체가 상자 아래로 약 ${fmt(MD.body.L, 0)} mm 나옵니다.`);
      hs.motor = { name: MD.short, acc: mm.parts.concat(mm.housing) };
    }
    if (JN === 'snap') model.notes.push('스냅링: 금속 축의 바닥 아래·덮개 위 자리에 E링 홈(축 지름의 80%, 폭 0.7 mm)을 내고 E링을 끼워 축이 빠지지 않게 합니다.');
    if (model.setscrewFail) model.notes.push('출력 기어 둘레에 멈춤나사 블록을 넣을 공간이 없어 D컷만 씁니다.');
    let hubZ = null;
    if (D.drive) {   // 출력 허브
      const so = D.shafts[D.output]; hubZ = D.box.D + topH(D.output) + 0.5 + (JN === 'snap' ? 1 : 0);
      model.parts.push({ name: '출력 허브', file: `output_hub_d${so.d}`, tris: outHubTris(so.d), motion: t => XF.mul(XF.T(so.x, so.y, hubZ), XF.Rz(kin.w[D.output] * t)) });
      hs.hub = { d: so.d };
      model.notes.push('출력 허브(output_hub_*)는 덮개 위로 나온 출력축에 끼우고, 플랜지의 M3 구멍 4개로 바퀴·팔·풀리를 붙입니다.');
    }
    if (hand) {
      const s = D.shafts[D.input], si = D.shafts[D.output], far = Math.hypot(s.x - si.x, s.y - si.y) > MD.arm + 5 + s.d / 2 + 13 + 1;
      const zc = D.box.D + topH(D.input) + 0.5 + (hubZ !== null && !far ? 12 : 0);
      if (hubZ !== null && !far) model.notes.push('크랭크가 출력 허브 위로 지나가도록 입력축을 12 mm 더 길게 잡았습니다.');
      const att = MD.att || 'crank', ct = att === 'crank' ? crankTris(s.d, 0.5, MD.arm) : att === 'wheel' ? wheelTris(s.d, 0.5, MD.arm) : flangeTris(s.d, 0.5);
      const an = { crank: '크랭크', wheel: '핸드휠', flange: '동력 연결 플랜지' }[att];
      model.parts.push({ name: an, file: att === 'crank' ? `crank_arm${MD.arm}_d${s.d}` : att === 'wheel' ? `handwheel_d${2 * MD.arm}_s${s.d}` : `input_flange_d${s.d}`, tris: ct, motion: t => XF.mul(XF.T(s.x, s.y, zc), XF.Rz(kin.w[D.input] * t)) });
      model.notes.push(att === 'flange' ? `${MD.short}: 덮개 위로 나온 입력축에 동력 연결 플랜지를 끼우고 ${MD.src}을(를) 플랜지에 고정합니다.${MD.note ? ' ' + MD.note : ''}` : `${an}는 덮개 위로 나온 입력축(D컷 핀)에 끼웁니다. ${att === 'wheel' ? `지름 ${2 * MD.arm}` : `팔 길이 ${MD.arm}`} mm.`);
      if (att === 'crank') hs.crank = { d: s.d, arm: MD.arm };
    }
  }
  model.checks = analyze(D, kin);
  if (mm) {
    mm.problems.forEach(t => model.checks.push({ st: 'bad', txt: t }));
    const LKO = { direct: mm.mount === 'clamp' ? '클램프 직접 장착' : mm.mount === 'servo' ? '서보 직결' : '앞면 나사 직접 장착', coupling: '커플링 연결', belt: '타이밍벨트 연결' }[mm.link];
    if (!mm.problems.length) model.checks.push({ st: 'ok', txt: `${LKO}: 고정 나사 ${mm.holes.length}개가 바닥 안쪽에 들어갑니다` });
    const e = mm.engage, lim = isServo(MD) ? [2.5, 1.8] : [4, 2.5], what = mm.link === 'coupling' ? '커플링' : mm.link === 'belt' ? '모터 풀리' : '입력 기어';
    model.checks.push({ st: e >= lim[0] ? 'ok' : e >= lim[1] ? 'warn' : 'bad', txt: `모터 축이 ${what}에 <em>${fmt(e, 1)} mm</em> 물립니다${e < lim[0] ? ` (${lim[0]} mm 이상 권장${mm.link === 'direct' ? ': 벽을 얇게 하세요' : ''})` : ''}` });
    if (D.drive.link && D.drive.link !== 'direct' && mm.link === 'direct' && !isServo(MD)) model.checks.push({ st: 'warn', txt: `${MD.short}는 나사 자리가 축에 너무 가까워 커플링·벨트 연결 대신 직접 장착으로 만들었습니다` });
    if (D.drive.mount === 'clamp' && mm.mount !== 'clamp' && !isServo(MD)) model.checks.push({ st: 'warn', txt: `${MD.short}는 원통형 몸통이 아니어서 클램프 대신 앞면 나사로 고정합니다` });
  }
  if (D.drive && D.box) {
    model.checks.push(...strengthChecks(D, kin));
    const fx = hs.fix, nB = {}, w = D.box.wall;
    model.checks.push({ st: fx.posts.length >= 3 ? 'ok' : fx.posts.length ? 'warn' : 'bad', txt: fx.posts.length ? `덮개 나사 기둥 <em>${fx.posts.length}개</em>${fx.posts.length < 3 ? ' (3개 이상 권장: 공간을 조금 넓히세요)' : ''}` : '덮개 나사 기둥을 세울 빈자리가 없습니다. 공간을 넓히세요' });
    model.checks.push({ st: fx.ears.length >= 2 ? 'ok' : 'warn', txt: `설치 귀(M4 구멍) <em>${fx.ears.length}개</em>${fx.legH ? ` · 모터가 아래로 나오므로 받침 다리 ${fx.ears.length}개(높이 ${fx.legH} mm)` : ''}` });
    D.shafts.forEach((q, i) => { const br = bearingFor(D, q, i); if (br) nB[br.name] = (nB[br.name] || 0) + 2; });
    const bom = [];
    if (MD.kind === 'hand' && MD.att === 'flange') bom.push([MD.name, 1, `외부 동력: ${MD.src}을(를) 입력 플랜지에 고정`], ['M3×10 나사 + 너트 (플랜지)', 4, '']);
    if (MD.kind !== 'hand') { bom.push([MD.name, 1, '']); if (MD.driver !== 'servo') bom.push([({ A4988: 'A4988 드라이버', ULN2003: 'ULN2003 드라이버 보드', TB6612FNG: 'TB6612FNG 드라이버' })[MD.driver], 1, '']);
      bom.push(...powerRows(MD)); }
    Object.entries(nB).forEach(([k, n]) => bom.push([`베어링 ${k}`, n, '바닥·덮개 구멍에 눌러 끼움']));
    D.shafts.forEach((q, i) => { if (dIn && i === D.input) return; if (q.fixed) bom.push([`${q.jBore ? '둥근' : 'D컷'} 금속축 Ø${q.d}`, 1, `길이 ${fmt(model.pinLen[i], 0)} mm로 잘라 쓰기 (또는 출력한 핀)`]); });
    const pinN = D.shafts.filter(q => !q.fixed).length; if (pinN) bom.push([`축 핀 Ø${D.shafts.find(q => !q.fixed).d} (금속봉 또는 출력)`, pinN, `길이 ${fmt(D.box.D, 0)} mm`]);
    D.shafts.forEach((q, i) => { const sb = q.supBore; if (sb && !q.fixed) bom.push([sb.d > q.d + 3 ? `베어링 (기어 안)` : `황동 부싱 ${q.d}×${q.d + 2}`, 1, '기어 구멍에 눌러 끼움']); });
    if (mm) bom.push(...mm.bom);
    if (fx.posts.length) bom.push(['M3 나사 (덮개)', fx.posts.length, FZ ? `길이 ${fmt(w + 6, 0)} mm, 기둥의 인서트 너트에 조임` : `길이 ${fmt(w + 8, 0)} mm 정도, 기둥 구멍에 바로 조임(셀프 태핑)`]);
    if (FZ && fx.posts.length) bom.push(['M3 인서트 너트 (바깥 4 mm, 길이 5~6 mm)', fx.posts.length, '납땜 인두로 기둥 윗구멍에 녹여 넣음']);
    if (model.setscrew) bom.push(['M3×4 무두볼트 (멈춤나사)', 1, '출력 기어 블록 구멍(2.5 mm)에 직접 탭을 내며 조임']);
    if (JN === 'snap') bom.push([`E링 (축 Ø${D.shafts[D.output].d})`, D.shafts.filter(q => q.fixed).length * 2 - (dIn ? 2 : 0), '하우징 밖 축 홈에']);
    if (fx.ears.length) bom.push(['M4 나사 (설치)', fx.ears.length, fx.legH ? `받침 다리를 지나 바닥판에 고정, 길이 ${fx.legH + w + 8} mm 이상` : '']);
    bom.push(['M3 나사 (출력 허브에 물건 고정)', 4, ''], ['그리스 (리튬 또는 PTFE)', 1, '기어 이에 얇게']);
    model.bom = bom;
    model.steps = ['공차 시험편(test/fit_test.stl)을 먼저 뽑아 축·베어링이 맞는 구멍을 확인하고, 안 맞으면 "치면 여유"나 축 지름을 고쳐 다시 내보냅니다.',
      Object.keys(nB).length ? '베어링을 바닥과 덮개 구멍에 눌러 끼웁니다 (바이스나 평평한 판으로 천천히).' : '하우징 본체와 덮개를 출력합니다.',
      !mm ? '입력축(D컷)을 바닥 구멍에 꽂습니다.' : mm.link === 'coupling' ? `커플링을 모터 축에 끼우고, 모터를 간격 기둥 ${mm.holes.length}개와 긴 ${MD.screwName} 나사로 바닥 아래에 매답니다.` : mm.link === 'belt' ? `모터 풀리를 모터 축에 끼우고, 벨트 보호 덮개를 끼운 채 모터를 간격 기둥과 긴 ${MD.screwName} 나사로 바닥 아래에 매답니다.` : mm.mount === 'clamp' ? '클램프를 바닥 밑면에 나사 2개로 붙이고, 모터를 밑에서 끝까지 밀어 넣은 뒤 클램프 나사를 조입니다.' : mm.mount === 'servo' ? `서보를 바닥 사각 구멍에 밑에서 끼우고 귀를 ${MD.servo.screwName} 나사로 고정합니다. 서보를 가운데 위치(1500 µs 정지)에 둡니다.` : `모터를 바닥 밑면에 대고 ${MD.screwName} 나사 ${mm.holes.length}개로 안쪽에서 조입니다.`,
      '축 핀을 꽂고, 아래 칼라 → 기어 → 위 칼라 순서로 끼웁니다. 기어 이에 그리스를 얇게 바릅니다.' + (model.setscrew ? ' 출력 기어 블록의 멈춤나사는 축 평면을 향하게 해서 조입니다.' : ''),
      !mm ? '크랭크를 입력축 윗부분에 끼웁니다.' : mm.link === 'coupling' ? '입력축 아래 끝을 커플링에 끼웁니다 (평면을 맞추어).' : mm.link === 'belt' ? '입력축 아래 끝에 입력 풀리를 끼우고 벨트를 두 풀리에 겁니다.' : isServo(MD) ? '입력 기어 아래 허브를 서보 스플라인에 눌러 끼우고 중심 나사를 조입니다.' : '입력 기어를 모터 축에 끝까지 밀어 끼웁니다 (평면을 맞추어).',
      (FZ ? '덮개 기둥에 인서트 너트를 인두로 넣고, ' : '') + '덮개를 덮고 M3 나사로 기둥에 조입니다. 손으로 돌려 걸림이 없는지 확인합니다.' + (JN === 'snap' ? ' 축 홈에 E링을 끼웁니다.' : ''),
      '출력 허브를 출력축에 끼우고 바퀴·팔·풀리를 M3 나사로 붙입니다.'];
    if (MD.kind !== 'hand') model.steps.push('배선표대로 연결하고(전원은 마지막에), 아두이노 코드를 올린 뒤 시리얼 모니터에서 s / r 로 시험합니다.', '처음엔 부하 없이 돌려 소리·발열을 보고, 그다음 부하를 겁니다. NEMA17처럼 뜨거워지는 모터 쪽 부품은 PETG를 권장합니다.');
    model.fitTest = fitTestTris(D.shafts[D.output].d, (BEARINGS[Math.round(D.shafts[D.output].d)] || [])[1]);
  }
  model.interference = () => interference(D, kin);
  model.scad = () => scadSource(D, kin, parts, hs);
  const partOf = {}; parts.forEach((p, k) => p.gears.forEach(gi => partOf[gi] = k));
  model.table = {
    head: ['기어', '종류', '축', 'z', 'm', 'α', 'x', '피치원 d', '이끝원', '이뿌리원', '폭 b', '구멍', 'rpm'],
    rows: D.gears.map((g, i) => { const I = gearOutlineInfo(g), s = D.shafts[g.shaft], bo = boreOf(s);
      return { part: partOf[i], cells: [g.name, gearKindKo(g), roleKo(s.role), g.z, g.m, g.pa + '°', fmt(g.x, 3), fmt(I.r * 2, 2), fmt(I.ra * 2, 2), fmt(I.rf * 2, 2), fmt(g.b, 2), fmt(bo.d, 2) + (bo.dcut ? ' D' : ''), fmt(rpmOf(kin.w[g.shaft]), 1)] }; })
  };
  const wIn = kin.w[D.input], wOut = kin.w[D.output];
  model.hud = [['입력', fmt(D.rpm, 1) + ' rpm']];
  if (D.gears.length > 1) model.hud.push(['출력', fmt(rpmOf(wOut), 2) + ' rpm'], ['변속비', ratioTxt(Math.abs(wIn / wOut))]);
  if (D.summary && D.summary.m) model.hud.push(['모듈', D.summary.m], ['단수', D.summary.n + (D.summary.idler ? ' + 아이들러' : '')]);
  model.single = D.gears.length < 2;
  return model;
}

const SPIRAL_NOTE = '스파이럴 베벨은 직선 베벨 치형을 원호 모양으로 비틀어 만든 근사형입니다 (실제 글리슨 치형과 다름). 물림이 겹쳐 조용하고 부드럽지만, 축 방향으로 미는 힘이 생기니 축을 꼭 받쳐 주세요. 맞물리는 두 기어는 나선 방향이 반대입니다.';
function bevelModel(D) {
  const delta1 = Math.atan2(D.z1, D.z2), delta2 = PI / 2 - delta1;
  const g1 = { name: 'B1', m: D.m, z: D.z1, pa: D.pa, backlash: D.backlash, delta: delta1, F: D.F, bore: D.bore1, dcut: D.dcut1, hub: D.hub, spiral: D.spiral || 0 };
  const g2 = { name: 'B2', m: D.m, z: D.z2, pa: D.pa, backlash: D.backlash, delta: delta2, F: D.F, bore: D.bore2, dcut: D.dcut2, hub: D.hub, spiral: -(D.spiral || 0) };
  const B1 = bevelInfo(g1), B2 = bevelInfo(g2);
  // 기어1은 수직축(Z, 바닥 통과), 기어2는 수평축(X, 오른쪽 벽 통과). D.input: 어느 쪽이 입력인지 (1|2)
  const inp = D.input || 1, wIn = D.rpm * 2 * PI / 60;
  const [Ox, Oy, Oz] = D.O, w1 = inp === 1 ? wIn : -wIn * D.z2 / D.z1, w2 = -w1 * D.z1 / D.z2;
  const role = i => i === inp ? 'input' : 'output', wOut = inp === 1 ? w2 : w1;
  const ph2 = PI / D.z2;
  // 기어1: 축 +Z (꼭짓점이 O) / 기어2: 축 -X (지역 x→-Z, y→-Y, z→-X)
  const M1 = XF.T(Ox, Oy, Oz - B1.H);
  const M2 = XF.basis([0, 0, -1], [0, -1, 0], [-1, 0, 0], [Ox + B2.H, Oy, Oz]);
  const model = { kind: 'bevel', housing: [], rods: [], notes: [] };
  model.parts = [
    { name: 'B1', file: `B1_bevel_z${D.z1}_${role(1)}`, tris: bevelTris(g1), motion: t => XF.mul(M1, XF.Rz(w1 * t)) },
    { name: 'B2', file: `B2_bevel_z${D.z2}_${role(2)}`, tris: bevelTris(g2), motion: t => XF.mul(M2, XF.Rz(ph2 + w2 * t)) },
  ];
  const box = D.box;
  const r1top = Oz - B1.H + B1.zt + B1.hub, r2end = Ox + B2.H - B2.zt - B2.hub;
  model.rods.push({ a: [Ox, Oy, box ? -12 : Oz - B1.H - 12], b: [Ox, Oy, r1top], d: D.shaftD, role: role(1) });
  model.rods.push({ a: [r2end, Oy, Oz], b: [box ? box.W + 12 : Ox + B2.H + 12, Oy, Oz], d: D.shaftD, role: role(2) });
  if (box) {
    const h = boxHousing(box, [{ face: 'floor', u: Ox, v: Oy, d: D.shaftD + 0.4 }, { face: '+x', u: Oy, v: Oz, d: D.shaftD + 0.4 }]);
    model.housing.push({ name: '하우징 본체', file: 'housing_body', tris: h.body }, { name: '덮개', file: 'housing_lid', tris: xfTris(h.lid, XF.T(0, 0, box.D - box.wall)), print: XF.T(0, 0, -(box.D - box.wall)) });
    model.notes.push(`${inp === 1 ? '입력' : '출력'}축은 바닥을, ${inp === 1 ? '출력' : '입력'}축은 오른쪽(+X) 벽을 통과합니다. 두 기어 구멍은 D컷이라 축과 함께 돕니다.`, '두 축이 꼭짓점에서 만나므로 각 축은 기어 앞쪽 허브까지만 들어갑니다. 축 끝이 흔들리면 벽 구멍 쪽에 칼라나 베어링을 덧대세요.');
  }
  // 검사
  const checks = [];
  const ratio = inp === 1 ? D.z2 / D.z1 : D.z1 / D.z2;
  let st = 'ok', txt = `변속비(입력:출력) <em>${ratioTxt(ratio)}</em> · 출력 <em>${fmt(rpmOf(wOut), 1)} rpm</em> · 축 방향 <em>${inp === 1 ? 'Z → X' : 'X → Z'} (90°)</em>`;
  if (D.target) { const err = Math.abs(ratio - D.target.ratio) / D.target.ratio * 100; txt += ` · 목표 대비 <em>${err.toFixed(2)}%</em>`; if (err > D.target.tol + 1e-6) st = 'warn'; }
  checks.push({ st, txt });
  const mv = meshGeom(B1.v, B2.v);
  checks.push({ st: mv.eps >= 1.2 ? 'ok' : mv.eps >= 1.05 ? 'warn' : 'bad', txt: `B1–B2 등가 평기어 물림률 <em>${mv.eps.toFixed(2)}</em>${spiralTxt(g1)} · 원추거리 <em>${fmt(B1.A, 2)} mm</em> · 피치각 <em>${fmt(delta1 / D2R, 2)}° / ${fmt(delta2 / D2R, 2)}°</em>` });
  if (D.F > B1.A / 3 + 1e-6) checks.push({ st: 'warn', txt: `이 폭 ${fmt(D.F, 2)} mm가 원추거리의 1/3(${fmt(B1.A / 3, 2)} mm)을 넘습니다. 앞쪽 이가 너무 작아집니다.` });
  [[g1, B1], [g2, B2]].forEach(([g, B]) => {
    if (g.bore > 0 && B.k * B.rf - g.bore / 2 < 1.2) checks.push({ st: 'bad', txt: `${g.name}: 앞쪽(toe) 이뿌리가 축 구멍에 너무 가깝습니다. 이 폭을 줄이거나 모듈을 키우세요.` });
    const zv = B.v.z, lim = 2 / Math.sin(g.pa * D2R) ** 2;
    if (zv < lim - 0.5) checks.push({ st: 'warn', txt: `${g.name}: 등가 잇수 ${zv.toFixed(1)}가 언더컷 한계(${lim.toFixed(1)})보다 작습니다. 잇수를 늘리거나 압력각 25°를 쓰세요.` });
  });
  if (box) {
    const c = 0, { W, H, D: Dd, wall } = box;
    const ok = Ox - B1.ra >= wall - 1e-6 && Ox + B2.H <= W - wall + 1e-6 && Oy - Math.max(B1.ra, B2.ra) >= wall - 1e-6 && Oy + Math.max(B1.ra, B2.ra) <= H - wall + 1e-6 &&
      Oz - B1.H >= wall - 1e-6 && Oz - B2.ra >= wall - 1e-6 && Oz + B2.ra <= Dd - wall + 1e-6 + c;
    checks.push({ st: ok ? 'ok' : 'bad', txt: ok ? `상자 <em>${W}×${H}×${Dd} mm</em> 안에 두 기어가 들어갑니다` : '일부 기어가 상자 벽을 넘습니다' });
  }
  model.checks = checks;
  // 간섭: 맞물림 부근 점을 뿌려 두 기어 안에 동시에 들어가는 점이 있는지 한 피치 동안 검사
  model.interference = (steps = 24) => {
    const BB = [B1, B2], heels = [bevelHeel(g1), bevelHeel(g2)], T = (2 * PI / D.z1) / Math.abs(w1);
    const twA = [bevelTwist(g1), bevelTwist(g2)];
    const inside = (i, Xi, w) => { const p = XF.apply(Xi, w), b = BB[i]; if (p[2] < 0 || p[2] > b.zt) return false; const s = b.H / (b.H - p[2]), q = twA[i] ? rot2([p[0], p[1]], -twA[i](Math.hypot(p[0], p[1]), p[2])) : p; return pointInPoly(q[0] * s, q[1] * s, heels[i]); };
    let hits = 0, seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < steps; k++) {
      const t = T * k / steps, Xi = [XF.inv(model.parts[0].motion(t)), XF.inv(model.parts[1].motion(t))];
      let hit = false;
      for (let i = 0; i < 4000 && !hit; i++) {
        const u = rnd(), cx = Ox + B1.r * (1 - u / 2.6), cz = Oz - B2.r * (1 - u / 2.6);
        const w = [cx + (rnd() - 0.5) * 4 * D.m, Oy + (rnd() - 0.5) * 4 * D.m, cz + (rnd() - 0.5) * 4 * D.m];
        if (inside(0, Xi[0], w) && inside(1, Xi[1], w)) hit = true;
      }
      if (hit) hits++;
    }
    return [{ pair: 'B1–B2', hits, steps }];
  };
  model.table = {
    head: ['기어', '종류', '축', 'z', 'm', 'α', '피치각 δ', '피치원 d', '이끝원', '원추거리', '폭 F', '구멍', 'rpm'],
    rows: [[g1, B1, (inp === 1 ? '입력' : '출력') + ' (Z)', w1], [g2, B2, (inp === 2 ? '입력' : '출력') + ' (X)', w2]].map(([g, B, ax, w], i) => ({ part: i, cells: [g.name, g.spiral ? `스파이럴 ${g.spiral > 0 ? '+' : '−'}${fmt(Math.abs(g.spiral), 1)}°` : '베벨', ax, g.z, g.m, g.pa + '°', fmt(g.delta / D2R, 2) + '°', fmt(2 * B.r, 2), fmt(2 * B.ra, 2), fmt(B.A, 2), fmt(g.F, 2), fmt(g.bore, 2) + (g.dcut ? ' D' : ''), fmt(rpmOf(w), 1)] }))
  };
  model.hud = [['입력', fmt(D.rpm, 1) + ' rpm'], ['출력', fmt(rpmOf(wOut), 2) + ' rpm'], ['변속비', ratioTxt(ratio)], ['모듈', D.m], ['축 각도', '90°']];
  if (D.spiral) model.notes.push(SPIRAL_NOTE);
  model.scad = () => bevelScad(D, g1, g2, B1, B2);
  return model;
}

function bevelScad(D, g1, g2, B1, B2) {
  const L = ['// 기어 설계실에서 생성한 베벨기어(직선·스파이럴 근사) OpenSCAD 소스 (OpenSCAD 2021.01 이상)',
    '// 아래 숫자를 바꾸고 F6 렌더 → File > Export > STL', '// mode: "plate" 출력판 | "assembly" 조립 | "b1" | "b2"' + (D.box ? ' | "housing_body" | "housing_lid"' : ''),
    'mode = "plate";', 'res = 10;', '',
    `m = ${D.m};        // 모듈 (뒷면 기준)`, `z1 = ${D.z1};       // 입력 기어 잇수`, `z2 = ${D.z2};       // 출력 기어 잇수`, `pa = ${D.pa};       // 압력각`,
    `F = ${fmt(D.F, 3)};        // 이 폭 (원추 경사면 길이)`, `bl = ${D.backlash};    // 백래시`, `hub1 = ${fmt(B1.hub, 3)}; hub2 = ${fmt(B2.hub, 3)};   // 앞쪽(toe) 허브 길이`,
    `bore1 = ${D.bore1}; dcut1 = ${D.dcut1};`, `bore2 = ${D.bore2}; dcut2 = ${D.dcut2};`, `spiral = ${D.spiral || 0};   // 스파이럴 나선각(°), 0 = 직선 베벨`, '',
    'd1 = atan2(z1, z2); d2 = 90 - d1;', 'r1 = m*z1/2; r2 = m*z2/2;', 'H1 = r1/tan(d1); H2 = r2/tan(d2);', '',
    SCAD_LIB, ''];
  if (D.box) L.push(`BOX = [${D.box.W}, ${D.box.H}, ${D.box.D}, ${D.box.wall}];`, `O = [${D.O.map(v => fmt(v, 3)).join(', ')}];   // 두 원추의 꼭짓점`, `shaft = ${D.shaftD};`, `
module housing_body() {
  difference() {
    cube([BOX[0], BOX[1], BOX[2] - BOX[3]]);
    translate([BOX[3], BOX[3], BOX[3]]) cube([BOX[0] - 2*BOX[3], BOX[1] - 2*BOX[3], BOX[2]]);
    translate([O[0], O[1], -1]) cylinder(d = shaft + 0.4, h = BOX[3] + 2, $fn = 32);
    translate([BOX[0] - BOX[3] - 1, O[1], O[2]]) rotate([0, 90, 0]) cylinder(d = shaft + 0.4, h = BOX[3] + 2, $fn = 32);
  }
}
module housing_lid() cube([BOX[0], BOX[1], BOX[3]]);`);
  else L.push('O = [0, 0, 0];');
  L.push(`
module b1() bevel_gear(m, z1, pa, bl, d1, F, bore1, dcut1, hub1, spiral);
module b2() bevel_gear(m, z2, pa, bl, d2, F, bore2, dcut2, hub2, -spiral);
if (mode == "assembly") {
  translate([O[0], O[1], O[2] - H1]) b1();
  translate(O) rotate([0, -90, 0]) translate([0, 0, -H2]) rotate(180 + 180/z2) b2();${D.box ? `
  %housing_body();
  %translate([0, 0, BOX[2] - BOX[3]]) housing_lid();` : ''}
} else if (mode == "b1") b1();
else if (mode == "b2") b2();${D.box ? `
else if (mode == "housing_body") housing_body();
else if (mode == "housing_lid") housing_lid();` : ''}
else { b1(); translate([r1 + r2 + 2*m + 6, 0, 0]) b2(); }`);
  return L.join('\n');
}

function planetaryModel(D) {
  const G = planetaryGeom(D), { sun, planet, ring, a, zr } = G;
  const [cx, cy] = D.center, z0 = D.z0, N = D.N;
  const ws = D.rpm * 2 * PI / 60, wc = ws * D.zs / (D.zs + zr), wp = wc - (D.zs / D.zp) * (ws - wc);
  const beta0 = i => 2 * PI * i / N;
  const php0 = i => beta0(i) + PI + PI / D.zp - (D.zs / D.zp) * (0 - beta0(i));
  const phr = 0 + (D.zp / zr) * (php0(0) - 0);
  const sunBore = borePts(D.sunBore, 0.5), pBore = borePts(D.pinD + 0.35, 0);
  const sunT = extrudeTris(gearOutline(sun).pts, [sunBore], D.b);
  const plT = extrudeTris(gearOutline(planet).pts, [pBore], D.b);
  const ringHole = gearOutline(ring).pts.map(([x, y]) => [x * Math.cos(phr) - y * Math.sin(phr), x * Math.sin(phr) + y * Math.cos(phr)]);
  const ringOuter = D.ringOuter.pts ? ccw(D.ringOuter.pts) : D.ringOuter.r ? circlePts(D.ringOuter.r, 128) : [[-D.ringOuter.w / 2, -D.ringOuter.h / 2], [D.ringOuter.w / 2, -D.ringOuter.h / 2], [D.ringOuter.w / 2, D.ringOuter.h / 2], [-D.ringOuter.w / 2, D.ringOuter.h / 2]];
  const ringT = extrudeTris(ringOuter, [ringHole], D.b);
  const plateZ = D.b + D.gap, bossTop = D.carrier.bossTop - z0;
  const C = { a, N, pinR: D.pinD / 2, plateZ, tc: D.carrier.tc, Rc: D.carrier.Rc, bossR: D.carrier.bossR, bossTop, bore: D.outBore, dcut: 0.5 };
  const carT = carrierTris(C), pinT = extrudeTris(circlePts(D.pinD / 2 - 0.05, 28), [], plateZ + C.tc);
  const model = { kind: 'planetary', housing: [], rods: [], notes: [] };
  model.parts = [
    { name: 'S', file: `S_sun_z${D.zs}_input`, tris: sunT, motion: t => XF.mul(XF.T(cx, cy, z0), XF.Rz(ws * t)) },
    ...Array.from({ length: N }, (_, i) => ({ name: 'P' + (i + 1), file: `P${i + 1}_planet_z${D.zp}`, tris: plT,
      motion: t => { const b = beta0(i) + wc * t; return XF.mul(XF.T(cx + a * Math.cos(b), cy + a * Math.sin(b), z0), XF.Rz(php0(i) + wp * t)); } })),
    { name: 'R', file: `R_ring_z${zr}_fixed`, tris: ringT, motion: () => XF.T(cx, cy, z0) },
    { name: 'C', file: `C_carrier_output`, tris: carT, ghost: 0.45, motion: t => XF.mul(XF.T(cx, cy, z0), XF.Rz(wc * t)) },
    ...Array.from({ length: N }, (_, i) => ({ name: 'pin' + (i + 1), file: `pin_d${D.pinD}_x${N}`, tris: pinT,
      motion: t => XF.chain3(XF.T(cx, cy, z0), XF.Rz(wc * t), XF.T(a * Math.cos(beta0(i)), a * Math.sin(beta0(i)), 0)) })),
  ];
  const box = D.box;
  model.rods.push({ a: [cx, cy, box ? -12 : z0 - 12], b: [cx, cy, z0 + D.b], d: D.shaftD, role: 'input' });
  model.rods.push({ a: [cx, cy, z0 + plateZ], b: [cx, cy, z0 + bossTop + 8], d: D.shaftD, role: 'output' });
  if (box) {
    const h = boxHousing(box, [{ face: 'floor', u: cx, v: cy, d: D.shaftD + 0.4 }, { face: 'lid', u: cx, v: cy, d: 2 * D.carrier.bossR + 0.6 }]);
    model.housing.push({ name: '하우징 본체', file: 'housing_body', tris: h.body }, { name: '덮개', file: 'housing_lid', tris: xfTris(h.lid, XF.T(0, 0, box.D - box.wall)), print: XF.T(0, 0, -(box.D - box.wall)) });
  }
  model.notes.push(D.ringOuter.pts ? '링기어 바깥이 하우징 안쪽 모양(원통이면 고정 홈 4개)에 맞춰져 있어 끼우기만 해도 돌지 않습니다.' : D.ringOuter.r ? '링기어 바깥이 원형입니다. 하우징에 넣을 때는 접착하거나 핀으로 고정하세요.' : '링기어 바깥이 하우징 안쪽 크기에 맞춘 사각형이라 끼우기만 해도 돌지 않습니다.', `유성 핀(${D.pinD} mm) ${N}개를 캐리어 구멍에 꽉 끼웁니다. 출력한 핀 대신 같은 지름의 금속 핀을 써도 됩니다.`, `조립 순서: 링기어를 바닥에 넣고 → 선기어(D컷 입력축) → 유성기어 ${N}개 → 핀을 끼운 캐리어를 위에서 덮고 → 덮개.`);
  // 검사
  const checks = [], ratio = G.ratio;
  let st = 'ok', txt = `변속비(입력:출력) <em>${ratioTxt(ratio)}</em> · 출력 <em>${fmt(rpmOf(wc), 2)} rpm</em> · 입력과 같은 방향 · 같은 축선`;
  if (D.target) { const err = Math.abs(ratio - D.target.ratio) / D.target.ratio * 100; txt += ` · 목표 대비 <em>${err.toFixed(2)}%</em>`; if (err > D.target.tol + 1e-6) st = 'warn'; }
  checks.push({ st, txt });
  const asm = (D.zs + zr) % N === 0;
  checks.push({ st: asm ? 'ok' : 'bad', txt: asm ? `조립 조건 (Zs+Zr)/N = <em>${(D.zs + zr) / N}</em> 정수 · 유성기어 ${N}개를 같은 간격으로 넣을 수 있습니다` : `조립 조건 불만족: (Zs+Zr)/N = ${fmt((D.zs + zr) / N, 3)} 이 정수가 아닙니다. 유성기어를 같은 간격으로 넣을 수 없습니다.` });
  const rap = gearOutlineInfo(planet).ra, gapN = 2 * a * Math.sin(PI / N) - 2 * rap;
  checks.push({ st: gapN >= 1 ? 'ok' : 'bad', txt: `이웃한 유성기어 사이 간격 <em>${fmt(gapN, 2)} mm</em>${gapN < 1 ? ' — 서로 부딪힙니다. 유성기어 수를 줄이세요.' : ''}` });
  const e1 = meshGeom(sun, planet).eps, e2 = internalEps(planet, ring, a);
  checks.push({ st: Math.min(e1, e2) >= 1.2 ? 'ok' : Math.min(e1, e2) >= 1.05 ? 'warn' : 'bad', txt: `물림률 선–유성 <em>${e1.toFixed(2)}</em> · 유성–링 <em>${e2.toFixed(2)}</em> · 중심거리 <em>${fmt(a, 3)} mm</em>` });
  for (const [g, bd] of [[sun, D.sunBore], [planet, D.pinD + 0.35]]) {
    const I = gearOutlineInfo(g);
    if (I.rf - bd / 2 < 1.2) checks.push({ st: 'bad', txt: `${g.name === 'S' ? '선기어' : '유성기어'}: 구멍(${fmt(bd, 2)} mm)이 이뿌리에 너무 가깝습니다.` });
    const lim = 2 / Math.sin(g.pa * D2R) ** 2;
    if (g.z < lim - 0.5) checks.push({ st: 'warn', txt: `${g.name === 'S' ? '선기어' : '유성기어'} 잇수 ${g.z}는 언더컷 한계(${lim.toFixed(1)})보다 작습니다. 이뿌리가 약간 깎입니다.` });
  }
  const ringRoot = gearOutlineInfo(ring).ra, ringWall = (D.ringOuter.pts ? segDist(0, 0, D.ringOuter.pts) : D.ringOuter.r || Math.min(D.ringOuter.w, D.ringOuter.h) / 2) - ringRoot;
  checks.push({ st: ringWall >= 2 ? 'ok' : 'bad', txt: `링기어 바깥 두께 최소 <em>${fmt(ringWall, 2)} mm</em>` });
  if (box) {
    const { W, H, D: Dd, wall } = box;
    const ok = z0 >= wall - 1e-6 && z0 + plateZ + D.carrier.tc <= Dd - wall - 0.5 + 1e-6 && fitsIn(box, cx, cy, D.carrier.Rc + 0.5);
    checks.push({ st: ok ? 'ok' : 'bad', txt: ok ? `${shapeTxt(box)} 안에 들어갑니다` : '캐리어나 기어가 벽을 넘습니다' });
  }
  model.checks = checks;
  // 간섭: 선–유성1, 유성1–링
  model.interference = (steps = 36) => {
    const sP = gearOutline(sun, 8).pts, pP = gearOutline(planet, 8).pts, rH = ringHole, iS = gearOutlineInfo(sun), iP = gearOutlineInfo(planet);
    const T = (2 * PI / D.zs) / Math.abs(ws - wc);
    const tf = (pts, ph, x0, y0) => { const c = Math.cos(ph), s = Math.sin(ph); return pts.map(([x, y]) => [x0 + x * c - y * s, y0 + x * s + y * c]); };
    let h1 = 0, h2 = 0;
    for (let k = 0; k < steps; k++) {
      const t = T * k / steps, b = wc * t, px = a * Math.cos(b), py = a * Math.sin(b);
      const S = tf(sP, ws * t, 0, 0), P = tf(pP, php0(0) + wp * t, px, py);
      let hit = false;
      for (const [x, y] of S) if (Math.hypot(x - px, y - py) < iP.ra && pointInPoly(x, y, P)) { hit = true; break; }
      if (!hit) for (const [x, y] of P) if (Math.hypot(x, y) < iS.ra && pointInPoly(x, y, S)) { hit = true; break; }
      if (hit) h1++;
      hit = false;
      const rIn = ring.m * ring.z / 2 - ring.m - 0.05;
      for (const [x, y] of P) if (Math.hypot(x, y) > rIn && !pointInPoly(x, y, rH)) { hit = true; break; }
      if (hit) h2++;
    }
    return [{ pair: 'S–P1', hits: h1, steps }, { pair: 'P1–R', hits: h2, steps }];
  };
  model.table = {
    head: ['기어', '종류', '역할', 'z', 'm', 'α', '개수', '피치원 d', '이끝원', '이뿌리원', '폭 b', '구멍', 'rpm'],
    rows: [
      { part: 0, cells: ['S', '선기어', '입력', D.zs, D.m, D.pa + '°', 1, fmt(D.m * D.zs, 2), fmt(2 * gearOutlineInfo(sun).ra, 2), fmt(2 * gearOutlineInfo(sun).rf, 2), fmt(D.b, 2), fmt(D.sunBore, 2) + ' D', fmt(rpmOf(ws), 1)] },
      { part: 1, cells: ['P', '유성기어', '자전·공전', D.zp, D.m, D.pa + '°', N, fmt(D.m * D.zp, 2), fmt(2 * gearOutlineInfo(planet).ra, 2), fmt(2 * gearOutlineInfo(planet).rf, 2), fmt(D.b, 2), fmt(D.pinD + 0.35, 2), fmt(rpmOf(wp), 1)] },
      { part: 1 + N, cells: ['R', '링기어(내접)', '고정', zr, D.m, D.pa + '°', 1, fmt(D.m * zr, 2), fmt(2 * (ring.m * zr / 2 - ring.m), 2), fmt(2 * gearOutlineInfo(ring).ra, 2), fmt(D.b, 2), '—', '0'] },
      { part: 2 + N, cells: ['C', '캐리어', '출력', '—', '—', '—', 1, fmt(2 * a, 2) + ' (핀 원)', fmt(2 * D.carrier.Rc, 2), '—', fmt(D.carrier.tc, 2), fmt(D.outBore, 2) + ' D', fmt(rpmOf(wc), 2)] },
    ]
  };
  model.hud = [['입력(선기어)', fmt(D.rpm, 1) + ' rpm'], ['출력(캐리어)', fmt(rpmOf(wc), 2) + ' rpm'], ['변속비', ratioTxt(ratio)], ['모듈', D.m], ['유성기어', N + '개']];
  model.scad = () => planetaryScad(D, G, phr, C);
  return model;
}

function planetaryScad(D, G, phr, C) {
  const L = ['// 기어 설계실에서 생성한 유성기어 감속기 OpenSCAD 소스 (OpenSCAD 2021.01 이상)',
    '// 숫자를 바꾸고 F6 렌더 → File > Export > STL. 조립 조건 (zs+zr)/N 이 정수여야 합니다.',
    '// mode: "plate" 출력판 | "assembly" 조립 | "sun" | "planet" | "ring" | "carrier" | "pin"' + (D.box ? ' | "housing_body" | "housing_lid"' : ''),
    'mode = "plate";', 'res = 10;', '',
    `m = ${D.m};  pa = ${D.pa};  bl = ${D.backlash};`, `zs = ${D.zs};   // 선기어`, `zp = ${D.zp};   // 유성기어`, `N = ${D.N};     // 유성기어 수`, 'zr = zs + 2*zp; // 링기어',
    `b = ${fmt(D.b, 3)};      // 이 폭`, `sun_bore = ${D.sunBore};  pin_d = ${D.pinD};  out_bore = ${D.outBore};`,
    `gap = ${D.gap};  tc = ${D.carrier.tc};  Rc = ${fmt(D.carrier.Rc, 3)};  boss_r = ${fmt(D.carrier.bossR, 3)};  boss_top = ${fmt(C.bossTop, 3)};`,
    D.ringOuter.pts ? (() => { const R = Math.max(...D.ringOuter.pts.map(q => Math.hypot(q[0], q[1]))); return `ring_r = 0; ring_w = ${fmt(2 * R, 3)}; ring_h = ${fmt(2 * R, 3)};   // 링 바깥은 하우징 안쪽 모양을 따름 (ring_pts)\nring_pts = [${D.ringOuter.pts.map(q => `[${fmt(q[0], 3)}, ${fmt(q[1], 3)}]`).join(', ')}];`; })()
      : D.ringOuter.r ? `ring_r = ${fmt(D.ringOuter.r, 3)}; ring_w = 0; ring_h = 0; ring_pts = [];` : `ring_r = 0; ring_w = ${fmt(D.ringOuter.w, 3)}; ring_h = ${fmt(D.ringOuter.h, 3)}; ring_pts = [];`,
    'a = m*(zs + zp)/2;', '', SCAD_LIB, `
function planet_phase(i) = let(b = 360*i/N) b + 180 + 180/zp + (zs/zp)*b;
module sun() spur_gear(m, zs, pa, 0, b, bl, sun_bore, 0.5);
module planet() spur_gear(m, zp, pa, 0, b, bl, pin_d + 0.35, 0);
module ring(ph = 0) ring_gear(m, zr, pa, bl, b, ring_w, ring_h, ring_r, ph, ring_pts);
module carrier() {   // 지역 z=0: 유성기어 바닥. 판은 b+gap 높이부터
  difference() {
    union() {
      translate([0, 0, b + gap]) cylinder(r = Rc, h = tc, $fn = 96);
      translate([0, 0, b + gap + tc - 0.01]) cylinder(r = boss_r, h = boss_top - b - gap - tc + 0.01, $fn = 48);
    }
    for (i = [0:N-1]) rotate(360*i/N) translate([a, 0, b + gap - 1]) cylinder(d = pin_d, h = tc + 2, $fn = 28);
    translate([0, 0, b + gap - 1]) linear_extrude(boss_top) bore2d(out_bore, 0.5);
  }
}
module pin() cylinder(d = pin_d - 0.1, h = b + gap + tc, $fn = 28);   // 캐리어 구멍에 꽉 끼움`];
  if (D.box) L.push(`BOX = [${D.box.W}, ${D.box.H}, ${D.box.D}, ${D.box.wall}];  CEN = [${D.center.map(v => fmt(v, 3)).join(', ')}];  z0 = ${fmt(D.z0, 3)};  shaft = ${D.shaftD};
${scadShell(D.box)}
module housing_body() {
  difference() {
    housing_shell();
    translate([CEN[0], CEN[1], -1]) cylinder(d = shaft + 0.4, h = BOX[3] + 2, $fn = 32);
  }
}
module housing_lid() difference() { housing_plate(); translate([CEN[0], CEN[1], -1]) cylinder(r = boss_r + 0.3, h = BOX[3] + 2, $fn = 48); }`);
  else L.push('CEN = [0, 0]; z0 = 0;');
  L.push(`
if (mode == "assembly") {
  translate([CEN[0], CEN[1], z0]) {
    sun();
    for (i = [0:N-1]) rotate(360*i/N) translate([a, 0, 0]) rotate(planet_phase(i) - 360*i/N) planet();
    ring(${fmt(phr / D2R, 4)});
    carrier();
    for (i = [0:N-1]) rotate(360*i/N) translate([a, 0, 0]) pin();
  }${D.box ? `
  %housing_body();
  %translate([0, 0, BOX[2] - BOX[3]]) housing_lid();` : ''}
} else if (mode == "sun") sun();
else if (mode == "planet") planet();
else if (mode == "ring") ring();
else if (mode == "carrier") translate([0, 0, -(b + gap)]) carrier();
else if (mode == "pin") pin();${D.box ? `
else if (mode == "housing_body") housing_body();
else if (mode == "housing_lid") housing_lid();` : ''}
else {
  R0 = ring_r > 0 ? ring_r : max(ring_w, ring_h)/2;
  ring();
  translate([2*R0 + 5 + Rc, 0, -(b + gap)]) carrier();
  for (i = [0:N-1]) translate([R0 + 5 + 2*Rc + 8, -R0 + i*(pin_d + 4), 0]) pin();
  translate([0, -R0 - 5 - m*(zs/2 + 1), 0]) sun();
  for (i = [0:N-1]) translate([(i + 1)*(m*(zp + 2) + 5) + m*(zs/2 + 1), -R0 - 5 - m*(zp/2 + 1), 0]) planet();
}`);
  return L.join('\n');
}
