import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { firmarFotoUrls } from "@/lib/fotos";
import { Kiosko } from "./kiosko";

// Pantalla de autopedido, a la medida de un cliente puntual (Café del
// Mensajero, punto Florida) — no es un módulo estándar de la plataforma.
// Vive fuera de (app) a propósito: es pantalla completa, sin barra lateral
// ni menú, pensada para quedar fija en una tablet en el punto de venta.
// Requiere sesión iniciada (reutiliza el login normal de la empresa) — en
// un punto real, la tablet queda con la sesión abierta todo el día.
export default async function KioskoPage({
  params,
}: {
  params: Promise<{ puntoId: string }>;
}) {
  const { puntoId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) redirect("/resumen");

  const { data: punto } = await supabase
    .from("puntos_venta")
    .select("id, nombre, empresa_id")
    .eq("id", puntoId)
    .single();

  // El punto tiene que pertenecer a la misma empresa del usuario logueado —
  // si no, cualquiera con sesión en otra empresa podría pedir a nombre de
  // un punto ajeno con solo cambiar el id en la URL.
  if (!punto || punto.empresa_id !== perfil.empresa_id) redirect("/resumen");

  const { data: itemsData } = await supabase
    .from("inventario_items")
    .select("id, nombre, categoria, precio_venta, foto_path")
    .eq("punto_venta_id", puntoId)
    .eq("tipo", "producto")
    .eq("es_insumo", false)
    .gt("cantidad", 0)
    .order("categoria")
    .order("nombre");

  const items = itemsData ?? [];
  const fotoUrlsPorPath = await firmarFotoUrls(
    supabase,
    items.map((i) => i.foto_path),
  );

  const productos = items.map((i) => ({
    id: i.id,
    nombre: i.nombre,
    categoria: i.categoria ?? "Otros",
    precio: Number(i.precio_venta ?? 0),
    fotoUrl: i.foto_path ? (fotoUrlsPorPath[i.foto_path] ?? null) : null,
  }));

  return <Kiosko puntoId={punto.id} nombrePunto={punto.nombre} productos={productos} />;
}
