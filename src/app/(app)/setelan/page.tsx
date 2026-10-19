import { redirect } from "next/navigation";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { FormSetelan } from "./FormSetelan";
import { PaymentGatewaySettings, type MayarLogItem } from "./PaymentGatewaySettings";

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

  // 1. Cek status env Mayar di server tanpa menampilkan nilainya
  const terhubung = Boolean(process.env.MAYAR_API_KEY && process.env.MAYAR_API_KEY.trim().length > 0);
  const rawBaseUrl = process.env.MAYAR_BASE_URL || "https://api.mayar.io/hl/v2";
  const isSandbox = rawBaseUrl.includes("mayar.io") || rawBaseUrl.includes("sandbox");

  // 2. Ambil 10 baris terakhir dari mayar_webhook_log (khusus Owner)
  const { data: logsData } = await supabase
    .from("mayar_webhook_log")
    .select("id, event, status, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  const logsAwal: MayarLogItem[] = logsData ?? [];

  return (
    <div className="space-y-8 max-w-4xl">
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

      {/* Bagian Payment Gateway khusus Owner */}
      <PaymentGatewaySettings
        terhubung={terhubung}
        isSandbox={isSandbox}
        logsAwal={logsAwal}
      />
    </div>
  );
}
