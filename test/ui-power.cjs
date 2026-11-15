// 화면 시험: 전문 도구 동력원 연결 (캠 · 기어 직접 설계 각 종류 · 자유 조립)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), NM = path.join(__dirname, '../node_modules/three/'), OUT = require('os').tmpdir() + '/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const W of [1360, 400]) {
    const p = await b.newPage({ viewport: { width: W, height: 900 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.route(/three\.min\.js$/, r => r.fulfill({ body: fs.readFileSync(NM + 'build/three.min.js'), contentType: 'application/javascript' }));
    await p.route(/OrbitControls\.js$/, r => r.fulfill({ body: fs.readFileSync(NM + 'examples/js/controls/OrbitControls.js'), contentType: 'application/javascript' }));
    await p.goto('file://' + path.join(__dirname, '../dist/index.html')); await p.waitForTimeout(1500);
    const bad = [], st = () => p.evaluate(() => ({ kind: design.kind, vis: document.getElementById('panePower').style.display, pw: model.power && { id: model.power.sel.id, st: model.power.sel.st, dir: model.power.dir, n: model.power.opts.length }, parts: model.parts.filter(q => /^power_/.test(q.file)).map(q => q.name), kit: !!model.kit, bom: (model.bom || []).length, nan: model.parts.some(q => q.tris.some(t => t.some(v => !isFinite(v)))), bads: model.checks.filter(c => c.st === 'bad').map(c => c.txt.replace(/<[^>]+>/g, '').slice(0, 90)) }));
    const shot = async n => { await p.waitForTimeout(500); await p.screenshot({ path: OUT + `pw_${W}_${n}.png`, fullPage: W < 500 }); };
    // 1) 캠: 꺼져 있으면 부품 없음 → 켜면 아래쪽 모터
    await p.evaluate(() => { localStorage.removeItem('gearStudio.power'); PW = {}; selectTab('cam'); }); await p.waitForTimeout(600);
    let s = await st(); if (s.vis !== 'flex' || s.pw || s.parts.length) bad.push('캠 꺼짐 ' + JSON.stringify(s));
    await p.check('#pwOn'); await p.waitForTimeout(700); s = await st();
    if (!s.pw || s.pw.dir !== 'down' || s.pw.st === 'bad' || s.parts.join() !== '축 커플링,모터 브래킷,받침 다리 4개,공통 바탕판' || !s.kit || s.bom < 6 || s.nan) bad.push('캠 켬 ' + JSON.stringify(s));
    const rec = await p.locator('#pwRec .alt').count(); if (rec < 3) bad.push('추천 ' + rec);
    await shot('cam');
    { const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }).catch(() => null), p.evaluate(() => exportZip())]);
      if (dl) { const f = OUT + `pw_${W}.zip`; await dl.saveAs(f); const t = fs.readFileSync(f).toString('latin1'); for (const n of ['parts/power_coupling', 'parts/power_bracket_', 'parts/power_base_board', 'parts/power_riser', 'BOM_assembly.txt', 'control/wiring.txt']) if (!t.includes(n)) bad.push('zip에 없음 ' + n); } else bad.push('zip 저장 안 됨'); }
    // 부하를 크게 → 여유가 줄어 다른 모터 추천, 약한 모터를 직접 고르면 부적합
    await p.fill('#pwLoad', '40'); await p.waitForTimeout(900); const s2 = await st();
    await p.selectOption('#pwMotor', 'n20_300'); await p.waitForTimeout(600); s = await st();
    if (s.pw.id !== 'n20_300' || s.pw.st !== 'bad' || !s.bads.some(t => /힘이 모자랍니다/.test(t))) bad.push('약한 모터 ' + JSON.stringify(s));
    await p.selectOption('#pwMotor', 'crank'); await p.waitForTimeout(600); s = await st();
    if (s.parts.join() !== '손 크랭크' || s.pw.id !== 'crank') bad.push('손 크랭크 ' + JSON.stringify(s));
    await p.selectOption('#pwMotor', 'auto'); await p.fill('#pwLoad', '5'); await p.waitForTimeout(900);
    // 2) 기어 직접 설계: 종류마다 켜고 확인
    await p.evaluate(() => selectTab('pair')); await p.waitForTimeout(600); await p.click('#typeSeg button[data-v="spur"]'); await p.click('#runPair'); await p.waitForTimeout(900); await p.check('#pwOn'); await p.waitForTimeout(600);
    for (const t of ['spur', 'bevel', 'planet', 'rack', 'worm', 'cycloid']) {
      await p.click(`#typeSeg button[data-v="${t}"]`); await p.click('#runPair'); await p.waitForTimeout(t === 'worm' ? 4000 : 1200); s = await st();
      if (s.vis !== 'flex' || !s.pw || !s.parts.includes('축 커플링') || !s.parts.includes('공통 바탕판') || !s.kit || s.nan) bad.push(t + ' ' + JSON.stringify(s));
      if (t === 'worm' && (s.pw.dir !== 'side' || !s.parts.includes('입력축 받침'))) bad.push('웜 옆 방향 ' + JSON.stringify(s));
      if (t === 'worm' || t === 'rack' || t === 'spur') await shot(t);
    }
    // 3) 자유 조립
    await p.evaluate(() => selectTab('train')); await p.waitForTimeout(900); await p.check('#pwOn'); await p.waitForTimeout(900); s = await st();
    if (s.kind !== 'train' || !s.pw || !s.parts.includes('모터 브래킷') || s.nan) bad.push('자유 조립 ' + JSON.stringify(s));
    await shot('train');
    // 4) 다른 탭에서는 숨김, 설정은 저장
    await p.evaluate(() => selectTab('link')); await p.waitForTimeout(600);
    s = await p.evaluate(() => ({ vis: document.getElementById('panePower').style.display, saved: JSON.parse(localStorage.getItem('gearStudio.power')) }));
    if (s.vis !== 'none' || !(s.saved.cam || {}).on || !(s.saved.pair || {}).on || !(s.saved.train || {}).on) bad.push('숨김·저장 ' + JSON.stringify(s));
    if (errs.length) bad.push('콘솔 ' + errs.slice(0, 3).join(' / '));
    console.log(W, bad.length ? 'FAIL ' + bad.join('\n  ') : '통과'); if (bad.length) process.exitCode = 1;
    await p.evaluate(() => localStorage.clear()); await p.close();
  }
  await b.close();
})();
