"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sinTildes, primeraMayuscula } from "@/lib/texto";
import { UNIDADES } from "@/lib/unidades";
import { CampoMoneda } from "@/components/campo-moneda";
import { comprimirImagen, TAMANO_MAXIMO_ORIGINAL_BYTES } from "@/lib/imagenes";
import { RecetaLineas, type LineaRecetaValor } from "../receta-lineas";
import { guardarReceta, subirFotoProducto } from "../[id]/actions";
import { crearProducto, reabastecerProducto } from "./actions";

type ItemExistente = {
  id: string;
  nombre: string;
  categoria: string | null;
  cantidad: number;
  costo: number | null;
  precio_venta: number | null;
  unidad: string;
  proveedor_id: string | null;
  sku: string | null;
  es_insumo: boolean;
  punto_venta_id: string | null;
};

type Proveedor = {
  id: string;
  nombre: string;
};

type PuntoVenta = {
  id: string;
  nombre: string;
};

function filtrar(valores: string[], query: string) {
  const q = sinTildes(query.trim());
  if (!q) return [];
  return valores.filter((valor) => sinTildes(valor).includes(q)).slice(0, 8);
}

export function NuevoProductoForm({
  items: itemsTodos,
  proveedores,
  nombreInicial = "",
  volverAReceta = false,
  puntosVenta = [],
  puntoInicial = null,
}: {
  items: ItemExistente[];
  proveedores: Proveedor[];
  nombreInicial?: string;
  volverAReceta?: boolean;
  puntosVenta?: PuntoVenta[];
  puntoInicial?: string | null;
}) {
  const router = useRouter();

  const usaPuntos = puntosVenta.length > 0;
  const [puntoVentaId, setPuntoVentaId] = useState(puntoInicial ?? puntosVenta[0]?.id ?? "");

  // Los "productos existentes" (para sugerencias y para detectar duplicados)
  // se limitan al punto elegido — el mismo nombre puede repetirse en
  // distintos puntos, cada uno con su propio stock.
  const items = usaPuntos ? itemsTodos.filter((i) => i.punto_venta_id === puntoVentaId) : itemsTodos;

  const categoriasExistentes = Array.from(
    new Set(items.map((item) => item.categoria).filter((valor): valor is string => Boolean(valor))),
  );

  const [nombre, setNombre] = useState(nombreInicial);
  const [mostrarSugerenciasNombre, setMostrarSugerenciasNombre] = useState(false);
  const [itemExistente, setItemExistente] = useState<ItemExistente | null>(null);

  const [categoria, setCategoria] = useState("");
  const [mostrarSugerenciasCategoria, setMostrarSugerenciasCategoria] = useState(false);

  const [marca, setMarca] = useState("");

  const [unidad, setUnidad] = useState("unidad");
  const [cantidad, setCantidad] = useState("");
  const [costo, setCosto] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [sku, setSku] = useState("");
  const [esInsumo, setEsInsumo] = useState(false);
  const [contenidoPorUnidad, setContenidoPorUnidad] = useState("");
  const [receta, setReceta] = useState<LineaRecetaValor[]>([]);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

  const insumosDisponibles = items
    .filter((item) => item.id !== itemExistente?.id)
    .map((item) => ({ id: item.id, nombre: item.nombre, unidad: item.unidad }));

  // Solo para mostrar como referencia — el valor real lo asigna el servidor,
  // así dos personas agregando productos a la vez no chocan con el mismo SKU.
  // Se calcula sobre TODOS los productos de la empresa (no solo los del
  // punto elegido), porque el SKU es único para toda la empresa, no por punto.
  const proximoSkuSugerido = String(
    itemsTodos.reduce((max, item) => {
      if (!item.sku || !/^\d+$/.test(item.sku)) return max;
      return Math.max(max, Number(item.sku));
    }, -1) + 1,
  ).padStart(5, "0");

  const costoCalculado = receta.reduce((total, linea) => {
    const insumo = items.find((item) => item.id === linea.insumoId);
    return total + linea.cantidad * (insumo?.costo ?? 0);
  }, 0);

  // Fuera del flujo de receta, el costo no se calcula solo — es el que la persona escribió.
  const costoEfectivo = volverAReceta ? costoCalculado : Number(costo) || 0;
  const precioVentaEstimado = Number(precioVenta) || 0;
  const gananciaUnitaria = precioVentaEstimado - costoEfectivo;
  const margenPorcentaje =
    precioVentaEstimado > 0 ? (gananciaUnitaria / precioVentaEstimado) * 100 : null;
  const mostrarMargen =
    !esInsumo && margenPorcentaje !== null && (volverAReceta || costo.trim() !== "");

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

  function cambiarPunto(valor: string) {
    setPuntoVentaId(valor);
    // Las sugerencias y el producto "existente" seleccionado eran de otro
    // punto — ya no aplican con el punto nuevo.
    setNombre("");
    setItemExistente(null);
  }

  function seleccionarExistente(itemNombre: string) {
    const item = items.find((i) => i.nombre === itemNombre);
    if (!item) return;
    setNombre(item.nombre);
    setItemExistente(item);
    setCategoria(item.categoria ?? "");
    setCosto(item.costo != null ? String(item.costo) : "");
    setPrecioVenta(item.precio_venta != null ? String(item.precio_venta) : "");
    setProveedorId(item.proveedor_id ?? "");
    setEsInsumo(item.es_insumo);
    setCantidad("");
    setMostrarSugerenciasNombre(false);
  }

  function reiniciarFormulario() {
    setNombre("");
    setItemExistente(null);
    setCategoria("");
    setMarca("");
    setUnidad("unidad");
    setCantidad("");
    setCosto("");
    setPrecioVenta("");
    setProveedorId("");
    setContenidoPorUnidad("");
    setSku("");
    setEsInsumo(false);
    setFotoFile(null);
    setErrorFoto(null);
  }

  async function subirFotoSiHay(itemId: string): Promise<string | null> {
    if (!fotoFile) return null;
    const archivo = await comprimirImagen(fotoFile);
    const formData = new FormData();
    formData.set("itemId", itemId);
    formData.set("foto", archivo);
    const resultado = await subirFotoProducto(formData);
    return resultado.error;
  }

  async function guardar() {
    setError(null);
    setMensajeExito(null);

    if (usaPuntos && !puntoVentaId && !itemExistente) {
      setError("Elige a qué punto de venta pertenece este producto.");
      return;
    }

    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      irAlCampo(nombreRef.current);
      return;
    }

    const cantidadNum = volverAReceta ? 0 : Number(cantidad);
    const costoNum = volverAReceta ? costoCalculado : Number(costo);
    const precioVentaNum = esInsumo ? null : Number(precioVenta);

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
    if (
      !esInsumo &&
      (precioVenta.trim() === "" || precioVentaNum === null || Number.isNaN(precioVentaNum) || precioVentaNum < 0)
    ) {
      setError("El precio de venta es obligatorio y debe ser un número mayor o igual a cero.");
      irAlCampo(document.getElementById("precioVenta"));
      return;
    }

    const nombreFinal = primeraMayuscula(nombre.trim());
    const categoriaFinal = primeraMayuscula(categoria.trim());

    if (!itemExistente) {
      const coincidencia = items.find((i) => sinTildes(i.nombre) === sinTildes(nombreFinal));
      if (coincidencia) {
        setError(
          `Ya existe un producto llamado "${coincidencia.nombre}" — selecciónalo de las sugerencias para agregarle cantidad, en vez de crear uno nuevo.`,
        );
        irAlCampo(nombreRef.current);
        return;
      }
    }

    setGuardando(true);
    try {
      if (itemExistente) {
        const resultado = await reabastecerProducto({
          itemId: itemExistente.id,
          categoria: categoriaFinal,
          cantidadAgregada: cantidadNum,
          costo: costoNum,
          precioVenta: itemExistente.es_insumo ? null : precioVentaNum,
          proveedorId: proveedorId || null,
        });
        if (resultado.error) {
          setError(resultado.error);
          return;
        }
        const errorFoto = await subirFotoSiHay(itemExistente.id);
        if (volverAReceta) {
          if (receta.length > 0) {
            const resultadoReceta = await guardarReceta({
              itemResultanteId: itemExistente.id,
              lineas: receta,
            });
            if (resultadoReceta.error) {
              setError(resultadoReceta.error);
              return;
            }
          }
          router.push(`/inventario/${itemExistente.id}`);
          return;
        }
        setMensajeExito(
          errorFoto
            ? `"${nombreFinal}" reabastecido correctamente, pero la foto no se pudo subir: ${errorFoto}`
            : `"${nombreFinal}" reabastecido correctamente.`,
        );
        reiniciarFormulario();
        router.refresh();
      } else {
        const atributos: Record<string, unknown> = {};
        if (volverAReceta && unidad !== "unidad" && contenidoPorUnidad.trim()) {
          atributos.contenido_por_unidad = Number(contenidoPorUnidad);
        }
        if (marca.trim()) {
          atributos.marca = primeraMayuscula(marca.trim());
        }

        const resultado = await crearProducto({
          nombre: nombreFinal,
          categoria: categoriaFinal,
          unidad,
          cantidad: cantidadNum,
          costo: costoNum,
          precioVenta: precioVentaNum,
          proveedorId: proveedorId || null,
          sku: sku.trim() || null,
          esInsumo,
          puntoVentaId: usaPuntos ? puntoVentaId || null : null,
          atributos: Object.keys(atributos).length > 0 ? atributos : undefined,
        });
        if (resultado.error || !resultado.id) {
          setError(resultado.error ?? "No se pudo guardar el producto.");
          return;
        }
        const errorFoto = await subirFotoSiHay(resultado.id);
        if (volverAReceta) {
          if (receta.length > 0) {
            const resultadoReceta = await guardarReceta({
              itemResultanteId: resultado.id,
              lineas: receta,
            });
            if (resultadoReceta.error) {
              setError(resultadoReceta.error);
              return;
            }
          }
          router.push(`/inventario/${resultado.id}`);
          return;
        }
        setMensajeExito(
          errorFoto
            ? `"${nombreFinal}" creado correctamente, pero la foto no se pudo subir: ${errorFoto}`
            : `"${nombreFinal}" creado correctamente.`,
        );
        reiniciarFormulario();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el producto.");
    } finally {
      setGuardando(false);
    }
  }

  const campoPunto = usaPuntos ? (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">Punto de venta *</label>
      <select
        value={puntoVentaId}
        onChange={(e) => cambiarPunto(e.target.value)}
        disabled={Boolean(itemExistente)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
      >
        <option value="">Elige un punto...</option>
        {puntosVenta.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-400">
        Cada punto tiene su propio catálogo y stock — este producto solo va a aparecer en el que
        elijas aquí.
      </p>
    </div>
  ) : null;

  const campoNombre = (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
      <input
        ref={nombreRef}
        value={nombre}
        onChange={(e) => actualizarNombre(e.target.value)}
        onFocus={() => setMostrarSugerenciasNombre(sugerenciasNombre.length > 0)}
        onBlur={() => setTimeout(() => setMostrarSugerenciasNombre(false), 150)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
      />
      {mostrarSugerenciasNombre && sugerenciasNombre.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-sm">
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
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
      />
      {mostrarSugerenciasCategoria && filtrar(categoriasExistentes, categoria).length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-sm">
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

  const campoMarca = itemExistente ? null : (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">Marca (opcional)</label>
      <input
        value={marca}
        onChange={(e) => setMarca(e.target.value)}
        placeholder="Ej. Fabuloso, Familia"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
      />
    </div>
  );

  const campoSku = itemExistente ? (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">SKU</label>
      <input
        value={itemExistente.sku ?? "Sin SKU"}
        disabled
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
      />
    </div>
  ) : (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">SKU / código (opcional)</label>
      <input
        value={sku}
        onChange={(e) => setSku(e.target.value)}
        placeholder={`Se genera automático si lo dejas vacío: ${proximoSkuSugerido}`}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
      />
    </div>
  );

  const campoEsInsumo = itemExistente ? null : (
    <label className="flex items-start gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={esInsumo}
        onChange={(e) => setEsInsumo(e.target.checked)}
        className="mt-0.5"
      />
      <span>
        Es material de receta (insumo) — no se vende individualmente, solo se usa para producir
        otros productos. No pide precio de venta.
      </span>
    </label>
  );

  const campoProveedor = (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">Proveedor (opcional)</label>
        <Link
          href="/inventario/proveedores/nuevo"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          + Agregar proveedor
        </Link>
      </div>
      <select
        value={proveedorId}
        onChange={(e) => setProveedorId(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
      >
        <option value="">A quién se le compra este producto...</option>
        {proveedores.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>
      {proveedores.length === 0 && (
        <p className="mt-1 text-xs text-gray-400">
          Todavía no tienes proveedores — agrega uno con el enlace de arriba.
        </p>
      )}
    </div>
  );

  const campoFoto = (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">Foto (opcional)</label>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          // La validación real de tamaño pasa después de comprimir, al
          // guardar — la mayoría de las fotos de celular pesan varios MB de
          // entrada pero terminan muy por debajo del límite ya comprimidas.
          if (file && file.size > TAMANO_MAXIMO_ORIGINAL_BYTES) {
            setErrorFoto("El archivo es demasiado grande — elige una foto más liviana.");
            setFotoFile(null);
            e.target.value = "";
            return;
          }
          setErrorFoto(null);
          setFotoFile(file);
        }}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-sm"
      />
      {errorFoto && <p className="mt-1 text-xs text-red-600">{errorFoto}</p>}
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
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
        />
      ) : (
        <select
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
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
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-400">
          ¿Cuánto trae cada unidad? Ej. si cada una son 500{" "}
          {UNIDADES.find((u) => u.valor === unidad)?.etiqueta}, escribe 500. Queda guardado como
          referencia.
        </p>
      </div>
    ) : null;

  const campoCantidad = volverAReceta ? (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
      Este producto arranca en cero. Cuando produzcas un lote, entra a su ficha y usa
      &ldquo;Ajustar cantidad&rdquo; para declarar cuántas unidades quedaron listas — eso
      descuenta automáticamente los insumos que usaste.
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
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
      />
    </div>
  );

  const campoCosto = volverAReceta ? (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        Costo por unidad (calculado según la receta)
      </label>
      <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
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

  const campoPrecioVenta = esInsumo ? (
    <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
      Como es material de receta, no lleva precio de venta — solo se usa como insumo.
    </p>
  ) : (
    <div>
      <CampoMoneda
        id="precioVenta"
        label={volverAReceta ? "Precio de venta estimado" : "Precio de venta"}
        required
        value={precioVenta}
        onChange={setPrecioVenta}
      />
      {mostrarMargen && (
        <p className={`mt-1 text-xs ${gananciaUnitaria >= 0 ? "text-green-600" : "text-red-600"}`}>
          Ganancia: {gananciaUnitaria.toLocaleString("es-CO", { style: "currency", currency: "COP" })}{" "}
          por unidad ({margenPorcentaje!.toFixed(1)}% de margen)
        </p>
      )}
    </div>
  );

  const panelReceta = (
    <div className="rounded-xl border border-gray-200 p-4">
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
        <p className="mb-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
          Primero elige de qué insumos se compone este producto — así calculamos su costo y
          puedes poner un precio de venta con eso en mente. Al final le pones nombre y, si
          hace falta, unidad.
        </p>
      )}

      {mensajeExito && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {mensajeExito} Puedes seguir agregando otro producto.
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {volverAReceta ? (
        <div className="max-w-2xl space-y-6">
          {usaPuntos && <div className="max-w-md">{campoPunto}</div>}
          {panelReceta}
          <div className="max-w-md space-y-4">
            {campoCosto}
            {campoPrecioVenta}
            {campoNombre}
            {campoCategoria}
            {campoMarca}
            {campoProveedor}
            {campoUnidad}
            {campoContenido}
            {campoCantidad}
            {campoFoto}
            <p className="text-xs text-gray-400">* Campos obligatorios</p>
          </div>
        </div>
      ) : (
        <div className="max-w-md space-y-4">
          {campoPunto}
          {campoNombre}
          {campoSku}
          {campoCategoria}
          {campoMarca}
          {campoProveedor}
          {campoUnidad}
          {campoCantidad}
          {campoCosto}
          {campoEsInsumo}
          {campoPrecioVenta}
          {campoFoto}
          <p className="text-xs text-gray-400">* Campos obligatorios</p>
        </div>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Guardar producto"}
      </button>
    </div>
  );
}
