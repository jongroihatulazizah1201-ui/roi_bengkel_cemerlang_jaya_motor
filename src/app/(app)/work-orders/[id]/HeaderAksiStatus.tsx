"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import {
  Play,
  Pause,
  CheckCircle,
  CheckCheck,
  RotateCcw,
  Ban,
  CarFront,
  Camera,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { BadgeStatus } from "@/components/BadgeStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

interface HeaderAksiProps {
  wo: {
    id: string;
    nomor: string;
    status: string;
    kepala_mekanik_id: string;
    estimasi_selesai: string | null;
  };
  profil: {
    id: string;
    nama: string;
    peran: "owner" | "admin" | "kepala_mekanik";
  };
  adaMekanik: boolean;
  adaTagihan: boolean;
  invoiceLunas: boolean;
  adaFotoAkhir: boolean;
}

export function HeaderAksiStatus({
  wo,
  profil,
  adaMekanik,
  adaTagihan,
  invoiceLunas,
  adaFotoAkhir,
}: HeaderAksiProps) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [dialogBuka, setDialogBuka] = useState<string | null>(null);
  const [catatanInput, setCatatanInput] = useState("");
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const hariIni = new Date().toISOString().split("T")[0];
  const isTerlambat =
    wo.estimasi_selesai &&
    wo.estimasi_selesai < hariIni &&
    !["selesai", "siap_diambil", "diambil", "dibatalkan"].includes(wo.status);

  // Periksa izin peran & tim
  const isOwner = profil.peran === "owner";
  const isAdmin = profil.peran === "admin";
  const isKepalaMekanikTim =
    profil.peran === "kepala_mekanik" && wo.kepala_mekanik_id === profil.id;

  const bolehAksiMekanik = isOwner || isKepalaMekanikTim;
  const bolehAksiAdmin = isOwner || isAdmin;

  // Eksekusi perubahan status lewat RPC
  const ubahStatus = async (statusTujuan: string, catatan?: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc("ubah_status_wo", {
        p_wo: wo.id,
        p_status: statusTujuan,
        p_catatan: catatan || null,
      });

      if (error) throw error;

      toast.success(`Status berhasil diubah menjadi ${statusTujuan.replace("_", " ")}`);
      setDialogBuka(null);
      setCatatanInput("");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status work order");
    } finally {
      setLoading(false);
    }
  };

  // Upload Foto Kondisi Akhir saat status siap_diambil
  const handleUploadKondisiAkhir = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      const pathFull = `${wo.id}/kondisi_akhir/${uidFoto}.webp`;
      const pathThumb = `${wo.id}/kondisi_akhir/thumb/${uidFoto}.webp`;

      await supabase.storage.from("foto-wo").upload(pathFull, compFull, { contentType: "image/webp" });
      await supabase.storage.from("foto-wo").upload(pathThumb, compThumb, { contentType: "image/webp" });

      await supabase.from("work_order_photos").insert({
        work_order_id: wo.id,
        jenis: "kondisi_akhir",
        path: pathFull,
        diunggah_oleh: profil.id,
      });

      toast.success("Foto kondisi akhir berhasil diunggah!");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah foto kondisi akhir");
    } finally {
      setUploadingFoto(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-card sm:p-6">
      {/* Kiri: Nomor WO & Badges */}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-text">{wo.nomor}</h1>
          <BadgeStatus status={wo.status} />
          {isTerlambat && (
            <Badge variant="destructive" className="bg-danger text-xs text-white">
              Terlambat
            </Badge>
          )}
        </div>
        <p className="text-xs text-text-muted">
          Perubahan status dicatat ke riwayat dan diawasi aturan keamanan sistem
        </p>
      </div>

      {/* Kanan: Tombol-tombol aksi sesuai state machine PRD 7.2 */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status: MENUNGGU */}
        {wo.status === "menunggu" && (
          <>
            {bolehAksiMekanik && (
              <Button
                onClick={() => {
                  if (!adaMekanik || !wo.estimasi_selesai) {
                    toast.error("Lengkapi penugasan mekanik dan estimasi selesai di Bagian B sebelum mulai");
                    // Scroll ke bagian penugasan
                    document.getElementById("bagian-penugasan")?.scrollIntoView({ behavior: "smooth" });
                    return;
                  }
                  ubahStatus("dikerjakan");
                }}
                disabled={loading}
                className="bg-primary hover:bg-primary-strong"
              >
                {loading ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Play className="mr-1.5 size-4" />}
                Mulai Kerjakan
              </Button>
            )}

            {bolehAksiAdmin && (
              <Button
                variant="outline"
                className="text-danger hover:bg-danger/10 hover:text-danger"
                onClick={() => {
                  setCatatanInput("");
                  setDialogBuka("batal");
                }}
                disabled={loading}
              >
                <Ban className="mr-1.5 size-4" />
                Batalkan WO
              </Button>
            )}
          </>
        )}

        {/* Status: DIKERJAKAN */}
        {wo.status === "dikerjakan" && (
          <>
            {bolehAksiMekanik && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCatatanInput("");
                    setDialogBuka("tunda");
                  }}
                  disabled={loading}
                  className="border-warning text-warning hover:bg-warning/10"
                >
                  <Pause className="mr-1.5 size-4" />
                  Tunda
                </Button>

                <Button
                  onClick={() => {
                    if (!adaTagihan) {
                      toast.error("Catat minimal 1 jasa atau spare part di Bagian C sebelum menyelesaikan");
                      document.getElementById("bagian-pengerjaan")?.scrollIntoView({ behavior: "smooth" });
                      return;
                    }
                    ubahStatus("selesai");
                  }}
                  disabled={loading || !adaTagihan}
                  className="bg-primary hover:bg-primary-strong"
                  title={!adaTagihan ? "Catat minimal 1 jasa atau spare part" : ""}
                >
                  {loading ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <CheckCircle className="mr-1.5 size-4" />}
                  Selesai Dikerjakan
                </Button>
              </>
            )}

            {bolehAksiAdmin && (
              <Button
                variant="outline"
                className="text-danger hover:bg-danger/10 hover:text-danger"
                onClick={() => {
                  setCatatanInput("");
                  setDialogBuka("batal");
                }}
                disabled={loading}
              >
                <Ban className="mr-1.5 size-4" />
                Batalkan WO
              </Button>
            )}
          </>
        )}

        {/* Status: TERTUNDA */}
        {wo.status === "tertunda" && (
          <>
            {bolehAksiMekanik && (
              <Button
                onClick={() => ubahStatus("dikerjakan")}
                disabled={loading}
                className="bg-primary hover:bg-primary-strong"
              >
                {loading ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Play className="mr-1.5 size-4" />}
                Lanjutkan Pengerjaan
              </Button>
            )}

            {bolehAksiAdmin && (
              <Button
                variant="outline"
                className="text-danger hover:bg-danger/10 hover:text-danger"
                onClick={() => {
                  setCatatanInput("");
                  setDialogBuka("batal");
                }}
                disabled={loading}
              >
                <Ban className="mr-1.5 size-4" />
                Batalkan WO
              </Button>
            )}
          </>
        )}

        {/* Status: SELESAI */}
        {wo.status === "selesai" && bolehAksiMekanik && (
          <>
            <Button
              variant="outline"
              onClick={() => {
                setCatatanInput("");
                setDialogBuka("qc_gagal");
              }}
              disabled={loading}
              className="border-danger text-danger hover:bg-danger/10"
            >
              <RotateCcw className="mr-1.5 size-4" />
              QC Gagal
            </Button>

            <Button
              onClick={() => ubahStatus("siap_diambil", "QC Lulus")}
              disabled={loading}
              className="bg-success text-white hover:bg-success/90"
            >
              {loading ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <CheckCheck className="mr-1.5 size-4" />}
              QC Lulus
            </Button>
          </>
        )}

        {/* Status: SIAP_DIAMBIL */}
        {wo.status === "siap_diambil" && bolehAksiAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            {!adaFotoAkhir && (
              <label className="inline-flex cursor-pointer items-center rounded-md border border-input bg-card px-3 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-muted">
                {uploadingFoto ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Camera className="mr-2 size-4 text-primary" />
                )}
                <span>{uploadingFoto ? "Mengunggah..." : "+ Foto Kondisi Akhir"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadKondisiAkhir}
                  disabled={uploadingFoto}
                  className="hidden"
                />
              </label>
            )}

            <Button
              onClick={() => ubahStatus("diambil")}
              disabled={loading || !invoiceLunas || !adaFotoAkhir}
              className="bg-success text-white hover:bg-success/90"
              title={
                !invoiceLunas
                  ? "Invoice harus lunas terlebih dahulu"
                  : !adaFotoAkhir
                  ? "Unggah minimal 1 foto kondisi akhir"
                  : ""
              }
            >
              {loading ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <CarFront className="mr-1.5 size-4" />}
              Serahkan Mobil
            </Button>
          </div>
        )}
      </div>

      {/* Dialog Alasan Penundaan */}
      <Dialog open={dialogBuka === "tunda"} onOpenChange={(open) => !open && setDialogBuka(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tunda Pengerjaan</DialogTitle>
            <DialogDescription>
              Tuliskan alasan pengerjaan dihentikan sementara (contoh: menunggu spare part datang).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Alasan penundaan (wajib)..."
            value={catatanInput}
            onChange={(e) => setCatatanInput(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogBuka(null)}>
              Batal
            </Button>
            <Button
              disabled={loading || !catatanInput.trim()}
              onClick={() => ubahStatus("tertunda", catatanInput.trim())}
              className="bg-warning text-white hover:bg-warning/90"
            >
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Tunda Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog QC Gagal */}
      <Dialog open={dialogBuka === "qc_gagal"} onOpenChange={(open) => !open && setDialogBuka(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pemeriksaan QC Gagal</DialogTitle>
            <DialogDescription>
              Tuliskan catatan perbaikan yang harus dilakukan mekanik sebelum diperiksa kembali.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Catatan hasil periksa yang gagal (wajib)..."
            value={catatanInput}
            onChange={(e) => setCatatanInput(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogBuka(null)}>
              Batal
            </Button>
            <Button
              disabled={loading || !catatanInput.trim()}
              onClick={() => ubahStatus("dikerjakan", catatanInput.trim())}
              variant="destructive"
            >
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Kembalikan ke Pengerjaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Pembatalan WO */}
      <Dialog open={dialogBuka === "batal"} onOpenChange={(open) => !open && setDialogBuka(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan Work Order</DialogTitle>
            <DialogDescription>
              Tindakan ini tidak dapat dibatalkan. Spare part yang telah dicatat akan otomatis dikembalikan ke stok inventaris.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Alasan pembatalan work order (wajib)..."
            value={catatanInput}
            onChange={(e) => setCatatanInput(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogBuka(null)}>
              Batal
            </Button>
            <Button
              disabled={loading || !catatanInput.trim()}
              onClick={() => ubahStatus("dibatalkan", catatanInput.trim())}
              variant="destructive"
            >
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Batalkan Work Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
