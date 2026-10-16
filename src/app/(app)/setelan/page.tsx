import { redirect } from "next/navigation";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { FormSetelan } from "./FormSetelan";

export default async function HalamanSetelan() {
  const profil = await ambilProfilSaya();

  // Hanya Owner yang boleh mengakses menu Setelan Bengkel (PRD 6.11)
  if (profil.peran !== "owner") {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const { data: setelan, error } = await supabase
    .from("workshop_settings")
    .select("id, nama, alamat, telepon, jam_buka, logo_path, galeri_paths")
    .eq("id", 1)
    .single();

  if (error || !setelan) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-text">Setelan Bengkel</h1>
        <p className="text-danger text-sm">
          Gagal memuat setelan bengkel. Pastikan tabel workshop_settings telah terisi baris id=1.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-text">Setelan Bengkel</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Atur informasi resmi bengkel, logo usaha, dan galeri foto halaman depan (Bucket <code>publik</code>).
        </p>
      </div>

      <FormSetelan
        initialSettings={{
          id: setelan.id,
          nama: setelan.nama,
          alamat: setelan.alamat,
          telepon: setelan.telepon,
          jam_buka: setelan.jam_buka,
          logo_path: setelan.logo_path,
          galeri_paths: setelan.galeri_paths ?? [],
        }}
      />
    </div>
  );
}
