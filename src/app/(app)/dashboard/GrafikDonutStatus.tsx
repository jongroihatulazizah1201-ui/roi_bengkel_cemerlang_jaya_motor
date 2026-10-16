"use client";

import { useRouter } from "next/navigation";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_WO, isStatusWO } from "@/lib/status-wo";

const WARNA_HEX: Record<string, string> = {
  menunggu: "#9E9E9E",
  dikerjakan: "#2196F3",
  tertunda: "#F59E0B",
  selesai: "#7E57C2",
  siap_diambil: "#4CAF50",
  diambil: "#2E7D32",
  dibatalkan: "#E53935",
};

export interface DataStatusWO {
  status: string;
  jumlah: number;
}

export function GrafikDonutStatus({ data }: { data: DataStatusWO[] }) {
  const router = useRouter();

  const dataValid = (data ?? []).filter((d) => d.jumlah > 0);
  const total = dataValid.reduce((acc, curr) => acc + curr.jumlah, 0);

  const klikStatus = (status: string) => {
    router.push(`/work-orders?status=${status}`);
  };

  return (
    <Card className="bg-bg-panel border-border shadow-card flex flex-col justify-between">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-text">Komposisi Work Order</CardTitle>
        <CardDescription className="text-xs text-text-muted">
          Distribusi status WO (klik bagian donat untuk membuka daftar)
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        {total === 0 ? (
          <div className="h-[280px] flex flex-col items-center justify-center text-text-muted text-sm space-y-1">
            <p className="font-medium text-text">Tidak ada Work Order</p>
            <p className="text-xs">Data status akan muncul saat WO dibuat.</p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="h-[220px] w-full sm:w-[220px] relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataValid}
                    dataKey="jumlah"
                    nameKey="status"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    cursor="pointer"
                    onClick={(_, index) => { const item = dataValid[index]; if (item?.status) klikStatus(item.status); }}
                  >
                    {dataValid.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={WARNA_HEX[entry.status] || "#9E9E9E"}
                        className="transition-opacity hover:opacity-80"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload as DataStatusWO;
                        const label = isStatusWO(item.status) ? STATUS_WO[item.status].label : item.status;
                        const persen = total > 0 ? ((item.jumlah / total) * 100).toFixed(0) : "0";
                        return (
                          <div className="bg-bg-panel p-2 rounded-lg border border-border shadow-md text-xs">
                            <span className="font-semibold text-text">{label}</span>:{" "}
                            <span className="font-bold tabular-nums">{item.jumlah} WO</span> ({persen}%)
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-text tabular-nums">{total}</span>
                <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider">Total WO</span>
              </div>
            </div>

            {/* Legenda Interaktif */}
            <div className="flex flex-col gap-1.5 w-full sm:w-auto text-xs">
              {dataValid.map((item) => {
                const label = isStatusWO(item.status) ? STATUS_WO[item.status].label : item.status;
                const warna = WARNA_HEX[item.status] || "#9E9E9E";
                return (
                  <button
                    key={item.status}
                    type="button"
                    onClick={() => klikStatus(item.status)}
                    className="flex items-center justify-between gap-3 px-2 py-1 rounded hover:bg-bg-app transition text-left cursor-pointer group"
                  >
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: warna }} />
                      <span className="text-text-muted group-hover:text-text">{label}</span>
                    </span>
                    <span className="font-semibold text-text tabular-nums">{item.jumlah}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
