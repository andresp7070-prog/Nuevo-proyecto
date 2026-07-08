"use client";

import { useState } from "react";
import Link from "next/link";
import { sinTildes } from "@/lib/texto";
import { etiquetaUnidad } from "@/lib/unidades";
import { InventarioTabs } from "./inventario-tabs";
import { DescargarCsv } from "@/components/descargar-csv";

type Item = {
  id: string;
  nombre: string;
  categoria: string | null;
  unidad: string;
  cantidad: number;
  costo: number | null;
  precio_venta: number | null;
  marca: string | null;
  disponible: number | null;
};

function formatoMoneda(valor: number | null) {
  if (valor === null) return "—";
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

export function DirectorioInventario({
  items,
  creado,
}: {
  items: Item[];
  creado: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = items.filter((item) => {
    const q = sinTildes(busqueda.trim());
    if (!q) return true;
    return (
      sinTildes(item.nombre).includes(q) ||
      sinTildes(item.categoria ?? "").includes(q) ||
      sinTildes(item.marca ?? "").includes(q)
    );
  });

  const filasCsv = filtrados.map((item) => ({
    nombre: item.nombre,
    categoria: item.categoria ?? "",
    marca: item.marca ?? "",
    unidad: etiquetaUnidad(item.unidad),
    cantidad: item.disponible !== null ? item.disponible : item.cantidad,
    costo: item.costo ?? "",
    precio_venta: item.precio_venta ?? "",
  }));

  return (
    <div>
      <InventarioTabs />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Inventario</h1>
        <div className="flex gap-2">
          <DescargarCsv
            filas={filasCsv}
            columnas={[
              { clave: "nombre", titulo: "Nombre" },
              { clave: "categoria", titulo: "Categoría" },
              { clave: "marca", titulo: "Marca" },
              { clave: "unidad", titulo: "Unidad" },
              { clave: "cantidad", titulo: "Cantidad" },
              { clave: "costo", titulo: "Costo" },
              { clave: "precio_venta", titulo: "Precio de venta" },
            ]}
            nombreArchivo="inventario.csv"
          />
          <Link
            href="/inventario/nuevo"
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Agregar producto
          </Link>
        </div>
      </div>

      {creado && (
        <p className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700">
          Producto creado correctamente.
        </p>
      )}

      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, categoría o marca"
        className="mb-4 w-full max-w-xs rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
      />

      {filtrados.length === 0 ? (
        <p className="text-gray-400">No hay productos que coincidan.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/inventario/${item.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.nombre}</p>
                  <p className="text-xs text-gray-400">
                    {[item.categoria, item.marca].filter(Boolean).join(" · ") || "Sin categoría"}
                  </p>
                </div>
                <div className="flex items-center gap-6 text-right text-sm">
                  <div>
                    <p className="text-xs text-gray-400">
                      {item.disponible !== null ? "Disponible" : "Cantidad"}
                    </p>
                    <p
                      className={`font-medium ${
                        item.disponible !== null && item.disponible <= 0
                          ? "text-red-600"
                          : "text-gray-900"
                      }`}
                    >
                      {item.disponible !== null ? item.disponible : item.cantidad}{" "}
                      {etiquetaUnidad(item.unidad)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Costo</p>
                    <p className="font-medium text-gray-900">{formatoMoneda(item.costo)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Precio de venta</p>
                    <p className="font-medium text-gray-900">{formatoMoneda(item.precio_venta)}</p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
