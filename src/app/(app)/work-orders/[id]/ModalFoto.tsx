"use client";

import { useState } from "react";
import Image from "next/image";
import { ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface FotoItem {
  id: string;
  jenis: string;
  url: string;
  thumbUrl?: string;
}

export function GaleriFotoWO({
  judul,
  foto,
}: {
  judul: string;
  foto: FotoItem[];
}) {
  const [fotoAktif, setFotoAktif] = useState<string | null>(null);

  if (!foto.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-text-muted">
        Belum ada {judul.toLowerCase()}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-text-muted">{judul}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {foto.map((f) => (
          <div
            key={f.id}
            onClick={() => setFotoAktif(f.url)}
            className="group relative aspect-video cursor-pointer overflow-hidden rounded-md border border-border bg-muted transition-transform hover:scale-[1.02]"
          >
            <Image
              src={f.thumbUrl || f.url}
              alt={judul}
              fill
              className="object-cover transition-opacity group-hover:opacity-90"
              sizes="(max-width: 640px) 50vw, 33vw"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
              <ZoomIn className="size-5 text-white" />
            </div>
          </div>
        ))}
      </div>

      <Dialog open={Boolean(fotoAktif)} onOpenChange={(open) => !open && setFotoAktif(null)}>
        <DialogContent className="max-w-3xl overflow-hidden p-2">
          <DialogTitle className="sr-only">Pratinjau Foto</DialogTitle>
          {fotoAktif && (
            <div className="relative aspect-video w-full overflow-hidden rounded-md">
              <Image
                src={fotoAktif}
                alt="Foto ukuran penuh"
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
