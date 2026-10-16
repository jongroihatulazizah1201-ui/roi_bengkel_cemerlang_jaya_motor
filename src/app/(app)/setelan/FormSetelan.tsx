"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import imageCompression from "browser-image-compression";
import { Building2, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

const skema = z.object({
  nama: z.string().trim().min(1, "Nama bengkel wajib diisi"),
  alamat: z.string().trim().min(1, "Alamat wajib diisi"),
  telepon: z.string().trim().min(1, "Nomor telepon wajib diisi"),
  jam_buka: z.string().trim().optional(),
});

type DataForm = z.infer<typeof skema>;

interface Props {
  initialSettings: {
    id: number;
    nama: string;
    alamat: string;
    telepon: string;
    jam_buka: string | null;
    logo_path: string | null;
    galeri_paths: string[];
  };
}

export function FormSetelan({ initialSettings }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingGaleri, setUploadingGaleri] = useState(false);

  const [logoPath, setLogoPath] = useState<string | null>(initialSettings.logo_path);
  const [galeriPaths, setGaleriPaths] = useState<string[]>(initialSettings.galeri_paths ?? []);

  const form = useForm<DataForm>({
    resolver: zodResolver(skema),
    defaultValues: {
      nama: initialSettings.nama ?? "Cemerlang Jaya Motor",
      alamat: initialSettings.alamat ?? "",
      telepon: initialSettings.telepon ?? "",
      jam_buka: initialSettings.jam_buka ?? "",
    },
  });

  const supabase = createClient();

  function getPublicUrl(path: string | null) {
    if (!path) return "";
    const { data } = supabase.storage.from("publik").getPublicUrl(path);
    return data.publicUrl;
  }

  // Fungsi kompresi gambar sesuai PRD 11.4: 1600px, WebP, mutu 0.8
  async function kompresGambar(file: File): Promise<File> {
    const options = {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: "image/webp",
      initialQuality: 0.8,
    };
    const compressedBlob = await imageCompression(file, options);
    return new File([compressedBlob], `${Date.now()}-${file.name.replace(/\.[^/.]+$/, "")}.webp`, {
      type: "image/webp",
    });
  }

  async function handleUploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      const fileKompres = await kompresGambar(file);
      const namaFile = `logo/${Date.now()}.webp`;

      const { error } = await supabase.storage.from("publik").upload(namaFile, fileKompres, {
        cacheControl: "31536000",
        upsert: true,
        contentType: "image/webp",
      });

      if (error) {
        toast.error("Gagal mengunggah logo: " + error.message);
        return;
      }

      setLogoPath(namaFile);
      toast.success("Logo berhasil diunggah. Klik 'Simpan Setelan' untuk menerapkan perubahan.");
    } catch {
      toast.error("Terjadi kesalahan saat memproses logo.");
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  }

  async function handleUploadGaleri(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (galeriPaths.length + files.length > 6) {
      toast.error("Maksimal 6 foto pada galeri halaman depan.");
      return;
    }

    try {
      setUploadingGaleri(true);
      const pathBaruList: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileKompres = await kompresGambar(file);
        const namaFile = `galeri/${Date.now()}-${i}.webp`;

        const { error } = await supabase.storage.from("publik").upload(namaFile, fileKompres, {
          cacheControl: "31536000",
          upsert: true,
          contentType: "image/webp",
        });

        if (error) {
          toast.error(`Gagal mengunggah foto ${file.name}: ${error.message}`);
          continue;
        }

        pathBaruList.push(namaFile);
      }

      if (pathBaruList.length > 0) {
        setGaleriPaths((prev) => [...prev, ...pathBaruList]);
        toast.success(`${pathBaruList.length} foto berhasil ditambahkan ke galeri.`);
      }
    } catch {
      toast.error("Terjadi kesalahan saat mengunggah foto galeri.");
    } finally {
      setUploadingGaleri(false);
      e.target.value = "";
    }
  }

  function handleHapusFotoGaleri(indexHapus: number) {
    setGaleriPaths((prev) => prev.filter((_, idx) => idx !== indexHapus));
  }

  async function onSubmit(data: DataForm) {
    try {
      setLoading(true);

      const { error } = await supabase
        .from("workshop_settings")
        .update({
          nama: data.nama,
          alamat: data.alamat,
          telepon: data.telepon,
          jam_buka: data.jam_buka || null,
          logo_path: logoPath,
          galeri_paths: galeriPaths,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (error) {
        toast.error("Gagal menyimpan setelan bengkel: " + error.message);
        return;
      }

      toast.success("Setelan bengkel berhasil diperbarui.");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan sistem saat menyimpan setelan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* 1. INFORMASI BENGKEL */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Profil Bengkel</CardTitle>
          </div>
          <CardDescription>
            Data utama bengkel yang ditampilkan pada kop invoice, sidebar, dan halaman depan publik.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nama-bengkel">Nama Bengkel *</FieldLabel>
              <Input id="nama-bengkel" {...form.register("nama")} />
              <FieldError>{form.formState.errors.nama?.message}</FieldError>
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="telepon-bengkel">Nomor Telepon Bengkel *</FieldLabel>
                <Input id="telepon-bengkel" {...form.register("telepon")} placeholder="081234567890" />
                <FieldError>{form.formState.errors.telepon?.message}</FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="jam-buka">Jam Operasional</FieldLabel>
                <Input id="jam-buka" {...form.register("jam_buka")} placeholder="Senin - Sabtu: 08:00 - 17:00" />
                <FieldError>{form.formState.errors.jam_buka?.message}</FieldError>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="alamat-bengkel">Alamat Lengkap Bengkel *</FieldLabel>
              <Textarea
                id="alamat-bengkel"
                {...form.register("alamat")}
                rows={3}
                placeholder="Jl. Raya Otomotif No. 123, Jakarta"
              />
              <FieldError>{form.formState.errors.alamat?.message}</FieldError>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* 2. LOGO BENGKEL */}
      <Card>
        <CardHeader>
          <CardTitle>Logo Bengkel</CardTitle>
          <CardDescription>
            Logo resmi bengkel untuk invoice, sidebar, dan halaman utama (Bucket <code>publik/logo/</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="relative h-24 w-24 rounded-lg border border-border bg-muted/40 overflow-hidden flex items-center justify-center">
              {logoPath ? (
                <Image
                  src={getPublicUrl(logoPath)}
                  alt="Logo Bengkel"
                  fill
                  className="object-contain p-2"
                  unoptimized
                />
              ) : (
                <span className="text-xs text-text-muted text-center p-2">Belum ada logo</span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingLogo}
                  onClick={() => document.getElementById("file-logo")?.click()}
                  className="gap-2"
                >
                  {uploadingLogo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {logoPath ? "Ganti Logo" : "Unggah Logo"}
                </Button>

                {logoPath && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:text-danger hover:bg-danger/10 gap-1.5"
                    onClick={() => setLogoPath(null)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Hapus
                  </Button>
                )}
              </div>

              <input
                id="file-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleUploadLogo}
              />
              <p className="text-xs text-text-muted">
                Format: WebP / PNG / JPG. Otomatis dikompres ke WebP maksimal 1600 px (≤ 1 MB).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. GALERI HALAMAN DEPAN */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Galeri Halaman Depan</CardTitle>
              <CardDescription>
                Foto suasana dan fasilitas bengkel untuk halaman publik (3 sampai 6 foto di <code>publik/galeri/</code>).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingGaleri || galeriPaths.length >= 6}
                onClick={() => document.getElementById("file-galeri")?.click()}
                className="gap-2"
              >
                {uploadingGaleri ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                Tambah Foto ({galeriPaths.length}/6)
              </Button>
              <input
                id="file-galeri"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={handleUploadGaleri}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {galeriPaths.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-text-muted">
              Belum ada foto galeri. Unggah 3 hingga 6 foto untuk mempercantik halaman depan bengkel.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {galeriPaths.map((path, idx) => (
                <div key={path} className="group relative rounded-lg border border-border overflow-hidden bg-muted/40 aspect-video">
                  <Image
                    src={getPublicUrl(path)}
                    alt={`Galeri ${idx + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleHapusFotoGaleri(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Hapus Foto</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {galeriPaths.length > 0 && galeriPaths.length < 3 && (
            <p className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded-md">
              Disarankan minimal 3 foto galeri agar tampilan slider / grid di halaman publik optimal.
            </p>
          )}
        </CardContent>
      </Card>

      {/* TOMBOL SIMPAN */}
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={loading} className="min-w-36">
          {loading ? "Menyimpan..." : "Simpan Setelan"}
        </Button>
      </div>
    </form>
  );
}
