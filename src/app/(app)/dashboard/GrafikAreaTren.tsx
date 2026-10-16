"use client";

import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { rupiah, rupiahRingkas, tanggal } from "@/lib/format";
import { ArrowUpRight } from "lucide-react";

export interface DataTrenHarian {
  tanggal: string;
  pendapatan?: number;
  modal?: number;
  laba?: number;
  pendapatan_jasa?: number;
  pendapatan_part?: number;
}

interface PropsGrafikAreaTren {
  data: DataTrenHarian[];
  peran: string;
}

export function GrafikAreaTren({ data, peran }: PropsGrafikAreaTren) {
  const isOwner = peran === "owner";
  const kosong = !data || data.length === 0 || data.every((d) => (d.pendapatan || 0) === 0 && (d.pendapatan_jasa || 0) === 0 && (d.pendapatan_part || 0) === 0);

  const formatTanggalSingkat = (tgl: string) => {
    try {
      const parts = tgl.split("-");
      if (parts.length === 3) {
        return `${Number(parts[2])}/${Number(parts[1])}`;
      }
      return tgl;
    } catch {
      return tgl;
    }
  };

  return (
    <Card className="bg-bg-panel border-border shadow-card flex flex-col justify-between">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold text-text">
            {isOwner ? "Tren Pendapatan & Laba Harian" : "Tren Pendapatan Harian"}
          </CardTitle>
          <CardDescription className="text-xs text-text-muted mt-1">
            {isOwner
              ? "Perkembangan pendapatan kotor dan laba bersih per hari"
              : "Perkembangan pendapatan jasa dan spare part per hari"}
          </CardDescription>
        </div>
        {isOwner && (
          <Link
            href="/laporan-laba"
            className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
          >
            <span>Rincian Laba</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </CardHeader>

      <CardContent className="pt-2">
        {kosong ? (
          <div className="h-[280px] flex flex-col items-center justify-center text-text-muted text-sm space-y-1">
            <p className="font-medium text-text">Belum ada transaksi di periode ini</p>
            <p className="text-xs">Grafik akan terisi otomatis saat invoice selesai dicatat.</p>
          </div>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="warnaPendapatan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2196F3" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2196F3" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="warnaLaba" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="warnaPart" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.6} />
                <XAxis
                  dataKey="tanggal"
                  tickFormatter={formatTanggalSingkat}
                  stroke="var(--text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(val) => rupiahRingkas(Number(val))}
                  stroke="var(--text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-bg-panel p-2.5 rounded-lg border border-border shadow-md text-xs space-y-1 font-sans">
                          <p className="font-semibold text-text mb-1.5">{tanggal(String(label))}</p>
                          {payload.map((entry, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-text-muted">
                                <span
                                  className="size-2 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                />
                                {entry.name}:
                              </span>
                              <span className="font-semibold tabular-nums text-text">
                                {rupiah(Number(entry.value))}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {isOwner ? (
                  <>
                    <Area
                      type="monotone"
                      dataKey="pendapatan"
                      name="Pendapatan"
                      stroke="#2196F3"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#warnaPendapatan)"
                    />
                    <Area
                      type="monotone"
                      dataKey="laba"
                      name="Laba Kotor"
                      stroke="#10B981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#warnaLaba)"
                    />
                  </>
                ) : (
                  <>
                    <Area
                      type="monotone"
                      dataKey="pendapatan_jasa"
                      name="Pendapatan Jasa"
                      stroke="#2196F3"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#warnaPendapatan)"
                    />
                    <Area
                      type="monotone"
                      dataKey="pendapatan_part"
                      name="Pendapatan Part"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#warnaPart)"
                    />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
