import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { calcularDiasRestantes } from "@/lib/inventario";
import { firmarFotoUrls } from "@/lib/fotos";
import { DirectorioInventario } from "./directorio-inventario";

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ creado?: string }>;
}) {
  const { creado } = await searchParams;

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

  if (!perfil?.empresa_id) {
    return (
      <p className="text-red-600">
        Tu usuario no tiene una empresa asignada. Pídele a un administrador que la configure.
      </p>
    );
  }

  const { data: items } = await supabase
    .from("inventario_items")
    .select(
      "id, nombre, categoria, unidad, cantidad, costo, precio_venta, foto_path, marca:atributos->>marca",
    )
    .eq("empresa_id", perfil.empresa_id)
    .order("nombre");

  const fotoUrlsPorPath = await firmarFotoUrls(
    supabase,
    (items ?? []).map((item) => item.foto_path),
  );

  const itemIds = (items ?? []).map((item) => item.id);

  const { data: recetaRows } =
    itemIds.length > 0
      ? await supabase
          .from("inventario_receta")
          .select("item_resultante_id")
          .in("item_resultante_id", itemIds)
      : { data: [] };

  const idsConReceta = new Set((recetaRows ?? []).map((r) => r.item_resultante_id));

  const { data: velocidadData } = await supabase
    .from("vista_velocidad_ventas")
    .select("item_id, unidades_por_dia")
    .eq("empresa_id", perfil.empresa_id);

  const velocidadPorItem = new Map(
    (velocidadData ?? []).map((v) => [v.item_id, Number(v.unidades_por_dia)]),
  );

  const itemsConDisponible = (items ?? []).map((item) => ({
    ...item,
    tieneReceta: idsConReceta.has(item.id),
    diasRestantes: calcularDiasRestantes(item.cantidad, velocidadPorItem.get(item.id)),
    fotoUrl: item.foto_path ? (fotoUrlsPorPath[item.foto_path] ?? null) : null,
  }));

  return <DirectorioInventario items={itemsConDisponible} creado={creado === "1"} />;
}
