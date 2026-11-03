import { NextResponse } from "next/server";
import { getMailer } from "@/lib/mail";
import { leerMes } from "@/lib/facturacion-server";
import { facturaFranquicia } from "@/lib/facturas-franquicias";
import { sesionActual } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const esCorreo = (s: string) => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(s);
const lista = (v: unknown) =>
  (Array.isArray(v) ? v : String(v ?? "").split(/[,;\s]+/)).map((x) => String(x).trim()).filter(Boolean);

/** Envía por correo la factura de una tienda o razón social, con la factura en Excel adjunta. */
export async function POST(req: Request) {
  try {
    const sesion = await sesionActual();
    if (sesion?.rol === "consulta") return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const b = (await req.json()) as {
      mes?: string;
      codigo?: string;
      razon?: string;
      to?: unknown;
      cc?: unknown;
      subject?: string;
      body?: string;
    };
    const mes = leerMes(b.mes ?? null);
    if (!mes) return NextResponse.json({ error: "Falta el mes." }, { status: 400 });
    if (!b.codigo && !b.razon) return NextResponse.json({ error: "Falta la tienda o la razón social." }, { status: 400 });
    const to = lista(b.to);
    const cc = lista(b.cc);
    if (!to.length) return NextResponse.json({ error: "Falta el destinatario." }, { status: 400 });
    const malos = [...to, ...cc].filter((c) => !esCorreo(c));
    if (malos.length) return NextResponse.json({ error: `Correo no válido: ${malos.join(", ")}` }, { status: 400 });
    if (!b.subject?.trim() || !b.body?.trim()) return NextResponse.json({ error: "Faltan asunto o mensaje." }, { status: 400 });

    const factura = await facturaFranquicia(mes, { codigo: b.codigo, razon: b.razon });
    if (!factura) return NextResponse.json({ error: "No hay órdenes de esa franquicia en el mes." }, { status: 404 });

    await getMailer().sendMail({
      from: `"Facturación KFC" <${process.env.GMAIL_USER}>`,
      to: to.join(","),
      cc: cc.length ? cc.join(",") : undefined,
      subject: b.subject.trim(),
      text: b.body,
      attachments: [
        {
          filename: factura.nombre,
          content: factura.buffer,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    });
    return NextResponse.json({ ok: true, adjunto: factura.nombre });
  } catch (err) {
    console.error("Error en /api/facturacion/franquicias/enviar:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
