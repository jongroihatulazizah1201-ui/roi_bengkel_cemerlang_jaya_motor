"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  CreditCard,
  Pencil,
  Tag,
  Info,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Trash2,
  Package,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { rupiah, tanggal } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

export interface ItemTagihanTipe {
  id: string;
  item_id: string;
  nama_item: string;
  jenis: string;
  jumlah: number;
  harga_master: number;
  harga_dipakai: number;
  alasan_penyesuaian: string | null;
  disesuaikan_at: string | null;
  disesuaikan_oleh: string | null;
  ditambah_oleh: string | null;
  disesuaikan_profil?: { nama: string } | null;
  harga_modal?: number;
}

export interface InventoryItemTipe {
  id: string;
  kode: string;
  jenis: string;
  nama: string;
  harga_jual: number;
  stok: number;
}

export interface InvoiceTipe {
  id: string;
  nomor: string;
  subtotal: number;
  diskon: number;
  total: number;
  terbayar: number;
  status_bayar: string;
  diterbitkan_at: string;
  diterbitkan_oleh: string | null;
  diterbitkan_profil?: { nama: string } | null;
}

export interface PembayaranTipe {
  id: string;
  metode: string;
  jumlah: number;
  created_at: string;
  dicatat_oleh: string | null;
  dicatat_profil?: { nama: string } | null;
}

interface Props {
  woId: string;
  woNomor: string;
  woStatus: string;
  diskonAwal: number;
  alasanDiskonAwal: string | null;
  peran: string;
  items: ItemTagihanTipe[];
  invoice: InvoiceTipe | null;
  pembayaran: PembayaranTipe[];
  daftarInventory?: InventoryItemTipe[];
}

const OPSI_ALASAN = [
  "Harga khusus pelanggan",
  "Negosiasi",
  "Harga paket",
  "Koreksi harga master",
  "Lainnya",
];

export function KomponenTagihan({
  woId,
  woNomor,
  woStatus,
  diskonAwal,
  alasanDiskonAwal,
  peran,
  items,
  invoice,
  pembayaran,
  daftarInventory = [],
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const isOwner = peran === "owner";
  const isAdminOrOwner = peran === "admin" || peran === "owner";
  const isKepalaMekanikOrOwner = peran === "kepala_mekanik" || peran === "owner";
  const sudahTerbitInvoice = Boolean(invoice);
  const bolehUbahItem = woStatus === "dikerjakan" && isKepalaMekanikOrOwner && !sudahTerbitInvoice;

  // Perhitungan Subtotal dan Laba
  const subtotal = items.reduce((acc, it) => acc + it.jumlah * it.harga_dipakai, 0);
  const diskon = invoice ? invoice.diskon : diskonAwal;
  const total = Math.max(0, subtotal - diskon);
  const terbayar = invoice ? invoice.terbayar : 0;
  const sisa = Math.max(0, total - terbayar);

  // Perhitungan Laba untuk Owner
  const totalModal = isOwner
    ? items.reduce((acc, it) => acc + it.jumlah * (it.harga_modal ?? 0), 0)
    : 0;
  const labaKotor = isOwner ? total - totalModal : 0;
  const marginPersen = isOwner && total > 0 ? (labaKotor / total) * 100 : 0;

  // State Dialog Tambah Item
  const [dialogTambahItemOpen, setDialogTambahItemOpen] = useState(false);
  const [filterJenisItem, setFilterJenisItem] = useState<"semua" | "part" | "jasa">("semua");
  const [itemIdDipilih, setItemIdDipilih] = useState<string>("");
  const [jumlahItem, setJumlahItem] = useState<number>(1);
  const [sedangTambahItem, setSedangTambahItem] = useState(false);

  // State Dialog Hapus Item
  const [dialogHapusItemOpen, setDialogHapusItemOpen] = useState(false);
  const [itemAkanDihapus, setItemAkanDihapus] = useState<ItemTagihanTipe | null>(null);
  const [sedangHapusItem, setSedangHapusItem] = useState(false);

  // State Dialog Penyesuaian Harga
  const [dialogHargaOpen, setDialogHargaOpen] = useState(false);
  const [itemDipilih, setItemDipilih] = useState<ItemTagihanTipe | null>(null);
  const [hargaBaru, setHargaBaru] = useState<number>(0);
  const [opsiAlasan, setOpsiAlasan] = useState<string>("Harga khusus pelanggan");
  const [alasanKustom, setAlasanKustom] = useState<string>("");
  const [sedangSimpanHarga, setSedangSimpanHarga] = useState(false);

  // State Dialog Diskon
  const [dialogDiskonOpen, setDialogDiskonOpen] = useState(false);
  const [inputDiskon, setInputDiskon] = useState<number>(diskonAwal);
  const [inputAlasanDiskon, setInputAlasanDiskon] = useState<string>(alasanDiskonAwal ?? "");
  const [sedangSimpanDiskon, setSedangSimpanDiskon] = useState(false);

  // State Dialog Terbitkan Invoice
  const [dialogInvoiceOpen, setDialogInvoiceOpen] = useState(false);
  const [sedangTerbitkan, setSedangTerbitkan] = useState(false);

  // State Dialog Pembayaran
  const [dialogBayarOpen, setDialogBayarOpen] = useState(false);
  const [metodeBayar, setMetodeBayar] = useState<string>("tunai");
  const [jumlahBayar, setJumlahBayar] = useState<number>(sisa);
  const [sedangSimpanBayar, setSedangSimpanBayar] = useState(false);

  // State Detail Penyesuaian
  const [itemDetail, setItemDetail] = useState<ItemTagihanTipe | null>(null);

  // Item terpilih saat tambah item
  const selectedInventoryItem = daftarInventory.find((i) => i.id === itemIdDipilih);

  // Filter inventory
  const inventoryTerfilter = daftarInventory.filter((it) => {
    if (filterJenisItem === "semua") return true;
    return it.jenis === filterJenisItem;
  });

  // Handler: Tambah Item Tagihan
  const handleBukaTambahItem = () => {
    setItemIdDipilih("");
    setJumlahItem(1);
    setFilterJenisItem("semua");
    setDialogTambahItemOpen(true);
  };

  const handleSimpanTambahItem = async () => {
    if (!itemIdDipilih) {
      toast.error("Silakan pilih item suku cadang atau jasa terlebih dahulu");
      return;
    }

    if (jumlahItem < 1) {
      toast.error("Jumlah item minimal 1");
      return;
    }

    if (selectedInventoryItem?.jenis === "part" && selectedInventoryItem.stok < jumlahItem) {
      toast.error(`Stok ${selectedInventoryItem.nama} hanya ${selectedInventoryItem.stok}`);
      return;
    }

    setSedangTambahItem(true);
    try {
      const { error } = await supabase.rpc("tambah_item_tagihan", {
        p_wo: woId,
        p_item: itemIdDipilih,
        p_jumlah: jumlahItem,
      });

      if (error) throw error;

      toast.success("Item berhasil ditambahkan ke tagihan");
      setDialogTambahItemOpen(false);
      router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menambah item tagihan";
      toast.error(pesan);
    } finally {
      setSedangTambahItem(false);
    }
  };

  // Handler: Hapus Item Tagihan
  const handleBukaHapusItem = (item: ItemTagihanTipe) => {
    setItemAkanDihapus(item);
    setDialogHapusItemOpen(true);
  };

  const handleKonfirmasiHapusItem = async () => {
    if (!itemAkanDihapus) return;

    setSedangHapusItem(true);
    try {
      const { error } = await supabase.rpc("hapus_item_tagihan", {
        p_billing_item: itemAkanDihapus.id,
      });

      if (error) throw error;

      toast.success(
        itemAkanDihapus.jenis === "part"
          ? "Item dihapus dan stok suku cadang dikembalikan"
          : "Item jasa berhasil dihapus dari tagihan",
      );
      setDialogHapusItemOpen(false);
      setItemAkanDihapus(null);
      router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menghapus item tagihan";
      toast.error(pesan);
    } finally {
      setSedangHapusItem(false);
    }
  };

  // Handler: Buka Dialog Penyesuaian Harga
  const handleBukaUbahHarga = (item: ItemTagihanTipe) => {
    setItemDipilih(item);
    setHargaBaru(item.harga_dipakai);
    setOpsiAlasan("Harga khusus pelanggan");
    setAlasanKustom("");
    setDialogHargaOpen(true);
  };

  // Handler: Simpan Penyesuaian Harga
  const handleSimpanHarga = async () => {
    if (!itemDipilih) return;
    const alasanFinal = opsiAlasan === "Lainnya" ? alasanKustom.trim() : opsiAlasan;

    if (!alasanFinal) {
      toast.error("Alasan penyesuaian harga wajib diisi");
      return;
    }

    if (hargaBaru < 0) {
      toast.error("Harga tidak boleh negatif");
      return;
    }

    setSedangSimpanHarga(true);
    try {
      const { data: diBawahModal, error } = await supabase.rpc("sesuaikan_harga_item", {
        p_billing_item: itemDipilih.id,
        p_harga: hargaBaru,
        p_alasan: alasanFinal,
      });

      if (error) throw error;

      if (diBawahModal) {
        toast.warning("Harga ini di bawah modal", {
          duration: 5000,
        });
      } else {
        toast.success("Harga item berhasil disesuaikan");
      }

      setDialogHargaOpen(false);
      router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menyesuaikan harga";
      toast.error(pesan);
    } finally {
      setSedangSimpanHarga(false);
    }
  };

  // Handler: Simpan Diskon
  const handleSimpanDiskon = async () => {
    if (inputDiskon < 0) {
      toast.error("Diskon tidak boleh bernilai negatif");
      return;
    }

    if (inputDiskon > subtotal) {
      toast.error(`Diskon tidak boleh melebihi subtotal (${rupiah(subtotal)})`);
      return;
    }

    if (inputDiskon > 0 && !inputAlasanDiskon.trim()) {
      toast.error("Alasan diskon wajib diisi bila nominal diskon lebih dari Rp0");
      return;
    }

    setSedangSimpanDiskon(true);
    try {
      const { error } = await supabase.rpc("atur_diskon", {
        p_wo: woId,
        p_diskon: inputDiskon,
        p_alasan: inputAlasanDiskon.trim(),
      });

      if (error) throw error;

      toast.success("Diskon berhasil diperbarui");
      setDialogDiskonOpen(false);
      router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal mengatur diskon";
      toast.error(pesan);
    } finally {
      setSedangSimpanDiskon(false);
    }
  };

  // Handler: Terbitkan Invoice
  const handleTerbitkanInvoice = async () => {
    if (woStatus !== "siap_diambil") {
      toast.error("Invoice hanya dapat diterbitkan saat status WO siap diambil (lulus QC)");
      return;
    }

    if (items.length === 0) {
      toast.error("Tidak dapat menerbitkan invoice untuk WO tanpa baris tagihan");
      return;
    }

    setSedangTerbitkan(true);
    try {
      const { error } = await supabase.rpc("terbitkan_invoice", {
        p_wo: woId,
      });

      if (error) throw error;

      toast.success("Invoice berhasil diterbitkan!");
      setDialogInvoiceOpen(false);
      router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal menerbitkan invoice";
      toast.error(pesan);
    } finally {
      setSedangTerbitkan(false);
    }
  };

  // Handler: Catat Pembayaran
  const handleCatatPembayaran = async () => {
    if (!invoice) return;

    if (jumlahBayar <= 0) {
      toast.error("Jumlah pembayaran harus lebih dari Rp0");
      return;
    }

    if (jumlahBayar > sisa) {
      toast.error(`Jumlah pembayaran melebihi sisa tagihan (${rupiah(sisa)})`);
      return;
    }

    setSedangSimpanBayar(true);
    try {
      const { error } = await supabase.rpc("catat_pembayaran", {
        p_invoice: invoice.id,
        p_metode: metodeBayar,
        p_jumlah: jumlahBayar,
      });

      if (error) throw error;

      toast.success("Pembayaran berhasil dicatat");
      setDialogBayarOpen(false);
      router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal mencatat pembayaran";
      toast.error(pesan);
    } finally {
      setSedangSimpanBayar(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Status Invoice & Aksi Atas */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-card">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-muted">Nomor WO:</span>
            <span className="font-semibold text-text">{woNomor}</span>
            {invoice ? (
              <Badge
                variant="outline"
                className={
                  invoice.status_bayar === "lunas"
                    ? "border-success bg-success/10 text-success font-semibold"
                    : invoice.status_bayar === "sebagian"
                      ? "border-warning bg-warning/10 text-warning font-semibold"
                      : "border-destructive bg-destructive/10 text-destructive font-semibold"
                }
              >
                {invoice.status_bayar === "lunas"
                  ? "Lunas"
                  : invoice.status_bayar === "sebagian"
                    ? "Sebagian"
                    : "Belum Bayar"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-text-muted">
                Tagihan Belum Terbit Invoice
              </Badge>
            )}
          </div>
          {invoice && (
            <p className="text-xs text-text-muted">
              Nomor Invoice: <strong className="text-text">{invoice.nomor}</strong> · Diterbitkan pada{" "}
              {tanggal(invoice.diterbitkan_at)}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Lihat Invoice (Cetak) */}
          {invoice && (
            <Button asChild variant="outline" className="gap-1.5">
              <Link href={`/work-orders/${woId}/invoice`}>
                <FileText className="size-4" />
                Lihat Invoice Siap Cetak
              </Link>
            </Button>
          )}

          {/* Tombol Terbitkan Invoice */}
          {!invoice && isAdminOrOwner && (
            <Button
              onClick={() => setDialogInvoiceOpen(true)}
              disabled={woStatus !== "siap_diambil" || items.length === 0}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary-strong"
            >
              <FileText className="size-4" />
              Terbitkan Invoice
            </Button>
          )}

          {/* Tombol Catat Pembayaran */}
          {invoice && isAdminOrOwner && invoice.status_bayar !== "lunas" && (
            <Button
              onClick={() => {
                setJumlahBayar(sisa);
                setDialogBayarOpen(true);
              }}
              className="gap-1.5 bg-success text-white hover:bg-success/90"
            >
              <CreditCard className="size-4" />
              + Catat Pembayaran
            </Button>
          )}
        </div>
      </div>

      {/* Info Status untuk Terbitkan Invoice */}
      {!invoice && isAdminOrOwner && woStatus !== "siap_diambil" && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-2.5 text-xs text-warning">
          <Info className="size-4 shrink-0" />
          <span>
            Invoice dapat diterbitkan saat status WO <strong>Siap Diambil</strong> (lulus QC). Saat
            ini status WO: <strong>{woStatus}</strong>.
          </span>
        </div>
      )}

      {/* Tabel Baris Tagihan (Bagian D) */}
      <Card className="py-0">
        <CardHeader className="border-b px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold text-text">
                Rincian Item & Jasa ({items.length} item)
              </CardTitle>
              {!sudahTerbitInvoice && (
                <p className="text-xs text-text-muted mt-0.5">
                  {woStatus === "dikerjakan" && isKepalaMekanikOrOwner
                    ? "Kepala Mekanik dapat menambah/menghapus item saat dikerjakan. Admin dapat menyesuaikan harga."
                    : "Harga dapat disesuaikan oleh Admin/Owner sebelum invoice terbit"}
                </p>
              )}
            </div>

            {/* Tombol Tambah Item oleh Kepala Mekanik atau Owner */}
            {bolehUbahItem && (
              <Button
                size="sm"
                onClick={handleBukaTambahItem}
                className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary-strong"
              >
                <Plus className="size-4" />
                Tambah Item
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Item</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="text-right">Harga Master</TableHead>
                <TableHead className="text-right">Harga Dipakai</TableHead>
                {isOwner && (
                  <>
                    <TableHead className="text-right text-text-muted">Modal (Owner)</TableHead>
                    <TableHead className="text-right text-text-muted">Laba (Owner)</TableHead>
                  </>
                )}
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="w-24 pr-4 text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isOwner ? 9 : 7}
                    className="py-10 text-center text-text-muted"
                  >
                    Belum ada baris spare part atau jasa pada Work Order ini.
                    {bolehUbahItem && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBukaTambahItem}
                          className="gap-1.5"
                        >
                          <Plus className="size-4" />
                          Tambah Item Pertama
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((it) => {
                  const barisSubtotal = it.jumlah * it.harga_dipakai;
                  const isDisesuaikan = it.harga_dipakai !== it.harga_master;
                  const barisModal = (it.harga_modal ?? 0) * it.jumlah;
                  const barisLaba = barisSubtotal - barisModal;

                  return (
                    <TableRow key={it.id}>
                      <TableCell className="pl-4 font-medium text-text">
                        <div className="flex items-center gap-1.5">
                          <span>{it.nama_item}</span>
                          {isDisesuaikan && (
                            <button
                              type="button"
                              onClick={() => setItemDetail(it)}
                              title="Lihat alasan penyesuaian harga"
                              className="inline-flex items-center gap-1 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning hover:bg-warning/25"
                            >
                              <Info className="size-3" />
                              Disesuaikan
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {it.jenis === "part" ? "Spare Part" : "Jasa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{it.jumlah}</TableCell>
                      <TableCell className="text-right text-text-muted">
                        {rupiah(it.harga_master)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <span className={isDisesuaikan ? "font-semibold text-primary" : ""}>
                          {rupiah(it.harga_dipakai)}
                        </span>
                      </TableCell>
                      {isOwner && (
                        <>
                          <TableCell className="text-right text-text-muted">
                            {rupiah(it.harga_modal ?? 0)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              barisLaba < 0 ? "text-danger" : "text-success"
                            }`}
                          >
                            {rupiah(barisLaba)}
                          </TableCell>
                        </>
                      )}
                      <TableCell className="text-right font-semibold text-text">
                        {rupiah(barisSubtotal)}
                      </TableCell>
                      <TableCell className="pr-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Tombol Sesuaikan Harga (Admin & Owner) */}
                          {isAdminOrOwner && !sudahTerbitInvoice && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleBukaUbahHarga(it)}
                              title="Sesuaikan harga item ini"
                              className="size-8 text-text-muted hover:text-primary"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          )}

                          {/* Tombol Hapus Item (Kepala Mekanik & Owner saat dikerjakan) */}
                          {bolehUbahItem && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleBukaHapusItem(it)}
                              title="Hapus item ini dari tagihan"
                              className="size-8 text-text-muted hover:text-danger"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}

                          {(!isAdminOrOwner || sudahTerbitInvoice) && !bolehUbahItem && (
                            <span className="text-xs text-text-muted">-</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ringkasan Biaya (Subtotal, Diskon, Total, Sisa) */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Kolom Kiri: Riwayat Pembayaran */}
        <Card className="py-0">
          <CardHeader className="border-b px-4 py-3">
            <CardTitle className="text-base font-semibold text-text">
              Riwayat Pembayaran
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pembayaran.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted">
                Belum ada transaksi pembayaran yang dicatat.
              </div>
            ) : (
              <div className="divide-y">
                {pembayaran.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3.5 text-xs">
                    <div>
                      <p className="font-semibold text-text capitalize">
                        Pembayaran {p.metode}
                      </p>
                      <p className="text-text-muted text-[11px]">
                        {tanggal(p.created_at)} · Dicatat oleh: {p.dicatat_profil?.nama ?? "Admin"}
                      </p>
                    </div>
                    <span className="font-bold text-success text-sm">{rupiah(p.jumlah)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Kolom Kanan: Rincian Angka & Diskon */}
        <Card className="p-5 space-y-3">
          <h3 className="text-base font-semibold text-text border-b pb-2">Ringkasan Tagihan</h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Subtotal</span>
              <span className="font-medium text-text">{rupiah(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-text-muted">Diskon Total</span>
                {isAdminOrOwner && !sudahTerbitInvoice && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setInputDiskon(diskon);
                      setInputAlasanDiskon(alasanDiskonAwal ?? "");
                      setDialogDiskonOpen(true);
                    }}
                    className="h-auto p-0 text-xs text-primary underline"
                  >
                    (Atur Diskon)
                  </Button>
                )}
              </div>
              <span className="font-medium text-danger">-{rupiah(diskon)}</span>
            </div>

            {alasanDiskonAwal && diskon > 0 && (
              <div className="text-[11px] text-text-muted italic bg-muted/40 p-1.5 rounded">
                Alasan diskon: {alasanDiskonAwal}
              </div>
            )}

            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <span className="text-text">Total Tagihan</span>
              <span className="text-primary">{rupiah(total)}</span>
            </div>

            {isOwner && (
              <div className="rounded-lg bg-primary-soft/40 p-3 my-2 space-y-1 text-xs">
                <div className="flex justify-between text-text-body">
                  <span>Total Modal (Owner):</span>
                  <span>{rupiah(totalModal)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Laba Kotor WO:</span>
                  <span className={labaKotor < 0 ? "text-danger" : "text-success"}>
                    {rupiah(labaKotor)} ({marginPersen.toFixed(1)}%)
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-between border-t pt-2 text-sm">
              <span className="text-text-muted">Sudah Dibayar</span>
              <span className="font-semibold text-success">{rupiah(terbayar)}</span>
            </div>

            <div className="flex justify-between pt-1 text-base font-bold">
              <span className="text-text">Sisa Tagihan</span>
              <span className={sisa > 0 ? "text-danger" : "text-success"}>
                {rupiah(sisa)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Dialog 0: Tambah Item Tagihan (Kepala Mekanik & Owner) */}
      <Dialog open={dialogTambahItemOpen} onOpenChange={setDialogTambahItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-primary" />
              Tambah Item ke Tagihan
            </DialogTitle>
            <DialogDescription>
              Pilih suku cadang atau jasa yang ditambahkan selama pengerjaan WO {woNomor}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Filter Jenis Item */}
            <div className="space-y-1">
              <Label>Jenis Item</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={filterJenisItem === "semua" ? "default" : "outline"}
                  onClick={() => {
                    setFilterJenisItem("semua");
                    setItemIdDipilih("");
                  }}
                  className="flex-1 text-xs"
                >
                  Semua
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={filterJenisItem === "part" ? "default" : "outline"}
                  onClick={() => {
                    setFilterJenisItem("part");
                    setItemIdDipilih("");
                  }}
                  className="flex-1 text-xs gap-1"
                >
                  <Package className="size-3.5" />
                  Spare Part
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={filterJenisItem === "jasa" ? "default" : "outline"}
                  onClick={() => {
                    setFilterJenisItem("jasa");
                    setItemIdDipilih("");
                  }}
                  className="flex-1 text-xs gap-1"
                >
                  <Wrench className="size-3.5" />
                  Jasa
                </Button>
              </div>
            </div>

            {/* Dropdown Item Inventory */}
            <div className="space-y-1">
              <Label>Pilih Item *</Label>
              <Select value={itemIdDipilih} onValueChange={setItemIdDipilih}>
                <SelectTrigger>
                  <SelectValue placeholder="-- Pilih suku cadang atau jasa --" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {inventoryTerfilter.map((it) => (
                    <SelectItem
                      key={it.id}
                      value={it.id}
                      disabled={it.jenis === "part" && it.stok <= 0}
                    >
                      {it.nama} ({it.kode}) — {rupiah(it.harga_jual)}
                      {it.jenis === "part" ? ` [Stok: ${it.stok}]` : " [Jasa]"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Info Item Terpilih */}
            {selectedInventoryItem && (
              <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-muted">Harga Satuan:</span>
                  <span className="font-semibold text-text">
                    {rupiah(selectedInventoryItem.harga_jual)}
                  </span>
                </div>
                {selectedInventoryItem.jenis === "part" && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Stok Tersedia:</span>
                    <span
                      className={`font-semibold ${
                        selectedInventoryItem.stok > 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {selectedInventoryItem.stok} unit
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 font-bold text-text">
                  <span>Subtotal Item:</span>
                  <span className="text-primary">
                    {rupiah(selectedInventoryItem.harga_jual * jumlahItem)}
                  </span>
                </div>
              </div>
            )}

            {/* Input Jumlah */}
            <div className="space-y-1">
              <Label htmlFor="inputJumlah">Jumlah Item *</Label>
              <Input
                id="inputJumlah"
                type="number"
                min={1}
                max={selectedInventoryItem?.jenis === "part" ? selectedInventoryItem.stok : undefined}
                value={jumlahItem}
                onChange={(e) => setJumlahItem(Math.max(1, Number(e.target.value)))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogTambahItemOpen(false)}
              disabled={sedangTambahItem}
            >
              Batal
            </Button>
            <Button
              onClick={handleSimpanTambahItem}
              disabled={sedangTambahItem || !itemIdDipilih}
              className="bg-primary text-primary-foreground hover:bg-primary-strong"
            >
              {sedangTambahItem ? "Menyimpan..." : "Tambah ke Tagihan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Hapus Item (Kepala Mekanik & Owner) */}
      <Dialog open={dialogHapusItemOpen} onOpenChange={setDialogHapusItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <Trash2 className="size-5" />
              Hapus Item dari Tagihan
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus item{" "}
              <strong>{itemAkanDihapus?.nama_item}</strong> sebanyak{" "}
              <strong>{itemAkanDihapus?.jumlah}</strong> dari Work Order ini?
            </DialogDescription>
          </DialogHeader>

          {itemAkanDihapus?.jenis === "part" && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
              <Info className="size-4 inline mr-1" />
              Stok suku cadang sebanyak <strong>{itemAkanDihapus.jumlah} unit</strong> akan otomatis
              dikembalikan ke gudang inventory.
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogHapusItemOpen(false)}
              disabled={sedangHapusItem}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleKonfirmasiHapusItem}
              disabled={sedangHapusItem}
            >
              {sedangHapusItem ? "Menghapus..." : "Ya, Hapus Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog 1: Sesuaikan Harga */}
      <Dialog open={dialogHargaOpen} onOpenChange={setDialogHargaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sesuaikan Harga Item</DialogTitle>
            <DialogDescription>
              Penyesuaian harga item: <strong>{itemDipilih?.nama_item}</strong>. Harga master
              asli tidak akan berubah.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Harga Master Saat Ini</Label>
              <Input
                disabled
                value={rupiah(itemDipilih?.harga_master ?? 0)}
                className="bg-muted text-text-muted"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="inputHargaBaru">Harga Dipakai Baru (Rp) *</Label>
              <Input
                id="inputHargaBaru"
                type="number"
                min={0}
                value={hargaBaru}
                onChange={(e) => setHargaBaru(Number(e.target.value))}
                placeholder="Masukkan nominal harga"
              />
            </div>

            <div className="space-y-1">
              <Label>Alasan Penyesuaian *</Label>
              <Select value={opsiAlasan} onValueChange={setOpsiAlasan}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih alasan" />
                </SelectTrigger>
                <SelectContent>
                  {OPSI_ALASAN.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {opsiAlasan === "Lainnya" && (
              <div className="space-y-1">
                <Label htmlFor="inputAlasanKustom">Tuliskan Alasan Lengkap *</Label>
                <Input
                  id="inputAlasanKustom"
                  value={alasanKustom}
                  onChange={(e) => setAlasanKustom(e.target.value)}
                  placeholder="Contoh: Kesepakatan khusus dengan pelanggan"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogHargaOpen(false)}
              disabled={sedangSimpanHarga}
            >
              Batal
            </Button>
            <Button onClick={handleSimpanHarga} disabled={sedangSimpanHarga}>
              {sedangSimpanHarga ? "Menyimpan..." : "Simpan Penyesuaian"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog 2: Atur Diskon */}
      <Dialog open={dialogDiskonOpen} onOpenChange={setDialogDiskonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atur Diskon Total</DialogTitle>
            <DialogDescription>
              Diskon akan memotong subtotal tagihan Work Order ini sebelum invoice diterbitkan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Subtotal Saat Ini</Label>
              <Input disabled value={rupiah(subtotal)} className="bg-muted text-text-muted" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="inputDiskon">Nominal Diskon (Rp)</Label>
              <Input
                id="inputDiskon"
                type="number"
                min={0}
                max={subtotal}
                value={inputDiskon}
                onChange={(e) => setInputDiskon(Number(e.target.value))}
                placeholder="0"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="inputAlasanDiskon">Alasan Diskon (Wajib bila diskon &gt; 0)</Label>
              <Input
                id="inputAlasanDiskon"
                value={inputAlasanDiskon}
                onChange={(e) => setInputAlasanDiskon(e.target.value)}
                placeholder="Contoh: Promo akhir pekan / Pelanggan loyal"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogDiskonOpen(false)}
              disabled={sedangSimpanDiskon}
            >
              Batal
            </Button>
            <Button onClick={handleSimpanDiskon} disabled={sedangSimpanDiskon}>
              {sedangSimpanDiskon ? "Menyimpan..." : "Simpan Diskon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog 3: Konfirmasi Terbitkan Invoice */}
      <Dialog open={dialogInvoiceOpen} onOpenChange={setDialogInvoiceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terbitkan Invoice Resmi</DialogTitle>
            <DialogDescription>
              Pastikan seluruh baris tagihan dan diskon sudah sesuai. Setelah invoice diterbitkan,
              daftar item dan nominal tagihan akan <strong>terkunci</strong> dan tidak dapat
              diubah lagi.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Subtotal:</span>
              <span className="font-medium text-text">{rupiah(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Diskon:</span>
              <span className="font-medium text-danger">-{rupiah(diskon)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-bold text-text">
              <span>Total Tagihan:</span>
              <span className="text-primary">{rupiah(total)}</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogInvoiceOpen(false)}
              disabled={sedangTerbitkan}
            >
              Periksa Kembali
            </Button>
            <Button
              onClick={handleTerbitkanInvoice}
              disabled={sedangTerbitkan}
              className="bg-primary text-primary-foreground hover:bg-primary-strong"
            >
              {sedangTerbitkan ? "Menerbitkan..." : "Ya, Terbitkan Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog 4: Catat Pembayaran */}
      <Dialog open={dialogBayarOpen} onOpenChange={setDialogBayarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catat Pembayaran Tagihan</DialogTitle>
            <DialogDescription>
              Mencatat pembayaran untuk Invoice <strong>{invoice?.nomor}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Sisa Tagihan Saat Ini</Label>
              <Input disabled value={rupiah(sisa)} className="bg-muted font-semibold text-danger" />
            </div>

            <div className="space-y-1">
              <Label>Metode Pembayaran</Label>
              <Select value={metodeBayar} onValueChange={setMetodeBayar}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih metode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tunai">Tunai (Cash)</SelectItem>
                  <SelectItem value="transfer">Transfer Bank</SelectItem>
                  <SelectItem value="qris">QRIS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="inputJumlahBayar">Jumlah Pembayaran (Rp) *</Label>
              <Input
                id="inputJumlahBayar"
                type="number"
                min={1}
                max={sisa}
                value={jumlahBayar}
                onChange={(e) => setJumlahBayar(Number(e.target.value))}
                placeholder="Masukkan nominal"
              />
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-primary"
                  onClick={() => setJumlahBayar(sisa)}
                >
                  Bayar Penuh ({rupiah(sisa)})
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogBayarOpen(false)}
              disabled={sedangSimpanBayar}
            >
              Batal
            </Button>
            <Button
              onClick={handleCatatPembayaran}
              disabled={sedangSimpanBayar}
              className="bg-success text-white hover:bg-success/90"
            >
              {sedangSimpanBayar ? "Menyimpan..." : "Simpan Pembayaran"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog 5: Info Alasan Penyesuaian Harga */}
      <Dialog open={Boolean(itemDetail)} onOpenChange={(b) => !b && setItemDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning" />
              Detail Penyesuaian Harga
            </DialogTitle>
            <DialogDescription>
              Item: <strong>{itemDetail?.nama_item}</strong>
            </DialogDescription>
          </DialogHeader>

          {itemDetail && (
            <div className="space-y-3 py-2 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-text-muted">Harga Master:</span>
                <span className="text-text line-through">{rupiah(itemDetail.harga_master)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-text-muted">Harga Dipakai:</span>
                <span className="font-semibold text-primary">
                  {rupiah(itemDetail.harga_dipakai)}
                </span>
              </div>
              <div className="space-y-1 border-b pb-2">
                <span className="text-text-muted">Alasan Penyesuaian:</span>
                <p className="font-medium text-text bg-muted/50 p-2 rounded">
                  {itemDetail.alasan_penyesuaian ?? "Tidak ada alasan tercatat"}
                </p>
              </div>
              <div className="flex justify-between text-xs text-text-muted pt-1">
                <span>Disesuaikan oleh: {itemDetail.disesuaikan_profil?.nama ?? "Petugas"}</span>
                <span>
                  {itemDetail.disesuaikan_at ? tanggal(itemDetail.disesuaikan_at) : "-"}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDetail(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
