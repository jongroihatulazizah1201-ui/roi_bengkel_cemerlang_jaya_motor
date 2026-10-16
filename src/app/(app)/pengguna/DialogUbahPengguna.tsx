"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

const skema = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi"),
  role: z.enum(["owner", "admin", "kepala_mekanik"], {
    message: "Pilih peran yang valid",
  }),
  aktif: z.boolean(),
});

type DataForm = z.infer<typeof skema>;

interface Props {
  pengguna: {
    id: string;
    nama: string;
    email: string;
    role: "owner" | "admin" | "kepala_mekanik";
    aktif: boolean;
  };
  currentUserProfileId: string;
}

export function DialogUbahPengguna({ pengguna, currentUserProfileId }: Props) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [loading, setLoading] = useState(false);

  const isDiriSendiri = pengguna.id === currentUserProfileId;

  const form = useForm<DataForm>({
    resolver: zodResolver(skema),
    defaultValues: {
      nama: pengguna.nama,
      role: pengguna.role,
      aktif: pengguna.aktif,
    },
  });

  async function onSubmit(data: DataForm) {
    try {
      setLoading(true);
      const supabase = createClient();

      const { error } = await supabase
        .from("profiles")
        .update({
          nama: data.nama,
          role: data.role,
          aktif: data.aktif,
        })
        .eq("id", pengguna.id);

      if (error) {
        toast.error("Gagal mengubah pengguna: " + error.message);
        return;
      }

      toast.success("Data pengguna berhasil diperbarui.");
      setBuka(false);
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan sistem saat memperbarui pengguna.");
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
            nama: pengguna.nama,
            role: pengguna.role,
            aktif: pengguna.aktif,
          });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Pencil className="h-3.5 w-3.5" />
          Kelola
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kelola Akun Pengguna</DialogTitle>
          <DialogDescription>
            Atur nama, peran kewenangan, dan status keaktifan akun untuk <strong>{pengguna.email}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nama-pengguna">Nama Lengkap *</FieldLabel>
              <Input id="nama-pengguna" {...form.register("nama")} />
              <FieldError>{form.formState.errors.nama?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="peran-pengguna">Peran Pengguna *</FieldLabel>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isDiriSendiri}
                  >
                    <SelectTrigger id="peran-pengguna">
                      <SelectValue placeholder="Pilih peran" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner (Pemilik Bengkel)</SelectItem>
                      <SelectItem value="admin">Admin (Front Office / Kasir)</SelectItem>
                      <SelectItem value="kepala_mekanik">Kepala Mekanik</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {isDiriSendiri && (
                <p className="text-xs text-text-muted mt-1">
                  Anda tidak dapat mengubah peran akun Anda sendiri.
                </p>
              )}
              <FieldError>{form.formState.errors.role?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="status-aktif-pengguna">Status Keaktifan Akun *</FieldLabel>
              <Controller
                control={form.control}
                name="aktif"
                render={({ field }) => (
                  <Select
                    value={field.value ? "true" : "false"}
                    onValueChange={(val) => field.onChange(val === "true")}
                    disabled={isDiriSendiri}
                  >
                    <SelectTrigger id="status-aktif-pengguna">
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Aktif (Dapat Login)</SelectItem>
                      <SelectItem value="false">Nonaktif (Akses Diblokir)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {isDiriSendiri && (
                <p className="text-xs text-text-muted mt-1">
                  Anda tidak dapat menonaktifkan akun Anda sendiri.
                </p>
              )}
              <FieldError>{form.formState.errors.aktif?.message}</FieldError>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBuka(false)} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
