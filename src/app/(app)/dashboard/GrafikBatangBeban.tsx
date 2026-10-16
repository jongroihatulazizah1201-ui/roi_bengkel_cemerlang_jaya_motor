"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight } from "lucide-react";

export interface DataBebanMekanik {
  mekanik: string;
  tim: string;
  wo_aktif: number;
  wo_selesai: number;
}

export function GrafikBatangBeban({ data }: { data: DataBebanMekanik[] }) {
  const router = useRouter();
  const kosong = !data || data.length === 0;

  return (
    <Card className="bg-bg-panel border-border shadow-card flex flex-col justify-between">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold text-text">Beban Kerja Mekanik</CardTitle>
          <CardDescription className="text-xs text-text-muted mt-1">
            Jumlah WO aktif dan selesai periode ini (klik batang untuk membuka tim)
          </CardDescription>
        </div>
        <Link
          href="/tim-mekanik"
          className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
        >
          <span>Kelola Tim</span>
          <ArrowUpRight className="size-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="pt-2">
        {kosong ? (
          <div className="h-[280px] flex flex-col items-center justify-center text-text-muted text-sm space-y-1">
            <p className="font-medium text-text">Belum ada data mekanik</p>
            <p className="text-xs">Data akan terisi saat mekanik ditugaskan pada Work Order.</p>
          </div>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                onClick={() => router.push("/tim-mekanik")}
                className="cursor-pointer"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.6} />
                <XAxis
                  dataKey="mekanik"
                  stroke="var(--text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="var(--text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-bg-panel p-2.5 rounded-lg border border-border shadow-md text-xs space-y-1">
                          <p className="font-semibold text-text mb-1">{label}</p>
                          {payload.map((entry, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5 text-text-muted">
                                <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                {entry.name}:
                              </span>
                              <span className="font-bold tabular-nums text-text">{Number(entry.value)} WO</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px", paddingBottom: "10px" }}
                />
                <Bar
                  dataKey="wo_aktif"
                  name="Sedang Dikerjakan"
                  fill="#2196F3"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="wo_selesai"
                  name="Selesai Periode Ini"
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
