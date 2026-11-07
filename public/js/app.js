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
      else if (page === 'masuk') this.login(a === 'guru' ? 'guru' : 'siswa', parts[2]);
      else if (page === 'daftar') this.register(a || '');
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

  // Halaman masuk. Untuk siswa: dua pilihan besar (belum punya akun / sudah punya akun) agar tidak salah jalan.
  login(role, mode) {
    if (this.user) { location.hash = this.user.role === 'guru' ? '#/guru' : '#/lkpd/petunjuk'; return; }
    if (role === 'siswa' && mode !== 'akun') {
      view.innerHTML = `
        <div class="auth">
          <div class="card auth-card">
            ${this.roleTabs(role)}
            <h1 id="section-title" tabindex="-1">Halo! Kamu siswa, ya?</h1>
            <p class="muted">Pilih salah satu:</p>
            <div class="entry-choices">
              <a class="entry-choice" href="#/daftar" data-accent="peach">
                <span class="entry-num">1</span>
                <span><b>Aku belum punya akun</b><span class="block">Daftar dulu pakai kode kelas dari gurumu. Cukup sekali.</span></span>
              </a>
              <a class="entry-choice" href="#/masuk/siswa/akun" data-accent="butter">
                <span class="entry-num">2</span>
                <span><b>Aku sudah punya akun</b><span class="block">Masuk dengan email atau nama pengguna dan kata sandimu.</span></span>
              </a>
            </div>
            <div class="auth-alt"><p class="muted small">Lupa kata sandi? Minta gurumu mengatur ulang dari Dasbor Guru.</p></div>
          </div>
        </div>`;
      return;
    }
    view.innerHTML = `
      <div class="auth">
        <div class="card auth-card">
          ${this.roleTabs(role)}
          <h1 id="section-title" tabindex="-1">Masuk sebagai ${role === 'guru' ? 'Guru' : 'Siswa'}</h1>
          <form data-login novalidate>
            <label class="field"><span>${role === 'guru' ? 'Email' : 'Email atau nama pengguna'}</span><input name="email" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
            ${this.passwordField('current-password', 'Kata sandi')}
            <p class="form-error" role="alert" hidden></p>
            <button class="btn btn-primary btn-large">Masuk</button>
          </form>
          <div class="auth-alt">
          ${role === 'siswa'
            ? '<p>Belum punya akun? <a href="#/daftar">Daftar pakai kode kelas</a>.</p><p class="muted small">Lupa kata sandi? Minta gurumu mengatur ulang dari Dasbor Guru.</p>'
            : '<p>Guru baru? <a href="#/daftar-guru">Daftar pakai kode akses guru</a>.</p><p class="muted small">Kode akses diberikan oleh pengelola website atau guru lain lewat undangan. Akun guru tidak bisa dibuat tanpa kode itu.</p>'}
          </div>
        </div>
      </div>`;
    const form = view.querySelector('[data-login]');
    this.bindPasswordToggle(form);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const err = form.querySelector('.form-error');
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      if (!email || !password) { err.textContent = 'Isi dulu email/nama pengguna dan kata sandi.'; err.hidden = false; return; }
      const btn = form.querySelector('button[type="submit"], button:not([type])');
      btn.disabled = true;
      try {
        const res = await api('/api/auth/login', { method: 'POST', body: { email, password, role } });
        this.setUser(res.user);
        location.hash = res.user.role === 'guru' ? '#/guru' : '#/lkpd/petunjuk';
      } catch (ex) {
        err.innerHTML = esc(ex.message) + (ex.data?.code === 'bad_login' && role === 'siswa' ? ' <a href="#/daftar">Daftar di sini</a>.' : '');
        err.hidden = false;
        btn.disabled = false;
      }
    });
  },

  roleTabs(role) {
    return `
      <div class="role-tabs" role="tablist" aria-label="Pilih peran">
        <a role="tab" href="#/masuk/siswa" aria-selected="${role === 'siswa'}" class="${role === 'siswa' ? 'active' : ''}">Siswa</a>
        <a role="tab" href="#/masuk/guru" aria-selected="${role === 'guru'}" class="${role === 'guru' ? 'active' : ''}">Guru</a>
      </div>`;
  },

  passwordField(autocomplete, label) {
    return `
      <label class="field"><span>${label}</span>
        <span class="pass-wrap"><input name="password" type="password" autocomplete="${autocomplete}" required><button type="button" class="btn btn-small btn-soft" data-toggle-pass aria-pressed="false">Lihat</button></span>
        <small class="field-error" data-err="password"></small></label>`;
  },

  bindPasswordToggle(form) {
    const b = form.querySelector('[data-toggle-pass]');
    if (!b) return;
    b.addEventListener('click', () => {
      const inp = form.elements.password;
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      b.textContent = show ? 'Sembunyikan' : 'Lihat';
      b.setAttribute('aria-pressed', String(show));
    });
  },

  accountForm({ title, intro, steps, idLabel, idHint, passLabel, extra, submitText, endpoint, after }) {
    view.innerHTML = `
      <div class="auth">
        <div class="card auth-card">
          <h1 id="section-title" tabindex="-1">${title}</h1>
          <p class="muted">${intro}</p>
          ${steps ? `<ol class="entry-steps">${steps.map(x => `<li>${x}</li>`).join('')}</ol>` : ''}
          <form data-account novalidate>
            ${extra}
            <label class="field"><span>Nama lengkap</span><input name="name" autocomplete="name" maxlength="80" required><small class="field-error" data-err="name"></small></label>
            <label class="field"><span>${idLabel}</span><input name="email" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="120" required>${idHint ? `<small class="muted">${idHint}</small>` : ''}<small class="field-error" data-err="email"></small></label>
            ${this.passwordField('new-password', passLabel)}
            <p class="form-error" role="alert" hidden></p>
            <button type="submit" class="btn btn-primary btn-large">${submitText}</button>
          </form>
          <div class="auth-alt"><p>Sudah punya akun? <a href="#/masuk/${endpoint.includes('teacher') ? 'guru' : 'siswa/akun'}">Masuk</a>.</p></div>
        </div>
      </div>`;
    const form = view.querySelector('[data-account]');
    this.bindPasswordToggle(form);
    // Pesan error sebuah kolom hilang begitu kolom itu diperbaiki.
    form.addEventListener('input', e => {
      const f = e.target.closest('.field')?.querySelector('.field-error');
      if (f) f.textContent = '';
      form.querySelector('.form-error').hidden = true;
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      form.querySelectorAll('.field-error').forEach(x => { x.textContent = ''; });
      const err = form.querySelector('.form-error');
      err.hidden = true;
      const body = {};
      for (const el of form.elements) if (el.name) body[el.name] = el.value;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const res = await api(endpoint, { method: 'POST', body });
        this.setUser(res.user);
        after(res.user, body);
      } catch (ex) {
        for (const [k, v] of Object.entries(ex.data?.errors || {})) { const f = form.querySelector(`[data-err="${k}"]`); if (f) f.textContent = v; }
        err.textContent = ex.message;
        err.hidden = false;
        btn.disabled = false;
        form.querySelector('.field-error:not(:empty)')?.closest('.field')?.querySelector('input')?.focus();
      }
    });
  },

  register(prefill = '') {
    if (this.user) { location.hash = '#/'; return; }
    const code = prefill.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12);
    this.accountForm({
      title: 'Daftar Akun Siswa',
      intro: 'Cukup sekali. Setelah itu kamu tinggal masuk.',
      steps: code ? null : ['Minta <b>kode kelas</b> ke gurumu (6 huruf/angka).', 'Isi formulir di bawah.', 'Klik <b>Daftar dan mulai</b>.'],
      idLabel: 'Email atau nama pengguna',
      idHint: 'Tidak punya email? Buat nama pengguna yang mudah diingat, misalnya budi.8a. Huruf kecil, tanpa spasi.',
      passLabel: 'Kata sandi (minimal 6 karakter)',
      extra: `<label class="field"><span>Kode kelas</span><input name="classCode" autocomplete="off" maxlength="12" class="input-code" value="${esc(code)}" required>${code ? '<small class="muted">Kode kelas sudah terisi dari tautan gurumu.</small>' : ''}<small class="field-error" data-err="classCode"></small></label>`,
      submitText: 'Daftar dan mulai',
      endpoint: '/api/auth/register',
      after: (u, body) => { toast(`Akun berhasil dibuat. Ingat ya: ${body.email.trim().toLowerCase()} dan kata sandimu.`); location.hash = '#/lkpd/petunjuk'; }
    });
  },

  registerTeacher() {
    if (this.user) { location.hash = '#/'; return; }
    this.accountForm({
      title: 'Daftar Akun Guru',
      intro: 'Pendaftaran guru memerlukan kode akses guru atau kode undangan. Kode diperiksa di server.',
      idLabel: 'Email',
      passLabel: 'Kata sandi (minimal 8 karakter)',
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
    location.hash = role === 'siswa' ? '#/masuk/siswa/akun' : '#/masuk/guru';
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
