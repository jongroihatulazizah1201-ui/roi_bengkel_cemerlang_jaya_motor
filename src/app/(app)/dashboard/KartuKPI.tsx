import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Minus, LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";

interface PropsKartuKPI {
  label: string;
  nilai: string | number;
  subtext?: string;
  persenPerubahan?: number | null;
  ikon: LucideIcon;
  warnaIkon?: string;
  href?: string;
  peringatan?: boolean;
}

export function KartuKPI({
  label,
  nilai,
  subtext,
  persenPerubahan,
  ikon: Ikon,
  warnaIkon = "bg-primary/10 text-primary",
  href,
  peringatan = false,
}: PropsKartuKPI) {
  const kontenKartu = (
    <Card
      className={cn(
        "bg-bg-panel border-border shadow-card h-full flex flex-col justify-between transition-colors",
        peringatan && "border-red-500/30 bg-red-500/5",
        href && "group-hover:border-primary/40 group-hover:shadow-md"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-text-muted group-hover:text-text transition-colors">
          {label}
        </CardTitle>
        <div className={cn("p-2 rounded-lg transition-transform group-hover:scale-105", warnaIkon)}>
          <Ikon className="size-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-bold tracking-tight text-text tabular-nums",
            peringatan && "text-red-600"
          )}
        >
          {nilai}
        </div>

        <div className="flex items-center gap-2 mt-2 text-xs">
          {persenPerubahan !== undefined && persenPerubahan !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums",
                persenPerubahan > 0
                  ? "bg-emerald-500/10 text-emerald-600"
                  : persenPerubahan < 0
                  ? "bg-red-500/10 text-red-600"
                  : "bg-muted text-text-muted"
              )}
            >
              {persenPerubahan > 0 ? (
                <ArrowUpRight className="size-3" />
              ) : persenPerubahan < 0 ? (
                <ArrowDownRight className="size-3" />
              ) : (
                <Minus className="size-3" />
              )}
              {persenPerubahan > 0 ? `+${persenPerubahan.toFixed(0)}%` : `${persenPerubahan.toFixed(0)}%`}
            </span>
          )}

          {subtext && <span className="text-text-muted truncate">{subtext}</span>}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block group transition-all duration-200 hover:-translate-y-0.5 cursor-pointer">
        {kontenKartu}
      </Link>
    );
  }

  return <div className="block">{kontenKartu}</div>;
}
