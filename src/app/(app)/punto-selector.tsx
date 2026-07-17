"use client";

import { useTransition } from "react";
import { seleccionarPunto } from "@/lib/puntos-actions";
import type { PuntoVenta } from "@/lib/puntos";

export function PuntoSelector({
  puntos,
  seleccionado,
}: {
  puntos: PuntoVenta[];
  seleccionado: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="px-3 py-2">
      <label className="mb-1 block text-xs font-medium text-gray-400">Punto de venta</label>
      <select
        value={seleccionado ?? ""}
        disabled={isPending}
        onChange={(e) => {
          const valor = e.target.value || null;
          startTransition(() => {
            seleccionarPunto(valor);
          });
        }}
        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 disabled:opacity-50"
      >
        <option value="">Todos los puntos</option>
        {puntos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
