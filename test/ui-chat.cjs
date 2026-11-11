// 화면 시험: 대화로 요청서 완성 (규칙만 → 완성, AI 흉내 → 배운 표현 → AI 없이 다시 읽기)
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
    const shot = async n => { await p.waitForTimeout(400); await p.evaluate(() => { const c = document.getElementById('chCard'); c && c.scrollIntoView(); }); await p.screenshot({ path: OUT + `chat_${W}_${n}.png`, fullPage: W < 500 }); };
    const bad = [], say = async t => { await p.fill('#chIn', t); await p.press('#chIn', 'Enter'); await p.waitForTimeout(500); };
    // 1) 규칙만: 새 프로젝트에서 첫 문장 → 빈 칸을 하나씩 답해 완성
    await p.evaluate(() => { stAI = null; });
    await p.click('button[data-act="new"]'); await p.waitForTimeout(400);
    await say('총 모양이고 방아쇠를 당기면 비누방울이 나와야 해');
    let s = await p.evaluate(() => ({ kind: P.req && P.req.kind, ask: stChatAsk(), pr: m2mReqProgress(P.req) }));
    if (s.kind !== 'product' || s.ask !== 'power' || s.pr.done !== 3) bad.push('첫 문장 ' + JSON.stringify(s));
    await p.click('button[data-act="chPick"][data-v="battery"]'); await p.waitForTimeout(400);
    await say('3cm'); await say('1초에 5번'); await shot(1);
    await p.click('button[data-act="chSkip"]'); await p.waitForTimeout(400);
    await say('비누액은 30 mL는 들어가야 해');
    s = await p.evaluate(() => ({ ask: stChatAsk(), pr: m2mReqProgress(P.req), ringD: m2mSlotGet(P.req, 'ringD').value, rate: m2mSlotGet(P.req, 'rate').value, skip: P.req.skip, liq: m2mSlotGet(P.req, 'liquid').value, go: !!document.querySelector('#chCard button[data-go="2"]') }));
    if (s.ask !== null || s.pr.done !== s.pr.total || s.ringD !== 30 || s.rate !== 5 || s.liq !== 30 || s.skip.join() !== 'gunLen' || !s.go) bad.push('규칙 대화 ' + JSON.stringify(s));
    await shot(2);
    // 2) 요청서가 설계로 이어지는지: 개념안 → B안 → 링 지름 30
    await p.click('#chCard button[data-go="2"]'); await p.waitForTimeout(600); await p.click('.stCard button[data-act="cpick"][data-id="B"]'); await p.waitForTimeout(1500);
    const d = await p.evaluate(() => ({ ringD: design.ringD, rpm: design.wheelRpm })); if (d.ringD !== 30) bad.push('설계 반영 ' + JSON.stringify(d));
    // 3) AI 흉내: 규칙이 못 읽는 '큼직하게' → AI가 링 지름 35 → 배운 표현 저장
    await p.click('#stSteps button[data-st="1"]'); await p.waitForTimeout(400);
    await p.evaluate(() => { stAI = { json: async q => (/큼직하게/.test(q) ? { fills: [{ slot: 'ringD', value: 35, phrase: '큼직하게' }], reply: '방울을 크게 만들려면 링을 키우면 돼요.' } : { fills: [], reply: '' }) }; stRender(); });
    await p.click('button[data-act="chAskK"][data-k="rings"]').catch(() => bad.push('더 정하기 버튼 없음')); await p.waitForTimeout(300);
    await say('방울은 큼직하게 해줘'); await p.waitForTimeout(600); await shot(3);
    s = await p.evaluate(() => ({ r: m2mSlotGet(P.req, 'ringD'), lex: M2M_LEX, txt: document.getElementById('chCard').innerText }));
    if (s.r.value !== 35 || s.r.source !== 'ai' || !s.lex.some(l => l.phrase === '큼직하게') || !/배운 표현/.test(s.txt)) bad.push('AI 대화 ' + JSON.stringify({ r: s.r, lex: s.lex }));
    // 4) AI 없이 새 프로젝트: 배운 표현으로 읽음
    await p.evaluate(() => { stAI = null; }); await p.click('#stSteps button[data-st="0"]').catch(() => {}); await p.waitForTimeout(300);
    await p.click('button[data-act="new"]'); await p.waitForTimeout(400);
    await say('총 모양 비누방울 장난감, 방울은 큼직하게');
    s = await p.evaluate(() => m2mSlotGet(P.req, 'ringD')); if (!s || s.value !== 35 || s.source !== 'ai') bad.push('배운 표현 다시 읽기 ' + JSON.stringify(s));
    await shot(4);
    if (errs.length) bad.push('콘솔 ' + errs.join(' / '));
    console.log(W, bad.length ? 'FAIL ' + bad.join(', ') : '통과'); if (bad.length) process.exitCode = 1;
    await p.evaluate(() => localStorage.clear()); await p.close();
  }
  await b.close();
})();
