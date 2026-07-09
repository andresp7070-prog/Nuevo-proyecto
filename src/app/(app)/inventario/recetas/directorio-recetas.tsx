"use client";

import { useState } from "react";
import Link from "next/link";
import { sinTildes } from "@/lib/texto";
import { InventarioTabs } from "../inventario-tabs";

type Item = {
  id: string;
  nombre: string;
  categoria: string | null;
  insumos: number;
};

function filtrarPorTexto(items: Item[], busqueda: string) {
  const q = sinTildes(busqueda.trim());
  if (!q) return [];
  return items
    .filter((item) => sinTildes(item.nombre).includes(q) || sinTildes(item.categoria ?? "").includes(q))
    .slice(0, 8);
}

export function DirectorioRecetas({ items }: { items: Item[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  const configuradas = items.filter((item) => item.insumos > 0);
  const sugerencias = filtrarPorTexto(items, busqueda);

  return (
    <div>
      <InventarioTabs />

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Recetas</h1>
        <p className="mt-1 text-sm text-gray-500">
          Solo para productos que se arman combinando otros (ej. una hamburguesa hecha de
          carne, pan, lechuga, tomate y queso). Los ingredientes sueltos no necesitan receta.
        </p>
      </div>

      <div className="relative mb-6 max-w-xs">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Configurar receta de un producto
        </label>
        <input
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setMostrarSugerencias(true);
          }}
          onFocus={() => setMostrarSugerencias(sugerencias.length > 0)}
          onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
          placeholder="Ej. Hamburguesa"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        {mostrarSugerencias && busqueda.trim() && (
          <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-sm">
            {sugerencias.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/inventario/${item.id}/receta`}
                  className="block px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  {item.nombre}
                  {item.insumos > 0 && (
                    <span className="ml-1 text-xs text-gray-400">(ya tiene receta)</span>
                  )}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={`/inventario/nuevo?nombre=${encodeURIComponent(busqueda.trim())}&volver=receta`}
                className="block border-t border-gray-100 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                + Crear &ldquo;{busqueda.trim()}&rdquo; como producto nuevo
              </Link>
            </li>
          </ul>
        )}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-gray-900">Recetas configuradas</h2>
      {configuradas.length === 0 ? (
        <p className="text-gray-400">
          Aún no has configurado ninguna receta. Busca arriba el producto que se arma
          combinando otros (ej. &ldquo;Hamburguesa&rdquo;) para empezar.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
          {configuradas.map((item) => (
            <li key={item.id}>
              <Link
                href={`/inventario/${item.id}/receta`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.nombre}</p>
                  <p className="text-xs text-gray-400">{item.categoria || "Sin categoría"}</p>
                </div>
                <p className="text-sm text-gray-500">
                  {item.insumos} insumo{item.insumos === 1 ? "" : "s"} configurado
                  {item.insumos === 1 ? "" : "s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
