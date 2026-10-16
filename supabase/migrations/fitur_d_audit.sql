-- ============================================================================
-- FITUR D: TRIGGER CATAT_AUDIT & PROTEKSI AUDIT_LOGS (PRD 9.4 & 10.2)
-- ============================================================================

-- 1. Proteksi audit_logs: tidak dapat diubah atau dihapus oleh siapa pun
create or replace function public.jaga_audit_logs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Tabel audit_logs bersifat append-only: data tidak dapat diubah atau dihapus';
end;
$$;

drop trigger if exists trg_jaga_audit_logs on public.audit_logs;
create trigger trg_jaga_audit_logs
before update or delete or truncate on public.audit_logs
for each statement execute function public.jaga_audit_logs();

-- Cabut seluruh izin perubahan langsung dari peran umum
revoke update, delete, truncate on public.audit_logs from public, anon, authenticated;

-- 2. Fungsi trigger pencatat audit ke tabel audit_logs
create or replace function public.catat_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pelaku_id uuid := auth.uid();
  v_pelaku_peran text;
  v_data_id text;
  v_sebelum jsonb;
  v_sesudah jsonb;
  v_alasan text;
begin
  -- Ambil peran pelaku saat kejadian
  begin
    v_pelaku_peran := private.peran_saya();
  exception when others then
    v_pelaku_peran := null;
  end;

  -- Rekam data sebelum (UPDATE/DELETE) dan sesudah (INSERT/UPDATE)
  if tg_op in ('UPDATE', 'DELETE') then
    v_sebelum := to_jsonb(OLD);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    v_sesudah := to_jsonb(NEW);
  end if;

  -- Ambil identitas data (nomor jika ada, atau id/item_id/billing_item_id)
  v_data_id := coalesce(
    v_sesudah->>'nomor',
    v_sebelum->>'nomor',
    v_sesudah->>'id',
    v_sebelum->>'id',
    v_sesudah->>'item_id',
    v_sebelum->>'item_id',
    v_sesudah->>'billing_item_id',
    v_sebelum->>'billing_item_id'
  );

  -- Ambil alasan bila ada pada kolom tabel (alasan_penyesuaian, alasan, atau keterangan)
  v_alasan := coalesce(
    v_sesudah->>'alasan_penyesuaian',
    v_sesudah->>'alasan',
    v_sesudah->>'keterangan',
    v_sebelum->>'alasan_penyesuaian',
    v_sebelum->>'alasan',
    v_sebelum->>'keterangan'
  );

  -- Tulis log audit
  insert into public.audit_logs (
    waktu,
    pelaku_id,
    pelaku_peran,
    aksi,
    tabel,
    data_id,
    sebelum,
    sesudah,
    alasan
  ) values (
    now(),
    v_pelaku_id,
    v_pelaku_peran,
    tg_op,
    tg_table_name,
    v_data_id,
    v_sebelum,
    v_sesudah,
    v_alasan
  );

  if tg_op = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

-- 3. Pasang trigger ke 9 tabel sesuai PRD Bab 9.4
drop trigger if exists trg_audit_work_orders on public.work_orders;
create trigger trg_audit_work_orders
after insert or update or delete on public.work_orders
for each row execute function public.catat_audit();

drop trigger if exists trg_audit_billing_items on public.billing_items;
create trigger trg_audit_billing_items
after insert or update or delete on public.billing_items
for each row execute function public.catat_audit();

drop trigger if exists trg_audit_billing_item_costs on public.billing_item_costs;
create trigger trg_audit_billing_item_costs
after insert or update or delete on public.billing_item_costs
for each row execute function public.catat_audit();

drop trigger if exists trg_audit_inventory_items on public.inventory_items;
create trigger trg_audit_inventory_items
after insert or update or delete on public.inventory_items
for each row execute function public.catat_audit();

drop trigger if exists trg_audit_inventory_costs on public.inventory_costs;
create trigger trg_audit_inventory_costs
after insert or update or delete on public.inventory_costs
for each row execute function public.catat_audit();

drop trigger if exists trg_audit_invoices on public.invoices;
create trigger trg_audit_invoices
after insert or update or delete on public.invoices
for each row execute function public.catat_audit();

drop trigger if exists trg_audit_payments on public.payments;
create trigger trg_audit_payments
after insert or update or delete on public.payments
for each row execute function public.catat_audit();

drop trigger if exists trg_audit_stock_movements on public.stock_movements;
create trigger trg_audit_stock_movements
after insert or update or delete on public.stock_movements
for each row execute function public.catat_audit();

drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles
after insert or update or delete on public.profiles
for each row execute function public.catat_audit();
