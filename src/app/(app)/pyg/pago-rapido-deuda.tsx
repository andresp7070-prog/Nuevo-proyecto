"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ahoraFecha } from "@/lib/fecha";
import { EntradaMoneda } from "@/components/campo-moneda";
import { registrarAbono, marcarPagado } from "./pasivos/actions";

type Pasivo = {
  id: string;
  descripcion: string;
  monto_total: number;
  monto_pagado: number;
};

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

export function PagoRapidoDeuda({ pasivos }: { pasivos: Pasivo[] }) {
  const router = useRouter();

  const [pasivoId, setPasivoId] = useState(pasivos[0]?.id ?? "");
  const [abono, setAbono] = useState("");
  const [fecha, setFecha] = useState(ahoraFecha());
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pasivo = pasivos.find((p) => p.id === pasivoId) ?? null;
  const saldo = pasivo ? pasivo.monto_total - pasivo.monto_pagado : 0;

  async function guardarAbono() {
    setError(null);
    const monto = Number(abono);
    if (!pasivoId) {
      setError("Elige una deuda.");
      return;
    }
    if (!abono.trim() || Number.isNaN(monto) || monto <= 0) {
      setError("Escribe un monto válido.");
      return;
    }
    setProcesando(true);
    const resultado = await registrarAbono({ pasivoId, monto, fecha });
    setProcesando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    setAbono("");
    router.refresh();
  }

  async function pagarTodo() {
    setError(null);
    if (!pasivoId) {
      setError("Elige una deuda.");
      return;
    }
    setProcesando(true);
    const resultado = await marcarPagado({ pasivoId, fecha });
    setProcesando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  if (pasivos.length === 0) return null;

  return (
    <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
      <p className="text-xs font-medium text-gray-700">Pagar una cuota sin salir de aquí</p>
      <select
        value={pasivoId}
        onChange={(e) => setPasivoId(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
      >
        {pasivos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.descripcion} — {formatoMoneda(p.monto_total - p.monto_pagado)} pendiente
          </option>
        ))}
      </select>
      <div className="flex flex-wrap items-center gap-2">
        <EntradaMoneda
          value={abono}
          onChange={setAbono}
          className="w-28 rounded-lg border border-gray-300 py-1.5 pl-6 pr-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={guardarAbono}
          disabled={procesando}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          Registrar abono
        </button>
        <button
          type="button"
          onClick={pagarTodo}
          disabled={procesando}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          Pagar saldo completo ({formatoMoneda(saldo)})
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
