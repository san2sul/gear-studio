// 시험: 모든 동작 기구 × 동력원이 만들어지고 메시가 닫혀 있는지, 규격 부품이 모두 닫힌 메시인지
const C = require('./core.cjs');
let fail = 0; const ok = (c, msg) => { if (!c) { fail++; console.log('FAIL', msg); } };
function openEdges(tris) {
  const E = new Map(), key = p => p.map(v => v.toFixed(3)).join(',');
  for (const t of tris) { const P = [key(t.slice(0, 3)), key(t.slice(3, 6)), key(t.slice(6, 9))]; for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) { const k = P[a] + '|' + P[b]; E.set(k, (E.get(k) || 0) + 1); } }
  let bad = 0; for (const [k, c] of E) { const [a, b] = k.split('|'); if ((E.get(b + '|' + a) || 0) !== c) bad++; } return bad;
}
// 1. 동작 기구
for (const ty of C.LK_TYPES) for (const [mo, red] of [['none', 'auto'], ['auto', 'auto'], ['nema17', 3], ['n20_30', 'auto'], ['sg90c', 'auto'], ['tt', 'auto']]) {
  const D = C.linkageDefault(); D.type = ty; D.drive.motor = mo; D.drive.red = red;
  let M; try { M = C.buildModel(D); } catch (e) { ok(false, `${ty}/${mo}: ${e.message}`); continue; }
  const clash = M.checks.find(c => /움직이는 동안/.test(c.txt));
  ok(clash && clash.st === 'ok', `${ty}/${mo}/${red}: 움직이는 동안 겹침 ${clash && clash.txt.replace(/<[^>]+>/g, '')}`);
  M.parts.concat(M.housing).forEach(h => ok(openEdges(h.tris) === 0, `${ty}/${mo}: ${h.file} 메시가 열려 있음`));
  ok(Array.isArray(M.bom) && M.bom.length > 0, `${ty}/${mo}: 부품 목록 없음`);
}
// 2. 규격 부품: 모든 종류 × 선택지
for (const [cat, S] of Object.entries(C.STD)) {
  const p = {}; S.f.forEach(([k, , v]) => p[k] = v);
  const vs = [p]; S.f.forEach(([k, , v, o]) => { if (Array.isArray(o)) o.forEach(x => { const val = Array.isArray(x) ? x[0] : x; if (val !== v) vs.push({ ...p, [k]: val }); }); });
  for (const q of vs) { let M; try { M = C.buildModel({ kind: 'std', items: [{ cat, p: q, n: 1 }] }); } catch (e) { ok(false, `${cat} ${JSON.stringify(q)}: ${e.message}`); continue; }
    ok(M.parts.length > 0, `${cat}: 부품 없음`); M.parts.forEach(pt => ok(openEdges(pt.tris) === 0, `${cat} ${JSON.stringify(q)}: 메시가 열려 있음`)); }
}
// 3. 구입 부품 모형
{ const D = C.linkageDefault(); D.type = 'jansen'; const M = C.buildModel(D), P = C.proxyParts(M.bom);
  ok(P.some(p => /motor_/.test(p.file)) && P.some(p => /screw_/.test(p.file)), '얀센: 모터·볼트 모형이 없음'); P.forEach(p => ok(openEdges(p.tris) === 0, `모형 ${p.file} 메시가 열려 있음`)); }
console.log(fail ? `${fail}개 실패` : '모두 통과'); process.exit(fail ? 1 : 0);
