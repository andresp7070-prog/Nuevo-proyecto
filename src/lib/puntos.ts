import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export const COOKIE_PUNTO = "datum_punto_venta";

export type PuntoVenta = { id: string; nombre: string };

export type ContextoPunto = {
  puntosVenta: PuntoVenta[];
  // A qué punto filtrar las consultas. null = ver todos los puntos combinados
  // (o la empresa no usa puntos de venta, que es el caso normal).
  puntoSeleccionado: string | null;
  // true solo cuando la cuenta puede elegir (cuenta general con más de un
  // punto activo). Una cuenta ya limitada a un punto, o una empresa sin
  // puntos de venta, no necesita selector.
  mostrarSelector: boolean;
};

// Decide a qué punto de venta debe quedar filtrada la vista actual:
// - Cuenta limitada a un punto (perfilPuntoVentaId set): siempre ese punto, sin selector.
// - Empresa sin puntos de venta: sin filtro, sin selector (comportamiento normal de siempre).
// - Cuenta general con puntos activos: respeta lo que la persona eligió (guardado en cookie),
//   o "todos" si no ha elegido nada o el valor guardado ya no es válido.
export async function obtenerContextoPunto(
  supabase: SupabaseClient,
  empresaId: string,
  perfilPuntoVentaId: string | null,
): Promise<ContextoPunto> {
  const { data } = await supabase
    .from("puntos_venta")
    .select("id, nombre")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("nombre");

  const puntosVenta = (data ?? []) as PuntoVenta[];

  if (perfilPuntoVentaId) {
    return { puntosVenta, puntoSeleccionado: perfilPuntoVentaId, mostrarSelector: false };
  }

  if (puntosVenta.length === 0) {
    return { puntosVenta: [], puntoSeleccionado: null, mostrarSelector: false };
  }

  const cookieStore = await cookies();
  const valor = cookieStore.get(COOKIE_PUNTO)?.value || null;
  const valido = valor !== null && puntosVenta.some((p) => p.id === valor);

  return { puntosVenta, puntoSeleccionado: valido ? valor : null, mostrarSelector: true };
}
