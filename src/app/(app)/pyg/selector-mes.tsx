"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primeraMayuscula } from "@/lib/texto";

const MESES_ABREV = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function SelectorMesPyg({
  mesesConDatos,
  mesSeleccionado,
}: {
  mesesConDatos: string[]; // "YYYY-MM", meses que sí tienen algún dato
  mesSeleccionado: string; // fecha ISO completa del mes actualmente elegido
}) {
  const router = useRouter();
  const fechaSel = new Date(`${mesSeleccionado.slice(0, 10)}T00:00:00`);
  const [abierto, setAbierto] = useState(false);
  const [anioMostrado, setAnioMostrado] = useState(fechaSel.getFullYear());

  const etiquetaSeleccionada = primeraMayuscula(
    fechaSel.toLocaleDateString("es-CO", { month: "long", year: "numeric" }),
  );

  function elegirMes(mesIndex: number) {
    const iso = `${anioMostrado}-${String(mesIndex + 1).padStart(2, "0")}-01`;
    setAbierto(false);
    router.push(`/pyg?mes=${iso}`);
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-gray-400" aria-hidden="true">
          <rect x="3" y="4.5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M3 8h14M7 3v3M13 3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {etiquetaSeleccionada}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setAnioMostrado((a) => a - 1)}
                className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100"
                aria-label="Año anterior"
              >
                ‹
              </button>
              <span className="text-sm font-semibold text-gray-900">{anioMostrado}</span>
              <button
                type="button"
                onClick={() => setAnioMostrado((a) => a + 1)}
                className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100"
                aria-label="Año siguiente"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {MESES_ABREV.map((nombre, i) => {
                const iso = `${anioMostrado}-${String(i + 1).padStart(2, "0")}`;
                const tieneDatos = mesesConDatos.includes(iso);
                const esSeleccionado = iso === mesSeleccionado.slice(0, 7);
                return (
                  <button
                    key={nombre}
                    type="button"
                    onClick={() => elegirMes(i)}
                    className={`relative rounded-lg py-2 text-xs font-medium ${
                      esSeleccionado ? "bg-accent text-white" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {nombre}
                    {tieneDatos && !esSeleccionado && (
                      <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
