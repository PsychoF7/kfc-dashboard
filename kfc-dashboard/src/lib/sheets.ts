import { google } from "googleapis";

// El ID se ve en la URL de la hoja:
// https://docs.google.com/spreadsheets/d/ESTE_ID/edit
export const SPREADSHEET_ID = "12wEfLCK23RdJzawxaXt20ISLr8KP07u5moSlzz9v7Vo";
export const SHEET_NAME = "Relacion Semanal 2026";

/** Cliente de Google Sheets autenticado con una cuenta de servicio.
 * Esa cuenta solo puede tocar las hojas que se le compartan explícitamente
 * (como compartir un documento con una persona) — no toca tu dominio ni
 * tu cuenta de Gmail para nada. */
export function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error(
      "Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY."
    );
  }

  const auth = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}
