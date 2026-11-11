// ---- 대화로 요청서 완성하기: 칸(slot) 목록 + 규칙 추출기 + 배운 표현 ----
// 원칙: 무엇이 비었는지, 무엇을 물을지, 값이 범위 안인지는 앱(규칙)이 정함. AI는 규칙이 못 읽은 말만 칸 값으로 옮김.
let M2M_LEX = [];   // 배운 표현 [{phrase, slot, value|null}] — 화면이 localStorage에서 채움
const m2mFx = (R, k) => R.effects.some(e => e.kind === k);
const m2mGun = R => R.shape.value === 'gun';
// 단위 묶음: 읽은 단위 → [묶음, 칸 단위로 바꾸는 배수]
const M2M_UNITS = { mm: ['len', 1], 밀리미터: ['len', 1], 미리: ['len', 1], cm: ['len', 10], 센티미터: ['len', 10], 센티: ['len', 10], '°': ['ang', 1], 도: ['ang', 1], 개: ['cnt', 1],
  번: ['times', 1], 방울: ['times', 1], ml: ['vol', 1], mL: ['vol', 1], cc: ['vol', 1], 밀리리터: ['vol', 1], 리터: ['vol', 1000], g: ['mass', 1], 그램: ['mass', 1], kg: ['mass', 1000], 킬로그램: ['mass', 1000], 킬로: ['mass', 1000], N: ['force', 1], 뉴턴: ['force', 1], rpm: ['rpm', 1], 알피엠: ['rpm', 1] };
const M2M_SLOTS = {
  effects: { ko: '결과 효과', cat: true, req: true, ask: '결과로 무엇이 일어나야 하나요?', need: () => true, has: R => R.effects.length > 0,
    choices: () => Object.entries(M2M_EFFECTS).map(([k, v]) => [k, v[0]]), read: t => Object.keys(M2M_EFFECTS).find(k => M2M_EFFECTS[k][1].test(t)) || null,
    set: (R, v, src) => { if (!R.effects.some(e => e.kind === v)) R.effects.push({ id: v, kind: v, source: src }); }, show: v => M2M_EFFECTS[v][0] },
  inputs: { ko: '사람이 작동시키는 방법', cat: true, req: true, ask: '사람은 무엇으로 작동시키나요?', need: () => true, has: R => R.inputs.length > 0,
    choices: () => Object.entries(M2M_INPUTS).map(([k, v]) => [k, v[0]]), read: t => Object.keys(M2M_INPUTS).find(k => M2M_INPUTS[k][1].test(t)) || null,
    set: (R, v, src) => { R.inputs = [m2mReqInput(v, src)]; }, show: v => M2M_INPUTS[v][0] },
  power: { ko: '동력', cat: true, req: true, ask: '손힘만으로 움직여야 하나요, 건전지와 모터를 써도 되나요?', need: () => true, has: R => !!R.power.value,
    choices: () => [['hand', '손힘만'], ['battery', '건전지·모터 가능']], show: v => v === 'hand' ? '손힘만' : '건전지·모터 가능',
    read: (t, asked) => /손힘|손으로만|수동|태엽|(전기|건전지|배터리|모터) ?(없이|안 ?(돼|됨|써))/.test(t) ? 'hand' : /모터|건전지|배터리|충전|전기|usb/i.test(t) || asked && /써도|괜찮|돼요|됩니다|좋아요|가능/.test(t) ? 'battery' : null,
    set: (R, v, src) => { R.power = { value: v, source: src }; } },
  shape: { ko: '겉모양', cat: true, req: true, ask: '겉모양이 정해져 있나요?', need: () => true, has: R => !!R.shape.value,
    choices: () => Object.entries(M2M_SHAPES).map(([k, v]) => [k, v[0]]), show: v => M2M_SHAPES[v][0],
    read: (t, asked) => Object.keys(M2M_SHAPES).find(k => asked ? M2M_SHAPES[k][1].test(t) : new RegExp('(' + M2M_SHAPES[k][1].source + ')\\s*(?:의\\s*)?(?:모양|형상|형태|처럼 ?생긴|같이 ?생긴)', 'i').test(t) || /권총|물총|장난감 ?총/.test(t) && k === 'gun') || null,
    set: (R, v, src) => { R.shape = m2mReqShape(v, src); if (!(R.parts || []).length) R.parts = m2mPartsFrom(v); } },
  ringD: { ko: '비누방울 링 지름', unit: 'mm', grp: 'len', range: [10, 50], req: true, kw: /링|고리|방울/, need: R => m2mFx(R, 'bubble'), at: ['part', 'wheel', 'ringD'],
    ask: '방울을 만드는 링(고리)의 지름은 몇 mm가 좋을까요? 보통 20~30 mm예요.' },
  rate: { ko: '1초에 방울 만드는 횟수', unit: '번/초', grp: 'times', range: [0.5, 15], req: true, kw: /초당|1 ?초에|일 ?초에|매 ?초/, need: R => m2mFx(R, 'bubble'), at: ['extra', 'rate'],
    ask: '1초에 방울을 몇 번쯤 만들어야 하나요? (예: 4번)' },
  gunLen: { ko: '총 전체 길이', unit: 'mm', grp: 'len', range: [100, 200], req: true, kw: /길이|전장|길게|크기/, need: m2mGun, at: ['shape', 'length'],
    ask: '총의 전체 길이는 몇 mm쯤이면 좋을까요? (100~200 mm)' },
  liquid: { ko: '비누액 담는 양', unit: 'mL', grp: 'vol', range: [5, 1000], req: true, op: '≥', kw: /비누액|물통|액|담/, need: R => m2mFx(R, 'bubble'), at: ['extra', 'liquid'],
    ask: '비누액은 적어도 몇 mL 담겨야 하나요? (예: 20 mL)' },
  rings: { ko: '링 개수', unit: '개', grp: 'cnt', range: [3, 10], kw: /링|고리/, need: R => m2mFx(R, 'bubble'), at: ['part', 'wheel', 'rings'], ask: '바퀴에 링을 몇 개 달까요? (3~10개)' },
  gripAngle: { ko: '손잡이 기울기', unit: '°', grp: 'ang', range: [95, 115], kw: /손잡이|그립|기울/, need: m2mGun, at: ['shape', 'gripAngle'], ask: '손잡이는 총열과 몇 도를 이루면 좋을까요? (95~115°)' },
  muzzleD: { ko: '총구 구멍 지름', unit: 'mm', grp: 'len', range: [20, 60], kw: /총구|입구|구멍/, need: R => m2mGun(R) && m2mFx(R, 'bubble'), at: ['part', 'muzzle', 'muzzleD'], ask: '총구 구멍 지름은 몇 mm로 할까요?' },
  trigStroke: { ko: '방아쇠 당기는 거리', unit: 'mm', grp: 'len', range: [1, 40], kw: /방아쇠|당기는 ?거리/, need: R => R.inputs.some(i => i.kind === 'trigger'), at: ['part', 'trigger', 'trigStroke'], ask: '방아쇠는 몇 mm 당겨지면 좋을까요?' },
  trigForce: { ko: '방아쇠 당기는 힘', unit: 'N', grp: 'force', range: [1, 60], op: '≤', kw: /힘|방아쇠/, need: R => R.inputs.some(i => i.kind === 'trigger'), at: ['part', 'trigger', 'trigForce'], ask: '방아쇠를 당기는 힘은 몇 N 이하여야 하나요?' },
  wheelRpm: { ko: '링 바퀴 회전수', unit: 'rpm', grp: 'rpm', range: [10, 90], kw: /바퀴|회전/, need: R => m2mFx(R, 'bubble') && R.power.value !== 'hand', at: ['motion', 'wheel', 'rpm'], ask: '링 바퀴가 1분에 몇 바퀴 돌면 좋을까요?' },
  weight: { ko: '무게', unit: 'g', grp: 'mass', range: [10, 5000], op: '≤', kw: /무게|무거|가벼/, need: R => R.kind === 'product', at: ['extra', 'weight'], ask: '무게는 몇 g 이하여야 하나요?' },
};
// 부위가 없으면 모양 템플릿(없으면 빈 부위)에서 하나 만듦
function m2mPartFor(R, link) {
  R.parts = R.parts || []; let pt = R.parts.find(p => p.link === link); if (pt) return pt;
  const T = (M2M_PART_TPL[R.shape.value] || M2M_PART_TPL.gun).find(t => t.link === link);
  pt = { id: 'pt' + link, name: T ? T.name : M2M_PLINKS[link], link, source: 'default', specs: [], motions: [] }; R.parts.push(pt); return pt;
}
// 칸의 현재 값 (없으면 null)
function m2mSlotGet(R, k) {
  const S = M2M_SLOTS[k], a = S.at; if (!a) return S.has(R) ? true : null;
  if (a[0] === 'part') { const pt = (R.parts || []).find(p => p.link === a[1]), x = pt && pt.specs.find(s => s.key === a[2]); return x && x.value !== '' ? x : null; }
  if (a[0] === 'extra') { const x = (R.extra || []).find(e => e.key === a[1]); return x && x.value !== '' ? x : null; }
  if (a[0] === 'shape') { const x = R.shape.params && R.shape.params[a[1]]; return x && x.source !== 'default' ? x : null; }
  if (a[0] === 'motion') { const pt = (R.parts || []).find(p => p.link === a[1]), m = pt && pt.motions.find(q => q.kind === 'rotate'); return m && m.traits && m.traits[a[2]] !== '' && m.traits[a[2]] != null ? { value: m.traits[a[2]], source: m.source } : null; }
}
function m2mSlotSet(R, k, v, src) {
  const S = M2M_SLOTS[k], a = S.at; if (!a) return S.set(R, v, src);
  if (a[0] === 'part') { const pt = m2mPartFor(R, a[1]); let x = pt.specs.find(s => s.key === a[2]); if (!x) pt.specs.push(x = { key: a[2], op: M2M_PSPEC[a[2]].op }); Object.assign(x, { value: v, source: src }); if (S.op) x.op = S.op; }
  else if (a[0] === 'extra') { R.extra = R.extra || []; let x = R.extra.find(e => e.key === a[1]); if (!x) R.extra.push(x = { key: a[1], op: M2M_EXTRA[a[1]].op }); Object.assign(x, { value: v, source: src }); }
  else if (a[0] === 'shape') { if (!R.shape.params) return; R.shape.params[a[1]] = { value: v, source: src }; }
  else if (a[0] === 'motion') { const pt = m2mPartFor(R, a[1]); let m = pt.motions.find(q => q.kind === 'rotate'); if (!m) pt.motions.push(m = { kind: 'rotate', when: '', traits: {} }); m.traits = { ...m.traits, [a[2]]: v }; m.source = src; }
  R.skip = (R.skip || []).filter(s => s !== k);
}
const m2mSlotOn = (R, k) => R.kind === 'product' && M2M_SLOTS[k].need(R);
// 아직 정하지 않은 칸 (꼭 채울 칸 / 더 정할 수 있는 칸). '상관없음'으로 넘긴 칸은 기본값을 씀
function m2mReqMissing(R, optional = false) {
  return Object.keys(M2M_SLOTS).filter(k => !!M2M_SLOTS[k].req !== optional && m2mSlotOn(R, k) && m2mSlotGet(R, k) == null && !(R.skip || []).includes(k));
}
function m2mReqProgress(R) { const on = Object.keys(M2M_SLOTS).filter(k => M2M_SLOTS[k].req && m2mSlotOn(R, k)); return { total: on.length, done: on.length - m2mReqMissing(R).length }; }
// 값 검사: 범위 밖이면 이유를 돌려줌
function m2mSlotCheck(k, v) {
  const S = M2M_SLOTS[k]; if (!S) return '모르는 칸';
  if (S.cat) return S.choices().some(([c]) => c === v) ? null : '고를 수 없는 값';
  if (!isFinite(+v)) return '숫자가 아님';
  return +v >= S.range[0] && +v <= S.range[1] ? null : `${S.range[0]}~${S.range[1]} ${S.unit} 밖`;
}
const m2mSlotText = (k, v) => { const S = M2M_SLOTS[k]; return S.cat ? `${S.ko}: ${S.show(v)}` : `${S.ko} ${fmt(v, 1)} ${S.unit}`; };
// 규칙 추출기: 글 → [{slot, value, phrase, how: 'rule'|'lex'|'answer', err?}]
// asked = 바로 앞에 앱이 물은 칸 → 단위 없는 숫자나 짧은 답을 그 칸 답으로 읽음
function m2mExtract(text, R, asked = null, lex = M2M_LEX) {
  const t = String(text || ''), out = [], taken = new Set(), add = (slot, value, phrase, how) => { if (taken.has(slot)) return; taken.add(slot); out.push({ slot, value, phrase, how, err: m2mSlotCheck(slot, value) }); };
  // 1) 배운 표현 (값까지 배운 것)
  for (const L of lex) if (L.value != null && L.phrase && t.includes(L.phrase) && M2M_SLOTS[L.slot]) add(L.slot, L.value, L.phrase, 'lex');
  // 2) 고르는 칸
  for (const k of ['effects', 'inputs', 'power', 'shape']) { const v = M2M_SLOTS[k].read(t, asked === k); if (v) add(k, v, '', asked === k ? 'answer' : 'rule'); }
  // 3) '초당 5개'처럼 단위 앞에 기준이 오는 횟수
  let masked = t.replace(/(초당|1 ?초에|일 ?초에|매 ?초)\s*(\d+(?:\.\d+)?)\s*(개|번|방울)?/g, (m, a, n) => { add('rate', +n, m.trim(), 'rule'); return ' '.repeat(m.length); });
  // 4) 숫자 + 단위: 앞쪽 글(직전 숫자 뒤부터, 최대 24자)에서 가장 가까운 칸 낱말을 찾음
  const NUM = /(\d+(?:\.\d+)?)(?![\d.])\s*(밀리리터|밀리미터|미리|mm|cm|센티미터|센티|°|도|개|번|방울|mL|ml|cc|리터|kg|킬로그램|킬로|g|그램|N|뉴턴|rpm|알피엠)?(?![a-zA-Z0-9])(?!\s*(?:초|분|시간|%|퍼센트|배|살|단계|층|차|월|일|년|시))/g;
  let m, prev = 0; const nums = [];
  while ((m = NUM.exec(masked))) { nums.push({ n: +m[1], u: m[2] || null, i: m.index, end: m.index + m[0].length, raw: m[0] }); }
  for (const x of nums) {
    const ctx = masked.slice(Math.max(prev, x.i - 24), x.i); prev = x.end; const U = x.u ? M2M_UNITS[x.u] : null;
    const alias = lex.filter(L => L.value == null && L.phrase && ctx.includes(L.phrase));
    let best = null, bestPos = -1;
    for (const [k, S] of Object.entries(M2M_SLOTS)) { if (S.cat || taken.has(k) || (U && S.grp !== U[0])) continue;
      const kp = S.kw ? ctx.search(new RegExp('(' + S.kw.source + ')(?![\\s\\S]*(' + S.kw.source + '))')) : -1, ap = Math.max(-1, ...alias.filter(L => L.slot === k).map(L => ctx.lastIndexOf(L.phrase)));
      const pos = Math.max(kp, ap); if (pos > bestPos) { best = k; bestPos = pos; } }
    // 낱말이 없을 때: 앞에서 물은 칸이 받을 수 있는 단위이면 그 답, 아니면 그 단위를 받는 칸이 하나뿐일 때
    if (!best && asked && M2M_SLOTS[asked] && !M2M_SLOTS[asked].cat && !taken.has(asked) && (!U || M2M_SLOTS[asked].grp === U[0])) best = asked;
    if (!best && U) { const only = Object.keys(M2M_SLOTS).filter(k => M2M_SLOTS[k].grp === U[0] && !taken.has(k) && (!R || m2mSlotOn(R, k))); if (only.length === 1 && ['vol', 'mass', 'force', 'rpm'].includes(U[0])) best = only[0]; }
    if (!best || !U && bestPos < 0 && best !== asked) continue;
    add(best, +(x.n * (U ? U[1] : 1)).toFixed(3), (ctx.slice(Math.max(0, bestPos)) + x.raw).trim(), best === asked && bestPos < 0 ? 'answer' : alias.length ? 'lex' : 'rule');
  }
  return out;
}
// 읽은 것을 요청서에 넣음. AI 추정이 사람이 넣은 값을 덮지 않게 함
// overwrite: 대화의 마지막 말을 AI가 읽은 것 → 그 사람이 지금 바꾸라고 한 것이므로 사람 값도 바꿈 (표시는 AI 추정)
function m2mApplyFound(R, found, src, overwrite = false) {
  const done = [];
  for (const f of found) { if (f.err) continue; const cur = M2M_SLOTS[f.slot].at ? m2mSlotGet(R, f.slot) : null;
    if (src === 'ai' && !overwrite && cur && cur.source === 'user') continue;
    if (src === 'ai' && !overwrite && !M2M_SLOTS[f.slot].at && f.slot !== 'effects' && M2M_SLOTS[f.slot].has(R)) continue;
    if (M2M_SLOTS[f.slot].at && R.kind !== 'product') continue;
    m2mSlotSet(R, f.slot, f.value, f.how === 'lex' ? 'ai' : src); done.push(f); }
  if (R.kind !== 'product' && (R.shape.value || R.inputs.length || R.effects.some(e => e.kind !== 'motion'))) R.kind = 'product';
  return done;
}
// AI가 채운 말 중 규칙이 못 읽은 표현을 배움 (같은 표현은 한 번만)
function m2mLearn(lex, text, fills, ruleFound) {
  const L = lex.slice(), got = new Set(ruleFound.map(f => f.slot)), added = [];
  for (const f of fills) { const p = String(f.phrase || '').trim(); if (!p || p.length < 2 || p.length > 30 || !String(text).includes(p) || got.has(f.slot) || m2mSlotCheck(f.slot, f.value)) continue;
    const hasNum = /\d/.test(p), e = { phrase: hasNum ? p.replace(/\s*\d[\s\S]*$/, '').trim() : p, slot: f.slot, value: hasNum ? null : f.value };
    if (e.phrase.length < 2 || L.some(x => x.phrase === e.phrase && x.slot === e.slot)) continue; L.push(e); added.push(e); }
  return { lex: L.slice(-200), added };
}
