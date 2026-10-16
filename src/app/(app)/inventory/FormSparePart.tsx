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
  nama: z.string().trim().min(1, "Nama spare part wajib diisi"),
  kode: z.string().trim().optional(),
  harga_jual: z.number().min(0, "Harga jual minimal 0"),
  stok_minimum: z.number().int().min(0, "Stok minimum minimal 0"),
  harga_modal: z.number().min(0, "Harga modal minimal 0").optional(),
});

type DataForm = z.infer<typeof skema>;

export interface SparePartItem {
  id: string;
  kode: string;
  nama: string;
  harga_jual: number;
  stok: number;
  stok_minimum: number;
  harga_modal?: number | null;
}

interface Props {
  item?: SparePartItem;
  isOwner: boolean;
}

export function FormSparePart({ item, isOwner }: Props) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<DataForm>({
    resolver: zodResolver(skema),
    defaultValues: {
      nama: item?.nama ?? "",
      kode: item?.kode ?? "",
      harga_jual: item?.harga_jual ?? 0,
      stok_minimum: item?.stok_minimum ?? 5,
      harga_modal: item?.harga_modal ?? undefined,
    },
  });

  async function onSubmit(data: DataForm) {
    try {
      setLoading(true);
      const supabase = createClient();

      if (item) {
        // Mode edit (Owner only)
        const { error: errorItem } = await supabase
          .from("inventory_items")
          .update({
            nama: data.nama,
            harga_jual: data.harga_jual,
            stok_minimum: data.stok_minimum,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        if (errorItem) {
          toast.error("Gagal memperbarui spare part: " + errorItem.message);
          return;
        }

        // Jika Owner mengubah/mengisi harga modal
        if (isOwner && data.harga_modal !== undefined && !isNaN(data.harga_modal)) {
          const { error: errorModal } = await supabase
            .from("inventory_costs")
            .upsert({
              item_id: item.id,
              harga_modal: data.harga_modal,
              updated_at: new Date().toISOString(),
            });

          if (errorModal) {
            toast.error("Gagal memperbarui harga modal: " + errorModal.message);
            return;
          }
        }

        toast.success("Spare part berhasil diperbarui.");
      } else {
        // Mode tambah baru (Admin atau Owner)
        const barisItem = {
          jenis: "part" as const,
          nama: data.nama,
          harga_jual: data.harga_jual,
          stok_minimum: data.stok_minimum,
          kode: data.kode?.trim() || "",
        };

        const { data: hasil, error: errorInsert } = await supabase
          .from("inventory_items")
          .insert(barisItem)
          .select("id")
          .single();

        if (errorInsert) {
          if (errorInsert.code === "23505") {
            form.setError("kode", { message: "Kode/SKU ini sudah terdaftar." });
          } else {
            toast.error("Gagal menambahkan spare part: " + errorInsert.message);
          }
          return;
        }

        // Bila Owner yang menambahkan dan mengisi harga modal
        if (isOwner && data.harga_modal !== undefined && !isNaN(data.harga_modal)) {
          await supabase.from("inventory_costs").insert({
            item_id: hasil.id,
            harga_modal: data.harga_modal,
          });
        }

        toast.success("Spare part berhasil ditambahkan.");
      }

      setBuka(false);
      form.reset();
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan sistem saat menyimpan spare part.");
    } finally {
      setLoading(false);
    }
  }

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
            stok_minimum: item?.stok_minimum ?? 5,
            harga_modal: item?.harga_modal ?? undefined,
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
            Spare Part
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Ubah Spare Part" : "Tambah Spare Part Baru"}</DialogTitle>
          <DialogDescription>
            {item
              ? `Mengubah informasi spare part ${item.nama}. Stok tidak diubah dari form ini.`
              : "Menambah item spare part baru ke inventory bengkel. Stok awal bernilai 0."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nama-part">Nama Spare Part *</FieldLabel>
              <Input
                id="nama-part"
                {...form.register("nama")}
                placeholder="Contoh: Oli Mesin 4L Fastron 10W-40"
              />
              <FieldError>{form.formState.errors.nama?.message}</FieldError>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="kode-part">Kode / SKU</FieldLabel>
                <Input
                  id="kode-part"
                  {...form.register("kode")}
                  placeholder={item ? item.kode : "Otomatis (SP-xxxx)"}
                  disabled={!!item}
                />
                <FieldError>{form.formState.errors.kode?.message}</FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="stok-min-part">Stok Minimum *</FieldLabel>
                <Input
                  id="stok-min-part"
                  type="number"
                  min={0}
                  {...form.register("stok_minimum", { valueAsNumber: true })}
                />
                <FieldError>{form.formState.errors.stok_minimum?.message}</FieldError>
              </Field>
            </div>

            <div className={`grid ${isOwner ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
              <Field>
                <FieldLabel htmlFor="harga-jual-part">Harga Jual (Rp) *</FieldLabel>
                <Input
                  id="harga-jual-part"
                  type="number"
                  min={0}
                  step={1000}
                  {...form.register("harga_jual", { valueAsNumber: true })}
                />
                <FieldError>{form.formState.errors.harga_jual?.message}</FieldError>
              </Field>

              {isOwner && (
                <Field>
                  <FieldLabel htmlFor="harga-modal-part">Harga Modal (Rp) {item ? "" : "*"}</FieldLabel>
                  <Input
                    id="harga-modal-part"
                    type="number"
                    min={0}
                    step={1000}
                    {...form.register("harga_modal", { valueAsNumber: true })}
                    placeholder="0"
                  />
                  <FieldError>{form.formState.errors.harga_modal?.message}</FieldError>
                </Field>
              )}
            </div>

            {!isOwner && !item && (
              <p className="text-xs text-text-muted">
                * Harga modal akan diisi oleh Owner kemudian.
              </p>
            )}
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
