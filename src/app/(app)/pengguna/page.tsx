import { redirect } from "next/navigation";
import { Search, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Paginasi } from "@/components/Paginasi";
import { tanggal } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { DialogUbahPengguna } from "./DialogUbahPengguna";

const PER_HALAMAN = 20;

export default async function HalamanPengguna({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; hal?: string }>;
}) {
  const { q = "", hal } = await searchParams;
  const halaman = Math.max(1, Number(hal) || 1);
  const cari = q.replace(/[,()*%\\]/g, " ").trim();

  const profil = await ambilProfilSaya();
  // Hanya Owner yang boleh mengakses halaman ini (PRD 6.10)
  if (profil.peran !== "owner") {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  let kueri = supabase
    .from("profiles")
    .select("id, nama, email, role, aktif, created_at", { count: "exact" });

  if (cari) {
    kueri = kueri.or(`nama.ilike.%${cari}%,email.ilike.%${cari}%`);
  }

  const { data: penggunaList, count, error } = await kueri
    .order("created_at", { ascending: false })
    .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Pengguna & Peran</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Kelola akses, penugasan peran, dan status keaktifan pengguna bengkel.
          </p>
        </div>
      </div>

      {/* Info Petunjuk Penambahan Akun Baru (PRD 6.10) */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary-soft/30 p-4 text-xs text-text-body">
        <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-text">Cara Menambah Pengguna Baru (PRD 6.10):</p>
          <ol className="list-decimal list-inside space-y-0.5 text-text-body">
            <li>Buat akun di Supabase Dashboard › Authentication › Users › <strong>Add user</strong>.</li>
            <li>Setelah dibuat, profil otomatis tercatat di tabel ini dengan peran default <code>kepala_mekanik</code> dan status <code>Nonaktif</code>.</li>
            <li>Klik tombol <strong>Kelola</strong> di tabel bawah untuk memperbarui Nama, Peran, serta mengaktifkan akun pengguna tersebut.</li>
          </ol>
        </div>
      </div>

      {/* Pencarian */}
      <form className="flex max-w-md gap-2" role="search">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Cari berdasarkan nama atau email..."
          aria-label="Cari pengguna"
        />
        <Button type="submit" variant="outline">
          <Search className="h-4 w-4" />
          Cari
        </Button>
      </form>

      {/* Tabel Pengguna */}
      <Card className="py-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Nama Pengguna</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-36 text-center">Peran</TableHead>
              <TableHead className="w-28 text-center">Status</TableHead>
              <TableHead className="w-36">Dibuat</TableHead>
              <TableHead className="pr-4 text-right w-24">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-danger">
                  Gagal memuat data pengguna. Silakan muat ulang halaman.
                </TableCell>
              </TableRow>
            )}
            {!error && penggunaList?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {cari ? `Tidak ada pengguna yang cocok dengan "${cari}".` : "Belum ada data pengguna."}
                </TableCell>
              </TableRow>
            )}
            {penggunaList?.map((p) => {
              const labelPeran: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
                owner: { label: "Owner", variant: "default" },
                admin: { label: "Admin", variant: "secondary" },
                kepala_mekanik: { label: "Kepala Mekanik", variant: "outline" },
              };
              const infoPeran = labelPeran[p.role] || { label: p.role, variant: "outline" as const };

              return (
                <TableRow key={p.id}>
                  <TableCell className="pl-4 font-medium text-text">
                    {p.nama}
                    {p.id === profil.id && (
                      <span className="ml-2 text-xs text-primary font-normal">(Anda)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-text-body font-mono text-xs">{p.email}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={infoPeran.variant}>{infoPeran.label}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={p.aktif ? "outline" : "destructive"}
                      className={p.aktif ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}
                    >
                      {p.aktif ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-text-muted">{tanggal(p.created_at)}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <DialogUbahPengguna
                      pengguna={{
                        id: p.id,
                        nama: p.nama,
                        email: p.email,
                        role: p.role as "owner" | "admin" | "kepala_mekanik",
                        aktif: p.aktif,
                      }}
                      currentUserProfileId={profil.id}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Paginasi halaman={halaman} totalBaris={count ?? 0} perHalaman={PER_HALAMAN} params={{ q: cari }} />
    </div>
  );
}
