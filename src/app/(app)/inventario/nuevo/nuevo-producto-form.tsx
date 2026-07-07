"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sinTildes, primeraMayuscula } from "@/lib/texto";
import { UNIDADES } from "@/lib/unidades";
import { CampoMoneda } from "@/components/campo-moneda";
import { RecetaLineas, type LineaRecetaValor } from "../receta-lineas";
import { crearProducto, reabastecerProducto } from "./actions";

type ItemExistente = {
  id: string;
  nombre: string;
  categoria: string | null;
  cantidad: number;
  costo: number | null;
  precio_venta: number | null;
  unidad: string;
};

function filtrar(valores: string[], query: string) {
  const q = sinTildes(query.trim());
  if (!q) return [];
  return valores.filter((valor) => sinTildes(valor).includes(q)).slice(0, 8);
}

export function NuevoProductoForm({
  items,
  recetasPorItem,
}: {
  items: ItemExistente[];
  recetasPorItem: Record<string, LineaRecetaValor[]>;
}) {
  const router = useRouter();

  const categoriasExistentes = Array.from(
    new Set(items.map((item) => item.categoria).filter((valor): valor is string => Boolean(valor))),
  );

  const [nombre, setNombre] = useState("");
  const [mostrarSugerenciasNombre, setMostrarSugerenciasNombre] = useState(false);
  const [itemExistente, setItemExistente] = useState<ItemExistente | null>(null);

  const [categoria, setCategoria] = useState("");
  const [mostrarSugerenciasCategoria, setMostrarSugerenciasCategoria] = useState(false);

  const [unidad, setUnidad] = useState("unidad");
  const [cantidad, setCantidad] = useState("");
  const [costo, setCosto] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [receta, setReceta] = useState<LineaRecetaValor[]>([]);
  const [reinicios, setReinicios] = useState(0);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const nombreRef = useRef<HTMLInputElement>(null);
  const cantidadRef = useRef<HTMLInputElement>(null);

  function irAlCampo(elemento: HTMLElement | null) {
    if (!elemento) return;
    elemento.scrollIntoView({ behavior: "smooth", block: "center" });
    elemento.focus();
  }

  const sugerenciasNombre = itemExistente
    ? []
    : filtrar(
        items.map((item) => item.nombre),
        nombre,
      );

  const insumosDisponibles = items
    .filter((item) => item.id !== itemExistente?.id)
    .map((item) => ({ id: item.id, nombre: item.nombre, unidad: item.unidad }));

  function actualizarNombre(valor: string) {
    setNombre(valor);
    setItemExistente(null);
    setMostrarSugerenciasNombre(true);
    setMensajeExito(null);
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

  function reiniciarFormulario() {
    setNombre("");
    setItemExistente(null);
    setCategoria("");
    setUnidad("unidad");
    setCantidad("");
    setCosto("");
    setPrecioVenta("");
    setReceta([]);
    setReinicios((n) => n + 1);
  }

  async function guardar() {
    setError(null);
    setMensajeExito(null);

    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      irAlCampo(nombreRef.current);
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
      irAlCampo(cantidadRef.current);
      return;
    }
    if (costo.trim() === "" || Number.isNaN(costoNum) || costoNum < 0) {
      setError("El costo es obligatorio y debe ser un número mayor o igual a cero.");
      irAlCampo(document.getElementById("costo"));
      return;
    }
    if (precioVenta.trim() === "" || Number.isNaN(precioVentaNum) || precioVentaNum < 0) {
      setError("El precio de venta es obligatorio y debe ser un número mayor o igual a cero.");
      irAlCampo(document.getElementById("precioVenta"));
      return;
    }

    const nombreFinal = primeraMayuscula(nombre.trim());
    const categoriaFinal = primeraMayuscula(categoria.trim());

    setGuardando(true);
    try {
      if (itemExistente) {
        await reabastecerProducto({
          itemId: itemExistente.id,
          categoria: categoriaFinal,
          cantidadAgregada: cantidadNum,
          costo: costoNum,
          precioVenta: precioVentaNum,
          receta,
        });
        setMensajeExito(`"${nombreFinal}" reabastecido correctamente.`);
      } else {
        await crearProducto({
          nombre: nombreFinal,
          categoria: categoriaFinal,
          unidad,
          cantidad: cantidadNum,
          costo: costoNum,
          precioVenta: precioVentaNum,
          receta,
        });
        setMensajeExito(`"${nombreFinal}" creado correctamente.`);
      }
      reiniciarFormulario();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el producto.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Agregar producto</h1>
        <Link href="/inventario" className="text-sm text-gray-500 hover:text-gray-700">
          Ver inventario
        </Link>
      </div>

      {mensajeExito && (
        <p className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700">
          {mensajeExito} Puedes seguir agregando otro producto.
        </p>
      )}

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
            <input
              ref={nombreRef}
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
                Producto existente — se le va a sumar cantidad al stock actual (
                {itemExistente.cantidad}) y se actualizarán costo, precio y receta.
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Unidad *</label>
            {itemExistente ? (
              <input
                value={UNIDADES.find((u) => u.valor === itemExistente.unidad)?.etiqueta ?? itemExistente.unidad}
                disabled
                className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
              />
            ) : (
              <select
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              >
                {UNIDADES.map((u) => (
                  <option key={u.valor} value={u.valor}>
                    {u.etiqueta}
                  </option>
                ))}
              </select>
            )}
            {itemExistente && (
              <p className="mt-1 text-xs text-gray-400">
                La unidad de un producto ya existente no se puede cambiar.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {itemExistente ? "Cantidad a agregar *" : "Cantidad *"} (
              {itemExistente
                ? UNIDADES.find((u) => u.valor === itemExistente.unidad)?.etiqueta
                : UNIDADES.find((u) => u.valor === unidad)?.etiqueta}
              )
            </label>
            <input
              ref={cantidadRef}
              type="number"
              min={0}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>

          <CampoMoneda
            id="costo"
            label="Costo por unidad (precio de compra)"
            required
            value={costo}
            onChange={setCosto}
          />

          <CampoMoneda
            id="precioVenta"
            label="Precio de venta"
            required
            value={precioVenta}
            onChange={setPrecioVenta}
          />

          <p className="text-xs text-gray-400">* Campos obligatorios</p>
        </div>

        <div className="rounded-lg border border-gray-200 p-4">
          <h2 className="mb-1 text-sm font-semibold text-gray-900">Receta</h2>
          <p className="mb-4 text-xs text-gray-400">
            Si este producto se arma combinando otros del inventario (ej. un envase + un
            líquido), agrégalos aquí. Se descontarán automáticamente cada vez que uses
            &ldquo;Producir&rdquo;.
          </p>
          <RecetaLineas
            key={`${itemExistente?.id ?? "nuevo"}-${reinicios}`}
            insumosDisponibles={insumosDisponibles}
            valorInicial={itemExistente ? recetasPorItem[itemExistente.id] ?? [] : []}
            onChange={setReceta}
          />
        </div>
      </div>

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
