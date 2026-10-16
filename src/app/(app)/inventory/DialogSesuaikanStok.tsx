"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

const skema = z.object({
  stokFisik: z.number().int().min(0, "Stok fisik tidak boleh kurang dari 0"),
  alasan: z.string().trim().min(3, "Alasan penyesuaian wajib diisi (minimal 3 karakter)"),
});

type DataForm = z.infer<typeof skema>;

interface Props {
  itemId: string;
  namaItem: string;
  kodeItem: string;
  stokSaatIni: number;
}

export function DialogSesuaikanStok({ itemId, namaItem, kodeItem, stokSaatIni }: Props) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<DataForm>({
    resolver: zodResolver(skema),
    defaultValues: {
      stokFisik: stokSaatIni,
      alasan: "",
    },
  });

  const stokFisikInput = form.watch("stokFisik");
  const selisih = typeof stokFisikInput === "number" ? stokFisikInput - stokSaatIni : 0;

  async function onSubmit(data: DataForm) {
    if (data.stokFisik === stokSaatIni) {
      form.setError("stokFisik", { message: "Stok fisik sama dengan stok sistem saat ini." });
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();

      const { error } = await supabase.rpc("sesuaikan_stok", {
        p_item: itemId,
        p_stok_fisik: data.stokFisik,
        p_alasan: data.alasan,
      });

      if (error) {
        toast.error(error.message || "Gagal menyesuaikan stok.");
        return;
      }

      toast.success(`Stok fisik ${namaItem} berhasil disesuaikan menjadi ${data.stokFisik} unit.`);
      setBuka(false);
      form.reset();
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan sistem saat menyesuaikan stok.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={(v) => {
        setBuka(v);
        if (!v) form.reset({ stokFisik: stokSaatIni, alasan: "" });
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-amber-700 hover:text-amber-800">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Sesuaikan Stok
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Penyesuaian Stok (Stock Opname)</DialogTitle>
          <DialogDescription>
            Menyesuaikan stok spare part <strong>{namaItem}</strong> ({kodeItem}) berdasarkan hitung fisik.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="rounded-lg bg-muted/60 p-3 text-xs text-text-body space-y-1">
            <div className="flex justify-between">
              <span>Stok sistem saat ini:</span>
              <strong className="text-text tabular-nums">{stokSaatIni} unit</strong>
            </div>
            <div className="flex justify-between">
              <span>Stok hasil hitung fisik:</span>
              <strong className="text-text tabular-nums">{stokFisikInput ?? 0} unit</strong>
            </div>
            <div className="flex justify-between border-t border-border pt-1">
              <span>Selisih penyesuaian:</span>
              <strong
                className={`tabular-nums ${
                  selisih > 0 ? "text-success" : selisih < 0 ? "text-danger" : "text-text-muted"
                }`}
              >
                {selisih > 0 ? `+${selisih}` : selisih} unit
              </strong>
            </div>
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="stok-fisik">Stok Hasil Hitung Fisik (unit) *</FieldLabel>
              <Input
                id="stok-fisik"
                type="number"
                min={0}
                {...form.register("stokFisik", { valueAsNumber: true })}
                placeholder="0"
              />
              <FieldError>{form.formState.errors.stokFisik?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="alasan-penyesuaian">Alasan Penyesuaian *</FieldLabel>
              <Textarea
                id="alasan-penyesuaian"
                {...form.register("alasan")}
                placeholder="Wajib diisi, misalnya: Stock opname akhir bulan / Selisih fisik barang rusak"
                rows={3}
              />
              <FieldError>{form.formState.errors.alasan?.message}</FieldError>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBuka(false)} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Penyesuaian"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
