// Gambar bangun untuk Aktivitas 1 dan 2 serta ilustrasi soal latihan. Semua digambar pada petak 1 cm dengan skala sama.
import { capture, el, grid, centroid, labelPos, sideLabelPos, triMeasures, triangleFromSides, rigid, fmt, svgPoint } from './geo.js';

const S = 30;

// Koordinat dalam cm, sumbu y ke atas; titik pertama selalu sudut kiri bawah.
// A: siku-siku 4 × 3. B: sama kaki alas 4, tinggi 3. C: A diperbesar 1,5 kali. D: sama dengan A.
export const SHAPES = {
  A: [[0, 0], [4, 0], [0, 3]],
  B: [[0, 0], [4, 0], [2, 3]],
  C: [[0, 0], [6, 0], [0, 4.5]],
  D: [[0, 0], [4, 0], [0, 3]]
};
// Posisi kiri bawah setiap bangun pada bidang 15 × 12 cm (dua baris, dua kolom).
const PLACE = { A: [1, 5], B: [8.5, 5], C: [1, 11], D: [8.5, 11] };
// Warna sama untuk keempat bangun agar warna tidak membocorkan pasangan bangun.
const COLOR = { A: 'shape-1', B: 'shape-1', C: 'shape-1', D: 'shape-1' };

const toPts = (key, ox, oy) => SHAPES[key].map(([x, y]) => ({ x: x + ox, y: oy - y }));

function drawPoly(g, pts, cls, { label, showMeasures, labelText }) {
  const sp = pts.map(p => ({ x: p.x * S, y: p.y * S }));
  el('polygon', { points: sp.map(p => `${p.x},${p.y}`).join(' '), class: `tri ${cls}` }, g);
  const c = centroid(sp);
  if (labelText) {
    el('text', { x: c.x, y: c.y, class: 'shape-name', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g).textContent = labelText;
  }
  if (showMeasures && pts.length === 3) {
    const m = triMeasures(pts);
    [[0, 1, m.s01], [1, 2, m.s12], [2, 0, m.s20]].forEach(([i, j, len]) => {
      const lp = sideLabelPos(sp[i], sp[j], c, 13);
      el('text', { x: lp.x, y: lp.y, class: 's-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g).textContent = `${fmt(len)}`;
    });
    [m.a0, m.a1, m.a2].forEach((a, i) => {
      const ap = labelPos(sp[i], c, -22);
      el('text', { x: ap.x, y: ap.y, class: 'a-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g).textContent = `${fmt(a)}°`;
    });
  }
  if (label) sp.forEach(p => el('circle', { cx: p.x, cy: p.y, r: 3, class: `vertex ${cls}` }, g));
}

// Aktivitas 1 dan 2: empat bangun + alat bantu (perbesar tampilan, ukuran, bandingkan).
export function observeFigure(root, idPrefix) {
  root.innerHTML = `
    <div class="sim-toolbar" role="group" aria-label="Alat bantu pengamatan">
      <span class="tool-label" id="${idPrefix}-zoom-label">Tampilan</span>
      <button type="button" class="btn btn-small" data-zoom="-1" aria-describedby="${idPrefix}-zoom-label">Perkecil</button>
      <output class="zoom-out" aria-live="polite">100%</output>
      <button type="button" class="btn btn-small" data-zoom="1" aria-describedby="${idPrefix}-zoom-label">Perbesar</button>
      <label class="check-inline"><input type="checkbox" data-measure> Tampilkan ukuran sisi (cm) dan sudut</label>
    </div>
    <div class="figure-scroll"><svg class="obs-svg" viewBox="0 0 ${15 * S} ${12 * S}" role="img" aria-label="Bangun A, B, C, dan D pada petak 1 cm"></svg></div>
    <p class="figure-caption">Setiap petak berukuran 1 cm × 1 cm. Semua bangun digambar dengan skala yang sama.</p>
    <details class="compare">
      <summary>Bandingkan dua bangun dengan menumpuknya</summary>
      <div class="compare-body">
        <div class="compare-pick">
          <label>Bangun tetap <select data-pick="x">${['A', 'B', 'C', 'D'].map(k => `<option ${k === 'A' ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
          <label>Bangun yang digeser <select data-pick="y">${['A', 'B', 'C', 'D'].map(k => `<option ${k === 'D' ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        </div>
        <div class="sim-toolbar">
          <button type="button" class="btn btn-small" data-cmp="rot">Putar 90°</button>
          <button type="button" class="btn btn-small" data-cmp="stack">Tumpuk di sudut kiri bawah</button>
          <button type="button" class="btn btn-small btn-quiet" data-cmp="reset">Pisahkan lagi</button>
        </div>
        <div class="sim-stage"><svg class="cmp-svg" viewBox="0 0 ${16 * S} ${8 * S}" role="img" aria-label="Area membandingkan dua bangun"></svg></div>
        <p class="sim-hint">Seret bangun berwarna jingga untuk menggeser, atau pilih lalu tekan tombol panah. Bangun hanya dipindah dan diputar, ukurannya tidak berubah.</p>
      </div>
    </details>`;

  const svg = root.querySelector('.obs-svg');
  const measure = root.querySelector('[data-measure]');
  let zoom = 1;

  function draw() {
    svg.replaceChildren();
    grid(svg, 0, 0, 15, 12, S);
    for (const k of ['A', 'B', 'C', 'D']) {
      const [ox, oy] = PLACE[k];
      const g = el('g', {}, svg);
      drawPoly(g, toPts(k, ox, oy), COLOR[k], { label: true, showMeasures: measure.checked });
      el('rect', { x: (ox - 0.6) * S, y: (oy - 4.9) * S, width: 0.9 * S, height: 0.9 * S, class: 'tag-box' }, g);
      el('text', { x: (ox - 0.15) * S, y: (oy - 4.45) * S, class: 'tag-text', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g).textContent = k;
    }
    svg.style.width = `${zoom * 100}%`;
    root.querySelector('.zoom-out').textContent = `${Math.round(zoom * 100)}%`;
  }
  root.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => {
    zoom = Math.min(2, Math.max(1, zoom + Number(b.dataset.zoom) * 0.5));
    draw();
  }));
  measure.addEventListener('change', draw);
  draw();

  // Area pembanding
  const csvg = root.querySelector('.cmp-svg');
  const selX = root.querySelector('[data-pick="x"]');
  const selY = root.querySelector('[data-pick="y"]');
  let cs = { rot: 0, t: null };
  const resetCmp = () => { cs = { rot: 0, t: { x: 11, y: 6.5 } }; };
  resetCmp();
  let gY;
  let drag = null;
  function drawY() {
    gY.replaceChildren();
    const local = SHAPES[selY.value].map(([x, y]) => ({ x, y: -y }));
    // Putar terhadap titik pertama (sudut kiri bawah) agar penumpukan mudah dibandingkan.
    const yPts = rigid(local, { theta: cs.rot, t: cs.t, about: local[0] });
    drawPoly(gY, yPts, 'shape-2 see-through', { label: true, labelText: selY.value });
  }
  function drawCmp() {
    csvg.replaceChildren();
    grid(csvg, 0, 0, 16, 8, S);
    const gx = el('g', {}, csvg);
    drawPoly(gx, toPts(selX.value, 1, 7), 'shape-1', { label: true, labelText: selX.value });
    gY = el('g', { class: 'draggable', tabindex: '0', role: 'button', 'aria-label': `Bangun ${selY.value} yang dapat digeser. Tekan tombol panah untuk menggeser.` }, csvg);
    gY.addEventListener('pointerdown', e => {
      const p = svgPoint(csvg, e);
      drag = { dx: p.x / S - cs.t.x, dy: p.y / S - cs.t.y };
      capture(gY, e);
      e.preventDefault();
    });
    gY.addEventListener('pointermove', e => {
      if (!drag) return;
      const p = svgPoint(csvg, e);
      cs.t = { x: Math.min(15.5, Math.max(0.5, p.x / S - drag.dx)), y: Math.min(7.5, Math.max(0.5, p.y / S - drag.dy)) };
      drawY();
    });
    const up = () => { drag = null; };
    gY.addEventListener('pointerup', up);
    gY.addEventListener('pointercancel', up);
    gY.addEventListener('keydown', e => {
      const d = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, -0.5], ArrowDown: [0, 0.5] }[e.key];
      if (!d) return;
      e.preventDefault();
      cs.t = { x: Math.min(15.5, Math.max(0.5, cs.t.x + d[0])), y: Math.min(7.5, Math.max(0.5, cs.t.y + d[1])) };
      drawY();
    });
    drawY();
  }
  root.querySelector('[data-cmp="rot"]').addEventListener('click', () => { cs.rot = (cs.rot + 90) % 360; drawCmp(); });
  root.querySelector('[data-cmp="stack"]').addEventListener('click', () => { cs.t = { x: 1, y: 7 }; drawCmp(); });
  root.querySelector('[data-cmp="reset"]').addEventListener('click', () => { resetCmp(); drawCmp(); });
  selX.addEventListener('change', drawCmp);
  selY.addEventListener('change', drawCmp);
  drawCmp();
}

// ---------- Ilustrasi soal ----------

function ticks(g, p, q, n) {
  const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  const L = Math.hypot(q.x - p.x, q.y - p.y);
  const ux = (q.x - p.x) / L, uy = (q.y - p.y) / L;
  const nx = -uy, ny = ux;
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * 5;
    const c = { x: m.x + ux * o, y: m.y + uy * o };
    el('line', { x1: c.x - nx * 6, y1: c.y - ny * 6, x2: c.x + nx * 6, y2: c.y + ny * 6, class: 'tick' }, g);
  }
}

function labeledTriangle(g, pts, names, cls, sideText, tickCounts) {
  const sp = pts.map(p => ({ x: p.x * S, y: p.y * S }));
  el('polygon', { points: sp.map(p => `${p.x},${p.y}`).join(' '), class: `tri ${cls}` }, g);
  const c = centroid(sp);
  sp.forEach((p, i) => {
    el('circle', { cx: p.x, cy: p.y, r: 3, class: `vertex ${cls}` }, g);
    const lp = labelPos(p, c, 15);
    el('text', { x: lp.x, y: lp.y, class: 'v-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g).textContent = names[i];
  });
  [[0, 1], [1, 2], [2, 0]].forEach(([i, j], k) => {
    if (tickCounts) ticks(g, sp[i], sp[j], tickCounts[k]);
    const lp = sideLabelPos(sp[i], sp[j], c, 16);
    el('text', { x: lp.x, y: lp.y, class: 's-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g).textContent = sideText[k];
  });
}

export function problemFigure(root, kind) {
  const svg = el('svg', { class: 'problem-svg', role: 'img' });
  root.appendChild(svg);
  const s = 0.75; // gambar soal diperkecil agar muat, skala sama untuk kedua bangun
  if (kind === 'soal1') {
    svg.setAttribute('viewBox', `0 0 ${20 * S * s} ${9.2 * S * s}`);
    svg.setAttribute('aria-label', 'Segitiga ABC dan DEF. AB dan DE bertanda satu garis, BC dan EF dua garis, CA dan FD tiga garis.');
    const g = el('g', { transform: `scale(${s})` }, svg);
    const abc = triangleFromSides(5, 8, 7).map(p => ({ x: p.x + 1.5, y: p.y + 8.3 }));
    labeledTriangle(g, abc, ['A', 'B', 'C'], 'shape-1', ['5 cm', '7 cm', '8 cm'], [1, 2, 3]);
    const defL = triangleFromSides(5, 8, 7);
    const def = rigid(defL, { theta: 180, t: { x: 14.5, y: 3.6 } });
    labeledTriangle(g, def, ['D', 'E', 'F'], 'shape-2', ['5 cm', '7 cm', '8 cm'], [1, 2, 3]);
  }
  if (kind === 'soal2') {
    svg.setAttribute('viewBox', `0 0 ${17 * S * s} ${11 * S * s}`);
    svg.setAttribute('aria-label', 'Segitiga PQR dengan sisi 3, 4, 5 cm dan segitiga STU dengan sisi 6, 8, 10 cm.');
    const g = el('g', { transform: `scale(${s})` }, svg);
    const pqr = triangleFromSides(4, 3, 5).map(p => ({ x: p.x + 1.5, y: p.y + 10 })); // Q, R, P
    labeledTriangle(g, pqr, ['Q', 'R', 'P'], 'shape-1', ['4 cm', '5 cm', '3 cm']);
    const stu = triangleFromSides(8, 6, 10).map(p => ({ x: p.x + 7.5, y: p.y + 10 })); // T, U, S
    labeledTriangle(g, stu, ['T', 'U', 'S'], 'shape-2', ['8 cm', '10 cm', '6 cm']);
  }
  if (kind === 'soal3') {
    svg.setAttribute('viewBox', `0 0 ${19 * S * s} ${8.5 * S * s}`);
    svg.setAttribute('aria-label', 'Persegi panjang KLMN 6 cm kali 4 cm dan persegi panjang WXYZ 9 cm kali 6 cm.');
    const g = el('g', { transform: `scale(${s})` }, svg);
    const rect = (x, y, w, h, names, cls) => {
      const pts = [{ x, y: y + h }, { x: x + w, y: y + h }, { x: x + w, y }, { x, y }];
      const sp = pts.map(p => ({ x: p.x * S, y: p.y * S }));
      el('polygon', { points: sp.map(p => `${p.x},${p.y}`).join(' '), class: `tri ${cls}` }, g);
      const c = centroid(sp);
      sp.forEach((p, i) => {
        const lp = labelPos(p, c, 14);
        el('text', { x: lp.x, y: lp.y, class: 'v-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g).textContent = names[i];
      });
      el('text', { x: c.x, y: sp[0].y + 18, class: 's-label', 'text-anchor': 'middle' }, g).textContent = `${fmt(w)} cm`;
      el('text', { x: sp[1].x + 10, y: c.y, class: 's-label', 'text-anchor': 'start', 'dominant-baseline': 'middle' }, g).textContent = `${fmt(h)} cm`;
    };
    rect(1, 2.5, 6, 4, ['K', 'L', 'M', 'N'], 'shape-1');
    rect(9, 0.8, 9, 6, ['W', 'X', 'Y', 'Z'], 'shape-2');
  }
}
