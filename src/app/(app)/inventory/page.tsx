import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Paginasi } from "@/components/Paginasi";
import { rupiah, tanggal } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { DialogStokMasuk } from "./DialogStokMasuk";
import { DialogSesuaikanStok } from "./DialogSesuaikanStok";
import { FormSparePart } from "./FormSparePart";
import { FormJasa } from "./FormJasa";

const PER_HALAMAN = 20;

type TabAktif = "part" | "jasa" | "riwayat";

export default async function HalamanInventory({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    hal?: string;
    status?: string;
  }>;
}) {
  const { tab = "part", q = "", hal, status = "semua" } = await searchParams;
  const tabAktif: TabAktif = tab === "jasa" || tab === "riwayat" ? tab : "part";
  const halaman = Math.max(1, Number(hal) || 1);
  const cari = q.replace(/[,()*%\\]/g, " ").trim();

  const profil = await ambilProfilSaya();
  const supabase = await createClient();

  const isOwner = profil.peran === "owner";
  const bolehUbah = profil.peran === "admin" || profil.peran === "owner";

  // -------------------------------------------------------------
  // TAB 1: SPARE PART
  // -------------------------------------------------------------
  let spareParts: Array<{
    id: string;
    kode: string;
    nama: string;
    harga_jual: number;
    stok: number;
    stok_minimum: number;
    aktif: boolean;
    inventory_costs?: { harga_modal: number } | null;
  }> = [];
  let totalSparePart = 0;
  let errorSparePart = false;

  if (tabAktif === "part") {
    // PRD: Kolom harga modal dari inventory_costs HANYA diambil untuk Owner
    const kolomPilihan = isOwner
      ? "id, kode, nama, harga_jual, stok, stok_minimum, aktif, inventory_costs(harga_modal)"
      : "id, kode, nama, harga_jual, stok, stok_minimum, aktif";

    let kueri = supabase
      .from("inventory_items")
      .select(kolomPilihan, { count: "exact" })
      .eq("jenis", "part");

    if (cari) {
      kueri = kueri.or(`nama.ilike.%${cari}%,kode.ilike.%${cari}%`);
    }

    if (status === "habis") {
      kueri = kueri.eq("stok", 0);
    }

    const { data, count, error } = await kueri
      .order("nama")
      .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

    if (error) {
      errorSparePart = true;
    } else {
      totalSparePart = count ?? 0;
      let hasil = (data as unknown as typeof spareParts) ?? [];

      // Filter status di aplikasi bila perlu perbandingan stok vs stok_minimum
      if (status === "menipis") {
        hasil = hasil.filter((item) => item.stok > 0 && item.stok <= item.stok_minimum);
      } else if (status === "aman") {
        hasil = hasil.filter((item) => item.stok > item.stok_minimum);
      }
      spareParts = hasil;
    }
  }

  // -------------------------------------------------------------
  // TAB 2: JASA
  // -------------------------------------------------------------
  let jasaList: Array<{
    id: string;
    kode: string;
    nama: string;
    harga_jual: number;
    aktif: boolean;
  }> = [];
  let totalJasa = 0;
  let errorJasa = false;

  if (tabAktif === "jasa") {
    let kueri = supabase
      .from("inventory_items")
      .select("id, kode, nama, harga_jual, aktif", { count: "exact" })
      .eq("jenis", "jasa");

    if (cari) {
      kueri = kueri.or(`nama.ilike.%${cari}%,kode.ilike.%${cari}%`);
    }

    const { data, count, error } = await kueri
      .order("nama")
      .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

    if (error) {
      errorJasa = true;
    } else {
      totalJasa = count ?? 0;
      jasaList = (data as unknown as typeof jasaList) ?? [];
    }
  }

  // -------------------------------------------------------------
  // TAB 3: RIWAYAT STOK
  // -------------------------------------------------------------
  let riwayatList: Array<{
    id: number;
    created_at: string;
    jenis: string;
    jumlah: number;
    stok_sesudah: number;
    keterangan: string | null;
    inventory_items: { id: string; kode: string; nama: string } | null;
    work_orders: { nomor: string } | null;
    profiles: { nama: string } | null;
  }> = [];
  let totalRiwayat = 0;
  let errorRiwayat = false;

  if (tabAktif === "riwayat") {
    let kueri = supabase
      .from("stock_movements")
      .select(
        "id, created_at, jenis, jumlah, stok_sesudah, keterangan, inventory_items(id, kode, nama), work_orders(nomor), profiles(nama)",
        { count: "exact" }
      );

    if (cari) {
      kueri = kueri.or(`keterangan.ilike.%${cari}%`);
    }

    const { data, count, error } = await kueri
      .order("created_at", { ascending: false })
      .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

    if (error) {
      errorRiwayat = true;
    } else {
      totalRiwayat = count ?? 0;
      riwayatList = (data as unknown as typeof riwayatList) ?? [];
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-text">Inventory</h1>
        <div className="flex items-center gap-2">
          {bolehUbah && tabAktif === "part" && <FormSparePart isOwner={isOwner} />}
          {bolehUbah && tabAktif === "jasa" && <FormJasa bolehUbah={bolehUbah} />}
        </div>
      </div>

      {/* Navigasi Tab */}
      <div className="flex border-b border-border space-x-6 text-sm font-medium">
        <Link
          href="?tab=part"
          className={`pb-3 border-b-2 transition-colors ${
            tabAktif === "part"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          Spare Part
        </Link>
        <Link
          href="?tab=jasa"
          className={`pb-3 border-b-2 transition-colors ${
            tabAktif === "jasa"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          Jasa Servis
        </Link>
        <Link
          href="?tab=riwayat"
          className={`pb-3 border-b-2 transition-colors ${
            tabAktif === "riwayat"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          Riwayat Stok
        </Link>
      </div>

      {/* Bar Pencarian & Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form className="flex w-full max-w-md gap-2" role="search">
          <input type="hidden" name="tab" value={tabAktif} />
          {status !== "semua" && <input type="hidden" name="status" value={status} />}
          <Input
            name="q"
            defaultValue={q}
            placeholder={
              tabAktif === "part"
                ? "Cari nama atau kode spare part..."
                : tabAktif === "jasa"
                ? "Cari nama atau kode jasa..."
                : "Cari riwayat stok..."
            }
          />
          <Button type="submit" variant="outline">
            <Search className="h-4 w-4" />
            Cari
          </Button>
        </form>

        {tabAktif === "part" && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-text-muted mr-1">Status:</span>
            {[
              { id: "semua", label: "Semua" },
              { id: "habis", label: "Habis" },
              { id: "menipis", label: "Menipis" },
              { id: "aman", label: "Aman" },
            ].map((st) => (
              <Link
                key={st.id}
                href={`?tab=part&status=${st.id}${cari ? `&q=${cari}` : ""}`}
                className={`px-2.5 py-1 rounded-full border transition-colors ${
                  status === st.id
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-text-body border-border hover:bg-muted"
                }`}
              >
                {st.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* KONTEN TAB 1: SPARE PART */}
      {tabAktif === "part" && (
        <>
          <Card className="py-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 w-28">Kode / SKU</TableHead>
                  <TableHead>Nama Spare Part</TableHead>
                  <TableHead className="text-right">Stok</TableHead>
                  <TableHead className="text-right">Min</TableHead>
                  <TableHead className="text-right">Harga Jual</TableHead>
                  {isOwner && <TableHead className="text-right">Harga Modal</TableHead>}
                  <TableHead className="text-center w-28">Status</TableHead>
                  <TableHead className="pr-4 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errorSparePart && (
                  <TableRow>
                    <TableCell colSpan={isOwner ? 8 : 7} className="py-10 text-center text-danger">
                      Gagal memuat data spare part. Silakan muat ulang halaman.
                    </TableCell>
                  </TableRow>
                )}
                {!errorSparePart && spareParts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isOwner ? 8 : 7} className="py-10 text-center text-muted-foreground">
                      {cari ? `Tidak ada spare part yang cocok dengan "${cari}".` : "Belum ada data spare part."}
                    </TableCell>
                  </TableRow>
                )}
                {spareParts.map((sp) => {
                  const statusStok =
                    sp.stok === 0
                      ? { label: "Habis", variant: "destructive" as const, className: "" }
                      : sp.stok <= sp.stok_minimum
                      ? { label: "Menipis", variant: "outline" as const, className: "bg-amber-50 text-amber-700 border-amber-200" }
                      : { label: "Aman", variant: "outline" as const, className: "bg-emerald-50 text-emerald-700 border-emerald-200" };

                  const hargaModal = sp.inventory_costs?.harga_modal;

                  return (
                    <TableRow key={sp.id}>
                      <TableCell className="pl-4 font-mono text-xs text-text-muted">{sp.kode}</TableCell>
                      <TableCell className="font-medium text-text">{sp.nama}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-text">{sp.stok}</TableCell>
                      <TableCell className="text-right text-text-muted tabular-nums">{sp.stok_minimum}</TableCell>
                      <TableCell className="text-right tabular-nums text-text">{rupiah(sp.harga_jual)}</TableCell>
                      {isOwner && (
                        <TableCell className="text-right tabular-nums">
                          {hargaModal !== undefined && hargaModal !== null ? (
                            rupiah(hargaModal)
                          ) : (
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                              Belum diisi
                            </span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        <Badge variant={statusStok.variant} className={statusStok.className}>
                          {statusStok.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {bolehUbah && (
                            <DialogStokMasuk
                              itemId={sp.id}
                              namaItem={sp.nama}
                              kodeItem={sp.kode}
                              stokSaatIni={sp.stok}
                            />
                          )}
                          {isOwner && (
                            <DialogSesuaikanStok
                              itemId={sp.id}
                              namaItem={sp.nama}
                              kodeItem={sp.kode}
                              stokSaatIni={sp.stok}
                            />
                          )}
                          {isOwner && (
                            <FormSparePart
                              item={{
                                id: sp.id,
                                kode: sp.kode,
                                nama: sp.nama,
                                harga_jual: sp.harga_jual,
                                stok: sp.stok,
                                stok_minimum: sp.stok_minimum,
                                harga_modal: hargaModal,
                              }}
                              isOwner={isOwner}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          <Paginasi
            halaman={halaman}
            totalBaris={totalSparePart}
            perHalaman={PER_HALAMAN}
            params={{ tab: "part", q: cari, status: status !== "semua" ? status : undefined }}
          />
        </>
      )}

      {/* KONTEN TAB 2: JASA */}
      {tabAktif === "jasa" && (
        <>
          <Card className="py-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 w-32">Kode</TableHead>
                  <TableHead>Nama Jasa Servis</TableHead>
                  <TableHead className="text-right">Tarif</TableHead>
                  <TableHead className="pr-4 text-right w-24">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errorJasa && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-danger">
                      Gagal memuat data jasa servis. Silakan muat ulang halaman.
                    </TableCell>
                  </TableRow>
                )}
                {!errorJasa && jasaList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      {cari ? `Tidak ada jasa servis yang cocok dengan "${cari}".` : "Belum ada jasa servis."}
                    </TableCell>
                  </TableRow>
                )}
                {jasaList.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="pl-4 font-mono text-xs text-text-muted">{j.kode}</TableCell>
                    <TableCell className="font-medium text-text">{j.nama}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-text">
                      {rupiah(j.harga_jual)}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      {bolehUbah && (
                        <FormJasa
                          item={{
                            id: j.id,
                            kode: j.kode,
                            nama: j.nama,
                            harga_jual: j.harga_jual,
                          }}
                          bolehUbah={bolehUbah}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Paginasi
            halaman={halaman}
            totalBaris={totalJasa}
            perHalaman={PER_HALAMAN}
            params={{ tab: "jasa", q: cari }}
          />
        </>
      )}

      {/* KONTEN TAB 3: RIWAYAT STOK */}
      {tabAktif === "riwayat" && (
        <>
          <Card className="py-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 w-32">Waktu</TableHead>
                  <TableHead>Item Spare Part</TableHead>
                  <TableHead className="w-28 text-center">Jenis</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Stok Akhir</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>No WO</TableHead>
                  <TableHead className="pr-4">Pencatat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errorRiwayat && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-danger">
                      Gagal memuat riwayat stok. Silakan muat ulang halaman.
                    </TableCell>
                  </TableRow>
                )}
                {!errorRiwayat && riwayatList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      {cari ? `Tidak ada riwayat stok yang cocok dengan "${cari}".` : "Belum ada riwayat pergerakan stok."}
                    </TableCell>
                  </TableRow>
                )}
                {riwayatList.map((r) => {
                  const jenisBadge =
                    r.jenis === "masuk"
                      ? { label: "Masuk", variant: "outline" as const, className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
                      : r.jenis === "keluar"
                      ? { label: "Keluar", variant: "destructive" as const, className: "" }
                      : r.jenis === "kembali"
                      ? { label: "Kembali", variant: "secondary" as const, className: "" }
                      : { label: "Penyesuaian", variant: "outline" as const, className: "bg-amber-50 text-amber-700 border-amber-200" };

                  return (
                    <TableRow key={r.id}>
                      <TableCell className="pl-4 text-xs text-text-muted whitespace-nowrap">
                        {tanggal(r.created_at)}
                      </TableCell>
                      <TableCell className="font-medium text-text">
                        {r.inventory_items ? `${r.inventory_items.nama} (${r.inventory_items.kode})` : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={jenisBadge.variant} className={jenisBadge.className}>
                          {jenisBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold tabular-nums ${
                          r.jumlah > 0 ? "text-success" : r.jumlah < 0 ? "text-danger" : "text-text"
                        }`}
                      >
                        {r.jumlah > 0 ? `+${r.jumlah}` : r.jumlah}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-text">{r.stok_sesudah}</TableCell>
                      <TableCell className="text-xs text-text-body max-w-xs truncate">
                        {r.keterangan || "-"}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-primary">
                        {r.work_orders?.nomor || "-"}
                      </TableCell>
                      <TableCell className="pr-4 text-xs text-text-muted">
                        {r.profiles?.nama || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          <Paginasi
            halaman={halaman}
            totalBaris={totalRiwayat}
            perHalaman={PER_HALAMAN}
            params={{ tab: "riwayat", q: cari }}
          />
        </>
      )}
    </div>
  );
}
