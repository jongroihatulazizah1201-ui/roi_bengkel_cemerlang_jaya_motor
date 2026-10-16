"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import {
  Car,
  User,
  Camera,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

interface TimMekanikInfo {
  id: string;
  nama: string;
  jumlahWOAktif: number;
}

interface KendaraanDitemukan {
  id: string;
  plat: string;
  merek_model: string;
  tahun: number | null;
  warna: string | null;
  transmisi: string | null;
  customer_id: string;
  customers: {
    id: string;
    nama: string;
    telepon: string;
    email: string | null;
    alamat: string | null;
    tipe: "perorangan" | "perusahaan";
  } | null;
}

export function FormWorkOrderBaru({
  daftarTim,
}: {
  daftarTim: TimMekanikInfo[];
}) {
  const router = useRouter();
  const supabase = createClient();

  // State pencarian plat
  const [platInput, setPlatInput] = useState("");
  const [mencariPlat, setMencariPlat] = useState(false);
  const [platSudahDicek, setPlatSudahDicek] = useState(false);
  const [kendaraanDitemukan, setKendaraanDitemukan] = useState<KendaraanDitemukan | null>(null);
  const [pelangganTerkunci, setPelangganTerkunci] = useState(false);

  // Form Pelanggan
  const [pelangganId, setPelangganId] = useState<string | null>(null);
  const [tipePelanggan, setTipePelanggan] = useState<"perorangan" | "perusahaan">("perorangan");
  const [namaPelanggan, setNamaPelanggan] = useState("");
  const [teleponPelanggan, setTeleponPelanggan] = useState("");
  const [emailPelanggan, setEmailPelanggan] = useState("");
  const [alamatPelanggan, setAlamatPelanggan] = useState("");

  // Form Kendaraan
  const [kendaraanId, setKendaraanId] = useState<string | null>(null);
  const [merekModel, setMerekModel] = useState("");
  const [tahun, setTahun] = useState<number | "">(new Date().getFullYear());
  const [warna, setWarna] = useState("");
  const [transmisi, setTransmisi] = useState<"AT" | "MT">("AT");

  // Bagian Data Masuk
  const [odometer, setOdometer] = useState<number | "">("");
  const [keluhan, setKeluhan] = useState("");
  const [timId, setTimId] = useState<string>(daftarTim[0]?.id ?? "");

  // Foto STNK & Kondisi Awal
  const [fotoStnk, setFotoStnk] = useState<File | null>(null);
  const [previewStnk, setPreviewStnk] = useState<string | null>(null);

  const [fotoKondisiAwal, setFotoKondisiAwal] = useState<File[]>([]);
  const [previewKondisiAwal, setPreviewKondisiAwal] = useState<string[]>([]);

  // State loading saat submit
  const [submitting, setSubmitting] = useState(false);
  const [pesanProses, setPesanProses] = useState("");

  // Format plat otomatis (uppercase & spasi rapi)
  const formatPlat = (val: string) => {
    return val.toUpperCase().replace(/\s+/g, " ");
  };

  // Cek apakah plat sudah terdaftar
  const handleCariPlat = async () => {
    const platBersih = formatPlat(platInput).trim();
    if (!platBersih) {
      toast.error("Masukkan plat nomor terlebih dahulu");
      return;
    }

    setMencariPlat(true);
    setPlatSudahDicek(false);

    try {
      const { data: vData, error } = await supabase
        .from("vehicles")
        .select("id, plat, merek_model, tahun, warna, transmisi, customer_id, customers(*)")
        .eq("plat", platBersih)
        .maybeSingle();

      if (error) throw error;

      if (vData) {
        // Kondisi 1: Plat ditemukan
        const vTyped = vData as unknown as KendaraanDitemukan;
        setKendaraanDitemukan(vTyped);
        setKendaraanId(vTyped.id);
        setMerekModel(vTyped.merek_model);
        setTahun(vTyped.tahun ?? "");
        setWarna(vTyped.warna ?? "");
        setTransmisi((vTyped.transmisi as "AT" | "MT") ?? "AT");

        const cData = vTyped.customers;
        if (cData) {
          setPelangganId(cData.id);
          setNamaPelanggan(cData.nama);
          setTeleponPelanggan(cData.telepon);
          setEmailPelanggan(cData.email ?? "");
          setAlamatPelanggan(cData.alamat ?? "");
          setTipePelanggan(cData.tipe);
          setPelangganTerkunci(true);
        }
        toast.success(`Kendaraan ${platBersih} terdaftar atas nama ${cData?.nama ?? "pelanggan"}`);
      } else {
        // Kondisi 2: Plat belum terdaftar
        setKendaraanDitemukan(null);
        setKendaraanId(null);
        setPelangganId(null);
        setPelangganTerkunci(false);
        toast.info("Plat nomor belum terdaftar. Silakan lengkapi data pelanggan dan kendaraan.");
      }
      setPlatSudahDicek(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memeriksa plat nomor");
    } finally {
      setMencariPlat(false);
    }
  };

  // Cari pelanggan lama berdasarkan nomor telepon bila plat baru
  const handleCariTelepon = async () => {
    if (!teleponPelanggan || teleponPelanggan.length < 10) return;
    try {
      const { data: cData } = await supabase
        .from("customers")
        .select("id, nama, telepon, email, alamat, tipe")
        .eq("telepon", teleponPelanggan)
        .maybeSingle();

      if (cData) {
        setPelangganId(cData.id);
        setNamaPelanggan(cData.nama);
        setEmailPelanggan(cData.email ?? "");
        setAlamatPelanggan(cData.alamat ?? "");
        setTipePelanggan(cData.tipe as "perorangan" | "perusahaan");
        setPelangganTerkunci(true);
        toast.success(`Pelanggan lama ditemukan: ${cData.nama}`);
      }
    } catch {
      // Abaikan error pencarian cepat
    }
  };

  // Handler Foto STNK
  const handlePilihStnk = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }

    setFotoStnk(file);
    setPreviewStnk(URL.createObjectURL(file));
  };

  // Handler Foto Kondisi Awal (1-6 foto)
  const handleTambahFotoKondisiAwal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const totalFoto = fotoKondisiAwal.length + files.length;
    if (totalFoto > 6) {
      toast.error("Maksimal 6 foto kondisi awal");
      return;
    }

    const fileGambar = files.filter((f) => f.type.startsWith("image/"));
    if (fileGambar.length !== files.length) {
      toast.error("Semua file harus berupa gambar");
    }

    const newFiles = [...fotoKondisiAwal, ...fileGambar];
    setFotoKondisiAwal(newFiles);

    const newPreviews = fileGambar.map((f) => URL.createObjectURL(f));
    setPreviewKondisiAwal([...previewKondisiAwal, ...newPreviews]);
  };

  const handleHapusFotoKondisiAwal = (index: number) => {
    const files = [...fotoKondisiAwal];
    files.splice(index, 1);
    setFotoKondisiAwal(files);

    const previews = [...previewKondisiAwal];
    URL.revokeObjectURL(previews[index]);
    previews.splice(index, 1);
    setPreviewKondisiAwal(previews);
  };

  // Validasi form lengkap
  const pesanKurang: string[] = [];
  if (!platInput.trim()) pesanKurang.push("Plat nomor");
  if (!namaPelanggan.trim()) pesanKurang.push("Nama pelanggan");
  if (!teleponPelanggan.trim() || teleponPelanggan.length < 10) pesanKurang.push("Nomor telepon (10-14 digit)");
  if (!merekModel.trim()) pesanKurang.push("Merek & model kendaraan");
  if (odometer === "" || Number(odometer) < 0) pesanKurang.push("Odometer (>= 0)");
  if (!keluhan.trim()) pesanKurang.push("Keluhan");
  if (!timId) pesanKurang.push("Tim Kepala Mekanik");
  if (!fotoStnk) pesanKurang.push("Foto STNK");
  if (fotoKondisiAwal.length === 0) pesanKurang.push("Minimal 1 Foto Kondisi Awal");

  const formValid = pesanKurang.length === 0;

  // Submit Work Order
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid) {
      toast.error(`Mohon lengkapi: ${pesanKurang.join(", ")}`);
      return;
    }

    setSubmitting(true);
    setPesanProses("Menyimpan data pelanggan dan kendaraan...");

    try {
      let finalCustomerId = pelangganId;

      // 1. Simpan pelanggan jika baru
      if (!finalCustomerId) {
        const { data: newCust, error: custErr } = await supabase
          .from("customers")
          .insert({
            tipe: tipePelanggan,
            nama: namaPelanggan.trim(),
            telepon: teleponPelanggan.trim(),
            email: emailPelanggan.trim() || null,
            alamat: alamatPelanggan.trim() || null,
          })
          .select("id")
          .single();

        if (custErr) throw custErr;
        finalCustomerId = newCust.id;
      }

      // 2. Simpan kendaraan jika baru
      let finalVehicleId = kendaraanId;
      if (!finalVehicleId) {
        const platClean = formatPlat(platInput).trim();
        const { data: newVeh, error: vehErr } = await supabase
          .from("vehicles")
          .insert({
            customer_id: finalCustomerId,
            plat: platClean,
            merek_model: merekModel.trim(),
            tahun: tahun ? Number(tahun) : null,
            warna: warna.trim() || null,
            transmisi: transmisi,
          })
          .select("id")
          .single();

        if (vehErr) throw vehErr;
        finalVehicleId = newVeh.id;
      }

      // 3. Panggil RPC buat_work_order
      setPesanProses("Membuat Work Order...");
      const { data: woId, error: woErr } = await supabase.rpc("buat_work_order", {
        p_vehicle_id: finalVehicleId,
        p_kepala_mekanik_id: timId,
        p_odometer: Number(odometer),
        p_keluhan: keluhan.trim(),
      });

      if (woErr) throw woErr;
      if (!woId) throw new Error("Gagal mendapatkan ID Work Order");

      // 4. Kompresi & unggah Foto STNK & Foto Kondisi Awal
      const {
        data: { user },
      } = await supabase.auth.getUser();

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

      // Unggah STNK
      if (fotoStnk) {
        setPesanProses("Mengompresi dan mengunggah foto STNK...");
        const uidStnk = crypto.randomUUID();
        const compFull = await imageCompression(fotoStnk, fullOpts);
        const compThumb = await imageCompression(fotoStnk, thumbOpts);

        const pathFull = `${woId}/stnk/${uidStnk}.webp`;
        const pathThumb = `${woId}/stnk/thumb/${uidStnk}.webp`;

        await supabase.storage.from("foto-wo").upload(pathFull, compFull, { contentType: "image/webp" });
        await supabase.storage.from("foto-wo").upload(pathThumb, compThumb, { contentType: "image/webp" });

        await supabase.from("work_order_photos").insert({
          work_order_id: woId,
          jenis: "stnk",
          path: pathFull,
          diunggah_oleh: user?.id ?? null,
        });
      }

      // Unggah Foto Kondisi Awal
      for (let i = 0; i < fotoKondisiAwal.length; i++) {
        setPesanProses(`Mengompresi dan mengunggah foto kondisi awal (${i + 1}/${fotoKondisiAwal.length})...`);
        const file = fotoKondisiAwal[i];
        const uidFoto = crypto.randomUUID();

        const compFull = await imageCompression(file, fullOpts);
        const compThumb = await imageCompression(file, thumbOpts);

        const pathFull = `${woId}/kondisi_awal/${uidFoto}.webp`;
        const pathThumb = `${woId}/kondisi_awal/thumb/${uidFoto}.webp`;

        await supabase.storage.from("foto-wo").upload(pathFull, compFull, { contentType: "image/webp" });
        await supabase.storage.from("foto-wo").upload(pathThumb, compThumb, { contentType: "image/webp" });

        await supabase.from("work_order_photos").insert({
          work_order_id: woId,
          jenis: "kondisi_awal",
          path: pathFull,
          diunggah_oleh: user?.id ?? null,
        });
      }

      toast.success("Work Order berhasil dibuat!");
      router.push(`/work-orders/${woId}`);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat Work Order");
    } finally {
      setSubmitting(false);
      setPesanProses("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Pencarian Plat Nomor */}
      <Card className="border-border shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Car className="size-5 text-primary" />
            1. Periksa Plat Kendaraan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="plat">Plat Nomor *</Label>
              <Input
                id="plat"
                placeholder="Contoh: B 1234 ABC"
                value={platInput}
                onChange={(e) => {
                  setPlatInput(formatPlat(e.target.value));
                  setPlatSudahDicek(false);
                }}
                className="text-base font-semibold uppercase tracking-wider"
              />
            </div>
            <Button
              type="button"
              onClick={handleCariPlat}
              disabled={mencariPlat || !platInput.trim()}
              className="bg-primary hover:bg-primary-strong"
            >
              {mencariPlat ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Mencari...
                </>
              ) : (
                <>
                  <Search className="mr-2 size-4" />
                  Cek Plat
                </>
              )}
            </Button>
          </div>

          {platSudahDicek && kendaraanDitemukan && (
            <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm font-medium text-success">
              <CheckCircle2 className="size-5 shrink-0" />
              <span>Plat terdaftar: {kendaraanDitemukan.merek_model} atas nama {namaPelanggan}</span>
            </div>
          )}

          {platSudahDicek && !kendaraanDitemukan && (
            <div className="flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm font-medium text-warning">
              <AlertCircle className="size-5 shrink-0" />
              <span>Plat belum terdaftar. Silakan lengkapi data pelanggan dan kendaraan di bawah ini.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Data Pelanggan & Kendaraan */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Data Pelanggan */}
        <Card className="border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <User className="size-5 text-primary" />
              Data Pelanggan
            </CardTitle>
            {pelangganTerkunci && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPelangganTerkunci(false);
                  setPelangganId(null);
                }}
              >
                Ganti Pelanggan
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tipe Pelanggan</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="tipe"
                    value="perorangan"
                    checked={tipePelanggan === "perorangan"}
                    disabled={pelangganTerkunci}
                    onChange={() => setTipePelanggan("perorangan")}
                  />
                  Perorangan
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="tipe"
                    value="perusahaan"
                    checked={tipePelanggan === "perusahaan"}
                    disabled={pelangganTerkunci}
                    onChange={() => setTipePelanggan("perusahaan")}
                  />
                  Perusahaan
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="namaPelanggan">Nama Lengkap *</Label>
              <Input
                id="namaPelanggan"
                placeholder="Nama pelanggan"
                value={namaPelanggan}
                disabled={pelangganTerkunci}
                onChange={(e) => setNamaPelanggan(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="teleponPelanggan">No. Telepon (WhatsApp) *</Label>
              <Input
                id="teleponPelanggan"
                placeholder="Contoh: 081234567890 (10-14 digit)"
                value={teleponPelanggan}
                disabled={pelangganTerkunci}
                onChange={(e) => setTeleponPelanggan(e.target.value.replace(/\D/g, ""))}
                onBlur={handleCariTelepon}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="emailPelanggan">Email (Opsional)</Label>
              <Input
                id="emailPelanggan"
                type="email"
                placeholder="nama@email.com"
                value={emailPelanggan}
                disabled={pelangganTerkunci}
                onChange={(e) => setEmailPelanggan(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="alamatPelanggan">Alamat (Opsional)</Label>
              <Textarea
                id="alamatPelanggan"
                placeholder="Alamat domisili pelanggan"
                rows={2}
                value={alamatPelanggan}
                disabled={pelangganTerkunci}
                onChange={(e) => setAlamatPelanggan(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Data Kendaraan */}
        <Card className="border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Car className="size-5 text-primary" />
              Data Kendaraan
            </CardTitle>
            {kendaraanId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setKendaraanId(null)}
              >
                Ubah
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="merekModel">Merek dan Model *</Label>
              <Input
                id="merekModel"
                placeholder="Contoh: Toyota Innova Reborn"
                value={merekModel}
                disabled={Boolean(kendaraanId)}
                onChange={(e) => setMerekModel(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tahun">Tahun</Label>
                <Input
                  id="tahun"
                  type="number"
                  min={1980}
                  max={new Date().getFullYear() + 1}
                  placeholder="2020"
                  value={tahun}
                  disabled={Boolean(kendaraanId)}
                  onChange={(e) => setTahun(e.target.value ? Number(e.target.value) : "")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="warna">Warna</Label>
                <Input
                  id="warna"
                  placeholder="Contoh: Putih"
                  value={warna}
                  disabled={Boolean(kendaraanId)}
                  onChange={(e) => setWarna(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Transmisi</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="transmisi"
                    value="AT"
                    checked={transmisi === "AT"}
                    disabled={Boolean(kendaraanId)}
                    onChange={() => setTransmisi("AT")}
                  />
                  Otomatis (AT)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="transmisi"
                    value="MT"
                    checked={transmisi === "MT"}
                    disabled={Boolean(kendaraanId)}
                    onChange={() => setTransmisi("MT")}
                  />
                  Manual (MT)
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Bagian Data Masuk WO */}
      <Card className="border-border shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">2. Data Masuk Servis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="odometer">Odometer (Kilometer) *</Label>
              <Input
                id="odometer"
                type="number"
                min={0}
                placeholder="Contoh: 45000"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value ? Number(e.target.value) : "")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tim">Tim Kepala Mekanik *</Label>
              <select
                id="tim"
                value={timId}
                onChange={(e) => setTimId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {daftarTim.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nama} ({t.jumlahWOAktif} WO aktif)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="keluhan">Keluhan Pelanggan *</Label>
            <Textarea
              id="keluhan"
              placeholder="Deskripsikan keluhan atau permintaan servis pelanggan secara lengkap"
              rows={3}
              value={keluhan}
              onChange={(e) => setKeluhan(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 4. Bagian Foto STNK & Kondisi Awal */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Foto STNK */}
        <Card className="border-border shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Camera className="size-5 text-primary" />
              Foto STNK * (1 foto)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {previewStnk ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border">
                <Image
                  src={previewStnk}
                  alt="Preview STNK"
                  fill
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFotoStnk(null);
                    setPreviewStnk(null);
                  }}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <label className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border transition-colors hover:border-primary hover:bg-muted/30">
                <Upload className="mb-2 size-8 text-text-muted" />
                <span className="text-sm font-medium text-text">Pilih atau Ambil Foto STNK</span>
                <span className="text-xs text-text-muted">Format JPG/PNG/WebP, otomatis dikompres</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePilihStnk}
                  className="hidden"
                />
              </label>
            )}
          </CardContent>
        </Card>

        {/* Foto Kondisi Awal */}
        <Card className="border-border shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base font-semibold">
              <div className="flex items-center gap-2">
                <Camera className="size-5 text-primary" />
                Foto Kondisi Awal * (1-6 foto)
              </div>
              <span className="text-xs font-normal text-text-muted">
                {fotoKondisiAwal.length}/6 foto
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {previewKondisiAwal.map((url, idx) => (
                <div
                  key={idx}
                  className="relative aspect-square overflow-hidden rounded-md border border-border"
                >
                  <Image
                    src={url}
                    alt={`Kondisi Awal ${idx + 1}`}
                    fill
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleHapusFotoKondisiAwal(idx)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}

              {fotoKondisiAwal.length < 6 && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border transition-colors hover:border-primary hover:bg-muted/30">
                  <Upload className="size-6 text-text-muted" />
                  <span className="text-[11px] font-medium text-text-muted">Tambah</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleTambahFotoKondisiAwal}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            {fotoKondisiAwal.length === 0 && (
              <p className="text-xs text-text-muted">
                Ambil foto bodi, goresan yang sudah ada, atau bagian yang rusak sebelum mobil dikerjakan.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Validasi & Submit */}
      <div className="flex flex-col items-end gap-3 pt-2">
        {!formValid && (
          <p className="text-sm text-danger">
            Bagian yang belum lengkap: {pesanKurang.join(", ")}
          </p>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Batal
          </Button>

          <Button
            type="submit"
            disabled={!formValid || submitting}
            className="min-w-36 bg-primary hover:bg-primary-strong"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {pesanProses || "Menyimpan..."}
              </>
            ) : (
              "Simpan Work Order"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
