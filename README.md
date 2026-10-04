# 🎮 Game Teka-Teki (HTML + CSS + JavaScript + Supabase)

Website kuis statis untuk GitHub Pages. Data (soal, kode, peserta, skor) disimpan di Supabase. Tanpa PHP, MySQL, XAMPP, atau Node.js.

```
game-teka-teki/
├── index.html
├── css/style.css
├── js/ supabase.js · auth.js · app.js · participant.js · admin.js
├── supabase/schema.sql      <- jalankan di Supabase SQL Editor
├── assets/
└── README.md
```

## A. Setup Supabase
1. Daftar di https://supabase.com, klik **New project**, isi nama dan password database, pilih region terdekat (mis. Singapore), tunggu selesai.
2. Buka **Project Settings > API** (atau tombol **Connect**). Salin **Project URL** dan **publishable key** (atau **anon key** pada proyek lama). Hanya dua nilai ini yang boleh ada di frontend. Jangan pernah memakai `service_role` / secret key.
3. Buka **SQL Editor > New query**, tempel seluruh isi `supabase/schema.sql`, klik **Run**. Ini membuat tabel, mengaktifkan RLS, membuat policy, fungsi untuk peserta, dan data contoh (8 soal + kode `GAME2026`, `KELAS10A`).
4. Cek **Table Editor**: semua tabel harus berlabel RLS aktif.
5. **Authentication > Providers > Email**: matikan **Allow new users to sign up** supaya tidak ada orang asing membuat akun.

## B. Membuat akun Admin (aman)
1. **Authentication > Users > Add user > Create new user**. Isi email dan password kuat, centang **Auto Confirm User**.
2. Di **SQL Editor** jalankan (ganti emailnya):
```sql
insert into admins(user_id) select id from auth.users where email = 'emailkamu@contoh.com';
```
Tabel `admins` tidak bisa diubah lewat API, jadi tidak ada cara membuat Admin dari website. Password tidak ada di source code; login memakai Supabase Auth.

## C. Hubungkan website
Buka `js/supabase.js`, ganti `SUPABASE_URL` dan `SUPABASE_KEY` dengan nilai dari langkah A2.
Uji lokal: buka `index.html` di browser (atau ekstensi Live Server VS Code).

## D. Deploy ke GitHub Pages
1. Buat akun di github.com, klik **New repository**, beri nama (mis. `game-teka-teki`), pilih **Public**.
2. **Add file > Upload files**, unggah seluruh isi folder (index.html, css, js, supabase, assets, README.md), lalu **Commit changes**.
3. **Settings > Pages**. Di **Build and deployment** pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, klik **Save**.
4. Tunggu 1-2 menit. Buka `https://USERNAME.github.io/game-teka-teki/`.

## E. Cara pakai
- **Admin**: tab Admin di halaman awal, login email dan password. Kelola soal, kode, peserta, statistik, timer.
- **Peserta**: isi username bebas + kode akses dari Admin (mis. `GAME2026`).

## Cara kerja keamanan
- Semua tabel memakai **RLS**. Hanya akun yang ada di tabel `admins` yang bisa membaca/mengubah tabel; akses `anon` ke tabel dicabut.
- Peserta hanya memakai fungsi database (`join_game`, `get_questions`, `start_attempt`, `submit_game`, dst). Kode akses dicek di database, kunci jawaban tidak dikirim ke peserta, dan **skor dihitung di server**, jadi tidak bisa diubah dari browser.
- Peserta tidak bisa mengubah soal, membuat Admin, mengubah skor, atau menghapus data.

## Batasan yang perlu diketahui
- Peserta yang tahu username + kode yang sama bisa membuka sesi yang sama (tidak ada password peserta).
- Tebak-tebakan kode peserta ke fungsi `join_game` tidak dibatasi laju; pakai kode yang tidak mudah ditebak.
- Timer dijalankan di browser (kirim otomatis saat habis), belum dipaksa di server.
- Statistik per soal memakai maksimal 1000 jawaban terbaru (batas bawaan API).
