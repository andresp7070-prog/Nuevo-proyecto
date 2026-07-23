"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CampoMoneda } from "@/components/campo-moneda";
import { actualizarMovimiento } from "./actions";

type Movimiento = {
  id: string;
  tipo: "ingreso" | "gasto";
  categoria: string | null;
  monto: number;
  fecha: string;
  nota: string | null;
  recurrente: boolean;
  frecuencia: string | null;
};

const frecuencias = [
  { value: "diario", label: "Diario" },
  { value: "mensual", label: "Mensual" },
  { value: "anual", label: "Anual" },
];

const etiquetaFrecuencia: Record<string, string> = {
  diario: "Diario",
  mensual: "Mensual",
  anual: "Anual",
};

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function FilaMovimiento({ movimiento }: { movimiento: Movimiento }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tipo, setTipo] = useState<"gasto" | "ingreso">(movimiento.tipo);
  const [categoria, setCategoria] = useState(movimiento.categoria ?? "");
  const [monto, setMonto] = useState(String(movimiento.monto));
  const [fecha, setFecha] = useState(movimiento.fecha);
  const [nota, setNota] = useState(movimiento.nota ?? "");
  const [recurrente, setRecurrente] = useState(movimiento.recurrente);
  const [frecuencia, setFrecuencia] = useState(movimiento.frecuencia ?? "mensual");

  function cancelar() {
    setEditando(false);
    setError(null);
    setTipo(movimiento.tipo);
    setCategoria(movimiento.categoria ?? "");
    setMonto(String(movimiento.monto));
    setFecha(movimiento.fecha);
    setNota(movimiento.nota ?? "");
    setRecurrente(movimiento.recurrente);
    setFrecuencia(movimiento.frecuencia ?? "mensual");
  }

  async function guardar() {
    setError(null);
    const montoNum = Number(monto);
    if (monto.trim() === "" || Number.isNaN(montoNum) || montoNum <= 0) {
      setError("El monto es obligatorio y debe ser mayor a cero.");
      return;
    }
    setGuardando(true);
    const resultado = await actualizarMovimiento({
      movimientoId: movimiento.id,
      tipo,
      categoria: categoria.trim(),
      monto: montoNum,
      fecha,
      nota: nota.trim(),
      recurrente: tipo === "gasto" ? recurrente : false,
      frecuencia: tipo === "gasto" && recurrente ? frecuencia : "",
    });
    setGuardando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    setEditando(false);
    router.refresh();
  }

  if (editando) {
    return (
      <li className="py-3">
        <div className="space-y-3 rounded-lg bg-gray-50 p-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTipo("gasto")}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-xs ${
                tipo === "gasto"
                  ? "border-accent bg-accent text-white"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              Gasto
            </button>
            <button
              type="button"
              onClick={() => setTipo("ingreso")}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-xs ${
                tipo === "ingreso"
                  ? "border-accent bg-accent text-white"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              Ingreso
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Categoría</label>
              <input
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ej. Arriendo"
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
              />
            </div>
            <CampoMoneda id={`monto-${movimiento.id}`} label="Monto" value={monto} onChange={setMonto} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>

          {tipo === "gasto" && (
            <div>
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={recurrente}
                  onChange={(e) => setRecurrente(e.target.checked)}
                />
                Es un gasto que se repite (arriendo, nómina, servicios...)
              </label>
              {recurrente && (
                <select
                  value={frecuencia}
                  onChange={(e) => setFrecuencia(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
                >
                  {frecuencias.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Nota</label>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={cancelar}
              disabled={guardando}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 py-3">
      <div>
        <p className="text-sm font-medium text-gray-900">
          {movimiento.categoria || (movimiento.tipo === "gasto" ? "Gasto sin categoría" : "Ingreso sin categoría")}
        </p>
        <p className="text-xs text-gray-400">
          {[
            new Date(`${movimiento.fecha}T00:00:00`).toLocaleDateString("es-CO"),
            movimiento.recurrente && movimiento.frecuencia
              ? `Se repite: ${etiquetaFrecuencia[movimiento.frecuencia] ?? movimiento.frecuencia}`
              : null,
            movimiento.nota,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`text-sm font-medium whitespace-nowrap ${
            movimiento.tipo === "ingreso" ? "text-green-700" : "text-gray-900"
          }`}
        >
          {movimiento.tipo === "ingreso" ? "+ " : "− "}
          {formatoMoneda(movimiento.monto)}
        </span>
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="text-xs text-gray-400 hover:text-gray-700"
        >
          Editar
        </button>
      </div>
    </li>
  );
}

export function DirectorioMovimientos({ movimientos }: { movimientos: Movimiento[] }) {
  if (movimientos.length === 0) {
    return <p className="text-gray-400">Todavía no hay gastos ni ingresos registrados a mano.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 px-4">
      {movimientos.map((m) => (
        <FilaMovimiento key={m.id} movimiento={m} />
      ))}
    </ul>
  );
}
