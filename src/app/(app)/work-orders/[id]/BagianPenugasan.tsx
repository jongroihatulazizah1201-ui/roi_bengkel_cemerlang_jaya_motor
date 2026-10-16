"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Check, Loader2, ArrowRightLeft, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tanggal } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

interface MekanikItem {
  id: string;
  nama: string;
  woAktif: number;
}

interface PenugasanProps {
  wo: {
    id: string;
    status: string;
    kepala_mekanik_id: string;
    estimasi_selesai: string | null;
    profiles: { nama: string } | null;
    work_order_mekanik: {
      mekanik: { id: string; nama: string } | null;
    }[];
  };
  profil: {
    id: string;
    nama: string;
    peran: "owner" | "admin" | "kepala_mekanik";
  };
  daftarMekanikTim: MekanikItem[];
  daftarKepalaMekanik: { id: string; nama: string }[];
}

export function BagianPenugasan({
  wo,
  profil,
  daftarMekanikTim,
  daftarKepalaMekanik,
}: PenugasanProps) {
  const router = useRouter();
  const supabase = createClient();

  const isOwner = profil.peran === "owner";
  const isAdmin = profil.peran === "admin";
  const isKepalaMekanikTim =
    profil.peran === "kepala_mekanik" && wo.kepala_mekanik_id === profil.id;

  const bolehTugaskan = (isOwner || isKepalaMekanikTim) && wo.status === "menunggu";
  const bolehPindahTim = (isOwner || isAdmin) && wo.status === "menunggu";

  // Mekanik yang sudah ditugaskan saat ini
  const mekanikTerpilihAwal = wo.work_order_mekanik
    .map((wm) => wm.mekanik?.id)
    .filter(Boolean) as string[];

  const [mekanikTerpilih, setMekanikTerpilih] = useState<string[]>(mekanikTerpilihAwal);
  const [estimasiSelesai, setEstimasiSelesai] = useState<string>(
    wo.estimasi_selesai || new Date().toISOString().split("T")[0],
  );
  const [timId, setTimId] = useState(wo.kepala_mekanik_id);
  const [loading, setLoading] = useState(false);
  const [modePindahTim, setModePindahTim] = useState(false);

  const hariIni = new Date().toISOString().split("T")[0];

  // Toggle pilihan mekanik (maksimal 3 mekanik sesuai PRD)
  const handleToggleMekanik = (mId: string) => {
    if (mekanikTerpilih.includes(mId)) {
      setMekanikTerpilih(mekanikTerpilih.filter((id) => id !== mId));
    } else {
      if (mekanikTerpilih.length >= 3) {
        toast.error("Maksimal 3 mekanik per work order");
        return;
      }
      setMekanikTerpilih([...mekanikTerpilih, mId]);
    }
  };

  // Simpan penugasan & langsung mulai kerjakan (PRD 6.8 Bagian B)
  const handleTugaskanDanMulai = async (langsungMulai: boolean = true) => {
    if (mekanikTerpilih.length === 0) {
      toast.error("Pilih minimal 1 mekanik untuk pengerjaan");
      return;
    }

    if (!estimasiSelesai) {
      toast.error("Tentukan estimasi tanggal selesai");
      return;
    }

    if (estimasiSelesai < hariIni) {
      toast.error("Estimasi selesai tidak boleh sebelum hari ini");
      return;
    }

    setLoading(true);
    try {
      // 1. Panggil RPC tugaskan_mekanik
      const { error: tugaskanErr } = await supabase.rpc("tugaskan_mekanik", {
        p_wo: wo.id,
        p_mekanik: mekanikTerpilih,
        p_estimasi: estimasiSelesai,
      });

      if (tugaskanErr) throw tugaskanErr;

      // 2. Bila langsung mulai, ubah status ke 'dikerjakan'
      if (langsungMulai) {
        const { error: statusErr } = await supabase.rpc("ubah_status_wo", {
          p_wo: wo.id,
          p_status: "dikerjakan",
          p_catatan: "Penugasan mekanik selesai, pekerjaan dimulai",
        });

        if (statusErr) throw statusErr;
        toast.success("Mekanik ditugaskan dan pengerjaan dimulai!");
      } else {
        toast.success("Penugasan mekanik berhasil disimpan!");
      }

      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan penugasan");
    } finally {
      setLoading(false);
    }
  };

  // Pindahkan ke tim Kepala Mekanik lain (hanya saat status menunggu oleh Admin / Owner)
  const handlePindahTim = async () => {
    if (timId === wo.kepala_mekanik_id) {
      setModePindahTim(false);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("work_orders")
        .update({ kepala_mekanik_id: timId })
        .eq("id", wo.id);

      if (error) throw error;

      toast.success("Work Order berhasil dipindahkan ke tim lain");
      setModePindahTim(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memindahkan tim");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card id="bagian-penugasan" className="border-border shadow-card">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="space-y-0.5">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Users className="size-4 text-primary" />
            Bagian B. Penugasan Tim & Mekanik
          </CardTitle>
          <p className="text-xs text-text-muted">
            Dipimpin oleh: <span className="font-semibold text-text">{wo.profiles?.nama ?? "-"}</span>
          </p>
        </div>

        {bolehPindahTim && !modePindahTim && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setModePindahTim(true)}
          >
            <ArrowRightLeft className="size-3.5" />
            Pindah Tim
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Mode Pindah Tim (Admin/Owner saat menunggu) */}
        {modePindahTim && (
          <div className="rounded-lg border border-primary/20 bg-primary-soft/30 p-3 space-y-2">
            <Label htmlFor="pindahTim" className="text-xs font-semibold">
              Pilih Tim Kepala Mekanik Baru
            </Label>
            <div className="flex gap-2">
              <select
                id="pindahTim"
                value={timId}
                onChange={(e) => setTimId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
              >
                {daftarKepalaMekanik.map((km) => (
                  <option key={km.id} value={km.id}>
                    {km.nama}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={handlePindahTim} disabled={loading} className="bg-primary hover:bg-primary-strong">
                Simpan
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setModePindahTim(false)}>
                Batal
              </Button>
            </div>
          </div>
        )}

        {/* Jika status SUDAH BUKAN MENUNGGU: Tampilkan penugasan terkunci */}
        {wo.status !== "menunggu" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
              <span className="text-xs font-medium text-text-muted">Mekanik yang Ditugaskan:</span>
              <div className="flex flex-wrap gap-1.5">
                {wo.work_order_mekanik.length > 0 ? (
                  wo.work_order_mekanik.map((wm, i) => (
                    <Badge key={i} variant="secondary" className="bg-card font-medium text-text">
                      {wm.mekanik?.nama ?? "-"}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-text-muted">Belum ada mekanik</span>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
              <span className="text-xs font-medium text-text-muted">Estimasi Selesai:</span>
              <div className="text-sm font-semibold text-text">
                {wo.estimasi_selesai ? tanggal(wo.estimasi_selesai) : "Belum diisi"}
              </div>
            </div>
          </div>
        )}

        {/* Form Penugasan untuk Kepala Mekanik Tim WO atau Owner saat MENUNGGU */}
        {bolehTugaskan && (
          <div className="space-y-4 rounded-xl border border-primary/20 bg-primary-soft/10 p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-primary-strong">
                  Pilih Mekanik (1 - 3 orang) *
                </Label>
                <span className="text-xs text-text-muted">
                  Diurutkan dari beban paling ringan
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {daftarMekanikTim.map((m, idx) => {
                  const terpilih = mekanikTerpilih.includes(m.id);
                  const palingRingan = idx === 0;

                  return (
                    <div
                      key={m.id}
                      onClick={() => handleToggleMekanik(m.id)}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors ${
                        terpilih
                          ? "border-primary bg-primary/10 shadow-xs"
                          : "border-border bg-card hover:bg-muted/40"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-text">{m.nama}</span>
                          {palingRingan && (
                            <span className="flex items-center gap-0.5 rounded-full bg-warning/20 px-1.5 py-0.2 text-[10px] font-semibold text-warning">
                              <Star className="size-2.5 fill-warning" />
                              Disarankan
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-text-muted">{m.woAktif} WO aktif</div>
                      </div>

                      <div
                        className={`size-5 rounded-md border flex items-center justify-center ${
                          terpilih
                            ? "border-primary bg-primary text-white"
                            : "border-input bg-card"
                        }`}
                      >
                        {terpilih && <Check className="size-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-end pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="estSelesai" className="text-xs font-semibold">
                  Estimasi Selesai *
                </Label>
                <div className="relative">
                  <Input
                    id="estSelesai"
                    type="date"
                    min={hariIni}
                    value={estimasiSelesai}
                    onChange={(e) => setEstimasiSelesai(e.target.value)}
                    className="bg-card"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => handleTugaskanDanMulai(true)}
                  disabled={loading || mekanikTerpilih.length === 0 || !estimasiSelesai}
                  className="w-full sm:w-auto bg-primary hover:bg-primary-strong"
                >
                  {loading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Mulai Kerjakan
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Info jika bukan kepala mekanik tim WO dan bukan owner saat status menunggu */}
        {wo.status === "menunggu" && !bolehTugaskan && (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-text-muted">
            Menunggu Kepala Mekanik <span className="font-semibold">{wo.profiles?.nama}</span> untuk menugaskan mekanik dan memulai pengerjaan.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
