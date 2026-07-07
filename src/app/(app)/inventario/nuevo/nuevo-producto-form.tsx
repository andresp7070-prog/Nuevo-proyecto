"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sinTildes, primeraMayuscula } from "@/lib/texto";
import { UNIDADES } from "@/lib/unidades";
import { CampoMoneda } from "@/components/campo-moneda";
import { RecetaLineas, type LineaRecetaValor } from "../receta-lineas";
import { guardarReceta } from "../[id]/actions";
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
  nombreInicial = "",
  volverAReceta = false,
}: {
  items: ItemExistente[];
  nombreInicial?: string;
  volverAReceta?: boolean;
}) {
  const router = useRouter();

  const categoriasExistentes = Array.from(
    new Set(items.map((item) => item.categoria).filter((valor): valor is string => Boolean(valor))),
  );

  const [nombre, setNombre] = useState(nombreInicial);
  const [mostrarSugerenciasNombre, setMostrarSugerenciasNombre] = useState(false);
  const [itemExistente, setItemExistente] = useState<ItemExistente | null>(null);

  const [categoria, setCategoria] = useState("");
  const [mostrarSugerenciasCategoria, setMostrarSugerenciasCategoria] = useState(false);

  const [unidad, setUnidad] = useState("unidad");
  const [cantidad, setCantidad] = useState("");
  const [costo, setCosto] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [contenidoPorUnidad, setContenidoPorUnidad] = useState("");
  const [receta, setReceta] = useState<LineaRecetaValor[]>([]);

  const insumosDisponibles = items
    .filter((item) => item.id !== itemExistente?.id)
    .map((item) => ({ id: item.id, nombre: item.nombre, unidad: item.unidad }));

  const costoCalculado = receta.reduce((total, linea) => {
    const insumo = items.find((item) => item.id === linea.insumoId);
    return total + linea.cantidad * (insumo?.costo ?? 0);
  }, 0);

  const precioVentaEstimado = Number(precioVenta) || 0;
  const gananciaUnitaria = precioVentaEstimado - costoCalculado;
  const margenPorcentaje =
    precioVentaEstimado > 0 ? (gananciaUnitaria / precioVentaEstimado) * 100 : null;

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
    setContenidoPorUnidad("");
  }

  async function guardar() {
    setError(null);
    setMensajeExito(null);

    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      irAlCampo(nombreRef.current);
      return;
    }

    const cantidadNum = volverAReceta ? 0 : Number(cantidad);
    const costoNum = volverAReceta ? costoCalculado : Number(costo);
    const precioVentaNum = Number(precioVenta);

    if (!volverAReceta && (cantidad.trim() === "" || Number.isNaN(cantidadNum) || cantidadNum < 0)) {
      setError(
        itemExistente
          ? "La cantidad a agregar es obligatoria y debe ser un número mayor o igual a cero."
          : "La cantidad es obligatoria y debe ser un número mayor o igual a cero.",
      );
      irAlCampo(cantidadRef.current);
      return;
    }
    if (!volverAReceta && (costo.trim() === "" || Number.isNaN(costoNum) || costoNum < 0)) {
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
        });
        if (volverAReceta) {
          if (receta.length > 0) {
            await guardarReceta({ itemResultanteId: itemExistente.id, lineas: receta });
          }
          router.push(`/inventario/${itemExistente.id}`);
          return;
        }
        setMensajeExito(`"${nombreFinal}" reabastecido correctamente.`);
        reiniciarFormulario();
        router.refresh();
      } else {
        const { id } = await crearProducto({
          nombre: nombreFinal,
          categoria: categoriaFinal,
          unidad,
          cantidad: cantidadNum,
          costo: costoNum,
          precioVenta: precioVentaNum,
          atributos:
            volverAReceta && unidad !== "unidad" && contenidoPorUnidad.trim()
              ? { contenido_por_unidad: Number(contenidoPorUnidad) }
              : undefined,
        });
        if (volverAReceta) {
          if (receta.length > 0) {
            await guardarReceta({ itemResultanteId: id, lineas: receta });
          }
          router.push(`/inventario/${id}`);
          return;
        }
        setMensajeExito(`"${nombreFinal}" creado correctamente.`);
        reiniciarFormulario();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el producto.");
    } finally {
      setGuardando(false);
    }
  }

  const campoNombre = (
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
          {itemExistente.cantidad}) y se actualizarán costo y precio.
        </p>
      )}
    </div>
  );

  const campoCategoria = (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium text-gray-700">Categoría (opcional)</label>
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
  );

  const campoUnidad = (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        Unidad{volverAReceta ? " (opcional)" : " *"}
      </label>
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
  );

  const campoContenido =
    volverAReceta && !itemExistente && unidad !== "unidad" ? (
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Contenido por unidad (opcional)
        </label>
        <input
          type="number"
          min={0}
          value={contenidoPorUnidad}
          onChange={(e) => setContenidoPorUnidad(e.target.value)}
          placeholder="Ej. 500"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-400">
          ¿Cuánto trae cada unidad? Ej. si cada una son 500{" "}
          {UNIDADES.find((u) => u.valor === unidad)?.etiqueta}, escribe 500. Queda guardado como
          referencia.
        </p>
      </div>
    ) : null;

  const campoCantidad = volverAReceta ? (
    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
      La cantidad inicial es 0. Después de guardar, usa &ldquo;Producir&rdquo; para armar
      unidades — ahí se descuentan los insumos automáticamente.
    </div>
  ) : (
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
  );

  const campoCosto = volverAReceta ? (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        Costo por unidad (calculado según la receta)
      </label>
      <div className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
        {costoCalculado.toLocaleString("es-CO", { style: "currency", currency: "COP" })}
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Suma del costo de cada insumo según la cantidad que le pusiste arriba.
      </p>
    </div>
  ) : (
    <CampoMoneda
      id="costo"
      label="Costo por unidad (precio de compra)"
      required
      value={costo}
      onChange={setCosto}
    />
  );

  const campoPrecioVenta = (
    <div>
      <CampoMoneda
        id="precioVenta"
        label={volverAReceta ? "Precio de venta estimado" : "Precio de venta"}
        required
        value={precioVenta}
        onChange={setPrecioVenta}
      />
      {volverAReceta && margenPorcentaje !== null && (
        <p className={`mt-1 text-xs ${gananciaUnitaria >= 0 ? "text-green-600" : "text-red-600"}`}>
          Ganancia: {gananciaUnitaria.toLocaleString("es-CO", { style: "currency", currency: "COP" })}{" "}
          por unidad ({margenPorcentaje.toFixed(1)}% de margen)
        </p>
      )}
    </div>
  );

  const panelReceta = (
    <div className="rounded-lg border border-gray-200 p-4">
      <h2 className="mb-1 text-sm font-semibold text-gray-900">
        ¿De qué insumos se compone?
      </h2>
      <p className="mb-4 text-xs text-gray-400">
        Elige los insumos y cuánto lleva cada uno — se descontarán automáticamente al producir
        una unidad de este producto, y con esto calculamos el costo de abajo.
      </p>
      <RecetaLineas insumosDisponibles={insumosDisponibles} onChange={setReceta} />
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Agregar producto</h1>
        <Link
          href={volverAReceta ? "/inventario/recetas" : "/inventario"}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {volverAReceta ? "Volver a recetas" : "Ver inventario"}
        </Link>
      </div>

      {volverAReceta && (
        <p className="mb-4 rounded bg-gray-50 px-3 py-2 text-sm text-gray-600">
          Primero elige de qué insumos se compone este producto — así calculamos su costo y
          puedes poner un precio de venta con eso en mente. Al final le pones nombre y, si
          hace falta, unidad.
        </p>
      )}

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

      {volverAReceta ? (
        <div className="max-w-2xl space-y-6">
          {panelReceta}
          <div className="max-w-md space-y-4">
            {campoCosto}
            {campoPrecioVenta}
            {campoNombre}
            {campoCategoria}
            {campoUnidad}
            {campoContenido}
            {campoCantidad}
            <p className="text-xs text-gray-400">* Campos obligatorios</p>
          </div>
        </div>
      ) : (
        <div className="max-w-md space-y-4">
          {campoNombre}
          {campoCategoria}
          {campoUnidad}
          {campoCantidad}
          {campoCosto}
          {campoPrecioVenta}
          <p className="text-xs text-gray-400">* Campos obligatorios</p>
        </div>
      )}

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
