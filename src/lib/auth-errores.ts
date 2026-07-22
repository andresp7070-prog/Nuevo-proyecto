import type { AuthError } from "@supabase/supabase-js";

// Supabase Auth siempre responde en inglés — esto traduce los códigos que
// de verdad podemos encontrar en los flujos de esta app (login, cambio y
// recuperación de contraseña). Cualquier código no mapeado cae en un
// mensaje genérico en español, nunca se muestra el texto en inglés tal cual.
const MENSAJES: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed: "Debes confirmar tu correo antes de iniciar sesión.",
  user_not_found: "No encontramos una cuenta con ese correo.",
  user_banned: "Esta cuenta está bloqueada. Contacta al administrador.",
  same_password: "La nueva contraseña debe ser distinta a la actual.",
  weak_password: "La contraseña es muy débil — usa al menos 6 caracteres.",
  otp_expired: "El enlace venció. Solicita uno nuevo.",
  session_expired: "Tu sesión venció. Inicia sesión de nuevo.",
  over_request_rate_limit: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  over_email_send_rate_limit: "Ya se envió un correo hace poco. Espera unos minutos e inténtalo de nuevo.",
};

export function mensajeErrorAuth(error: AuthError): string {
  return MENSAJES[error.code ?? ""] ?? "Ocurrió un error al procesar la solicitud. Intenta de nuevo.";
}
