/* ================= OpenSCAD 공용 라이브러리 ================= */
const SCAD_LIB = `function inv_(a) = tan(a) - a*PI/180;
function pol(r, a) = [r*cos(a), r*sin(a)];
function half_(rho, rb, psi) = (psi - inv_(acos(min(1, rb/rho)))) * 180/PI;
// 이 하나의 [반지름, 각도°] 목록. internal=true 이면 내접(링)기어의 이홈 모양
function tooth_pol(m, z, pa, x, bl, internal = false) = let(
    r = m*z/2, rb = r*cos(pa),
    ra = internal ? r + 1.25*m : r + m*(1+x), rf = internal ? r - m : r - m*(1.25-x),
    s = internal ? m*PI/2 + bl : m*(PI/2 + 2*x*tan(pa)) - bl,
    psi = s/(2*r) + inv_(pa), r0 = max(rb, rf),
    u0 = sqrt(max(0, pow(r0/rb, 2) - 1)), u1 = sqrt(pow(ra/rb, 2) - 1), st = 360/z, h0 = half_(r0, rb, psi)
  ) concat(
    rf < r0 ? [[rf, -h0]] : [],
    [ for (i = [0:res]) let(rho = rb*sqrt(1 + pow(u0 + (u1-u0)*i/res, 2))) [rho, -half_(rho, rb, psi)] ],
    [ for (i = [res:-1:0]) let(rho = rb*sqrt(1 + pow(u0 + (u1-u0)*i/res, 2))) [rho, half_(rho, rb, psi)] ],
    rf < r0 ? [[rf, h0]] : [],
    [ for (j = [1:3]) [rf, h0 + (st - 2*h0)*j/4] ]
  );
function gear_pts(m, z, pa, x, bl, internal = false) = let(t = tooth_pol(m, z, pa, x, bl, internal))
  [ for (k = [0:z-1]) for (p = t) pol(p[0], p[1] + k*360/z) ];
// 베벨기어 뒷면(heel) 치형: 등가 평기어(z/cosδ)를 뒷원뿔에 감은 뒤 꼭짓점에서 z=0 평면으로 투영
function bevel_proj(rr, m, z, delta) = let(c = cos(delta), r = m*z/2, H = r/tan(delta)) rr*c*H/(H - (rr - r/c)*sin(delta));
function bevel_pts(m, z, pa, bl, delta) = let(c = cos(delta), t = tooth_pol(m, z/c, pa, 0, bl))
  [ for (k = [0:z-1]) for (p = t) pol(bevel_proj(p[0], m, z, delta), p[1]/c + k*360/z) ];

module bore2d(d, dcut, dd = 0) {
  if (d <= 0) {} else if (dcut > 0 && dd == 1)
    intersection() { circle(d = d, $fn = 48); square([d - 2*dcut, 2*d], center = true); }
  else if (dcut > 0)
    intersection() { circle(d = d, $fn = 48); translate([-d, -d]) square([1.5*d - dcut, 2*d]); }
  else circle(d = d, $fn = 48);
}
// helix: 나선각 β(°, 부호=나선 방향, 맞물리는 기어는 반대 부호), herring=1 이면 헤링본. m·pa는 치직각 값
module spur_gear(m, z, pa = 20, x = 0, b = 8, bl = 0.15, bore = 5, dcut = 0, helix = 0, herring = 0, dd = 0) {
  c = cos(helix); mt = m / c; pt = atan(tan(pa) / c);
  tw = b * tan(helix) / (mt*z/2) * 180/PI;            // 전체 비틀림각(°)
  difference() {
    if (helix == 0) linear_extrude(b) polygon(gear_pts(m, z, pa, x, bl));
    else if (herring == 0) linear_extrude(b, twist = -tw, slices = max(4, ceil(abs(tw)/1.5))) polygon(gear_pts(mt, z, pt, x, bl));
    else union() {
      linear_extrude(b/2, twist = -tw/2, slices = max(4, ceil(abs(tw)/3))) polygon(gear_pts(mt, z, pt, x, bl));
      translate([0, 0, b/2]) rotate(tw/2) linear_extrude(b/2, twist = tw/2, slices = max(4, ceil(abs(tw)/3))) polygon(gear_pts(mt, z, pt, x, bl));
    }
    translate([0, 0, -1]) linear_extrude(b + 2) bore2d(bore, dcut, dd);
  }
}
// 직선 베벨기어: 뒷면이 z=0, 꼭짓점(apex) 방향으로 좁아짐. hub는 앞쪽(toe)에 붙음
// spiral: 스파이럴 베벨 나선각(°, 0 = 직선 베벨). 이 줄을 원호로 휘게 비튼 근사형
// 꼭짓점에서의 거리 R(구면)마다 치형을 돌림 → 맞물리는 짝(반대 부호)과 같은 구면에서 같은 만큼 밀림
function bev_tw(R, r, A, F, sp) = let(u = A - R, Rc = 0.9*A)
  sign(sp) * (tan(abs(sp))*u + (pow(u - F/2, 2) - pow(F/2, 2))/(2*Rc)) / (r*R/A) * 180/PI;
function bev_layer(P, z, r, A, H, F, sp) = let(kz = (H - z)/H)
  [for (p = P) let(q = kz*p, t = sp == 0 ? 0 : bev_tw(norm([q[0], q[1], H - z]), r, A, F, sp)) [q[0]*cos(t) - q[1]*sin(t), q[0]*sin(t) + q[1]*cos(t), z]];
function poly_area(P) = 0.5*([for (i = [0:len(P)-1]) P[i][0]*P[(i+1)%len(P)][1] - P[(i+1)%len(P)][0]*P[i][1]] * [for (i = [0:len(P)-1]) 1]);
module bevel_gear(m, z, pa, bl, delta, F, bore, dcut, hub, spiral = 0) {
  r = m*z/2; A = r/sin(delta); H = r/tan(delta); k = 1 - F/A; h = (1-k)*H;
  rh = min(k*bevel_proj(r/cos(delta) - 1.25*m, m, z, delta) - 0.6, bore/2 + 3.5);
  P0 = bevel_pts(m, z, pa, bl, delta); P = poly_area(P0) > 0 ? P0 : [for (i = [len(P0)-1:-1:0]) P0[i]];
  N = len(P); n = spiral == 0 ? 1 : 16;
  difference() {
    union() {
      polyhedron(points = [for (j = [0:n]) each bev_layer(P, h*j/n, r, A, H, F, spiral)],
        faces = concat([[for (i = [0:N-1]) i]], [[for (i = [N-1:-1:0]) n*N + i]],
          [for (j = [0:n-1]) for (i = [0:N-1]) each [[j*N + i, (j+1)*N + i, (j+1)*N + (i+1)%N], [j*N + i, (j+1)*N + (i+1)%N, j*N + (i+1)%N]]]), convexity = 10);
      if (hub > 0) translate([0, 0, h - 0.01]) cylinder(r = rh, h = hub + 0.01, $fn = 64);
    }
    translate([0, 0, -1]) linear_extrude(h + hub + 2) bore2d(bore, dcut);
  }
}
// 내접 링기어: 바깥은 사각형(하우징에 끼워 고정) 또는 원
// 받침판이 붙은 링(내접) 기어. lower=1 이면 받침판이 아래(-z)쪽
module ring_gear2(m, z, pa, bl, b, ro, helix, lower, gp, rw, bore, dcut) {
  c = cos(helix); mt = m / c; pt = atan(tan(pa) / c); k = tan(helix) / (mt*z/2) * 180/PI;
  z0 = lower ? -gp : 0;
  translate([0, 0, z0]) rotate(z0 * k) linear_extrude(b + gp, twist = -k*(b + gp), slices = max(1, ceil(abs(k*(b + gp))/1.5)))
    difference() { circle(r = ro, $fn = 128); polygon(gear_pts(mt, z, pt, 0, bl, true)); }
  translate([0, 0, lower ? -gp - rw : b + gp - 0.2]) linear_extrude(rw + 0.2) difference() { circle(r = ro, $fn = 128); bore2d(bore, dcut); }
}
module ring_gear(m, z, pa, bl, b, outer_w, outer_h, outer_r, phase = 0, outer_pts = []) {
  linear_extrude(b) difference() {
    if (len(outer_pts) > 2) polygon(outer_pts); else if (outer_r > 0) circle(r = outer_r, $fn = 128); else square([outer_w, outer_h], center = true);
    rotate(phase) polygon(gear_pts(m, z, pa, 0, bl, true));
  }
}`;
