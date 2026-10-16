"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";
import { cn } from "cn";

export type OpsiPeriode = "hari-ini" | "7-hari" | "30-hari" | "bulan-ini";

const DAFTAR_OPSI: { id: OpsiPeriode; label: string }[] = [
  { id: "hari-ini", label: "Hari ini" },
  { id: "7-hari", label: "7 hari" },
  { id: "30-hari", label: "30 hari" },
  { id: "bulan-ini", label: "Bulan ini" },
];

export function PenyaringPeriode({ aktif }: { aktif: OpsiPeriode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const gantiPeriode = (opsi: OpsiPeriode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("periode", opsi);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-1.5 p-1 bg-card rounded-lg border border-border shadow-xs">
      <div className="px-2 text-text-muted flex items-center gap-1.5 text-xs font-medium border-r border-border/80 mr-0.5">
        <Calendar className="size-3.5" />
        <span className="hidden sm:inline">Periode:</span>
      </div>
      {DAFTAR_OPSI.map((item) => {
        const isAktif = aktif === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => gantiPeriode(item.id)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer",
              isAktif
                ? "bg-primary text-white shadow-xs"
                : "text-text-muted hover:text-text hover:bg-bg-app"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
