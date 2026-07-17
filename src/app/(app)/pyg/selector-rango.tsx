"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function primerDiaMes(fecha: Date) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

function ultimoDiaMes(fecha: Date) {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
}

function aIso(fecha: Date) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

export function SelectorRangoPyg({ desde, hasta }: { desde: string; hasta: string }) {
  const router = useRouter();
  const [desdeInput, setDesdeInput] = useState(desde);
  const [hastaInput, setHastaInput] = useState(hasta);

  function ir(nuevoDesde: string, nuevoHasta: string) {
    router.push(`/pyg?desde=${nuevoDesde}&hasta=${nuevoHasta}`);
  }

  function aplicar() {
    if (!desdeInput || !hastaInput) return;
    ir(desdeInput, hastaInput);
  }

  function preset(tipo: "este_mes" | "mes_anterior" | "este_anio") {
    const hoy = new Date();
    let d: Date;
    let h: Date;
    if (tipo === "este_mes") {
      d = primerDiaMes(hoy);
      h = ultimoDiaMes(hoy);
    } else if (tipo === "mes_anterior") {
      const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      d = primerDiaMes(mesAnterior);
      h = ultimoDiaMes(mesAnterior);
    } else {
      d = new Date(hoy.getFullYear(), 0, 1);
      h = new Date(hoy.getFullYear(), 11, 31);
    }
    const dIso = aIso(d);
    const hIso = aIso(h);
    setDesdeInput(dIso);
    setHastaInput(hIso);
    ir(dIso, hIso);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => preset("este_mes")}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          Este mes
        </button>
        <button
          type="button"
          onClick={() => preset("mes_anterior")}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          Mes anterior
        </button>
        <button
          type="button"
          onClick={() => preset("este_anio")}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          Este año
        </button>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">Desde</label>
        <input
          type="date"
          value={desdeInput}
          onChange={(e) => setDesdeInput(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-gray-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">Hasta</label>
        <input
          type="date"
          value={hastaInput}
          onChange={(e) => setHastaInput(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-gray-500 focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={aplicar}
        disabled={!desdeInput || !hastaInput}
        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        Aplicar
      </button>
    </div>
  );
}
