/* ---- 실물처럼 보기 ----
 3D 화면을 사진에 가깝게: 주변 조명(환경 반사), 그림자, 바닥, 플라스틱·금속 재질, 둥근 면의 매끈한 음영, 적층 줄무늬.
 보기만 바꾸며 치수·STL에는 영향이 없음. "실물처럼 보기"를 끄면 예전의 단순한 보기로 돌아감. */
const REAL_KEY = 'gearStudio.real';
let REAL = true, realLite = false, realProbe = 0, realEnv = null, realKey = null, realFloor = null, realBase = null;
try { const v = localStorage.getItem(REAL_KEY); if (v !== null) REAL = v === '1'; } catch { }
// 스튜디오 환경: 밝은 천장 판과 옆 판이 있는 방을 그려 반사·주변광으로 씀
function realEnvMake() {
  const s = new THREE.Scene(), box = (w, h, d, x, y, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); s.add(m); };
  const room = new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial({ color: 0x8d949c, side: THREE.BackSide })); s.add(room);
  box(24, 24, 0.5, 0, 0, 19, 0xffffff); box(0.5, 16, 10, -19, 0, 4, 0xfff1dd); box(0.5, 10, 8, 19, 6, 2, 0xdde9ff); box(14, 0.5, 8, 0, 19, 3, 0xf4f4f4); box(40, 40, 0.5, 0, 0, -19, 0x5d6268);
  const g = new THREE.PMREMGenerator(renderer), t = g.fromScene(s, 0.04).texture; g.dispose(); s.traverse(o => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); });
  return t;
}
// 꺾임각보다 완만하게 이어진 면은 법선을 평균해 매끈하게 (원통·기어 옆면), 모서리는 날카롭게 둠
function realSmooth(geo, creaseDeg = 38) {
  const P = geo.attributes.position.array, nV = P.length / 3, nF = nV / 3; if (nF > 250000) return;
  const FN = new Float32Array(nF * 3), N = new Float32Array(P.length), cosC = Math.cos(creaseDeg * Math.PI / 180);
  for (let f = 0; f < nF; f++) { const i = f * 9, ax = P[i + 3] - P[i], ay = P[i + 4] - P[i + 1], az = P[i + 5] - P[i + 2], bx = P[i + 6] - P[i], by = P[i + 7] - P[i + 1], bz = P[i + 8] - P[i + 2];
    FN[f * 3] = ay * bz - az * by; FN[f * 3 + 1] = az * bx - ax * bz; FN[f * 3 + 2] = ax * by - ay * bx; }   // 길이 = 넓이×2 → 넓이 가중
  const buckets = new Map(), q = v => Math.round(v * 500);
  for (let v = 0; v < nV; v++) { const k = (q(P[v * 3]) * 73856093) ^ (q(P[v * 3 + 1]) * 19349663) ^ (q(P[v * 3 + 2]) * 83492791); let b = buckets.get(k); if (!b) buckets.set(k, b = []); b.push(v); }
  for (let v = 0; v < nV; v++) { const f = (v / 3) | 0, fx = FN[f * 3], fy = FN[f * 3 + 1], fz = FN[f * 3 + 2], fl = Math.hypot(fx, fy, fz) || 1;
    const k = (q(P[v * 3]) * 73856093) ^ (q(P[v * 3 + 1]) * 19349663) ^ (q(P[v * 3 + 2]) * 83492791), b = buckets.get(k); let x = 0, y = 0, z = 0;
    if (b.length > 48) { x = fx; y = fy; z = fz; }
    else for (const o of b) { if (Math.abs(P[o * 3] - P[v * 3]) > 2e-3 || Math.abs(P[o * 3 + 1] - P[v * 3 + 1]) > 2e-3 || Math.abs(P[o * 3 + 2] - P[v * 3 + 2]) > 2e-3) continue;
      const g = (o / 3) | 0, gx = FN[g * 3], gy = FN[g * 3 + 1], gz = FN[g * 3 + 2], gl = Math.hypot(gx, gy, gz); if (!gl) continue;
      if ((fx * gx + fy * gy + fz * gz) / (fl * gl) >= cosC) { x += gx; y += gy; z += gz; } }
    const l = Math.hypot(x, y, z) || 1; N[v * 3] = x / l; N[v * 3 + 1] = y / l; N[v * 3 + 2] = z / l; }
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
}
// 출력 부품 재질: 무광 플라스틱 + 0.4 mm 적층 줄무늬(부품 좌표 z 방향, 멀어지면 흐려짐)
function realPlastic(hex, opt = {}) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).convertSRGBToLinear(), metalness: 0, roughness: 0.5, envMapIntensity: 0.38, side: THREE.DoubleSide, ...opt });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vLz;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLz = position.z;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLz;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n{ float ph = vLz / 0.4; float ll = 0.5 + 0.5 * sin(ph * 6.2831853); float fw = clamp(fwidth(ph) * 2.5, 0.0, 1.0); ll = mix(ll, 0.5, fw); diffuseColor.rgb *= 0.93 + 0.09 * ll; }');
  };
  m.extensions = { derivatives: true };
  return m;
}
function realApply() {
  if (!renderer || !scene || !root) return;
  $('stage').classList.toggle('real', REAL);
  renderer.outputEncoding = REAL ? THREE.sRGBEncoding : THREE.LinearEncoding;
  renderer.toneMapping = REAL ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping; renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = REAL && !realLite; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (!realBase) realBase = scene.children.filter(o => o.isLight);
  if (realFloor) { scene.remove(realFloor); realFloor.geometry.dispose(); realFloor = null; }
  if (!REAL) { scene.environment = null; realBase.forEach(l => l.visible = true); if (realKey) realKey.visible = false; return; }
  if (!realEnv) realEnv = realEnvMake();
  scene.environment = realEnv; realBase.forEach(l => l.visible = false);
  if (!realKey) { realKey = new THREE.DirectionalLight(0xfff6e8, 1.35); realKey.castShadow = true; realKey.shadow.mapSize.set(2048, 2048); realKey.shadow.bias = -0.0004; realKey.shadow.normalBias = 0.25; realKey.shadow.radius = 4; scene.add(realKey, realKey.target); }
  realKey.visible = true; realKey.castShadow = !realLite;
  const house = new Set(); if (boxGroup) boxGroup.traverse(o => o.isMesh && house.add(o));
  root.traverse(o => { if (!o.isMesh) return;
    const k = partMeshes.indexOf(o), old = o.material;
    if (k >= 0) { if (!o.geometry.userData.smooth) { realSmooth(o.geometry); o.geometry.userData.smooth = true; }
      o.material = realPlastic('#' + old.color.getHexString(), old.transparent ? { transparent: true, opacity: old.opacity, depthWrite: false } : {}); o.castShadow = !old.transparent; o.receiveShadow = true; }
    else if (house.has(o)) { if (!o.geometry.userData.smooth) { realSmooth(o.geometry); o.geometry.userData.smooth = true; }
      o.material = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xa9bccb).convertSRGBToLinear(), metalness: 0, roughness: 0.12, envMapIntensity: 0.8, transparent: true, opacity: Math.max(0.14, Math.min(0.26, old.opacity * 0.6)), depthWrite: false, side: THREE.DoubleSide }); o.receiveShadow = false; }
    else if (o.geometry.type === 'CylinderGeometry') { o.material = new THREE.MeshStandardMaterial({ color: new THREE.Color('#' + old.color.getHexString()).convertSRGBToLinear().lerp(new THREE.Color(0xc4cad0).convertSRGBToLinear(), 0.55), metalness: 1, roughness: 0.24, envMapIntensity: 1.1 }); o.castShadow = true; o.receiveShadow = true; }
    else { if (!o.geometry.userData.smooth) { realSmooth(o.geometry); o.geometry.userData.smooth = true; }
      o.material = new THREE.MeshStandardMaterial({ color: new THREE.Color('#' + old.color.getHexString()).convertSRGBToLinear(), metalness: 0.85, roughness: 0.38, envMapIntensity: 1, side: THREE.DoubleSide }); o.castShadow = true; o.receiveShadow = true; }
    if (old && old !== o.material) old.dispose(); });
  // 바닥(그림자 받이)과 주 조명 위치를 모델 크기에 맞춤
  const b = new THREE.Box3().setFromObject(root), c = b.getCenter(new THREE.Vector3()), R = Math.max(10, b.getSize(new THREE.Vector3()).length() / 2);
  realFloor = new THREE.Mesh(new THREE.PlaneGeometry(R * 14, R * 14), new THREE.ShadowMaterial({ opacity: 0.38 })); realFloor.position.set(c.x, c.y, b.min.z - 0.05); realFloor.receiveShadow = true; scene.add(realFloor);
  realKey.position.set(c.x + R * 1.4, c.y - R * 2.0, b.max.z + R * 3.2); realKey.target.position.copy(c); realKey.target.updateMatrixWorld();
  realWatch();
  const sc = realKey.shadow.camera; sc.left = sc.bottom = -R * 1.9; sc.right = sc.top = R * 1.9; sc.near = R * 0.5; sc.far = R * 9; sc.updateProjectionMatrix();
}
// 느린 기기(소프트웨어 렌더링 등): 처음 몇 장면의 그리는 시간을 재서 느리면 그림자를 끔
function realWatch() {
  if (!REAL || realLite || realProbe > 2) return; realProbe++;
  let n = 0, t0 = 0; const step = t => { if (!t0) t0 = t; if (++n < 12) { requestAnimationFrame(step); return; }
    if ((t - t0) / 11 > 90 && REAL && !realLite) { realLite = true; if (model) buildScene(true); } };
  requestAnimationFrame(step);
}
$('realView').checked = REAL;
$('realView').onchange = () => { REAL = $('realView').checked; try { localStorage.setItem(REAL_KEY, REAL ? '1' : '0'); } catch { } if (model) buildScene(true); };
