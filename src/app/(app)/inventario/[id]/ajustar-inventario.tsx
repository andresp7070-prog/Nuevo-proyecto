"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ajustarInventario } from "./actions";

export function AjustarInventario({
  itemId,
  cantidadActual,
  unidad,
}: {
  itemId: string;
  cantidadActual: number;
  unidad: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cantidadReal, setCantidadReal] = useState(String(cantidadActual));
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    const valor = Number(cantidadReal);
    if (cantidadReal.trim() === "" || Number.isNaN(valor) || valor < 0) {
      setError("Escribe la cantidad real, un número mayor o igual a cero.");
      return;
    }
    if (valor === cantidadActual) {
      setError("Esa es la misma cantidad que ya está registrada.");
      return;
    }

    setGuardando(true);
    try {
      const resultado = await ajustarInventario({ itemId, cantidadReal: valor, nota: nota.trim() });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setAbierto(false);
      setNota("");
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => {
          setAbierto(true);
          setCantidadReal(String(cantidadActual));
        }}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
      >
        Ajustar cantidad
      </button>
    );
  }

  return (
    <div className="w-64 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <label className="mb-1 block text-xs font-medium text-gray-700">
        Cantidad real ({unidad}) *
      </label>
      <input
        type="number"
        min={0}
        value={cantidadReal}
        onChange={(e) => setCantidadReal(e.target.value)}
        className="mb-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
      />
      <label className="mb-1 block text-xs font-medium text-gray-700">Motivo (opcional)</label>
      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Ej. producto dañado, conteo físico"
        className="mb-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
      />
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setError(null);
          }}
          className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
