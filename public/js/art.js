// Ilustrasi bergaya stiker dan ikon. Semua digambar dengan satu gaya: garis cokelat 2 px berujung bulat,
// isian warna pastel solid, dan tepi putih tebal seperti stiker. Tidak ada gambar dari luar.
const INK = '#493B37';
const C = { peach: '#F6C6AD', coral: '#E98B73', butter: '#F5DF91', pink: '#E8B7C5', lilac: '#C9BCE5', cream: '#FFF8EF', white: '#FFFFFF' };

const svg = (vb, body, cls = 'icon', label) =>
  `<svg class="${cls}" viewBox="${vb}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"'}>${body}</svg>`;
const st = `stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

// Ikon 24 × 24. Warna isian mengikuti variabel CSS --acc agar ikut warna aktivitas.
const ICONS = {
  book: `<path d="M4 5.5c2.6-1 5.2-1 8 .8v13c-2.8-1.8-5.4-1.8-8-.8z" fill="var(--acc, ${C.butter})" ${st}/><path d="M20 5.5c-2.6-1-5.2-1-8 .8v13c2.8-1.8 5.4-1.8 8-.8z" fill="#fff" ${st}/>`,
  spark: `<path d="M12 3.5l1.9 5 5.1 1.7-5.1 1.8L12 17l-1.9-5-5.1-1.8 5.1-1.7z" fill="var(--acc, ${C.lilac})" ${st}/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" fill="#fff" ${st}/>`,
  eye: `<path d="M2.8 12c2.4-4 5.5-6 9.2-6s6.8 2 9.2 6c-2.4 4-5.5 6-9.2 6s-6.8-2-9.2-6z" fill="#fff" ${st}/><circle cx="12" cy="12" r="3.4" fill="var(--acc, ${C.peach})" ${st}/>`,
  ask: `<path d="M5 5.5h14a2 2 0 012 2v7a2 2 0 01-2 2h-7l-4.5 3.5v-3.5H5a2 2 0 01-2-2v-7a2 2 0 012-2z" fill="var(--acc, ${C.pink})" ${st}/><path d="M10 9.3a2 2 0 113 1.7c-.7.4-1 .8-1 1.5" fill="none" ${st}/><circle cx="12" cy="14.4" r=".4" fill="${INK}" ${st}/>`,
  ruler: `<rect x="2.6" y="8" width="18.8" height="8" rx="1.6" transform="rotate(-18 12 12)" fill="var(--acc, ${C.butter})" ${st}/><path d="M7.2 11.2l.7 2M10.2 10.2l.4 1.2M13.1 9.3l.7 2M16 8.3l.4 1.2" fill="none" ${st}/>`,
  pencil: `<path d="M5 19l1-4.2L15.6 5.2a2 2 0 012.8 0l.4.4a2 2 0 010 2.8L9.2 18 5 19z" fill="var(--acc, ${C.coral})" ${st}/><path d="M14 6.8l3.2 3.2M6 14.8l3.2 3.2" fill="none" ${st}/>`,
  bulb: `<path d="M8.5 15.5c-1.6-1.2-2.6-3-2.6-5a6.1 6.1 0 0112.2 0c0 2-1 3.8-2.6 5v2.2h-7z" fill="var(--acc, ${C.lilac})" ${st}/><path d="M9.5 20.5h5" fill="none" ${st}/>`,
  heart: `<path d="M12 19.5s-7.5-4.4-7.5-9.6A4.2 4.2 0 0112 7.6a4.2 4.2 0 017.5 2.3c0 5.2-7.5 9.6-7.5 9.6z" fill="var(--acc, ${C.pink})" ${st}/>`,
  flag: `<path d="M6 21V4" fill="none" ${st}/><path d="M6 4.5c3-1.5 5.5 1.5 8.5 0s3.5-.5 3.5-.5v8s-.5-1-3.5.5-5.5-1.5-8.5 0z" fill="var(--acc, ${C.coral})" ${st}/>`,
  check: `<path d="M5.5 12.5l4 4 9-9" fill="none" ${st} stroke-width="2.6"/>`,
  clock: `<circle cx="12" cy="12" r="8.2" fill="#fff" ${st}/><path d="M12 7.5V12l3 2" fill="none" ${st}/>`,
  lock: `<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2" fill="var(--acc, ${C.butter})" ${st}/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" fill="none" ${st}/>`,
  star: `<path d="M12 3.8l2.4 5 5.4.6-4 3.7 1.1 5.4L12 15.8l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z" fill="var(--acc, ${C.butter})" ${st}/>`,
  download: `<path d="M12 4v10M7.5 10l4.5 4.5 4.5-4.5M5 19.5h14" fill="none" ${st}/>`,
  user: `<circle cx="12" cy="8.5" r="3.6" fill="var(--acc, ${C.peach})" ${st}/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" fill="none" ${st}/>`,
  key: `<circle cx="8" cy="12" r="4" fill="var(--acc, ${C.butter})" ${st}/><path d="M12 12h8.5M17 12v3M19.5 12v2" fill="none" ${st}/>`
};

export function icon(name, cls = 'icon') {
  return svg('0 0 24 24', ICONS[name] || ICONS.star, cls);
}

// Penanda status pada peta belajar: selesai, sedang, belum, terkunci, menunggu guru.
export function statusIcon(kind) {
  const body = {
    done: `<circle cx="12" cy="12" r="9" fill="${C.butter}" ${st}/><path d="M7.8 12.3l2.8 2.8 5.6-5.8" fill="none" ${st} stroke-width="2.4"/>`,
    part: `<circle cx="12" cy="12" r="9" fill="#fff" ${st}/><path d="M12 3a9 9 0 010 18z" fill="${C.peach}" ${st}/>`,
    empty: `<circle cx="12" cy="12" r="9" fill="#fff" ${st} stroke-dasharray="3 3"/>`,
    locked: `<circle cx="12" cy="12" r="9" fill="${C.lilac}" ${st}/><rect x="8.6" y="11" width="6.8" height="5.2" rx="1" fill="#fff" ${st} stroke-width="1.6"/><path d="M10 11V9.6a2 2 0 014 0V11" fill="none" ${st} stroke-width="1.6"/>`,
    wait: `<circle cx="12" cy="12" r="9" fill="${C.lilac}" ${st}/><path d="M12 7.5V12l2.8 1.8" fill="none" ${st}/>`
  }[kind];
  return svg('0 0 24 24', body, 'status-icon');
}

// Hiasan kecil. Selalu aria-hidden karena tidak membawa informasi.
export const deco = {
  star: (fill = C.butter) => svg('0 0 24 24', `<path d="M12 2.5l2.6 6.2 6.6.5-5 4.3 1.6 6.5L12 16.5 6.2 20l1.6-6.5-5-4.3 6.6-.5z" fill="${fill}" ${st}/>`, 'deco'),
  sparkle: (fill = C.pink) => svg('0 0 24 24', `<path d="M12 2c.8 5 2.9 7.2 8 8-5.1.8-7.2 3-8 8-.8-5-2.9-7.2-8-8 5.1-.8 7.2-3 8-8z" fill="${fill}" ${st}/>`, 'deco'),
  flower: (fill = C.pink) => svg('0 0 32 32', `${[0, 72, 144, 216, 288].map(a => `<ellipse cx="16" cy="8.5" rx="4.6" ry="6" transform="rotate(${a} 16 16)" fill="${fill}" ${st}/>`).join('')}<circle cx="16" cy="16" r="4" fill="${C.butter}" ${st}/>`, 'deco'),
  squiggle: (color = C.coral) => svg('0 0 80 20', `<path d="M3 12c6-9 11 9 17 0s11 9 17 0 11 9 17 0 11 9 17 0 6-6 6-6" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`, 'deco deco-wide'),
  dots: (color = C.lilac) => svg('0 0 40 16', `<circle cx="6" cy="8" r="4" fill="${color}"/><circle cx="20" cy="8" r="4" fill="${C.butter}"/><circle cx="34" cy="8" r="4" fill="${C.pink}"/>`, 'deco deco-wide')
};

// Ilustrasi halaman awal: dua segitiga sebangun (kecil dan besar), penggaris, pensil, dan hiasan.
// Segitiga kecil 3-4-5 dan segitiga besar 6-8-10 digambar dengan perbandingan yang benar (k = 2).
export function coverArt() {
  const sticker = (d, fill) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="14" stroke-linejoin="round"/><path d="${d}" fill="${fill}" ${st} stroke-width="3"/>`;
  const u = 22; // 1 cm pada ilustrasi
  const big = `M52 250 L${52 + 8 * u} 250 L52 ${250 - 6 * u} Z`;
  const small = `M262 250 L${262 + 4 * u} 250 L262 ${250 - 3 * u} Z`;
  const ticks = Array.from({ length: 13 }, (_, i) => `<path d="M${42 + i * 22} 284v${i % 5 === 0 ? 13 : 8}" ${st}/>`).join('');
  return svg('0 0 400 330', `
    <path d="M40 60c40-40 120-52 190-40s140 20 156 80-6 130-40 170-130 46-210 34S12 270 14 190 10 90 40 60z" fill="#FCE6DA"/>
    <circle cx="318" cy="92" r="46" fill="${C.lilac}"/>
    ${sticker(big, C.peach)}
    ${sticker(small, C.coral)}
    <path d="M52 236 h14 v14" fill="none" ${st}/>
    <path d="M262 238 h12 v12" fill="none" ${st}/>
    <path d="M232 156 q30 -26 56 8" fill="none" ${st} stroke-dasharray="5 5"/>
    <path d="M232 156 l-2 -11 M232 156 l11 -2" fill="none" ${st}/>
    <rect x="240" y="118" width="50" height="28" rx="14" fill="${C.butter}" ${st}/>
    <text x="265" y="138" text-anchor="middle" class="cover-label">×2</text>
    <g transform="rotate(-3 170 292)">
      <rect x="30" y="274" width="290" height="34" rx="7" fill="${C.butter}" stroke="#fff" stroke-width="10"/>
      <rect x="30" y="274" width="290" height="34" rx="7" fill="${C.butter}" ${st} stroke-width="2.5"/>
      ${ticks}
    </g>
    <g transform="rotate(32 352 120)">
      <rect x="342" y="40" width="20" height="104" rx="4" fill="${C.pink}" stroke="#fff" stroke-width="10"/>
      <rect x="342" y="40" width="20" height="104" rx="4" fill="${C.pink}" ${st} stroke-width="2.5"/>
      <path d="M342 144 L352 168 L362 144 Z" fill="${C.cream}" ${st} stroke-width="2.5"/>
      <path d="M348.5 160 L352 168 L355.5 160 Z" fill="${INK}"/>
      <rect x="342" y="32" width="20" height="12" rx="3" fill="${C.coral}" ${st} stroke-width="2.5"/>
    </g>
    <path d="M150 34l4 9 10 1-7.5 6.5 2.3 9.7L150 55l-8.8 5.2 2.3-9.7L136 44l10-1z" fill="${C.butter}" ${st}/>
    <path d="M30 120c.8 5 2.9 7.2 8 8-5.1.8-7.2 3-8 8-.8-5-2.9-7.2-8-8 5.1-.8 7.2-3 8-8z" fill="${C.pink}" ${st}/>
    <path d="M196 70c5-8 10 8 15 0s10 8 15 0" fill="none" stroke="${C.coral}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="378" cy="236" r="6" fill="${C.peach}" ${st}/>`, 'cover-art', 'Ilustrasi segitiga kecil yang diperbesar dua kali menjadi segitiga besar, dengan penggaris dan pensil');
}

export const PALETTE = C;
