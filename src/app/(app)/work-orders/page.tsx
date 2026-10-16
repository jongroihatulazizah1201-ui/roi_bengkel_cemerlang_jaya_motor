import Link from "next/link";
import { Plus, Search, AlertCircle, Filter } from "lucide-react";
import { BadgeStatus } from "@/components/BadgeStatus";
import { Paginasi } from "@/components/Paginasi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rupiah, tanggal } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";

const PER_HALAMAN = 20;

const DAFTAR_STATUS = [
  { kode: "semua", label: "Semua" },
  { kode: "menunggu", label: "Menunggu" },
  { kode: "dikerjakan", label: "Dikerjakan" },
  { kode: "tertunda", label: "Tertunda" },
  { kode: "selesai", label: "Selesai" },
  { kode: "siap_diambil", label: "Siap Diambil" },
  { kode: "diambil", label: "Diambil" },
  { kode: "dibatalkan", label: "Dibatalkan" },
] as const;

interface WorkOrderListItem {
  id: string;
  nomor: string;
  status: string;
  odometer: number;
  estimasi_selesai: string | null;
  created_at: string;
  kepala_mekanik_id: string;
  vehicles: { plat: string; merek_model: string } | null;
  customers: { nama: string } | null;
  profiles: { nama: string } | null;
  invoices: { total: number } | { total: number }[] | null;
}

export default async function HalamanWorkOrders({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    tim?: string;
    dari?: string;
    sampai?: string;
    hal?: string;
  }>;
}) {
  const params = await searchParams;
  const profil = await ambilProfilSaya();
  const supabase = await createClient();

  // Kepala mekanik default ke timnya sendiri jika tidak ada query param tim
  const timTerpilih = params.tim ?? (profil.peran === "kepala_mekanik" ? profil.id : "semua");
  const statusTerpilih = params.status ?? "semua";
  const q = params.q?.trim() ?? "";
  const dari = params.dari ?? "";
  const sampai = params.sampai ?? "";
  const halaman = Math.max(1, Number(params.hal) || 1);

  // Ambil daftar kepala mekanik untuk filter
  const { data: daftarTim } = await supabase
    .from("profiles")
    .select("id, nama")
    .eq("role", "kepala_mekanik")
    .eq("aktif", true)
    .order("nama");

  // Hitung jumlah WO per status untuk tab (memperhatikan filter tim jika ada)
  let kueriHitung = supabase.from("work_orders").select("status");
  if (timTerpilih && timTerpilih !== "semua") {
    kueriHitung = kueriHitung.eq("kepala_mekanik_id", timTerpilih);
  }
  const { data: semuaStatus } = await kueriHitung;

  const jumlahPerStatus: Record<string, number> = {
    semua: semuaStatus?.length ?? 0,
    menunggu: 0,
    dikerjakan: 0,
    tertunda: 0,
    selesai: 0,
    siap_diambil: 0,
    diambil: 0,
    dibatalkan: 0,
  };

  semuaStatus?.forEach((item) => {
    if (item.status in jumlahPerStatus) {
      jumlahPerStatus[item.status]++;
    }
  });

  // Query data tabel work order
  let kueri = supabase.from("work_orders").select(
    `
      id,
      nomor,
      status,
      odometer,
      estimasi_selesai,
      created_at,
      kepala_mekanik_id,
      vehicles(plat, merek_model),
      customers(nama),
      profiles!work_orders_kepala_mekanik_id_fkey(nama),
      invoices(total)
    `,
    { count: "exact" },
  );

  // Filter status
  if (statusTerpilih && statusTerpilih !== "semua") {
    kueri = kueri.eq("status", statusTerpilih);
  }

  // Filter tim
  if (timTerpilih && timTerpilih !== "semua") {
    kueri = kueri.eq("kepala_mekanik_id", timTerpilih);
  }

  // Filter tanggal
  if (dari) {
    kueri = kueri.gte("created_at", `${dari}T00:00:00Z`);
  }
  if (sampai) {
    kueri = kueri.lte("created_at", `${sampai}T23:59:59Z`);
  }

  // Pencarian (nomor WO, plat kendaraan, nama pelanggan)
  if (q) {
    const cariAman = q.replace(/[,()*%\\]/g, " ").trim();
    const { data: cocokPlat } = await supabase
      .from("vehicles")
      .select("id")
      .ilike("plat", `%${cariAman}%`)
      .limit(30);

    const { data: cocokPelanggan } = await supabase
      .from("customers")
      .select("id")
      .ilike("nama", `%${cariAman}%`)
      .limit(30);

    const syarat = [`nomor.ilike.%${cariAman}%`];
    const vIds = cocokPlat?.map((v) => v.id) ?? [];
    const cIds = cocokPelanggan?.map((c) => c.id) ?? [];

    if (vIds.length) syarat.push(`vehicle_id.in.(${vIds.join(",")})`);
    if (cIds.length) syarat.push(`customer_id.in.(${cIds.join(",")})`);

    kueri = kueri.or(syarat.join(","));
  }

  const { data: daftarWO, count, error } = await kueri
    .order("created_at", { ascending: false })
    .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

  const hariIni = new Date().toISOString().split("T")[0];
  const bolehBuat = profil.peran === "admin" || profil.peran === "owner";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Work Order</h1>
          <p className="text-sm text-text-muted">
            Daftar penanganan kendaraan pelanggan dari masuk hingga selesai diserahkan
          </p>
        </div>
        {bolehBuat && (
          <Button asChild className="bg-primary hover:bg-primary-strong">
            <Link href="/work-orders/baru">
              <Plus className="mr-1.5 size-4" />
              Work Order Baru
            </Link>
          </Button>
        )}
      </div>

      {/* Tab Status */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {DAFTAR_STATUS.map((st) => {
          const aktif = statusTerpilih === st.kode;
          const paramsBaru = new URLSearchParams();
          if (st.kode !== "semua") paramsBaru.set("status", st.kode);
          if (timTerpilih && timTerpilih !== "semua") paramsBaru.set("tim", timTerpilih);
          if (q) paramsBaru.set("q", q);
          if (dari) paramsBaru.set("dari", dari);
          if (sampai) paramsBaru.set("sampai", sampai);

          return (
            <Link
              key={st.kode}
              href={`/work-orders?${paramsBaru.toString()}`}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                aktif
                  ? "bg-primary-soft text-primary-strong"
                  : "text-text-body hover:bg-muted hover:text-text"
              }`}
            >
              <span>{st.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  aktif ? "bg-card text-primary-strong shadow-xs" : "bg-muted text-text-muted"
                }`}
              >
                {jumlahPerStatus[st.kode] ?? 0}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Filter Form */}
      <form method="GET" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statusTerpilih !== "semua" && (
          <input type="hidden" name="status" value={statusTerpilih} />
        )}

        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-text-muted" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="No WO, plat, nama pelanggan..."
            className="pl-9"
          />
        </div>

        <div>
          <select
            name="tim"
            defaultValue={timTerpilih}
            className="h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="semua">Semua Tim Mekanik</option>
            {daftarTim?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nama} {profil.id === t.id ? "(Tim Saya)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            name="dari"
            defaultValue={dari}
            aria-label="Dari tanggal"
            className="w-full"
          />
          <span className="text-text-muted">-</span>
          <Input
            type="date"
            name="sampai"
            defaultValue={sampai}
            aria-label="Sampai tanggal"
            className="w-full"
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" variant="secondary" className="w-full">
            <Filter className="mr-1.5 size-4" />
            Terapkan Filter
          </Button>
          {(q || (timTerpilih && timTerpilih !== "semua" && profil.peran !== "kepala_mekanik") || dari || sampai) && (
            <Button asChild variant="ghost" className="shrink-0 text-text-muted">
              <Link href={`/work-orders${statusTerpilih !== "semua" ? `?status=${statusTerpilih}` : ""}`}>
                Reset
              </Link>
            </Button>
          )}
        </div>
      </form>

      {/* Tabel Work Orders */}
      <Card className="overflow-hidden border border-border bg-card p-0 shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="pl-4 font-semibold">No WO</TableHead>
              <TableHead className="font-semibold">Plat & Kendaraan</TableHead>
              <TableHead className="font-semibold">Pelanggan</TableHead>
              <TableHead className="font-semibold">Tim</TableHead>
              <TableHead className="font-semibold">Estimasi Selesai</TableHead>
              <TableHead className="text-right font-semibold">Total</TableHead>
              <TableHead className="pr-4 text-center font-semibold">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-danger">
                  Gagal memuat data work order. Silakan muat ulang halaman.
                </TableCell>
              </TableRow>
            )}

            {!error && daftarWO?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-text-muted">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="size-8 text-text-muted" />
                    <p className="font-medium">Tidak ada Work Order yang sesuai kriteria.</p>
                    <p className="text-xs">Coba ubah status, kata kunci pencarian, atau filter tim.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {(daftarWO as unknown as WorkOrderListItem[])?.map((wo) => {
              const invoice = Array.isArray(wo.invoices) ? wo.invoices[0] : wo.invoices;
              const totalNominal = invoice?.total ?? 0;
              const isTerlambat =
                wo.estimasi_selesai &&
                wo.estimasi_selesai < hariIni &&
                !["selesai", "siap_diambil", "diambil", "dibatalkan"].includes(wo.status);

              return (
                <TableRow key={wo.id} className="transition-colors hover:bg-muted/40">
                  <TableCell className="pl-4 font-semibold">
                    <Link
                      href={`/work-orders/${wo.id}`}
                      className="text-primary hover:text-primary-strong hover:underline"
                    >
                      {wo.nomor}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-text">{wo.vehicles?.plat ?? "-"}</div>
                    <div className="text-xs text-text-muted">{wo.vehicles?.merek_model ?? ""}</div>
                  </TableCell>
                  <TableCell className="font-medium text-text-body">
                    {wo.customers?.nama ?? "-"}
                  </TableCell>
                  <TableCell className="text-text-body">
                    {wo.profiles?.nama ?? "-"}
                  </TableCell>
                  <TableCell>
                    {wo.estimasi_selesai ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{tanggal(wo.estimasi_selesai)}</span>
                        {isTerlambat && (
                          <Badge variant="destructive" className="bg-danger text-xs text-white">
                            Terlambat
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted">Belum diisi</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-text">
                    {totalNominal > 0 ? rupiah(totalNominal) : "-"}
                  </TableCell>
                  <TableCell className="pr-4 text-center">
                    <BadgeStatus status={wo.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Paginasi */}
      <Paginasi
        halaman={halaman}
        totalBaris={count ?? 0}
        perHalaman={PER_HALAMAN}
        params={params}
      />
    </div>
  );
}
