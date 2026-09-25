import nodemailer from "nodemailer";

/** Envía correos usando la cuenta de Gmail/Google Workspace de la persona
 * (vía una "contraseña de aplicación"), sin necesitar verificar un
 * dominio con un proveedor externo. El correo sale como si lo hubiera
 * mandado esa persona directamente desde su Gmail. */
export function getMailer() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error("Faltan GMAIL_USER o GMAIL_APP_PASSWORD en las variables de entorno.");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}
