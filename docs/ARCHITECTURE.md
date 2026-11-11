# 구조와 앞으로의 방향

목표: 알려진 운동·동작·기계 부품·동력원을 하나의 체계로 묶어, 여러 운동이 섞인 장치를 설계하고 조립·시뮬레이션한 뒤 출력할 수 있게 하는 것.

전부를 한 번에 넣을 수는 없으므로, **무엇이든 계속 추가할 수 있는 뼈대**를 먼저 세우고 목록(기구·부품·동력원)을 늘려 갑니다.

## 1. 지금 구조 (v16)

| 층 | 위치 | 하는 일 |
|---|---|---|
| 기하 | `src/core` | 인벌류트 치형, 돌출·회전 메시, 좌표 변환, STL·ZIP·SCAD 쓰기 |
| 동력원 | `src/core/drive.js` | 모터 규격(MOTORS), 토크·회전수 추천, 마운트, 배선·코드 |
| 기구 | `src/mechanisms` | 기구마다 `design → model` 함수 (부품·움직임·검사·부품표) |
| 부품 목록 | `src/catalog` | 규격 부품(STD), 부품표에서 만드는 구입 부품 모형 |
| 화면 | `src/ui` | 탭, 3D 보기, 내보내기 |

모든 기구는 같은 `model` 모양을 돌려줍니다.

```
model = {
  parts:   [{ name, file, tris, motion(t) → 3×4 행렬, print?, clash? }],   // 움직이는 부품
  housing: [{ name, file, tris }],                                        // 고정 부품
  rods, extras, checks, hud, table, bom, steps, kit, scad()
}
```

한계: 기구 하나가 탭 하나에 따로 있어, **여러 기구를 이어 하나의 장치로 만들 수 없습니다.**

## 2. 공통 부품 모델: 연결점(포트)

모든 기구 모델에 `ports`를 더합니다. 포트는 다른 기구와 이어지는 자리입니다.

```
port = {
  id: 'in' | 'out' | 'outA' | ...,
  kind: 'rot' | 'lin',            // 회전축 / 직선 이동
  at: [x, y, z], dir: [dx, dy, dz], // 기구 좌표에서 위치와 축 방향
  shaft: { d, dcut },             // 끼울 축 규격
  role: 'in' | 'out',
  of: θin → 값                    // 출력: 입력 각도에 대한 출력 각도(rad) 또는 변위(mm)
}
```

이음 종류 (단계적으로 추가):

| 이음 | 뜻 | 계산 |
|---|---|---|
| `shaft` | 같은 축으로 직결 (커플링) | θB = θA |
| `mesh` | 기어 물림 | θB = −θA · zA/zB |
| `belt` | 벨트·체인 | θB = θA · zA/zB |
| `rack` | 회전 ↔ 직선 | x = θ · r |
| `cam` | 캠 접촉 | 변위 선도 |
| `joint` | 핀·볼 관절 (링크 사이) | 구속 풀이 |

## 3. 조립 작업대

### v17 구현 메모
- 포트 각도는 포트 `dir`(축이 밖으로 나가는 방향) 둘레 오른손 각도. 입력 각도 θin = `ports.rate`·t.
- 출력 `of(θin)`은 입력 한 바퀴를 720등분해 잰 표 + 바퀴마다 늘어나는 양(adv). 간헐·흔들림·직선 모두 같은 방식.
- 이음: 앞 출력 각도 a(앞 축 둘레) → 뒤 각도 b = a·(1 | −zA/zB | zA/zB) → 뒤 기구 입력 θ = −b (뒤 입력 dir = −앞 dir).
- 자세: 뒤 기구 입력 dir 를 앞 출력 dir 반대로 돌리고, 입력 자리를 앞 출력 + dir·g + 옆·거리로. '자동'이면 상자가 덜 겹치는 방향·더 긴 벨트를 고름.
- v18: 부하 거슬러 계산 (뒤 입력 토크 × 최대 속도비 ÷ 효율을 앞에 더함, 1번 기구 drive.extraT 로 모터 다시 고름), 공통 바탕판·기둥 (linkage D.cornerHoles, model.feet).
- v19: 직선 출력 → 랙·피니언 이음 (랙은 움직이는 부품 옆에 붙고, 피니언 축 위로 뒤 기구). 직선 포트 값은 표 없이 바로 잼(리드스크루 되돌아옴 반영).
- v26: 비누방울 총 세로 한 줄(G2~G6). src/products/bubble.js: M2M_FUNCS(기능 in/out), M2M_FX_FUNCS(효과→core·ifMotor·ifHand), m2mDecompose, M2M_SOLS(해법 카드, needs·power), m2mConcepts(조합→탈락 이유→점수, 이름 붙은 A·B·C), bubbleDesign(링 지름·개수·바퀴 rpm·전압 → R, z2, motRpm 역산), bubbleGeom, bubbleModel(kind 'bubble': 링 바퀴·기어 2·팬·통·방아쇠 + 구입 부품 모형, 껍데기 4조각(머리 몸체·앞 덮개·몸통 좌우 반, stripPoly 벽), verify 표·간격 검사·BOM·steps·scad=STL 배치). 화면 src/ui/studio-product.js(ST_PSTEPS, stConcepts/stPDesign/stPSim/stPMake, P.bub, P.tests). 화면 시험 test/ui-bubble.cjs.
- v25: 제품 요청서(G1). src/studio/product.js: m2mRequest(text) → {kind product|motion, shape(M2M_SHAPES), inputs(M2M_INPUTS), effects(M2M_EFFECTS + 움직임), power hand|battery|null, spec}, m2mRequestQuestions. 동력 기본값(dc_motor) 없앰, 움직임을 모르면 m2mRecommend가 blocked:'motion'. 화면: 동작 정의에 제품 요청서 카드(P.req), 기능 분해·개념안·껍데기는 '미구현' 표시. 확장 설계: https://claude.ai/artifact/38w6YXtEX1dCWwvNymjW5g (G1~G6)
- v24: Motion-to-Machine Studio. 첫 화면 = "동작으로 설계"(src/ui/studio.js, 여섯 단계), 기존 탭 = "전문 도구". 엔진 src/studio/core.js: M2M_MOTIONS/PURPOSES/TRAITS 분류, m2mParse(규칙 해석, 값마다 source), m2mQuestions, m2mFilled(빈 값 → default), M2M_KB(기구 카드: synth 역산·measure 재측정·range·장단점), m2mEval(역산→buildModel→linkMotion 재측정→요구치 1% 비교), m2mRecommend. AI 해석은 Artifact sample 기능(claude.use('sample').json)으로 명세서만 만들고 출처 'ai'로 표시. 프로젝트는 localStorage m2m.projects / m2m.p.<id>, 파일 .m2m.json(schema m2m.project/1). 설계 문서: https://claude.ai/artifact/PrD212deZJKQXu4JUB5Agi
- v23: 프린터 보정. core/files.js 의 FIT {outer, hole, backlash}: extrudeTris 가 테두리를 fitOffset 으로 줄이고 구멍을 키움(테두리·다른 구멍과 0.4 mm 여유를 남기게 줄임), gearOutline 이 백래시를 더함. fitCoupon()(drive.js)은 fitZero 로 보정 없이 시험편을 만듦. 값은 ui/fit.js 가 localStorage 'gearStudio.fit' 에 둠. 기본 0이라 시험·설계는 그대로.
- v22: 닫힌 고리(tie).
- v21: 갈래(src)와 크기별 규칙. buildModel(D, { sub: true })는 크기 점검을 건너뜀(조립 안의 기구용).
- v20: 새 기구 6종. 기구 하나 = LK_X[type] { def, ko, mono, pose, y, build } 만 더하면 동작 기구 탭·포트·조립 작업대·동작으로 찾기에 함께 들어감.
- 남은 일: 갈래(한 입력 → 여러 출력), 닫힌 고리, 크기별 규칙.

```
assembly = {
  modules: [{ id, design, pose: { x, y, z, rz } }],      // 기구·설계 부품·규격 부품
  links:   [{ from: [모듈, 포트], to: [모듈, 포트], kind: 'shaft' | 'mesh' | 'belt' | ... }],
  driver:  { module, port, source: 동력원, rpm }
}
```

- 연결하면 받는 쪽 모듈의 입력 포트를 보내는 쪽 출력 포트 자리로 옮깁니다(자세 자동 맞춤).
- 시뮬레이션: 동력원의 각도에서 시작해 이음을 따라 각 모듈의 입력 각도를 구하고, 모듈마다 `motion`을 그 각도로 돌립니다. 토크는 반대 방향으로 거슬러 올라가며 효율·비를 곱해 동력원 여유를 검사합니다.
- 검사: 모듈 사이 간섭(움직이는 동안), 축 규격 맞음, 회전 방향, 동력원 토크 여유.
- 내보내기: 모든 모듈의 부품 + 이음 부품(커플링·벨트) + 부품표 합치기.

1단계는 직렬(한 줄로 이어지는) 구동 사슬만 다루고, 2단계에서 갈래(한 입력 → 여러 출력)와 닫힌 고리(링크끼리 이어진 기구)를 다룹니다.

## 4. 크기별 규칙

| 범위 | 기준 |
|---|---|
| 아주 작음 (부품 < 10 mm) | 노즐 0.4 mm로는 1~2 mm 아래 형상이 뭉개짐. 모듈 ≥ 0.5, 레진 출력 권장 표시 |
| 보통 (10~200 mm) | 지금 기본값 |
| 큼 (출력판 초과) | 부품을 나눠 출력(맞춤 핀·도브테일), 금속 축·프로파일 보강, 강도 검사를 하중 기준으로 |
| 아주 큼 (> 1 m) | 출력물은 모형·지그용, 실제 동력 전달은 금속 부품 표시 |

## 5. 개발 순서

1. 파일 나누기, 빌드, 시험 ← **완료 (v16)**
2. 기구 모델에 포트 붙이기 ← **동작 기구 8종 완료 (v17, `src/assembly/ports.js`)**. 기어류는 입력·출력 축 막대에서 자동으로 찾음(시험 전)
3. 조립 작업대 1단계: 직렬 구동 사슬, 축 직결·기어 물림·벨트 ← **완료 (v17, `src/assembly/bench.js`, 조립 작업대 탭)**
4. 새 기구: 편심추 진동, 간헐 기어, 윈치·도르래, 그리퍼, 유니버설 조인트, 컨베이어 ← **완료 (v20, `src/mechanisms/linkage-new.js`의 LK_X 표로 추가)**
5. 조립 작업대 2단계: 갈래, 토크 거슬러 계산 ← **완료 (v18 토크, v21 갈래: mods[k].src 로 앞 번호 어느 기구에든 이음, 같은 출력의 기어·벨트는 18 mm씩 층을 올림, 축 직결·랙은 한 출력에 하나)**. 닫힌 고리 ← **완료 (v22, `asmTies`: mods[k].tie = { src, from, zA, zB } 로 k 번 입력축을 다른 기구 출력에 GT2 벨트로 한 번 더 이음. 입력 한 주기 96점에서 두 길의 각도를 비교해 0.02 rad 넘게 어긋나면 잠김으로 보고, 최소제곱 비로 맞는 풀리 짝을 찾아 줌)**
6. 크기별 규칙, 큰 부품 나누기 ← **완료 (v21, `sizeRules` in linkage-more.js: 등급 초소형<30·탁상<220·큰<600·아주 큰, BED 220×220보다 큰 부품, 모듈<0.5·축<3 경고 / `asmPlateTiles`: 큰 바탕판을 조각 + 이음띠 + M3로)**
7. 실제 출력 피드백(프린터 보정 탭, 시험편 → 테두리·구멍·백래시 보정) ← **완료 (v23)**
