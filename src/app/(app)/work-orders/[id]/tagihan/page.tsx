import { notFound } from "next/navigation";
import { TabWorkOrder } from "@/components/TabWorkOrder";
import { BadgeStatus } from "@/components/BadgeStatus";
import { Card } from "@/components/ui/card";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { KomponenTagihan, type ItemTagihanTipe, type InvoiceTipe, type PembayaranTipe } from "./KomponenTagihan";

export default async function TagihanWorkOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profil = await ambilProfilSaya();
  const supabase = await createClient();

  // 1. Ambil data Work Order
  const { data: wo, error: errWo } = await supabase
    .from("work_orders")
    .select(`
      id, nomor, status, diskon, alasan_diskon, estimasi_selesai, odometer, kepala_mekanik_id,
      vehicles (plat, merek_model, tahun, warna),
      customers (nama, telepon)
    `)
    .eq("id", id)
    .single();

  if (errWo || !wo) {
    notFound();
  }

  // Hak akses Kepala Mekanik: hanya boleh melihat WO timnya (PRD 2.3)
  if (profil.peran === "kepala_mekanik" && wo.kepala_mekanik_id !== profil.id) {
    return (
      <div className="space-y-6">
        <TabWorkOrder id={id} />
        <Card className="p-8 text-center text-text-muted">
          Anda tidak memiliki hak akses untuk melihat tagihan Work Order milik tim lain.
        </Card>
      </div>
    );
  }

  // 2. Ambil baris tagihan (billing_items)
  const { data: billingData } = await supabase
    .from("billing_items")
    .select(`
      id, item_id, nama_item, jenis, jumlah, harga_master, harga_dipakai,
      alasan_penyesuaian, disesuaikan_at, disesuaikan_oleh, ditambah_oleh,
      disesuaikan_profil:profiles!billing_items_disesuaikan_oleh_fkey (nama)
    `)
    .eq("work_order_id", id)
    .order("created_at", { ascending: true });

  // 3. Ambil daftar inventory (part & jasa yang aktif) untuk penambahan item oleh Kepala Mekanik / Owner
  const { data: inventoryData } = await supabase
    .from("inventory_items")
    .select("id, kode, jenis, nama, harga_jual, stok")
    .eq("aktif", true)
    .order("nama", { ascending: true });

  // 3. Jika peran Owner, ambil harga modal dari billing_item_costs (PRD 2.4)
  let modalMap: Record<string, number> = {};
  if (profil.peran === "owner" && billingData && billingData.length > 0) {
    const itemIds = billingData.map((b) => b.id);
    const { data: modalData } = await supabase
      .from("billing_item_costs")
      .select("billing_item_id, harga_modal")
      .in("billing_item_id", itemIds);

    if (modalData) {
      modalMap = Object.fromEntries(modalData.map((m) => [m.billing_item_id, m.harga_modal]));
    }
  }

  // Gabungkan modal ke items bila Owner
  const items: ItemTagihanTipe[] = (billingData ?? []).map((b) => ({
    id: b.id,
    item_id: b.item_id,
    nama_item: b.nama_item,
    jenis: b.jenis,
    jumlah: b.jumlah,
    harga_master: b.harga_master,
    harga_dipakai: b.harga_dipakai,
    alasan_penyesuaian: b.alasan_penyesuaian,
    disesuaikan_at: b.disesuaikan_at,
    disesuaikan_oleh: b.disesuaikan_oleh,
    ditambah_oleh: b.ditambah_oleh,
    disesuaikan_profil: b.disesuaikan_profil as { nama: string } | null,
    harga_modal: profil.peran === "owner" ? (modalMap[b.id] ?? 0) : undefined,
  }));

  // 4. Ambil Invoice jika sudah pernah diterbitkan
  const { data: invData } = await supabase
    .from("invoices")
    .select(`
      id, nomor, subtotal, diskon, total, terbayar, status_bayar, diterbitkan_at, diterbitkan_oleh,
      diterbitkan_profil:profiles!invoices_diterbitkan_oleh_fkey (nama)
    `)
    .eq("work_order_id", id)
    .maybeSingle();

  const invoice: InvoiceTipe | null = invData
    ? {
        id: invData.id,
        nomor: invData.nomor,
        subtotal: invData.subtotal,
        diskon: invData.diskon,
        total: invData.total,
        terbayar: invData.terbayar,
        status_bayar: invData.status_bayar,
        diterbitkan_at: invData.diterbitkan_at,
        diterbitkan_oleh: invData.diterbitkan_oleh,
        diterbitkan_profil: invData.diterbitkan_profil as { nama: string } | null,
      }
    : null;

  // 5. Ambil data pembayaran jika invoice sudah ada
  let pembayaran: PembayaranTipe[] = [];
  if (invoice) {
    const { data: bayarData } = await supabase
      .from("payments")
      .select(`
        id, metode, jumlah, created_at, dicatat_oleh,
        dicatat_profil:profiles!payments_dicatat_oleh_fkey (nama)
      `)
      .eq("invoice_id", invoice.id)
      .order("created_at", { ascending: true });

    if (bayarData) {
      pembayaran = bayarData.map((p) => ({
        id: p.id,
        metode: p.metode,
        jumlah: p.jumlah,
        created_at: p.created_at,
        dicatat_oleh: p.dicatat_oleh,
        dicatat_profil: p.dicatat_profil as { nama: string } | null,
      }));
    }
  }

  const kendaraan = Array.isArray(wo.vehicles) ? wo.vehicles[0] : wo.vehicles;
  const pelanggan = Array.isArray(wo.customers) ? wo.customers[0] : wo.customers;

  return (
    <div className="space-y-6">
      {/* Header Halaman & Navigasi Tab */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text">Work Order {wo.nomor}</h1>
            <BadgeStatus status={wo.status} />
          </div>
          <p className="text-sm text-text-muted mt-1">
            {pelanggan?.nama} · {kendaraan?.plat} ({kendaraan?.merek_model})
          </p>
        </div>

        <TabWorkOrder id={id} />
      </div>

      {/* Komponen Interaktif Tagihan */}
      <KomponenTagihan
        woId={id}
        woNomor={wo.nomor}
        woStatus={wo.status}
        diskonAwal={wo.diskon}
        alasanDiskonAwal={wo.alasan_diskon}
        peran={profil.peran}
        items={items}
        invoice={invoice}
        pembayaran={pembayaran}
        daftarInventory={inventoryData ?? []}
      />
    </div>
  );
}
