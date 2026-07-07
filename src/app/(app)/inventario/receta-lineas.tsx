"use client";

import { useState } from "react";
import { sinTildes } from "@/lib/texto";
import { UNIDADES, unidadesDeLaMismaDimension, convertir } from "@/lib/unidades";

export type Insumo = {
  id: string;
  nombre: string;
  unidad: string;
};

export type LineaRecetaValor = { insumoId: string; cantidad: number };

type Linea = {
  key: string;
  insumoId: string;
  busqueda: string;
  mostrarSugerencias: boolean;
  cantidad: string;
  unidadEntrada: string; // unidad en la que la persona está escribiendo la cantidad
};

function nuevaLinea(): Linea {
  return {
    key: crypto.randomUUID(),
    insumoId: "",
    busqueda: "",
    mostrarSugerencias: false,
    cantidad: "",
    unidadEntrada: "",
  };
}

function filtrarInsumos(insumos: Insumo[], query: string) {
  const q = sinTildes(query.trim());
  if (!q) return [];
  return insumos.filter((insumo) => sinTildes(insumo.nombre).includes(q)).slice(0, 8);
}

// Convierte la cantidad escrita (en unidadEntrada) a la unidad propia del
// insumo. Si no se puede convertir (unidad desconocida o dimensión
// distinta), usa el número tal cual, igual que antes de tener conversión.
function cantidadEnUnidadDelInsumo(cantidad: number, unidadEntrada: string, unidadInsumo: string) {
  if (!unidadEntrada || unidadEntrada === unidadInsumo) return cantidad;
  try {
    return convertir(cantidad, unidadEntrada, unidadInsumo);
  } catch {
    return cantidad;
  }
}

function lineasValidas(lineas: Linea[], insumosDisponibles: Insumo[]): LineaRecetaValor[] {
  return lineas
    .filter((linea) => linea.insumoId && linea.cantidad.trim() && Number(linea.cantidad) > 0)
    .map((linea) => {
      const insumo = insumosDisponibles.find((i) => i.id === linea.insumoId);
      const cantidadNum = Number(linea.cantidad);
      return {
        insumoId: linea.insumoId,
        cantidad: insumo
          ? cantidadEnUnidadDelInsumo(cantidadNum, linea.unidadEntrada, insumo.unidad)
          : cantidadNum,
      };
    });
}

function lineasIniciales(valores: LineaRecetaValor[], insumosDisponibles: Insumo[]): Linea[] {
  const iniciales = valores.map((fila) => {
    const insumo = insumosDisponibles.find((i) => i.id === fila.insumoId);
    return {
      key: crypto.randomUUID(),
      insumoId: fila.insumoId,
      busqueda: insumo?.nombre ?? "",
      mostrarSugerencias: false,
      cantidad: String(fila.cantidad),
      unidadEntrada: insumo?.unidad ?? "",
    };
  });
  return iniciales.length > 0 ? iniciales : [nuevaLinea()];
}

export function RecetaLineas({
  insumosDisponibles,
  valorInicial,
  onChange,
}: {
  insumosDisponibles: Insumo[];
  valorInicial?: LineaRecetaValor[];
  onChange: (lineas: LineaRecetaValor[]) => void;
}) {
  const [lineas, setLineas] = useState<Linea[]>(() =>
    lineasIniciales(valorInicial ?? [], insumosDisponibles),
  );

  function aplicar(nuevas: Linea[]) {
    setLineas(nuevas);
    onChange(lineasValidas(nuevas, insumosDisponibles));
  }

  function actualizarLinea(key: string, cambios: Partial<Linea>) {
    aplicar(lineas.map((linea) => (linea.key === key ? { ...linea, ...cambios } : linea)));
  }

  function buscarInsumo(key: string, texto: string) {
    actualizarLinea(key, {
      busqueda: texto,
      insumoId: "",
      unidadEntrada: "",
      mostrarSugerencias: true,
    });
  }

  function seleccionarInsumo(key: string, insumo: Insumo) {
    actualizarLinea(key, {
      insumoId: insumo.id,
      busqueda: insumo.nombre,
      unidadEntrada: insumo.unidad,
      mostrarSugerencias: false,
    });
  }

  function agregarLinea() {
    aplicar([...lineas, nuevaLinea()]);
  }

  function quitarLinea(key: string) {
    aplicar(lineas.filter((linea) => linea.key !== key));
  }

  return (
    <div>
      <div className="space-y-3">
        {lineas.map((linea) => {
          const insumoSeleccionado = insumosDisponibles.find((i) => i.id === linea.insumoId);
          const unidadesCompatibles = insumoSeleccionado
            ? unidadesDeLaMismaDimension(insumoSeleccionado.unidad)
            : [];
          const puedeElegirUnidad = unidadesCompatibles.length > 1;

          return (
            <div key={linea.key} className="grid grid-cols-12 items-end gap-2">
              <div className="relative col-span-5">
                <label className="mb-1 block text-xs font-medium text-gray-700">Insumo</label>
                <input
                  value={linea.busqueda}
                  onChange={(e) => buscarInsumo(linea.key, e.target.value)}
                  onFocus={() => actualizarLinea(linea.key, { mostrarSugerencias: true })}
                  onBlur={() =>
                    setTimeout(
                      () => actualizarLinea(linea.key, { mostrarSugerencias: false }),
                      150,
                    )
                  }
                  placeholder="Busca un producto del inventario"
                  className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
                />
                {linea.mostrarSugerencias &&
                  filtrarInsumos(insumosDisponibles, linea.busqueda).length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full rounded border border-gray-200 bg-white shadow-sm">
                      {filtrarInsumos(insumosDisponibles, linea.busqueda).map((insumo) => (
                        <li key={insumo.id}>
                          <button
                            type="button"
                            onMouseDown={() => seleccionarInsumo(linea.key, insumo)}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                          >
                            {insumo.nombre}
                            <span className="ml-2 text-gray-400">{insumo.unidad}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
              <div className="col-span-3">
                <label className="mb-1 block text-xs font-medium text-gray-700">Cantidad</label>
                <input
                  type="number"
                  min={0}
                  value={linea.cantidad}
                  onChange={(e) => actualizarLinea(linea.key, { cantidad: e.target.value })}
                  className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
                />
              </div>
              <div className="col-span-3">
                <label className="mb-1 block text-xs font-medium text-gray-700">Unidad</label>
                {puedeElegirUnidad ? (
                  <select
                    value={linea.unidadEntrada}
                    onChange={(e) => actualizarLinea(linea.key, { unidadEntrada: e.target.value })}
                    className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
                  >
                    {unidadesCompatibles.map((u) => (
                      <option key={u.valor} value={u.valor}>
                        {u.etiqueta}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={
                      insumoSeleccionado
                        ? UNIDADES.find((u) => u.valor === insumoSeleccionado.unidad)?.etiqueta ??
                          insumoSeleccionado.unidad
                        : ""
                    }
                    disabled
                    className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-2 text-sm text-gray-500"
                  />
                )}
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => quitarLinea(linea.key)}
                  className="text-sm text-red-500 hover:text-red-700"
                  aria-label="Quitar insumo"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={agregarLinea}
        className="mt-3 text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        + Agregar insumo
      </button>
    </div>
  );
}
