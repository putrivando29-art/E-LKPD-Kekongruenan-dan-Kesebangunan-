// Simulasi B: kesebangunan. PQR tetap (PQ = 3, QR = 4, PR = 5 cm).
// STU berpasangan P-S, Q-T, R-U. Mode skala: setiap sisi STU = k × sisi PQR. Mode bebas: sisi diubah sendiri-sendiri.
import { el, grid, ruler, pill, tween, triangleFromSides, triMeasures, centroid, labelPos, sideLabelPos, fmt, validTriangle } from './geo.js';
import { statusIcon } from './art.js';

const S = 30;
const PQR = { pq: 3, qr: 4, pr: 5 };
const MIN_W = 21, MIN_H = 12.5;  // ukuran bidang minimum (cm) pada layar lebar
const TOL_ANGLE = 0.5, TOL_RATIO = 0.005;

export function createSimilaritySim(root, { onRecord, canRecord = () => true }) {
  // Layar sempit (HP): PQR di atas, STU di bawah, agar gambar dan label lebih besar.
  const narrow = root.clientWidth > 0 && root.clientWidth < 560;
  let st = { mode: 'skala', k: 1, st: 3, tu: 4, su: 5 };
  let valid = { st: 3, tu: 4, su: 5 };
  let view = sidesOf(st);
  let stopTween = () => {};

  function sidesOf(s) {
    return s.mode === 'skala' ? { st: PQR.pq * s.k, tu: PQR.qr * s.k, su: PQR.pr * s.k } : { ...valid };
  }

  root.innerHTML = `
    <div class="sim-toolbar" role="group" aria-label="Alat Simulasi B">
      <div class="seg" role="radiogroup" aria-label="Cara mengubah STU">
        <label><input type="radio" name="simB-mode" value="skala" checked> Pakai faktor skala</label>
        <label><input type="radio" name="simB-mode" value="bebas"> Ubah sisi sendiri</label>
      </div>
      <button type="button" class="btn btn-small btn-primary" data-act="k2">k = 2</button>
      <button type="button" class="btn btn-small btn-quiet" data-act="reset">Atur Ulang</button>
    </div>
    <fieldset class="sim-sliders" data-panel="skala">
      <legend>Faktor skala dari PQR ke STU</legend>
      <label>k <input type="range" min="0.5" max="3" step="0.1" data-k><output data-out="k"></output></label>
    </fieldset>
    <fieldset class="sim-sliders" data-panel="bebas" hidden>
      <legend>Panjang sisi STU (cm)</legend>
      <label>ST <input type="range" min="1" max="12" step="0.5" data-side="st"><output data-out="st"></output></label>
      <label>TU <input type="range" min="1" max="12" step="0.5" data-side="tu"><output data-out="tu"></output></label>
      <label>SU <input type="range" min="1" max="12" step="0.5" data-side="su"><output data-out="su"></output></label>
      <p class="sim-warning" role="alert" hidden></p>
    </fieldset>
    <div class="sim-stage"><svg class="sim-svg" role="img" aria-label="Segitiga PQR dan segitiga STU pada kotak 1 cm"></svg></div>
    <div class="sim-result" aria-live="polite"></div>
    <div class="sim-record">
      <label class="sr-only" for="simB-note">Catatan singkat percobaan</label>
      <input id="simB-note" type="text" maxlength="300" placeholder="Catatan singkat (boleh kosong), misal: k = 2">
      <button type="button" class="btn btn-primary" data-act="record">Catat Hasil</button>
    </div>`;

  const svg = root.querySelector('svg');
  const warn = root.querySelector('.sim-warning');
  const result = root.querySelector('.sim-result');

  function drawTri(g, pts, labels, cls) {
    const sp = pts.map(p => ({ x: p.x * S, y: p.y * S }));
    const d = sp.map(p => `${p.x},${p.y}`).join(' ');
    el('polygon', { points: d, class: 'halo' }, g);
    el('polygon', { points: d, class: `tri ${cls}` }, g);
    const c = centroid(sp);
    const m = triMeasures(pts);
    [[0, 1, m.s01], [1, 2, m.s12], [2, 0, m.s20]].forEach(([i, j, len]) => {
      const lp = sideLabelPos(sp[i], sp[j], c, 16);
      pill(g, lp.x, lp.y, `${fmt(len)} cm`);
    });
    [m.a0, m.a1, m.a2].forEach((a, i) => {
      const ap = labelPos(sp[i], c, -26);
      el('text', { x: ap.x, y: ap.y, class: 'a-label', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g).textContent = `${fmt(a)}°`;
      const lp = labelPos(sp[i], c, 22);
      pill(g, lp.x, lp.y, labels[i], { textClass: 'v-label', bgClass: `v-bg ${cls}`, round: true });
    });
  }

  // Titik urutan: [Q, R, P] dan [T, U, S] -> alas mendatar, P di atas Q.
  function layout(s) {
    const pqrL = triangleFromSides(PQR.qr, PQR.pq, PQR.pr);
    const stuL = triangleFromSides(s.tu, s.st, s.su);
    const h1 = -Math.min(...pqrL.map(p => p.y)), h2 = -Math.min(...stuL.map(p => p.y));
    if (narrow) {
      const minX = Math.min(0, ...stuL.map(p => p.x));
      const top = h1 + 1.6, bottom = top + 1.8 + h2;
      return {
        pqr: pqrL.map(p => ({ x: p.x + 1.4, y: p.y + top })),
        stu: stuL.map(p => ({ x: p.x + 1.4 - minX, y: p.y + bottom })),
        w: Math.max(9, 1.4 - minX + Math.max(...stuL.map(p => p.x)) + 1.4),
        h: Math.max(14, bottom + 2)
      };
    }
    const base = Math.max(h1, h2) + 1.8;
    const offX = 1.4 + 4 + 2.2 - Math.min(0, ...stuL.map(p => p.x));
    return {
      pqr: pqrL.map(p => ({ x: p.x + 1.4, y: p.y + base })),
      stu: stuL.map(p => ({ x: p.x + offX, y: p.y + base })),
      w: Math.max(MIN_W, offX + Math.max(...stuL.map(p => p.x)) + 1.4),
      h: Math.max(MIN_H, base + 2)
    };
  }

  function draw(s) {
    const L = layout(s);
    svg.setAttribute('viewBox', `0 0 ${L.w * S} ${L.h * S}`);
    svg.replaceChildren();
    grid(svg, 0, 0, L.w, L.h - 1, S);
    ruler(svg, 1, L.h - 0.95, Math.floor(L.w - 2), S);
    const g = el('g', {}, svg);
    drawTri(g, L.pqr, ['Q', 'R', 'P'], 'shape-1');
    drawTri(g, L.stu, ['T', 'U', 'S'], 'shape-2');
  }

  // Ukuran dari keadaan tujuan (bukan tahap animasi). s01 = QR, s12 = RP, s20 = PQ; a0 = ∠Q, a1 = ∠R, a2 = ∠P.
  function measure() {
    const L = layout(sidesOf(st));
    const mP = triMeasures(L.pqr), mS = triMeasures(L.stu);
    return {
      P: { pq: mP.s20, qr: mP.s01, pr: mP.s12, aP: mP.a2, aQ: mP.a0, aR: mP.a1 },
      T: { st: mS.s20, tu: mS.s01, su: mS.s12, aS: mS.a2, aT: mS.a0, aU: mS.a1 }
    };
  }

  function renderResult() {
    const { P, T } = measure();
    const r = [T.st / P.pq, T.tu / P.qr, T.su / P.pr];
    const ratioSame = Math.max(...r) - Math.min(...r) <= TOL_RATIO;
    const angPairs = [['∠P dan ∠S', P.aP, T.aS], ['∠Q dan ∠T', P.aQ, T.aT], ['∠R dan ∠U', P.aR, T.aU]];
    const angSame = angPairs.every(([, a, b]) => Math.abs(a - b) <= TOL_ANGLE);
    const sideRows = [['PQ dan ST', P.pq, T.st, 'ST : PQ', r[0]], ['QR dan TU', P.qr, T.tu, 'TU : QR', r[1]], ['PR dan SU', P.pr, T.su, 'SU : PR', r[2]]]
      .map(([n, va, vb, lab, q]) => `<tr><th scope="row">${n}</th><td>${fmt(va)} cm</td><td>${fmt(vb)} cm</td><td>${lab} = ${fmt(vb, 2)} : ${fmt(va, 2)} = ${fmt(q, 2)}</td></tr>`).join('');
    const angRows = angPairs.map(([n, a, b]) => {
      const eq = Math.abs(a - b) <= TOL_ANGLE;
      return `<tr><th scope="row">${n}</th><td>${fmt(a)}°</td><td>${fmt(b)}°</td><td class="${eq ? 'eq' : 'neq'}">${eq ? 'Sama' : 'Beda'}</td></tr>`;
    }).join('');
    const card = (ok, label, text) => `<div class="result ${ok ? 'ok' : 'no'}">${statusIcon(ok ? 'done' : 'part')}<div><b>${label}</b><span>${text}</span></div></div>`;
    result.innerHTML = `
      <div class="result-cards">
        ${card(angSame, 'Sudut yang berpasangan', angSame ? 'Semua sama besar' : 'Ada yang beda')}
        ${card(ratioSame, 'Hasil bagi sisi STU : PQR', ratioSame ? `Semua ${fmt(r[0], 2)}` : `${fmt(r[0], 2)}; ${fmt(r[1], 2)}; ${fmt(r[2], 2)}`)}
        <div class="result"><div><b>Sisi STU</b><span>${fmt(T.st)}; ${fmt(T.tu)}; ${fmt(T.su)} cm</span></div></div>
      </div>
      <p class="sim-note sim-status">${ratioSame ? 'Perbandingan sisi yang berpasangan tetap.' : 'Perbandingan sisi yang berpasangan tidak tetap.'} ${angSame ? 'Sudutnya tidak berubah.' : 'Sudutnya ikut berubah.'}</p>
      <details class="details"><summary>Lihat semua ukuran</summary>
        <div class="table-scroll"><table class="data-table compact">
          <caption>Sisi (P dengan S, Q dengan T, R dengan U)</caption>
          <thead><tr><th scope="col">Pasangan</th><th scope="col">PQR</th><th scope="col">STU</th><th scope="col">Hasil bagi</th></tr></thead>
          <tbody>${sideRows}</tbody>
        </table></div>
        <div class="table-scroll"><table class="data-table compact">
          <caption>Sudut</caption>
          <thead><tr><th scope="col">Pasangan</th><th scope="col">PQR</th><th scope="col">STU</th><th scope="col">Hasil</th></tr></thead>
          <tbody>${angRows}</tbody>
        </table></div>
      </details>`;
    root.querySelector('[data-k]').value = st.k;
    root.querySelector('[data-out="k"]').textContent = fmt(st.k);
    for (const k of ['st', 'tu', 'su']) {
      root.querySelector(`[data-side="${k}"]`).value = st[k];
      root.querySelector(`[data-out="${k}"]`).textContent = fmt(st[k]);
    }
  }

  function go(next, animate = true) {
    stopTween();
    st = next;
    renderResult();
    const target = sidesOf(st);
    if (!animate) { view = target; draw(view); return; }
    stopTween = tween(view, target, 260, s => { view = s; draw(s); });
  }

  function setMode(mode) {
    let next = { ...st, mode };
    if (mode === 'bebas' && st.mode === 'skala') {
      const s = sidesOf(st);
      valid = { ...s };
      next = { ...next, ...s };
    }
    root.querySelector('[data-panel="skala"]').hidden = mode !== 'skala';
    root.querySelector('[data-panel="bebas"]').hidden = mode !== 'bebas';
    root.querySelectorAll('input[name="simB-mode"]').forEach(r => { r.checked = r.value === mode; });
    warn.hidden = true;
    go(next);
  }

  root.querySelectorAll('input[name="simB-mode"]').forEach(r => r.addEventListener('change', () => setMode(r.value)));
  root.querySelector('[data-k]').addEventListener('input', e => go({ ...st, k: Math.round(Number(e.target.value) * 10) / 10 }));
  root.querySelectorAll('[data-side]').forEach(inp => inp.addEventListener('input', () => {
    const cand = { ...st, [inp.dataset.side]: Number(inp.value) };
    if (validTriangle(cand.st, cand.tu, cand.su)) {
      valid = { st: cand.st, tu: cand.tu, su: cand.su };
      warn.hidden = true;
      go(cand);
    } else {
      st = cand;
      warn.hidden = false;
      warn.textContent = `${fmt(cand.st)}, ${fmt(cand.tu)}, dan ${fmt(cand.su)} cm tidak bisa jadi segitiga. Gambar menampilkan segitiga terakhir yang bisa.`;
      root.querySelector(`[data-out="${inp.dataset.side}"]`).textContent = fmt(cand[inp.dataset.side]);
    }
  }));
  root.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'k2') { if (st.mode !== 'skala') setMode('skala'); go({ ...st, mode: 'skala', k: 2 }); }
    if (act === 'reset') { valid = { st: 3, tu: 4, su: 5 }; st = { mode: 'skala', k: 1, st: 3, tu: 4, su: 5 }; setMode('skala'); }
    if (act === 'record') record();
  });

  function record() {
    if (!canRecord()) return;
    if (st.mode === 'bebas' && !warn.hidden) return;
    const { P, T } = measure();
    const noteEl = root.querySelector('#simB-note');
    onRecord({
      at: new Date().toISOString(), note: noteEl.value.trim(), mode: st.mode, k: st.mode === 'skala' ? st.k : null,
      pq: P.pq, qr: P.qr, pr: P.pr, st: T.st, tu: T.tu, su: T.su,
      aP: P.aP, aQ: P.aQ, aR: P.aR, aS: T.aS, aT: T.aT, aU: T.aU
    });
    noteEl.value = '';
  }

  renderResult();
  draw(view);
  return { setRecordEnabled(on) { root.querySelector('[data-act="record"]').disabled = !on; } };
}
