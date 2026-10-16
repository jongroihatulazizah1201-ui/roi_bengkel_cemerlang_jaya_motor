"use client";

import { useState } from "react";
import { Eye, ArrowRight, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface PropsPerbandingan {
  aksi: string;
  tabel: string;
  dataId: string | null;
  sebelum: Record<string, unknown> | null;
  sesudah: Record<string, unknown> | null;
}

export function KomponenPerbandingan({ aksi, tabel, dataId, sebelum, sesudah }: PropsPerbandingan) {
  const [buka, setBuka] = useState(false);

  // Ambil semua kunci atribut dari objek sebelum dan sesudah
  const kunciSebelum = sebelum ? Object.keys(sebelum) : [];
  const kunciSesudah = sesudah ? Object.keys(sesudah) : [];
  const semuaKunci = Array.from(new Set([...kunciSebelum, ...kunciSesudah])).sort();

  // Tentukan kunci yang nilainya berubah
  const kunciBerubah = semuaKunci.filter((k) => {
    const valLama = sebelum ? JSON.stringify(sebelum[k]) : undefined;
    const valBaru = sesudah ? JSON.stringify(sesudah[k]) : undefined;
    return valLama !== valBaru;
  });

  const formatNilai = (val: unknown): string => {
    if (val === null || val === undefined) return "-";
    if (typeof val === "boolean") return val ? "true" : "false";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Eye className="size-3.5" />
          <span>Lihat Nilai</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-bg-panel border-border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                aksi === "INSERT"
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  : aksi === "DELETE"
                  ? "bg-red-500/10 text-red-600 border-red-500/20"
                  : "bg-blue-500/10 text-blue-600 border-blue-500/20"
              }
            >
              {aksi}
            </Badge>
            <DialogTitle className="text-base text-text">
              Perubahan Data: {tabel} {dataId ? `(#${dataId})` : ""}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-text-muted">
            Rincian nilai sebelum dan sesudah operasi data dicatat secara transparan.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 space-y-4">
          {aksi === "INSERT" && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <CheckCircle2 className="size-4" />
                <span>Nilai Data yang Baru Ditambahkan:</span>
              </div>
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="w-1/3 text-xs font-semibold">Kolom</TableHead>
                      <TableHead className="text-xs font-semibold">Nilai</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kunciSesudah.map((k) => (
                      <TableRow key={k} className="border-border">
                        <TableCell className="font-mono text-xs text-text font-medium">{k}</TableCell>
                        <TableCell className="font-mono text-xs text-text-muted break-all">
                          {formatNilai(sesudah?.[k])}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {aksi === "DELETE" && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                <Trash2 className="size-4" />
                <span>Nilai Data Sebelum Dihapus:</span>
              </div>
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="w-1/3 text-xs font-semibold">Kolom</TableHead>
                      <TableHead className="text-xs font-semibold">Nilai Sebelumnya</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kunciSebelum.map((k) => (
                      <TableRow key={k} className="border-border">
                        <TableCell className="font-mono text-xs text-text font-medium">{k}</TableCell>
                        <TableCell className="font-mono text-xs text-text-muted break-all">
                          {formatNilai(sebelum?.[k])}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {aksi === "UPDATE" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600">
                  <AlertCircle className="size-4" />
                  <span>Perbandingan Kolom yang Berubah ({kunciBerubah.length}):</span>
                </div>
              </div>
              {kunciBerubah.length === 0 ? (
                <p className="text-xs text-text-muted p-3 bg-card rounded border border-border">
                  Tidak ada perbedaan nilai terdeteksi pada pembaruan ini.
                </p>
              ) : (
                <div className="rounded-md border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="w-1/4 text-xs font-semibold">Kolom</TableHead>
                        <TableHead className="w-3/8 text-xs font-semibold text-red-600">Sebelum</TableHead>
                        <TableHead className="w-3/8 text-xs font-semibold text-emerald-600">Sesudah</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kunciBerubah.map((k) => (
                        <TableRow key={k} className="border-border bg-amber-500/5">
                          <TableCell className="font-mono text-xs font-semibold text-text">{k}</TableCell>
                          <TableCell className="font-mono text-xs text-red-700 bg-red-500/10 break-all p-2 rounded">
                            {formatNilai(sebelum?.[k])}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-emerald-700 bg-emerald-500/10 break-all p-2 rounded">
                            {formatNilai(sesudah?.[k])}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Tampilkan kolom yang tidak berubah */}
              {semuaKunci.length > kunciBerubah.length && (
                <details className="mt-3 text-xs text-text-muted group">
                  <summary className="cursor-pointer font-medium hover:text-text py-1">
                    Lihat kolom lainnya yang tidak berubah ({semuaKunci.length - kunciBerubah.length})
                  </summary>
                  <div className="mt-2 rounded-md border border-border overflow-hidden">
                    <Table>
                      <TableBody>
                        {semuaKunci
                          .filter((k) => !kunciBerubah.includes(k))
                          .map((k) => (
                            <TableRow key={k} className="border-border text-xs">
                              <TableCell className="font-mono w-1/3 text-text-muted">{k}</TableCell>
                              <TableCell className="font-mono text-text-muted break-all">
                                {formatNilai(sesudah?.[k] ?? sebelum?.[k])}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
