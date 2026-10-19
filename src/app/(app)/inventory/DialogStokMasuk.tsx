"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowDownToLine } from "lucide-react";
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
  jumlah: z.number().int().min(1, "Jumlah minimal 1"),
  keterangan: z.string().trim().optional(),
});

type DataForm = z.infer<typeof skema>;

interface Props {
  itemId: string;
  namaItem: string;
  kodeItem: string;
  stokSaatIni: number;
}

export function DialogStokMasuk({ itemId, namaItem, kodeItem, stokSaatIni }: Props) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<DataForm>({
    resolver: zodResolver(skema),
    defaultValues: {
      jumlah: 1,
      keterangan: "",
    },
  });

  async function onSubmit(data: DataForm) {
    try {
      setLoading(true);
      const supabase = createClient();

      const { error } = await supabase.rpc("catat_stok_masuk", {
        p_item: itemId,
        p_jumlah: data.jumlah,
        p_keterangan: data.keterangan || undefined,
      });

      if (error) {
        toast.error(error.message || "Gagal mencatat stok masuk.");
        return;
      }

      toast.success(`Stok ${namaItem} berhasil ditambah ${data.jumlah} unit.`);
      setBuka(false);
      form.reset();
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan sistem saat mencatat stok masuk.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={(v) => {
        setBuka(v);
        if (!v) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-primary hover:text-primary-strong">
          <ArrowDownToLine className="h-3.5 w-3.5" />
          Stok Masuk
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Catat Stok Masuk</DialogTitle>
          <DialogDescription>
            Menambah stok spare part <strong>{namaItem}</strong> ({kodeItem}). Stok saat ini:{" "}
            <strong>{stokSaatIni} unit</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="jumlah-masuk">Jumlah Masuk (unit) *</FieldLabel>
              <Input
                id="jumlah-masuk"
                type="number"
                min={1}
                {...form.register("jumlah", { valueAsNumber: true })}
                placeholder="1"
              />
              <FieldError>{form.formState.errors.jumlah?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="keterangan-masuk">Keterangan (opsional)</FieldLabel>
              <Textarea
                id="keterangan-masuk"
                {...form.register("keterangan")}
                placeholder="Contoh: Pembelian dari Toko Sinar, Surat Jalan No. 123"
                rows={3}
              />
              <FieldError>{form.formState.errors.keterangan?.message}</FieldError>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBuka(false)} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Stok Masuk"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
