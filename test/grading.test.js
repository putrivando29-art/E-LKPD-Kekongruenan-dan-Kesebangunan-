'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../server/grading');
const { KEYS } = require('../server/keys');
const { ITEMS } = require('../server/lkpd');

test('setiap butir otomatis memiliki kunci, dan setiap kunci memiliki butir', () => {
  for (const it of ITEMS.values()) if (it.auto) assert.ok(KEYS[it.id], `kunci ${it.id}`);
  for (const id of Object.keys(KEYS)) assert.ok(ITEMS.get(id)?.auto, `butir ${id}`);
});

test('perbandingan: bentuk setara diterima, urutan terbalik ditolak', () => {
  for (const s of ['1 : 2', '1:2', '3 : 6', '5:10', '1/2', '0,5', '0.5', '1 banding 2', '3 cm : 6 cm']) assert.equal(G.isCorrect('a3b_q4_pq', s), true, s);
  for (const s of ['2 : 1', '2', '1 : 3']) assert.equal(G.isCorrect('a3b_q4_pq', s), false, s);
  assert.equal(G.isCorrect('a3b_q4_pq', 'setengah'), null);
});

test('bilangan: satuan, koma desimal, dan pecahan', () => {
  for (const s of ['2', '2,0', 'k = 2', '×2', '6/3', '2 kali']) assert.equal(G.isCorrect('s2c', s), true, s);
  assert.equal(G.isCorrect('s2c', '0,5'), false);
  assert.equal(G.isCorrect('s7', '12'), false);
  for (const s of ['15', '15,0', '15 cm', '30/2']) assert.equal(G.isCorrect('s7', s), true, s);
});

test('pilihan kompleks harus tepat sama', () => {
  assert.equal(G.isCorrect('a1_q2', ['A-C', 'C-D']), true);
  assert.equal(G.isCorrect('a1_q2', ['C-D', 'A-C']), true);
  assert.equal(G.isCorrect('a1_q2', ['A-C']), false);
  assert.equal(G.isCorrect('a1_q2', ['A-C', 'C-D', 'A-D']), false);
});

test('kelengkapan uraian tidak bisa diakali dengan spasi atau tanda baca', () => {
  const t = { type: 'text' };
  assert.equal(G.isFilled(t, '      '), false);
  assert.equal(G.isFilled(t, '\n\n\t'), false);
  assert.equal(G.isFilled(t, '?!...,,'), false);
  assert.equal(G.isFilled(t, 'ab'), false);
  assert.equal(G.isFilled(t, 'A dan D'), true);
  assert.equal(G.isFilled({ type: 'number' }, 'enam'), false);
  assert.equal(G.isFilled({ type: 'simlog', minEntries: 2 }, [{}]), false);
});

test('data simulasi ditolak bila bukan angka', () => {
  const ok = G.sanitize('simB_log', [{ mode: 'skala', k: 2, pq: 3, qr: 4, pr: 5, st: 6, tu: 8, su: 10, aP: 53.1, aQ: 90, aR: 36.9, aS: 53.1, aT: 90, aU: 36.9 }]);
  assert.equal(ok.ok, true);
  const bad = G.sanitize('simB_log', [{ mode: 'skala', k: 2, pq: '<script>' }]);
  assert.equal(bad.ok, false);
});
