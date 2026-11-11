// ---- 제품 요청서 (G1): 모양 · 사람 입력 · 결과 효과 · 수치 · 제약 ----
// "움직임 하나"가 아니라 제품 하나를 말하는 문장을 다섯 칸으로 나눔. 규칙만 씀(AI 없이도 같은 결과).
const M2M_SHAPES = {
  gun: ['총 모양', /총|권총|gun|pistol|blaster/i, { length: 130, gripAngle: 105 }],
  box: ['상자 모양', /상자|박스|케이스|box|case/i, { length: 150, height: 100, width: 100 }],
  tube: ['원통 모양', /원통|통 ?모양|병|캔|cylinder|tube|bottle/i, { length: 150, diameter: 60 }],
  figure: ['인형·캐릭터', /인형|로봇|캐릭터|동물|새 ?모양|figure|doll|robot/i, { length: 120, height: 180, width: 80 }],
  vehicle: ['탈것 모양', /자동차|차 ?모양|기차|배 ?모양|비행기|car|train|vehicle/i, { length: 200, height: 90, width: 100 }],
};
const M2M_INPUTS = {
  trigger: ['방아쇠 당기기', /방아쇠|트리거|trigger/i, { stroke_mm: 20, force_N: 15 }],
  button: ['버튼 누르기', /버튼|단추|누르면|눌러|button|press/i, { stroke_mm: 5, force_N: 5 }],
  handle: ['손잡이 돌리기', /손잡이를? ?돌|핸들|크랭크를? ?돌|태엽|hand ?crank/i, { rpm: 60, force_N: 20 }],
  lever: ['레버 당기기·밀기', /레버|lever/i, { stroke_mm: 40, force_N: 20 }],
  pull: ['당기기', /당기면|당겨|잡아당|pull/i, { stroke_mm: 20, force_N: 15 }],
  switch: ['스위치 켜기', /스위치|켜면|전원|switch/i, {}],
  sensor: ['자동(센서)', /센서|감지|가까이 ?가면|자동으로|sensor|detect/i, {}],
};
const M2M_EFFECTS = {
  bubble: ['비누방울 만들기', /비누 ?방울|버블|bubble/i],
  wind: ['바람 내기', /바람|송풍|선풍|부채|wind|fan|blow/i],
  spray: ['물·액체 뿜기', /물총|분사|뿜|뿌리|spray|squirt/i],
  dispense: ['물건 내보내기', /배출|하나씩 ?나오|떨어뜨|자판기|dispens/i],
  launch: ['던지기·쏘기', /발사|쏘[아는기면]|날리|던지|launch|shoot|throw/i],
  light: ['빛 내기', /불빛|빛[이을]|LED|램프|light/i],
  sound: ['소리 내기', /소리|딸깍|음악|종|sound|bell/i],
};
function m2mRequest(text) {
  const t = String(text || ''), S = m2mParse(t), pick = (tbl) => { for (const [k, v] of Object.entries(tbl)) if (v[1].test(t)) return k; return null; };
  // 모양은 '○○ 모양/형상/형태/처럼 생긴'이나 그 자체로 제품인 낱말(권총·물총·인형·로봇)일 때만. "상자를 밀어"의 상자는 모양이 아님
  const SHAPE_STRONG = { gun: /권총|물총|장난감 ?총|pistol|blaster/i, figure: /인형|로봇|doll|robot/i };
  const shape = Object.keys(M2M_SHAPES).find(k => SHAPE_STRONG[k] && SHAPE_STRONG[k].test(t) || new RegExp('(' + M2M_SHAPES[k][1].source + ')\\s*(?:의\\s*)?(?:모양|형상|형태|처럼 ?생긴|같이 ?생긴)', 'i').test(t)) || null, input = pick(M2M_INPUTS);
  const effects = Object.entries(M2M_EFFECTS).filter(([, v]) => v[1].test(t)).map(([k]) => ({ id: k, kind: k, source: 'user' }));
  if (S.motion.value) effects.push({ id: 'motion', kind: 'motion', motion: S.motion.value, source: S.motion.source });
  // 비누방울·물총은 '나가다/나오다'가 효과를 뜻함 → 밀기 목적으로 잘못 읽은 것을 되돌림
  if (effects.some(e => e.kind !== 'motion') && !S.motion.value && S.purpose.source === 'user') S.purpose = { value: 'other', source: 'default' };
  const power = /손힘|손으로만|수동|건전지 ?없이|전기 ?없이|태엽/.test(t) ? 'hand' : /모터|건전지|배터리|충전|전기|usb/i.test(t) ? 'battery' : null;
  const R = {
    schema: 'm2m.request/1', text: t,
    shape: shape ? { value: shape, source: 'user', params: Object.fromEntries(Object.entries(M2M_SHAPES[shape][2]).map(([k, v]) => [k, { value: v, source: 'default' }])) } : { value: null, source: 'missing' },
    inputs: input ? [{ id: input, kind: input, source: 'user', params: Object.fromEntries(Object.entries(M2M_INPUTS[input][2]).map(([k, v]) => [k, { value: v, source: 'default' }])) }] : [],
    effects,
    power: power ? { value: power, source: 'user' } : { value: null, source: 'missing' },
    spec: S,
  };
  // 제품인가, 움직임 하나인가: 모양·사람 입력·움직임 아닌 효과 중 하나라도 있거나 효과가 둘 이상이면 제품
  R.kind = (shape || input || effects.some(e => e.kind !== 'motion') || effects.length > 1) ? 'product' : 'motion';
  return R;
}
// 제품 요청서에서 아직 모르는 것 → 질문 (값을 멋대로 채우지 않음)
function m2mReqShape(k, source) { return { value: k, source, params: Object.fromEntries(Object.entries(M2M_SHAPES[k][2]).map(([p, v]) => [p, { value: v, source: 'default' }])) }; }
function m2mReqInput(k, source) { return { id: k, kind: k, source, params: Object.fromEntries(Object.entries(M2M_INPUTS[k][2]).map(([p, v]) => [p, { value: v, source: 'default' }])) }; }
function m2mRequestQuestions(R) {
  if (R.kind !== 'product') return [];
  const q = [];
  if (!R.effects.length) q.push({ key: 'effects', ask: '결과로 무엇이 일어나야 하나요? (움직임, 바람, 비누방울, 빛, 소리 …)' });
  if (!R.inputs.length) q.push({ key: 'inputs', ask: '사람은 어떻게 작동시키나요? (방아쇠, 버튼, 손잡이 돌리기, 스위치, 자동)' });
  if (!R.power.value) q.push({ key: 'power', ask: '손힘만으로 움직여야 하나요, 건전지와 모터를 써도 되나요?', choices: [['hand', '손힘만'], ['battery', '건전지·모터 가능']] });
  if (!R.shape.value) q.push({ key: 'shape', ask: '겉모양이 정해져 있나요? (총, 상자, 원통, 인형, 탈것, 상관없음)' });
  return q;
}
const M2M_PNAME = { length: ['길이', 'mm'], height: ['높이', 'mm'], width: ['폭', 'mm'], diameter: ['지름', 'mm'], gripAngle: ['손잡이 각도', '°'], stroke_mm: ['행정', 'mm'], force_N: ['힘', 'N'], rpm: ['회전수', 'rpm'] };
// 요청서 칸을 고칠 때 허용 범위 (모양·입력 치수)
const M2M_PRANGE = { length: [60, 400], height: [40, 400], width: [20, 300], diameter: [20, 300], gripAngle: [95, 115], stroke_mm: [2, 80], force_N: [1, 60], rpm: [5, 200] };
