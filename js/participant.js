let G = null, TM = null;
const stopTimer = () => { clearInterval(TM); TM = null; };

async function pHome() {
  $('#app').innerHTML = `<section class="card fade"><h1>Halo, ${esc(S.name)}!</h1>
  <p class="muted">Jawab semua soal dan kejar skor tertinggi di leaderboard.</p>
  <div class="row"><button class="btn" onclick="go('game')">🎮 Mulai Game</button><button class="btn ghost" onclick="go('board')">🏅 Leaderboard</button></div></section>`;
}
function pAbout() {
  $('#app').innerHTML = `<section class="card fade"><h2>ℹ️ Tentang</h2><p class="muted">Game kuis pilihan ganda. Skor dihitung di server Supabase, jadi tidak bisa diubah dari browser. Kamu boleh bermain berkali-kali; leaderboard memakai skor terbaikmu.</p></section>`;
}
async function pGame() {
  const [qs, st] = await busy(() => Promise.all([rpc('get_questions', { p_token: S.token }), rpc('get_settings')]));
  if (!qs.length) { $('#app').innerHTML = '<div class="card fade"><h2>Belum ada soal</h2><p class="muted">Minta admin menambahkan soal.</p></div>'; return; }
  const rid = await busy(() => rpc('start_attempt', { p_token: S.token }));
  G = { active: true, qs, i: 0, ans: {}, rid, back: st.allow_back, left: st.timer_minutes > 0 ? st.timer_minutes * 60 : null };
  drawQ(1);
  if (G.left != null) TM = setInterval(() => {
    G.left--; updTm();
    if (G.left <= 0) { stopTimer(); toast('Waktu habis! Jawabanmu dikirim.', 'err'); finish(true); }
  }, 1000);
}
function updTm() { const e = $('#tm'); if (e && G && G.left != null) e.textContent = '⏱ ' + String(Math.floor(G.left / 60)).padStart(2, '0') + ':' + String(G.left % 60).padStart(2, '0'); }
function drawQ(dir) {
  const q = G.qs[G.i], n = G.qs.length, last = G.i === n - 1;
  $('#app').innerHTML = `<section class="card game fade"><div class="gtop"><span>SOAL ${G.i + 1} / ${n}</span><span id="tm" class="pill"></span></div>
  <div class="bar"><i style="width:${(G.i + 1) / n * 100}%"></i></div>
  <div class="${dir > 0 ? 'slider' : 'slidel'}"><h2>${esc(q.question)}</h2><div class="opts">
  ${['A', 'B', 'C', 'D'].map(k => `<button class="opt ${G.ans[q.id] === k ? 'sel' : ''}" data-k="${k}"><b>${k}</b><span>${esc(q['option_' + k.toLowerCase()])}</span></button>`).join('')}</div></div>
  <div class="row between"><button class="btn ghost" id="pv" ${G.i === 0 || !G.back ? 'disabled' : ''}>← Soal Sebelumnya</button>
  <button class="btn" id="nx">${last ? 'Selesai ✔' : 'Jawab & Lanjut →'}</button></div></section>`;
  updTm();
  document.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    G.ans[q.id] = b.dataset.k;
    document.querySelectorAll('.opt').forEach(x => x.classList.remove('sel')); void b.offsetWidth; b.classList.add('sel');
  });
  $('#pv').onclick = () => { G.i--; drawQ(-1); };
  $('#nx').onclick = () => {
    if (!G.ans[q.id]) return toast('Pilih salah satu jawaban dulu', 'err');
    if (last) finish(false); else { G.i++; drawQ(1); }
  };
}
async function finish(force) {
  if (!force) {
    const un = G.qs.length - Object.keys(G.ans).length;
    if (!(await confirmBox(un ? `Masih ada ${un} soal belum dijawab. Selesaikan game?` : 'Selesaikan game sekarang?'))) return;
  }
  stopTimer();
  try {
    const rid = G.rid;
    await busy(() => rpc('submit_game', { p_token: S.token, p_result_id: rid, p_answers: G.ans }));
    G = null; await showResult(rid, true);
  } catch (e) { fail(e); }
}
function countUp(el, to) {
  const t0 = performance.now();
  (function f(t) { const p = Math.min((t - t0) / 900, 1); el.textContent = Math.round(to * p); if (p < 1) requestAnimationFrame(f); })(t0);
}
async function showResult(rid, fresh) {
  const d = await busy(() => rpc('get_result_detail', { p_token: S.token, p_result_id: rid })), r = d.result;
  const acc = r.total_questions ? Math.round(r.correct_count / r.total_questions * 100) : 0;
  $('#app').innerHTML = `<section class="card center fade"><h1>${fresh ? '🎉 GAME SELESAI!' : '📋 Hasil Permainan'}</h1>
  <p class="muted">Username: <b>${esc(S.name)}</b></p><div class="score" id="sc">0</div><p class="muted">dari ${r.max_score} poin</p>
  <div class="stats3"><div><b>✅ ${r.correct_count}</b>Benar</div><div><b>❌ ${r.wrong_count}</b>Salah</div><div><b>${acc}%</b>Akurasi</div></div>
  <div class="row center"><button class="btn" id="rv">Lihat Pembahasan</button><button class="btn ghost" onclick="go('home')">Kembali ke Home</button></div></section><div id="rev" style="margin-top:16px"></div>`;
  countUp($('#sc'), r.score);
  $('#rv').onclick = () => { $('#rev').innerHTML = reviewHTML(d.items); $('#rev').scrollIntoView({ behavior: 'smooth' }); };
}
function reviewHTML(items) {
  const t = (it, k) => k ? `${k}. ${esc(it['option_' + k.toLowerCase()])}` : '<i>(tidak dijawab)</i>';
  return `<div class="list fade">${items.map(it => `<div class="card item rv ${it.is_correct ? '' : 'bad'}"><div>
  <small>Soal ${it.number}</small><p><b>${esc(it.question)}</b></p><p>Jawaban ${S.role === 'admin' ? 'peserta' : 'kamu'}: ${t(it, it.user_answer)}</p>
  <p>Jawaban benar: ${t(it, it.correct_answer)}</p></div><div><b>${it.is_correct ? '✅ Benar' : '❌ Salah'}</b></div></div>`).join('')}</div>`;
}
async function pHasil() {
  const rs = await busy(() => rpc('get_my_results', { p_token: S.token }));
  $('#app').innerHTML = `<div class="head"><h2>🏆 Skor / Hasil</h2></div><div class="list fade">${rs.map(r => `<div class="card item"><div>
  <b style="font-size:1.4rem">${r.score}</b> <span class="muted">/ ${r.max_score}</span><br><small>${fmt(r.finished_at)} · ✅ ${r.correct_count} ❌ ${r.wrong_count}</small></div>
  <button class="btn sm" data-id="${r.id}">Detail</button></div>`).join('') || '<div class="card"><p class="muted">Belum ada hasil. Mulai game dulu!</p></div>'}</div>`;
  document.querySelectorAll('[data-id]').forEach(b => b.onclick = () => showResult(+b.dataset.id, false).catch(fail));
}
async function viewBoard() {
  const rows = await busy(() => rpc('get_leaderboard')), medals = ['🥇', '🥈', '🥉'];
  const mine = r => S.role === 'peserta' && r.username === S.name ? 'me' : '';
  $('#app').innerHTML = `<div class="head"><h2>🏅 Leaderboard</h2></div>` + (rows.length ? `<div class="podium fade">${rows.slice(0, 3).map((r, i) => `<div class="pod ${mine(r)}"><div class="m">${medals[i]}</div><b>${esc(r.username)}</b><div>${r.score}</div></div>`).join('')}</div>
  <div class="list fade">${rows.slice(3).map((r, i) => `<div class="card item ${mine(r)}"><span><b>#${i + 4}</b> &nbsp;${esc(r.username)}</span><b>${r.score}</b></div>`).join('')}</div>` : '<div class="card"><p class="muted">Belum ada skor.</p></div>');
}
