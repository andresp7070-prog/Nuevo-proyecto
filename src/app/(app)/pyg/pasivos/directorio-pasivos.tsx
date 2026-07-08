"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ahoraFecha } from "@/lib/fecha";
import { registrarAbono, marcarPagado } from "./actions";

type Pasivo = {
  id: string;
  descripcion: string;
  tipo: string | null;
  monto_total: number;
  monto_pagado: number;
  fecha_vencimiento: string | null;
  estado: string;
};

type Pago = { monto: number; fecha: string };

const etiquetaTipo: Record<string, string> = {
  prestamo: "Préstamo",
  proveedor: "Proveedor",
  tarjeta_credito: "Tarjeta de crédito",
  otro: "Otro",
};

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function estaVencido(pasivo: Pasivo) {
  if (pasivo.estado !== "pendiente" || !pasivo.fecha_vencimiento) return false;
  return new Date(pasivo.fecha_vencimiento) < new Date(new Date().toDateString());
}

function FilaPasivo({ pasivo, pagos }: { pasivo: Pasivo; pagos: Pago[] }) {
  const router = useRouter();
  const [abono, setAbono] = useState("");
  const [fechaAbono, setFechaAbono] = useState(ahoraFecha());
  const [fechaPago, setFechaPago] = useState(ahoraFecha());
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saldo = pasivo.monto_total - pasivo.monto_pagado;

  async function guardarAbono() {
    setError(null);
    const monto = Number(abono);
    if (!abono.trim() || Number.isNaN(monto) || monto <= 0) {
      setError("Escribe un monto válido.");
      return;
    }
    setProcesando(true);
    const resultado = await registrarAbono({ pasivoId: pasivo.id, monto, fecha: fechaAbono });
    setProcesando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    setAbono("");
    router.refresh();
  }

  async function pagarTodo() {
    setProcesando(true);
    const resultado = await marcarPagado({ pasivoId: pasivo.id, fecha: fechaPago });
    setProcesando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-gray-900">{pasivo.descripcion}</p>
          <p className="text-xs text-gray-400">
            {[pasivo.tipo ? etiquetaTipo[pasivo.tipo] ?? pasivo.tipo : null, pasivo.fecha_vencimiento ? `Vence ${pasivo.fecha_vencimiento}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="text-right">
          {pasivo.estado === "pagado" ? (
            <p className="text-sm font-medium text-green-700">Pagado</p>
          ) : (
            <>
              <p className={`text-sm font-medium ${estaVencido(pasivo) ? "text-red-600" : "text-gray-900"}`}>
                {formatoMoneda(saldo)} pendiente{estaVencido(pasivo) ? " · vencido" : ""}
              </p>
              <p className="text-xs text-gray-400">
                {formatoMoneda(pasivo.monto_pagado)} de {formatoMoneda(pasivo.monto_total)} pagado
              </p>
            </>
          )}
        </div>
      </div>

      {pasivo.estado !== "pagado" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={abono}
            onChange={(e) => setAbono(e.target.value.replace(/\D/g, ""))}
            placeholder="Abono"
            inputMode="numeric"
            className="w-24 rounded border border-gray-300 px-2 py-1 text-sm focus:border-gray-500 focus:outline-none"
          />
          <input
            type="date"
            value={fechaAbono}
            onChange={(e) => setFechaAbono(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-gray-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={guardarAbono}
            disabled={procesando}
            className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Registrar abono
          </button>
          <span className="text-gray-300">|</span>
          <input
            type="date"
            value={fechaPago}
            onChange={(e) => setFechaPago(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-gray-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={pagarTodo}
            disabled={procesando}
            className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Marcar como pagado
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {pagos.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setMostrarHistorial((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {mostrarHistorial ? "Ocultar" : "Ver"} historial de pagos ({pagos.length})
          </button>
          {mostrarHistorial && (
            <ul className="mt-1 space-y-1 border-l-2 border-gray-100 pl-3 text-xs text-gray-500">
              {pagos.map((p, i) => (
                <li key={i} className="flex justify-between">
                  <span>{p.fecha}</span>
                  <span>{formatoMoneda(p.monto)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export function DirectorioPasivos({
  pasivos,
  pagosPorPasivo,
}: {
  pasivos: Pasivo[];
  pagosPorPasivo: Record<string, Pago[]>;
}) {
  const pendientes = pasivos.filter((p) => p.estado !== "pagado");
  const pagados = pasivos.filter((p) => p.estado === "pagado");
  const totalPendiente = pendientes.reduce((s, p) => s + (p.monto_total - p.monto_pagado), 0);

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/pyg" className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver a Estado P y G
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-gray-900">Deudas</h1>
        </div>
        <Link
          href="/pyg/pasivos/nuevo"
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Agregar deuda
        </Link>
      </div>

      <p className="mb-4 text-sm text-gray-500">
        Total pendiente: <span className="font-semibold text-gray-900">{formatoMoneda(totalPendiente)}</span>
      </p>

      {pendientes.length === 0 ? (
        <p className="text-gray-400">No tienes deudas pendientes.</p>
      ) : (
        <ul className="mb-6 divide-y divide-gray-100 rounded-lg border border-gray-200 px-4">
          {pendientes.map((p) => (
            <FilaPasivo key={p.id} pasivo={p} pagos={pagosPorPasivo[p.id] ?? []} />
          ))}
        </ul>
      )}

      {pagados.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Pagadas</h2>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 px-4">
            {pagados.map((p) => (
              <FilaPasivo key={p.id} pasivo={p} pagos={pagosPorPasivo[p.id] ?? []} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
