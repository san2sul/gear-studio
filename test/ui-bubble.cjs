// 화면 시험: 비누방울 총 (제품 정의 → 개념안 → B안 설계 → 시뮬레이션 → 제작·STL)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), NM = path.join(__dirname, '../node_modules/three/'), OUT = require('os').tmpdir() + '/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const W of [1360, 400]) {
    const p = await b.newPage({ viewport: { width: W, height: 900 }, acceptDownloads: true });
    const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | '))); p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('dialog', d => d.accept());
    await p.route(/three\.min\.js$/, r => r.fulfill({ body: fs.readFileSync(NM + 'build/three.min.js'), contentType: 'application/javascript' }));
    await p.route(/OrbitControls\.js$/, r => r.fulfill({ body: fs.readFileSync(NM + 'examples/js/controls/OrbitControls.js'), contentType: 'application/javascript' }));
    await p.goto('file://' + path.join(__dirname, '../dist/index.html')); await p.waitForTimeout(1500);
    const shot = async n => { await p.waitForTimeout(700); await p.screenshot({ path: OUT + `bub_${W}_${n}.png`, fullPage: W < 500 }); };
    const bad = [];
    await p.click('button[data-act="ex"][data-i="0"]'); await p.waitForTimeout(400); await shot(1);
    if (!(await p.evaluate(() => P.req && P.req.shape.value === 'gun'))) bad.push('예제 요청서');
    await p.selectOption('select[data-rq="power"]', 'battery'); await p.waitForTimeout(300); await p.click('#stBody button[data-go="2"]'); await p.waitForTimeout(500); await shot(2);
    const con = await p.evaluate(() => [...document.querySelectorAll('#stBody table.vt')[1].querySelectorAll('tbody tr')].map(r => r.cells[0].innerText));
    if (!con[0] || !/B안/.test(con[0])) bad.push('개념안 1순위 ' + con[0]);
    await p.click('button[data-act="cpick"][data-id="B"]'); await p.waitForTimeout(1500); await shot(3);
    const d0 = await p.evaluate(() => ({ kind: model.kind, R: design.R, z2: design.z2, parts: model.parts.length, hs: model.housing.length }));
    if (d0.kind !== 'bubble' || d0.hs !== 4) bad.push('설계 ' + JSON.stringify(d0));
    await p.fill('input[data-bp="ringD"]', '30'); await p.dispatchEvent('input[data-bp="ringD"]', 'change'); await p.waitForTimeout(1200);
    const d1 = await p.evaluate(() => ({ R: design.R, src: P.bub && P.bub.ringD }));
    if (!(d1.R > d0.R) || d1.src !== 30) bad.push('링 30 역산 ' + JSON.stringify(d1));
    await p.click('#stBody button[data-go="4"]'); await p.waitForTimeout(600); await shot(4);
    const ver = await p.evaluate(() => model.verify.filter(r => r.ok === false).map(r => r.key));
    if (ver.length) bad.push('검증 미달 ' + ver.join());
    await p.click('#stBody button[data-go="5"]'); await p.waitForTimeout(500); await shot(5);
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }).catch(() => null), p.click('button[data-act="zip"]')]);
    let zipN = 0; if (dl) { const f = OUT + `bub_${W}.zip`; await dl.saveAs(f); const buf = fs.readFileSync(f); zipN = (buf.toString('latin1').match(/PK\x01\x02/g) || []).length;
      const names = buf.toString('utf8').match(/(parts|housing)\/[A-Za-z0-9_]+\.stl/g) || []; if (!names.some(n => /H1_head_body/.test(n)) || !names.some(n => /P1_ring_wheel/.test(n))) bad.push('zip 내용'); } else bad.push('zip 저장 안 됨');
    // 요청서 고치기: 총 길이 160 → 설계에 반영, 동력 '손힘만' → B안 선택 풀림
    await p.click('#stSteps button[data-st="1"]'); await p.waitForTimeout(400);
    await p.fill('input[data-rqp="shape:length"]', '160'); await p.dispatchEvent('input[data-rqp="shape:length"]', 'change'); await p.waitForTimeout(1200);
    const e1 = await p.evaluate(() => ({ L: design.gunLen, src: P.req.shape.params.length.source, ch: P.chosen }));
    if (e1.L !== 160 || e1.src !== 'user' || e1.ch !== 'B') bad.push('요청서 길이 반영 ' + JSON.stringify(e1));
    await p.selectOption('select[data-rq="power"]', 'hand'); await p.waitForTimeout(600); await shot(6);
    const e2 = await p.evaluate(() => ({ ch: P.chosen, d: !!P.design }));
    if (e2.ch || e2.d) bad.push('손힘만인데 B안 유지 ' + JSON.stringify(e2));
    await p.click('#stSteps button[data-st="3"]'); await p.waitForTimeout(400);
    if (!(await p.evaluate(() => /먼저 개념안을 고르세요/.test(document.getElementById('stBody').innerText)))) bad.push('설계 단계 안내');
    // AI 해석(흉내): 규칙이 못 읽은 칸을 AI가 채우고 'AI 추정'으로 표시
    await p.evaluate(() => { stAI = { json: async () => ({ kind: 'product', shape: 'gun', input: 'trigger', effects: ['bubble'], power: null, motion: null, purpose: 'other', traits: {} }) }; });
    await p.click('#stSteps button[data-st="0"]'); await p.waitForTimeout(300); await p.click('button[data-act="new"]'); await p.waitForTimeout(300);
    await p.fill('#stText', '손가락으로 쥐고 쓰는 장난감, 거품 구슬이 앞으로 날아가게'); await p.click('button[data-act="ai"]'); await p.waitForTimeout(800); await shot(7);
    const e3 = await p.evaluate(() => ({ k: P.req && P.req.kind, s: P.req && P.req.shape.value, ss: P.req && P.req.shape.source, fx: P.req && P.req.effects.map(e => e.kind + ':' + e.source).join(), card: /제품 요청서/.test(document.getElementById('stBody').innerText) }));
    if (e3.k !== 'product' || e3.s !== 'gun' || e3.ss !== 'ai' || !/bubble:ai/.test(e3.fx) || !e3.card) bad.push('AI 해석 반영 ' + JSON.stringify(e3));
    const sw = await p.evaluate(() => document.documentElement.scrollWidth); if (sw > W) bad.push('가로 넘침 ' + sw);
    if (errs.length) bad.push('콘솔 오류 ' + errs.join(' / '));
    console.log(W, bad.length ? 'FAIL ' + bad.join(', ') : `통과 (zip 파일 ${zipN}개)`); if (bad.length) process.exitCode = 1;
    await p.close();
  }
  await b.close();
})();
