import { History } from "lucide-react";
import { BadgeStatus } from "@/components/BadgeStatus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { waktu } from "@/lib/format";

interface StatusHistoryItem {
  id: number;
  dari_status: string | null;
  ke_status: string;
  catatan: string | null;
  created_at: string;
  profiles: {
    nama: string;
  } | null;
}

export function RiwayatStatus({
  history,
}: {
  history: StatusHistoryItem[];
}) {
  if (!history || history.length === 0) {
    return null;
  }

  return (
    <Card className="border-border shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <History className="size-4 text-primary" />
          Riwayat Perubahan Status Work Order
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative border-l-2 border-border ml-3 pl-4 space-y-4">
          {history.map((h, i) => (
            <div key={h.id || i} className="relative">
              {/* Dot */}
              <div className="absolute -left-[23px] top-1.5 size-3 rounded-full border-2 border-card bg-primary" />

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-text-muted">{waktu(h.created_at)}</span>
                <span className="text-xs text-text-muted">·</span>
                <span className="text-xs font-semibold text-text">
                  {h.profiles?.nama || "Sistem"}
                </span>
                <div className="flex items-center gap-1.5 text-xs">
                  {h.dari_status && (
                    <>
                      <BadgeStatus status={h.dari_status} />
                      <span className="text-text-muted">→</span>
                    </>
                  )}
                  <BadgeStatus status={h.ke_status} />
                </div>
              </div>

              {h.catatan && (
                <p className="mt-1 text-xs italic text-text-body bg-muted/30 rounded p-1.5 inline-block">
                  &ldquo;{h.catatan}&rdquo;
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
