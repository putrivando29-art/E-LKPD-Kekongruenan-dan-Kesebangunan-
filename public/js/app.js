// Titik masuk aplikasi: memuat definisi LKPD, memeriksa sesi, dan mengatur rute berbasis hash.
import { api } from './api.js';
import { esc, toast } from './ui.js';
import { Workspace } from './student.js';
import { renderDashboard, renderStudent } from './teacher.js';

const view = document.getElementById('view');

const app = {
  def: null,
  user: null,
  ws: null,

  async start() {
    view.innerHTML = '<p class="loading" role="status">Memuat E-LKPD...</p>';
    try {
      const [def, me] = await Promise.all([api('/api/lkpd'), api('/api/me')]);
      this.def = def;
      this.user = me.user;
    } catch (e) {
      view.innerHTML = `<div class="card error-card"><h1>E-LKPD tidak dapat dimuat</h1><p>${esc(e.message)}</p><p><a class="btn" href="">Coba lagi</a></p></div>`;
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
      else if (page === 'lkpd') await this.lkpd(a || 'petunjuk');
      else if (page === 'guru') await this.teacher(parts);
      else this.notFound();
    } catch (e) {
      view.innerHTML = `<div class="card error-card"><h1>Terjadi kesalahan</h1><p>${esc(e.message)}</p><p><a class="btn" href="#/">Ke Beranda</a></p></div>`;
    }
    this.renderHeader();
  },

  home() {
    const m = this.def.meta;
    const startHref = this.user?.role === 'siswa' ? '#/lkpd/petunjuk' : this.user?.role === 'guru' ? '#/guru' : '#/masuk/siswa';
    view.innerHTML = `
      <div class="home">
        <section class="cover">
          <p class="cover-meta">${esc(m.subject)} · ${esc(m.grade)}</p>
          <h1 id="section-title" tabindex="-1">${esc(m.title)}</h1>
          <p class="cover-author">Disusun oleh ${esc(m.author)}</p>
          <div class="cover-actions">
            <a class="btn btn-primary btn-large" href="${startHref}">${this.user?.role === 'guru' ? 'Buka Dasbor Guru' : 'Mulai Mengerjakan'}</a>
            ${this.user ? '' : '<a class="btn btn-large" href="#/masuk/siswa">Masuk sebagai Siswa</a><a class="btn btn-large" href="#/masuk/guru">Masuk sebagai Guru</a>'}
          </div>
          ${this.user ? `<p class="muted">Kamu masuk sebagai ${esc(this.user.name)}.</p>` : '<p class="muted">Belum punya akun siswa? <a href="#/daftar">Daftar dengan kode kelas dari gurumu</a>.</p>'}
        </section>
        <div class="home-grid">
          <section class="card">
            <h2>Tujuan pembelajaran</h2>
            <ol>${m.goals.map(g => `<li>${esc(g)}</li>`).join('')}</ol>
          </section>
          <section class="card" id="petunjuk-penggunaan">
            <h2>Petunjuk penggunaan E-LKPD</h2>
            <ol>${m.usage.map(g => `<li>${esc(g)}</li>`).join('')}</ol>
          </section>
          <section class="card wide">
            <h2>Urutan kegiatan</h2>
            <ol class="flow">${this.def.sections.map(s => `<li><span class="flow-name">${esc(s.nav)}</span> ${esc(s.title)}</li>`).join('')}<li><span class="flow-name">Ringkasan</span> Periksa status lalu kumpulkan LKPD</li></ol>
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
          ${role === 'siswa'
            ? '<p>Belum punya akun? <a href="#/daftar">Daftar dengan kode kelas</a>.</p><p class="muted small">Lupa kata sandi? Mintalah gurumu mengatur ulang kata sandi dari Dasbor Guru.</p>'
            : '<p class="muted small">Akun guru dibuat oleh pengelola website melalui perintah <code>npm run buat-guru</code>, tidak melalui pendaftaran umum.</p>'}
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

  register() {
    if (this.user) { location.hash = '#/'; return; }
    view.innerHTML = `
      <div class="auth">
        <div class="card auth-card">
          <h1 id="section-title" tabindex="-1">Daftar Akun Siswa</h1>
          <p class="muted">Kode kelas diberikan oleh gurumu. Nama dan kelas akan tercantum pada hasil LKPD.</p>
          <form data-register novalidate>
            <label class="field"><span>Nama lengkap</span><input name="name" autocomplete="name" maxlength="80" required><small class="field-error" data-err="name"></small></label>
            <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" maxlength="120" required><small class="field-error" data-err="email"></small></label>
            <label class="field"><span>Kata sandi (minimal 8 karakter)</span><input name="password" type="password" autocomplete="new-password" minlength="8" required><small class="field-error" data-err="password"></small></label>
            <label class="field"><span>Kode kelas</span><input name="classCode" autocomplete="off" maxlength="12" class="input-code" required><small class="field-error" data-err="classCode"></small></label>
            <p class="form-error" role="alert" hidden></p>
            <button class="btn btn-primary btn-large">Daftar dan mulai</button>
          </form>
          <p>Sudah punya akun? <a href="#/masuk/siswa">Masuk</a>.</p>
        </div>
      </div>`;
    const form = view.querySelector('[data-register]');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      form.querySelectorAll('.field-error').forEach(x => { x.textContent = ''; });
      const err = form.querySelector('.form-error');
      err.hidden = true;
      const body = Object.fromEntries(['name', 'email', 'password', 'classCode'].map(k => [k, form.elements[k].value]));
      const btn = form.querySelector('button');
      btn.disabled = true;
      try {
        const res = await api('/api/auth/register', { method: 'POST', body });
        this.setUser(res.user);
        toast('Akun berhasil dibuat.');
        location.hash = '#/lkpd/petunjuk';
      } catch (ex) {
        for (const [k, v] of Object.entries(ex.data?.errors || {})) { const f = form.querySelector(`[data-err="${k}"]`); if (f) f.textContent = v; }
        err.textContent = ex.message;
        err.hidden = false;
        btn.disabled = false;
      }
    });
  },

  setUser(user) {
    if (this.ws) { this.ws.destroy(); this.ws = null; }
    this.user = user;
  },

  async lkpd(section) {
    if (!this.user) { location.hash = '#/masuk/siswa'; return; }
    if (this.user.role !== 'siswa') {
      view.innerHTML = '<div class="card error-card"><h1>Halaman ini untuk siswa</h1><p>Anda masuk sebagai guru. Hasil siswa dapat dibuka dari Dasbor Guru.</p><a class="btn btn-primary" href="#/guru">Buka Dasbor Guru</a></div>';
      return;
    }
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
    if (this.user.role !== 'guru') {
      view.innerHTML = '<div class="card error-card"><h1>Akses ditolak</h1><p>Halaman ini hanya dapat dibuka oleh akun guru.</p><a class="btn btn-primary" href="#/lkpd/petunjuk">Kembali ke LKPD</a></div>';
      return;
    }
    if (parts[1] === 'siswa' && parts[2]) await renderStudent(view, this, parts[2]);
    else await renderDashboard(view, this, parts[1] === 'kelas' ? parts[2] : null);
  },

  notFound() {
    view.innerHTML = '<div class="card error-card"><h1>Halaman tidak ditemukan</h1><a class="btn" href="#/">Ke Beranda</a></div>';
  },

  sessionExpired() {
    if (this.ws) { this.ws.destroy(); this.ws = null; }
    const role = this.user?.role || 'siswa';
    this.user = null;
    toast('Sesi berakhir. Silakan masuk kembali. Jawaban yang belum terkirim tetap tersimpan di perangkat ini.', 'error');
    location.hash = `#/masuk/${role}`;
    this.route();
  },

  async logout() {
    if (this.ws) {
      const ok = await this.ws.flush();
      if (!ok && !confirm('Ada jawaban yang belum tersimpan di server. Tetap keluar? Jawaban tetap tersimpan di perangkat ini.')) return;
    }
    try { await api('/api/auth/logout', { method: 'POST', body: {} }); } catch { /* tetap keluar dari tampilan */ }
    this.setUser(null);
    location.hash = '#/';
    this.route();
  }
};

app.start();
