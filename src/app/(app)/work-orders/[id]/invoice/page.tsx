import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { TombolCetak } from "./CetakInvoice";

export default async function HalamanInvoice({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profil = await ambilProfilSaya();
  const supabase = await createClient();

  // 1. Ambil data bengkel dari workshop_settings
  const { data: bengkel } = await supabase
    .from("workshop_settings")
    .select("nama, alamat, telepon, jam_buka")
    .eq("id", 1)
    .single();

  // 2. Ambil Work Order
  const { data: wo, error: errWo } = await supabase
    .from("work_orders")
    .select(`
      id, nomor, status, odometer, created_at, kepala_mekanik_id,
      vehicles (plat, merek_model, tahun, warna),
      customers (nama, telepon, alamat)
    `)
    .eq("id", id)
    .single();

  if (errWo || !wo) {
    notFound();
  }

  // Hak akses: Kepala Mekanik hanya boleh melihat WO timnya (PRD 2.3)
  if (profil.peran === "kepala_mekanik" && wo.kepala_mekanik_id !== profil.id) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center text-text-muted">
          Anda tidak memiliki hak akses untuk melihat invoice Work Order milik tim lain.
        </Card>
      </div>
    );
  }

  // 3. Ambil Invoice
  const { data: invoice } = await supabase
    .from("invoices")
    .select(`
      id, nomor, subtotal, diskon, total, terbayar, status_bayar, diterbitkan_at
    `)
    .eq("work_order_id", id)
    .maybeSingle();

  // Bila invoice belum diterbitkan
  if (!invoice) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-10">
        <Card className="p-8 text-center space-y-4 shadow-card">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning/10 text-warning">
            <AlertCircle className="size-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text">Invoice Belum Diterbitkan</h2>
            <p className="text-sm text-text-muted mt-1">
              Work Order <strong>{wo.nomor}</strong> belum memiliki invoice resmi. Terbitkan invoice
              terlebih dahulu melalui tab Tagihan setelah status WO menjadi <em>Siap Diambil</em>.
            </p>
          </div>
          <div>
            <Button asChild variant="outline" className="gap-1.5">
              <Link href={`/work-orders/${id}/tagihan`}>
                <ArrowLeft className="size-4" />
                Kembali ke Tab Tagihan
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // 4. Ambil baris tagihan
  const { data: items } = await supabase
    .from("billing_items")
    .select("id, nama_item, jenis, jumlah, harga_dipakai")
    .eq("work_order_id", id)
    .order("created_at", { ascending: true });

  // 5. Ambil riwayat pembayaran
  const { data: payments } = await supabase
    .from("payments")
    .select("id, metode, jumlah, created_at")
    .eq("invoice_id", invoice.id)
    .order("created_at", { ascending: true });

  const kendaraan = Array.isArray(wo.vehicles) ? wo.vehicles[0] : wo.vehicles;
  const pelanggan = Array.isArray(wo.customers) ? wo.customers[0] : wo.customers;

  const sisa = Math.max(0, invoice.total - invoice.terbayar);

  return (
    <div className="space-y-6">
      {/* Baris Tombol Aksi (Print & Navigasi) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Invoice {invoice.nomor}</h1>
          <p className="text-xs text-text-muted">Siap dicetak dalam format A4</p>
        </div>
        <TombolCetak woId={id} />
      </div>

      {/* Lembar Invoice A4 Siap Cetak */}
      <div className="mx-auto max-w-[800px] rounded-xl border bg-white p-8 sm:p-10 text-neutral-900 shadow-card print:border-none print:shadow-none print:p-0">
        {/* Header Invoice: Logo & Info Bengkel */}
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-neutral-200 pb-6">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-neutral-900">
              {bengkel?.nama ?? "BENGKEL CEMERLANG JAYA MOTOR"}
            </h2>
            <p className="text-xs text-neutral-600 mt-1 max-w-sm">
              {bengkel?.alamat ?? "Jl. Raya Cemerlang No. 123"}
            </p>
            <p className="text-xs text-neutral-600">
              Telepon: {bengkel?.telepon ?? "(021) 555-1234"}
            </p>
          </div>

          <div className="text-right">
            <span className="text-3xl font-extrabold uppercase tracking-wide text-primary">
              INVOICE
            </span>
            <p className="text-sm font-semibold text-neutral-900 mt-1">{invoice.nomor}</p>
            <p className="text-xs text-neutral-500">
              Tanggal: {tanggal(invoice.diterbitkan_at)}
            </p>
            <div className="mt-2">
              <Badge
                variant="outline"
                className={`text-xs uppercase font-bold ${
                  invoice.status_bayar === "lunas"
                    ? "border-green-600 text-green-700 bg-green-50"
                    : invoice.status_bayar === "sebagian"
                      ? "border-amber-600 text-amber-700 bg-amber-50"
                      : "border-red-600 text-red-700 bg-red-50"
                }`}
              >
                {invoice.status_bayar === "lunas"
                  ? "LUNAS"
                  : invoice.status_bayar === "sebagian"
                    ? "DIBAYAR SEBAGIAN"
                    : "BELUM BAYAR"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Informasi Pelanggan & Kendaraan */}
        <div className="grid grid-cols-2 gap-6 py-6 border-b border-neutral-200 text-xs">
          <div>
            <p className="font-bold text-neutral-500 uppercase tracking-wider mb-1">
              Ditagihkan Kepada:
            </p>
            <p className="text-sm font-bold text-neutral-900">{pelanggan?.nama}</p>
            <p className="text-neutral-600 mt-0.5">{pelanggan?.telepon}</p>
            {pelanggan?.alamat && (
              <p className="text-neutral-600 mt-0.5">{pelanggan.alamat}</p>
            )}
          </div>

          <div className="text-right">
            <p className="font-bold text-neutral-500 uppercase tracking-wider mb-1">
              Data Kendaraan & Layanan:
            </p>
            <p className="text-sm font-bold text-neutral-900">{kendaraan?.plat}</p>
            <p className="text-neutral-600 mt-0.5">
              {kendaraan?.merek_model} {kendaraan?.tahun ? `(${kendaraan.tahun})` : ""}{" "}
              {kendaraan?.warna ? `· ${kendaraan.warna}` : ""}
            </p>
            <p className="text-neutral-600 mt-0.5">
              Nomor WO: <strong>{wo.nomor}</strong> · Odometer: {wo.odometer.toLocaleString("id-ID")} km
            </p>
          </div>
        </div>

        {/* Tabel Rincian Item (Tanpa Master & Tanpa Modal sesuai PRD 6.9) */}
        <div className="py-4">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="border-b border-neutral-300">
                <TableHead className="w-10 text-neutral-600">No</TableHead>
                <TableHead className="text-neutral-600">Deskripsi Layanan / Part</TableHead>
                <TableHead className="text-center text-neutral-600">Jenis</TableHead>
                <TableHead className="text-right text-neutral-600">Qty</TableHead>
                <TableHead className="text-right text-neutral-600">Harga Satuan</TableHead>
                <TableHead className="text-right text-neutral-600">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(items ?? []).map((it, idx) => {
                const sub = it.jumlah * it.harga_dipakai;
                return (
                  <TableRow key={it.id} className="border-b border-neutral-100">
                    <TableCell className="text-neutral-500">{idx + 1}</TableCell>
                    <TableCell className="font-medium text-neutral-900">{it.nama_item}</TableCell>
                    <TableCell className="text-center text-neutral-500">
                      {it.jenis === "part" ? "Part" : "Jasa"}
                    </TableCell>
                    <TableCell className="text-right text-neutral-900 font-medium">
                      {it.jumlah}
                    </TableCell>
                    <TableCell className="text-right text-neutral-700">
                      {rupiah(it.harga_dipakai)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-neutral-900">
                      {rupiah(sub)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Rincian Total & Riwayat Pembayaran */}
        <div className="grid grid-cols-2 gap-6 pt-4 border-t border-neutral-200">
          {/* Riwayat Pembayaran */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
              Riwayat Pembayaran:
            </p>
            {(!payments || payments.length === 0) ? (
              <p className="text-xs text-neutral-500 italic">Belum ada pembayaran yang tercatat.</p>
            ) : (
              <div className="space-y-1.5 text-xs">
                {payments.map((p) => (
                  <div key={p.id} className="flex justify-between border-b border-neutral-100 pb-1">
                    <span className="text-neutral-600">
                      {tanggal(p.created_at)} ({p.metode.toUpperCase()})
                    </span>
                    <span className="font-semibold text-neutral-900">{rupiah(p.jumlah)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kalkulasi Subtotal, Diskon, Total */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-600">Subtotal:</span>
              <span className="font-semibold text-neutral-900">{rupiah(invoice.subtotal)}</span>
            </div>
            {invoice.diskon > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Diskon:</span>
                <span className="font-semibold">-{rupiah(invoice.diskon)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-neutral-300 pt-2 text-sm font-extrabold text-neutral-900">
              <span>Total Tagihan:</span>
              <span className="text-primary">{rupiah(invoice.total)}</span>
            </div>
            <div className="flex justify-between text-neutral-700">
              <span>Sudah Dibayar:</span>
              <span className="font-semibold text-green-700">{rupiah(invoice.terbayar)}</span>
            </div>
            <div className="flex justify-between border-t border-neutral-200 pt-2 font-bold text-neutral-900">
              <span>Sisa Pembayaran:</span>
              <span className={sisa > 0 ? "text-red-600" : "text-green-700"}>
                {rupiah(sisa)}
              </span>
            </div>
          </div>
        </div>

        {/* Kolom Tanda Tangan */}
        <div className="mt-14 grid grid-cols-2 gap-8 text-center text-xs text-neutral-600">
          <div>
            <p>Penerima / Pelanggan,</p>
            <div className="h-16" />
            <p className="font-bold border-t border-neutral-300 pt-1 text-neutral-900">
              ( {pelanggan?.nama} )
            </p>
          </div>
          <div>
            <p>Hormat Kami / Kasir,</p>
            <div className="h-16" />
            <p className="font-bold border-t border-neutral-300 pt-1 text-neutral-900">
              ( Bengkel Cemerlang Jaya )
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
