import { NextResponse } from "next/server";
import { getSheetsClient, SPREADSHEET_ID, SHEET_NAME } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FilaGeneral {
  monto_efectivo: number;
  n_efectivo: number;
  n_tarjeta: number;
  envios_efectivo: number;
  envios_tarjeta: number;
  total_envio: number;
  efectivo_depositar: number;
  deposito_envios_tarjeta: number;
}

export async function POST(req: Request) {
  try {
    const { weekNumber, general } = (await req.json()) as {
      weekNumber: number;
      general: FilaGeneral;
    };

    if (!weekNumber || !general) {
      return NextResponse.json(
        { error: "Falta weekNumber o los datos de la semana." },
        { status: 400 }
      );
    }

    // En tu hoja, "Semana 1" está en la fila 3, "Semana 2" en la fila 4,
    // etc. — así que la fila siempre es weekNumber + 2.
    const row = weekNumber + 2;
    const sheets = getSheetsClient();

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          {
            // C a I: Monto Efectivo, #Efectivo, #Tarjeta, Envíos Efectivo,
            // Envíos Tarjeta, Total Envío, Efectivo Depositar
            range: `'${SHEET_NAME}'!C${row}:I${row}`,
            values: [
              [
                general.monto_efectivo,
                general.n_efectivo,
                general.n_tarjeta,
                general.envios_efectivo,
                general.envios_tarjeta,
                general.total_envio,
                general.efectivo_depositar,
              ],
            ],
          },
          {
            // N: Deposito Envios tarjeta
            range: `'${SHEET_NAME}'!N${row}`,
            values: [[general.deposito_envios_tarjeta]],
          },
        ],
      },
    });

    return NextResponse.json({ ok: true, row });
  } catch (err: unknown) {
    console.error("Error en /api/pagos/actualizar-hoja:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
