-- -------------------------------------------------------------
-- Migrasi: Integrasi Payment Gateway Mayar Sandbox (API V2)
-- File: supabase/migrations/fitur_mayar.sql
-- -------------------------------------------------------------

-- 1. Tambah kolom pendukung Mayar pada tabel invoices
alter table public.invoices
  add column if not exists mayar_invoice_id text,
  add column if not exists mayar_link text,
  add column if not exists mayar_jumlah bigint,
  add column if not exists dibayar_online_at timestamptz;

-- 2. Perbarui check constraint pada tabel payments agar mendukung metode 'mayar'
alter table public.payments
  drop constraint if exists payments_metode_check;

alter table public.payments
  add constraint payments_metode_check
  check (metode in ('tunai', 'transfer', 'qris', 'mayar'));

-- 3. Buat tabel mayar_webhook_log
create table if not exists public.mayar_webhook_log (
  id bigint generated always as identity primary key,
  event text,
  status text,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- Indeks untuk mengoptimalkan pembacaan 10 baris terakhir
create index if not exists idx_mayar_webhook_log_created_at
  on public.mayar_webhook_log (created_at desc);

-- Aktifkan Row Level Security (RLS)
alter table public.mayar_webhook_log enable row level security;

-- Policy RLS: Hanya Owner yang boleh membaca mayar_webhook_log
drop policy if exists "owner_baca_mayar_log" on public.mayar_webhook_log;
create policy "owner_baca_mayar_log" on public.mayar_webhook_log
  for select to authenticated
  using ((select private.peran_saya()) = 'owner');

grant select on public.mayar_webhook_log to authenticated;

-- 4. Fungsi simpan_link_mayar (Dipanggil oleh: Admin, Owner)
-- Menyimpan ID invoice Mayar, URL tautan, dan nominal pembayaran ke tabel invoices
create or replace function public.simpan_link_mayar(
  p_invoice_id uuid,
  p_mayar_invoice_id text,
  p_mayar_link text,
  p_mayar_jumlah bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_inv record;
begin
  -- 1. Validasi peran pengguna
  v_peran := private.peran_saya();
  if v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang boleh menyimpan tautan pembayaran Mayar';
  end if;

  -- 2. Kunci baris invoice dengan FOR UPDATE
  select id, status_bayar
  into v_inv
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice tidak ditemukan';
  end if;

  if v_inv.status_bayar = 'lunas' then
    raise exception 'Invoice ini sudah lunas';
  end if;

  -- 3. Simpan data tautan Mayar
  update public.invoices
  set mayar_invoice_id = p_mayar_invoice_id,
      mayar_link = p_mayar_link,
      mayar_jumlah = p_mayar_jumlah
  where id = p_invoice_id;
end $$;

revoke all on function public.simpan_link_mayar(uuid, text, text, bigint) from public, anon;
grant execute on function public.simpan_link_mayar(uuid, text, text, bigint) to authenticated;

-- 5. Fungsi tandai_lunas_mayar (Hanya bisa dijalankan dengan Secret Key / service_role)
-- Mengunci invoice dengan FOR UPDATE, mencatat pembayaran 'mayar' sebesar mayar_jumlah,
-- memperbarui status invoice, dan mencatat riwayat ke mayar_webhook_log
create or replace function public.tandai_lunas_mayar(
  p_invoice_id uuid,
  p_event text default 'payment.received',
  p_status text default 'paid',
  p_payload jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv record;
  v_sisa bigint;
  v_terbayar_baru bigint;
  v_status_bayar text;
  v_dicatat_oleh uuid;
  v_jumlah_bayar bigint;
begin
  -- 1. Kunci baris invoice dengan FOR UPDATE
  select id, total, terbayar, status_bayar, mayar_jumlah
  into v_inv
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice tidak ditemukan';
  end if;

  -- 2. Hanya sekali: berhenti tanpa mencatat apa pun bila invoice sudah lunas
  if v_inv.status_bayar = 'lunas' then
    return;
  end if;

  v_sisa := v_inv.total - v_inv.terbayar;

  -- Tentukan nominal pembayaran (prioritaskan mayar_jumlah, atau sisa tagihan)
  v_jumlah_bayar := coalesce(v_inv.mayar_jumlah, v_sisa);
  if v_jumlah_bayar > v_sisa or v_jumlah_bayar <= 0 then
    v_jumlah_bayar := v_sisa;
  end if;

  -- Ambil profil Owner atau Admin untuk mengisi kolom dicatat_oleh
  select id into v_dicatat_oleh
  from public.profiles
  where role in ('owner', 'admin')
  order by role = 'owner' desc
  limit 1;

  -- Catat ke tabel payments dengan metode 'mayar'
  insert into public.payments (
    invoice_id,
    metode,
    jumlah,
    dicatat_oleh
  )
  values (
    p_invoice_id,
    'mayar',
    v_jumlah_bayar,
    v_dicatat_oleh
  );

  -- Perbarui status dan total terbayar pada invoice
  v_terbayar_baru := v_inv.terbayar + v_jumlah_bayar;
  if v_terbayar_baru >= v_inv.total then
    v_status_bayar := 'lunas';
  else
    v_status_bayar := 'sebagian';
  end if;

  update public.invoices
  set terbayar = v_terbayar_baru,
      status_bayar = v_status_bayar,
      dibayar_online_at = now()
  where id = p_invoice_id;

  -- 3. Catat payload ke tabel mayar_webhook_log bila disediakan
  if p_payload is not null or p_event is not null then
    insert into public.mayar_webhook_log (event, status, payload)
    values (
      coalesce(p_event, 'payment.received'),
      coalesce(p_status, 'paid'),
      coalesce(p_payload, jsonb_build_object(
        'invoice_id', p_invoice_id,
        'jumlah', v_jumlah_bayar,
        'waktu', now()
      ))
    );
  end if;
end $$;

-- Batasi hak eksekusi hanya untuk secret key (service_role)
revoke all on function public.tandai_lunas_mayar(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.tandai_lunas_mayar(uuid, text, text, jsonb) to service_role;
