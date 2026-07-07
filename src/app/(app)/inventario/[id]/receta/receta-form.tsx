"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RecetaLineas, type Insumo, type LineaRecetaValor } from "../../receta-lineas";
import { guardarReceta } from "../actions";

export function RecetaForm({
  itemResultante,
  insumosDisponibles,
  recetaInicial,
}: {
  itemResultante: { id: string; nombre: string };
  insumosDisponibles: Insumo[];
  recetaInicial: { item_insumo_id: string; cantidad_insumo: number }[];
}) {
  const router = useRouter();

  const [lineas, setLineas] = useState<LineaRecetaValor[]>(
    recetaInicial.map((fila) => ({ insumoId: fila.item_insumo_id, cantidad: fila.cantidad_insumo })),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      await guardarReceta({ itemResultanteId: itemResultante.id, lineas });
      router.push(`/inventario/${itemResultante.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la receta.");
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-lg font-semibold text-gray-900">Receta</h1>
      <p className="mb-6 text-sm text-gray-500">
        Insumos que se descuentan automáticamente al producir una unidad de{" "}
        <span className="font-medium text-gray-700">{itemResultante.nombre}</span>.
      </p>

      <RecetaLineas
        insumosDisponibles={insumosDisponibles}
        valorInicial={recetaInicial.map((fila) => ({
          insumoId: fila.item_insumo_id,
          cantidad: fila.cantidad_insumo,
        }))}
        onChange={setLineas}
      />

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-6 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Guardar receta"}
      </button>
    </div>
  );
}
