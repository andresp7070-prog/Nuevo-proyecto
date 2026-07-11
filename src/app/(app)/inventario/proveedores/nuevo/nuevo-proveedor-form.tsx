"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FRECUENCIAS_PAGO, DIAS_SEMANA } from "@/lib/proveedores";
import { crearProveedor } from "../actions";

export function NuevoProveedorForm() {
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [frecuenciaPago, setFrecuenciaPago] = useState("contado");
  const [diaSemanaPago, setDiaSemanaPago] = useState("lunes");
  const [diasPersonalizado, setDiasPersonalizado] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);

    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    const diasNum = Number(diasPersonalizado);
    if (frecuenciaPago === "personalizado" && (diasPersonalizado.trim() === "" || Number.isNaN(diasNum) || diasNum <= 0)) {
      setError("Escribe cada cuántos días se paga (un número mayor a cero).");
      return;
    }

    setGuardando(true);
    try {
      const resultado = await crearProveedor({
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        frecuenciaPago,
        diaSemanaPago: frecuenciaPago === "semanal" ? diaSemanaPago : null,
        diasPersonalizado: frecuenciaPago === "personalizado" ? diasNum : null,
      });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      router.push("/inventario/proveedores");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-md">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Agregar proveedor</h1>
        <Link href="/inventario/proveedores" className="text-sm text-gray-500 hover:text-gray-700">
          Volver
        </Link>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Aseo Distribuciones S.A.S."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Teléfono (opcional)
          </label>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Frecuencia de pago *
          </label>
          <select
            value={frecuenciaPago}
            onChange={(e) => setFrecuenciaPago(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            {FRECUENCIAS_PAGO.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.etiqueta}
              </option>
            ))}
          </select>
        </div>

        {frecuenciaPago === "semanal" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Día de pago *
            </label>
            <select
              value={diaSemanaPago}
              onChange={(e) => setDiaSemanaPago(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            >
              {DIAS_SEMANA.map((d) => (
                <option key={d.valor} value={d.valor}>
                  {d.etiqueta}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Ej. compras el viernes, pero le pagas cada lunes: elige &ldquo;Lunes&rdquo;.
            </p>
          </div>
        )}

        {frecuenciaPago === "personalizado" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Cada cuántos días *
            </label>
            <input
              type="number"
              min={1}
              value={diasPersonalizado}
              onChange={(e) => setDiasPersonalizado(e.target.value)}
              placeholder="Ej. 45"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
        )}

        <p className="text-xs text-gray-400">* Campos obligatorios</p>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}
