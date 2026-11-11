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
    // 모든 개념안을 고를 수 있어야 함: A안을 고르면 설계 단계에 '고른 안 … 미구현' 안내
    const nPick = await p.evaluate(() => document.querySelectorAll('#stBody .stCard button[data-act="cpick"]').length); if (nPick < 5) bad.push('고르기 버튼 수 ' + nPick);
    await p.click('.stCard button[data-act="cpick"][data-id="A"]'); await p.waitForTimeout(500);
    const ca = await p.evaluate(() => ({ ch: P.chosen, on: !!document.querySelector('.stCard.on button[data-id="A"]') })); if (ca.ch !== 'A' || !ca.on) bad.push('A안 고르기 ' + JSON.stringify(ca));
    await p.click('#stSteps button[data-st="3"]'); await p.waitForTimeout(500); await shot('3a');
    if (!(await p.evaluate(() => /고른 안: A안/.test(document.getElementById('stBody').innerText)))) bad.push('A안 설계 안내 없음');
    await p.click('#stSteps button[data-st="2"]'); await p.waitForTimeout(500);
    await p.click('.stCard button[data-act="cpick"][data-id="B"]'); await p.waitForTimeout(1500); await shot(3);
    const d0 = await p.evaluate(() => ({ kind: model.kind, R: design.R, z2: design.z2, parts: model.parts.length, hs: model.housing.length }));
    if (d0.kind !== 'bubble' || d0.hs !== 4) bad.push('설계 ' + JSON.stringify(d0));
    await p.fill('input[data-bp="ringD"]', '30'); await p.dispatchEvent('input[data-bp="ringD"]', 'change'); await p.waitForTimeout(1200);
    const d1 = await p.evaluate(() => ({ R: design.R, src: P.bub && P.bub.ringD }));
    if (!(d1.R > d0.R) || d1.src !== 30) bad.push('링 30 역산 ' + JSON.stringify(d1));
    await p.click('#stBody button[data-go="4"]'); await p.waitForTimeout(600); await shot(4);
    // 공학 계산: 표가 있고, 바퀴 회전수 예측이 미달이면 '계산한 회전수로 감속비 다시 정하기'로 통과
    const c0 = await p.evaluate(() => ({ card: !!document.getElementById('stCalc'), wp: stCalc().rows.find(r => r.key === 'wheel_pred').ok, z2: design.z2 }));
    if (!c0.card || c0.wp) bad.push('공학 계산 표 ' + JSON.stringify(c0));
    await p.evaluate(() => document.getElementById('stCalc').scrollIntoView()); await shot('4c');
    await p.click('button[data-act="calcRpm"]'); await p.waitForTimeout(1500);
    const c1 = await p.evaluate(() => ({ wp: stCalc().rows.every(r => r.ok), z2: design.z2, src: design.motRpmSrc, g3: bubbleReadiness(P.design, model, P.ptest, P.tests, stCalc()).rows.filter(r => r.gate === 3).every(r => r.state === 'ok'), badC: model.checks.filter(c => c.st === 'bad').length }));
    if (!c1.wp || c1.z2 <= c0.z2 || c1.src !== 'calc' || !c1.g3 || c1.badC) bad.push('감속비 다시 정하기 ' + JSON.stringify(c1));
    const ver = await p.evaluate(() => model.verify.filter(r => r.ok === false).map(r => r.key));
    if (ver.length) bad.push('검증 미달 ' + ver.join());
    await p.click('#stBody button[data-go="5"]'); await p.waitForTimeout(500); await shot(5);
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }).catch(() => null), p.click('button[data-act="zip"]')]);
    let zipN = 0; if (dl) { const f = OUT + `bub_${W}.zip`; await dl.saveAs(f); const buf = fs.readFileSync(f); zipN = (buf.toString('latin1').match(/PK\x01\x02/g) || []).length;
      const names = buf.toString('utf8').match(/(parts|housing)\/[A-Za-z0-9_]+\.stl/g) || []; if (!names.some(n => /H1_head_body/.test(n)) || !names.some(n => /P1_ring_wheel/.test(n))) bad.push('zip 내용'); } else bad.push('zip 저장 안 됨');
    // 작동 준비도와 원리 시험편: 시험편 zip(파일 5개), 결과 기록 → 준비도 미달 → 잘 된 값으로 설계 바꾸기
    const rd0 = await p.evaluate(() => ({ ready: !!document.getElementById('stReady'), lbl: bubbleReadiness(P.design, model, P.ptest, P.tests).label }));
    if (!rd0.ready || rd0.lbl !== '움직이는 모형까지') bad.push('작동 준비도 ' + JSON.stringify(rd0));
    const [dl2] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }).catch(() => null), p.click('button[data-act="ptKit"]')]);
    if (dl2) { const f = OUT + `bub_test_${W}.zip`; await dl2.saveAs(f); const n = (fs.readFileSync(f).toString('latin1').match(/PK\x01\x02/g) || []).length; if (n !== 5) bad.push('시험편 zip 파일 수 ' + n); } else bad.push('시험편 zip 저장 안 됨');
    const dA = await p.evaluate(() => bubbleTestKit(P.design).dA), dD = await p.evaluate(() => P.design.ringD);
    await p.selectOption(`select[data-pt="A:${dD}"]`, 'no'); await p.waitForTimeout(300); await p.selectOption(`select[data-pt="A:${dA[0]}"]`, 'ok'); await p.waitForTimeout(300);
    await p.selectOption('select[data-pt="B:3.2"]', 'ok'); await p.waitForTimeout(300); await p.selectOption('select[data-pt="dist"]', '10'); await p.waitForTimeout(300);
    await p.evaluate(() => document.getElementById('stPTest').scrollIntoView()); await shot('5t');
    const rd1 = await p.evaluate(() => bubbleReadiness(P.design, model, P.ptest, P.tests).rows.filter(r => r.gate === 2).map(r => r.state).join());
    if (rd1 !== 'bad,test,ok') bad.push('원리 시험 판정 ' + rd1);
    await p.click('button[data-act="ptApply"]'); await p.waitForTimeout(1500);
    const rd2 = await p.evaluate(() => ({ d: design.ringD, t: design.wheelT, g2: bubbleReadiness(P.design, model, P.ptest, P.tests).rows.filter(r => r.gate === 2).map(r => r.state).join(), badC: model.checks.filter(c => c.st === 'bad').map(c => c.txt) }));
    if (rd2.d !== dA[0] || rd2.t !== 3.2 || rd2.g2 !== 'ok,ok,ok' || rd2.badC.length) bad.push('시험값 반영 ' + JSON.stringify(rd2));
    await p.evaluate(() => { P.ptest = null; P.bub = {}; P.design = stBubDesign(); setDesign(JSON.parse(JSON.stringify(P.design)), false); stRender(); }); await p.waitForTimeout(800);
    // 추가 항목: 링 지름 30(설계 입력), 전체 길이 ≤ 100(미달이어야), 직접 쓴 항목(미검증)
    await p.click('#stSteps button[data-st="1"]'); await p.waitForTimeout(400);
    await p.evaluate(() => { document.querySelector('#stBody details summary') && [...document.querySelectorAll('#stBody details')].forEach(d => d.open = true); });
    await p.selectOption('#rxNew', 'ringD'); await p.click('button[data-act="rxAdd"]'); await p.waitForTimeout(300);
    await p.fill('input[data-rx="0:value"]', '30'); await p.dispatchEvent('input[data-rx="0:value"]', 'change'); await p.waitForTimeout(1000);
    await p.selectOption('#rxNew', 'len'); await p.click('button[data-act="rxAdd"]'); await p.waitForTimeout(300);
    await p.fill('input[data-rx="1:value"]', '100'); await p.dispatchEvent('input[data-rx="1:value"]', 'change'); await p.waitForTimeout(800);
    await p.selectOption('#rxNew', ''); await p.click('button[data-act="rxAdd"]'); await p.waitForTimeout(300);
    await p.fill('input[data-rx="2:label"]', '색'); await p.dispatchEvent('input[data-rx="2:label"]', 'change'); await p.waitForTimeout(300);
    await p.fill('input[data-rx="2:value"]', '파랑'); await p.dispatchEvent('input[data-rx="2:value"]', 'change'); await p.waitForTimeout(300); await shot(8);
    const x1 = await p.evaluate(() => ({ ringD: design.ringD, ev: P.req.extra.map(x => m2mExtraEval(x, model).state).join() }));
    if (x1.ringD !== 30 || x1.ev !== 'ok,bad,unv') bad.push('추가 항목 ' + JSON.stringify(x1));
    await p.click('#stSteps button[data-st="4"]'); await p.waitForTimeout(500); await shot(9);
    if (!(await p.evaluate(() => /요청서 추가 항목/.test(document.getElementById('stBody').innerText)))) bad.push('시뮬레이션에 추가 항목 없음');
    // 부위별 사양과 동작: 총구 34 mm, 방아쇠 20 mm(3D는 2 mm라 미달), 링 바퀴 50 rpm(설계 입력), 새 부위 '물통 뚜껑'(미검증)
    await p.click('#stSteps button[data-st="1"]'); await p.waitForTimeout(400);
    const n0 = await p.evaluate(() => P.req.parts.length); if (n0 !== 5) bad.push('기본 부위 수 ' + n0);
    const setv = async (sel, v) => { await p.fill(sel, v); await p.dispatchEvent(sel, 'change'); await p.waitForTimeout(700); };
    await setv('input[data-ps="0:0:value"]', '34'); await setv('input[data-pm="1:0:t.stroke_mm"]', '20'); await setv('input[data-pm="4:0:t.rpm"]', '50');
    await p.fill('#ppNew', '물통 뚜껑'); await p.click('button[data-act="ppAdd"]'); await p.waitForTimeout(300);
    await p.click('button[data-act="psAdd"][data-p="5"]'); await p.waitForTimeout(300); await setv('input[data-ps="5:0:label"]', '여는 각도'); await setv('input[data-ps="5:0:value"]', '90');
    await p.click('button[data-act="pmAdd"][data-p="5"]'); await p.waitForTimeout(300); await p.selectOption('select[data-pm="5:0:kind"]', 'swing'); await p.waitForTimeout(500);
    await p.evaluate(() => document.getElementById('stParts').scrollIntoView()); await shot(10);
    await p.click('#stSteps button[data-st="4"]'); await p.waitForTimeout(600);
    await p.evaluate(() => { const f = [...document.querySelectorAll('#stBody legend')].find(l => /부위별/.test(l.textContent)); f && f.scrollIntoView(); }); await shot(11);
    const pt = await p.evaluate(() => ({ mz: design.muzzleD, rpm: design.wheelRpm, ev: P.req.parts.map(q => q.specs.map(x => m2mSpecEval(x, model).state).concat(q.motions.map(m => m2mMotionEval(q, m, model).state)).join('/')).join(' '), txt: /부위별 사양과 동작/.test(document.getElementById('stBody').innerText) }));
    if (pt.mz !== 34 || pt.rpm !== 50 || !pt.txt || pt.ev !== 'ok none/none/bad none none none/none/ok unv/unv') bad.push('부위 ' + JSON.stringify(pt));
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
