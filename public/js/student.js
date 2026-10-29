// Ruang kerja siswa: menampilkan bagian LKPD, menyimpan jawaban otomatis, memeriksa jawaban, dan mengumpulkan.
import { api, download, local, ApiError } from './api.js';
import { esc, fmtTime, fmtClock, toast, confirmDialog, isFilled, fillHint, sectionItems } from './ui.js';
import { observeFigure, problemFigure } from './figures.js';
import { createCongruenceSim } from './sim-congruence.js';
import { createSimilaritySim } from './sim-similarity.js';
import { fmt } from './geo.js';

const SAVE_DELAY = 1000;
const RETRY_DELAY = 5000;

export class Workspace {
  constructor(app) {
    this.app = app;
    this.def = app.def;
    this.user = app.user;
    this.pendingKey = `elkpd.pending.${this.user.id}`;
    this.pending = local.get(this.pendingKey) || {};
    this.state = null;
    this.timer = null;
    this.inflight = null;
    this.feedback = {};
    this.saveStatus = { kind: 'idle', text: '' };
    this.onOnline = () => this.flush();
    window.addEventListener('online', this.onOnline);
    this.onHide = () => { if (document.visibilityState === 'hidden') this.flush({ keepalive: true }); };
    document.addEventListener('visibilitychange', this.onHide);
    this.onBeforeUnload = e => {
      if (Object.keys(this.pending).length) { this.flush({ keepalive: true }); e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', this.onBeforeUnload);
  }

  destroy() {
    window.removeEventListener('online', this.onOnline);
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    clearTimeout(this.timer);
  }

  sectionsOrder() { return [...this.def.sections.map(s => s.id), 'ringkasan']; }
  section(id) { return this.def.sections.find(s => s.id === id); }
  itemDef(id) { for (const s of this.def.sections) for (const it of sectionItems(s)) if (it.id === id) return { ...it, section: s.id }; return null; }
  get submitted() { return this.state?.status === 'submitted'; }
  isLocked(sectionId) { return this.submitted || this.state.locked.includes(sectionId); }

  async load() {
    this.state = await api('/api/submission');
    if (this.submitted && Object.keys(this.pending).length) {
      // Perubahan lokal yang tertinggal setelah pengumpulan tidak dapat dikirim lagi.
      this.pending = {};
      local.del(this.pendingKey);
    }
    for (const [id, v] of Object.entries(this.pending)) {
      if (v === null) delete this.state.answers[id]; else this.state.answers[id] = v;
    }
    if (Object.keys(this.pending).length) {
      this.setSaveStatus('pending', 'Ada jawaban yang belum terkirim, sedang dikirim...');
      this.flush();
    } else {
      this.setSaveStatus('saved', `Tersimpan ${fmtClock(this.state.updatedAt)}`);
    }
  }

  // ---------- Penyimpanan ----------

  setSaveStatus(kind, text) {
    this.saveStatus = { kind, text };
    const el = document.getElementById('save-status');
    if (el) { el.textContent = text; el.dataset.kind = kind; }
  }

  setAnswer(id, value) {
    if (value === '' || (Array.isArray(value) && !value.length)) value = null;
    if (value === null) delete this.state.answers[id]; else this.state.answers[id] = value;
    this.pending[id] = value;
    if (!local.set(this.pendingKey, this.pending)) this.localUnavailable = true;
    this.setSaveStatus('pending', 'Menyimpan...');
    this.refreshStatus(id);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), SAVE_DELAY);
  }

  async flush({ keepalive = false } = {}) {
    clearTimeout(this.timer);
    if (this.inflight) { await this.inflight.catch(() => {}); if (!Object.keys(this.pending).length) return true; }
    const batch = { ...this.pending };
    if (!Object.keys(batch).length) return true;
    this.inflight = (async () => {
      try {
        const res = await api('/api/submission', { method: 'PATCH', body: { changes: batch }, keepalive });
        for (const [id, v] of Object.entries(batch)) if (JSON.stringify(this.pending[id]) === JSON.stringify(v)) delete this.pending[id];
        const rejected = Object.entries(res.rejected || {});
        for (const [id, msg] of rejected) {
          delete this.pending[id];
          this.showFieldError(id, msg);
        }
        local.set(this.pendingKey, this.pending);
        if (!Object.keys(this.pending).length) local.del(this.pendingKey);
        this.state.updatedAt = res.updatedAt;
        this.state.progress = res.progress;
        if (rejected.length) this.setSaveStatus('error', `${rejected.length} jawaban tidak tersimpan. Lihat pesan di bawah pertanyaannya.`);
        else this.setSaveStatus('saved', `Tersimpan ${fmtClock(res.updatedAt)}`);
        this.refreshToc();
        return true;
      } catch (e) {
        if (e.status === 0) {
          this.setSaveStatus('offline', this.localUnavailable
            ? 'Koneksi terputus. Jangan tutup halaman ini sampai jawaban terkirim.'
            : 'Koneksi terputus. Jawaban disimpan sementara di perangkat ini dan dikirim otomatis saat tersambung.');
          this.timer = setTimeout(() => this.flush(), RETRY_DELAY);
        } else if (e.status === 401) {
          this.setSaveStatus('error', 'Sesi berakhir. Masuk kembali; jawaban yang belum terkirim tetap tersimpan di perangkat ini.');
          this.app.sessionExpired();
        } else if (e.data?.code === 'submitted') {
          this.pending = {};
          local.del(this.pendingKey);
          this.setSaveStatus('error', e.message);
          await this.load();
          this.app.route();
        } else {
          this.setSaveStatus('error', `Gagal menyimpan: ${e.message} Mencoba lagi...`);
          this.timer = setTimeout(() => this.flush(), RETRY_DELAY * 2);
        }
        return false;
      } finally {
        this.inflight = null;
      }
    })();
    const ok = await this.inflight;
    if (ok && Object.keys(this.pending).length) return this.flush({ keepalive });
    return ok;
  }

  showFieldError(id, msg) {
    const box = document.querySelector(`[data-item="${id}"] .q-error`);
    if (box) { box.textContent = msg; box.hidden = false; }
  }

  // ---------- Status kelengkapan (dihitung ulang di browser untuk tampilan langsung) ----------

  localProgress() {
    const out = {};
    let filled = 0, total = 0;
    for (const s of this.def.sections) {
      const req = sectionItems(s).filter(i => i.required);
      const missing = req.filter(i => !isFilled(i, this.state.answers[i.id]));
      const any = sectionItems(s).some(i => isFilled(i, this.state.answers[i.id]));
      out[s.id] = { required: req.length, filled: req.length - missing.length, missing, state: missing.length === 0 ? 'lengkap' : any ? 'sebagian' : 'kosong' };
      filled += req.length - missing.length;
      total += req.length;
    }
    return { sections: out, filled, total, percent: total ? Math.round((filled / total) * 100) : 0 };
  }

  sectionBadge(s, p) {
    const sp = p.sections[s.id];
    const hasTeacher = sectionItems(s).some(i => i.graded === 'teacher');
    if (this.submitted) {
      if (this.state.grading.status === 'selesai') return { cls: 'done', text: 'Sudah dinilai' };
      return hasTeacher ? { cls: 'wait', text: 'Menunggu penilaian guru' } : { cls: 'done', text: 'Dikumpulkan' };
    }
    if (this.state.locked.includes(s.id)) return { cls: 'locked', text: 'Sudah diperiksa, terkunci' };
    if (sp.state === 'lengkap') return { cls: 'done', text: 'Lengkap' };
    if (sp.state === 'sebagian') return { cls: 'part', text: `Sebagian (${sp.filled}/${sp.required})` };
    return { cls: 'empty', text: 'Belum diisi' };
  }

  refreshStatus(id) {
    const it = this.itemDef(id);
    const chip = document.querySelector(`[data-item="${id}"] .q-chip`);
    if (chip && it.required) {
      const ok = isFilled(it, this.state.answers[id]);
      chip.className = `q-chip ${ok ? 'ok' : 'no'}`;
      chip.textContent = ok ? 'Sudah diisi' : fillHint(it, this.state.answers[id]);
    }
    const err = document.querySelector(`[data-item="${id}"] .q-error`);
    if (err) err.hidden = true;
    this.refreshToc();
    this.refreshCheckPanel();
  }

  refreshToc() {
    const toc = document.querySelector('.toc');
    if (!toc || !this.state) return;
    const p = this.localProgress();
    toc.querySelector('.progress-fill').style.width = `${p.percent}%`;
    toc.querySelector('.progress-text').textContent = `${p.filled} dari ${p.total} pertanyaan wajib terisi (${p.percent}%)`;
    toc.querySelector('.progress-bar').setAttribute('aria-valuenow', p.percent);
    for (const s of this.def.sections) {
      const b = this.sectionBadge(s, p);
      const li = toc.querySelector(`[data-toc="${s.id}"] .toc-state`);
      if (li) { li.className = `toc-state ${b.cls}`; li.textContent = b.text; }
    }
    const sum = toc.querySelector('[data-toc="ringkasan"] .toc-state');
    if (sum) {
      sum.className = `toc-state ${this.submitted ? 'done' : p.filled === p.total ? 'part' : 'empty'}`;
      sum.textContent = this.submitted ? 'Dikumpulkan' : p.filled === p.total ? 'Siap dikumpulkan' : 'Belum dikumpulkan';
    }
  }

  // ---------- Tampilan ----------

  render(container, sectionId) {
    if (!this.sectionsOrder().includes(sectionId)) sectionId = 'petunjuk';
    this.current = sectionId;
    const order = this.sectionsOrder();
    const idx = order.indexOf(sectionId);
    container.innerHTML = `
      <div class="lkpd-layout">
        <aside class="toc" aria-label="Daftar isi LKPD">${this.tocHtml(sectionId)}</aside>
        <section class="lkpd-main" aria-labelledby="section-title">
          <div class="section-body"></div>
          <nav class="pager" aria-label="Pindah bagian">
            ${idx > 0 ? `<a class="btn" href="#/lkpd/${order[idx - 1]}">Sebelumnya: ${esc(this.navName(order[idx - 1]))}</a>` : '<span></span>'}
            ${idx < order.length - 1 ? `<a class="btn btn-primary" href="#/lkpd/${order[idx + 1]}">Selanjutnya: ${esc(this.navName(order[idx + 1]))}</a>` : ''}
          </nav>
        </section>
      </div>`;
    const body = container.querySelector('.section-body');
    if (sectionId === 'ringkasan') this.renderSummary(body);
    else this.renderSection(body, this.section(sectionId));
    this.refreshToc();
    const t = container.querySelector('#section-title');
    if (t) t.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  navName(id) { return id === 'ringkasan' ? 'Ringkasan' : this.section(id).nav; }

  tocHtml(active) {
    const items = [...this.def.sections.map(s => ({ id: s.id, name: s.nav, title: s.title })), { id: 'ringkasan', name: 'Ringkasan', title: 'Ringkasan pengerjaan' }];
    return `
      <details class="toc-box" ${window.matchMedia('(min-width: 960px)').matches ? 'open' : ''}>
        <summary>Daftar isi dan progres</summary>
        <div class="progress">
          <div class="progress-bar" role="progressbar" aria-label="Progres pengerjaan" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="progress-fill"></div></div>
          <p class="progress-text"></p>
        </div>
        <ol class="toc-list">
          <li><a href="#/">Beranda</a></li>
          ${items.map(i => `<li data-toc="${i.id}" ${i.id === active ? 'class="active"' : ''}>
            <a href="#/lkpd/${i.id}" ${i.id === active ? 'aria-current="page"' : ''}><span class="toc-name">${esc(i.name)}</span><span class="toc-title">${esc(i.title)}</span></a>
            <span class="toc-state"></span></li>`).join('')}
        </ol>
      </details>`;
  }

  sectionHeader(s) {
    return `
      <header class="section-head">
        ${s.kicker ? `<span class="act-tag">${esc(s.kicker)}</span>` : ''}
        <h1 id="section-title" tabindex="-1">${esc(s.title)}</h1>
        <p class="lead">${esc(s.intro)}</p>
      </header>`;
  }

  renderSection(body, s) {
    const st = this.state;
    const pemantikDone = this.localProgress().sections.pemantik.state === 'lengkap';
    const main = ['a1', 'a2', 'a3', 'latihan', 'a4', 'a5'];
    if (main.includes(s.id) && !pemantikDone && !this.submitted) {
      body.innerHTML = `${this.sectionHeader(s)}
        <div class="card gate">
          <h2>Jawab pertanyaan pemantik terlebih dahulu</h2>
          <p>Sebelum masuk ke aktivitas utama, jawablah empat pertanyaan pemantik. Jawaban pemantik tidak dinilai benar atau salah.</p>
          <a class="btn btn-primary" href="#/lkpd/pemantik">Buka Pertanyaan Pemantik</a>
        </div>`;
      return;
    }
    let html = this.sectionHeader(s);
    if (this.submitted) html += `<p class="notice">LKPD sudah dikumpulkan pada ${esc(fmtTime(st.submittedAt))}. Jawaban hanya dapat dibaca.</p>`;
    else if (st.locked.includes(s.id)) html += '<p class="notice">Aktivitas ini sudah diperiksa sehingga jawabannya terkunci.</p>';
    if (st.status === 'reopened') {
      const last = [...st.events].reverse().find(e => e.type === 'buka_kembali');
      html += `<p class="notice notice-accent">Gurumu membuka kembali LKPD untuk revisi${last ? `: "${esc(last.note)}"` : ''}. Kumpulkan lagi setelah selesai.</p>`;
    }
    if (s.id === 'petunjuk') html += this.identityHtml();
    if (s.figure) html += '<div class="card figure-card" data-figure></div>';
    if (s.guide) html += `<div class="card guide"><h2>Panduan menyusun pertanyaan</h2><ul>${s.guide.map(g => `<li>${esc(g)}</li>`).join('')}</ul></div>`;
    if (s.items) html += `<div class="card q-card">${s.items.map(it => this.itemHtml(it, s)).join('')}</div>`;
    if (s.groups) {
      html += s.groups.map(g => `
        <div class="card group" data-group="${g.id}">
          <h2 class="group-title">${esc(g.title)}</h2>
          ${g.steps ? `<div class="steps"><h3>Langkah percobaan</h3><ol>${g.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}
          ${g.sim ? `<div class="sim" data-sim="${g.sim}"></div>` : ''}
          ${g.intro ? `<p>${esc(g.intro)}</p>` : ''}
          ${g.given ? `<div class="given"><h3>Diketahui</h3><ul>${g.given.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
          ${g.figure ? `<div class="problem-figure" data-problem="${g.figure}"></div>` : ''}
          <div class="q-list">${g.items.map(it => this.itemHtml(it, s)).join('')}</div>
        </div>`).join('');
    }
    if (s.checkable) html += '<div class="card check-panel" data-check></div>';
    body.innerHTML = html;

    const fig = body.querySelector('[data-figure]');
    if (fig) observeFigure(fig, s.id);
    body.querySelectorAll('[data-problem]').forEach(n => problemFigure(n, n.dataset.problem));
    body.querySelectorAll('[data-sim]').forEach(n => this.mountSim(n, s));
    this.bindInputs(body, s);
    if (s.checkable) {
      this.renderCheckPanel(s);
      if (st.reveal[s.id]?.checked && st.reveal[s.id]?.allowed && !this.feedback[s.id]) this.runCheck(s, true);
    }
    this.renderGrades(body, s);
  }

  identityHtml() {
    const m = this.def.meta;
    return `
      <div class="card identity">
        <h2>Identitas siswa</h2>
        <dl class="kv">
          <dt>Nama</dt><dd>${esc(this.user.name)}</dd>
          <dt>Email</dt><dd>${esc(this.user.email)}</dd>
          <dt>Kelas</dt><dd>${esc(this.user.className || '-')}</dd>
          <dt>Mata pelajaran</dt><dd>${esc(m.subject)}, ${esc(m.grade)}</dd>
        </dl>
        <p class="muted small">Nama dan kelas diambil dari akunmu. Jika ada yang salah, sampaikan kepada gurumu.</p>
      </div>
      <div class="card">
        <h2>Tujuan pembelajaran</h2>
        <ol>${m.goals.map(g => `<li>${esc(g)}</li>`).join('')}</ol>
        <h2>Petunjuk pengerjaan</h2>
        <ul>${m.instructions.map(g => `<li>${esc(g)}</li>`).join('')}</ul>
      </div>`;
  }

  itemHtml(it, s) {
    const v = this.state.answers[it.id];
    const locked = this.isLocked(s.id);
    const dis = locked ? 'disabled' : '';
    const fid = `f-${it.id}`;
    const filled = isFilled(it, v);
    const chip = it.required ? `<span class="q-chip ${filled ? 'ok' : 'no'}">${filled ? 'Sudah diisi' : fillHint(it, v)}</span>` : '<span class="q-chip opt">Tidak wajib</span>';
    const kind = it.auto ? '<span class="q-kind">Diperiksa otomatis</span>' : it.graded === 'teacher' ? '<span class="q-kind">Dinilai guru</span>' : '';
    let input = '';
    switch (it.type) {
      case 'text':
        input = `<textarea id="${fid}" rows="${it.rows || 3}" maxlength="4000" ${dis}>${esc(v || '')}</textarea>`; break;
      case 'short':
        input = `<input id="${fid}" type="text" maxlength="${it.maxLength || 60}" value="${esc(v || '')}" ${dis} class="input-short">`; break;
      case 'number':
      case 'ratio':
        input = `<span class="input-unit"><input id="${fid}" type="text" inputmode="${it.type === 'number' ? 'decimal' : 'text'}" maxlength="60" placeholder="${esc(it.placeholder || '')}" value="${esc(v || '')}" ${dis}>${it.unit ? `<span>${esc(it.unit)}</span>` : ''}</span>`; break;
      case 'confirm':
        input = `<label class="check-inline"><input id="${fid}" type="checkbox" ${v ? 'checked' : ''} ${dis}> Ya</label>`; break;
      case 'single':
        input = `<div class="options" role="radiogroup" aria-labelledby="${fid}-l">${it.options.map(o => `<label class="opt"><input type="radio" name="${fid}" value="${esc(o.value)}" ${v === o.value ? 'checked' : ''} ${dis}> <span>${esc(o.label)}</span></label>`).join('')}</div>`; break;
      case 'multi':
        input = `<div class="options options-grid" role="group" aria-labelledby="${fid}-l">${it.options.map(o => `<label class="opt"><input type="checkbox" name="${fid}" value="${esc(o.value)}" ${Array.isArray(v) && v.includes(o.value) ? 'checked' : ''} ${dis}> <span>${esc(o.label)}</span></label>`).join('')}</div>`; break;
      case 'simlog':
        input = `<div class="simlog" data-simlog="${it.id}">${this.simlogHtml(it, v, locked)}</div>`; break;
    }
    const labelTag = ['single', 'multi', 'simlog'].includes(it.type) ? 'p' : 'label';
    const forAttr = labelTag === 'label' ? `for="${fid}"` : '';
    return `
      <div class="q" data-item="${it.id}">
        <div class="q-head"><${labelTag} class="q-label" id="${fid}-l" ${forAttr}>${esc(it.label)}</${labelTag}><span class="q-meta">${kind}${chip}</span></div>
        ${input}
        <p class="q-error" role="alert" hidden></p>
        <div class="q-feedback" hidden></div>
        <div class="q-grade" hidden></div>
      </div>`;
  }

  simlogHtml(it, entries, locked) {
    entries = Array.isArray(entries) ? entries : [];
    if (!entries.length) return `<p class="muted small">Belum ada catatan. Klik "Catat hasil" pada simulasi di atas (perlu ${it.minEntries} catatan).</p>`;
    const rows = entries.map((e, i) => {
      const desc = it.sim === 'congruence'
        ? `DEF: ${fmt(e.de)}; ${fmt(e.ef)}; ${fmt(e.fd)} cm. Sudut D, E, F: ${fmt(e.aD)}°, ${fmt(e.aE)}°, ${fmt(e.aF)}°. ${[e.moved ? 'digeser' : '', `diputar ${fmt(e.rot, 0)}°`, e.mirror ? 'dicerminkan' : ''].filter(Boolean).join(', ')}`
        : `${e.mode === 'skala' ? `k = ${fmt(e.k)}` : 'sisi bebas'}. STU: ${fmt(e.st)}; ${fmt(e.tu)}; ${fmt(e.su)} cm. Sudut S, T, U: ${fmt(e.aS)}°, ${fmt(e.aT)}°, ${fmt(e.aU)}°`;
      return `<li><span>${i + 1}. ${esc(desc)}${e.note ? `. Catatan: ${esc(e.note)}` : ''}</span>${locked ? '' : `<button type="button" class="btn btn-small btn-quiet" data-del="${i}" aria-label="Hapus catatan ${i + 1}">Hapus</button>`}</li>`;
    }).join('');
    return `<ol class="simlog-list">${rows}</ol>`;
  }

  mountSim(node, s) {
    const group = s.groups.find(g => g.sim === node.dataset.sim);
    const logItem = group.items.find(i => i.type === 'simlog');
    const onRecord = entry => {
      const list = Array.isArray(this.state.answers[logItem.id]) ? [...this.state.answers[logItem.id]] : [];
      if (list.length >= 12) { toast('Catatan sudah 12. Hapus catatan lama jika ingin menambah.', 'error'); return; }
      list.push(entry);
      this.setAnswer(logItem.id, list);
      this.rerenderSimlog(logItem, s);
      toast(`Catatan ke-${list.length} tersimpan.`);
    };
    const opts = { onRecord, canRecord: () => !this.isLocked(s.id) };
    const sim = node.dataset.sim === 'congruence' ? createCongruenceSim(node, opts) : createSimilaritySim(node, opts);
    sim.setRecordEnabled(!this.isLocked(s.id));
  }

  rerenderSimlog(it, s) {
    const box = document.querySelector(`[data-simlog="${it.id}"]`);
    if (box) box.innerHTML = this.simlogHtml(it, this.state.answers[it.id], this.isLocked(s.id));
  }

  bindInputs(body, s) {
    if (this.isLocked(s.id)) return;
    for (const it of sectionItems(s)) {
      const q = body.querySelector(`[data-item="${it.id}"]`);
      if (!q) continue;
      const fid = `f-${it.id}`;
      if (['text', 'short', 'number', 'ratio'].includes(it.type)) {
        const inp = q.querySelector(`#${fid}`);
        inp.addEventListener('input', () => this.setAnswer(it.id, inp.value));
        inp.addEventListener('blur', () => this.flush());
      } else if (it.type === 'confirm') {
        const inp = q.querySelector(`#${fid}`);
        inp.addEventListener('change', () => this.setAnswer(it.id, inp.checked));
      } else if (it.type === 'single') {
        q.querySelectorAll('input').forEach(r => r.addEventListener('change', () => this.setAnswer(it.id, r.value)));
      } else if (it.type === 'multi') {
        q.querySelectorAll('input').forEach(c => c.addEventListener('change', () => {
          this.setAnswer(it.id, [...q.querySelectorAll('input:checked')].map(x => x.value));
        }));
      } else if (it.type === 'simlog') {
        q.addEventListener('click', e => {
          const i = e.target.closest('[data-del]')?.dataset.del;
          if (i === undefined) return;
          const list = [...(this.state.answers[it.id] || [])];
          list.splice(Number(i), 1);
          this.setAnswer(it.id, list);
          this.rerenderSimlog(it, s);
        });
      }
    }
  }

  // ---------- Periksa jawaban dan pembahasan ----------

  renderCheckPanel(s) {
    const panel = document.querySelector('[data-check]');
    if (!panel) return;
    const sp = this.localProgress().sections[s.id];
    const r = this.state.reveal[s.id];
    const mode = this.state.feedbackMode;
    let reason = '';
    if (sp.missing.length && !r.checked && !this.submitted) reason = `Lengkapi ${sp.missing.length} pertanyaan wajib lagi pada aktivitas ini sebelum memeriksa jawaban.`;
    else if (r.allowed || (mode === 'sebelum' && !this.submitted)) reason = '';
    else if (!this.submitted) reason = mode === 'setelah_semua'
      ? 'Gurumu mengatur jawaban benar dan pembahasan baru dibuka setelah seluruh siswa di kelasmu mengumpulkan LKPD.'
      : 'Gurumu mengatur jawaban benar dan pembahasan baru dapat dilihat setelah LKPD dikumpulkan.';
    else reason = r.reason || 'Pemeriksaan belum tersedia.';
    const can = !reason;
    panel.innerHTML = `
      <h2>Periksa jawaban</h2>
      <p class="muted">Pemeriksaan otomatis hanya untuk soal yang memiliki kunci (pilihan, isian bilangan, dan perbandingan). Jawaban uraian dinilai oleh gurumu.</p>
      ${mode === 'sebelum' && !r.checked && !this.submitted ? '<p class="notice notice-accent">Setelah kamu memeriksa jawaban, seluruh jawaban pada aktivitas ini terkunci dan tidak dapat diubah.</p>' : ''}
      <div class="check-actions">
        <button type="button" class="btn btn-primary" data-run-check ${can ? '' : 'aria-disabled="true"'}>Periksa Jawaban</button>
        <button type="button" class="btn" data-show-key ${this.feedback[s.id] ? '' : 'aria-disabled="true"'}>Lihat Pembahasan</button>
      </div>
      <p class="check-reason" role="status">${esc(reason)}</p>
      <div class="check-result" role="status"></div>`;
    panel.querySelector('[data-run-check]').addEventListener('click', () => {
      if (!can) { panel.querySelector('.check-reason').textContent = reason || 'Pemeriksaan belum tersedia.'; this.highlightMissing(s); return; }
      this.runCheck(s, false);
    });
    panel.querySelector('[data-show-key]').addEventListener('click', () => {
      if (!this.feedback[s.id]) { panel.querySelector('.check-reason').textContent = 'Pembahasan tersedia setelah kamu memeriksa jawaban.'; return; }
      this.showFeedback(s, true);
    });
    if (this.feedback[s.id]) this.showFeedback(s, this.keyShown?.[s.id]);
  }

  refreshCheckPanel() {
    const s = this.section(this.current);
    if (s && s.checkable && document.querySelector('[data-check]')) this.renderCheckPanel(s);
  }

  highlightMissing(s) {
    const sp = this.localProgress().sections[s.id];
    sp.missing.forEach(it => this.showFieldError(it.id, fillHint(it, this.state.answers[it.id])));
    const first = sp.missing[0];
    if (first) document.querySelector(`[data-item="${first.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async runCheck(s, silent) {
    const r = this.state.reveal[s.id];
    if (!silent) {
      const saved = await this.flush();
      if (!saved) { toast('Jawaban belum tersimpan di server. Periksa koneksi lalu coba lagi.', 'error'); return; }
    }
    let confirmLock = false;
    if (!silent && this.state.feedbackMode === 'sebelum' && !r.checked && !this.submitted) {
      confirmLock = await confirmDialog({
        title: 'Periksa jawaban sekarang?',
        body: '<p>Setelah diperiksa, semua jawaban pada aktivitas ini <strong>terkunci</strong> dan tidak dapat diubah. Pastikan kamu sudah yakin.</p>',
        ok: 'Ya, periksa dan kunci'
      });
      if (!confirmLock) return;
    }
    try {
      const res = await api(`/api/submission/check/${s.id}`, { method: 'POST', body: { confirmLock } });
      this.feedback[s.id] = res;
      if (!silent) {
        await this.load();
        this.render(document.getElementById('view'), s.id);
        toast(`Skor otomatis aktivitas ini: ${res.score} dari ${res.max}.`);
      } else {
        this.renderCheckPanel(s);
      }
    } catch (e) {
      const panel = document.querySelector('[data-check] .check-reason');
      if (panel) panel.textContent = e.message;
      if (!silent) toast(e.message, 'error');
    }
  }

  showFeedback(s, withKey) {
    const res = this.feedback[s.id];
    this.keyShown = { ...(this.keyShown || {}), [s.id]: !!withKey };
    for (const row of res.items) {
      const box = document.querySelector(`[data-item="${row.id}"] .q-feedback`);
      if (!box) continue;
      const verdict = row.unreadable ? 'Jawaban tidak dapat dibaca sebagai bilangan atau perbandingan' : row.correct ? 'Benar' : 'Belum tepat';
      box.innerHTML = `<p class="fb ${row.correct ? 'fb-ok' : 'fb-no'}"><strong>${verdict}</strong> (${row.correct ? row.points : 0}/${row.points})</p>
        ${withKey ? `<p class="fb-key"><strong>Jawaban yang diharapkan:</strong> ${esc(row.answer)}</p><p class="fb-key">${esc(row.explain)}</p>` : ''}`;
      box.hidden = false;
    }
    const result = document.querySelector('[data-check] .check-result');
    if (result) result.innerHTML = `<p class="score-line">Skor otomatis: <strong>${res.score}</strong> dari ${res.max}.${withKey ? '' : ' Klik "Lihat Pembahasan" untuk melihat penjelasannya.'}</p>`;
    const keyBtn = document.querySelector('[data-show-key]');
    if (keyBtn) keyBtn.removeAttribute('aria-disabled');
  }

  renderGrades(body, s) {
    const g = this.state.grading;
    if (g.status !== 'selesai') return;
    for (const it of sectionItems(s)) {
      const gr = g.grades[it.id];
      if (!gr) continue;
      const box = body.querySelector(`[data-item="${it.id}"] .q-grade`);
      if (!box) continue;
      box.innerHTML = `${typeof gr.score === 'number' ? `<p><strong>Skor dari guru:</strong> ${fmt(gr.score)} dari ${it.points}</p>` : ''}${gr.comment ? `<p><strong>Umpan balik guru:</strong> ${esc(gr.comment)}</p>` : ''}`;
      box.hidden = false;
    }
  }

  // ---------- Ringkasan dan pengumpulan ----------

  renderSummary(body) {
    const st = this.state;
    const p = this.localProgress();
    const complete = p.filled === p.total;
    const rows = this.def.sections.map(s => {
      const b = this.sectionBadge(s, p);
      const sp = p.sections[s.id];
      return `<tr><th scope="row"><a href="#/lkpd/${s.id}">${esc(s.nav)}: ${esc(s.title)}</a></th><td>${sp.filled}/${sp.required}</td><td><span class="toc-state ${b.cls}">${esc(b.text)}</span></td></tr>`;
    }).join('');
    const missing = this.def.sections.filter(s => p.sections[s.id].missing.length).map(s => `
      <li><a href="#/lkpd/${s.id}">${esc(s.nav)}: ${esc(s.title)}</a>
        <ul>${p.sections[s.id].missing.map(it => `<li>${esc(it.label)} <span class="muted">(${esc(fillHint(it, st.answers[it.id]))})</span></li>`).join('')}</ul></li>`).join('');

    let action;
    if (this.submitted) {
      action = `
        <div class="card done-card">
          <h2>LKPD berhasil dikumpulkan</h2>
          <dl class="kv">
            <dt>Waktu pengumpulan</dt><dd>${esc(fmtTime(st.submittedAt, { dateStyle: 'long', timeStyle: 'short' }))}</dd>
            <dt>Status</dt><dd>${st.grading.status === 'selesai' ? 'Sudah dinilai guru' : 'Dikumpulkan, menunggu penilaian guru'}</dd>
            ${st.score ? `<dt>Skor otomatis</dt><dd>${st.score.auto} dari ${st.score.autoMax}</dd>` : ''}
            ${st.score && st.score.final !== null ? `<dt>Skor uraian dari guru</dt><dd>${fmt(st.score.manual)} dari ${st.score.manualMax}</dd><dt>Nilai akhir</dt><dd><strong>${fmt(st.score.final)}</strong></dd>` : ''}
          </dl>
          ${st.grading.status === 'selesai' && st.grading.note ? `<p><strong>Catatan guru:</strong> ${esc(st.grading.note)}</p>` : ''}
          <button type="button" class="btn btn-primary" data-pdf>Unduh LKPD (PDF)</button>
        </div>`;
    } else {
      action = `
        <div class="card submit-card">
          <h2>Kumpulkan LKPD</h2>
          ${complete
            ? '<p>Semua pertanyaan wajib sudah terisi. Periksa kembali jawabanmu sebelum mengumpulkan. Setelah dikumpulkan, jawaban tidak dapat diubah lagi.</p>'
            : `<p class="notice">Masih ada ${p.total - p.filled} pertanyaan wajib yang belum diisi. Tombol Kumpulkan LKPD aktif setelah semuanya terisi.</p>`}
          <button type="button" class="btn btn-primary btn-large" data-submit ${complete ? '' : 'aria-disabled="true"'}>Kumpulkan LKPD</button>
          <div class="submit-msg" role="alert"></div>
          ${missing ? `<div class="missing"><h3>Pertanyaan yang belum diisi</h3><ul>${missing}</ul></div>` : ''}
        </div>`;
    }

    body.innerHTML = `
      <header class="section-head">
        <h1 id="section-title" tabindex="-1">Ringkasan Pengerjaan</h1>
        <p class="lead">Periksa status setiap bagian sebelum mengumpulkan LKPD.</p>
      </header>
      ${action}
      <div class="card">
        <table class="data-table">
          <caption>Status setiap bagian</caption>
          <thead><tr><th scope="col">Bagian</th><th scope="col">Terisi</th><th scope="col">Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    body.querySelector('[data-pdf]')?.addEventListener('click', async e => {
      e.target.disabled = true;
      try { await download('/api/submission/pdf'); } catch (err) { toast(err.message, 'error'); }
      e.target.disabled = false;
    });
    const btn = body.querySelector('[data-submit]');
    btn?.addEventListener('click', () => this.submit(btn, body));
  }

  async submit(btn, body) {
    const msg = body.querySelector('.submit-msg');
    const p = this.localProgress();
    if (p.filled < p.total) {
      msg.innerHTML = `<p class="form-error">LKPD belum dapat dikumpulkan. Masih ada ${p.total - p.filled} pertanyaan wajib yang belum diisi. Lihat daftar di bawah.</p>`;
      body.querySelector('.missing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (btn.dataset.busy) return;
    const saved = await this.flush();
    if (!saved) { msg.innerHTML = '<p class="form-error">Jawaban terakhir belum tersimpan di server. Periksa koneksi, lalu coba lagi.</p>'; return; }
    const ok = await confirmDialog({
      title: 'Kumpulkan LKPD sekarang?',
      body: `<p>Kamu akan mengumpulkan LKPD atas nama <strong>${esc(this.user.name)}</strong> (${esc(this.user.className || '-')}).</p><p>Setelah dikumpulkan, jawaban tidak dapat diubah kecuali gurumu membukanya kembali.</p>`,
      ok: 'Ya, kumpulkan'
    });
    if (!ok) return;
    btn.dataset.busy = '1';
    btn.setAttribute('aria-disabled', 'true');
    btn.textContent = 'Mengirim...';
    try {
      const res = await api('/api/submission/submit', { method: 'POST', body: { confirm: true } });
      this.state = res.state;
      this.pending = {};
      local.del(this.pendingKey);
      toast(res.already ? 'LKPD sudah pernah dikumpulkan sebelumnya.' : 'LKPD berhasil dikumpulkan.');
      this.render(document.getElementById('view'), 'ringkasan');
    } catch (e) {
      delete btn.dataset.busy;
      btn.removeAttribute('aria-disabled');
      btn.textContent = 'Kumpulkan LKPD';
      if (e.data?.code === 'incomplete') {
        const list = e.data.missing.map(m => `<li>${esc(m.title)}: ${m.items.map(i => esc(i.label)).join('; ')}</li>`).join('');
        msg.innerHTML = `<p class="form-error">${esc(e.message)}</p><ul>${list}</ul>`;
      } else {
        msg.innerHTML = `<p class="form-error">${esc(e.message)}</p>`;
      }
    }
  }
}

export { ApiError };
