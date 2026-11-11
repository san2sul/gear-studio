// 화면 시험: 스튜디오 여섯 단계를 실제 브라우저에서 눌러 봄 (npm run test:ui). 데스크톱·휴대폰 너비, 콘솔 오류 0, 가로 넘침 없음
const { chromium } = require('playwright');
const fs=require('fs'), NM=require('path').join(__dirname, '../node_modules/three/'), OUT=require('os').tmpdir() + '/';
(async () => {
  const b = await chromium.launch({ args:['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (const W of [1360, 400]) {
  const p = await b.newPage({ viewport: { width: W, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  p.on('dialog', d => d.accept());
  await p.route(/three\.min\.js$/, r => r.fulfill({ body: fs.readFileSync(NM+'build/three.min.js'), contentType:'application/javascript' }));
  await p.route(/OrbitControls\.js$/, r => r.fulfill({ body: fs.readFileSync(NM+'examples/js/controls/OrbitControls.js'), contentType:'application/javascript' }));
  await p.goto('file://' + require('path').join(__dirname, '../dist/index.html') + ''); await p.waitForTimeout(1500);
  const shot = async n => { await p.waitForTimeout(700); await p.screenshot({ path: OUT + `st_${W}_${n}.png`, fullPage: W < 500 }); };
  await shot(0);
  await p.click('button[data-act="new"]'); await p.waitForTimeout(300);
  await p.fill('#stText', '컨베이어 위 상자를 3초마다 옆으로 40mm 밀어내고 싶어'); await p.click('button[data-act="parse"]'); await shot(1);
  await p.click('button[data-act="toRec"]'); await p.waitForTimeout(1500); await shot(2);
  await p.click('button[data-act="pick"][data-id="slider"]'); await p.waitForTimeout(1500); await shot(3);
  await p.fill('input[data-tr="stroke_mm"]', '50'); await p.press('input[data-tr="stroke_mm"]', 'Enter'); await p.dispatchEvent('input[data-tr="stroke_mm"]', 'change'); await p.waitForTimeout(1500);
  const r1 = await p.evaluate(() => ({ r: design.slider && design.slider.r, chosen: P.chosen }));
  await p.click('button[data-go="4"]'); await p.waitForTimeout(800); await shot(4);
  const rows = await p.evaluate(() => [...document.querySelectorAll('#stBody table.vt')[0].querySelectorAll('tr')].map(tr => tr.innerText.replace(/\s+/g, ' ')));
  await p.click('button[data-go="5"]'); await shot(5);
  await p.click('#modeExpert'); await p.waitForTimeout(500); const tabsVis = await p.evaluate(() => !document.querySelector('.tabs').hidden);
  await p.click('#modeEasy'); await p.waitForTimeout(500);
  await p.reload(); await p.waitForTimeout(1500); const list = await p.evaluate(() => JSON.parse(localStorage.getItem('m2m.projects')||'[]').length);
  // 제품 요청(G1): 비누방울 총 문장 → 요청서 카드, 움직임 모르면 추천 버튼 없음, 동력 질문에 답하기
  await p.click('#stSteps button[data-st="0"]'); await p.waitForTimeout(300); await p.click('button[data-act="new"]'); await p.waitForTimeout(300);
  await p.fill('#stText', '총모양의 형상. 방아쇠를 당기면 총 입구에서 비누방울이 만들어져 나가야 함'); await p.click('button[data-act="parse"]'); await p.waitForTimeout(500);
  const g1 = await p.evaluate(() => ({ card: /제품 요청서/.test(document.getElementById('stBody').innerText), rec: !!document.querySelector('button[data-act="toRec"]'), shape: P.req && P.req.shape.value }));
  await p.click('button[data-act="pw"][data-v="battery"]'); await p.waitForTimeout(300); await shot(6);
  const pw = await p.evaluate(() => P.req && P.req.power.value);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  const bad = []; if (r1.r !== 25 || r1.chosen !== 'slider') bad.push('행정 50 → 크랭크 25가 아님'); if (!rows.some(r => /행정.*50 mm.*50 mm.*검사 통과/.test(r))) bad.push('검증 표');
  if (!g1.card || g1.rec || g1.shape !== 'gun' || pw !== 'battery') bad.push('제품 요청서 ' + JSON.stringify(g1) + pw); if (!tabsVis) bad.push('전문 도구 탭'); if (list < 1) bad.push('프로젝트 저장'); if (sw > W) bad.push('가로 넘침 ' + sw); if (errs.length) bad.push('콘솔 오류 ' + errs.join(' / '));
  console.log(W, bad.length ? 'FAIL ' + bad.join(', ') : '통과'); if (bad.length) process.exitCode = 1;
  await p.close(); }
  await b.close();
})();
