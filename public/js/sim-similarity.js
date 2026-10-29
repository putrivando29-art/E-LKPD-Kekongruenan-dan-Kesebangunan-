// Simulasi B: kesebangunan. PQR tetap (PQ = 3, QR = 4, PR = 5 cm).
// STU berpasangan P-S, Q-T, R-U. Mode skala: setiap sisi STU = k × sisi PQR. Mode bebas: sisi diubah sendiri-sendiri.
import { el, grid, triangleFromSides, triMeasures, centroid, labelPos, sideLabelPos, fmt, validTriangle } from './geo.js';

const S = 30;
const PQR = { pq: 3, qr: 4, pr: 5 };
const MIN_W = 20, MIN_H = 11.5;
const TOL_ANGLE = 0.5, TOL_RATIO = 0.005;

export function createSimilaritySim(root, { onRecord, canRecord = () => true }) {
  let st = { mode: 'skala', k: 1, st: 3, tu: 4, su: 5 };
  let lastValid = { st: 3, tu: 4, su: 5 };

  root.innerHTML = `
    <div class="sim-toolbar" role="group" aria-label="Alat Simulasi B">
      <div class="seg" role="radiogroup" aria-label="Mode pengubahan">
        <label><input type="radio" name="simB-mode" value="skala" checked> Faktor skala</label>
        <label><input type="radio" name="simB-mode" value="bebas"> Ubah sisi satu per satu</label>
      </div>
      <button type="button" class="btn btn-small" data-act="k2">Atur k = 2</button>
      <button type="button" class="btn btn-small btn-quiet" data-act="reset">Atur Ulang Simulasi</button>
    </div>
    <fieldset class="sim-sliders" data-panel="skala">
      <legend>Faktor skala dari PQR ke STU</legend>
      <label>k <input type="range" min="0.5" max="3" step="0.1" data-k><output data-out="k"></output></label>
    </fieldset>
    <fieldset class="sim-sliders" data-panel="bebas" hidden>
      <legend>Panjang sisi segitiga STU (cm)</legend>
      <label>ST <input type="range" min="1" max="12" step="0.5" data-side="st"><output data-out="st"></output></label>
      <label>TU <input type="range" min="1" max="12" step="0.5" data-side="tu"><output data-out="tu"></output></label>
      <label>SU <input type="range" min="1" max="12" step="0.5" data-side="su"><output data-out="su"></output></label>
      <p class="sim-warning" role="alert" hidden></p>
    </fieldset>
    <div class="sim-stage"><svg class="sim-svg" role="img" aria-label="Segitiga PQR dan segitiga STU pada petak 1 cm"></svg></div>
    <div class="sim-compare"></div>
    <div class="sim-record">
      <label class="sr-only" for="simB-note">Catatan singkat percobaan</label>
      <input id="simB-note" type="text" maxlength="300" placeholder="Catatan singkat (tidak wajib), misalnya: k = 2">
      <button type="button" class="btn" data-act="record">Catat hasil</button>
    </div>`;

  const svg = root.querySelector('svg');
  const warn = root.querySelector('.sim-warning');
  const cmp = root.querySelector('.sim-compare');
  let current = null;

  function sides() {
    return st.mode === 'skala' ? { st: PQR.pq * st.k, tu: PQR.qr * st.k, su: PQR.pr * st.k } : lastValid;
  }

  function drawTri(g, pts, labels, cls) {
    const sp = pts.map(p => ({ x: p.x * S, y: p.y * S }));
    el('polygon', { points: sp.map(p => `${p.x},${p.y}`).join(' '), class: `tri ${cls}` }, g);
    const c = centroid(sp);
    const m = triMeasures(pts);
    const angles = [m.a0, m.a1, m.a2];
    sp.forEach((p, i) => {
      el('circle', { cx: p.x, cy: p.y, r: 4, class: `vertex ${cls}` }, g);
      const lp = labelPos(p, c, 16);
      el('text', { x: lp.x, y: lp.y, class: 'v-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g).textContent = labels[i];
      const ap = labelPos(p, c, -24);
      el('text', { x: ap.x, y: ap.y, class: 'a-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g).textContent = `${fmt(angles[i])}°`;
    });
    [[0, 1, m.s01], [1, 2, m.s12], [2, 0, m.s20]].forEach(([i, j, len]) => {
      const lp = sideLabelPos(sp[i], sp[j], c, 14);
      el('text', { x: lp.x, y: lp.y, class: 's-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g).textContent = `${fmt(len)} cm`;
    });
    return m;
  }

  function render() {
    const s = sides();
    // Titik urutan: Q (0), R (1), P (2) -> alas QR mendatar, P di atas Q.
    const pqrL = triangleFromSides(PQR.qr, PQR.pq, PQR.pr);
    const stuL = triangleFromSides(s.tu, s.st, s.su);
    const h1 = -Math.min(...pqrL.map(p => p.y)), h2 = -Math.min(...stuL.map(p => p.y));
    const w2x = Math.min(...stuL.map(p => p.x)), w2X = Math.max(...stuL.map(p => p.x));
    const base = Math.max(h1, h2) + 1.5;
    const pqr = pqrL.map(p => ({ x: p.x + 1.2, y: p.y + base }));
    const offX = 1.2 + 4 + 2 - Math.min(0, w2x);
    const stu = stuL.map(p => ({ x: p.x + offX, y: p.y + base }));
    const Wd = Math.max(MIN_W, offX + w2X + 1.2), Hd = Math.max(MIN_H, base + 1.2);
    svg.setAttribute('viewBox', `0 0 ${Wd * S} ${Hd * S}`);
    svg.replaceChildren();
    grid(svg, 0, 0, Wd, Hd, S);
    const g = el('g', {}, svg);
    const mP = drawTri(g, pqr, ['Q', 'R', 'P'], 'shape-1');
    const mS = drawTri(g, stu, ['T', 'U', 'S'], 'shape-2');
    // Urutan simpul: [Q, R, P] dan [T, U, S]. s01 = QR, s12 = RP, s20 = PQ; a0 = ∠Q, a1 = ∠R, a2 = ∠P.
    const P = { pq: mP.s20, qr: mP.s01, pr: mP.s12, aP: mP.a2, aQ: mP.a0, aR: mP.a1 };
    const T = { st: mS.s20, tu: mS.s01, su: mS.s12, aS: mS.a2, aT: mS.a0, aU: mS.a1 };
    current = { P, T };
    root.querySelector('[data-k]').value = st.k;
    root.querySelector('[data-out="k"]').textContent = fmt(st.k);
    for (const k of ['st', 'tu', 'su']) {
      root.querySelector(`[data-side="${k}"]`).value = st[k];
      root.querySelector(`[data-out="${k}"]`).textContent = fmt(st[k]);
    }
    renderCompare(P, T);
  }

  function renderCompare(P, T) {
    const r = [T.st / P.pq, T.tu / P.qr, T.su / P.pr];
    const ratioSame = Math.max(...r) - Math.min(...r) <= TOL_RATIO;
    const angPairs = [['∠P', P.aP, '∠S', T.aS], ['∠Q', P.aQ, '∠T', T.aT], ['∠R', P.aR, '∠U', T.aU]];
    const angSame = angPairs.every(([, a, , b]) => Math.abs(a - b) <= TOL_ANGLE);
    const sideRows = [['PQ', P.pq, 'ST', T.st, r[0]], ['QR', P.qr, 'TU', T.tu, r[1]], ['PR', P.pr, 'SU', T.su, r[2]]]
      .map(([a, va, b, vb, q]) => `<tr><th scope="row">${a} dan ${b}</th><td>${fmt(va)} cm</td><td>${fmt(vb)} cm</td><td>${b} : ${a} = ${fmt(vb, 2)} : ${fmt(va, 2)} = ${fmt(q, 2)}</td></tr>`).join('');
    const angRows = angPairs.map(([a, va, b, vb]) => {
      const eq = Math.abs(va - vb) <= TOL_ANGLE;
      return `<tr><th scope="row">${a} dan ${b}</th><td>${fmt(va)}°</td><td>${fmt(vb)}°</td><td class="${eq ? 'eq' : 'neq'}">${eq ? 'Sama' : 'Berbeda'}</td></tr>`;
    }).join('');
    const ratioText = ratioSame
      ? `Ketiga hasil bagi sama, yaitu ${fmt(r[0], 2)}. Perbandingan sisi bersesuaian tetap.`
      : `Hasil bagi ${fmt(r[0], 2)}; ${fmt(r[1], 2)}; ${fmt(r[2], 2)} tidak sama. Perbandingan sisi bersesuaian tidak tetap.`;
    cmp.innerHTML = `
      <table class="data-table compact">
        <caption>Sisi yang bersesuaian (P dengan S, Q dengan T, R dengan U)</caption>
        <thead><tr><th scope="col">Pasangan</th><th scope="col">PQR</th><th scope="col">STU</th><th scope="col">Hasil bagi</th></tr></thead>
        <tbody>${sideRows}</tbody>
      </table>
      <table class="data-table compact">
        <caption>Sudut yang bersesuaian</caption>
        <thead><tr><th scope="col">Pasangan</th><th scope="col">PQR</th><th scope="col">STU</th><th scope="col">Hasil</th></tr></thead>
        <tbody>${angRows}</tbody>
      </table>
      <ul class="sim-status">
        <li><strong>Sudut bersesuaian:</strong> ${angSame ? 'sama besar semua.' : 'tidak semua sama besar.'}</li>
        <li><strong>Perbandingan sisi:</strong> ${ratioText}</li>
      </ul>`;
  }

  function setMode(mode) {
    if (mode === 'bebas' && st.mode === 'skala') {
      const s = sides();
      st.st = s.st; st.tu = s.tu; st.su = s.su;
      lastValid = { ...s };
    }
    st.mode = mode;
    root.querySelector('[data-panel="skala"]').hidden = mode !== 'skala';
    root.querySelector('[data-panel="bebas"]').hidden = mode !== 'bebas';
    root.querySelectorAll('input[name="simB-mode"]').forEach(r => { r.checked = r.value === mode; });
    warn.hidden = true;
    render();
  }

  root.querySelectorAll('input[name="simB-mode"]').forEach(r => r.addEventListener('change', () => setMode(r.value)));
  root.querySelector('[data-k]').addEventListener('input', e => { st.k = Math.round(Number(e.target.value) * 10) / 10; render(); });
  root.querySelectorAll('[data-side]').forEach(inp => inp.addEventListener('input', () => {
    st[inp.dataset.side] = Number(inp.value);
    if (validTriangle(st.st, st.tu, st.su)) { lastValid = { st: st.st, tu: st.tu, su: st.su }; warn.hidden = true; }
    else {
      warn.hidden = false;
      warn.textContent = `Panjang ${fmt(st.st)}, ${fmt(st.tu)}, dan ${fmt(st.su)} cm tidak dapat membentuk segitiga. Gambar menampilkan segitiga terakhir yang valid.`;
    }
    render();
  }));
  root.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'k2') { setMode('skala'); st.k = 2; render(); }
    if (act === 'reset') { st = { mode: 'skala', k: 1, st: 3, tu: 4, su: 5 }; lastValid = { st: 3, tu: 4, su: 5 }; setMode('skala'); }
    if (act === 'record') record();
  });

  function record() {
    if (!canRecord()) return;
    if (st.mode === 'bebas' && !warn.hidden) return;
    const { P, T } = current;
    const noteEl = root.querySelector('#simB-note');
    onRecord({
      at: new Date().toISOString(), note: noteEl.value.trim(), mode: st.mode, k: st.mode === 'skala' ? st.k : null,
      pq: P.pq, qr: P.qr, pr: P.pr, st: T.st, tu: T.tu, su: T.su,
      aP: P.aP, aQ: P.aQ, aR: P.aR, aS: T.aS, aT: T.aT, aU: T.aU
    });
    noteEl.value = '';
  }

  render();
  return { setRecordEnabled(on) { root.querySelector('[data-act="record"]').disabled = !on; } };
}
