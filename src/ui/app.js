/* ================= UI · 3D ================= */
const $ = id => document.getElementById(id);
const num = id => parseFloat($(id).value);
const PART_COLORS = ['#4f7396', '#c08a2e', '#3f8d78', '#a2554c', '#7563a3', '#6d8b34', '#b0687f', '#3b8aa8'];
let design = null, model = null, alts = [], altIdx = 0, func = 'reduce', ptype = 'spur';
const POLY_PRESETS = {
  L: [[0, 0], [100, 0], [100, 40], [45, 40], [45, 90], [0, 90]],
  T: [[0, 50], [30, 50], [30, 0], [70, 0], [70, 50], [100, 50], [100, 85], [0, 85]],
  hex: [[25, 0], [75, 0], [100, 43], [75, 86], [25, 86], [0, 43]],
  trap: [[0, 0], [110, 0], [85, 60], [25, 60]],
};
let shape = 'rect', polyPts = POLY_PRESETS.L.map(q => q.slice()), boxTimer = 0, edDrag = null;
let playing = true, simT = 0;

const FUNC_HINT = {
  reduce: '평기어열로 출력을 느리게, 토크를 크게 만듭니다. 변속비 6이면 입력 6바퀴에 출력 1바퀴.',
  increase: '평기어열로 출력을 빠르게 만듭니다. 변속비 3이면 입력 1바퀴에 출력 3바퀴.',
  planetary: '선기어(입력) · 유성기어 · 고정 링기어 · 캐리어(출력). 입력과 출력이 한 축선에 있고 같은 방향으로 돕니다. 변속비 3~10 정도가 알맞습니다.',
  rightangle: '베벨기어로 회전축을 90° 꺾습니다. 축 하나는 바닥으로, 다른 하나는 오른쪽 벽으로 나옵니다. 변속비 1은 같은 크기(마이터 기어), 1보다 작으면 가속.',
  reverse: '같은 속도로 회전 방향만 반대로 바꿉니다.',
  transfer: '같은 속도로 동력을 다른 축으로 옮깁니다. 방향을 같게 하면 아이들러 기어가 들어갑니다.'
};

function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 3600); }

/* ---- 3D ---- */
const stage = $('stage');
let renderer, scene, camera, controls, root, partMeshes = [], boxGroup;
function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function initThree() {
  if (!window.THREE) { stage.insertAdjacentHTML('beforeend', '<div class="empty">3D 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침하세요.</div>'); return false; }
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  stage.prepend(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 1, 0.5, 5000);
  camera.up.set(0, 0, 1);
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.75));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.75); d1.position.set(1, -1.5, 2.5); scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, 0.3); d2.position.set(-2, 1, 1); scene.add(d2);
  new ResizeObserver(resize).observe(stage);
  resize();
  return true;
}
function resize() {
  if (!renderer) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
}
function trisToGeom(tris) {
  const pos = new Float32Array(tris.length * 9);
  tris.forEach((t, i) => pos.set(t, i * 9));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}
const toM4 = A => new THREE.Matrix4().set(A[0], A[1], A[2], A[3], A[4], A[5], A[6], A[7], A[8], A[9], A[10], A[11], 0, 0, 0, 1);
function partColor(k) { return PART_COLORS[k % PART_COLORS.length]; }

function buildScene(keepView) {
  if (!scene) return;
  if (root) { scene.remove(root); root.traverse(o => { o.geometry && o.geometry.dispose(); }); }
  root = new THREE.Group(); scene.add(root); partMeshes = [];
  const geomCache = new Map();
  model.parts.forEach((p, k) => {
    let geo = geomCache.get(p.tris); if (!geo) { geo = trisToGeom(p.tris); geomCache.set(p.tris, geo); }
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(partColor(colorIdx(k))), metalness: 0.15, roughness: 0.55, side: THREE.DoubleSide,
      transparent: !!p.ghost, opacity: p.ghost || 1, depthWrite: !p.ghost });
    const m = new THREE.Mesh(geo, mat); m.matrixAutoUpdate = false; m.matrix.copy(toM4(p.motion(0)));
    root.add(m); partMeshes.push(m);
  });
  for (const r of model.rods) {
    const a = new THREE.Vector3(...r.a), b = new THREE.Vector3(...r.b), len = a.distanceTo(b);
    const col = r.role === 'input' ? css('--ok') : r.role === 'output' ? css('--bad') : '#8a949c';
    const c = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.6, r.d / 2 - 0.05), Math.max(0.6, r.d / 2 - 0.05), len, 24), new THREE.MeshStandardMaterial({ color: new THREE.Color(col), metalness: 0.4, roughness: 0.4 }));
    c.position.copy(a.clone().add(b).multiplyScalar(0.5));
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    root.add(c);
  }
  for (const x of model.extras || []) {
    if (x.line) { const g = new THREE.BufferGeometry().setFromPoints(x.line.map(q => new THREE.Vector3(...q))); root.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(x.color) }))); continue; }
    root.add(new THREE.Mesh(trisToGeom(x.tris), new THREE.MeshStandardMaterial({ color: new THREE.Color(x.color), metalness: 0.5, roughness: 0.45, side: THREE.DoubleSide }))); }
  boxGroup = new THREE.Group(); root.add(boxGroup);
  if (model.frame) {
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(css('--mute')), metalness: 0.05, roughness: 0.8, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide });
    for (const h of model.housing) if (h.assembly !== false) boxGroup.add(new THREE.Mesh(trisToGeom(h.tris), mat));
  } else if (design.box) {
    const { W, H, D: Dd } = design.box;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, Dd)), new THREE.LineBasicMaterial({ color: new THREE.Color(css('--mute')) }));
    edges.position.set(W / 2, H / 2, Dd / 2); boxGroup.add(edges);
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(css('--mute')), transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
    for (const h of model.housing) if (h.assembly !== false) boxGroup.add(new THREE.Mesh(trisToGeom(h.tris), mat));
  }
  boxGroup.visible = $('showBox').checked;
  if (!keepView) fitView();
}
// 유성기어 세트는 같은 색 → 표의 색과 일치
function colorIdx(k) {
  if (model.kind !== 'planetary') return k;
  const N = design.N; return k === 0 ? 0 : k <= N ? 1 : k <= N + 2 ? k - N + 1 : 4;
}
function fitView() {
  if (!root) return;
  const b = new THREE.Box3().setFromObject(root), c = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).length() / 2;
  const dist = r / Math.sin(camera.fov * D2R / 2) * 0.95;
  camera.position.set(c.x + dist * 0.35, c.y - dist * 0.7, c.z + dist * 0.62);
  controls.target.copy(c); controls.update();
}
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (playing && model) simT += dt * num('speed') * (design && design.reverse ? -1 : 1);
  if (model) model.parts.forEach((p, k) => partMeshes[k] && partMeshes[k].matrix.copy(toM4(p.motion(simT))));
  if (renderer) { controls.update(); renderer.render(scene, camera); }
  requestAnimationFrame(loop);
}
