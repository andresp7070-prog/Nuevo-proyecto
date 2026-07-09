"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ahoraFecha } from "@/lib/fecha";
import { CampoMoneda } from "@/components/campo-moneda";
import { crearMovimiento } from "../actions";

export function NuevoMovimientoForm() {
  const router = useRouter();

  const [tipo, setTipo] = useState<"gasto" | "ingreso">("gasto");
  const [categoria, setCategoria] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(ahoraFecha());
  const [nota, setNota] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);

    const montoNum = Number(monto);
    if (monto.trim() === "" || Number.isNaN(montoNum) || montoNum <= 0) {
      setError("El monto es obligatorio y debe ser mayor a cero.");
      return;
    }

    setGuardando(true);
    try {
      const resultado = await crearMovimiento({ tipo, categoria: categoria.trim(), monto: montoNum, fecha, nota: nota.trim() });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      router.push("/pyg");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-md">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Agregar gasto o ingreso</h1>
        <Link href="/pyg" className="text-sm text-gray-500 hover:text-gray-700">
          Volver
        </Link>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tipo *</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTipo("gasto")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                tipo === "gasto"
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              Gasto
            </button>
            <button
              type="button"
              onClick={() => setTipo("ingreso")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                tipo === "ingreso"
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              Ingreso
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Categoría (opcional)
          </label>
          <input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Ej. Arriendo, Servicios, Salarios"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <CampoMoneda id="monto" label="Monto" required value={monto} onChange={setMonto} />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Fecha *</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nota (opcional)</label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <p className="text-xs text-gray-400">* Campos obligatorios</p>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-6 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}
