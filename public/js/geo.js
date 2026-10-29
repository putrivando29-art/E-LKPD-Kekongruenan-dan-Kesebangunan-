// Perhitungan geometri yang dipakai simulasi dan gambar. Satuan: cm. Sumbu y ke bawah (seperti SVG).
export const SVGNS = 'http://www.w3.org/2000/svg';

export const dist = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);

// Besar sudut di titik p (derajat) yang dibentuk oleh sinar p->q dan p->r.
export function angleAt(p, q, r) {
  const v1 = { x: q.x - p.x, y: q.y - p.y };
  const v2 = { x: r.x - p.x, y: r.y - p.y };
  const c = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

export function validTriangle(a, b, c) {
  return a > 0 && b > 0 && c > 0 && a + b > c + 1e-9 && a + c > b + 1e-9 && b + c > a + 1e-9;
}

// Segitiga dengan titik ke-0 di (0,0), titik ke-1 di (s01, 0), titik ke-2 di atas alas
// sehingga |P0P2| = s02 dan |P1P2| = s12.
export function triangleFromSides(s01, s02, s12) {
  if (!validTriangle(s01, s02, s12)) return null;
  const x = (s01 * s01 + s02 * s02 - s12 * s12) / (2 * s01);
  const y = -Math.sqrt(Math.max(0, s02 * s02 - x * x));
  return [{ x: 0, y: 0 }, { x: s01, y: 0 }, { x, y }];
}

export const centroid = pts => ({ x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length });

// Transformasi kaku: cermin (opsional, terhadap garis mendatar lewat titik pusat), putar theta derajat, geser ke t.
export function rigid(pts, { theta = 0, mirror = false, t = { x: 0, y: 0 }, about }) {
  const g = about || centroid(pts);
  const r = (theta * Math.PI) / 180;
  const cos = Math.cos(r), sin = Math.sin(r);
  return pts.map(p => {
    const x = p.x - g.x;
    const y = mirror ? -(p.y - g.y) : p.y - g.y;
    return { x: t.x + x * cos - y * sin, y: t.y + x * sin + y * cos };
  });
}

export const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

export function triMeasures(p) {
  return {
    s01: dist(p[0], p[1]), s12: dist(p[1], p[2]), s20: dist(p[2], p[0]),
    a0: angleAt(p[0], p[1], p[2]), a1: angleAt(p[1], p[0], p[2]), a2: angleAt(p[2], p[0], p[1])
  };
}

export const fmt = (n, d = 1) => Number(n).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: d });

export function el(name, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

// Petak 1 cm sebagai alat ukur pada gambar.
export function grid(parent, x0, y0, w, h, s, cls = 'grid-line') {
  const g = el('g', { class: 'grid', 'aria-hidden': 'true' }, parent);
  for (let x = Math.ceil(x0); x <= x0 + w + 1e-9; x++) el('line', { x1: x * s, y1: y0 * s, x2: x * s, y2: (y0 + h) * s, class: cls }, g);
  for (let y = Math.ceil(y0); y <= y0 + h + 1e-9; y++) el('line', { x1: x0 * s, y1: y * s, x2: (x0 + w) * s, y2: y * s, class: cls }, g);
  return g;
}

// Posisi label titik sudut: sedikit di luar segitiga, menjauhi titik pusat.
export function labelPos(p, c, off) {
  const dx = p.x - c.x, dy = p.y - c.y;
  const L = Math.hypot(dx, dy) || 1;
  return { x: p.x + (dx / L) * off, y: p.y + (dy / L) * off };
}

// Posisi label panjang sisi: di tengah sisi, digeser keluar dari segitiga.
export function sideLabelPos(p, q, c, off) {
  const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  let nx = -(q.y - p.y), ny = q.x - p.x;
  const L = Math.hypot(nx, ny) || 1;
  nx /= L; ny /= L;
  if ((m.x - c.x) * nx + (m.y - c.y) * ny < 0) { nx = -nx; ny = -ny; }
  return { x: m.x + nx * off, y: m.y + ny * off };
}

// Koordinat penunjuk (mouse/sentuh) dalam satuan SVG.
export function svgPoint(svg, evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX; pt.y = evt.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

// Menahan penunjuk pada elemen selama diseret. Beberapa browser menolak bila penunjuk sudah dilepas.
export function capture(node, evt) {
  try { node.setPointerCapture(evt.pointerId); } catch { /* seret tetap berjalan tanpa penahanan */ }
}
