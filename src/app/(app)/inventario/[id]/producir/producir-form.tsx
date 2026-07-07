"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { etiquetaUnidad } from "@/lib/unidades";
import { registrarProduccion } from "../actions";

type RecetaFila = {
  cantidad_insumo: number;
  inventario_items: { nombre: string; unidad: string } | null;
};

export function ProducirForm({
  item,
  receta,
  maxProducible,
}: {
  item: { id: string; nombre: string; unidad: string };
  receta: RecetaFila[];
  maxProducible: number | null;
}) {
  const router = useRouter();
  const [cantidad, setCantidad] = useState(
    maxProducible !== null && maxProducible > 0 ? String(maxProducible) : "",
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cantidadNum = Number(cantidad) || 0;
  const sinInsumosSuficientes = maxProducible !== null && maxProducible <= 0;

  async function guardar() {
    setError(null);

    if (cantidad.trim() === "" || Number.isNaN(cantidadNum) || cantidadNum <= 0) {
      setError("Escribe cuántas unidades vas a producir (mayor a cero).");
      return;
    }
    if (maxProducible !== null && cantidadNum > maxProducible) {
      setError(
        `No hay insumos suficientes. Con tu inventario actual solo puedes producir hasta ${maxProducible}.`,
      );
      return;
    }

    setGuardando(true);
    try {
      await registrarProduccion({ itemResultanteId: item.id, cantidad: cantidadNum });
      router.push(`/inventario/${item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la producción.");
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-1 text-lg font-semibold text-gray-900">Producir</h1>
      <p className="mb-6 text-sm text-gray-500">
        <span className="font-medium text-gray-700">{item.nombre}</span>
      </p>

      {maxProducible !== null && (
        <p
          className={`mb-4 rounded px-3 py-2 text-sm ${
            sinInsumosSuficientes ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-600"
          }`}
        >
          {sinInsumosSuficientes
            ? "No tienes insumos suficientes para producir ni una unidad."
            : `Con tu inventario actual de insumos puedes producir hasta ${maxProducible} unidades.`}
        </p>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Cantidad producida ({etiquetaUnidad(item.unidad)}) *
        </label>
        <input
          type="number"
          min={0}
          max={maxProducible ?? undefined}
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          disabled={sinInsumosSuficientes}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none disabled:bg-gray-50"
        />
      </div>

      <div className="mt-4 rounded-lg border border-gray-200 p-4">
        <p className="mb-2 text-xs font-medium text-gray-700">Esto va a descontar:</p>
        {receta.length === 0 ? (
          <p className="text-sm text-gray-400">
            Este producto no tiene receta configurada — no se descontará ningún insumo, solo se
            sumará al stock.
          </p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-900">
            {receta.map((fila, i) => (
              <li key={i}>
                {(fila.cantidad_insumo * cantidadNum).toLocaleString("es-CO")}{" "}
                {fila.inventario_items ? etiquetaUnidad(fila.inventario_items.unidad) : ""} de{" "}
                {fila.inventario_items?.nombre}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando || sinInsumosSuficientes}
        className="mt-6 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}
