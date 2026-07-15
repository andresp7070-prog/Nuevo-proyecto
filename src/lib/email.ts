import { Resend } from "resend";

const URL_APP = process.env.NEXT_PUBLIC_APP_URL ?? "https://datum.vercel.app";
const REMITENTE = process.env.RESEND_FROM_EMAIL ?? "Datum <onboarding@resend.dev>";

export async function enviarCorreoBienvenida({
  correo,
  nombreEmpresa,
  contrasena,
}: {
  correo: string;
  nombreEmpresa: string;
  contrasena: string;
}): Promise<{ error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { error: "Falta configurar RESEND_API_KEY en las variables de entorno." };
  }

  const resend = new Resend(apiKey);
  const linkIngreso = `${URL_APP}/login`;

  const { error } = await resend.emails.send({
    from: REMITENTE,
    to: correo,
    subject: `Bienvenido a Datum, ${nombreEmpresa}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
        <h1 style="font-size: 18px;">¡Bienvenido a Datum!</h1>
        <p>Ya creamos el acceso de <strong>${nombreEmpresa}</strong> a la plataforma. Estos son tus datos para ingresar:</p>
        <table style="margin: 16px 0; font-size: 14px;">
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Correo</td><td><strong>${correo}</strong></td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Contraseña temporal</td><td><strong>${contrasena}</strong></td></tr>
        </table>
        <p>
          <a href="${linkIngreso}" style="display: inline-block; background: #111827; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none;">
            Ingresar a Datum
          </a>
        </p>
        <p style="font-size: 13px; color: #6b7280;">
          En tu primer ingreso te vamos a pedir que cambies esta contraseña por una tuya.
        </p>
      </div>
    `,
  });

  if (error) return { error: error.message };
  return { error: null };
}
