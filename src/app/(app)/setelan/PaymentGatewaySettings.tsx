"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Code2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { waktu } from "@/lib/format";
import type { Json } from "@/types/database";

export interface MayarLogItem {
  id: number;
  event: string | null;
  status: string | null;
  payload: Json | null;
  created_at: string;
}

interface PaymentGatewaySettingsProps {
  terhubung: boolean;
  isSandbox: boolean;
  logsAwal: MayarLogItem[];
}

export function PaymentGatewaySettings({
  terhubung,
  isSandbox,
  logsAwal,
}: PaymentGatewaySettingsProps) {
  const [webhookUrl, setWebhookUrl] = useState("/api/webhook/mayar");
  const [copied, setCopied] = useState(false);
  const [selectedPayload, setSelectedPayload] = useState<{
    id: number;
    event: string | null;
    status: string | null;
    payload: Json | null;
  } | null>(null);

  // Set URL lengkap webhook berdasarkan origin browser saat client mounted
  useEffect(() => {
    if (typeof window !== "undefined") {
      setWebhookUrl(`${window.location.origin}/api/webhook/mayar`);
    }
  }, []);

  const handleSalinUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback salin teks
      const el = document.createElement("textarea");
      el.value = webhookUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-text">
                Payment Gateway (Mayar.io)
              </CardTitle>
              <CardDescription className="text-xs text-text-muted mt-0.5">
                Konfigurasi integrasi pembayaran online otomatis dan log webhook Mayar API V2.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Terhubung (cek env di server tanpa menampilkan nilainya) */}
            {terhubung ? (
              <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 gap-1.5 py-1">
                <CheckCircle2 className="size-3.5 text-green-600" />
                Terhubung
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-red-50 text-red-700 border-red-200 gap-1.5 py-1"
              >
                <XCircle className="size-3.5 text-red-500" />
                Belum Terhubung
              </Badge>
            )}

            {/* Mode Sandbox atau Produksi */}
            {isSandbox ? (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-800 border-amber-300 font-semibold py-1"
              >
                Mode Sandbox (Testing)
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold py-1"
              >
                Mode Produksi (Live)
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-2">
        {/* Informasi Ringkas Status Kunci & Mode */}
        <div className="rounded-lg border bg-surface p-4 text-xs space-y-2">
          <div className="flex items-start gap-2 text-text-muted">
            <div className="pt-0.5">
              {terhubung ? (
                <CheckCircle2 className="size-4 text-green-600" />
              ) : (
                <AlertTriangle className="size-4 text-amber-500" />
              )}
            </div>
            <div>
              <p className="font-semibold text-text">
                {terhubung
                  ? "Kunci API Mayar aktif terpasang di server"
                  : "Kunci API Mayar belum terdeteksi"}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">
                {terhubung
                  ? "Server backend dapat membuat tautan pembayaran dan memverifikasi invoice Mayar."
                  : "Pastikan variabel MAYAR_API_KEY telah diisi pada file konfigurasi server (.env.local)."}
              </p>
            </div>
          </div>
        </div>

        {/* URL Webhook yang Bisa Disalin */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text flex items-center justify-between">
            <span>URL Webhook Mayar</span>
            <span className="text-[11px] font-normal text-text-muted">
              Metode: POST (application/json)
            </span>
          </label>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={webhookUrl}
              className="bg-surface font-mono text-xs text-text select-all"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSalinUrl}
              className="gap-1.5 shrink-0"
            >
              {copied ? (
                <>
                  <Check className="size-4 text-green-600" />
                  <span className="text-green-700 font-medium">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  Salin URL
                </>
              )}
            </Button>
          </div>
          <p className="text-[11px] text-text-muted">
            Salin tautan di atas dan tempelkan ke menu <strong>Integrasi &gt; Webhook</strong> pada
            dashboard Mayar untuk sinkronisasi otomatis status pembayaran.
          </p>
        </div>

        {/* 10 Baris Terakhir mayar_webhook_log */}
        <div className="space-y-2.5 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-text-muted" />
              <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
                10 Aktivitas Webhook Terakhir (mayar_webhook_log)
              </h3>
            </div>
            <span className="text-[11px] text-text-muted">Khusus Owner</span>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-surface/50">
                  <TableHead className="w-40 text-text-muted">Waktu</TableHead>
                  <TableHead className="w-48 text-text-muted">Event</TableHead>
                  <TableHead className="w-44 text-text-muted">Status</TableHead>
                  <TableHead className="text-right text-text-muted">Payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsAwal.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-6 text-xs text-text-muted italic"
                    >
                      Belum ada log aktivitas webhook dari Mayar yang tercatat.
                    </TableCell>
                  </TableRow>
                ) : (
                  logsAwal.map((log) => {
                    const isSuccess =
                      log.status?.toLowerCase().includes("diterima") ||
                      log.status?.toLowerCase().includes("paid") ||
                      log.status?.toLowerCase().includes("sukses");

                    return (
                      <TableRow key={log.id} className="hover:bg-surface/30">
                        <TableCell className="font-mono text-[11px] text-text-muted whitespace-nowrap">
                          {waktu(log.created_at)}
                        </TableCell>
                        <TableCell className="font-medium text-text">
                          <code className="rounded bg-surface px-1.5 py-0.5 text-[11px]">
                            {log.event || "unknown"}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold uppercase ${
                              isSuccess
                                ? "border-green-300 bg-green-50 text-green-700"
                                : "border-red-300 bg-red-50 text-red-700"
                            }`}
                          >
                            {log.status || "diproses"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px] gap-1 text-primary hover:text-primary-strong"
                            onClick={() => setSelectedPayload(log)}
                          >
                            <Code2 className="size-3.5" />
                            Rincian
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>

      {/* Modal / Dialog untuk Menampilkan Rincian Payload JSON */}
      <Dialog open={!!selectedPayload} onOpenChange={() => setSelectedPayload(null)}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Rincian Payload Log #{selectedPayload?.id}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Event: <code>{selectedPayload?.event}</code> · Status:{" "}
              <strong>{selectedPayload?.status}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-neutral-900 p-4 text-neutral-100 overflow-x-auto text-[11px] font-mono leading-relaxed">
            <pre>{JSON.stringify(selectedPayload?.payload, null, 2)}</pre>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
