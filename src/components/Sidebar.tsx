"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ScrollText,
  Settings,
  TrendingUp,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LABEL_PERAN, menuUntuk, type Peran } from "@/lib/peran";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// Ikon disimpan di sini, bukan di peran.ts, agar middleware tidak ikut memuat lucide-react.
const IKON: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/work-orders": ClipboardList,
  "/pelanggan": Users,
  "/inventory": Package,
  "/tim-mekanik": HardHat,
  "/laporan-laba": TrendingUp,
  "/audit-log": ScrollText,
  "/pengguna": UserCog,
  "/setelan": Settings,
};

type Props = { namaBengkel: string; logoUrl: string | null; nama: string; peran: Peran };

export function Sidebar(props: Props) {
  const [menuBuka, setMenuBuka] = useState(false);

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 border-r border-[#6538AE] bg-[#7546C2] text-white shadow-xl md:flex">
        <IsiSidebar {...props} />
      </aside>

      {/* Layar sempit: menu di dalam Sheet */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#6538AE] bg-[#7546C2] px-4 py-3 text-white shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <Sheet open={menuBuka} onOpenChange={setMenuBuka}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/15 hover:text-white"
                aria-label="Buka menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-r border-[#6538AE] bg-[#7546C2] p-0 text-white">
              <SheetTitle className="sr-only">Navigasi Utama</SheetTitle>
              <IsiSidebar {...props} onPilih={() => setMenuBuka(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-[#4975CC] text-white shadow-xs">
              <Wrench className="size-4" />
            </div>
            <span className="font-semibold text-sm tracking-wide text-white">
              {props.namaBengkel || "Cemerlang Cahaya Motor"}
            </span>
          </div>
        </div>
      </header>
    </>
  );
}

function IsiSidebar({ namaBengkel, logoUrl, nama, peran, onPilih }: Props & { onPilih?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function keluar() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const inisial = nama
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-full w-full flex-col justify-between">
      {/* Brand Header */}
      <div>
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-10 rounded-xl object-cover ring-2 ring-white/20" />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4975CC] to-[#36599B] text-white shadow-md ring-2 ring-white/20">
              <Wrench className="size-5" />
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-white leading-tight">
              {namaBengkel || "Cemerlang Cahaya Motor"}
            </span>
            <span className="text-[11px] font-medium text-white/70">Sistem Manajemen Bengkel</span>
          </div>
        </div>

        {/* Menu Navigation */}
        <div className="px-3 py-4">
          <p className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-white/50 uppercase">
            Menu Utama
          </p>
          <nav className="space-y-1">
            {menuUntuk(peran).map((menu) => {
              const Ikon = IKON[menu.href];
              const aktif = pathname === menu.href || pathname.startsWith(`${menu.href}/`);
              return (
                <Link
                  key={menu.href}
                  href={menu.href}
                  onClick={onPilih}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-all duration-150",
                    aktif
                      ? "bg-[#4975CC] text-white shadow-md font-semibold ring-1 ring-white/25"
                      : "text-white/80 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Ikon className={cn("size-4 shrink-0", aktif ? "text-white" : "text-white/75")} />
                  <span>{menu.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Profil Pengguna & Tombol Keluar */}
      <div className="border-t border-white/10 bg-black/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white ring-1 ring-white/30">
            {inisial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-semibold text-white">{nama}</p>
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <p className="text-[10px] text-white/70 truncate">{LABEL_PERAN[peran]}</p>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full border-white/20 bg-white/10 text-xs font-medium text-white hover:bg-white/20 hover:text-white"
          onClick={keluar}
        >
          <LogOut className="size-3.5 mr-1" />
          Keluar
        </Button>
      </div>
    </div>
  );
}
