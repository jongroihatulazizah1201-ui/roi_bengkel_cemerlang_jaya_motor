import { Suspense } from "react";
import { PesanDariUrl } from "@/components/PesanDariUrl";
import { Sidebar } from "@/components/Sidebar";
import { TopHeader } from "@/components/TopHeader";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profil = await ambilProfilSaya();
  const supabase = await createClient();
  const { data: bengkel } = await supabase
    .from("workshop_settings")
    .select("nama, logo_path")
    .eq("id", 1)
    .maybeSingle();

  // Bucket publik dibuat di Fitur C; sebelum itu logo_path masih kosong / The public bucket arrives with Feature C; until then logo_path is empty
  const logoUrl = bengkel?.logo_path
    ? supabase.storage.from("publik").getPublicUrl(bengkel.logo_path).data.publicUrl
    : null;

  const namaBengkel = bengkel?.nama ?? "Cemerlang Jaya Motor";

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_minmax(0,1fr)] bg-background">
      <Sidebar
        namaBengkel={namaBengkel}
        logoUrl={logoUrl}
        nama={profil.nama}
        peran={profil.peran}
      />
      <div className="flex flex-col min-w-0">
        <TopHeader
          nama={profil.nama}
          peran={profil.peran}
          namaBengkel={namaBengkel}
        />
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
      <Suspense>
        <PesanDariUrl />
      </Suspense>
    </div>
  );
}

