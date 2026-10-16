import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Filter, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Paginasi } from "@/components/Paginasi";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { KomponenPerbandingan } from "./KomponenPerbandingan";

const PER_HALAMAN = 20;

const DAFTAR_TABEL = [
  { value: "", label: "Semua Tabel" },
  { value: "work_orders", label: "Work Orders (work_orders)" },
  { value: "billing_items", label: "Item Tagihan (billing_items)" },
  { value: "billing_item_costs", label: "Modal Tagihan (billing_item_costs)" },
  { value: "inventory_items", label: "Inventory (inventory_items)" },
  { value: "inventory_costs", label: "Modal Inventory (inventory_costs)" },
  { value: "invoices", label: "Invoice (invoices)" },
  { value: "payments", label: "Pembayaran (payments)" },
  { value: "stock_movements", label: "Mutasi Stok (stock_movements)" },
  { value: "profiles", label: "Profil Pengguna (profiles)" },
];

const DAFTAR_AKSI = [
  { value: "", label: "Semua Aksi" },
  { value: "INSERT", label: "INSERT (Tambah Data)" },
  { value: "UPDATE", label: "UPDATE (Ubah Data)" },
  { value: "DELETE", label: "DELETE (Hapus Data)" },
];

function formatWaktu(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(d);
  } catch {
    return iso;
  }
}

export default async function HalamanAuditLog({
  searchParams,
}: {
  searchParams: Promise<{
    hal?: string;
    tabel?: string;
    pelaku?: string;
    aksi?: string;
    dari?: string;
    sampai?: string;
  }>;
}) {
  const profil = await ambilProfilSaya();
  if (profil.peran !== "owner") {
    redirect("/dashboard");
  }

  const { hal, tabel = "", pelaku = "", aksi = "", dari = "", sampai = "" } = await searchParams;
  const halaman = Math.max(1, Number(hal) || 1);

  const supabase = await createClient();

  // Ambil daftar profil pengguna untuk filter dan pemetaan nama pelaku
  const { data: daftarProfil } = await supabase
    .from("profiles")
    .select("id, nama, role, email")
    .order("nama");

  const petaProfil = new Map<string, { nama: string; role: string }>();
  (daftarProfil ?? []).forEach((p) => {
    petaProfil.set(p.id, { nama: p.nama, role: p.role });
  });

  // Query audit_logs dengan filter & paginasi 20 baris per halaman (PRD 6.13)
  let kueri = supabase
    .from("audit_logs")
    .select("id, waktu, pelaku_id, pelaku_peran, aksi, tabel, data_id, sebelum, sesudah, alasan", {
      count: "exact",
    });

  if (tabel) {
    kueri = kueri.eq("tabel", tabel);
  }
  if (pelaku) {
    kueri = kueri.eq("pelaku_id", pelaku);
  }
  if (aksi) {
    kueri = kueri.eq("aksi", aksi);
  }
  if (dari) {
    kueri = kueri.gte("waktu", `${dari}T00:00:00.000Z`);
  }
  if (sampai) {
    kueri = kueri.lte("waktu", `${sampai}T23:59:59.999Z`);
  }

  const { data: logs, count, error } = await kueri
    .order("waktu", { ascending: false })
    .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

  const daftarLog = logs ?? [];
  const totalBaris = count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-text">Audit Log</h1>
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              <ShieldCheck className="size-3.5 mr-1" />
              Append-Only (Imutabel)
            </Badge>
          </div>
          <p className="text-sm text-text-muted mt-1">
            Rekam jejak seluruh perubahan data, status, harga, dan stok di sistem (Khusus Owner).
          </p>
        </div>
      </div>

      {/* Panel Penyaring: Tabel, Pelaku, Aksi, Periode (PRD 6.13) */}
      <Card className="p-4 bg-bg-panel border-border shadow-card">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label htmlFor="tabel" className="text-xs font-medium text-text-muted block mb-1">
              Tabel
            </label>
            <select
              id="tabel"
              name="tabel"
              defaultValue={tabel}
              className="w-full h-9 rounded-md border border-border bg-card px-3 py-1 text-xs text-text shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {DAFTAR_TABEL.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pelaku" className="text-xs font-medium text-text-muted block mb-1">
              Pelaku
            </label>
            <select
              id="pelaku"
              name="pelaku"
              defaultValue={pelaku}
              className="w-full h-9 rounded-md border border-border bg-card px-3 py-1 text-xs text-text shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Semua Pelaku</option>
              {(daftarProfil ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} ({p.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="aksi" className="text-xs font-medium text-text-muted block mb-1">
              Aksi
            </label>
            <select
              id="aksi"
              name="aksi"
              defaultValue={aksi}
              className="w-full h-9 rounded-md border border-border bg-card px-3 py-1 text-xs text-text shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {DAFTAR_AKSI.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="dari" className="text-xs font-medium text-text-muted block mb-1">
              Dari Tanggal
            </label>
            <Input
              id="dari"
              type="date"
              name="dari"
              defaultValue={dari}
              className="bg-card h-9 text-xs"
            />
          </div>

          <div>
            <label htmlFor="sampai" className="text-xs font-medium text-text-muted block mb-1">
              Sampai Tanggal
            </label>
            <Input
              id="sampai"
              type="date"
              name="sampai"
              defaultValue={sampai}
              className="bg-card h-9 text-xs"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-5 flex items-center justify-end gap-2 pt-1 border-t border-border/50">
            <Link
              href="/audit-log"
              className="text-xs text-text-muted hover:text-text px-3 py-1.5 rounded hover:bg-card border border-transparent hover:border-border transition"
            >
              Reset Filter
            </Link>
            <Button type="submit" size="sm" className="h-9 px-4 gap-1.5 text-xs">
              <Filter className="size-3.5" />
              <span>Terapkan Filter</span>
            </Button>
          </div>
        </form>
      </Card>

      {/* Tabel Data Audit Log (20 baris per halaman) */}
      <Card className="bg-bg-panel border-border shadow-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">Daftar Aktivitas Sistem</h2>
          <span className="text-xs text-text-muted font-medium">
            Total {totalBaris} catatan
          </span>
        </div>

        {error ? (
          <div className="p-8 text-center text-red-600 bg-red-50 flex items-center justify-center gap-2">
            <AlertCircle className="size-5" />
            <span>Gagal memuat catatan audit: {error.message}</span>
          </div>
        ) : daftarLog.length === 0 ? (
          <div className="p-12 text-center text-text-muted space-y-2">
            <p className="text-base font-medium text-text">Belum ada catatan audit</p>
            <p className="text-sm">
              Tidak ada perubahan data yang cocok dengan penyaring yang Anda pilih.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-semibold text-text text-xs whitespace-nowrap">Waktu</TableHead>
                  <TableHead className="font-semibold text-text text-xs whitespace-nowrap">Pelaku</TableHead>
                  <TableHead className="font-semibold text-text text-xs whitespace-nowrap">Aksi</TableHead>
                  <TableHead className="font-semibold text-text text-xs whitespace-nowrap">Tabel & ID Data</TableHead>
                  <TableHead className="font-semibold text-text text-xs whitespace-nowrap">Perubahan</TableHead>
                  <TableHead className="font-semibold text-text text-xs whitespace-nowrap">Alasan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daftarLog.map((log) => {
                  const infoPelaku = log.pelaku_id ? petaProfil.get(log.pelaku_id) : null;
                  const namaPelaku = infoPelaku?.nama || (log.pelaku_id ? `User (${log.pelaku_id.slice(0, 8)}...)` : "Sistem");
                  const peranPelaku = log.pelaku_peran || infoPelaku?.role || "sistem";

                  return (
                    <TableRow key={log.id} className="border-border text-xs">
                      <TableCell className="font-mono text-text-muted whitespace-nowrap">
                        {formatWaktu(log.waktu)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-text">{namaPelaku}</span>
                          <span className="text-[10px] text-text-muted uppercase tracking-wider">
                            {peranPelaku}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            log.aksi === "INSERT"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]"
                              : log.aksi === "DELETE"
                              ? "bg-red-500/10 text-red-600 border-red-500/20 text-[10px]"
                              : "bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px]"
                          }
                        >
                          {log.aksi}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 font-mono">
                          <span className="font-semibold text-text">{log.tabel}</span>
                          <span className="text-[10px] text-text-muted">
                            {log.data_id ? `#${log.data_id}` : "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <KomponenPerbandingan
                          aksi={log.aksi}
                          tabel={log.tabel}
                          dataId={log.data_id}
                          sebelum={(log.sebelum as Record<string, unknown>) ?? null}
                          sesudah={(log.sesudah as Record<string, unknown>) ?? null}
                        />
                      </TableCell>
                      <TableCell className="text-text-muted max-w-xs truncate">
                        {log.alasan || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Paginasi 20 baris per halaman */}
        {totalBaris > PER_HALAMAN && (
          <div className="p-4 border-t border-border">
            <Paginasi
              halaman={halaman}
              totalBaris={totalBaris}
              perHalaman={PER_HALAMAN}
              params={{
                tabel: tabel || undefined,
                pelaku: pelaku || undefined,
                aksi: aksi || undefined,
                dari: dari || undefined,
                sampai: sampai || undefined,
              }}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
