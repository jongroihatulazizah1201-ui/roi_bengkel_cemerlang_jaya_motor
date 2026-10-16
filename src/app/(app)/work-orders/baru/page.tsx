import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { FormWorkOrderBaru } from "./FormWorkOrderBaru";

export default async function HalamanWorkOrderBaru() {
  const profil = await ambilProfilSaya();

  // Hanya Admin dan Owner yang boleh membuat WO baru (PRD 6.7)
  if (profil.peran !== "admin" && profil.peran !== "owner") {
    redirect("/work-orders");
  }

  const supabase = await createClient();

  // Ambil daftar kepala mekanik yang aktif
  const { data: kepalaMekanik } = await supabase
    .from("profiles")
    .select("id, nama")
    .eq("role", "kepala_mekanik")
    .eq("aktif", true)
    .order("nama");

  // Ambil jumlah WO aktif per tim kepala mekanik
  const { data: woAktif } = await supabase
    .from("work_orders")
    .select("kepala_mekanik_id")
    .in("status", ["menunggu", "dikerjakan", "tertunda", "selesai", "siap_diambil"]);

  const hitunganWO: Record<string, number> = {};
  woAktif?.forEach((w) => {
    hitunganWO[w.kepala_mekanik_id] = (hitunganWO[w.kepala_mekanik_id] ?? 0) + 1;
  });

  const daftarTim = (kepalaMekanik ?? []).map((km) => ({
    id: km.id,
    nama: km.nama,
    jumlahWOAktif: hitunganWO[km.id] ?? 0,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="icon">
          <Link href="/work-orders" aria-label="Kembali ke daftar work order">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Buat Work Order Baru</h1>
          <p className="text-sm text-text-muted">
            Catat kendaraan masuk, data pelanggan, keluhan, dan foto kondisi awal mobil
          </p>
        </div>
      </div>

      <FormWorkOrderBaru daftarTim={daftarTim} />
    </div>
  );
}
