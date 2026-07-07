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
}: {
  item: { id: string; nombre: string; unidad: string };
  receta: RecetaFila[];
}) {
  const router = useRouter();
  const [cantidad, setCantidad] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cantidadNum = Number(cantidad) || 0;

  async function guardar() {
    setError(null);

    if (cantidad.trim() === "" || Number.isNaN(cantidadNum) || cantidadNum <= 0) {
      setError("Escribe cuántas unidades vas a producir (mayor a cero).");
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

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Cantidad producida ({etiquetaUnidad(item.unidad)}) *
        </label>
        <input
          type="number"
          min={0}
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
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
        disabled={guardando}
        className="mt-6 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Registrar producción"}
      </button>
    </div>
  );
}
