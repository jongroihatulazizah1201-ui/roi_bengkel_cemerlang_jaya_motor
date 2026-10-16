"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function TombolCetak({ woId }: { woId: string }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex items-center gap-3 print:hidden">
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <Link href={`/work-orders/${woId}/tagihan`}>
          <ArrowLeft className="size-4" />
          Kembali ke Tagihan
        </Link>
      </Button>

      <Button onClick={handlePrint} size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary-strong">
        <Printer className="size-4" />
        Cetak / Simpan PDF
      </Button>
    </div>
  );
}
