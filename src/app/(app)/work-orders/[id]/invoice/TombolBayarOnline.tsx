"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, ExternalLink, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { waktu } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

interface TombolBayarOnlineProps {
  invoiceId: string;
  statusBayarAwal: string;
  dibayarOnlineAtAwal: string | null;
  bisaBayar: boolean;
}

export function TombolBayarOnline({
  invoiceId,
  statusBayarAwal,
  dibayarOnlineAtAwal,
  bisaBayar,
}: TombolBayarOnlineProps) {
  const router = useRouter();
  const supabase = createClient();

  const [statusBayar, setStatusBayar] = useState(statusBayarAwal);
  const [dibayarAt, setDibayarAt] = useState<string | null>(dibayarOnlineAtAwal);
  const [loading, setLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [detikTersisa, setDetikTersisa] = useState(300);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Efek polling: Cek status invoice setiap 5 detik selama 5 menit (300 detik)
  useEffect(() => {
    if (!isPolling || statusBayar === "lunas") {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    // Interval hitung mundur per detik untuk tampilan sisa waktu
    countdownRef.current = setInterval(() => {
      setDetikTersisa((prev) => {
        if (prev <= 1) {
          setIsPolling(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Interval pengecekan ke database setiap 5 detik
    timerRef.current = setInterval(async () => {
      try {
        const { data: inv, error } = await supabase
          .from("invoices")
          .select("status_bayar, dibayar_online_at")
          .eq("id", invoiceId)
          .single();

        if (!error && inv) {
          if (inv.status_bayar === "lunas") {
            setStatusBayar("lunas");
            setDibayarAt(inv.dibayar_online_at || new Date().toISOString());
            setIsPolling(false);
            if (timerRef.current) clearInterval(timerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
            router.refresh();
          }
        }
      } catch {
        // Abaikan error jaringan sementara saat polling
      }
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isPolling, statusBayar, invoiceId, router, supabase]);

  const handleBayarOnline = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const res = await fetch("/api/pembayaran/buat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: invoiceId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.link) {
        setErrorMsg(data?.error || "Gagal membuat tautan pembayaran Mayar.");
        setLoading(false);
        return;
      }

      // 1. Buka tautan Mayar di tab baru
      window.open(data.link, "_blank", "noopener,noreferrer");

      // 2. Mulai polling status selama 5 menit (setiap 5 detik)
      setDetikTersisa(300);
      setIsPolling(true);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Terjadi kesalahan saat memproses pembayaran."
      );
    } finally {
      setLoading(false);
    }
  };

  // Bila sudah lunas, tampilkan label Lunas dan waktu dibayar
  if (statusBayar === "lunas") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs text-green-900 print:hidden">
        <Badge className="bg-green-600 text-white font-bold hover:bg-green-600 gap-1">
          <CheckCircle2 className="size-3.5" />
          Lunas
        </Badge>
        {dibayarAt && (
          <span className="font-medium text-green-800">
            Waktu dibayar: {waktu(dibayarAt)}
          </span>
        )}
      </div>
    );
  }

  // Jika bukan Admin atau Owner, atau status bukan belum lunas, tidak menampilkan tombol
  if (!bisaBayar) {
    return null;
  }

  const formatMenitDetik = (totalDetik: number) => {
    const m = Math.floor(totalDetik / 60);
    const s = totalDetik % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="flex flex-col items-end gap-1 print:hidden">
      <div className="flex items-center gap-2">
        <Button
          onClick={handleBayarOnline}
          disabled={loading || isPolling}
          size="sm"
          className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Menyiapkan Pembayaran...
            </>
          ) : isPolling ? (
            <>
              <Loader2 className="size-4 animate-spin text-white/80" />
              Memeriksa Pembayaran ({formatMenitDetik(detikTersisa)})
            </>
          ) : (
            <>
              <CreditCard className="size-4" />
              Bayar Online
              <ExternalLink className="size-3.5 text-white/70" />
            </>
          )}
        </Button>
      </div>

      {isPolling && (
        <span className="text-[11px] text-text-muted animate-pulse">
          Tab pembayaran terbuka. Menunggu pelunasan dari Mayar...
        </span>
      )}

      {errorMsg && (
        <div className="flex items-center gap-1 text-[11px] text-danger mt-1">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
