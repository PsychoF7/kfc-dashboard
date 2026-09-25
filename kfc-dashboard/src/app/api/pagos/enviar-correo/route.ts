import { NextResponse } from "next/server";
import { getMailer } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { to, cc, subject, body } = (await req.json()) as {
      to: string;
      cc: string[];
      subject: string;
      body: string;
    };

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: "Faltan destinatario, asunto o cuerpo del correo." },
        { status: 400 }
      );
    }

    const transporter = getMailer();

    await transporter.sendMail({
      from: `"Control de Pagos KFC" <${process.env.GMAIL_USER}>`,
      to,
      cc: cc?.length ? cc.join(",") : undefined,
      subject,
      text: body,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("Error en /api/pagos/enviar-correo:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
