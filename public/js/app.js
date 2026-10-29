// Titik masuk aplikasi: memuat isi LKPD, memeriksa sesi, dan mengatur halaman berdasarkan alamat (#/...).
// Tampilan di sini hanya kenyamanan. Hak akses selalu diperiksa ulang oleh server pada setiap permintaan.
import { api } from './api.js';
import { esc, toast } from './ui.js';
import { Workspace } from './student.js';
import { renderDashboard, renderStudent } from './teacher.js';
import { icon, coverArt } from './art.js';

const view = document.getElementById('view');

const app = {
  def: null,
  user: null,
  ws: null,

  async start() {
    document.querySelector('.brand-mark').innerHTML = icon('ruler');
    view.innerHTML = '<p class="loading" role="status">Memuat E-LKPD...</p>';
    try {
      const [def, me] = await Promise.all([api('/api/lkpd'), api('/api/me')]);
      this.def = def;
      this.user = me.user;
    } catch (e) {
      const hint = e.status === 404
        ? '<p class="small">Server E-LKPD tidak ditemukan. Jika website dipasang di Vercel, pastikan folder <code>api/</code> dan berkas <code>vercel.json</code> ikut terunggah.</p>'
        : '';
      view.innerHTML = `<div class="card error-card"><h1>E-LKPD tidak dapat dimuat</h1><p>${esc(e.message)}</p>${hint}<p><a class="btn" href="">Coba lagi</a></p></div>`;
      return;
    }
    window.addEventListener('hashchange', () => this.route());
    document.getElementById('logout').addEventListener('click', () => this.logout());
    this.route();
  },

  renderHeader() {
    const who = document.getElementById('who');
    const logout = document.getElementById('logout');
    const save = document.getElementById('save-status');
    if (this.user) {
      who.innerHTML = `<span class="who-name">${esc(this.user.name)}</span><span class="who-role">${this.user.role === 'guru' ? 'Guru' : esc(this.user.className || 'Siswa')}</span>`;
      logout.hidden = false;
    } else {
      who.innerHTML = '';
      logout.hidden = true;
    }
    const inLkpd = location.hash.startsWith('#/lkpd');
    save.hidden = !(inLkpd && this.ws);
    if (inLkpd && this.ws) { save.textContent = this.ws.saveStatus.text; save.dataset.kind = this.ws.saveStatus.kind; }
  },

  async route() {
    const hash = location.hash || '#/';
    const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const [page, a] = parts;
    try {
      if (!page) this.home();
      else if (page === 'masuk') this.login(a === 'guru' ? 'guru' : 'siswa');
      else if (page === 'daftar') this.register();
      else if (page === 'daftar-guru') this.registerTeacher();
      else if (page === 'lkpd') await this.lkpd(a || 'petunjuk');
      else if (page === 'guru') await this.teacher(parts);
      else this.notFound();
    } catch (e) {
      view.innerHTML = `<div class="card error-card"><h1>Ada yang salah</h1><p>${esc(e.message)}</p><p><a class="btn" href="#/">Ke Beranda</a></p></div>`;
    }
    this.renderHeader();
  },

  home() {
    const m = this.def.meta;
    const startHref = this.user?.role === 'siswa' ? '#/lkpd/petunjuk' : this.user?.role === 'guru' ? '#/guru' : '#/masuk/siswa';
    const acts = this.def.sections.filter(s => s.step);
    view.innerHTML = `
      <div class="home">
        <section class="hero">
          <div>
            <span class="hero-meta">${esc(m.subject)} · ${esc(m.grade)}</span>
            <h1 id="section-title" tabindex="-1">E-LKPD <span class="hl">Kekongruenan</span> dan <span class="hl">Kesebangunan</span></h1>
            <p class="hero-lead">${esc(m.tagline)}</p>
            <p class="hero-author">Disusun oleh <span>${esc(m.author)}</span></p>
            <div class="hero-actions">
              <a class="btn btn-primary btn-large" href="${startHref}">${this.user?.role === 'guru' ? 'Buka Dasbor Guru' : 'Mulai Belajar'}</a>
              ${this.user ? '' : '<a class="btn btn-soft btn-large" href="#/masuk/guru">Masuk sebagai Guru</a>'}
            </div>
            ${this.user ? `<p class="muted">Kamu masuk sebagai ${esc(this.user.name)}.</p>` : '<p class="muted">Belum punya akun? <a href="#/daftar">Daftar pakai kode kelas</a>.</p>'}
          </div>
          ${coverArt()}
        </section>

        <h2>Yang akan kamu lakukan</h2>
        <ol class="journey">
          ${acts.map(s => `<li data-accent="${s.accent}"><span class="num">${s.step}</span><span class="j-name">${esc(s.title)}</span><span class="j-text">${esc(s.intro.split('.')[0])}.</span></li>`).join('')}
        </ol>

        <div class="home-grid">
          <section class="card sticky-note">
            <span class="tape" aria-hidden="true"></span>
            <h2>${icon('star')} Tujuan belajar</h2>
            <ol>${m.goals.map(g => `<li>${esc(g)}</li>`).join('')}</ol>
          </section>
          <section class="card" id="petunjuk-penggunaan">
            <h2>${icon('book')} Cara memakai</h2>
            <ol>${m.usage.map(g => `<li>${esc(g)}</li>`).join('')}</ol>
          </section>
        </div>
      </div>`;
  },

  login(role) {
    if (this.user) { location.hash = this.user.role === 'guru' ? '#/guru' : '#/lkpd/petunjuk'; return; }
    view.innerHTML = `
      <div class="auth">
        <div class="card auth-card">
          <div class="role-tabs" role="tablist" aria-label="Pilih peran">
            <a role="tab" href="#/masuk/siswa" aria-selected="${role === 'siswa'}" class="${role === 'siswa' ? 'active' : ''}">Siswa</a>
            <a role="tab" href="#/masuk/guru" aria-selected="${role === 'guru'}" class="${role === 'guru' ? 'active' : ''}">Guru</a>
          </div>
          <h1 id="section-title" tabindex="-1">Masuk sebagai ${role === 'guru' ? 'Guru' : 'Siswa'}</h1>
          <form data-login novalidate>
            <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
            <label class="field"><span>Kata sandi</span><input name="password" type="password" autocomplete="current-password" required></label>
            <p class="form-error" role="alert" hidden></p>
            <button class="btn btn-primary btn-large">Masuk</button>
          </form>
          <div class="auth-alt">
          ${role === 'siswa'
            ? '<p>Belum punya akun? <a href="#/daftar">Daftar pakai kode kelas</a>.</p><p class="muted small">Lupa kata sandi? Minta gurumu mengatur ulang.</p>'
            : '<p>Guru baru? <a href="#/daftar-guru">Daftar pakai kode akses guru</a>.</p><p class="muted small">Kode akses diberikan oleh pengelola website atau guru lain lewat undangan. Akun guru tidak bisa dibuat tanpa kode itu.</p>'}
          </div>
        </div>
      </div>`;
    const form = view.querySelector('[data-login]');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const err = form.querySelector('.form-error');
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      if (!email || !password) { err.textContent = 'Email dan kata sandi wajib diisi.'; err.hidden = false; return; }
      const btn = form.querySelector('button');
      btn.disabled = true;
      try {
        const res = await api('/api/auth/login', { method: 'POST', body: { email, password, role } });
        this.setUser(res.user);
        location.hash = res.user.role === 'guru' ? '#/guru' : '#/lkpd/petunjuk';
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
        btn.disabled = false;
      }
    });
  },

  accountForm({ title, intro, extra, submitText, endpoint, after }) {
    view.innerHTML = `
      <div class="auth">
        <div class="card auth-card">
          <h1 id="section-title" tabindex="-1">${title}</h1>
          <p class="muted">${intro}</p>
          <form data-account novalidate>
            <label class="field"><span>Nama lengkap</span><input name="name" autocomplete="name" maxlength="80" required><small class="field-error" data-err="name"></small></label>
            <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" maxlength="120" required><small class="field-error" data-err="email"></small></label>
            <label class="field"><span>Kata sandi (minimal 8 karakter)</span><input name="password" type="password" autocomplete="new-password" minlength="8" required><small class="field-error" data-err="password"></small></label>
            ${extra}
            <p class="form-error" role="alert" hidden></p>
            <button class="btn btn-primary btn-large">${submitText}</button>
          </form>
          <div class="auth-alt"><p>Sudah punya akun? <a href="#/masuk/${endpoint.includes('teacher') ? 'guru' : 'siswa'}">Masuk</a>.</p></div>
        </div>
      </div>`;
    const form = view.querySelector('[data-account]');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      form.querySelectorAll('.field-error').forEach(x => { x.textContent = ''; });
      const err = form.querySelector('.form-error');
      err.hidden = true;
      const body = {};
      for (const el of form.elements) if (el.name) body[el.name] = el.value;
      const btn = form.querySelector('button');
      btn.disabled = true;
      try {
        const res = await api(endpoint, { method: 'POST', body });
        this.setUser(res.user);
        after(res.user);
      } catch (ex) {
        for (const [k, v] of Object.entries(ex.data?.errors || {})) { const f = form.querySelector(`[data-err="${k}"]`); if (f) f.textContent = v; }
        err.textContent = ex.message;
        err.hidden = false;
        btn.disabled = false;
      }
    });
  },

  register() {
    if (this.user) { location.hash = '#/'; return; }
    this.accountForm({
      title: 'Daftar Akun Siswa',
      intro: 'Minta kode kelas ke gurumu. Nama dan kelasmu akan tertulis di hasil LKPD.',
      extra: '<label class="field"><span>Kode kelas</span><input name="classCode" autocomplete="off" maxlength="12" class="input-code" required><small class="field-error" data-err="classCode"></small></label>',
      submitText: 'Daftar dan mulai',
      endpoint: '/api/auth/register',
      after: () => { toast('Akun berhasil dibuat.'); location.hash = '#/lkpd/petunjuk'; }
    });
  },

  registerTeacher() {
    if (this.user) { location.hash = '#/'; return; }
    this.accountForm({
      title: 'Daftar Akun Guru',
      intro: 'Pendaftaran guru memerlukan kode akses guru atau kode undangan. Kode diperiksa di server.',
      extra: '<label class="field"><span>Kode akses atau kode undangan guru</span><input name="accessCode" type="password" autocomplete="off" maxlength="80" required><small class="field-error" data-err="accessCode"></small></label>',
      submitText: 'Daftar sebagai guru',
      endpoint: '/api/auth/register-teacher',
      after: () => { toast('Akun guru berhasil dibuat.'); location.hash = '#/guru'; }
    });
  },

  setUser(user) {
    if (this.ws) { this.ws.destroy(); this.ws = null; }
    this.user = user;
  },

  async lkpd(section) {
    if (!this.user) { location.hash = '#/masuk/siswa'; return; }
    if (this.user.role !== 'siswa') { toast('Halaman LKPD untuk siswa. Hasil siswa ada di Dasbor Guru.'); location.hash = '#/guru'; return; }
    if (!this.ws) {
      view.innerHTML = '<p class="loading" role="status">Memuat jawabanmu...</p>';
      const ws = new Workspace(this);
      try { await ws.load(); }
      catch (e) {
        ws.destroy();
        if (e.status === 401) { this.sessionExpired(); return; }
        view.innerHTML = `<div class="card error-card"><h1>Jawaban gagal dimuat</h1><p>${esc(e.message)}</p><p><a class="btn" href="">Coba lagi</a></p></div>`;
        return;
      }
      this.ws = ws;
    } else if (this.ws.current && this.ws.current !== section) {
      this.ws.flush();
    }
    this.ws.render(view, section);
  },

  async teacher(parts) {
    if (!this.user) { location.hash = '#/masuk/guru'; return; }
    // Siswa yang membuka alamat guru diarahkan kembali ke LKPD. Server juga menolak semua data guru untuk akun siswa.
    if (this.user.role !== 'guru') {
      toast('Halaman guru hanya untuk akun guru.', 'error');
      location.hash = '#/lkpd/petunjuk';
      return;
    }
    try {
      if (parts[1] === 'siswa' && parts[2]) await renderStudent(view, this, parts[2]);
      else await renderDashboard(view, this, parts[1] === 'kelas' ? parts[2] : null);
    } catch (e) {
      if (e.status === 401) { this.sessionExpired(); return; }
      throw e;
    }
  },

  notFound() {
    view.innerHTML = '<div class="card error-card"><h1>Halaman tidak ditemukan</h1><a class="btn" href="#/">Ke Beranda</a></div>';
  },

  sessionExpired() {
    if (this.ws) { this.ws.destroy(); this.ws = null; }
    const role = this.user?.role || 'siswa';
    this.user = null;
    toast('Sesi berakhir. Silakan masuk lagi. Jawaban yang belum terkirim tetap aman di perangkat ini.', 'error');
    location.hash = `#/masuk/${role}`;
    this.route();
  },

  async logout() {
    if (this.ws) {
      const ok = await this.ws.flush();
      if (!ok && !confirm('Ada jawaban yang belum terkirim ke server. Tetap keluar? Jawaban tetap tersimpan di perangkat ini.')) return;
    }
    try { await api('/api/auth/logout', { method: 'POST', body: {} }); } catch { /* tetap keluar dari tampilan */ }
    this.setUser(null);
    location.hash = '#/';
    this.route();
  }
};

app.start();
