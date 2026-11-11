// 화면 시험: 스케치·그림 올리기 → (AI 흉내) 그림 해석으로 요청서 채우기 → 보강 제안 받아들이기
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
    const shot = async (n, id) => { await p.waitForTimeout(400); await p.evaluate(i => { const c = document.getElementById(i); c && c.scrollIntoView(); }, id); await p.screenshot({ path: OUT + `md_${W}_${n}.png` }); };
    const bad = [];
    await p.evaluate(() => { stAI = null; stImgOK = false; });
    await p.click('button[data-act="new"]'); await p.waitForTimeout(400);
    // 1) 스케치: 펜 · 직선 · 화살표 · 기준선(120 mm)
    const drag = async (tool, pts) => { await p.click(`button[data-act="skTool"][data-k="${tool}"]`); await p.waitForTimeout(150);
      await p.locator('#skCv').scrollIntoViewIfNeeded(); const r = await p.locator('#skCv').boundingBox(), at = ([x, y]) => [r.x + x * r.width, r.y + y * r.height];
      await p.mouse.move(...at(pts[0])); await p.mouse.down(); for (const q of pts.slice(1)) await p.mouse.move(...at(q), { steps: 4 }); await p.mouse.up(); };
    await drag('pen', [[0.2, 0.5], [0.3, 0.35], [0.5, 0.33], [0.7, 0.35], [0.75, 0.5], [0.5, 0.55], [0.2, 0.5]]);
    await drag('line', [[0.45, 0.55], [0.4, 0.85]]);
    await drag('arrow', [[0.42, 0.7], [0.34, 0.7]]);
    await drag('ref', [[0.2, 0.92], [0.75, 0.92]]);
    let s = await p.evaluate(() => stSk.strokes.map(x => x.tool).join());
    if (s !== 'pen,line,arrow,ref') bad.push('스케치 선 ' + s);
    await p.click('button[data-act="skSave"]'); await p.waitForTimeout(300);
    s = await p.evaluate(() => (P.media || []).length); if (s) bad.push('기준선 길이 없이 저장됨');
    await p.fill('#skRefMm', '120'); await p.dispatchEvent('#skRefMm', 'change'); await shot(1, 'mdCard');
    await p.click('button[data-act="skSave"]'); await p.waitForTimeout(500);
    if (errs.length) console.log('errs', errs); s = await p.evaluate(() => (P.media || []).map(m => [m.kind, m.refMm, m.src.slice(0, 14)]));
    if (s.length !== 1 || s[0][0] !== 'sketch' || s[0][1] !== 120 || s[0][2] !== 'data:image/png') bad.push('스케치 저장 ' + JSON.stringify(s));
    // 2) 그림 올리기
    const png = OUT + 'md_up.png'; await p.screenshot({ path: png, clip: { x: 0, y: 0, width: 300, height: 200 } });
    await p.setInputFiles('#mdFile', png); await p.waitForTimeout(800);
    s = await p.evaluate(() => ({ n: P.media.length, k: P.media[1] && P.media[1].kind, txt: document.getElementById('mdCard').innerText }));
    if (s.n !== 2 || s.k !== 'upload' || !/첨부 자료로만/.test(s.txt)) bad.push('올리기·AI 없음 안내 ' + JSON.stringify({ n: s.n, k: s.k }));
    // 3) AI 흉내: 그림 해석 → 보강 제안
    await p.evaluate(() => { window.__calls = []; stImgOK = true;
      stAI = { json: async (q, o) => { __calls.push({ q: q.slice(0, 60), imgs: o.images ? o.images.map(x => x instanceof Blob && x.size > 0) : null, ref: /120 mm/.test(q) });
        if (/fill a request form/.test(q)) return { summary: '방아쇠를 당기면 비누방울이 나오는 총 모양 장난감', reply: '총 모양 비누방울 장난감으로 읽었어요. 비누액 양은 그림에 없어요.',
          fills: [{ slot: 'ringD', value: 28, phrase: '총구 동그라미' }, { slot: 'power', value: 'battery', phrase: '건전지 그림' }, { slot: 'gunLen', value: 900, phrase: '기준선 비율' }],
          parts: [{ name: '방아쇠', link: 'trigger', motion: 'none' }, { name: '총구', link: 'muzzle' }] };
        return { items: [{ kind: 'value', slot: 'liquid', value: 50, why: '한 번 채워 10분은 놀 수 있게' }, { kind: 'value', slot: 'ringD', value: 999, why: '범위 밖' }, { kind: 'value', slot: 'rate', value: 'x' },
          { kind: 'part', name: '비누액 뚜껑', link: '', why: '쏟아짐 방지' }, { kind: 'note', text: '기어는 덮개로 가려 손가락이 닿지 않게', why: '아이 안전' }, { kind: 'part', name: '방아쇠', why: '중복' }] }; } };
      stRender(); });
    await shot(2, 'mdCard');
    await p.click('button[data-act="mdAI"]'); await p.waitForTimeout(1500);
    s = await p.evaluate(() => ({ calls: __calls, kind: P.req && P.req.kind, ringD: m2mSlotGet(P.req, 'ringD'), len: m2mSlotGet(P.req, 'gunLen'), power: P.req.power, parts: P.req.parts.map(x => x.name + ':' + x.source), sugg: (P.sugg || []).map(x => x.kind + ':' + (x.slot || x.name || x.text)), chat: document.getElementById('chCard').innerText }));
    if (s.calls.length !== 2 || !s.calls[0].imgs || s.calls[0].imgs.length !== 2 || !s.calls[0].imgs.every(Boolean) || !s.calls[0].ref) bad.push('AI 호출 ' + JSON.stringify(s.calls));
    if (s.kind !== 'product' || !s.ringD || s.ringD.value !== 28 || s.ringD.source !== 'ai' || (s.len && s.len.value === 900) || s.power.value !== 'battery') bad.push('그림 해석 반영 ' + JSON.stringify({ k: s.kind, r: s.ringD, l: s.len, p: s.power }));
    if (!s.parts.includes('방아쇠:ai') && !s.parts.some(x => /방아쇠/.test(x))) bad.push('부위 ' + s.parts);
    if (!/범위 밖이라 넣지 않음/.test(s.chat) || !/그림에서 읽은 설명/.test(s.chat)) bad.push('대화 기록');
    if (s.sugg.join() !== 'value:liquid,part:비누액 뚜껑,note:기어는 덮개로 가려 손가락이 닿지 않게') bad.push('제안 정리 ' + s.sugg.join());
    await shot(3, 'sgCard');
    // 4) 하나 받아들이고 나머지 모두 받아들이기
    await p.click('#sgCard button[data-act="sgTake"][data-i="0"]'); await p.waitForTimeout(400);
    s = await p.evaluate(() => m2mSlotGet(P.req, 'liquid')); if (!s || s.value !== 50 || s.source !== 'ai') bad.push('값 제안 반영 ' + JSON.stringify(s));
    await p.click('#sgCard button[data-act="sgNo"][data-i="1"]'); await p.waitForTimeout(300);
    s = await p.evaluate(() => ({ parts: P.req.parts.map(x => x.name), open: P.sugg.filter(x => x.state === 'open').length }));
    if (s.parts.includes('비누액 뚜껑') || s.open !== 1) bad.push('아니요 ' + JSON.stringify(s));
    await p.click('#sgCard button[data-act="sgTake"][data-i="2"]'); await p.waitForTimeout(400);
    s = await p.evaluate(() => ({ notes: P.req.notes, txt: document.getElementById('sgCard').innerText }));
    if (!s.notes || s.notes.length !== 1 || !/덧붙인 요구사항/.test(s.txt) || !/남은 제안이 없어요/.test(s.txt)) bad.push('요구사항 ' + JSON.stringify(s.notes));
    await shot(4, 'sgCard');
    // 5) 설계로 이어지는지: B안 링 지름 28
    const go = await p.$('button[data-go="2"]'); if (go) { await go.click(); await p.waitForTimeout(600); await p.click('.stCard button[data-act="cpick"][data-id="B"]').catch(() => bad.push('B안 버튼')); await p.waitForTimeout(1500);
      s = await p.evaluate(() => design && design.ringD); if (s !== 28) bad.push('설계 반영 ' + s); } else bad.push('개념안 버튼 없음');
    // 6) 다시 열어도 그림·요구사항이 남는지
    await p.reload(); await p.waitForTimeout(1500);
    s = await p.evaluate(() => { const L = JSON.parse(localStorage.getItem('m2m.projects') || '[]'); return JSON.stringify(L).length; });
    if (errs.length) bad.push('콘솔 ' + errs.join(' / '));
    console.log(W, bad.length ? 'FAIL ' + bad.join(', ') : '통과'); if (bad.length) process.exitCode = 1;
    await p.evaluate(() => localStorage.clear()); await p.close();
  }
  await b.close();
})();
