// Semua operasi di sini memakai tabel langsung; yang boleh hanya akun Admin (dijaga RLS di database).
const chk = r => { if (r.error) throw r.error; return r.data; };
const tbl = (head, rows) => `<div class="tw fade"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${head.length}" class="muted">Belum ada data.</td></tr>`}</tbody></table></div>`;

async function aDash() {
  const [p, q, c, r] = await busy(() => Promise.all([
    db.from('participants').select('*', { count: 'exact', head: true }),
    db.from('questions').select('*', { count: 'exact', head: true }),
    db.from('access_codes').select('*', { count: 'exact', head: true }).eq('status', 'aktif'),
    db.from('results').select('score,max_score,participants(username)').eq('status', 'selesai')]));
  [p, q, c, r].forEach(x => { if (x.error) throw x.error; });
  const rows = r.data, avg = rows.length ? Math.round(rows.reduce((a, b) => a + b.score, 0) / rows.length) : 0;
  const top = [...rows].sort((a, b) => b.score - a.score)[0];
  const card = (n, l) => `<div class="stat-card"><b>${n}</b><span class="muted">${l}</span></div>`;
  $('#app').innerHTML = `<div class="head"><h2>🏠 Dashboard</h2></div><div class="grid fade">${card(p.count, 'Peserta')}${card(q.count, 'Soal')}${card(c.count, 'Kode aktif')}${card(rows.length, 'Pengerjaan selesai')}${card(avg, 'Rata-rata skor')}
  ${card(top ? esc(top.participants?.username) + ' (' + top.score + ')' : '-', 'Skor tertinggi')}</div>`;
}

async function aSoal() {
  const data = await busy(async () => chk(await db.from('questions').select('*').order('number')));
  $('#app').innerHTML = `<div class="head"><h2>📝 Kelola Soal</h2><button class="btn" id="add">+ Tambah Soal</button></div><div class="list fade">
  ${data.map(q => `<div class="card item"><div><span class="pill">#${q.number}</span> <span class="pill ${q.status === 'aktif' ? 'ok' : 'off'}">${q.status}</span> <span class="pill">${q.points} poin</span>
  <p><b>${esc(q.question)}</b></p><small>A. ${esc(q.option_a)} | B. ${esc(q.option_b)} | C. ${esc(q.option_c)} | D. ${esc(q.option_d)}<br>Jawaban benar: ${q.correct_answer}</small></div>
  <div class="row"><button class="btn sm ghost" data-e="${q.id}">Edit</button><button class="btn sm danger" data-d="${q.id}">Hapus</button></div></div>`).join('') || '<p class="muted">Belum ada soal.</p>'}</div>`;
  $('#add').onclick = () => qForm(null, data);
  document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => qForm(data.find(x => x.id == b.dataset.e), data));
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => {
    if (!(await confirmBox('Hapus soal ini? Jawaban peserta untuk soal ini juga ikut terhapus. Lebih aman: nonaktifkan saja.'))) return;
    try { await busy(async () => chk(await db.from('questions').delete().eq('id', b.dataset.d))); toast('Soal dihapus'); aSoal(); } catch (e) { fail(e); }
  });
}
function qForm(q, all) {
  const v = k => esc(q ? q[k] : '');
  showModal(`<h3>${q ? 'Edit' : 'Tambah'} Soal</h3>
  <label>Nomor soal<input id="f_n" type="number" min="1" value="${q ? q.number : Math.max(0, ...all.map(x => x.number)) + 1}"></label>
  <label>Pertanyaan<textarea id="f_q" rows="3">${v('question')}</textarea></label>
  ${['a', 'b', 'c', 'd'].map(k => `<label>Pilihan ${k.toUpperCase()}<input id="f_${k}" value="${v('option_' + k)}"></label>`).join('')}
  <label>Jawaban benar<select id="f_ok">${['A', 'B', 'C', 'D'].map(k => `<option ${q?.correct_answer === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
  <label>Poin<input id="f_p" type="number" min="0" value="${q ? q.points : 10}"></label>
  <label>Status<select id="f_s"><option value="aktif" ${q?.status === 'aktif' ? 'selected' : ''}>Aktif</option><option value="nonaktif" ${q?.status === 'nonaktif' ? 'selected' : ''}>Nonaktif</option></select></label>
  <div class="row end"><button class="btn ghost" id="x">Batal</button><button class="btn" id="sv">Simpan Soal</button></div>`);
  $('#x').onclick = closeModal;
  $('#sv').onclick = async () => {
    const row = { number: +$('#f_n').value, question: $('#f_q').value.trim(), option_a: $('#f_a').value.trim(), option_b: $('#f_b').value.trim(), option_c: $('#f_c').value.trim(), option_d: $('#f_d').value.trim(),
      correct_answer: $('#f_ok').value, points: +$('#f_p').value, status: $('#f_s').value };
    return saveQ(q, row);
  };
}
async function saveQ(q, row) {
  if (!row.question || !row.option_a || !row.option_b || !row.option_c || !row.option_d) return toast('Pertanyaan dan keempat pilihan wajib diisi', 'err');
  try {
    await busy(async () => chk(q ? await db.from('questions').update(row).eq('id', q.id) : await db.from('questions').insert(row)));
    closeModal(); toast('Soal tersimpan'); aSoal();
  } catch (e) { fail(e); }
}

async function aPeserta() {
  const data = await busy(async () => chk(await db.from('participants').select('id,username,created_at,access_codes(code),results(*)').order('created_at', { ascending: false })));
  const rows = [];
  data.forEach(p => {
    const rs = (p.results || []).sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
    const base = `<td>${esc(p.username)}</td><td>${esc(p.access_codes?.code || '(dihapus)')}</td>`;
    if (!rs.length) rows.push(`<tr>${base}<td colspan="7" class="muted">Belum mengerjakan</td></tr>`);
    rs.forEach(r => rows.push(`<tr>${base}<td>${r.answered_count}/${r.total_questions}</td><td><b>${r.score}</b>/${r.max_score}</td><td>${r.correct_count}</td><td>${r.wrong_count}</td><td>${fmt(r.started_at)}</td><td>${fmt(r.finished_at)}</td>
    <td><span class="pill ${r.status === 'selesai' ? 'ok' : 'off'}">${r.status}</span> ${r.status === 'selesai' ? `<button class="btn sm ghost" data-r="${r.id}">Detail</button>` : ''}</td></tr>`));
  });
  $('#app').innerHTML = `<div class="head"><h2>👥 Peserta</h2></div>` + tbl(['Username', 'Kode', 'Dikerjakan', 'Skor', 'Benar', 'Salah', 'Mulai', 'Selesai', 'Status'], rows);
  document.querySelectorAll('[data-r]').forEach(b => b.onclick = () => aDetail(+b.dataset.r).catch(fail));
}
async function aDetail(rid) {
  const [r, a] = await busy(async () => [chk(await db.from('results').select('*,participants(username)').eq('id', rid).single()),
    chk(await db.from('answers').select('*,questions(number,question,option_a,option_b,option_c,option_d)').eq('result_id', rid))]);
  const items = a.map(x => ({ ...x.questions, user_answer: x.user_answer, correct_answer: x.correct_answer, is_correct: x.is_correct })).sort((x, y) => x.number - y.number);
  $('#app').innerHTML = `<div class="head"><h2>Detail: ${esc(r.participants?.username)}</h2><button class="btn ghost" onclick="go('peserta')">← Kembali</button></div>
  <p class="muted" style="margin-bottom:12px">Skor ${r.score}/${r.max_score} · Benar ${r.correct_count} · Salah ${r.wrong_count} · ${fmt(r.finished_at)}</p>` + reviewHTML(items);
}

async function aKode() {
  const [c, p] = await busy(async () => [chk(await db.from('access_codes').select('*').order('created_at', { ascending: false })), chk(await db.from('participants').select('access_code_id'))]);
  const used = id => p.filter(x => x.access_code_id === id).length;
  $('#app').innerHTML = `<div class="head"><h2>🔑 Kode Peserta</h2></div><div class="card fade" style="margin-bottom:16px"><div class="row">
  <div style="flex:1;min-width:140px"><label>Kode<input id="kc" placeholder="mis. KELAS10A"></label></div><div style="flex:2;min-width:180px"><label>Keterangan<input id="kd" placeholder="Nama/keterangan kode"></label></div>
  <button class="btn" id="kn" style="align-self:flex-end">Buat Kode</button></div></div>` +
    tbl(['Kode', 'Keterangan', 'Status', 'Digunakan', 'Aksi'], c.map(x => `<tr><td><b>${esc(x.code)}</b></td><td>${esc(x.description)}</td><td><span class="pill ${x.status === 'aktif' ? 'ok' : 'off'}">${x.status}</span></td><td>${used(x.id)}</td>
    <td class="row"><button class="btn sm ghost" data-t="${x.id}" data-s="${x.status}">${x.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}</button><button class="btn sm danger" data-x="${x.id}">Hapus</button></td></tr>`));
  $('#kn').onclick = async () => {
    const code = $('#kc').value.trim().toUpperCase(); if (code.length < 3) return toast('Kode minimal 3 karakter', 'err');
    try { await busy(async () => chk(await db.from('access_codes').insert({ code, description: $('#kd').value.trim() }))); toast('Kode dibuat'); aKode(); } catch (e) { fail(e.code === '23505' ? new Error('Kode sudah ada') : e); }
  };
  document.querySelectorAll('[data-t]').forEach(b => b.onclick = async () => {
    try { await busy(async () => chk(await db.from('access_codes').update({ status: b.dataset.s === 'aktif' ? 'nonaktif' : 'aktif' }).eq('id', b.dataset.t))); aKode(); } catch (e) { fail(e); }
  });
  document.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
    if (!(await confirmBox('Hapus kode ini? Peserta lama tetap tersimpan, tetapi kode tidak bisa dipakai lagi.'))) return;
    try { await busy(async () => chk(await db.from('access_codes').delete().eq('id', b.dataset.x))); toast('Kode dihapus'); aKode(); } catch (e) { fail(e); }
  });
}

async function aStat() {
  // Dihitung dari maksimal 1000 jawaban terbaru (batas bawaan API Supabase).
  const a = await busy(async () => chk(await db.from('answers').select('question_id,is_correct,questions(number,question)').order('id', { ascending: false }).limit(1000)));
  const m = {};
  a.forEach(x => { const k = x.question_id; m[k] ??= { n: x.questions?.number, q: x.questions?.question, t: 0, c: 0 }; m[k].t++; if (x.is_correct) m[k].c++; });
  const rows = Object.values(m).sort((x, y) => x.n - y.n);
  $('#app').innerHTML = `<div class="head"><h2>📊 Statistik per Soal</h2></div><div class="list fade">${rows.map(r => { const pc = Math.round(r.c / r.t * 100);
    return `<div class="card"><small>Soal ${r.n}</small><p><b>${esc(r.q)}</b></p><span class="muted">${r.c} benar dari ${r.t} jawaban (${pc}%)</span><div class="hbar"><i style="width:${pc}%"></i></div></div>`; }).join('') || '<div class="card"><p class="muted">Belum ada jawaban.</p></div>'}</div>`;
}

async function aSet() {
  const s = await busy(async () => chk(await db.from('settings').select('*').eq('id', 1).single()));
  $('#app').innerHTML = `<div class="head"><h2>⚙️ Pengaturan</h2></div><div class="card fade" style="max-width:480px">
  <label>Timer total game (menit, 0 = tanpa timer)<input id="st" type="number" min="0" value="${s.timer_minutes}"></label>
  <label style="display:flex;align-items:center;margin-top:16px"><input id="sb" type="checkbox" ${s.allow_back ? 'checked' : ''}> Izinkan peserta kembali ke soal sebelumnya</label>
  <button class="btn" id="ss">Simpan Pengaturan</button></div>`;
  $('#ss').onclick = async () => {
    try { await busy(async () => chk(await db.from('settings').update({ timer_minutes: Math.max(0, +$('#st').value || 0), allow_back: $('#sb').checked }).eq('id', 1))); toast('Pengaturan tersimpan'); } catch (e) { fail(e); }
  };
}
