"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Car,
  Phone,
  FileText,
  Stethoscope,
  Pencil,
  Check,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { GaleriFotoWO } from "./ModalFoto";

export interface FotoItem {
  id: string;
  jenis: string;
  url: string;
  thumbUrl?: string;
}

interface DataMasukProps {
  wo: {
    id: string;
    status: string;
    odometer: number;
    keluhan: string;
    diagnosis: string | null;
    kepala_mekanik_id: string;
    vehicles: {
      plat: string;
      merek_model: string;
      tahun: number | null;
      warna: string | null;
      transmisi: string | null;
    } | null;
    customers: {
      id: string;
      nama: string;
      telepon: string;
      email: string | null;
      alamat: string | null;
      tipe: string;
    } | null;
  };
  profil: {
    id: string;
    nama: string;
    peran: "owner" | "admin" | "kepala_mekanik";
  };
  fotoStnk: FotoItem[];
  fotoKondisiAwal: FotoItem[];
  fotoKondisiAkhir: FotoItem[];
}

export function BagianDataMasuk({
  wo,
  profil,
  fotoStnk,
  fotoKondisiAwal,
  fotoKondisiAkhir,
}: DataMasukProps) {
  const router = useRouter();
  const supabase = createClient();

  const isOwner = profil.peran === "owner";
  const isAdmin = profil.peran === "admin";
  const isKepalaMekanikTim =
    profil.peran === "kepala_mekanik" && wo.kepala_mekanik_id === profil.id;

  // Izin edit keluhan & odometer (Admin & Owner saat status 'menunggu')
  const bolehEditDataMasuk = (isOwner || isAdmin) && wo.status === "menunggu";
  const [editDataMasuk, setEditDataMasuk] = useState(false);
  const [odometerInput, setOdometerInput] = useState(wo.odometer);
  const [keluhanInput, setKeluhanInput] = useState(wo.keluhan);
  const [loadingDataMasuk, setLoadingDataMasuk] = useState(false);

  // Izin edit diagnosis (Kepala Mekanik tim WO & Owner saat status 'dikerjakan' atau 'tertunda')
  const bolehEditDiagnosis =
    (isOwner || isKepalaMekanikTim) && ["dikerjakan", "tertunda"].includes(wo.status);
  const [editDiagnosis, setEditDiagnosis] = useState(false);
  const [diagnosisInput, setDiagnosisInput] = useState(wo.diagnosis || "");
  const [loadingDiagnosis, setLoadingDiagnosis] = useState(false);

  // Simpan Odometer & Keluhan
  const handleSimpanDataMasuk = async () => {
    if (odometerInput < 0 || !keluhanInput.trim()) {
      toast.error("Odometer dan keluhan wajib diisi dengan benar");
      return;
    }

    setLoadingDataMasuk(true);
    try {
      const { error } = await supabase
        .from("work_orders")
        .update({
          odometer: Number(odometerInput),
          keluhan: keluhanInput.trim(),
        })
        .eq("id", wo.id);

      if (error) throw error;

      toast.success("Data keluhan dan odometer berhasil diperbarui");
      setEditDataMasuk(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui data masuk");
    } finally {
      setLoadingDataMasuk(false);
    }
  };

  // Simpan Diagnosis
  const handleSimpanDiagnosis = async () => {
    setLoadingDiagnosis(true);
    try {
      const { error } = await supabase
        .from("work_orders")
        .update({
          diagnosis: diagnosisInput.trim() || null,
        })
        .eq("id", wo.id);

      if (error) throw error;

      toast.success("Diagnosis berhasil diperbarui");
      setEditDiagnosis(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui diagnosis");
    } finally {
      setLoadingDiagnosis(false);
    }
  };

  // Format nomor WhatsApp internasional (0812... -> 62812...)
  const formatWa = (telp: string) => {
    let clean = telp.replace(/\D/g, "");
    if (clean.startsWith("0")) clean = "62" + clean.slice(1);
    return clean;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">Bagian A. Data Masuk</h2>
        <span className="text-xs text-text-muted">Pelanggan, Kendaraan & Kondisi Awal</span>
      </div>

      {/* Baris 1: Kartu Pelanggan & Kendaraan */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Pelanggan */}
        <Card className="border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <User className="size-4 text-primary" />
              Pelanggan
            </CardTitle>
            <span className="text-xs font-medium uppercase text-text-muted">
              {wo.customers?.tipe ?? "perorangan"}
            </span>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-lg font-bold text-text">{wo.customers?.nama ?? "-"}</div>
              {wo.customers?.email && (
                <div className="text-xs text-text-muted">{wo.customers.email}</div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-2.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Phone className="size-4 text-text-muted" />
                <span>{wo.customers?.telepon ?? "-"}</span>
              </div>
              {wo.customers?.telepon && (
                <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs text-success border-success/30 hover:bg-success/10">
                  <a
                    href={`https://wa.me/${formatWa(wo.customers.telepon)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                    <ExternalLink className="size-3" />
                  </a>
                </Button>
              )}
            </div>

            {wo.customers?.alamat && (
              <div className="text-xs text-text-body">
                <span className="font-semibold text-text-muted">Alamat: </span>
                {wo.customers.alamat}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Kendaraan */}
        <Card className="border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Car className="size-4 text-primary" />
              Kendaraan
            </CardTitle>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {wo.vehicles?.plat ?? "-"}
            </span>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-lg font-bold text-text">{wo.vehicles?.merek_model ?? "-"}</div>
              <div className="text-xs text-text-muted">
                Tahun {wo.vehicles?.tahun ?? "-"} · Warna {wo.vehicles?.warna ?? "-"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-muted/40 p-2">
                <div className="text-text-muted">Transmisi</div>
                <div className="font-semibold text-text">
                  {wo.vehicles?.transmisi === "AT" ? "Otomatis (AT)" : "Manual (MT)"}
                </div>
              </div>
              <div className="rounded-md bg-muted/40 p-2">
                <div className="text-text-muted">Odometer Masuk</div>
                <div className="font-semibold text-text">
                  {wo.odometer.toLocaleString("id-ID")} km
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Baris 2: Keluhan & Diagnosis */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Keluhan & Odometer */}
        <Card className="border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <FileText className="size-4 text-primary" />
              Keluhan Masuk
            </CardTitle>
            {bolehEditDataMasuk && !editDataMasuk && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditDataMasuk(true)}
                className="h-8 gap-1 text-xs text-primary"
              >
                <Pencil className="size-3.5" />
                Ubah
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {editDataMasuk ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="editOdo">Odometer (km)</Label>
                  <Input
                    id="editOdo"
                    type="number"
                    min={0}
                    value={odometerInput}
                    onChange={(e) => setOdometerInput(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editKeluhan">Keluhan Pelanggan</Label>
                  <Textarea
                    id="editKeluhan"
                    rows={3}
                    value={keluhanInput}
                    onChange={(e) => setKeluhanInput(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditDataMasuk(false);
                      setOdometerInput(wo.odometer);
                      setKeluhanInput(wo.keluhan);
                    }}
                    disabled={loadingDataMasuk}
                  >
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSimpanDataMasuk}
                    disabled={loadingDataMasuk}
                    className="bg-primary hover:bg-primary-strong"
                  >
                    {loadingDataMasuk ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Simpan
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                  {wo.keluhan}
                </p>
                <div className="mt-3 text-xs text-text-muted">
                  Odometer saat datang:{" "}
                  <span className="font-semibold text-text">
                    {wo.odometer.toLocaleString("id-ID")} km
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Diagnosis Mekanik */}
        <Card className="border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Stethoscope className="size-4 text-primary" />
              Diagnosis Mekanik
            </CardTitle>
            {bolehEditDiagnosis && !editDiagnosis && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditDiagnosis(true)}
                className="h-8 gap-1 text-xs text-primary"
              >
                <Pencil className="size-3.5" />
                {wo.diagnosis ? "Ubah" : "Isi Diagnosis"}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {editDiagnosis ? (
              <div className="space-y-3">
                <Textarea
                  placeholder="Tuliskan hasil pemeriksaan dan diagnosis penyebab masalah..."
                  rows={4}
                  value={diagnosisInput}
                  onChange={(e) => setDiagnosisInput(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditDiagnosis(false);
                      setDiagnosisInput(wo.diagnosis || "");
                    }}
                    disabled={loadingDiagnosis}
                  >
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSimpanDiagnosis}
                    disabled={loadingDiagnosis}
                    className="bg-primary hover:bg-primary-strong"
                  >
                    {loadingDiagnosis ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Simpan
                  </Button>
                </div>
              </div>
            ) : wo.diagnosis ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                {wo.diagnosis}
              </p>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-text-muted">
                {["dikerjakan", "tertunda"].includes(wo.status)
                  ? "Belum ada diagnosis. Kepala Mekanik dapat mengisinya sekarang."
                  : "Diagnosis akan dicatat saat mobil mulai dikerjakan."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Baris 3: Galeri Foto (STNK, Kondisi Awal, Kondisi Akhir) */}
      <Card className="border-border shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Dokumentasi Foto Kendaraan</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <GaleriFotoWO judul="Foto STNK" foto={fotoStnk} />
          <GaleriFotoWO judul="Foto Kondisi Awal" foto={fotoKondisiAwal} />
          <GaleriFotoWO judul="Foto Kondisi Akhir" foto={fotoKondisiAkhir} />
        </CardContent>
      </Card>
    </div>
  );
}
