"use client";

import Link from "next/link";
import { Package, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { rupiah } from "@/lib/format";

export interface DataTopItem {
  nama: string;
  jumlah: number;
  pendapatan: number;
}

export function GrafikTopItem({
  items,
  judul = "5 Item Terlaris",
}: {
  items: DataTopItem[];
  judul?: string;
}) {
  const maxJumlah = Math.max(...(items ?? []).map((i) => Number(i.jumlah) || 1), 1);
  const kosong = !items || items.length === 0;

  return (
    <Card className="bg-bg-panel border-border shadow-card flex flex-col justify-between">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold text-text">{judul}</CardTitle>
          <CardDescription className="text-xs text-text-muted mt-1">
            Spare part dan jasa paling sering digunakan (klik untuk cek stok)
          </CardDescription>
        </div>
        <Link
          href="/inventory"
          className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
        >
          <span>Inventory</span>
          <ArrowUpRight className="size-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="pt-2">
        {kosong ? (
          <div className="h-[280px] flex flex-col items-center justify-center text-text-muted text-sm space-y-1">
            <Package className="size-8 text-text-muted/40 mb-2" />
            <p className="font-medium text-text">Belum ada data penjualan</p>
            <p className="text-xs">Data item terlaris akan dihitung dari invoice yang terbit.</p>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {items.map((item, index) => {
              const rasio = Math.min(100, Math.round((Number(item.jumlah) / maxJumlah) * 100));
              return (
                <Link
                  key={index}
                  href="/inventory"
                  className="block group hover:bg-bg-app p-2 rounded-lg transition-all"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-text group-hover:text-primary transition-colors flex items-center gap-2">
                      <span className="size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      {item.nama}
                    </span>
                    <span className="text-text-muted tabular-nums">
                      <strong className="text-text font-semibold">{item.jumlah}x</strong> ({rupiah(Number(item.pendapatan))})
                    </span>
                  </div>
                  <div className="w-full bg-border rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-500 group-hover:bg-primary-strong"
                      style={{ width: `${rasio}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
