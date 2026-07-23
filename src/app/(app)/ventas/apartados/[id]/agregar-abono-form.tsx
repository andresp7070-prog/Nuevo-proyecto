"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EntradaMoneda } from "@/components/campo-moneda";
import { ahoraFecha } from "@/lib/fecha";
import { agregarAbono } from "./actions";

export function AgregarAbonoForm({ apartadoId, maximo }: { apartadoId: string; maximo: number }) {
  const router = useRouter();
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(ahoraFecha());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    const montoNum = Number(monto) || 0;
    if (!monto.trim() || montoNum <= 0) {
      setError("El abono debe ser mayor a cero.");
      return;
    }
    if (montoNum > maximo) {
      setError(`El abono no puede ser mayor a lo que falta (${maximo.toLocaleString("es-CO", { style: "currency", currency: "COP" })}).`);
      return;
    }

    setGuardando(true);
    try {
      const resultado = await agregarAbono({ apartadoId, monto: montoNum, fecha });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setMonto("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el abono.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-gray-200 pt-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">Monto del abono</label>
        <EntradaMoneda
          value={monto}
          onChange={setMonto}
          className="w-36 rounded-lg border border-gray-300 py-2 pl-6 pr-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Agregar abono"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
