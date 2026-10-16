import Link from "next/link";
import { redirect } from "next/navigation";
import { Calendar, DollarSign, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { rupiah, tanggal } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";

export default async function HalamanLaporanLaba({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string; sampai?: string }>;
}) {
  const profil = await ambilProfilSaya();
  if (profil.peran !== "owner") {
    redirect("/dashboard");
  }

  const { dari, sampai } = await searchParams;

  // Tanggal default: tanggal 1 bulan berjalan sampai hari ini
  const sekarang = new Date();
  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const tgl = String(sekarang.getDate()).padStart(2, "0");

  const defaultDari = `${tahun}-${bulan}-01`;
  const defaultSampai = `${tahun}-${bulan}-${tgl}`;

  const tglDari = dari || defaultDari;
  const tglSampai = sampai || defaultSampai;

  const supabase = await createClient();
  const { data: laporan, error } = await supabase.rpc("laporan_laba", {
    p_dari: tglDari,
    p_sampai: tglSampai,
  });

  const daftarLaba = laporan ?? [];

  // Hitung ringkasan akumulasi
  const totalPendapatan = daftarLaba.reduce((acc, curr) => acc + Number(curr.pendapatan || 0), 0);
  const totalModal = daftarLaba.reduce((acc, curr) => acc + Number(curr.modal || 0), 0);
  const totalLaba = daftarLaba.reduce((acc, curr) => acc + Number(curr.laba || 0), 0);
  const marginPersen = totalPendapatan > 0 ? (totalLaba / totalPendapatan) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Laporan Laba</h1>
          <p className="text-sm text-text-muted">
            Analisis pendapatan, modal spare part, dan laba kotor per Work Order (Khusus Owner).
          </p>
        </div>
      </div>

      {/* Penyaring Periode */}
      <Card className="p-4 bg-bg-panel border-border">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-auto">
            <label htmlFor="dari" className="text-xs font-medium text-text-muted block mb-1">
              Dari Tanggal
            </label>
            <Input
              id="dari"
              type="date"
              name="dari"
              defaultValue={tglDari}
              className="bg-card w-full sm:w-44 text-sm"
            />
          </div>
          <div className="w-full sm:w-auto">
            <label htmlFor="sampai" className="text-xs font-medium text-text-muted block mb-1">
              Sampai Tanggal
            </label>
            <Input
              id="sampai"
              type="date"
              name="sampai"
              defaultValue={tglSampai}
              className="bg-card w-full sm:w-44 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="default">
              Terapkan
            </Button>
            <Link
              href={`/laporan-laba?dari=${defaultDari}&sampai=${defaultSampai}`}
              className="text-xs text-text-muted hover:text-text underline px-2 py-2"
            >
              Reset (Bulan Ini)
            </Link>
          </div>
        </form>
      </Card>

      {/* Kartu Ringkasan (PRD 6.12) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-bg-panel border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-text-muted">Total Pendapatan</CardTitle>
            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
              <DollarSign className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text tabular-nums">{rupiah(totalPendapatan)}</div>
            <p className="text-xs text-text-muted mt-1">Total seluruh invoice diterbitkan</p>
          </CardContent>
        </Card>

        <Card className="bg-bg-panel border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-text-muted">Modal Spare Part</CardTitle>
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
              <Calendar className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text tabular-nums">{rupiah(totalModal)}</div>
            <p className="text-xs text-text-muted mt-1">Harga pokok modal komponen</p>
          </CardContent>
        </Card>

        <Card className="bg-bg-panel border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-text-muted">Laba Kotor</CardTitle>
            <div
              className={`p-2 rounded-lg ${
                totalLaba >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
              }`}
            >
              <TrendingUp className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tabular-nums ${
                totalLaba < 0 ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {rupiah(totalLaba)}
            </div>
            <p className="text-xs text-text-muted mt-1">Pendapatan dikurangi modal</p>
          </CardContent>
        </Card>

        <Card className="bg-bg-panel border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-text-muted">Margin Rata-rata</CardTitle>
            <div
              className={`p-2 rounded-lg ${
                marginPersen >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
              }`}
            >
              {marginPersen >= 0 ? (
                <ArrowUpRight className="size-4" />
              ) : (
                <ArrowDownRight className="size-4" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tabular-nums ${
                marginPersen < 0 ? "text-red-600" : "text-text"
              }`}
            >
              {marginPersen.toFixed(1)}%
            </div>
            <p className="text-xs text-text-muted mt-1">Persentase laba dari pendapatan</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabel Rincian per WO (PRD 6.12) */}
      <Card className="bg-bg-panel border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">Rincian Transaksi per Work Order</h2>
          <span className="text-xs text-text-muted">{daftarLaba.length} transaksi</span>
        </div>

        {error ? (
          <div className="p-6 text-center text-red-600 bg-red-50 flex items-center justify-center gap-2">
            <AlertTriangle className="size-5" />
            <span>Gagal memuat laporan laba: {error.message}</span>
          </div>
        ) : daftarLaba.length === 0 ? (
          <div className="p-12 text-center text-text-muted space-y-2">
            <p className="text-base font-medium text-text">Belum ada transaksi WO selesai</p>
            <p className="text-sm">Tidak ada transaksi yang selesai pada rentang tanggal yang dipilih.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-semibold text-text">No. WO</TableHead>
                  <TableHead className="font-semibold text-text">No. Invoice</TableHead>
                  <TableHead className="font-semibold text-text">Tanggal</TableHead>
                  <TableHead className="font-semibold text-text">Plat Mobil</TableHead>
                  <TableHead className="font-semibold text-text text-right">Pendapatan</TableHead>
                  <TableHead className="font-semibold text-text text-right">Modal</TableHead>
                  <TableHead className="font-semibold text-text text-right">Laba</TableHead>
                  <TableHead className="font-semibold text-text text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daftarLaba.map((item) => {
                  const labaMinus = Number(item.laba) < 0;
                  return (
                    <TableRow key={item.work_order_id} className="border-border">
                      <TableCell className="font-medium">
                        <Link
                          href={`/work-orders/${item.work_order_id}`}
                          className="text-primary hover:underline font-mono text-sm"
                        >
                          {item.nomor_wo}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-text-muted">
                        {item.nomor_invoice || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-text-muted">
                        {item.tanggal ? tanggal(item.tanggal) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs font-semibold">
                          {item.plat}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {rupiah(Number(item.pendapatan))}
                      </TableCell>
                      <TableCell className="text-right text-text-muted tabular-nums">
                        {rupiah(Number(item.modal))}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold tabular-nums ${
                          labaMinus ? "text-red-600 bg-red-500/5" : "text-emerald-600"
                        }`}
                      >
                        {rupiah(Number(item.laba))}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums text-sm font-medium ${
                          labaMinus ? "text-red-600" : "text-text"
                        }`}
                      >
                        {Number(item.margin_persen).toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
