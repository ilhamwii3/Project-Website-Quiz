-- ============ SKEMA GAME TEKA-TEKI (jalankan di Supabase > SQL Editor) ============
create table if not exists admins(user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz default now());
create table if not exists access_codes(
  id bigint generated always as identity primary key, code text not null, description text,
  status text not null default 'aktif' check(status in('aktif','nonaktif')), created_at timestamptz default now());
create unique index if not exists access_codes_code_uq on access_codes(lower(code));
create table if not exists participants(
  id bigint generated always as identity primary key, username text not null,
  access_code_id bigint references access_codes(id) on delete set null,
  token uuid not null default gen_random_uuid() unique, created_at timestamptz default now());
create unique index if not exists participants_uq on participants(lower(username), access_code_id);
create table if not exists questions(
  id bigint generated always as identity primary key, number int not null default 1, question text not null,
  option_a text not null, option_b text not null, option_c text not null, option_d text not null,
  correct_answer text not null check(correct_answer in('A','B','C','D')), points int not null default 10 check(points>=0),
  status text not null default 'aktif' check(status in('aktif','nonaktif')), created_at timestamptz default now());
create table if not exists results(
  id bigint generated always as identity primary key, participant_id bigint not null references participants(id) on delete cascade,
  status text not null default 'berjalan' check(status in('berjalan','selesai')),
  score int not null default 0, max_score int not null default 0, total_questions int not null default 0,
  answered_count int not null default 0, correct_count int not null default 0, wrong_count int not null default 0,
  started_at timestamptz default now(), finished_at timestamptz);
create table if not exists answers(
  id bigint generated always as identity primary key, result_id bigint not null references results(id) on delete cascade,
  question_id bigint not null references questions(id) on delete cascade, user_answer text, correct_answer text not null,
  is_correct boolean not null default false, points_earned int not null default 0);
create table if not exists settings(id int primary key default 1 check(id=1), timer_minutes int not null default 0 check(timer_minutes>=0), allow_back boolean not null default true);
insert into settings(id) values(1) on conflict do nothing;

-- ============ KEAMANAN: RLS ============
create or replace function is_admin() returns boolean language sql security definer stable set search_path=public as
$$ select exists(select 1 from admins where user_id=auth.uid()) $$;

revoke all on all tables in schema public from anon;   -- pengunjung tanpa login tidak boleh menyentuh tabel langsung
alter table admins enable row level security;
drop policy if exists cek_diri on admins;
create policy cek_diri on admins for select to authenticated using (user_id=auth.uid());  -- tidak ada policy insert/update/delete: admin hanya dibuat lewat SQL Editor

do $$ declare t text; begin
  foreach t in array array['access_codes','participants','questions','results','answers','settings'] loop
    execute format('alter table %I enable row level security',t);
    execute format('drop policy if exists admin_all on %I',t);
    execute format('create policy admin_all on %I for all to authenticated using (public.is_admin()) with check (public.is_admin())',t);
  end loop; end $$;

-- ============ FUNGSI UNTUK PESERTA (satu-satunya pintu akses peserta) ============
create or replace function join_game(p_username text, p_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare c access_codes; p participants; u text := trim(p_username);
begin
  if length(u)<2 or length(u)>30 then raise exception 'Username harus 2-30 karakter'; end if;
  select * into c from access_codes where lower(code)=lower(trim(p_code)) and status='aktif';
  if not found then raise exception 'Kode akses salah atau tidak aktif'; end if;
  insert into participants(username,access_code_id) values(u,c.id)
    on conflict (lower(username),access_code_id) do update set username=excluded.username returning * into p;
  return jsonb_build_object('token',p.token,'username',p.username);
end $$;

create or replace function get_settings() returns jsonb language sql security definer set search_path=public as
$$ select to_jsonb(s) from settings s where id=1 $$;

create or replace function get_questions(p_token uuid) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from participants where token=p_token) then raise exception 'Sesi tidak valid, silakan masuk ulang'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'number',number,'question',question,'option_a',option_a,
    'option_b',option_b,'option_c',option_c,'option_d',option_d,'points',points) order by number,id),'[]'::jsonb)
    from questions where status='aktif');   -- kunci jawaban TIDAK dikirim ke peserta
end $$;

create or replace function start_attempt(p_token uuid) returns bigint language plpgsql security definer set search_path=public as $$
declare v_p participants; v_id bigint;
begin
  select * into v_p from participants where token=p_token;
  if not found then raise exception 'Sesi tidak valid, silakan masuk ulang'; end if;
  insert into results(participant_id,total_questions,max_score)
    select v_p.id,count(*),coalesce(sum(points),0) from questions where status='aktif' returning id into v_id;
  return v_id;
end $$;

create or replace function submit_game(p_token uuid, p_result_id bigint, p_answers jsonb) returns bigint language plpgsql security definer set search_path=public as $$
declare v_res results;
begin
  select r.* into v_res from results r join participants p on p.id=r.participant_id
    where r.id=p_result_id and p.token=p_token and r.status='berjalan';
  if not found then raise exception 'Sesi tidak valid atau game sudah selesai'; end if;
  insert into answers(result_id,question_id,user_answer,correct_answer,is_correct,points_earned)
    select v_res.id,q.id,case when q.ua in('A','B','C','D') then q.ua end,q.correct_answer,
           coalesce(q.ua=q.correct_answer,false), case when q.ua=q.correct_answer then q.points else 0 end
    from (select x.*, upper(p_answers->>(x.id::text)) as ua from questions x where x.status='aktif') q;
  update results set status='selesai', finished_at=now(),
    answered_count=(select count(*) from answers where result_id=v_res.id and user_answer is not null),
    correct_count=(select count(*) from answers where result_id=v_res.id and is_correct),
    wrong_count=(select count(*) from answers where result_id=v_res.id and not is_correct),
    score=(select coalesce(sum(points_earned),0) from answers where result_id=v_res.id)
  where id=v_res.id;
  return v_res.id;
end $$;

create or replace function get_my_results(p_token uuid) returns jsonb language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.finished_at desc),'[]'::jsonb)
  from results r join participants p on p.id=r.participant_id where p.token=p_token and r.status='selesai' $$;

create or replace function get_result_detail(p_token uuid, p_result_id bigint) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_r results;
begin
  select r.* into v_r from results r join participants p on p.id=r.participant_id
    where r.id=p_result_id and p.token=p_token and r.status='selesai';
  if not found then raise exception 'Hasil tidak ditemukan'; end if;
  return jsonb_build_object('result',to_jsonb(v_r),'items',(
    select coalesce(jsonb_agg(jsonb_build_object('number',q.number,'question',q.question,'option_a',q.option_a,'option_b',q.option_b,
      'option_c',q.option_c,'option_d',q.option_d,'user_answer',a.user_answer,'correct_answer',a.correct_answer,'is_correct',a.is_correct)
      order by q.number),'[]'::jsonb) from answers a join questions q on q.id=a.question_id where a.result_id=v_r.id));
end $$;

create or replace function get_leaderboard() returns jsonb language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(t),'[]'::jsonb) from (
    select p.username, max(r.score) as score, max(r.max_score) as max_score
    from results r join participants p on p.id=r.participant_id where r.status='selesai'
    group by p.id,p.username order by max(r.score) desc, min(r.finished_at) limit 50) t $$;

-- ============ DATA CONTOH (aman dijalankan sekali) ============
insert into access_codes(code,description,status) values ('GAME2026','Kode umum','aktif'),('KELAS10A','Kelas 10A','aktif'),('TEST001','Kode uji (nonaktif)','nonaktif') on conflict do nothing;
insert into questions(number,question,option_a,option_b,option_c,option_d,correct_answer,points)
select * from (values
 (1,'Hasil dari 12 × 8 adalah ...','86','96','106','112','B',10),
 (2,'Planet yang paling dekat dengan Matahari adalah ...','Venus','Merkurius','Mars','Bumi','B',10),
 (3,'Teks Proklamasi Kemerdekaan Indonesia dibacakan oleh ...','Soekarno','Moh. Hatta','Soeharto','Sutan Sjahrir','A',10),
 (4,'Rumus kimia air adalah ...','CO2','O2','H2O','NaCl','C',10),
 (5,'Gunung berapi aktif yang terkenal di Jawa Timur adalah ...','Kerinci','Bromo','Rinjani','Tambora','B',10),
 (6,'Hewan menyusui terbesar di dunia adalah ...','Gajah','Paus biru','Jerapah','Hiu paus','B',10),
 (7,'Bahasa yang membuat halaman web bisa interaktif adalah ...','HTML','CSS','JavaScript','SQL','C',10),
 (8,'Keliling persegi dengan sisi s adalah ...','s²','2s','4s','s + 4','C',10)
) v(number,question,option_a,option_b,option_c,option_d,correct_answer,points) where not exists(select 1 from questions);
