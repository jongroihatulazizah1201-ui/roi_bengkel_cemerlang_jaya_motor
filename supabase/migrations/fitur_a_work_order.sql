-- ============================================================================
-- FITUR A: WORK ORDER (PRD 7.2, 9.2, 9.4, Bab 11)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FUNGSI: buat_work_order
-- ----------------------------------------------------------------------------
create or replace function public.buat_work_order(
  p_vehicle_id uuid,
  p_kepala_mekanik_id uuid,
  p_odometer int,
  p_keluhan text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text := private.peran_saya();
  v_customer_id uuid;
  v_periode text;
  v_nomor_urut int;
  v_nomor text;
  v_wo_id uuid;
begin
  -- Periksa peran pemanggil
  if v_peran not in ('admin', 'owner') or v_peran is null then
    raise exception 'Hanya Admin atau Owner yang boleh membuat work order';
  end if;

  -- Validasi keluhan & odometer
  if coalesce(trim(p_keluhan), '') = '' then
    raise exception 'Keluhan wajib diisi';
  end if;

  if p_odometer is null or p_odometer < 0 then
    raise exception 'Odometer tidak boleh negatif';
  end if;

  -- Validasi kendaraan & ambil customer_id
  select customer_id into v_customer_id
  from public.vehicles
  where id = p_vehicle_id;

  if v_customer_id is null then
    raise exception 'Kendaraan tidak ditemukan';
  end if;

  -- Validasi Kepala Mekanik aktif
  if not exists (
    select 1 from public.profiles
    where id = p_kepala_mekanik_id
      and role = 'kepala_mekanik'
      and aktif
  ) then
    raise exception 'Kepala mekanik tidak valid atau tidak aktif';
  end if;

  -- Penomoran WO: WO-YYMM-0001 (dikunci via private.nomor_berikut)
  v_periode := to_char(now() at time zone 'Asia/Jakarta', 'YYMM');
  v_nomor_urut := private.nomor_berikut('WO', v_periode);
  v_nomor := 'WO-' || v_periode || '-' || lpad(v_nomor_urut::text, 4, '0');

  -- Buat baris Work Order
  insert into public.work_orders (
    nomor,
    vehicle_id,
    customer_id,
    kepala_mekanik_id,
    odometer,
    keluhan,
    status,
    dibuat_oleh
  ) values (
    v_nomor,
    p_vehicle_id,
    v_customer_id,
    p_kepala_mekanik_id,
    p_odometer,
    trim(p_keluhan),
    'menunggu',
    auth.uid()
  )
  returning id into v_wo_id;

  -- Catat riwayat status
  insert into public.wo_status_history (
    work_order_id,
    dari_status,
    ke_status,
    catatan,
    oleh
  ) values (
    v_wo_id,
    null,
    'menunggu',
    'Work order dibuat',
    auth.uid()
  );

  return v_wo_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. FUNGSI: tugaskan_mekanik
-- ----------------------------------------------------------------------------
create or replace function public.tugaskan_mekanik(
  p_wo uuid,
  p_mekanik uuid[],
  p_estimasi date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text := private.peran_saya();
  v_wo record;
  v_m_id uuid;
begin
  if v_peran is null then
    raise exception 'Akun tidak aktif atau tidak ditemukan';
  end if;

  -- Kunci baris WO dengan FOR UPDATE
  select * into v_wo
  from public.work_orders
  where id = p_wo
  for update;

  if v_wo.id is null then
    raise exception 'Work order tidak ditemukan';
  end if;

  -- Periksa hak akses tim
  if v_peran <> 'owner' and (v_peran <> 'kepala_mekanik' or v_wo.kepala_mekanik_id <> auth.uid()) then
    raise exception 'Hanya Kepala Mekanik tim ini atau Owner yang boleh menugaskan mekanik';
  end if;

  -- Status harus menunggu
  if v_wo.status <> 'menunggu' then
    raise exception 'Penugasan mekanik hanya boleh dilakukan saat status menunggu';
  end if;

  -- Validasi input
  if p_mekanik is null or cardinality(p_mekanik) = 0 then
    raise exception 'Minimal satu mekanik harus dipilih';
  end if;

  if p_estimasi is null then
    raise exception 'Estimasi selesai wajib diisi';
  end if;

  -- Periksa apakah semua mekanik aktif & dari tim yang sesuai
  foreach v_m_id in array p_mekanik loop
    if not exists (
      select 1 from public.mekanik
      where id = v_m_id
        and kepala_mekanik_id = v_wo.kepala_mekanik_id
        and aktif
    ) then
      raise exception 'Mekanik tidak valid, tidak aktif, atau bukan anggota tim yang menangani WO ini';
    end if;
  end loop;

  -- Simpan estimasi selesai
  update public.work_orders
  set estimasi_selesai = p_estimasi
  where id = p_wo;

  -- Simpan daftar penugasan mekanik
  delete from public.work_order_mekanik where work_order_id = p_wo;

  insert into public.work_order_mekanik (work_order_id, mekanik_id)
  select p_wo, unnest(p_mekanik);
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. FUNGSI: ubah_status_wo
-- ----------------------------------------------------------------------------
create or replace function public.ubah_status_wo(
  p_wo uuid,
  p_status text,
  p_catatan text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text := private.peran_saya();
  v_wo record;
  r_part record;
  v_ada_mekanik boolean;
  v_ada_tagihan boolean;
  v_inv_lunas boolean;
  v_ada_foto_akhir boolean;
begin
  if v_peran is null then
    raise exception 'Akun tidak aktif atau tidak ditemukan';
  end if;

  -- Kunci baris WO dengan FOR UPDATE
  select * into v_wo
  from public.work_orders
  where id = p_wo
  for update;

  if v_wo.id is null then
    raise exception 'Work order tidak ditemukan';
  end if;

  if p_status not in ('menunggu', 'dikerjakan', 'tertunda', 'selesai', 'siap_diambil', 'diambil', 'dibatalkan') then
    raise exception 'Status tujuan tidak valid: %', p_status;
  end if;

  if v_wo.status = p_status then
    raise exception 'Work order sudah berada pada status %', p_status;
  end if;

  -- 1) menunggu -> dikerjakan
  if v_wo.status = 'menunggu' and p_status = 'dikerjakan' then
    if v_peran <> 'owner' and (v_peran <> 'kepala_mekanik' or v_wo.kepala_mekanik_id <> auth.uid()) then
      raise exception 'Hanya Kepala Mekanik tim ini atau Owner yang boleh mengubah status ke dikerjakan';
    end if;

    select exists (select 1 from public.work_order_mekanik where work_order_id = p_wo) into v_ada_mekanik;
    if not v_ada_mekanik or v_wo.estimasi_selesai is null then
      raise exception 'Minimal 1 mekanik dan estimasi selesai harus sudah terisi sebelum mulai dikerjakan';
    end if;

    update public.work_orders
    set status = 'dikerjakan',
        catatan_status = coalesce(p_catatan, catatan_status)
    where id = p_wo;

  -- 2) dikerjakan -> tertunda
  elsif v_wo.status = 'dikerjakan' and p_status = 'tertunda' then
    if v_peran <> 'owner' and (v_peran <> 'kepala_mekanik' or v_wo.kepala_mekanik_id <> auth.uid()) then
      raise exception 'Hanya Kepala Mekanik tim ini atau Owner yang boleh menunda work order';
    end if;

    if coalesce(trim(p_catatan), '') = '' then
      raise exception 'Catatan alasan penundaan wajib diisi';
    end if;

    update public.work_orders
    set status = 'tertunda',
        catatan_status = trim(p_catatan)
    where id = p_wo;

  -- 3) tertunda -> dikerjakan
  elsif v_wo.status = 'tertunda' and p_status = 'dikerjakan' then
    if v_peran <> 'owner' and (v_peran <> 'kepala_mekanik' or v_wo.kepala_mekanik_id <> auth.uid()) then
      raise exception 'Hanya Kepala Mekanik tim ini atau Owner yang boleh melanjutkan pengerjaan';
    end if;

    update public.work_orders
    set status = 'dikerjakan',
        catatan_status = coalesce(p_catatan, catatan_status)
    where id = p_wo;

  -- 4) dikerjakan -> selesai
  elsif v_wo.status = 'dikerjakan' and p_status = 'selesai' then
    if v_peran <> 'owner' and (v_peran <> 'kepala_mekanik' or v_wo.kepala_mekanik_id <> auth.uid()) then
      raise exception 'Hanya Kepala Mekanik tim ini atau Owner yang boleh menyelesaikan pengerjaan';
    end if;

    select exists (select 1 from public.billing_items where work_order_id = p_wo) into v_ada_tagihan;
    if not v_ada_tagihan then
      raise exception 'Minimal harus ada 1 baris tagihan sebelum WO diselesaikan';
    end if;

    update public.work_orders
    set status = 'selesai',
        selesai_at = now(),
        catatan_status = coalesce(p_catatan, catatan_status)
    where id = p_wo;

  -- 5) selesai -> siap_diambil (QC Lulus)
  elsif v_wo.status = 'selesai' and p_status = 'siap_diambil' then
    if v_peran <> 'owner' and (v_peran <> 'kepala_mekanik' or v_wo.kepala_mekanik_id <> auth.uid()) then
      raise exception 'Hanya Kepala Mekanik tim ini atau Owner yang boleh meluluskan QC ke siap diambil';
    end if;

    update public.work_orders
    set status = 'siap_diambil',
        catatan_status = coalesce(p_catatan, catatan_status)
    where id = p_wo;

  -- 6) selesai -> dikerjakan (QC Gagal)
  elsif v_wo.status = 'selesai' and p_status = 'dikerjakan' then
    if v_peran <> 'owner' and (v_peran <> 'kepala_mekanik' or v_wo.kepala_mekanik_id <> auth.uid()) then
      raise exception 'Hanya Kepala Mekanik tim ini atau Owner yang boleh mengembalikan pengerjaan karena QC gagal';
    end if;

    if coalesce(trim(p_catatan), '') = '' then
      raise exception 'Catatan alasan QC gagal wajib diisi';
    end if;

    update public.work_orders
    set status = 'dikerjakan',
        selesai_at = null,
        catatan_status = trim(p_catatan)
    where id = p_wo;

  -- 7) siap_diambil -> diambil (Serahkan Mobil)
  elsif v_wo.status = 'siap_diambil' and p_status = 'diambil' then
    if v_peran not in ('admin', 'owner') then
      raise exception 'Hanya Admin atau Owner yang boleh menyerahkan mobil';
    end if;

    select exists (
      select 1 from public.invoices
      where work_order_id = p_wo and status_bayar = 'lunas'
    ) into v_inv_lunas;

    if not v_inv_lunas then
      raise exception 'Mobil hanya dapat diserahkan jika invoice sudah terbit dan lunas';
    end if;

    select exists (
      select 1 from public.work_order_photos
      where work_order_id = p_wo and jenis = 'kondisi_akhir'
    ) into v_ada_foto_akhir;

    if not v_ada_foto_akhir then
      raise exception 'Minimal 1 foto kondisi akhir wajib diunggah sebelum mobil diserahkan';
    end if;

    update public.work_orders
    set status = 'diambil',
        diambil_at = now(),
        catatan_status = coalesce(p_catatan, catatan_status)
    where id = p_wo;

  -- 8) menunggu, dikerjakan, tertunda -> dibatalkan
  elsif v_wo.status in ('menunggu', 'dikerjakan', 'tertunda') and p_status = 'dibatalkan' then
    if v_peran not in ('admin', 'owner') then
      raise exception 'Hanya Admin atau Owner yang boleh membatalkan work order';
    end if;

    if coalesce(trim(p_catatan), '') = '' then
      raise exception 'Alasan pembatalan work order wajib diisi';
    end if;

    -- Kembalikan stok part yang sudah terpakai
    for r_part in (
      select b.item_id, b.jumlah, i.stok
      from public.billing_items b
      join public.inventory_items i on i.id = b.item_id
      where b.work_order_id = p_wo and b.jenis = 'part'
      for update of i
    ) loop
      update public.inventory_items
      set stok = stok + r_part.jumlah
      where id = r_part.item_id;

      insert into public.stock_movements (
        item_id,
        jenis,
        jumlah,
        stok_sesudah,
        keterangan,
        work_order_id,
        dicatat_oleh
      ) values (
        r_part.item_id,
        'kembali',
        r_part.jumlah,
        r_part.stok + r_part.jumlah,
        'WO dibatalkan: ' || trim(p_catatan),
        p_wo,
        auth.uid()
      );
    end loop;

    update public.work_orders
    set status = 'dibatalkan',
        catatan_status = trim(p_catatan)
    where id = p_wo;

  -- Lainnya ditolak
  else
    if v_wo.status in ('diambil', 'dibatalkan') then
      raise exception 'Work order yang sudah berstatus % tidak dapat diubah lagi', v_wo.status;
    else
      raise exception 'Perpindahan status dari % ke % tidak diizinkan', v_wo.status, p_status;
    end if;
  end if;

  -- Catat ke wo_status_history
  insert into public.wo_status_history (
    work_order_id,
    dari_status,
    ke_status,
    catatan,
    oleh
  ) values (
    p_wo,
    v_wo.status,
    p_status,
    p_catatan,
    auth.uid()
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. TRIGGER: jaga_wo
-- ----------------------------------------------------------------------------
create or replace function private.jaga_wo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_peran text := private.peran_saya();
begin
  if current_user = 'authenticated' then
    -- Status tidak boleh diubah langsung via update
    if new.status is distinct from old.status then
      raise exception 'Status work order hanya boleh diubah melalui fungsi ubah_status_wo';
    end if;

    -- Kolom sistem/identitas tidak boleh diubah
    if new.id is distinct from old.id or
       new.nomor is distinct from old.nomor or
       new.vehicle_id is distinct from old.vehicle_id or
       new.customer_id is distinct from old.customer_id or
       new.dibuat_oleh is distinct from old.dibuat_oleh or
       new.selesai_at is distinct from old.selesai_at or
       new.diambil_at is distinct from old.diambil_at or
       new.created_at is distinct from old.created_at then
      raise exception 'Kolom ini tidak boleh diubah langsung';
    end if;

    -- Diskon hanya via fungsi
    if new.diskon is distinct from old.diskon or new.alasan_diskon is distinct from old.alasan_diskon then
      raise exception 'Diskon hanya boleh diatur melalui fungsi atur_diskon';
    end if;

    -- Keluhan, odometer, tim hanya saat menunggu oleh Admin/Owner
    if (new.keluhan is distinct from old.keluhan or
        new.odometer is distinct from old.odometer or
        new.kepala_mekanik_id is distinct from old.kepala_mekanik_id) then
      if old.status <> 'menunggu' then
        raise exception 'Keluhan, odometer, dan tim kepala mekanik hanya boleh diubah saat status menunggu';
      end if;
      if v_peran not in ('admin', 'owner') then
        raise exception 'Hanya Admin atau Owner yang boleh mengubah data masuk work order';
      end if;
    end if;

    -- Diagnosis hanya saat dikerjakan / tertunda oleh Kepala Mekanik tim WO atau Owner
    if new.diagnosis is distinct from old.diagnosis then
      if old.status not in ('dikerjakan', 'tertunda') then
        raise exception 'Diagnosis hanya boleh diisi saat status dikerjakan atau tertunda';
      end if;
      if v_peran <> 'owner' and (v_peran <> 'kepala_mekanik' or old.kepala_mekanik_id <> auth.uid()) then
        raise exception 'Hanya Kepala Mekanik tim yang menangani atau Owner yang boleh mengubah diagnosis';
      end if;
    end if;

    -- Estimasi & catatan status hanya lewat fungsi
    if new.estimasi_selesai is distinct from old.estimasi_selesai then
      raise exception 'Estimasi selesai hanya boleh diubah melalui fungsi tugaskan_mekanik';
    end if;

    if new.catatan_status is distinct from old.catatan_status then
      raise exception 'Catatan status hanya boleh diubah melalui fungsi ubah_status_wo';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_wo on public.work_orders;
create trigger jaga_wo
before update on public.work_orders
for each row execute function private.jaga_wo();

-- ----------------------------------------------------------------------------
-- 5. BUCKET & POLICY: foto-wo
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto-wo', 'foto-wo', false, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do update set
  public = false,
  file_size_limit = 1048576,
  allowed_mime_types = array['image/webp', 'image/jpeg'];

drop policy if exists "foto_wo_lihat" on storage.objects;
drop policy if exists "foto_wo_unggah_stnk_awal" on storage.objects;
drop policy if exists "foto_wo_unggah_akhir" on storage.objects;
drop policy if exists "foto_wo_unggah_pengerjaan" on storage.objects;
drop policy if exists "foto_wo_hapus" on storage.objects;

-- Lihat: semua pengguna aktif
create policy "foto_wo_lihat" on storage.objects for select to authenticated
using (
  bucket_id = 'foto-wo'
  and (select private.peran_saya()) is not null
);

-- Unggah stnk & kondisi awal saat menunggu (Admin, Owner)
create policy "foto_wo_unggah_stnk_awal" on storage.objects for insert to authenticated
with check (
  bucket_id = 'foto-wo'
  and (select private.peran_saya()) in ('admin', 'owner')
  and (storage.foldername(name))[2] in ('stnk', 'kondisi_awal')
  and exists (
    select 1 from public.work_orders w
    where w.id::text = (storage.foldername(name))[1]
      and w.status = 'menunggu'
  )
);

-- Unggah kondisi akhir saat siap diambil (Admin, Owner)
create policy "foto_wo_unggah_akhir" on storage.objects for insert to authenticated
with check (
  bucket_id = 'foto-wo'
  and (select private.peran_saya()) in ('admin', 'owner')
  and (storage.foldername(name))[2] = 'kondisi_akhir'
  and exists (
    select 1 from public.work_orders w
    where w.id::text = (storage.foldername(name))[1]
      and w.status = 'siap_diambil'
  )
);

-- Unggah pengerjaan saat dikerjakan (Kepala Mekanik tim WO atau Owner)
create policy "foto_wo_unggah_pengerjaan" on storage.objects for insert to authenticated
with check (
  bucket_id = 'foto-wo'
  and (select private.peran_saya()) in ('kepala_mekanik', 'owner')
  and (storage.foldername(name))[2] = 'pengerjaan'
  and exists (
    select 1 from public.work_orders w
    where w.id::text = (storage.foldername(name))[1]
      and w.status = 'dikerjakan'
      and ((select private.peran_saya()) = 'owner' or w.kepala_mekanik_id = auth.uid())
  )
);

-- Hapus: Owner
create policy "foto_wo_hapus" on storage.objects for delete to authenticated
using (
  bucket_id = 'foto-wo'
  and (select private.peran_saya()) = 'owner'
);

-- ----------------------------------------------------------------------------
-- 6. HAK AKSES (GRANT)
-- ----------------------------------------------------------------------------
revoke all on function public.buat_work_order(uuid, uuid, int, text) from public, anon;
grant execute on function public.buat_work_order(uuid, uuid, int, text) to authenticated;

revoke all on function public.tugaskan_mekanik(uuid, uuid[], date) from public, anon;
grant execute on function public.tugaskan_mekanik(uuid, uuid[], date) to authenticated;

revoke all on function public.ubah_status_wo(uuid, text, text) from public, anon;
grant execute on function public.ubah_status_wo(uuid, text, text) to authenticated;
