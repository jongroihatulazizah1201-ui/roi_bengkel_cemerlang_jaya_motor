"use client";

import { useState } from "react";
import { Bell, Search, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LABEL_PERAN, type Peran } from "@/lib/peran";

type TopHeaderProps = {
  nama: string;
  peran: Peran;
  namaBengkel: string;
};

export function TopHeader({ nama, peran, namaBengkel }: TopHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [notifikasiDibaca, setNotifikasiDibaca] = useState(false);

  // Inisial nama pengguna
  const inisial = nama
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Tanggal hari ini dalam format Bahasa Indonesia
  const tanggalHariIni = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());

  const daftarNotifikasi = [
    {
      id: 1,
      judul: "Work Order Baru Diterima",
      waktu: "10 menit lalu",
      deskripsi: "WO Honda Vario 150 (B 1234 XYZ) siap untuk ditinjau.",
      baru: true,
    },
    {
      id: 2,
      judul: "Peringatan Stok Menipis",
      waktu: "1 jam lalu",
      deskripsi: "Stok Oli Mesin 4L tersisa 2 unit di gudang.",
      baru: true,
    },
    {
      id: 3,
      judul: "Pembayaran Diterima",
      waktu: "3 jam lalu",
      deskripsi: "Invoice INV-2026-0002 telah lunas melalui Transfer Bank.",
      baru: false,
    },
  ];

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur-md transition-all md:px-8">
      {/* Kolom Kiri: Search Bar Global */}
      <div className="flex flex-1 items-center gap-3 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari Work Order, Pelanggan, atau Suku Cadang..."
            className="h-9 w-full rounded-full border-border bg-muted/40 pl-9 pr-4 text-xs transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-card"
          />
        </div>
      </div>

      {/* Kolom Kanan: Tanggal, Notifikasi, dan Profil Role */}
      <div className="flex items-center gap-3 md:gap-5">
        {/* Tanggal & Status Bengkel (Desktop) */}
        <div className="hidden text-right lg:block">
          <div className="flex items-center justify-end gap-1.5 text-xs font-medium text-foreground">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{namaBengkel} · Buka (08.00 - 17.00)</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{tanggalHariIni}</p>
        </div>

        {/* Notifikasi Bell dengan Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative size-9 rounded-full border border-border hover:bg-muted"
              aria-label="Lihat notifikasi"
              onClick={() => setNotifikasiDibaca(true)}
            >
              <Bell className="size-4 text-primary" />
              {!notifikasiDibaca && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-white" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 rounded-xl border-border p-0 shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30">
              <span className="text-xs font-semibold text-primary">Notifikasi Sistem</span>
              <Badge variant="outline" className="text-[10px] bg-card border-border">
                {notifikasiDibaca ? "0 Baru" : "2 Baru"}
              </Badge>
            </div>
            <div className="divide-y divide-border/60 max-h-72 overflow-y-auto">
              {daftarNotifikasi.map((item) => (
                <div key={item.id} className="p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-foreground">{item.judul}</p>
                    <span className="text-[10px] text-muted-foreground">{item.waktu}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {item.deskripsi}
                  </p>
                </div>
              ))}
            </div>
            <div className="border-t border-border p-2 text-center bg-muted/10">
              <span className="text-[11px] font-medium text-primary hover:underline cursor-pointer">
                Tandai semua telah dibaca
              </span>
            </div>
          </PopoverContent>
        </Popover>

        {/* Pemisah Vertikal */}
        <div className="hidden h-7 w-px bg-border sm:block" />

        {/* Profil & Role Pill */}
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-full bg-[#7546C2] text-xs font-bold text-white shadow-sm ring-2 ring-border">
            {inisial}
          </div>
          <div className="hidden flex-col text-left sm:flex">
            <span className="text-xs font-semibold leading-tight text-foreground truncate max-w-[130px]">
              {nama}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
              <Shield className="size-2.5" />
              {LABEL_PERAN[peran]}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
