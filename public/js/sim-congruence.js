// Simulasi A: kekongruenan dua segitiga.
// ABC tetap (AB = 5, BC = 7, CA = 8 cm). DEF dapat digeser, diputar, dicerminkan, dan diubah panjang sisinya.
// Semua ukuran dihitung dari koordinat hasil transformasi, bukan dari angka yang disimpan.
import { capture, el, grid, triangleFromSides, rigid, triMeasures, centroid, labelPos, sideLabelPos, svgPoint, fmt, cross, validTriangle } from './geo.js';

const S = 30;            // 1 cm = 30 satuan SVG
const W = 24, H = 13;    // luas bidang dalam cm
const ABC_SIDES = { ab: 5, bc: 7, ca: 8 };
const START = () => ({ de: 5, ef: 7, fd: 8, theta: 25, mirror: false, t: { x: 17, y: 6.6 } });
const TOL_SIDE = 0.05, TOL_ANGLE = 0.5;

export function createCongruenceSim(root, { onRecord, canRecord = () => true }) {
  let st = START();
  let moved = false;
  let snapped = false;
  let lastValid = { de: st.de, ef: st.ef, fd: st.fd };
  // ABC: A di kiri bawah, B di kanan bawah, C di atas.
  const abcLocal = triangleFromSides(ABC_SIDES.ab, ABC_SIDES.ca, ABC_SIDES.bc);
  const abc = abcLocal.map(p => ({ x: p.x + 1.5, y: p.y + 10.5 }));

  root.innerHTML = `
    <div class="sim-toolbar" role="group" aria-label="Alat Simulasi A">
      <button type="button" class="btn btn-small" data-act="rotL">Putar −15°</button>
      <button type="button" class="btn btn-small" data-act="rotR">Putar +15°</button>
      <button type="button" class="btn btn-small" data-act="mirror">Cerminkan</button>
      <button type="button" class="btn btn-small" data-act="snap">Impitkan ke ABC</button>
      <button type="button" class="btn btn-small btn-quiet" data-act="reset">Atur Ulang Simulasi</button>
      <label class="check-inline"><input type="checkbox" data-opt="angles" checked> Tampilkan sudut</label>
    </div>
    <div class="sim-stage"><svg class="sim-svg" viewBox="0 0 ${W * S} ${H * S}" role="img" aria-label="Segitiga ABC dan segitiga DEF pada petak 1 cm"></svg></div>
    <p class="sim-hint">Seret segitiga DEF untuk menggeser. Seret titik bulat untuk memutar. Dengan papan ketik: pilih segitiga DEF lalu tekan tombol panah.</p>
    <fieldset class="sim-sliders">
      <legend>Panjang sisi segitiga DEF (cm)</legend>
      <label>DE <input type="range" min="2" max="10" step="0.5" data-side="de"><output data-out="de"></output></label>
      <label>EF <input type="range" min="2" max="10" step="0.5" data-side="ef"><output data-out="ef"></output></label>
      <label>FD <input type="range" min="2" max="10" step="0.5" data-side="fd"><output data-out="fd"></output></label>
      <p class="sim-warning" role="alert" hidden></p>
    </fieldset>
    <div class="sim-compare"></div>
    <div class="sim-record">
      <label class="sr-only" for="simA-note">Catatan singkat percobaan</label>
      <input id="simA-note" type="text" maxlength="300" placeholder="Catatan singkat (tidak wajib), misalnya: DEF hanya diputar">
      <button type="button" class="btn" data-act="record">Catat hasil</button>
    </div>`;

  const svg = root.querySelector('svg');
  const warn = root.querySelector('.sim-warning');
  const cmp = root.querySelector('.sim-compare');
  const showAngles = root.querySelector('[data-opt="angles"]');
  grid(svg, 0, 0, W, H, S);
  const gABC = el('g', {}, svg);
  const gDEF = el('g', { class: 'draggable', tabindex: '0', role: 'button', 'aria-label': 'Segitiga DEF. Tekan tombol panah untuk menggeser.' }, svg);
  const gHandle = el('g', { class: 'rotate-handle' }, svg);

  function defPoints() {
    const local = triangleFromSides(lastValid.de, lastValid.fd, lastValid.ef); // D, E, F
    return rigid(local, { theta: st.theta, mirror: st.mirror, t: st.t });
  }

  function drawTri(g, pts, labels, cls) {
    g.replaceChildren();
    const sp = pts.map(p => ({ x: p.x * S, y: p.y * S }));
    el('polygon', { points: sp.map(p => `${p.x},${p.y}`).join(' '), class: `tri ${cls}` }, g);
    const c = centroid(sp);
    const m = triMeasures(pts);
    const angles = [m.a0, m.a1, m.a2];
    sp.forEach((p, i) => {
      el('circle', { cx: p.x, cy: p.y, r: 4, class: `vertex ${cls}` }, g);
      const lp = labelPos(p, c, cls.startsWith('shape-2') ? 34 : 16);
      el('text', { x: lp.x, y: lp.y, class: 'v-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g).textContent = labels[i];
      if (showAngles.checked) {
        const ap = labelPos(p, c, -26);
        el('text', { x: ap.x, y: ap.y, class: 'a-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g).textContent = `${fmt(angles[i])}°`;
      }
    });
    const pairs = [[0, 1, m.s01], [1, 2, m.s12], [2, 0, m.s20]];
    pairs.forEach(([i, j, len]) => {
      const lp = sideLabelPos(sp[i], sp[j], c, 14);
      el('text', { x: lp.x, y: lp.y, class: 's-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g).textContent = `${fmt(len)} cm`;
    });
    return m;
  }

  function render(keepSnap = false) {
    if (!keepSnap) snapped = false;
    const mA = drawTri(gABC, abc, ['A', 'B', 'C'], 'shape-1');
    const dp = defPoints();
    const mD = drawTri(gDEF, dp, ['D', 'E', 'F'], 'shape-2 see-through');
    // Gagang putar: di atas titik pusat DEF, ikut berputar.
    const c = centroid(dp);
    const r = (st.theta * Math.PI) / 180;
    const R = Math.max(...dp.map(p => Math.hypot(p.x - c.x, p.y - c.y))) + 0.9;
    const h = { x: c.x + R * Math.sin(r), y: c.y - R * Math.cos(r) };
    gHandle.replaceChildren();
    el('line', { x1: c.x * S, y1: c.y * S, x2: h.x * S, y2: h.y * S, class: 'handle-line' }, gHandle);
    el('circle', { cx: h.x * S, cy: h.y * S, r: 15, class: 'handle', role: 'presentation' }, gHandle);
    for (const k of ['de', 'ef', 'fd']) {
      root.querySelector(`[data-side="${k}"]`).value = st[k];
      root.querySelector(`[data-out="${k}"]`).textContent = fmt(st[k]);
    }
    renderCompare(mA, mD);
    current = { mA, mD };
  }
  let current = null;

  function renderCompare(mA, mD) {
    const rows = [
      ['AB', mA.s01, 'DE', mD.s01, 'cm'], ['BC', mA.s12, 'EF', mD.s12, 'cm'], ['CA', mA.s20, 'FD', mD.s20, 'cm'],
      ['∠A', mA.a0, '∠D', mD.a0, '°'], ['∠B', mA.a1, '∠E', mD.a1, '°'], ['∠C', mA.a2, '∠F', mD.a2, '°']
    ];
    let sideEq = 0, angEq = 0;
    const body = rows.map(([n1, v1, n2, v2, u], i) => {
      const eq = Math.abs(v1 - v2) <= (u === 'cm' ? TOL_SIDE : TOL_ANGLE);
      if (eq) { if (u === 'cm') sideEq++; else angEq++; }
      const unit = u === 'cm' ? ' cm' : '°';
      return `<tr><th scope="row">${n1} dan ${n2}</th><td>${fmt(v1)}${unit}</td><td>${fmt(v2)}${unit}</td><td class="${eq ? 'eq' : 'neq'}">${eq ? 'Sama' : 'Berbeda'}</td></tr>`;
    }).join('');
    const transform = [moved ? 'digeser' : null, `diputar ${fmt(((st.theta % 360) + 360) % 360, 0)}°`, st.mirror ? 'dicerminkan' : null].filter(Boolean).join(', ');
    let note;
    if (sideEq === 3 && angEq === 3) note = snapped
      ? 'DEF sekarang menutupi ABC dengan tepat: setiap titik dan sisi berimpit.'
      : 'Semua pasangan sisi dan sudut yang bersesuaian sama besar, walaupun posisi dan arah DEF berbeda dari ABC. Coba klik "Impitkan ke ABC".';
    else if (snapped) note = `DEF diimpitkan ke ABC tetapi tidak menutupinya dengan tepat: ${3 - sideEq} pasang sisi dan ${3 - angEq} pasang sudut berbeda.`;
    else note = `Ada pasangan yang berbeda: ${3 - sideEq} pasang sisi dan ${3 - angEq} pasang sudut. Coba impitkan DEF ke ABC dan amati bagian yang tidak berimpit.`;
    cmp.innerHTML = `
      <table class="data-table compact">
        <caption>Perbandingan bagian yang bersesuaian (A dengan D, B dengan E, C dengan F)</caption>
        <thead><tr><th scope="col">Pasangan</th><th scope="col">ABC</th><th scope="col">DEF</th><th scope="col">Hasil</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <p class="sim-status"><strong>Keadaan DEF:</strong> ${transform}. ${note}</p>`;
  }

  function setSides(k, v) {
    st[k] = v;
    if (validTriangle(st.de, st.ef, st.fd)) {
      lastValid = { de: st.de, ef: st.ef, fd: st.fd };
      warn.hidden = true;
    } else {
      warn.hidden = false;
      warn.textContent = `Panjang ${fmt(st.de)}, ${fmt(st.ef)}, dan ${fmt(st.fd)} cm tidak dapat membentuk segitiga: jumlah dua sisi harus lebih panjang dari sisi ketiga. Gambar menampilkan segitiga terakhir yang valid.`;
    }
    render();
  }

  function snap() {
    // Tempatkan D di A dan sinar DE searah AB. Cerminkan jika arah putaran DEF berlawanan dengan ABC.
    const local = triangleFromSides(lastValid.de, lastValid.fd, lastValid.ef);
    const orientABC = Math.sign(cross(abc[0], abc[1], abc[2]));
    const orientDEF = Math.sign(cross(local[0], local[1], local[2]));
    st.mirror = orientABC !== orientDEF;
    const m = rigid(local, { theta: 0, mirror: st.mirror, t: { x: 0, y: 0 } });
    const angAB = Math.atan2(abc[1].y - abc[0].y, abc[1].x - abc[0].x);
    const angDE = Math.atan2(m[1].y - m[0].y, m[1].x - m[0].x);
    st.theta = ((angAB - angDE) * 180) / Math.PI;
    const rotated = rigid(local, { theta: st.theta, mirror: st.mirror, t: { x: 0, y: 0 } });
    st.t = { x: abc[0].x - rotated[0].x, y: abc[0].y - rotated[0].y };
    moved = true;
    snapped = true;
    render(true);
  }

  const clampT = () => { st.t.x = Math.min(W - 0.5, Math.max(0.5, st.t.x)); st.t.y = Math.min(H - 0.5, Math.max(0.5, st.t.y)); };

  // Seret untuk menggeser
  let drag = null;
  gDEF.addEventListener('pointerdown', e => {
    const p = svgPoint(svg, e);
    drag = { mode: 'move', dx: p.x / S - st.t.x, dy: p.y / S - st.t.y };
    capture(gDEF, e);
    e.preventDefault();
  });
  gHandle.addEventListener('pointerdown', e => {
    drag = { mode: 'rotate' };
    capture(gHandle, e);
    e.preventDefault();
  });
  const onMove = e => {
    if (!drag) return;
    const p = svgPoint(svg, e);
    if (drag.mode === 'move') {
      st.t = { x: p.x / S - drag.dx, y: p.y / S - drag.dy };
      clampT();
      moved = true;
    } else {
      st.theta = (Math.atan2(p.x / S - st.t.x, -(p.y / S - st.t.y)) * 180) / Math.PI;
    }
    render();
  };
  const onUp = () => { drag = null; };
  gDEF.addEventListener('pointermove', onMove);
  gHandle.addEventListener('pointermove', onMove);
  gDEF.addEventListener('pointerup', onUp);
  gHandle.addEventListener('pointerup', onUp);
  gDEF.addEventListener('pointercancel', onUp);
  gHandle.addEventListener('pointercancel', onUp);
  gDEF.addEventListener('keydown', e => {
    const step = 0.5;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    st.t.x += d[0]; st.t.y += d[1];
    clampT();
    moved = true;
    render();
  });

  root.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'rotL') st.theta -= 15;
    if (act === 'rotR') st.theta += 15;
    if (act === 'mirror') st.mirror = !st.mirror;
    if (act === 'snap') return snap();
    if (act === 'reset') { st = START(); lastValid = { de: 5, ef: 7, fd: 8 }; moved = false; warn.hidden = true; }
    if (act === 'record') return record();
    render();
  });
  root.querySelectorAll('[data-side]').forEach(inp => inp.addEventListener('input', () => setSides(inp.dataset.side, Number(inp.value))));
  showAngles.addEventListener('change', () => render(true));

  function record() {
    if (!canRecord()) return;
    if (!warn.hidden) { warn.focus?.(); return; }
    const { mA, mD } = current;
    const noteEl = root.querySelector('#simA-note');
    onRecord({
      at: new Date().toISOString(), note: noteEl.value.trim(),
      ab: mA.s01, bc: mA.s12, ca: mA.s20, de: mD.s01, ef: mD.s12, fd: mD.s20,
      aA: mA.a0, aB: mA.a1, aC: mA.a2, aD: mD.a0, aE: mD.a1, aF: mD.a2,
      rot: ((st.theta % 360) + 360) % 360, mirror: st.mirror, moved
    });
    noteEl.value = '';
  }

  render();
  return {
    setRecordEnabled(on) { root.querySelector('[data-act="record"]').disabled = !on; }
  };
}
