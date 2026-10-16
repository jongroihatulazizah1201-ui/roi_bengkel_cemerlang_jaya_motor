import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  Percent,
  Wrench,
  AlertTriangle,
  Receipt,
  Car,
  CheckCircle,
  FileText,
  Clock,
  Plus,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { rupiah } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { PenyaringPeriode, type OpsiPeriode } from "./PenyaringPeriode";
import { KartuKPI } from "./KartuKPI";
import { GrafikAreaTren, type DataTrenHarian } from "./GrafikAreaTren";
import { GrafikDonutStatus, type DataStatusWO } from "./GrafikDonutStatus";
import { GrafikBatangBeban, type DataBebanMekanik } from "./GrafikBatangBeban";
import { GrafikTopItem, type DataTopItem } from "./GrafikTopItem";

function hitungPerubahan(sekarang: number, sebelumnya: number): number | null {
  if (!sebelumnya || sebelumnya === 0) {
    return sekarang > 0 ? 100 : null;
  }
  return ((sekarang - sebelumnya) / sebelumnya) * 100;
}

export default async function HalamanDashboard({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const profil = await ambilProfilSaya();
  const { periode: queryPeriode } = await searchParams;

  const periodeAktif: OpsiPeriode =
    queryPeriode === "hari-ini" || queryPeriode === "7-hari" || queryPeriode === "bulan-ini"
      ? queryPeriode
      : "30-hari";

  // Hitung rentang tanggal p_dari dan p_sampai
  const sekarang = new Date();
  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dt = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dt}`;
  };

  const hariIniStr = formatYMD(sekarang);
  let p_dari = hariIniStr;
  const p_sampai = hariIniStr;

  if (periodeAktif === "hari-ini") {
    p_dari = hariIniStr;
  } else if (periodeAktif === "7-hari") {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    p_dari = formatYMD(d);
  } else if (periodeAktif === "30-hari") {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    p_dari = formatYMD(d);
  } else {
    // bulan-ini
    p_dari = `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, "0")}-01`;
  }

  const supabase = await createClient();

  // Panggil RPC secara paralel
  const [resRingkasan, resStatus, resTren, resBeban, resTopItem] = await Promise.allSettled([
    supabase.rpc("dashboard_ringkasan", { p_dari, p_sampai }),
    supabase.rpc("dashboard_wo_per_status", { p_tim: null }),
    profil.peran === "owner"
      ? supabase.rpc("dashboard_laba_harian", { p_dari, p_sampai })
      : supabase.rpc("dashboard_pendapatan_harian", { p_dari, p_sampai }),
    supabase.rpc("dashboard_beban_mekanik", {
      p_dari,
      p_sampai,
      p_tim: profil.peran === "kepala_mekanik" ? profil.id : null,
    }),
    supabase.rpc("dashboard_top_item", { p_dari, p_sampai, p_jenis: "part" }),
  ]);

  const ringkasanRaw = resRingkasan.status === "fulfilled" ? resRingkasan.value.data : null;
  const ringkasan = (typeof ringkasanRaw === "object" && ringkasanRaw !== null
    ? ringkasanRaw
    : {}) as Record<string, number>;

  const dataStatus = (resStatus.status === "fulfilled" ? resStatus.value.data : []) as DataStatusWO[];
  const dataTren = (resTren.status === "fulfilled" ? resTren.value.data : []) as DataTrenHarian[];
  const dataBeban = (resBeban.status === "fulfilled" ? resBeban.value.data : []) as DataBebanMekanik[];
  const dataTopItem = (resTopItem.status === "fulfilled" ? resTopItem.value.data : []) as DataTopItem[];

  const peran = profil.peran;

  return (
    <div className="space-y-6">
      {/* Baris Atas: Salam & Penyaring Periode (PRD 12.1) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Dashboard {profil.peran === "owner" ? "Owner" : profil.peran === "admin" ? "Admin" : "Kepala Mekanik"}</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Selamat datang kembali, <strong className="text-text">{profil.nama}</strong>. Berikut ringkasan operasional bengkel.
          </p>
        </div>

        <PenyaringPeriode aktif={periodeAktif} />
      </div>

      {/* Aksi Cepat untuk Admin (PRD 12.3) */}
      {peran === "admin" && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
          <div className="flex items-center gap-2">
            <Car className="size-5 text-primary" />
            <span className="text-sm font-medium text-text">Ada mobil pelanggan baru yang datang?</span>
          </div>
          <Button asChild size="sm" className="gap-1.5 shadow-xs">
            <Link href="/work-orders/baru">
              <Plus className="size-4" />
              <span>Buat Work Order Baru</span>
            </Link>
          </Button>
        </div>
      )}

      {/* ========================================================
          1. KARTU KPI OWNER (PRD 12.2: 6 Kartu)
      ======================================================== */}
      {peran === "owner" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KartuKPI
            label="Total Pendapatan"
            nilai={rupiah(ringkasan.pendapatan || 0)}
            persenPerubahan={hitungPerubahan(ringkasan.pendapatan || 0, ringkasan.pendapatan_sebelumnya || 0)}
            subtext="vs periode lalu"
            ikon={DollarSign}
            warnaIkon="bg-blue-500/10 text-blue-600"
            href="/laporan-laba"
          />
          <KartuKPI
            label="Laba Kotor"
            nilai={rupiah(ringkasan.laba || 0)}
            persenPerubahan={hitungPerubahan(ringkasan.laba || 0, ringkasan.laba_sebelumnya || 0)}
            subtext="vs periode lalu"
            ikon={TrendingUp}
            warnaIkon="bg-emerald-500/10 text-emerald-600"
            href="/laporan-laba"
          />
          <KartuKPI
            label="Margin Laba"
            nilai={
              ringkasan.pendapatan && ringkasan.pendapatan > 0
                ? `${Math.round(((ringkasan.laba || 0) / ringkasan.pendapatan) * 100)}%`
                : "0%"
            }
            subtext="Laba / Pendapatan"
            ikon={Percent}
            warnaIkon="bg-purple-500/10 text-purple-600"
          />
          <KartuKPI
            label="WO Sedang Aktif"
            nilai={`${ringkasan.wo_aktif || 0} WO`}
            subtext="Menunggu s/d Selesai"
            ikon={Wrench}
            warnaIkon="bg-amber-500/10 text-amber-600"
            href="/work-orders"
          />
          <KartuKPI
            label="WO Terlambat"
            nilai={`${ringkasan.wo_terlambat || 0} WO`}
            subtext="Lewat estimasi"
            ikon={AlertTriangle}
            warnaIkon="bg-red-500/10 text-red-600"
            peringatan={Boolean(ringkasan.wo_terlambat && ringkasan.wo_terlambat > 0)}
            href="/work-orders"
          />
          <KartuKPI
            label="Piutang Belum Lunas"
            nilai={rupiah(ringkasan.piutang || 0)}
            subtext="Invoice pending"
            ikon={Receipt}
            warnaIkon="bg-rose-500/10 text-rose-600"
          />
        </div>
      )}

      {/* ========================================================
          2. KARTU KPI ADMIN (PRD 12.3: 4 Kartu)
      ======================================================== */}
      {peran === "admin" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KartuKPI
            label="Mobil Masuk Hari Ini"
            nilai={`${ringkasan.masuk_hari_ini || 0} Mobil`}
            persenPerubahan={hitungPerubahan(ringkasan.masuk_hari_ini || 0, ringkasan.masuk_sebelumnya || 0)}
            subtext="vs kemarin"
            ikon={Car}
            warnaIkon="bg-blue-500/10 text-blue-600"
            href="/work-orders"
          />
          <KartuKPI
            label="Siap Diambil"
            nilai={`${ringkasan.siap_diambil || 0} Mobil`}
            subtext="Lulus QC, siap serah"
            ikon={CheckCircle}
            warnaIkon="bg-emerald-500/10 text-emerald-600"
            href="/work-orders"
          />
          <KartuKPI
            label="Perlu Ditagih"
            nilai={`${ringkasan.perlu_ditagih || 0} WO`}
            subtext="Belum lunas / invoice"
            ikon={FileText}
            warnaIkon="bg-amber-500/10 text-amber-600"
            href="/work-orders"
          />
          <KartuKPI
            label="Pendapatan Hari Ini"
            nilai={rupiah(ringkasan.pendapatan_hari_ini || 0)}
            persenPerubahan={hitungPerubahan(ringkasan.pendapatan_hari_ini || 0, ringkasan.pendapatan_sebelumnya || 0)}
            subtext="vs kemarin"
            ikon={DollarSign}
            warnaIkon="bg-purple-500/10 text-purple-600"
          />
        </div>
      )}

      {/* ========================================================
          3. KARTU KPI KEPALA MEKANIK (PRD 12.4: 4 Kartu)
      ======================================================== */}
      {peran === "kepala_mekanik" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KartuKPI
            label="Menunggu Ditugaskan"
            nilai={`${ringkasan.menunggu_ditugaskan || 0} WO`}
            subtext="Perlu tunjuk mekanik"
            ikon={Clock}
            warnaIkon="bg-blue-500/10 text-blue-600"
            href="/work-orders"
          />
          <KartuKPI
            label="Sedang Dikerjakan"
            nilai={`${ringkasan.sedang_dikerjakan || 0} WO`}
            subtext="Dalam pengerjaan tim"
            ikon={Wrench}
            warnaIkon="bg-amber-500/10 text-amber-600"
            href="/work-orders"
          />
          <KartuKPI
            label="Menunggu QC"
            nilai={`${ringkasan.menunggu_qc || 0} WO`}
            subtext="Selesai pengerjaan"
            ikon={CheckCircle}
            warnaIkon="bg-purple-500/10 text-purple-600"
            href="/work-orders"
          />
          <KartuKPI
            label="WO Terlambat"
            nilai={`${ringkasan.terlambat || 0} WO`}
            subtext="Melewati target selesai"
            ikon={AlertTriangle}
            warnaIkon="bg-red-500/10 text-red-600"
            peringatan={Boolean(ringkasan.terlambat && ringkasan.terlambat > 0)}
            href="/work-orders"
          />
        </div>
      )}

      {/* ========================================================
          BAGIAN GRAFIK RECHARTS (PRD 12: Grid Responsif)
      ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grafik 1: Tren Harian Area Chart (2 Kolom di Layar Lebar) */}
        <div className="lg:col-span-2">
          <GrafikAreaTren data={dataTren} peran={peran} />
        </div>

        {/* Grafik 2: Donut Chart Status Work Order (1 Kolom) */}
        <div>
          <GrafikDonutStatus data={dataStatus} />
        </div>
      </div>

      {/* Baris Grafik Kedua: Beban Mekanik & Top 5 Item */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Beban Mekanik (Owner & Kepala Mekanik) */}
        {peran !== "admin" && (
          <GrafikBatangBeban data={dataBeban} />
        )}

        {/* Top 5 Item Terlaris (Owner & Admin) */}
        {peran !== "kepala_mekanik" && (
          <GrafikTopItem items={dataTopItem} />
        )}
      </div>
    </div>
  );
}
