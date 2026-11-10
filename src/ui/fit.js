/* ---- 프린터 보정 ---- */
const FIT_KEY = 'gearStudio.fit';
try { const v = JSON.parse(localStorage.getItem(FIT_KEY) || 'null'); if (v) fitSet(v); } catch { }
function fitShow() {
  $('fitOuter').value = FIT.outer; $('fitHole').value = FIT.hole; $('fitBl').value = FIT.backlash;
  $('fitNow').innerHTML = fitOn() ? `지금 적용 중: 바깥 <b>${FIT.outer > 0 ? '−' : '+'}${fmt(Math.abs(FIT.outer), 2)}</b> · 구멍 <b>${FIT.hole >= 0 ? '+' : '−'}${fmt(Math.abs(FIT.hole), 2)}</b> · 백래시 <b>+${fmt(FIT.backlash, 2)}</b> mm` : '지금은 보정 없이(모두 0) 만듭니다.';
}
function fitCalc() {   // 잰 값 → 보정량 (0.01 mm 단위)
  const r = v => Math.round(v * 100) / 100, bo = num('fitMB'), ho = num('fitMH'), g = $('fitMG').value;
  if (bo > 0) $('fitOuter').value = r((bo - 20) / 2);
  if (ho > 0) $('fitHole').value = r((10 - ho) / 2);
  if (g !== '') $('fitBl').value = FIT_BL[+g];
}
function fitApply(f) {
  fitSet(f); try { localStorage.setItem(FIT_KEY, JSON.stringify(FIT)); } catch { }
  fitShow(); if (design) { try { setDesign(JSON.parse(JSON.stringify(design)), false); } catch (e) { toast('다시 만들지 못했습니다: ' + (e && e.message || e)); } }
  toast(fitOn() ? '프린터 보정을 모든 부품에 적용했습니다' : '보정을 없앴습니다');
}
$('tabFit').onclick = () => selectTab('fit');
['fitMB', 'fitMH'].forEach(id => $(id).oninput = fitCalc); $('fitMG').onchange = fitCalc;
$('fitGo').onclick = () => fitApply({ outer: num('fitOuter'), hole: num('fitHole'), backlash: num('fitBl') });
$('fitReset').onclick = () => { ['fitMB', 'fitMH'].forEach(id => $(id).value = ''); $('fitMG').value = ''; fitApply({}); };
$('fitDl').onclick = () => saveFile('printer_fit_test.zip', makeZip(fitCoupon().map(p => ({ name: p.name + '.stl', data: stlBinary(p.tris, p.name) })).concat([{ name: 'README.txt', data: new TextEncoder().encode(FIT_README) }])));
const FIT_README = `프린터 보정 시험편 (기어 설계실)
평소 쓰는 재료·노즐·슬라이서 설정 그대로 뽑으세요. 슬라이서의 수평 확장(XY 보정)은 0으로 둡니다.
1) fit_block_20x20_hole10.stl : 캘리퍼스로 바깥 한 변(설계 20.00 mm)과 구멍 지름(설계 10.00 mm)을 잽니다. 첫 층에서 1 mm 위를 재세요.
2) fit_gear_base.stl 의 기둥에 같은 점 수(1~4개)의 기어 두 개를 끼웁니다. 줄 끝 구멍 수가 점 수입니다.
   점 1개 = 백래시 0, 2개 = 0.1, 3개 = 0.2, 4개 = 0.3 mm. 걸림 없이 부드럽게 도는 쌍 가운데 점이 가장 적은 것을 고릅니다.
3) 앱의 프린터 보정 탭에 잰 값과 고른 점 수를 넣고 "적용"을 누르면 모든 부품의 테두리·구멍·기어 이가 보정됩니다.
`;
fitShow();
