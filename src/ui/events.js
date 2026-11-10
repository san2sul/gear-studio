/* ---- 이벤트 ---- */
function selectTab(t) {
  const map = { box: ['tabBox', 'paneBox'], pair: ['tabPair', 'panePair'], train: ['tabTrain', 'paneTrain'], cam: ['tabCam', 'paneCam'], link: ['tabLink', 'paneLink'], find: ['tabFind', 'paneFind'], std: ['tabStd', 'paneStd'], asm: ['tabAsm', 'paneAsm'] };
  for (const [k, [tb, pn]] of Object.entries(map)) { $(tb).setAttribute('aria-selected', k === t); $(pn).style.display = k === t ? 'flex' : 'none'; }
  if (t === 'box') drawShapeEd();
  if (t === 'train') { if (!tD) tD = defaultTrain(); renderTrainForm(); if (!design || design.kind !== 'train' || (tD.enclose && tD.enclose.on)) rebuildTrain(); }
  if (t === 'cam') { if (!cD) cD = camDefault(); renderCamForm(); if (!design || design.kind !== 'cam') rebuildCam(); }
  if (t === 'link') { if (!kD) kD = linkageDefault(); renderLinkForm(); if (!design || design.kind !== 'linkage') rebuildLink(); }
  if (t === 'find') renderFind();
  if (t === 'std') { renderStd(); stdPreview(); }
  if (t === 'asm') { renderAsm(); if (!design || design.kind !== 'asm') asmRebuild(0, true); }
}