-- =============================================================
-- App 4 Cemerlang Jaya Motor · Fitur B: Tagihan dan Invoice
-- PRD 9.2: Fungsi bisnis untuk Tagihan, Invoice, dan Pembayaran
-- Sesuai aturan AGENTS.md:
--   - Tanpa mengubah, menambah, atau menghapus skema tabel yang ada
--   - security definer, set search_path = ''
--   - Peran diperiksa di awal lewat private.peran_saya()
--   - Baris yang mengubah stok dan nomor invoice dikunci dengan FOR UPDATE
--   - Penyesuaian harga wajib beralasan
--   - Pesan error berbahasa Indonesia
-- =============================================================

-- -------------------------------------------------------------
-- 1. tambah_item_tagihan
-- Dipanggil oleh: Kepala Mekanik tim WO, Owner
-- Syarat: Status WO harus 'dikerjakan'
-- Mengunci baris item (FOR UPDATE), mengurangi stok spare part,
-- mencatat stock_movements, menyimpan billing_items & billing_item_costs
-- -------------------------------------------------------------
create or replace function public.tambah_item_tagihan(
  p_wo uuid,
  p_item uuid,
  p_jumlah int
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_wo_status text;
  v_wo_tim uuid;
  v_item record;
  v_modal bigint;
  v_billing_id uuid;
begin
  -- 1. Periksa peran pemanggil
  v_peran := private.peran_saya();
  if v_peran is null then
    raise exception 'Akses ditolak: sesi tidak valid atau akun nonaktif';
  end if;

  if v_peran not in ('owner', 'kepala_mekanik') then
    raise exception 'Hanya Kepala Mekanik atau Owner yang boleh menambah item tagihan';
  end if;

  -- 2. Kunci dan periksa status serta tim WO
  select status, kepala_mekanik_id
  into v_wo_status, v_wo_tim
  from public.work_orders
  where id = p_wo
  for update;

  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  if v_peran = 'kepala_mekanik' and v_wo_tim is distinct from auth.uid() then
    raise exception 'Hanya Kepala Mekanik tim WO ini atau Owner yang boleh menambah item tagihan';
  end if;

  if v_wo_status <> 'dikerjakan' then
    raise exception 'Item tagihan hanya dapat ditambahkan saat status WO dikerjakan';
  end if;

  if p_jumlah < 1 then
    raise exception 'Jumlah item minimal 1';
  end if;

  -- 3. Kunci baris inventory_items (FOR UPDATE)
  select id, kode, jenis, nama, harga_jual, stok, aktif
  into v_item
  from public.inventory_items
  where id = p_item
  for update;

  if not found then
    raise exception 'Item inventory tidak ditemukan';
  end if;

  if not v_item.aktif then
    raise exception 'Item % sedang tidak aktif', v_item.nama;
  end if;

  -- 4. Jika spare part, periksa dan kurangi stok
  if v_item.jenis = 'part' then
    if v_item.stok < p_jumlah then
      raise exception 'Stok % hanya %', v_item.nama, v_item.stok;
    end if;

    update public.inventory_items
    set stok = stok - p_jumlah,
        updated_at = now()
    where id = p_item;

    -- Catat pergerakan stok keluar
    insert into public.stock_movements (item_id, jenis, jumlah, referensi_wo_id, dicatat_oleh)
    values (p_item, 'keluar', p_jumlah, p_wo, auth.uid());

    -- Ambil modal dari inventory_costs
    select coalesce(harga_modal, 0)
    into v_modal
    from public.inventory_costs
    where item_id = p_item;
  else
    v_modal := 0;
  end if;

  -- 5. Simpan baris billing_items
  insert into public.billing_items (
    work_order_id,
    item_id,
    nama_item,
    jenis,
    jumlah,
    harga_master,
    harga_dipakai,
    ditambah_oleh
  )
  values (
    p_wo,
    p_item,
    v_item.nama,
    v_item.jenis,
    p_jumlah,
    v_item.harga_jual,
    v_item.harga_jual,
    auth.uid()
  )
  returning id into v_billing_id;

  -- 6. Simpan billing_item_costs (rahasia modal, hanya Owner)
  insert into public.billing_item_costs (
    billing_item_id,
    harga_modal
  )
  values (
    v_billing_id,
    coalesce(v_modal, 0)
  );

  return v_billing_id;
end $$;


-- -------------------------------------------------------------
-- 2. hapus_item_tagihan
-- Dipanggil oleh: Kepala Mekanik tim WO, Owner
-- Syarat: Status WO harus 'dikerjakan'
-- Mengunci baris item (FOR UPDATE), mengembalikan stok part ('kembali'),
-- menghapus baris billing_items
-- -------------------------------------------------------------
create or replace function public.hapus_item_tagihan(
  p_billing_item uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_wo_id uuid;
  v_wo_status text;
  v_wo_tim uuid;
  v_item_id uuid;
  v_nama_item text;
  v_jenis text;
  v_jumlah int;
begin
  -- 1. Periksa peran pemanggil
  v_peran := private.peran_saya();
  if v_peran is null then
    raise exception 'Akses ditolak: sesi tidak valid atau akun nonaktif';
  end if;

  if v_peran not in ('owner', 'kepala_mekanik') then
    raise exception 'Hanya Kepala Mekanik atau Owner yang boleh menghapus item tagihan';
  end if;

  -- 2. Kunci baris billing_items
  select work_order_id, item_id, nama_item, jenis, jumlah
  into v_wo_id, v_item_id, v_nama_item, v_jenis, v_jumlah
  from public.billing_items
  where id = p_billing_item
  for update;

  if not found then
    raise exception 'Baris tagihan tidak ditemukan';
  end if;

  -- 3. Kunci dan periksa status serta tim WO
  select status, kepala_mekanik_id
  into v_wo_status, v_wo_tim
  from public.work_orders
  where id = v_wo_id
  for update;

  if v_peran = 'kepala_mekanik' and v_wo_tim is distinct from auth.uid() then
    raise exception 'Hanya Kepala Mekanik tim WO ini atau Owner yang boleh menghapus item tagihan';
  end if;

  if v_wo_status <> 'dikerjakan' then
    raise exception 'Item tagihan hanya dapat dihapus saat status WO dikerjakan';
  end if;

  -- 4. Kembalikan stok bila part, kunci inventory_items
  if v_jenis = 'part' then
    perform 1 from public.inventory_items where id = v_item_id for update;

    update public.inventory_items
    set stok = stok + v_jumlah,
        updated_at = now()
    where id = v_item_id;

    insert into public.stock_movements (item_id, jenis, jumlah, referensi_wo_id, dicatat_oleh)
    values (v_item_id, 'kembali', v_jumlah, v_wo_id, auth.uid());
  end if;

  -- 5. Hapus baris billing_items (billing_item_costs terhapus otomatis via on delete cascade)
  delete from public.billing_items where id = p_billing_item;
end $$;


-- -------------------------------------------------------------
-- 3. sesuaikan_harga_item
-- Dipanggil oleh: Admin, Owner
-- Syarat: Invoice belum terbit, alasan wajib, harga baru >= 0
-- Mengembalikan: true bila harga_baru < harga_modal (di bawah modal)
-- -------------------------------------------------------------
create or replace function public.sesuaikan_harga_item(
  p_billing_item uuid,
  p_harga bigint,
  p_alasan text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_wo_id uuid;
  v_modal bigint;
  v_ada_invoice boolean;
begin
  -- 1. Periksa peran
  v_peran := private.peran_saya();
  if v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang boleh menyesuaikan harga';
  end if;

  -- 2. Validasi harga dan alasan
  if p_harga < 0 then
    raise exception 'Harga tidak boleh negatif';
  end if;

  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'Alasan penyesuaian harga wajib diisi';
  end if;

  -- 3. Kunci baris billing_items
  select work_order_id
  into v_wo_id
  from public.billing_items
  where id = p_billing_item
  for update;

  if not found then
    raise exception 'Baris tagihan tidak ditemukan';
  end if;

  -- 4. Periksa apakah invoice sudah pernah diterbitkan
  select exists(select 1 from public.invoices where work_order_id = v_wo_id)
  into v_ada_invoice;

  if v_ada_invoice then
    raise exception 'Harga tidak dapat disesuaikan karena invoice sudah diterbitkan';
  end if;

  -- 5. Update harga dipakai dan alasan penyesuaian
  update public.billing_items
  set harga_dipakai = p_harga,
      alasan_penyesuaian = trim(p_alasan),
      disesuaikan_oleh = auth.uid(),
      disesuaikan_at = now()
  where id = p_billing_item;

  -- 6. Periksa harga modal untuk indikator peringatan ke frontend
  select coalesce(harga_modal, 0)
  into v_modal
  from public.billing_item_costs
  where billing_item_id = p_billing_item;

  return (p_harga < coalesce(v_modal, 0));
end $$;


-- -------------------------------------------------------------
-- 4. atur_diskon
-- Dipanggil oleh: Admin, Owner
-- Syarat: Invoice belum terbit, diskon >= 0, diskon <= subtotal
-- -------------------------------------------------------------
create or replace function public.atur_diskon(
  p_wo uuid,
  p_diskon bigint,
  p_alasan text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_ada_invoice boolean;
  v_subtotal bigint;
begin
  -- 1. Periksa peran
  v_peran := private.peran_saya();
  if v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang boleh mengatur diskon';
  end if;

  -- 2. Validasi diskon dan alasan
  if p_diskon < 0 then
    raise exception 'Diskon tidak boleh negatif';
  end if;

  if p_diskon > 0 and coalesce(trim(p_alasan), '') = '' then
    raise exception 'Alasan diskon wajib diisi bila nominal diskon lebih dari 0';
  end if;

  -- 3. Kunci baris work_orders
  perform 1 from public.work_orders where id = p_wo for update;
  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  -- 4. Periksa apakah invoice sudah terbit
  select exists(select 1 from public.invoices where work_order_id = p_wo)
  into v_ada_invoice;

  if v_ada_invoice then
    raise exception 'Diskon tidak dapat diubah karena invoice sudah diterbitkan';
  end if;

  -- 5. Hitung subtotal saat ini
  select coalesce(sum(jumlah * harga_dipakai), 0)
  into v_subtotal
  from public.billing_items
  where work_order_id = p_wo;

  if p_diskon > v_subtotal then
    raise exception 'Diskon (Rp %) tidak boleh melebihi subtotal tagihan (Rp %)', p_diskon, v_subtotal;
  end if;

  -- 6. Perbarui diskon pada work_orders
  update public.work_orders
  set diskon = p_diskon,
      alasan_diskon = trim(p_alasan),
      updated_at = now()
  where id = p_wo;
end $$;


-- -------------------------------------------------------------
-- 5. terbitkan_invoice
-- Dipanggil oleh: Admin, Owner
-- Syarat: Status WO harus 'siap_diambil', belum ada invoice
-- Mengunci number_counters (FOR UPDATE), membuat nomor INV-YYYYMM-0001
-- -------------------------------------------------------------
create or replace function public.terbitkan_invoice(
  p_wo uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_wo_status text;
  v_diskon bigint;
  v_subtotal bigint;
  v_total bigint;
  v_periode text;
  v_urutan int;
  v_nomor_inv text;
  v_invoice_id uuid;
begin
  -- 1. Periksa peran
  v_peran := private.peran_saya();
  if v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang boleh menerbitkan invoice';
  end if;

  -- 2. Kunci dan periksa status WO (FOR UPDATE)
  select status, diskon
  into v_wo_status, v_diskon
  from public.work_orders
  where id = p_wo
  for update;

  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  if v_wo_status <> 'siap_diambil' then
    raise exception 'Invoice hanya dapat diterbitkan saat status WO siap diambil (lulus QC)';
  end if;

  -- 3. Periksa apakah invoice sudah pernah ada
  if exists(select 1 from public.invoices where work_order_id = p_wo) then
    raise exception 'Invoice untuk Work Order ini sudah pernah diterbitkan';
  end if;

  -- 4. Hitung subtotal dari billing_items
  select coalesce(sum(jumlah * harga_dipakai), 0)
  into v_subtotal
  from public.billing_items
  where work_order_id = p_wo;

  if v_subtotal <= 0 then
    raise exception 'Tidak dapat menerbitkan invoice untuk WO tanpa baris tagihan';
  end if;

  v_diskon := coalesce(v_diskon, 0);
  if v_diskon > v_subtotal then
    v_diskon := v_subtotal;
  end if;

  v_total := v_subtotal - v_diskon;

  -- 5. Kunci dan naikkan number_counters untuk invoice
  v_periode := to_char(now(), 'YYYYMM');
  v_urutan := private.nomor_berikut('INV', v_periode);
  v_nomor_inv := 'INV-' || v_periode || '-' || lpad(v_urutan::text, 4, '0');

  -- 6. Insert baris invoice
  insert into public.invoices (
    work_order_id,
    nomor,
    subtotal,
    diskon,
    total,
    terbayar,
    status_bayar,
    diterbitkan_oleh,
    diterbitkan_at
  )
  values (
    p_wo,
    v_nomor_inv,
    v_subtotal,
    v_diskon,
    v_total,
    0,
    'belum_bayar',
    auth.uid(),
    now()
  )
  returning id into v_invoice_id;

  return v_invoice_id;
end $$;


-- -------------------------------------------------------------
-- 6. catat_pembayaran
-- Dipanggil oleh: Admin, Owner
-- Syarat: Jumlah <= sisa tagihan, metode valid
-- Kunci baris invoices (FOR UPDATE), tambah payments,
-- perbarui terbayar & status_bayar
-- -------------------------------------------------------------
create or replace function public.catat_pembayaran(
  p_invoice uuid,
  p_metode text,
  p_jumlah bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_inv record;
  v_sisa bigint;
  v_terbayar_baru bigint;
  v_status_bayar text;
begin
  -- 1. Periksa peran
  v_peran := private.peran_saya();
  if v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang boleh mencatat pembayaran';
  end if;

  -- 2. Validasi metode dan jumlah
  if p_metode not in ('tunai', 'transfer', 'qris') then
    raise exception 'Metode pembayaran tidak valid: hanya tunai, transfer, atau qris';
  end if;

  if p_jumlah <= 0 then
    raise exception 'Jumlah pembayaran harus lebih dari 0';
  end if;

  -- 3. Kunci baris invoice (FOR UPDATE)
  select id, total, terbayar, status_bayar
  into v_inv
  from public.invoices
  where id = p_invoice
  for update;

  if not found then
    raise exception 'Invoice tidak ditemukan';
  end if;

  if v_inv.status_bayar = 'lunas' then
    raise exception 'Invoice ini sudah lunas';
  end if;

  v_sisa := v_inv.total - v_inv.terbayar;
  if p_jumlah > v_sisa then
    raise exception 'Jumlah pembayaran (Rp %) melebihi sisa tagihan (Rp %)', p_jumlah, v_sisa;
  end if;

  -- 4. Catat ke tabel payments
  insert into public.payments (
    invoice_id,
    metode,
    jumlah,
    dicatat_oleh
  )
  values (
    p_invoice,
    p_metode,
    p_jumlah,
    auth.uid()
  );

  -- 5. Hitung status pembayaran baru
  v_terbayar_baru := v_inv.terbayar + p_jumlah;
  if v_terbayar_baru >= v_inv.total then
    v_status_bayar := 'lunas';
  else
    v_status_bayar := 'sebagian';
  end if;

  -- 6. Update baris invoice
  update public.invoices
  set terbayar = v_terbayar_baru,
      status_bayar = v_status_bayar
  where id = p_invoice;
end $$;


-- -------------------------------------------------------------
-- Hak Akses Eksekusi Fungsi
-- Cabut dari public dan anon, berikan ke authenticated
-- -------------------------------------------------------------
revoke all on function public.tambah_item_tagihan(uuid, uuid, int) from public, anon;
revoke all on function public.hapus_item_tagihan(uuid) from public, anon;
revoke all on function public.sesuaikan_harga_item(uuid, bigint, text) from public, anon;
revoke all on function public.atur_diskon(uuid, bigint, text) from public, anon;
revoke all on function public.terbitkan_invoice(uuid) from public, anon;
revoke all on function public.catat_pembayaran(uuid, text, bigint) from public, anon;

grant execute on function public.tambah_item_tagihan(uuid, uuid, int) to authenticated;
grant execute on function public.hapus_item_tagihan(uuid) to authenticated;
grant execute on function public.sesuaikan_harga_item(uuid, bigint, text) to authenticated;
grant execute on function public.atur_diskon(uuid, bigint, text) to authenticated;
grant execute on function public.terbitkan_invoice(uuid) to authenticated;
grant execute on function public.catat_pembayaran(uuid, text, bigint) to authenticated;
