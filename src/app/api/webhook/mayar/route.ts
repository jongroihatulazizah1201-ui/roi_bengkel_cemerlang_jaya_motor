import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// 4. Klien Supabase dengan SUPABASE_SECRET_KEY hanya dibuat di file ini, tanpa NEXT_PUBLIC_ untuk secret key
function buatAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Konfigurasi SUPABASE_URL atau SUPABASE_SECRET_KEY belum diatur");
  }

  return createClient<Database>(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(req: NextRequest) {
  let supabaseAdmin;
  try {
    supabaseAdmin = buatAdminClient();
  } catch {
    // 5. Selalu balas 200 dengan cepat
    return NextResponse.json(
      { received: true, error: "Konfigurasi server internal belum lengkap" },
      { status: 200 }
    );
  }

  // Baca payload webhook
  const body = await req.json().catch(() => null);

  if (!body) {
    // 1. Catat ke mayar_webhook_log
    await supabaseAdmin.from("mayar_webhook_log").insert({
      event: "unknown",
      status: "ditolak: payload_kosong",
      payload: { pesan: "Request body tidak berformat JSON atau kosong" },
    });

    return NextResponse.json({ received: true, status: "ditolak" }, { status: 200 });
  }

  const namaEvent = typeof body.event === "string" ? body.event : "webhook.received";

  try {
    // 2. Jangan percaya isi pesan. Ambil id tagihan, lalu tanya ulang detailnya ke Mayar dengan MAYAR_API_KEY.
    const rawData = body.data || {};
    const potentialMayarId =
      rawData.invoiceId ||
      rawData.paymentLinkId ||
      rawData.id ||
      rawData.productId;

    // Cari invoice di database kita berdasarkan mayar_invoice_id atau extraData.invoice_id
    let invoice = null;

    if (potentialMayarId) {
      const { data } = await supabaseAdmin
        .from("invoices")
        .select("id, nomor, total, terbayar, status_bayar, mayar_invoice_id, mayar_jumlah")
        .eq("mayar_invoice_id", potentialMayarId)
        .maybeSingle();

      if (data) invoice = data;
    }

    if (!invoice && rawData.extraData?.invoice_id) {
      const { data } = await supabaseAdmin
        .from("invoices")
        .select("id, nomor, total, terbayar, status_bayar, mayar_invoice_id, mayar_jumlah")
        .eq("id", rawData.extraData.invoice_id)
        .maybeSingle();

      if (data) invoice = data;
    }

    const mayarIdToQuery = invoice?.mayar_invoice_id || potentialMayarId;

    if (!mayarIdToQuery) {
      // Catat penolakan ke log
      await supabaseAdmin.from("mayar_webhook_log").insert({
        event: namaEvent,
        status: "ditolak: id_tagihan_tidak_ditemukan",
        payload: {
          pesan_webhook: body,
          keterangan: "ID invoice Mayar tidak ditemukan dalam payload maupun database",
        },
      });

      return NextResponse.json({ received: true, status: "ditolak" }, { status: 200 });
    }

    // Tanya ulang detail invoice ke Mayar API V2
    const apiKey = process.env.MAYAR_API_KEY;
    const rawBaseUrl = process.env.MAYAR_BASE_URL || "https://api.mayar.io/hl/v2";
    const baseUrl = rawBaseUrl.replace(/\/+$/, "");

    if (!apiKey) {
      await supabaseAdmin.from("mayar_webhook_log").insert({
        event: namaEvent,
        status: "ditolak: api_key_mayar_tidak_ada",
        payload: {
          pesan_webhook: body,
          keterangan: "MAYAR_API_KEY belum dikonfigurasi di server",
        },
      });

      return NextResponse.json({ received: true, status: "ditolak" }, { status: 200 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let verifyRes: Response;
    try {
      verifyRes = await fetch(`${baseUrl}/invoices/${mayarIdToQuery}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId);
      await supabaseAdmin.from("mayar_webhook_log").insert({
        event: namaEvent,
        status: "ditolak: gagal_verifikasi_ke_mayar",
        payload: {
          pesan_webhook: body,
          keterangan:
            fetchErr instanceof Error ? fetchErr.message : "Gagal menghubungi API Mayar",
        },
      });

      return NextResponse.json({ received: true, status: "ditolak" }, { status: 200 });
    } finally {
      clearTimeout(timeoutId);
    }

    const verifyData = await verifyRes.json().catch(() => null);

    if (!verifyRes.ok || !verifyData?.data) {
      await supabaseAdmin.from("mayar_webhook_log").insert({
        event: namaEvent,
        status: "ditolak: invoice_tidak_valid_di_mayar",
        payload: {
          pesan_webhook: body,
          respon_mayar: verifyData,
        },
      });

      return NextResponse.json({ received: true, status: "ditolak" }, { status: 200 });
    }

    const dataMayarResmi = verifyData.data;
    const statusMayarResmi = String(dataMayarResmi.status || "").toLowerCase();
    const nominalMayarResmi = Number(dataMayarResmi.amount || 0);

    // 3. Hanya bila statusnya sudah dibayar dan tagihan itu ada di invoices kita dengan jumlah sama dengan mayar_jumlah, panggil tandai_lunas_mayar
    if (!invoice) {
      await supabaseAdmin.from("mayar_webhook_log").insert({
        event: namaEvent,
        status: "ditolak: invoice_tidak_terdaftar_di_database",
        payload: {
          pesan_webhook: body,
          verifikasi_mayar: dataMayarResmi,
          alasan: "Invoice tidak terdaftar di database bengkel",
        },
      });

      return NextResponse.json({ received: true, status: "ditolak" }, { status: 200 });
    }

    const apakahLunasDiMayar = statusMayarResmi === "paid";
    const apakahJumlahSama =
      invoice.mayar_jumlah !== null &&
      Number(invoice.mayar_jumlah) === nominalMayarResmi;

    if (apakahLunasDiMayar && apakahJumlahSama) {
      // Panggil fungsi tandai_lunas_mayar via admin client (service_role)
      const { error: errRpc } = await supabaseAdmin.rpc("tandai_lunas_mayar", {
        p_invoice_id: invoice.id,
        p_event: namaEvent,
        p_status: "diterima",
        p_payload: {
          webhook: body,
          verifikasi_mayar: dataMayarResmi,
          keterangan: "Pembayaran terverifikasi resmi oleh Mayar dan dicatat lunas",
        },
      });

      if (errRpc) {
        // Catat error eksekusi ke log
        await supabaseAdmin.from("mayar_webhook_log").insert({
          event: namaEvent,
          status: "ditolak: rpc_error",
          payload: {
            webhook: body,
            verifikasi_mayar: dataMayarResmi,
            error: errRpc.message,
          },
        });
      }

      // 5. Selalu balas 200 dengan cepat
      return NextResponse.json({ received: true, status: "diterima" }, { status: 200 });
    }

    // Bila kondisi tidak terpenuhi, tentukan alasan penolakan dan simpan ke log
    let alasanDitolak = "kondisi_tidak_terpenuhi";
    if (!apakahLunasDiMayar) {
      alasanDitolak = `status_mayar_belum_paid (${statusMayarResmi})`;
    } else if (!apakahJumlahSama) {
      alasanDitolak = `nominal_tidak_sesuai (mayar: ${nominalMayarResmi}, db: ${invoice.mayar_jumlah})`;
    }

    // Simpan hasil pemeriksaan ditolak ke log
    await supabaseAdmin.from("mayar_webhook_log").insert({
      event: namaEvent,
      status: `ditolak: ${alasanDitolak}`,
      payload: {
        pesan_webhook: body,
        verifikasi_mayar: dataMayarResmi,
        alasan: alasanDitolak,
      },
    });

    // 5. Selalu balas 200 dengan cepat
    return NextResponse.json({ received: true, status: "ditolak" }, { status: 200 });
  } catch (err: unknown) {
    const pesan = err instanceof Error ? err.message : "Kesalahan server tak terduga";

    await supabaseAdmin.from("mayar_webhook_log").insert({
      event: namaEvent,
      status: "ditolak: internal_error",
      payload: {
        pesan_webhook: body,
        error: pesan,
      },
    });

    return NextResponse.json({ received: true, status: "ditolak" }, { status: 200 });
  }
}
