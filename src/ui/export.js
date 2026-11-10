/* ---- 내보내기 ---- */
const dlP = (async () => { try { return window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch { return null; } })();
async function saveFile(name, data) {
  const dl = await Promise.race([dlP, new Promise(r => setTimeout(() => r(undefined), 300))]);
  if (dl) {
    try { await dl.save({ filename: name, data }); toast(name + ' 저장을 마쳤습니다'); }
    catch (e) { toast(e && e.code === 'declined' ? '저장을 취소했습니다' : '저장하지 못했습니다: ' + (e && e.message || e)); }
    return;
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data])); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
function baseName() {
  const sb = design.box && shapeOf(design.box), bx = !design.box ? '' : sb === 'cyl' ? `_cyl${design.box.W}x${design.box.D}` : sb === 'poly' ? `_shape${design.box.pts.length}_h${design.box.D}` : `_${design.box.W}x${design.box.H}x${design.box.D}`;
  if (design.kind === 'bevel') return `bevel_m${design.m}_z${design.z1}-${design.z2}${bx}`;
  if (design.kind === 'linkage') return design.type === 'slider' ? `slider_crank_r${design.slider.r}_L${design.slider.L}` : `fourbar_${design.fourbar.a}_${design.fourbar.b}_${design.fourbar.c}_${design.fourbar.d}`;
  if (design.kind === 'cam') return `cam_${design.camType}_${design.camType === 'disk' ? design.follower + '_' : ''}Rb${design.Rb}`;
  if (design.kind === 'cycloid') return `cycloid_N${design.N}_R${design.R}_e${design.e}`;
  if (design.kind === 'rack') return `rack_pinion_m${design.m}_z${design.z1}_n${design.nR}`;
  if (design.kind === 'worm') return `worm_m${design.m}_n${design.n}_z${design.z2}`;
  if (design.kind === 'train') return `gear_train_${design.stages.length}stage_z${design.stages.map(s => s.zA + '-' + s.zB).join('_')}`;
  if (design.kind === 'planetary') return `planetary_m${design.m}_${design.zs}-${design.zp}x${design.N}${bx}`;
  return design.kind === 'gearbox' ? `gearbox${bx}` : `gears_m${design.gears[0].m}_z${design.gears.map(g => g.z).join('-')}`;
}
function placeFlat(tris, X) { const t = X ? xfTris(tris, X) : tris, b = trisBounds(t); return { tris: t, b }; }
function exportZip() {
  if (!design) return;
  const files = [], withHousing = $('xHousing').checked && (design.box || model.frame) && model.housing.length;
  const printable = [];   // 출력판에 올릴 부품 (출력 방향, 바닥 z=0)
  const seen = new Map();
  model.parts.forEach(p => {
    const f = placeFlat(p.tris, p.print);
    const t = xfTris(f.tris, XF.T(0, 0, -f.b.lo[2]));
    if (!seen.has(p.tris)) { seen.set(p.tris, true); files.push({ name: `parts/${p.file}.stl`, data: stlBinary(t, p.name) }); }
    printable.push({ tris: t, b: trisBounds(t) });
  });
  let asm = [];
  model.parts.forEach(p => { asm = asm.concat(xfTris(p.tris, p.motion(0))); });
  files.push({ name: 'assembly.stl', data: stlBinary(asm, 'assembly') });
  if (model.kit) {
    const K = model.kit, enc = t => new TextEncoder().encode(t.replace(/\r?\n/g, '\r\n'));
    if (K.ino) files.push({ name: 'control/motor_control/motor_control.ino', data: enc(K.ino) });
    files.push({ name: 'control/wiring.txt', data: enc(['배선 (' + K.title + ', ' + K.driver + ')', '', ...K.rows.map(r => r[0] + '  →  ' + r[1]), '', ...K.notes.map(n => '- ' + n)].join('\n')) });
    if (model.bom) files.push({ name: 'BOM_assembly.txt', data: enc(['부품 목록', '', ...model.bom.map(b => `- ${b[0]} ×${b[1]}${b[2] ? '  (' + b[2] + ')' : ''}`), ...(model.shaftRows ? ['', '축·결합·지지', '', ...model.shaftRows.map(r => '- ' + r.join(' | '))] : []), '', '조립 순서', '', ...model.steps.map((t, i) => `${i + 1}. ${t}`)].join('\n')) });
    if (model.fitTest) files.push({ name: 'test/fit_test.stl', data: stlBinary(model.fitTest, 'fit_test') });
  }
  if (withHousing) {
    let ah = asm.slice();
    model.housing.forEach(h => {
      const f = placeFlat(h.tris, h.print);
      files.push({ name: `housing/${h.file}.stl`, data: stlBinary(xfTris(f.tris, XF.T(0, 0, -f.b.lo[2])), h.file) });
      if (h.assembly !== false) ah = ah.concat(h.tris);
    });
    files.push({ name: 'assembly_with_housing.stl', data: stlBinary(ah, 'assembly') });
  }
  // 분해 조립도: 부품을 높이 순서대로 벌려 놓음 (바닥판 위는 위로, 밑은 아래로)
  {
    const items = model.parts.map(p => ({ tris: xfTris(p.tris, p.motion(0)) })).concat((withHousing ? model.housing : []).filter(h => h.assembly !== false).map(h => ({ tris: h.tris, base: /바닥판|하우징 본체|base/.test(h.name + h.file) })));
    items.forEach(it => { const z = trisZ(it.tris); it.zc = (z[0] + z[1]) / 2; it.h = z[1] - z[0]; });
    const up = items.filter(it => !it.base && it.zc >= 0).sort((a, b) => a.zc - b.zc), dn = items.filter(it => !it.base && it.zc < 0).sort((a, b) => b.zc - a.zc);
    let ex = []; items.filter(it => it.base).forEach(it => { ex = ex.concat(it.tris); });
    up.forEach((it, k) => { ex = ex.concat(moveTris(it.tris, 0, 0, (k + 1) * 12)); });
    dn.forEach((it, k) => { ex = ex.concat(moveTris(it.tris, 0, 0, -(k + 1) * 12)); });
    files.push({ name: 'assembly_exploded.stl', data: stlBinary(ex, 'exploded') });
  }
  // 구입 부품 출력 모형 (사기 전에 시험 조립)
  const px = model.bom ? proxyParts(model.bom) : [];
  if (px.length) {
    const enc = t => new TextEncoder().encode(t.replace(/\r?\n/g, '\r\n'));
    px.forEach(q => { const b = trisBounds(q.tris); files.push({ name: `proxy/${q.file}${q.n > 1 ? '_x' + q.n : ''}.stl`, data: stlBinary(xfTris(q.tris, XF.T(0, 0, -b.lo[2])), q.file) }); });
    files.push({ name: 'proxy/README.txt', data: enc(['구입 부품 출력 모형', '', '실제 부품을 사기 전에 구멍·길이·자리·조립 순서를 시험하려고 출력하는 모형입니다.', 'M3 이상 볼트·너트는 나사산이 있어 서로 조여 볼 수 있지만, 힘을 받는 곳에는 진짜 금속 부품을 쓰세요.', '파일 이름의 _xN은 출력할 개수입니다. 축은 세워서, 볼트는 머리를 바닥에 두고 출력하세요(레이어 0.12 mm 권장).', '', ...px.map(q => `- ${q.file} ×${q.n}: ${q.note}`)].join('\n')) });
  }
  // 출력판 배치 (220×220 기준 선반 배치)
  const order = printable.map((p, i) => i).sort((a, b) => (printable[b].b.hi[1] - printable[b].b.lo[1]) - (printable[a].b.hi[1] - printable[a].b.lo[1]));
  let x = 0, y = 0, rowH = 0, plate = []; const bed = 220, gap = 5;
  for (const i of order) {
    const { b } = printable[i], w = b.hi[0] - b.lo[0], h = b.hi[1] - b.lo[1];
    if (x > 0 && x + w > bed) { x = 0; y += rowH + gap; rowH = 0; }
    plate = plate.concat(xfTris(printable[i].tris, XF.T(x - b.lo[0], y - b.lo[1], 0)));
    x += w + gap; rowH = Math.max(rowH, h);
  }
  files.push({ name: 'print_plate_gears.stl', data: stlBinary(plate, 'plate') });
  files.push({ name: 'design.json', data: JSON.stringify(design, null, 2) });
  files.push({ name: design.kind === 'bevel' ? 'bevel_gears.scad' : design.kind === 'planetary' ? 'planetary.scad' : design.kind === 'train' ? 'gear_train.scad' : design.kind === 'cam' ? 'cam.scad' : design.kind === 'linkage' ? 'linkage.scad' : design.kind === 'cycloid' ? 'cycloid_drive.scad' : design.kind === 'rack' ? 'rack_pinion.scad' : design.kind === 'worm' ? 'worm_gear.scad' : 'gearbox.scad', data: model.scad() });
  files.push({ name: 'README.txt', data: readme(y + rowH > bed) });
  saveFile(baseName() + '.zip', makeZip(files));
}
function readme(overflow) {
  const L = ['기어 설계실 내보내기', '====================', ''];
  L.push('파일');
  L.push('- parts/*.stl : 부품별 STL (출력하기 좋은 방향, 바닥 z=0). 같은 축의 복합 기어는 한 덩어리입니다. 같은 부품이 여러 개면(유성기어) 개수만큼 출력하세요.');
  L.push('- print_plate_gears.stl : 기어 부품을 220×220 mm 판에 배치한 STL' + (overflow ? ' (판을 넘으므로 부품별 STL로 나눠 출력하세요)' : ''));
  L.push('- assembly.stl : 조립 상태(맞물린 위치) 확인용');
  L.push('- assembly_exploded.stl : 분해 조립도. 부품을 끼우는 순서(높이 순)대로 위아래로 벌려 놓았습니다.');
  if (model.kind === 'cycloid') L.push('- housing/ : 바닥판·바깥 벽·링 핀이 한 몸인 하우징. 입력축은 바닥 구멍으로 들어가 편심축(D컷)을 돌리고, 출력축은 출력판(D컷)에 끼웁니다.');
  else if (model.kind === 'linkage') L.push('- housing/ : 바닥판, ' + (design.type === 'slider' ? '슬라이더 안내 레일' : '흔들이 피벗 기둥') + ', 핀(pin_*). 레일·기둥은 바닥판에 붙여(접착 또는 함께 출력) 씁니다.');
  else if (model.kind === 'cam') L.push('- housing/ : 바닥판(캠 축 구멍), 종동절 안내 슬리브·기둥, 핀(pin_*). 캠 구멍은 D컷이라 축과 함께 돕니다. 핀 대신 같은 지름의 금속봉을 써도 됩니다.');
  else if (model.frame) L.push('- housing/ : 바닥판·축 끝 지지대·지지벽과 축 핀(pin_*). 축 핀 대신 같은 지름의 금속봉을 써도 됩니다. 핀은 지지대 구멍에 끼우고, 입력·출력 축 기어는 D컷 구멍이라 핀과 함께 돕니다.');
  else if (design.box) L.push('- housing/ : 하우징 본체(바닥+벽)와 덮개' + (model.kind === 'spur' ? ', 축 핀. 축 핀 대신 같은 지름의 금속봉을 써도 됩니다.' : '.'));
  L.push('- *.scad : OpenSCAD 파라메트릭 소스. 모듈·잇수·이폭·구멍 등을 바꿔 다시 STL을 만들 수 있습니다.');
  L.push('- design.json : 앱의 "설계 파일 열기"로 다시 불러올 수 있는 설계 데이터');
  if (model.bom && model.kind === 'linkage') L.push('- BOM_assembly.txt : 부품 목록(모터·나사·핀 길이)과 조립 순서', '- test/fit_test.stl : 공차 시험편. 왼쪽부터 꽉 끼는 핀 구멍(+0.05), 도는 핀 구멍(+0.35), 헐거운 구멍(+0.4), D컷 구멍. 먼저 뽑아 핀이 맞는지 확인하세요.');
  else if (model.bom) L.push('- BOM_assembly.txt : 부품 목록(나사·베어링·축 길이), 축 결합·지지 방식, 조립 순서', '- test/fit_test.stl : 공차 시험편. 왼쪽부터 고정 핀 구멍(+0.05), 회전 구멍(+0.35), 하우징 축 구멍(+0.4), D컷 구멍, 베어링 구멍 +0.10 / +0.15 / +0.20 mm. 먼저 뽑아 맞춤을 확인하세요.');
  if (model.bom) L.push('- proxy/ : 구입 부품(모터·볼트·너트·축·베어링·벨트 등)을 출력해 사기 전에 시험 조립해 보는 모형. proxy/README.txt에 개수와 용도');
  if (model.kit) L.push('- control/ : 배선표(wiring.txt)와 아두이노 제어 코드(motor_control/motor_control.ino). 아두이노 IDE에서 .ino를 열어 업로드하세요.');
  L.push('', '출력 팁');
  L.push('- 레이어 0.12~0.2 mm, 벽 3줄 이상, 채움 40% 이상 권장. 첫 레이어 퍼짐(코끼리 발)은 슬라이서 보정을 켜세요.');
  L.push('- 맞물림이 빡빡하면 백래시를 0.05 mm씩 늘려 다시 내보내세요.');
  if (model.kind === 'bevel') L.push('- 베벨기어는 넓은 뒷면이 바닥에 오도록 놓여 있어 서포트 없이 출력됩니다.');
  model.notes.forEach(n => L.push('- ' + n));
  L.push('', '기어 사양', model.table.head.join(' | '));
  model.table.rows.forEach(r => L.push(r.cells.join(' | ')));
  return L.join('\r\n');
}
