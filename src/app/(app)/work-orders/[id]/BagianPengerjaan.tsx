"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import {
  Wrench,
  Trash2,
  CheckCircle,
  XCircle,
  Camera,
  Loader2,
  Package,
  Layers,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { rupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { GaleriFotoWO } from "./ModalFoto";
import type { FotoItem } from "./BagianDataMasuk";

interface BillingItem {
  id: string;
  nama_item: string;
  jenis: string;
  jumlah: number;
  harga_master: number;
  harga_dipakai: number;
}

interface PengerjaanProps {
  wo: {
    id: string;
    status: string;
    kepala_mekanik_id: string;
  };
  profil: {
    id: string;
    nama: string;
    peran: "owner" | "admin" | "kepala_mekanik";
  };
  billingItems: BillingItem[];
  daftarPart: { id: string; nama: string; kode: string; stok: number; harga_jual: number }[];
  daftarJasa: { id: string; nama: string; kode: string; harga_jual: number }[];
  fotoPengerjaan: FotoItem[];
}

export function BagianPengerjaan({
  wo,
  profil,
  billingItems,
  daftarPart,
  daftarJasa,
  fotoPengerjaan,
}: PengerjaanProps) {
  const router = useRouter();
  const supabase = createClient();

  const isOwner = profil.peran === "owner";
  const isKepalaMekanikTim =
    profil.peran === "kepala_mekanik" && wo.kepala_mekanik_id === profil.id;

  const bolehUbah = (isOwner || isKepalaMekanikTim) && wo.status === "dikerjakan";
  const bolehQC = (isOwner || isKepalaMekanikTim) && wo.status === "selesai";

  // Modal State
  const [modalPartBuka, setModalPartBuka] = useState(false);
  const [modalJasaBuka, setModalJasaBuka] = useState(false);
  const [modalQcGagalBuka, setModalQcGagalBuka] = useState(false);

  // Form Part
  const [partIdTerpilih, setPartIdTerpilih] = useState("");
  const [jumlahPart, setJumlahPart] = useState(1);

  // Form Jasa
  const [jasaIdTerpilih, setJasaIdTerpilih] = useState("");
  const [jumlahJasa, setJumlahJasa] = useState(1);

  // Form QC Gagal
  const [catatanQcGagal, setCatatanQcGagal] = useState("");

  const [loading, setLoading] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  // Tambah Spare Part
  const handleTambahPart = async () => {
    const part = daftarPart.find((p) => p.id === partIdTerpilih);
    if (!part) {
      toast.error("Pilih spare part terlebih dahulu");
      return;
    }

    if (jumlahPart <= 0) {
      toast.error("Jumlah harus minimal 1");
      return;
    }

    if (part.stok < jumlahPart) {
      toast.error(`Stok ${part.nama} hanya ${part.stok}`);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("tambah_item_tagihan", {
        p_wo: wo.id,
        p_item: part.id,
        p_jumlah: jumlahPart,
      });

      if (error) throw error;

      toast.success(`${part.nama} berhasil ditambahkan`);
      setModalPartBuka(false);
      setPartIdTerpilih("");
      setJumlahPart(1);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menambahkan spare part");
    } finally {
      setLoading(false);
    }
  };

  // Tambah Jasa
  const handleTambahJasa = async () => {
    const jasa = daftarJasa.find((j) => j.id === jasaIdTerpilih);
    if (!jasa) {
      toast.error("Pilih jasa terlebih dahulu");
      return;
    }

    if (jumlahJasa <= 0) {
      toast.error("Jumlah harus minimal 1");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("tambah_item_tagihan", {
        p_wo: wo.id,
        p_item: jasa.id,
        p_jumlah: jumlahJasa,
      });

      if (error) throw error;

      toast.success(`${jasa.nama} berhasil ditambahkan`);
      setModalJasaBuka(false);
      setJasaIdTerpilih("");
      setJumlahJasa(1);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menambahkan jasa");
    } finally {
      setLoading(false);
    }
  };

  // Hapus Item
  const handleHapusItem = async (itemId: string, namaItem: string) => {
    if (!confirm(`Hapus ${namaItem}? Stok spare part akan dikembalikan.`)) return;

    setLoading(true);
    try {
      const { error } = await supabase.rpc("hapus_item_tagihan", {
        p_billing_item: itemId,
      });

      if (error) throw error;

      toast.success(`${namaItem} berhasil dihapus`);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus item");
    } finally {
      setLoading(false);
    }
  };

  // Unggah Foto Pengerjaan (opsional di folder pengerjaan)
  const handleUploadFotoPengerjaan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFoto(true);
    try {
      const uidFoto = crypto.randomUUID();
      const fullOpts = {
        maxSizeMB: 0.4,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/webp" as const,
        initialQuality: 0.8,
      };
      const thumbOpts = {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 320,
        useWebWorker: true,
        fileType: "image/webp" as const,
        initialQuality: 0.8,
      };

      const compFull = await imageCompression(file, fullOpts);
      const compThumb = await imageCompression(file, thumbOpts);

      const pathFull = `${wo.id}/pengerjaan/${uidFoto}.webp`;
      const pathThumb = `${wo.id}/pengerjaan/thumb/${uidFoto}.webp`;

      await supabase.storage.from("foto-wo").upload(pathFull, compFull, { contentType: "image/webp" });
      await supabase.storage.from("foto-wo").upload(pathThumb, compThumb, { contentType: "image/webp" });

      await supabase.from("work_order_photos").insert({
        work_order_id: wo.id,
        jenis: "pengerjaan",
        path: pathFull,
        diunggah_oleh: profil.id,
      });

      toast.success("Foto pengerjaan berhasil diunggah!");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah foto pengerjaan");
    } finally {
      setUploadingFoto(false);
    }
  };

  // QC Lulus
  const handleQcLulus = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc("ubah_status_wo", {
        p_wo: wo.id,
        p_status: "siap_diambil",
        p_catatan: "QC Lulus - Mobil siap diserahkan",
      });

      if (error) throw error;

      toast.success("Pemeriksaan QC Lulus! Mobil siap diambil & ditagih.");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui status QC");
    } finally {
      setLoading(false);
    }
  };

  // QC Gagal
  const handleQcGagal = async () => {
    if (!catatanQcGagal.trim()) {
      toast.error("Wajib mengisi catatan perbaikan saat QC gagal");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("ubah_status_wo", {
        p_wo: wo.id,
        p_status: "dikerjakan",
        p_catatan: catatanQcGagal.trim(),
      });

      if (error) throw error;

      toast.success("Mobil dikembalikan ke status dikerjakan untuk perbaikan");
      setModalQcGagalBuka(false);
      setCatatanQcGagal("");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mencatat QC gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card id="bagian-pengerjaan" className="border-border shadow-card">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="space-y-0.5">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Wrench className="size-4 text-primary" />
            Bagian C. Pengerjaan Servis & Spare Part
          </CardTitle>
          <p className="text-xs text-text-muted">
            Catatan penggunaan suku cadang, jasa servis, dan pemeriksaan QC
          </p>
        </div>

        {bolehUbah && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setModalPartBuka(true)}
              className="h-8 gap-1 text-xs"
            >
              <Package className="size-3.5" />
              + Spare Part
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setModalJasaBuka(true)}
              className="h-8 gap-1 text-xs"
            >
              <Layers className="size-3.5" />
              + Jasa
            </Button>

            <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-input bg-card px-2.5 text-xs font-medium shadow-xs hover:bg-muted">
              {uploadingFoto ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
              <span>Foto</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleUploadFotoPengerjaan}
                disabled={uploadingFoto}
                className="hidden"
              />
            </label>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Banner Pemeriksaan QC bila status 'selesai' */}
        {bolehQC && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-text">Pemeriksaan Hasil Kerja (Quality Control)</h3>
                <p className="text-xs text-text-muted">
                  Periksa kondisi fisik dan uji hasil pengerjaan mobil sebelum diserahkan ke pelanggan
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setModalQcGagalBuka(true)}
                  disabled={loading}
                  className="border-danger text-danger hover:bg-danger/10"
                >
                  <XCircle className="mr-1.5 size-4" />
                  QC Gagal
                </Button>
                <Button
                  size="sm"
                  onClick={handleQcLulus}
                  disabled={loading}
                  className="bg-success text-white hover:bg-success/90"
                >
                  {loading ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <CheckCircle className="mr-1.5 size-4" />}
                  QC Lulus
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tabel Penggunaan Part & Jasa */}
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-16 font-semibold">Jenis</TableHead>
                <TableHead className="font-semibold">Nama Item</TableHead>
                <TableHead className="text-right font-semibold">Jumlah</TableHead>
                <TableHead className="text-right font-semibold">Tarif / Harga</TableHead>
                <TableHead className="text-right font-semibold">Subtotal</TableHead>
                {bolehUbah && <TableHead className="w-12 text-center" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {billingItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={bolehUbah ? 6 : 5}
                    className="py-8 text-center text-xs text-text-muted"
                  >
                    {wo.status === "menunggu"
                      ? "Pekerjaan belum dimulai. Spare part dan jasa dicatat saat status Dikerjakan."
                      : "Belum ada spare part atau jasa yang dicatat. Tambahkan minimal 1 item sebelum menyelesaikan pengerjaan."}
                  </TableCell>
                </TableRow>
              ) : (
                billingItems.map((bi) => {
                  const subtotal = bi.jumlah * bi.harga_dipakai;
                  return (
                    <TableRow key={bi.id}>
                      <TableCell>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${
                            bi.jenis === "part"
                              ? "bg-primary-soft text-primary-strong"
                              : "bg-muted text-text-body"
                          }`}
                        >
                          {bi.jenis}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-text">{bi.nama_item}</TableCell>
                      <TableCell className="text-right tabular-nums text-text-body">
                        {bi.jumlah}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-text-body">
                        {rupiah(bi.harga_dipakai)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-text">
                        {rupiah(subtotal)}
                      </TableCell>
                      {bolehUbah && (
                        <TableCell className="text-center">
                          <button
                            type="button"
                            onClick={() => handleHapusItem(bi.id, bi.nama_item)}
                            disabled={loading}
                            className="rounded p-1 text-danger hover:bg-danger/10"
                            title="Hapus item & kembalikan stok"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Galeri Foto Pengerjaan */}
        {fotoPengerjaan.length > 0 && (
          <div className="pt-2">
            <GaleriFotoWO judul="Foto Pengerjaan" foto={fotoPengerjaan} />
          </div>
        )}
      </CardContent>

      {/* Modal Tambah Spare Part */}
      <Dialog open={modalPartBuka} onOpenChange={setModalPartBuka}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>+ Tambah Spare Part</DialogTitle>
            <DialogDescription>
              Stok akan otomatis dikurangi dan dicatat ke riwayat pergerakan stok.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="pilihPart">Pilih Spare Part *</Label>
              <select
                id="pilihPart"
                value={partIdTerpilih}
                onChange={(e) => setPartIdTerpilih(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              >
                <option value="">-- Pilih Spare Part --</option>
                {daftarPart.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.stok <= 0}>
                    {p.kode} - {p.nama} (Stok: {p.stok}) - {rupiah(p.harga_jual)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="jmlPart">Jumlah *</Label>
              <Input
                id="jmlPart"
                type="number"
                min={1}
                value={jumlahPart}
                onChange={(e) => setJumlahPart(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalPartBuka(false)}>
              Batal
            </Button>
            <Button
              onClick={handleTambahPart}
              disabled={loading || !partIdTerpilih || jumlahPart <= 0}
              className="bg-primary hover:bg-primary-strong"
            >
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Tambahkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Tambah Jasa */}
      <Dialog open={modalJasaBuka} onOpenChange={setModalJasaBuka}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>+ Tambah Jasa Servis</DialogTitle>
            <DialogDescription>
              Pilih jenis pekerjaan atau jasa perbaikan yang dilakukan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="pilihJasa">Pilih Jasa *</Label>
              <select
                id="pilihJasa"
                value={jasaIdTerpilih}
                onChange={(e) => setJasaIdTerpilih(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              >
                <option value="">-- Pilih Jasa Servis --</option>
                {daftarJasa.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.kode} - {j.nama} - {rupiah(j.harga_jual)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="jmlJasa">Jumlah *</Label>
              <Input
                id="jmlJasa"
                type="number"
                min={1}
                value={jumlahJasa}
                onChange={(e) => setJumlahJasa(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalJasaBuka(false)}>
              Batal
            </Button>
            <Button
              onClick={handleTambahJasa}
              disabled={loading || !jasaIdTerpilih || jumlahJasa <= 0}
              className="bg-primary hover:bg-primary-strong"
            >
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Tambahkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal QC Gagal */}
      <Dialog open={modalQcGagalBuka} onOpenChange={setModalQcGagalBuka}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catatan QC Gagal</DialogTitle>
            <DialogDescription>
              Tuliskan alasan mengapa pemeriksaan fisik/uji jalan tidak lulus agar diperbaiki mekanik.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Contoh: Bunyi rem masih ada saat deselerasi, perlu dibersihkan ulang..."
              rows={3}
              value={catatanQcGagal}
              onChange={(e) => setCatatanQcGagal(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalQcGagalBuka(false)}>
              Batal
            </Button>
            <Button
              onClick={handleQcGagal}
              disabled={loading || !catatanQcGagal.trim()}
              variant="destructive"
            >
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Kembalikan ke Pengerjaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
