"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CampoMoneda } from "@/components/campo-moneda";
import { crearPasivo } from "../actions";

const tipos = [
  { value: "prestamo", label: "Préstamo" },
  { value: "proveedor", label: "Proveedor" },
  { value: "tarjeta_credito", label: "Tarjeta de crédito" },
  { value: "otro", label: "Otro" },
];

const frecuencias = [
  { value: "", label: "Sin definir" },
  { value: "diario", label: "Diario" },
  { value: "mensual", label: "Mensual" },
  { value: "anual", label: "Anual" },
  { value: "unico", label: "Pago único" },
];

export function NuevoPasivoForm() {
  const router = useRouter();

  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState("prestamo");
  const [montoTotal, setMontoTotal] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [frecuenciaPago, setFrecuenciaPago] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);

    if (!descripcion.trim()) {
      setError("La descripción es obligatoria.");
      return;
    }
    const montoNum = Number(montoTotal);
    if (montoTotal.trim() === "" || Number.isNaN(montoNum) || montoNum <= 0) {
      setError("El monto total es obligatorio y debe ser mayor a cero.");
      return;
    }

    setGuardando(true);
    try {
      const resultado = await crearPasivo({
        descripcion: descripcion.trim(),
        tipo,
        montoTotal: montoNum,
        fechaVencimiento,
        frecuenciaPago,
      });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      router.push("/pyg/pasivos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-md">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Agregar deuda</h1>
        <Link href="/pyg/pasivos" className="text-sm text-gray-500 hover:text-gray-700">
          Volver
        </Link>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Descripción *</label>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej. Préstamo Bancolombia"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tipo *</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            {tipos.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <CampoMoneda
          id="montoTotal"
          label="Monto total"
          required
          value={montoTotal}
          onChange={setMontoTotal}
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Fecha de vencimiento (opcional)
          </label>
          <input
            type="date"
            value={fechaVencimiento}
            onChange={(e) => setFechaVencimiento(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Cada cuánto se paga (opcional)
          </label>
          <select
            value={frecuenciaPago}
            onChange={(e) => setFrecuenciaPago(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            {frecuencias.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Solo como referencia — cada abono lo sigues registrando tú, esto no genera pagos solo.
          </p>
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
