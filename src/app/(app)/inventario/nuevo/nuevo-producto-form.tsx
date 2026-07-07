"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sinTildes } from "@/lib/texto";
import { CampoMoneda } from "@/components/campo-moneda";
import { crearProducto, reabastecerProducto } from "./actions";

type ItemExistente = {
  id: string;
  nombre: string;
  categoria: string | null;
  cantidad: number;
  costo: number | null;
  precio_venta: number | null;
};

function filtrar(valores: string[], query: string) {
  const q = sinTildes(query.trim());
  if (!q) return [];
  return valores.filter((valor) => sinTildes(valor).includes(q)).slice(0, 8);
}

export function NuevoProductoForm({ items }: { items: ItemExistente[] }) {
  const router = useRouter();

  const categoriasExistentes = Array.from(
    new Set(items.map((item) => item.categoria).filter((valor): valor is string => Boolean(valor))),
  );

  const [nombre, setNombre] = useState("");
  const [mostrarSugerenciasNombre, setMostrarSugerenciasNombre] = useState(false);
  const [itemExistente, setItemExistente] = useState<ItemExistente | null>(null);

  const [categoria, setCategoria] = useState("");
  const [mostrarSugerenciasCategoria, setMostrarSugerenciasCategoria] = useState(false);

  const [cantidad, setCantidad] = useState("");
  const [costo, setCosto] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sugerenciasNombre = itemExistente
    ? []
    : filtrar(
        items.map((item) => item.nombre),
        nombre,
      );

  function actualizarNombre(valor: string) {
    setNombre(valor);
    setItemExistente(null);
    setMostrarSugerenciasNombre(true);
  }

  function seleccionarExistente(itemNombre: string) {
    const item = items.find((i) => i.nombre === itemNombre);
    if (!item) return;
    setNombre(item.nombre);
    setItemExistente(item);
    setCategoria(item.categoria ?? "");
    setCosto(item.costo != null ? String(item.costo) : "");
    setPrecioVenta(item.precio_venta != null ? String(item.precio_venta) : "");
    setCantidad("");
    setMostrarSugerenciasNombre(false);
  }

  async function guardar() {
    setError(null);

    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    const cantidadNum = Number(cantidad);
    const costoNum = Number(costo);
    const precioVentaNum = Number(precioVenta);

    if (cantidad.trim() === "" || Number.isNaN(cantidadNum) || cantidadNum < 0) {
      setError(
        itemExistente
          ? "La cantidad a agregar es obligatoria y debe ser un número mayor o igual a cero."
          : "La cantidad es obligatoria y debe ser un número mayor o igual a cero.",
      );
      return;
    }
    if (costo.trim() === "" || Number.isNaN(costoNum) || costoNum < 0) {
      setError("El costo es obligatorio y debe ser un número mayor o igual a cero.");
      return;
    }
    if (precioVenta.trim() === "" || Number.isNaN(precioVentaNum) || precioVentaNum < 0) {
      setError("El precio de venta es obligatorio y debe ser un número mayor o igual a cero.");
      return;
    }

    setGuardando(true);
    try {
      if (itemExistente) {
        await reabastecerProducto({
          itemId: itemExistente.id,
          categoria: categoria.trim(),
          cantidadAgregada: cantidadNum,
          costo: costoNum,
          precioVenta: precioVentaNum,
        });
      } else {
        await crearProducto({
          nombre: nombre.trim(),
          categoria: categoria.trim(),
          cantidad: cantidadNum,
          costo: costoNum,
          precioVenta: precioVentaNum,
        });
      }
      router.push("/inventario?creado=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el producto.");
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-lg font-semibold text-gray-900">Agregar producto</h1>

      <div className="space-y-4">
        <div className="relative">
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
          <input
            value={nombre}
            onChange={(e) => actualizarNombre(e.target.value)}
            onFocus={() => setMostrarSugerenciasNombre(sugerenciasNombre.length > 0)}
            onBlur={() => setTimeout(() => setMostrarSugerenciasNombre(false), 150)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          {mostrarSugerenciasNombre && sugerenciasNombre.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded border border-gray-200 bg-white shadow-sm">
              {sugerenciasNombre.map((valor) => (
                <li key={valor}>
                  <button
                    type="button"
                    onMouseDown={() => seleccionarExistente(valor)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {valor}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {itemExistente && (
            <p className="mt-1 text-xs text-green-600">
              Producto existente — se le va a sumar cantidad al stock actual ({itemExistente.cantidad})
              y se actualizarán costo y precio.
            </p>
          )}
        </div>

        <div className="relative">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Categoría (opcional)
          </label>
          <input
            value={categoria}
            onChange={(e) => {
              setCategoria(e.target.value);
              setMostrarSugerenciasCategoria(true);
            }}
            onFocus={() =>
              setMostrarSugerenciasCategoria(filtrar(categoriasExistentes, categoria).length > 0)
            }
            onBlur={() => setTimeout(() => setMostrarSugerenciasCategoria(false), 150)}
            placeholder="Ej. Jabones, Detergentes"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          {mostrarSugerenciasCategoria && filtrar(categoriasExistentes, categoria).length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded border border-gray-200 bg-white shadow-sm">
              {filtrar(categoriasExistentes, categoria).map((valor) => (
                <li key={valor}>
                  <button
                    type="button"
                    onMouseDown={() => {
                      setCategoria(valor);
                      setMostrarSugerenciasCategoria(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {valor}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {itemExistente ? "Cantidad a agregar *" : "Cantidad *"}
          </label>
          <input
            type="number"
            min={0}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <CampoMoneda
          label="Costo por unidad (precio de compra)"
          required
          value={costo}
          onChange={setCosto}
        />

        <CampoMoneda
          label="Precio de venta"
          required
          value={precioVenta}
          onChange={setPrecioVenta}
        />
      </div>

      <p className="mt-3 text-xs text-gray-400">* Campos obligatorios</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-6 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Guardar producto"}
      </button>
    </div>
  );
}
