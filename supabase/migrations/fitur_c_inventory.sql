-- =============================================================
-- App 4 Cemerlang Jaya Motor · Fitur C (Inventory dan Pengguna)
-- Fungsi Stok dan Storage Bucket Publik (PRD 9.2 & 11)
-- =============================================================

-- 1. Fungsi catat_stok_masuk (PRD 9.2)
-- Dipanggil oleh: Admin, Owner
create or replace function public.catat_stok_masuk(
  p_item uuid,
  p_jumlah int,
  p_keterangan text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jenis text;
  v_stok_lama int;
  v_stok_baru int;
begin
  -- Periksa peran pemanggil di awal
  if private.peran_saya() not in ('admin', 'owner') then
    raise exception 'Hanya Admin dan Owner yang boleh mencatat stok masuk';
  end if;

  -- Validasi jumlah
  if p_jumlah is null or p_jumlah < 1 then
    raise exception 'Jumlah stok masuk minimal 1';
  end if;

  -- Kunci baris item dengan FOR UPDATE untuk mencegah race condition
  select jenis, stok
  into v_jenis, v_stok_lama
  from public.inventory_items
  where id = p_item
  for update;

  if not found then
    raise exception 'Item spare part tidak ditemukan';
  end if;

  if v_jenis <> 'part' then
    raise exception 'Hanya item jenis part yang memiliki stok';
  end if;

  v_stok_baru := v_stok_lama + p_jumlah;

  -- Perbarui stok di inventory_items
  update public.inventory_items
  set stok = v_stok_baru,
      updated_at = now()
  where id = p_item;

  -- Catat pergerakan stok ke stock_movements
  insert into public.stock_movements (
    item_id,
    jenis,
    jumlah,
    stok_sesudah,
    keterangan,
    dicatat_oleh
  ) values (
    p_item,
    'masuk',
    p_jumlah,
    v_stok_baru,
    p_keterangan,
    auth.uid()
  );
end;
$$;

revoke all on function public.catat_stok_masuk(uuid, int, text) from public, anon;
grant execute on function public.catat_stok_masuk(uuid, int, text) to authenticated;


-- 2. Fungsi sesuaikan_stok (PRD 9.2)
-- Dipanggil oleh: Owner
create or replace function public.sesuaikan_stok(
  p_item uuid,
  p_stok_fisik int,
  p_alasan text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jenis text;
  v_stok_lama int;
  v_selisih int;
begin
  -- Periksa peran pemanggil di awal
  if private.peran_saya() is distinct from 'owner' then
    raise exception 'Hanya Owner yang boleh menyesuaikan stok';
  end if;

  -- Validasi alasan wajib diisi
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'Alasan penyesuaian stok wajib diisi';
  end if;

  -- Validasi stok fisik
  if p_stok_fisik is null or p_stok_fisik < 0 then
    raise exception 'Stok fisik tidak boleh kurang dari 0';
  end if;

  -- Kunci baris item dengan FOR UPDATE
  select jenis, stok
  into v_jenis, v_stok_lama
  from public.inventory_items
  where id = p_item
  for update;

  if not found then
    raise exception 'Item spare part tidak ditemukan';
  end if;

  if v_jenis <> 'part' then
    raise exception 'Hanya item jenis part yang memiliki stok';
  end if;

  v_selisih := p_stok_fisik - v_stok_lama;

  if v_selisih = 0 then
    raise exception 'Stok fisik sama dengan stok sistem saat ini';
  end if;

  -- Perbarui stok di inventory_items
  update public.inventory_items
  set stok = p_stok_fisik,
      updated_at = now()
  where id = p_item;

  -- Catat pergerakan stok penyesuaian (selisih negatif bila berkurang)
  insert into public.stock_movements (
    item_id,
    jenis,
    jumlah,
    stok_sesudah,
    keterangan,
    dicatat_oleh
  ) values (
    p_item,
    'penyesuaian',
    v_selisih,
    p_stok_fisik,
    trim(p_alasan),
    auth.uid()
  );
end;
$$;

revoke all on function public.sesuaikan_stok(uuid, int, text) from public, anon;
grant execute on function public.sesuaikan_stok(uuid, int, text) to authenticated;


-- 3. Storage Bucket 'publik' & Policies (PRD Bab 11)
-- Batas ukuran: 1 MB (1048576 byte), tipe: image/webp, image/jpeg, image/png
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publik', 'publik', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = true,
  file_size_limit = 1048576,
  allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

-- Policy Select: Publik (bisa diunduh/ditampilkan siapa saja)
drop policy if exists "publik_baca_siapa_pun" on storage.objects;
create policy "publik_baca_siapa_pun"
on storage.objects for select
using (bucket_id = 'publik');

-- Policy Insert: Hanya Owner
drop policy if exists "publik_unggah_owner" on storage.objects;
create policy "publik_unggah_owner"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'publik'
  and (select private.peran_saya()) = 'owner'
);

-- Policy Update: Hanya Owner
drop policy if exists "publik_ubah_owner" on storage.objects;
create policy "publik_ubah_owner"
on storage.objects for update
to authenticated
using (
  bucket_id = 'publik'
  and (select private.peran_saya()) = 'owner'
)
with check (
  bucket_id = 'publik'
  and (select private.peran_saya()) = 'owner'
);

-- Policy Delete: Hanya Owner
drop policy if exists "publik_hapus_owner" on storage.objects;
create policy "publik_hapus_owner"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'publik'
  and (select private.peran_saya()) = 'owner'
);
