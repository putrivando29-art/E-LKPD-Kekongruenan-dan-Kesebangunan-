// Simulasi A: kekongruenan dua segitiga.
// ABC tetap (AB = 5, BC = 7, CA = 8 cm). DEF dapat digeser, diputar, dicerminkan, dan diubah panjang sisinya.
// Semua ukuran dihitung dari koordinat hasil transformasi, bukan dari angka yang disimpan.
import { capture, el, grid, ruler, pill, tween, triangleFromSides, rigid, triMeasures, centroid, labelPos, sideLabelPos, svgPoint, fmt, cross, validTriangle } from './geo.js';
import { statusIcon } from './art.js';

const S = 30;            // 1 cm = 30 satuan SVG
const ABC_SIDES = { ab: 5, bc: 7, ca: 8 };
const TOL_SIDE = 0.05, TOL_ANGLE = 0.5;

export function createCongruenceSim(root, { onRecord, canRecord = () => true }) {
  // Layar sempit (HP): bidang tegak 13 × 23 cm, ABC di atas dan DEF di bawah, agar gambar dan label lebih besar.
  const narrow = root.clientWidth > 0 && root.clientWidth < 560;
  const W = narrow ? 13 : 24, H = narrow ? 23 : 14;  // baris terbawah untuk penggaris
  const START = () => (narrow
    ? { de: 5, ef: 7, fd: 8, theta: 25, mirror: false, tx: 6.5, ty: 16.6 }
    : { de: 5, ef: 7, fd: 8, theta: 25, mirror: false, tx: 17, ty: 6.6 });
  let st = START();          // keadaan tujuan (dipakai untuk semua ukuran)
  let view = { ...st };      // keadaan yang sedang digambar (dapat berupa tahap animasi)
  let moved = false, snapped = false, stopTween = () => {};
  let valid = { de: st.de, ef: st.ef, fd: st.fd };
  const abc = triangleFromSides(ABC_SIDES.ab, ABC_SIDES.ca, ABC_SIDES.bc).map(p => ({ x: p.x + (narrow ? 3.5 : 1.5), y: p.y + (narrow ? 8.8 : 11) }));

  root.innerHTML = `
    <div class="sim-toolbar" role="group" aria-label="Alat Simulasi A">
      <button type="button" class="btn btn-small btn-soft" data-act="rotL">Putar −15°</button>
      <button type="button" class="btn btn-small btn-soft" data-act="rotR">Putar +15°</button>
      <button type="button" class="btn btn-small btn-soft" data-act="mirror">Cerminkan</button>
      <button type="button" class="btn btn-small btn-primary" data-act="snap">Bandingkan Bangun</button>
      <button type="button" class="btn btn-small btn-quiet" data-act="reset">Atur Ulang</button>
      <label class="check-inline"><input type="checkbox" data-opt="angles" checked> Tampilkan sudut</label>
    </div>
    <div class="sim-stage"><svg class="sim-svg" viewBox="0 0 ${W * S} ${H * S}" role="img" aria-label="Segitiga ABC dan segitiga DEF pada kotak 1 cm"></svg></div>
    <p class="sim-hint">Seret segitiga oranye untuk menggeser. Seret titik kuning untuk memutar. Pakai papan ketik: pilih segitiganya lalu tekan tombol panah.</p>
    <fieldset class="sim-sliders">
      <legend>Ubah panjang sisi DEF (cm)</legend>
      <label>DE <input type="range" min="2" max="10" step="0.5" data-side="de"><output data-out="de"></output></label>
      <label>EF <input type="range" min="2" max="10" step="0.5" data-side="ef"><output data-out="ef"></output></label>
      <label>FD <input type="range" min="2" max="10" step="0.5" data-side="fd"><output data-out="fd"></output></label>
      <p class="sim-warning" role="alert" hidden></p>
    </fieldset>
    <div class="sim-result" aria-live="polite"></div>
    <div class="sim-record">
      <label class="sr-only" for="simA-note">Catatan singkat percobaan</label>
      <input id="simA-note" type="text" maxlength="300" placeholder="Catatan singkat (boleh kosong), misal: DEF hanya diputar">
      <button type="button" class="btn btn-primary" data-act="record">Catat Hasil</button>
    </div>`;

  const svg = root.querySelector('svg');
  const warn = root.querySelector('.sim-warning');
  const result = root.querySelector('.sim-result');
  const showAngles = root.querySelector('[data-opt="angles"]');
  grid(svg, 0, 0, W, H - 1, S);
  ruler(svg, 1, H - 0.95, W - 2, S);
  const gABC = el('g', {}, svg);
  const gDEF = el('g', { class: 'draggable', tabindex: '0', role: 'button', 'aria-label': 'Segitiga DEF. Tekan tombol panah untuk menggeser.' }, svg);
  const gTop = el('g', { 'pointer-events': 'none' }, svg);
  const gHandle = el('g', { class: 'rotate-handle' }, svg);

  const defPoints = s => rigid(triangleFromSides(s.de, s.fd, s.ef), { theta: s.theta, mirror: s.mirror, t: { x: s.tx, y: s.ty } });

  // Bangun digambar di lapisan masing-masing; semua label di lapisan paling atas agar tidak tertutup
  // saat DEF ditumpuk di atas ABC.
  function drawShape(g, pts, cls) {
    g.replaceChildren();
    const d = pts.map(p => `${p.x * S},${p.y * S}`).join(' ');
    el('polygon', { points: d, class: 'halo' }, g);
    el('polygon', { points: d, class: `tri ${cls}` }, g);
  }

  function drawLabels(g, pts, labels, cls) {
    const sp = pts.map(p => ({ x: p.x * S, y: p.y * S }));
    const c = centroid(sp);
    const m = triMeasures(pts);
    [[0, 1, m.s01], [1, 2, m.s12], [2, 0, m.s20]].forEach(([i, j, len]) => {
      const lp = sideLabelPos(sp[i], sp[j], c, cls === 'shape-2' ? 18 : 16);
      pill(g, lp.x, lp.y, `${fmt(len)} cm`);
    });
    const angles = [m.a0, m.a1, m.a2];
    sp.forEach((p, i) => {
      if (showAngles.checked) {
        const ap = labelPos(p, c, -28);
        el('text', { x: ap.x, y: ap.y, class: 'a-label', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g).textContent = `${fmt(angles[i])}°`;
      }
      const lp = labelPos(p, c, cls === 'shape-2' ? 40 : 20);
      pill(g, lp.x, lp.y, labels[i], { textClass: 'v-label', bgClass: `v-bg ${cls}`, round: true });
    });
  }

  function draw() {
    const dp = defPoints(view);
    drawShape(gABC, abc, 'shape-1');
    drawShape(gDEF, dp, 'shape-2');
    gTop.replaceChildren();
    // Saat DEF menumpuk ABC, garis ABC digambar lagi di atas agar keduanya tetap terlihat.
    if (snapped) el('polygon', { points: abc.map(p => `${p.x * S},${p.y * S}`).join(' '), class: 'tri overlay-top' }, gTop);
    drawLabels(gTop, abc, ['A', 'B', 'C'], 'shape-1');
    drawLabels(gTop, dp, ['D', 'E', 'F'], 'shape-2');
    const c = centroid(dp);
    const r = (view.theta * Math.PI) / 180;
    const R = Math.max(...dp.map(p => Math.hypot(p.x - c.x, p.y - c.y))) + 1.9;
    const h = { x: c.x + R * Math.sin(r), y: c.y - R * Math.cos(r) };
    gHandle.replaceChildren();
    el('line', { x1: c.x * S, y1: c.y * S, x2: h.x * S, y2: h.y * S, class: 'handle-line' }, gHandle);
    el('circle', { cx: h.x * S, cy: h.y * S, r: 15, class: 'handle' }, gHandle);
  }

  // Ukuran selalu dihitung dari keadaan tujuan, sehingga tabel tidak menampilkan angka tahap animasi.
  function measure() {
    return { mA: triMeasures(abc), mD: triMeasures(defPoints(st)) };
  }

  function renderResult() {
    const { mA, mD } = measure();
    const rows = [
      ['AB dan DE', mA.s01, mD.s01, 'cm'], ['BC dan EF', mA.s12, mD.s12, 'cm'], ['CA dan FD', mA.s20, mD.s20, 'cm'],
      ['∠A dan ∠D', mA.a0, mD.a0, '°'], ['∠B dan ∠E', mA.a1, mD.a1, '°'], ['∠C dan ∠F', mA.a2, mD.a2, '°']
    ];
    let sideEq = 0, angEq = 0;
    const body = rows.map(([n, v1, v2, u]) => {
      const eq = Math.abs(v1 - v2) <= (u === 'cm' ? TOL_SIDE : TOL_ANGLE);
      if (eq) { if (u === 'cm') sideEq++; else angEq++; }
      const unit = u === 'cm' ? ' cm' : '°';
      return `<tr><th scope="row">${n}</th><td>${fmt(v1)}${unit}</td><td>${fmt(v2)}${unit}</td><td class="${eq ? 'eq' : 'neq'}">${eq ? 'Sama' : 'Beda'}</td></tr>`;
    }).join('');
    const rot = ((st.theta % 360) + 360) % 360;
    const pos = [moved ? 'digeser' : null, `diputar ${fmt(rot, 0)}°`, st.mirror ? 'dicerminkan' : null].filter(Boolean).join(', ');
    let note;
    if (sideEq === 3 && angEq === 3) note = snapped ? 'DEF menutupi ABC dengan pas. Semua titik dan sisi berimpit.' : 'Posisi dan arah DEF berbeda, tapi semua pasangan sisi dan sudut tetap sama. Coba klik "Bandingkan Bangun".';
    else note = snapped ? `DEF tidak pas menutupi ABC. Ada ${3 - sideEq} pasang sisi dan ${3 - angEq} pasang sudut yang beda.` : `Ada ${3 - sideEq} pasang sisi dan ${3 - angEq} pasang sudut yang beda.`;
    const card = (label, n, ok) => `<div class="result ${ok ? 'ok' : 'no'}">${statusIcon(ok ? 'done' : 'part')}<div><b>${label}</b><span>${n} dari 3 sama</span></div></div>`;
    result.innerHTML = `
      <div class="result-cards">
        ${card('Sisi yang berpasangan', sideEq, sideEq === 3)}
        ${card('Sudut yang berpasangan', angEq, angEq === 3)}
        <div class="result"><div><b>Posisi DEF</b><span>${pos}</span></div></div>
      </div>
      <p class="sim-note sim-status">${note}</p>
      <details class="details"><summary>Lihat semua ukuran</summary>
        <div class="table-scroll"><table class="data-table compact">
          <caption>Pasangan: A dengan D, B dengan E, C dengan F</caption>
          <thead><tr><th scope="col">Pasangan</th><th scope="col">ABC</th><th scope="col">DEF</th><th scope="col">Hasil</th></tr></thead>
          <tbody>${body}</tbody>
        </table></div>
      </details>`;
    for (const k of ['de', 'ef', 'fd']) {
      root.querySelector(`[data-side="${k}"]`).value = st[k];
      root.querySelector(`[data-out="${k}"]`).textContent = fmt(st[k]);
    }
  }

  // Pindah ke keadaan baru: animasi singkat untuk tombol dan penggeser, langsung saat diseret.
  function go(next, { animate = true, keepSnap = false } = {}) {
    if (!keepSnap) snapped = false;
    stopTween();
    next.theta = next.theta + 360 * Math.round((view.theta - next.theta) / 360);
    const mirrorChanged = next.mirror !== view.mirror;
    st = { ...next };
    renderResult();
    if (!animate || mirrorChanged) {
      view = { ...st };
      draw();
      if (mirrorChanged) gDEF.querySelector('.tri')?.classList.add('fade-in');
      return;
    }
    stopTween = tween(view, st, 260, s => { view = s; draw(); });
  }

  function setSide(k, v) {
    const cand = { ...st, [k]: v };
    if (validTriangle(cand.de, cand.ef, cand.fd)) {
      warn.hidden = true;
      valid = { de: cand.de, ef: cand.ef, fd: cand.fd };
      go(cand);
    } else {
      warn.hidden = false;
      warn.textContent = `${fmt(cand.de)}, ${fmt(cand.ef)}, dan ${fmt(cand.fd)} cm tidak bisa jadi segitiga: dua sisi mana pun harus lebih panjang dari sisi ketiga.`;
      st = { ...st, [k]: v };
      root.querySelector(`[data-out="${k}"]`).textContent = fmt(v);
    }
  }

  function snap() {
    // D ke A, sinar DE searah AB. Cerminkan bila arah putaran DEF berlawanan dengan ABC.
    const base = { ...st, ...valid };
    const local = triangleFromSides(base.de, base.fd, base.ef);
    const mirror = Math.sign(cross(abc[0], abc[1], abc[2])) !== Math.sign(cross(local[0], local[1], local[2]));
    const m = rigid(local, { theta: 0, mirror, t: { x: 0, y: 0 } });
    const theta = ((Math.atan2(abc[1].y - abc[0].y, abc[1].x - abc[0].x) - Math.atan2(m[1].y - m[0].y, m[1].x - m[0].x)) * 180) / Math.PI;
    const rotated = rigid(local, { theta, mirror, t: { x: 0, y: 0 } });
    moved = true;
    snapped = true;
    go({ ...base, mirror, theta, tx: abc[0].x - rotated[0].x, ty: abc[0].y - rotated[0].y }, { keepSnap: true });
  }

  const clamp = s => ({ ...s, tx: Math.min(W - 0.5, Math.max(0.5, s.tx)), ty: Math.min(H - 1.5, Math.max(0.5, s.ty)) });

  // Seret untuk menggeser atau memutar
  let drag = null;
  gDEF.addEventListener('pointerdown', e => {
    const p = svgPoint(svg, e);
    drag = { mode: 'move', dx: p.x / S - st.tx, dy: p.y / S - st.ty };
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
    if (drag.mode === 'move') { moved = true; go(clamp({ ...st, tx: p.x / S - drag.dx, ty: p.y / S - drag.dy }), { animate: false }); }
    else go({ ...st, theta: (Math.atan2(p.x / S - st.tx, -(p.y / S - st.ty)) * 180) / Math.PI }, { animate: false });
  };
  const onUp = () => { drag = null; };
  for (const g of [gDEF, gHandle]) {
    g.addEventListener('pointermove', onMove);
    g.addEventListener('pointerup', onUp);
    g.addEventListener('pointercancel', onUp);
  }
  gDEF.addEventListener('keydown', e => {
    const d = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, -0.5], ArrowDown: [0, 0.5] }[e.key];
    if (!d) return;
    e.preventDefault();
    moved = true;
    go(clamp({ ...st, tx: st.tx + d[0], ty: st.ty + d[1] }), { animate: false });
  });

  root.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'rotL') go({ ...st, ...valid, theta: st.theta - 15 });
    if (act === 'rotR') go({ ...st, ...valid, theta: st.theta + 15 });
    if (act === 'mirror') go({ ...st, ...valid, mirror: !st.mirror });
    if (act === 'snap') snap();
    if (act === 'reset') { moved = false; warn.hidden = true; valid = { de: 5, ef: 7, fd: 8 }; go(START()); }
    if (act === 'record') record();
  });
  root.querySelectorAll('[data-side]').forEach(inp => inp.addEventListener('input', () => setSide(inp.dataset.side, Number(inp.value))));
  showAngles.addEventListener('change', draw);

  function record() {
    if (!canRecord()) return;
    if (!warn.hidden) { warn.scrollIntoView({ block: 'center' }); return; }
    const { mA, mD } = measure();
    const noteEl = root.querySelector('#simA-note');
    onRecord({
      at: new Date().toISOString(), note: noteEl.value.trim(),
      ab: mA.s01, bc: mA.s12, ca: mA.s20, de: mD.s01, ef: mD.s12, fd: mD.s20,
      aA: mA.a0, aB: mA.a1, aC: mA.a2, aD: mD.a0, aE: mD.a1, aF: mD.a2,
      rot: ((st.theta % 360) + 360) % 360, mirror: st.mirror, moved
    });
    noteEl.value = '';
  }

  renderResult();
  draw();
  return { setRecordEnabled(on) { root.querySelector('[data-act="record"]').disabled = !on; } };
}
