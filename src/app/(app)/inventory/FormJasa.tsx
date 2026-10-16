"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";

const skema = z.object({
  nama: z.string().trim().min(1, "Nama jasa servis wajib diisi"),
  kode: z.string().trim().optional(),
  harga_jual: z.number().min(0, "Tarif minimal 0"),
});

type DataForm = z.infer<typeof skema>;

export interface JasaItem {
  id: string;
  kode: string;
  nama: string;
  harga_jual: number;
}

interface Props {
  item?: JasaItem;
  bolehUbah: boolean;
}

export function FormJasa({ item, bolehUbah }: Props) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<DataForm>({
    resolver: zodResolver(skema),
    defaultValues: {
      nama: item?.nama ?? "",
      kode: item?.kode ?? "",
      harga_jual: item?.harga_jual ?? 0,
    },
  });

  async function onSubmit(data: DataForm) {
    try {
      setLoading(true);
      const supabase = createClient();

      if (item) {
        const { error } = await supabase
          .from("inventory_items")
          .update({
            nama: data.nama,
            harga_jual: data.harga_jual,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        if (error) {
          toast.error("Gagal memperbarui jasa: " + error.message);
          return;
        }

        toast.success("Jasa servis berhasil diperbarui.");
      } else {
        const barisItem = {
          jenis: "jasa" as const,
          nama: data.nama,
          harga_jual: data.harga_jual,
          stok: 0,
          stok_minimum: 0,
          kode: data.kode?.trim() || "",
        };

        const { error } = await supabase.from("inventory_items").insert(barisItem);

        if (error) {
          if (error.code === "23505") {
            form.setError("kode", { message: "Kode ini sudah terdaftar." });
          } else {
            toast.error("Gagal menambahkan jasa: " + error.message);
          }
          return;
        }

        toast.success("Jasa servis berhasil ditambahkan.");
      }

      setBuka(false);
      form.reset();
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan sistem saat menyimpan jasa.");
    } finally {
      setLoading(false);
    }
  }

  if (item && !bolehUbah) return null;

  return (
    <Dialog
      open={buka}
      onOpenChange={(v) => {
        setBuka(v);
        if (!v) {
          form.reset({
            nama: item?.nama ?? "",
            kode: item?.kode ?? "",
            harga_jual: item?.harga_jual ?? 0,
          });
        }
      }}
    >
      <DialogTrigger asChild>
        {item ? (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">Ubah</span>
          </Button>
        ) : (
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Jasa Servis
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Ubah Jasa Servis" : "Tambah Jasa Servis Baru"}</DialogTitle>
          <DialogDescription>
            {item ? `Mengubah data jasa servis ${item.nama}` : "Menambah item jasa layanan baru ke dalam bengkel."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nama-jasa">Nama Jasa Servis *</FieldLabel>
              <Input
                id="nama-jasa"
                {...form.register("nama")}
                placeholder="Contoh: Ganti Oli, Tune-up Mesin, Servis Rem"
              />
              <FieldError>{form.formState.errors.nama?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="kode-jasa">Kode Jasa</FieldLabel>
              <Input
                id="kode-jasa"
                {...form.register("kode")}
                placeholder={item ? item.kode : "Otomatis (JS-xxxx)"}
                disabled={!!item}
              />
              <FieldError>{form.formState.errors.kode?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="tarif-jasa">Tarif Layanan (Rp) *</FieldLabel>
              <Input
                id="tarif-jasa"
                type="number"
                min={0}
                step={1000}
                {...form.register("harga_jual", { valueAsNumber: true })}
                placeholder="50000"
              />
              <FieldError>{form.formState.errors.harga_jual?.message}</FieldError>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBuka(false)} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
