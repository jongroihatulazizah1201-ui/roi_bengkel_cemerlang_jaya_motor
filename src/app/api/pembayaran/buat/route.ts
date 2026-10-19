import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Hanya Admin atau Owner yang login. Peran dibaca dari tabel profiles.
    const {
      data: { user },
      error: errUser,
    } = await supabase.auth.getUser();

    if (errUser || !user) {
      return NextResponse.json(
        { error: "Sesi login tidak valid. Silakan masuk terlebih dahulu." },
        { status: 401 }
      );
    }

    const { data: profile, error: errProfile } = await supabase
      .from("profiles")
      .select("id, role, aktif")
      .eq("id", user.id)
      .single();

    if (
      errProfile ||
      !profile ||
      !profile.aktif ||
      !["admin", "owner"].includes(profile.role)
    ) {
      return NextResponse.json(
        { error: "Akses ditolak: Hanya Admin atau Owner yang dapat membuat link pembayaran." },
        { status: 403 }
      );
    }

    // 2. Terima id invoice.
    const body = await req.json().catch(() => ({}));
    const invoiceId = body.id || body.invoice_id;

    if (!invoiceId || typeof invoiceId !== "string") {
      return NextResponse.json(
        { error: "ID invoice tidak valid atau belum disertakan." },
        { status: 400 }
      );
    }

    // Ambil data invoice, sisa tagihan, data pelanggan dari database (bukan dari browser)
    const { data: invoice, error: errInvoice } = await supabase
      .from("invoices")
      .select(`
        id,
        nomor,
        total,
        terbayar,
        status_bayar,
        mayar_link,
        mayar_jumlah,
        mayar_invoice_id,
        work_order_id,
        work_orders (
          id,
          nomor,
          customers (
            id,
            nama,
            email,
            telepon
          )
        )
      `)
      .eq("id", invoiceId)
      .single();

    if (errInvoice || !invoice) {
      return NextResponse.json(
        { error: "Invoice tidak ditemukan di database." },
        { status: 404 }
      );
    }

    // Sisa tagihan (total dikurangi terbayar)
    const sisa = Number(invoice.total) - Number(invoice.terbayar);

    // Tolak bila invoice sudah lunas
    if (invoice.status_bayar === "lunas" || sisa <= 0) {
      return NextResponse.json(
        { error: "Invoice ini sudah lunas, tidak dapat membuat pembayaran baru." },
        { status: 400 }
      );
    }

    // Ambil data pelanggan dari relasi work order
    const wo = Array.isArray(invoice.work_orders)
      ? invoice.work_orders[0]
      : invoice.work_orders;
    const pelanggan = wo
      ? Array.isArray(wo.customers)
        ? wo.customers[0]
        : wo.customers
      : null;

    // Tolak bila email pelanggan kosong
    if (!pelanggan?.email || !pelanggan.email.trim()) {
      return NextResponse.json(
        {
          error:
            "Email pelanggan belum diisi. Lengkapi email pelanggan terlebih dahulu pada menu Pelanggan.",
        },
        { status: 400 }
      );
    }

    // 3. Bila invoice sudah punya mayar_link dan mayar_jumlah sama dengan sisa tagihan, kembalikan tautan itu
    if (
      invoice.mayar_link &&
      invoice.mayar_jumlah &&
      Number(invoice.mayar_jumlah) === sisa
    ) {
      return NextResponse.json({
        link: invoice.mayar_link,
        mayar_invoice_id: invoice.mayar_invoice_id,
        jumlah: sisa,
      });
    }

    // 4. Bila belum ada atau jumlahnya berbeda, buat invoice di Mayar memakai MAYAR_API_KEY dan MAYAR_BASE_URL
    const apiKey = process.env.MAYAR_API_KEY;
    const rawBaseUrl = process.env.MAYAR_BASE_URL || "https://api.mayar.io/hl/v2";
    const baseUrl = rawBaseUrl.replace(/\/+$/, "");

    if (!apiKey) {
      return NextResponse.json(
        { error: "Konfigurasi gateway pembayaran belum aktif di server." },
        { status: 500 }
      );
    }

    // Ambil item dari billing_items
    const { data: billingItems, error: errItems } = await supabase
      .from("billing_items")
      .select("nama_item, jumlah, harga_dipakai")
      .eq("work_order_id", invoice.work_order_id);

    let mayarItems: Array<{
      description: string;
      quantity: number;
      rate: number;
    }> = [];

    if (!errItems && billingItems && billingItems.length > 0) {
      const sumItems = billingItems.reduce(
        (acc, it) => acc + Number(it.jumlah) * Number(it.harga_dipakai),
        0
      );

      mayarItems = billingItems.map((it) => ({
        description: it.nama_item || "Layanan / Part",
        quantity: Number(it.jumlah),
        rate: Number(it.harga_dipakai),
      }));

      // Sesuaikan selisih diskon atau pembayaran sebagian sebelumnya
      const selisih = sisa - sumItems;
      if (selisih < 0) {
        mayarItems.push({
          description: "Diskon / Pembayaran Sebelumnya",
          quantity: 1,
          rate: selisih,
        });
      } else if (selisih > 0) {
        mayarItems.push({
          description: "Biaya Tambahan",
          quantity: 1,
          rate: selisih,
        });
      }
    } else {
      mayarItems = [
        {
          description: `Tagihan Invoice ${invoice.nomor}`,
          quantity: 1,
          rate: sisa,
        },
      ];
    }

    const mobileClean = (pelanggan.telepon || "").replace(/[^0-9]/g, "");
    const mobileFormatted = mobileClean.startsWith("0")
      ? mobileClean
      : mobileClean.startsWith("62")
        ? `0${mobileClean.slice(2)}`
        : `0${mobileClean}`;

    const payloadMayar = {
      name: pelanggan.nama || "Pelanggan",
      email: pelanggan.email.trim(),
      mobile: mobileFormatted || "081234567890",
      description: `Pembayaran Invoice ${invoice.nomor}`,
      items: mayarItems,
      extraData: {
        invoice_id: invoice.id,
        invoice_nomor: invoice.nomor,
      },
    };

    // 5. Batas tunggu 10 detik (AbortController)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let resMayar: Response;
    try {
      resMayar = await fetch(`${baseUrl}/invoices/create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payloadMayar),
        signal: controller.signal,
      });
    } catch (fetchErr: unknown) {
      if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
        return NextResponse.json(
          { error: "Batas waktu tunggu 10 detik terlampaui saat menghubungi Mayar." },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { error: "Gagal terhubung ke server Mayar. Periksa koneksi internet." },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const dataMayar = await resMayar.json().catch(() => null);

    if (!resMayar.ok || !dataMayar?.data?.link) {
      const pesanMayar =
        typeof dataMayar?.messages === "string"
          ? dataMayar.messages
          : Array.isArray(dataMayar?.messages)
            ? dataMayar.messages.join(", ")
            : "Terjadi kesalahan saat memproses permintaan di Mayar.";

      return NextResponse.json(
        { error: `Gagal membuat invoice Mayar: ${pesanMayar}` },
        { status: resMayar.status || 400 }
      );
    }

    const linkBaru = dataMayar.data.link;
    const idMayarBaru = dataMayar.data.id;

    // Simpan id, tautan, dan jumlahnya lewat fungsi simpan_link_mayar
    const { error: errSimpan } = await supabase.rpc("simpan_link_mayar", {
      p_invoice_id: invoice.id,
      p_mayar_invoice_id: idMayarBaru,
      p_mayar_link: linkBaru,
      p_mayar_jumlah: sisa,
    });

    if (errSimpan) {
      return NextResponse.json(
        { error: `Gagal menyimpan tautan Mayar ke database: ${errSimpan.message}` },
        { status: 500 }
      );
    }

    // Kembalikan tautan
    return NextResponse.json({
      link: linkBaru,
      mayar_invoice_id: idMayarBaru,
      jumlah: sisa,
    });
  } catch (err: unknown) {
    const pesan =
      err instanceof Error ? err.message : "Terjadi kesalahan yang tidak terduga pada server.";
    return NextResponse.json({ error: pesan }, { status: 500 });
  }
}
