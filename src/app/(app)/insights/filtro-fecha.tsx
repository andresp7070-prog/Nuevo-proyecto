"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const OPCIONES: { valor: string; etiqueta: string }[] = [
  { valor: "todo", etiqueta: "Todo el tiempo" },
  { valor: "7d", etiqueta: "Últimos 7 días" },
  { valor: "15d", etiqueta: "Últimos 15 días" },
  { valor: "30d", etiqueta: "Últimos 30 días" },
  { valor: "este_mes", etiqueta: "Este mes" },
  { valor: "mes_anterior", etiqueta: "Mes anterior" },
  { valor: "este_anio", etiqueta: "Este año" },
];

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function FiltroFecha({
  periodoActual,
  diaSemanaActual,
  productoActual,
  productos,
}: {
  periodoActual: string;
  diaSemanaActual: string;
  productoActual: string;
  productos: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mostrarPersonalizado, setMostrarPersonalizado] = useState(periodoActual === "personalizado");
  const [desde, setDesde] = useState(searchParams.get("desde") ?? "");
  const [hasta, setHasta] = useState(searchParams.get("hasta") ?? "");

  // replace (no push): cambiar de filtro no debe apilar una entrada nueva en
  // el historial por cada clic — así el botón "atrás" del navegador no
  // obliga a pasar por cada filtro que se probó.
  function irA(params: URLSearchParams) {
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function paramsActuales() {
    return new URLSearchParams(searchParams.toString());
  }

  function elegirPreset(valor: string) {
    setMostrarPersonalizado(false);
    const params = paramsActuales();
    params.set("periodo", valor);
    params.delete("desde");
    params.delete("hasta");
    irA(params);
  }

  function aplicarPersonalizado() {
    if (!desde || !hasta) return;
    const params = paramsActuales();
    params.set("periodo", "personalizado");
    params.set("desde", desde);
    params.set("hasta", hasta);
    irA(params);
  }

  function cambiarDiaSemana(valor: string) {
    const params = paramsActuales();
    if (valor) params.set("dia_semana", valor);
    else params.delete("dia_semana");
    irA(params);
  }

  function cambiarProducto(valor: string) {
    const params = paramsActuales();
    if (valor) params.set("producto", valor);
    else params.delete("producto");
    irA(params);
  }

  function reiniciar() {
    setMostrarPersonalizado(false);
    setDesde("");
    setHasta("");
    router.replace(pathname, { scroll: false });
  }

  const hayFiltrosActivos = periodoActual !== "todo" || Boolean(diaSemanaActual) || Boolean(productoActual);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {OPCIONES.map((op) => (
          <button
            key={op.valor}
            type="button"
            onClick={() => elegirPreset(op.valor)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              periodoActual === op.valor
                ? "border-accent bg-accent text-white"
                : "border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            {op.etiqueta}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMostrarPersonalizado((v) => !v)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
            periodoActual === "personalizado"
              ? "border-accent bg-accent text-white"
              : "border-gray-300 text-gray-700 hover:bg-gray-100"
          }`}
        >
          Personalizado
        </button>

        {hayFiltrosActivos && (
          <button
            type="button"
            onClick={reiniciar}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100"
          >
            ✕ Reiniciar filtros
          </button>
        )}
      </div>

      {mostrarPersonalizado && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-gray-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-gray-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={aplicarPersonalizado}
            disabled={!desde || !hasta}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Aplicar
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Día de la semana</label>
          <select
            value={diaSemanaActual}
            onChange={(e) => cambiarDiaSemana(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-gray-500 focus:outline-none"
          >
            <option value="">Todos los días</option>
            {DIAS_SEMANA.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Producto</label>
          <select
            value={productoActual}
            onChange={(e) => cambiarProducto(e.target.value)}
            className="max-w-[220px] rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-gray-500 focus:outline-none"
          >
            <option value="">Todos los productos</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
