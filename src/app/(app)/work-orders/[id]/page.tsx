import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TabWorkOrder } from "@/components/TabWorkOrder";
import { Button } from "@/components/ui/button";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { HeaderAksiStatus } from "./HeaderAksiStatus";
import { BagianDataMasuk } from "./BagianDataMasuk";
import { BagianPenugasan } from "./BagianPenugasan";
import { BagianPengerjaan } from "./BagianPengerjaan";
import { RiwayatStatus } from "./RiwayatStatus";

export default async function RincianWorkOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profil = await ambilProfilSaya();
  const supabase = await createClient();

  // 1. Ambil data Work Order lengkap
  const { data: wo, error } = await supabase
    .from("work_orders")
    .select(`
      id,
      nomor,
      odometer,
      keluhan,
      diagnosis,
      status,
      estimasi_selesai,
      catatan_status,
      selesai_at,
      diambil_at,
      created_at,
      kepala_mekanik_id,
      vehicles(plat, merek_model, tahun, warna, transmisi),
      customers(id, nama, telepon, email, alamat, tipe),
      profiles!work_orders_kepala_mekanik_id_fkey(nama),
      work_order_mekanik(mekanik(id, nama)),
      work_order_photos(id, jenis, path),
      invoices(id, status_bayar, total)
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !wo) {
    notFound();
  }

  // 2. Buat signed URLs untuk foto di bucket privat 'foto-wo' (PRD 11.3 & 11.4)
  const photos = wo.work_order_photos || [];
  const pathsUtama = photos.map((p) => p.path);
  const pathsThumb = photos.map((p) =>
    p.path.replace(/\/(stnk|kondisi_awal|kondisi_akhir|pengerjaan)\//, "/$1/thumb/"),
  );

  const semuaPaths = [...pathsUtama, ...pathsThumb];
  const signedUrlsMap: Record<string, string> = {};

  if (semuaPaths.length > 0) {
    const { data: signedData } = await supabase.storage
      .from("foto-wo")
      .createSignedUrls(semuaPaths, 600); // 10 menit

    signedData?.forEach((item) => {
      if (item.signedUrl && item.path) {
        signedUrlsMap[item.path] = item.signedUrl;
      }
    });
  }

  // Format list foto dengan signed URLs & thumbnails
  const daftarFoto = photos.map((p) => {
    const thumbPath = p.path.replace(/\/(stnk|kondisi_awal|kondisi_akhir|pengerjaan)\//, "/$1/thumb/");
    return {
      id: p.id,
      jenis: p.jenis,
      url: signedUrlsMap[p.path] || "",
      thumbUrl: signedUrlsMap[thumbPath] || signedUrlsMap[p.path] || "",
    };
  });

  const fotoStnk = daftarFoto.filter((f) => f.jenis === "stnk");
  const fotoKondisiAwal = daftarFoto.filter((f) => f.jenis === "kondisi_awal");
  const fotoKondisiAkhir = daftarFoto.filter((f) => f.jenis === "kondisi_akhir");
  const fotoPengerjaan = daftarFoto.filter((f) => f.jenis === "pengerjaan");

  // 3. Ambil daftar mekanik aktif dari tim Kepala Mekanik ini
  const { data: mekanikTim } = await supabase
    .from("mekanik")
    .select("id, nama")
    .eq("kepala_mekanik_id", wo.kepala_mekanik_id)
    .eq("aktif", true)
    .order("nama");

  // Hitung beban aktif masing-masing mekanik
  const { data: mekanikAktifData } = await supabase
    .from("work_order_mekanik")
    .select("mekanik_id, work_orders!inner(status)")
    .in("work_orders.status", ["menunggu", "dikerjakan", "tertunda"]);

  const bebanMekanik: Record<string, number> = {};
  mekanikAktifData?.forEach((m) => {
    bebanMekanik[m.mekanik_id] = (bebanMekanik[m.mekanik_id] ?? 0) + 1;
  });

  const daftarMekanikTerurut = (mekanikTim ?? [])
    .map((m) => ({
      id: m.id,
      nama: m.nama,
      woAktif: bebanMekanik[m.id] ?? 0,
    }))
    .sort((a, b) => a.woAktif - b.woAktif); // Urut dari beban paling ringan (PRD 6.8 Bagian B)

  // 4. Ambil daftar kepala mekanik (untuk opsi pindah tim)
  const { data: kepalaMekanikList } = await supabase
    .from("profiles")
    .select("id, nama")
    .eq("role", "kepala_mekanik")
    .eq("aktif", true)
    .order("nama");

  // 5. Ambil data baris tagihan / billing items
  const { data: billingItemsData } = await supabase
    .from("billing_items")
    .select("id, nama_item, jenis, jumlah, harga_master, harga_dipakai")
    .eq("work_order_id", id)
    .order("created_at", { ascending: true });

  const billingItems = billingItemsData || [];

  // 6. Ambil master inventory (part & jasa) untuk penambahan di Bagian C
  const { data: partsData } = await supabase
    .from("inventory_items")
    .select("id, nama, kode, stok, harga_jual")
    .eq("jenis", "part")
    .eq("aktif", true)
    .order("nama");

  const { data: jasaData } = await supabase
    .from("inventory_items")
    .select("id, nama, kode, harga_jual")
    .eq("jenis", "jasa")
    .eq("aktif", true)
    .order("nama");

  // 7. Ambil riwayat status WO
  const { data: historyData } = await supabase
    .from("wo_status_history")
    .select("id, dari_status, ke_status, catatan, created_at, profiles(nama)")
    .eq("work_order_id", id)
    .order("created_at", { ascending: false });

  // Status invoice & foto akhir
  const invoice = Array.isArray(wo.invoices) ? wo.invoices[0] : wo.invoices;
  const invoiceLunas = invoice?.status_bayar === "lunas";
  const adaFotoAkhir = fotoKondisiAkhir.length > 0;
  const adaMekanik = (wo.work_order_mekanik?.length || 0) > 0;
  const adaTagihan = billingItems.length > 0;

  const vehicleObj = Array.isArray(wo.vehicles) ? wo.vehicles[0] ?? null : wo.vehicles;
  const customerObj = Array.isArray(wo.customers) ? wo.customers[0] ?? null : wo.customers;
  const kepalaObj = Array.isArray(wo.profiles) ? wo.profiles[0] ?? null : wo.profiles;
  const mekanikList = (wo.work_order_mekanik || []).map((m) => ({
    mekanik: Array.isArray(m.mekanik) ? m.mekanik[0] ?? null : m.mekanik,
  }));

  const riwayatStatus = (historyData || []).map((h) => ({
    id: h.id,
    dari_status: h.dari_status,
    ke_status: h.ke_status,
    catatan: h.catatan,
    created_at: h.created_at,
    profiles: Array.isArray(h.profiles) ? h.profiles[0] ?? null : h.profiles,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Tombol Kembali & Tab Navigasi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon">
            <Link href="/work-orders" aria-label="Kembali ke daftar work order">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <TabWorkOrder id={id} />
        </div>
      </div>

      {/* Header Aksi Status */}
      <HeaderAksiStatus
        wo={{
          id: wo.id,
          nomor: wo.nomor,
          status: wo.status,
          kepala_mekanik_id: wo.kepala_mekanik_id,
          estimasi_selesai: wo.estimasi_selesai,
        }}
        profil={profil}
        adaMekanik={adaMekanik}
        adaTagihan={adaTagihan}
        invoiceLunas={invoiceLunas}
        adaFotoAkhir={adaFotoAkhir}
      />

      {/* Bagian A. Data Masuk */}
      <BagianDataMasuk
        wo={{
          id: wo.id,
          status: wo.status,
          odometer: wo.odometer,
          keluhan: wo.keluhan,
          diagnosis: wo.diagnosis,
          kepala_mekanik_id: wo.kepala_mekanik_id,
          vehicles: vehicleObj,
          customers: customerObj,
        }}
        profil={profil}
        fotoStnk={fotoStnk}
        fotoKondisiAwal={fotoKondisiAwal}
        fotoKondisiAkhir={fotoKondisiAkhir}
      />

      {/* Bagian B. Penugasan */}
      <BagianPenugasan
        wo={{
          id: wo.id,
          status: wo.status,
          kepala_mekanik_id: wo.kepala_mekanik_id,
          estimasi_selesai: wo.estimasi_selesai,
          profiles: kepalaObj,
          work_order_mekanik: mekanikList,
        }}
        profil={profil}
        daftarMekanikTim={daftarMekanikTerurut}
        daftarKepalaMekanik={kepalaMekanikList || []}
      />

      {/* Bagian C. Pengerjaan */}
      <BagianPengerjaan
        wo={{
          id: wo.id,
          status: wo.status,
          kepala_mekanik_id: wo.kepala_mekanik_id,
        }}
        profil={profil}
        billingItems={billingItems}
        daftarPart={partsData || []}
        daftarJasa={jasaData || []}
        fotoPengerjaan={fotoPengerjaan}
      />

      {/* Linimasa Riwayat Status */}
      <RiwayatStatus history={riwayatStatus} />
    </div>
  );
}
