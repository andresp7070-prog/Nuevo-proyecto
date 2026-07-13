"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parsearCsv } from "@/lib/csv";
import { sinTildes } from "@/lib/texto";
import { normalizarUnidad, etiquetaUnidad } from "@/lib/unidades";
import { DescargarCsv } from "@/components/descargar-csv";
import { cargarInventarioInicial, type FilaImportacion } from "./actions";

const COLUMNAS_ESPERADAS = [
  "nombre",
  "categoria",
  "unidad",
  "cantidad",
  "costo",
  "precio_venta",
  "es_insumo",
];

const VALORES_SI = ["si", "s", "sí", "yes", "y", "x", "1", "true"];
const VALORES_NO = ["no", "n", "0", "false"];

type FilaPreview = FilaImportacion & {
  unidadOriginal: string;
  unidadReconocida: boolean;
  esInsumoOriginal: string;
  esInsumoReconocido: boolean;
  errores: string[];
};

function normalizarEncabezado(valor: string) {
  return sinTildes(valor.trim());
}

// "es_insumo" viene como texto libre (si/no) en el CSV — reconoce las formas
// comunes de escribirlo; si no reconoce nada, asume que no es insumo pero lo
// marca como error para que la persona lo revise en la vista previa.
function normalizarSiNo(textoLibre: string): { valor: boolean; reconocida: boolean } {
  const limpio = sinTildes(textoLibre.trim());
  if (!limpio) return { valor: false, reconocida: true };
  if (VALORES_SI.includes(limpio)) return { valor: true, reconocida: true };
  if (VALORES_NO.includes(limpio)) return { valor: false, reconocida: true };
  return { valor: false, reconocida: false };
}

export function ImportarInventarioForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [filas, setFilas] = useState<FilaPreview[]>([]);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ creados: number; actualizados: number } | null>(
    null,
  );

  function limpiar() {
    setFilas([]);
    setNombreArchivo(null);
    setErrorArchivo(null);
    setResultado(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function procesarArchivo(file: File) {
    setResultado(null);
    setError(null);
    setNombreArchivo(file.name);

    const lector = new FileReader();
    lector.onload = () => {
      const texto = String(lector.result ?? "");
      const filasCrudas = parsearCsv(texto);

      if (filasCrudas.length < 2) {
        setErrorArchivo("El archivo no tiene filas de datos, solo encabezado (o está vacío).");
        setFilas([]);
        return;
      }

      const encabezado = filasCrudas[0].map(normalizarEncabezado);
      const faltantes = COLUMNAS_ESPERADAS.filter((c) => !encabezado.includes(c));
      if (faltantes.length > 0) {
        setErrorArchivo(
          `Faltan columnas en el archivo: ${faltantes.join(", ")}. Usa la plantilla tal cual, sin cambiar los títulos.`,
        );
        setFilas([]);
        return;
      }

      const indice = Object.fromEntries(COLUMNAS_ESPERADAS.map((c) => [c, encabezado.indexOf(c)]));

      const filasParseadas: FilaPreview[] = filasCrudas.slice(1).map((fila) => {
        const nombre = (fila[indice.nombre] ?? "").trim();
        const unidadOriginal = (fila[indice.unidad] ?? "").trim();
        const { valor: unidad, reconocida: unidadReconocida } = normalizarUnidad(unidadOriginal);

        const cantidadCruda = (fila[indice.cantidad] ?? "").trim();
        const costoCrudo = (fila[indice.costo] ?? "").trim();
        const precioCrudo = (fila[indice.precio_venta] ?? "").trim();
        const esInsumoOriginal = (fila[indice.es_insumo] ?? "").trim();
        const { valor: esInsumo, reconocida: esInsumoReconocido } = normalizarSiNo(esInsumoOriginal);

        const errores: string[] = [];
        if (!nombre) errores.push("Falta el nombre del producto");
        if (unidadOriginal && !unidadReconocida) {
          errores.push(`Unidad "${unidadOriginal}" no reconocida, se guarda como Unidades`);
        }
        if (cantidadCruda && Number.isNaN(Number(cantidadCruda))) {
          errores.push(`Cantidad "${cantidadCruda}" no es un número válido, se guarda como 0`);
        }
        if (costoCrudo && Number.isNaN(Number(costoCrudo))) {
          errores.push(`Costo "${costoCrudo}" no es un número válido, se guarda como 0`);
        }
        if (precioCrudo && Number.isNaN(Number(precioCrudo))) {
          errores.push(`Precio de venta "${precioCrudo}" no es un número válido, se guarda como 0`);
        }
        if (!esInsumoReconocido) {
          errores.push(`"es_insumo" con valor "${esInsumoOriginal}" no reconocido, se guarda como No`);
        }
        if (esInsumo && precioCrudo && Number(precioCrudo) > 0) {
          errores.push(`Tiene precio de venta pero está marcado como insumo — se guarda sin precio de venta`);
        }

        return {
          nombre,
          categoria: (fila[indice.categoria] ?? "").trim(),
          unidad,
          unidadOriginal,
          unidadReconocida,
          cantidad: Number(cantidadCruda) || 0,
          costo: Number(costoCrudo) || 0,
          precioVenta: Number(precioCrudo) || 0,
          esInsumo,
          esInsumoOriginal,
          esInsumoReconocido,
          errores,
        };
      });

      if (filasParseadas.length === 0) {
        setErrorArchivo("El archivo no tiene filas de datos.");
        setFilas([]);
        return;
      }

      setErrorArchivo(null);
      setFilas(filasParseadas);
    };
    lector.onerror = () => setErrorArchivo("No se pudo leer el archivo.");
    lector.readAsText(file, "utf-8");
  }

  async function confirmar() {
    setError(null);
    setCargando(true);
    try {
      const filasValidas = filas.filter((fila) => fila.nombre !== "");
      const resultado = await cargarInventarioInicial(filasValidas);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setResultado({ creados: resultado.creados ?? 0, actualizados: resultado.actualizados ?? 0 });
      setFilas([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar el inventario.");
    } finally {
      setCargando(false);
    }
  }

  const filasConError = filas.filter((fila) => fila.errores.length > 0);
  const filasValidas = filas.filter((fila) => fila.nombre !== "");

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Importar inventario</h1>
        <DescargarCsv
          filas={[
            {
              nombre: "Jabón líquido para platos 500ml",
              categoria: "Cocina",
              unidad: "unidad",
              cantidad: 50,
              costo: 3500,
              precio_venta: 6000,
              es_insumo: "no",
            },
          ]}
          columnas={[
            { clave: "nombre", titulo: "nombre" },
            { clave: "categoria", titulo: "categoria" },
            { clave: "unidad", titulo: "unidad" },
            { clave: "cantidad", titulo: "cantidad" },
            { clave: "costo", titulo: "costo" },
            { clave: "precio_venta", titulo: "precio_venta" },
            { clave: "es_insumo", titulo: "es_insumo" },
          ]}
          nombreArchivo="plantilla-inventario.csv"
        />
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <p className="mb-2 font-medium text-gray-900">Cómo funciona</p>
        <p className="mb-1">
          1. Descarga la plantilla de arriba y llénala con tu catálogo actual: nombre, categoría
          (opcional), unidad, cantidad que hay hoy, costo y precio de venta.
        </p>
        <p className="mb-1">
          2. Súbela aquí abajo — vas a ver una vista previa antes de confirmar nada.
        </p>
        <p className="mb-1">
          3. Si un producto ya existe (mismo nombre), le suma la cantidad y actualiza costo y
          precio; si no existe, lo crea.
        </p>
        <p className="mb-1">
          En &quot;unidad&quot; puedes escribir como te salga natural — <em>kg, kilo, litro, lt, ml, libra,
          galón, unidad</em> — el sistema reconoce las formas comunes (con o sin tilde, mayúscula
          o minúscula). Si algo no lo reconoce, te avisa en la vista previa antes de confirmar.
        </p>
        <p>
          &quot;es_insumo&quot; es <em>si</em> o <em>no</em>: los insumos son materiales de receta que no
          se venden solos (no tienen precio de venta) — si marcas &quot;si&quot; y además le pones
          precio de venta, la vista previa lo marca como error porque no tiene lógica.
        </p>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">Archivo CSV</label>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) procesarArchivo(file);
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-sm"
        />
        {nombreArchivo && !errorArchivo && (
          <p className="mt-1 text-xs text-gray-400">{nombreArchivo}</p>
        )}
        {errorArchivo && <p className="mt-1 text-xs text-red-600">{errorArchivo}</p>}
      </div>

      {filas.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-900">
              Vista previa ({filas.length} fila{filas.length === 1 ? "" : "s"})
            </p>
            {filasConError.length > 0 && (
              <DescargarCsv
                etiqueta="Descargar archivo con errores"
                filas={filas.map((fila) => ({
                  nombre: fila.nombre,
                  categoria: fila.categoria,
                  unidad: fila.unidadOriginal || fila.unidad,
                  cantidad: fila.cantidad,
                  costo: fila.costo,
                  precio_venta: fila.precioVenta,
                  es_insumo: fila.esInsumoOriginal || (fila.esInsumo ? "si" : "no"),
                  error: fila.errores.join(" / "),
                }))}
                columnas={[
                  { clave: "nombre", titulo: "nombre" },
                  { clave: "categoria", titulo: "categoria" },
                  { clave: "unidad", titulo: "unidad" },
                  { clave: "cantidad", titulo: "cantidad" },
                  { clave: "costo", titulo: "costo" },
                  { clave: "precio_venta", titulo: "precio_venta" },
                  { clave: "es_insumo", titulo: "es_insumo" },
                  { clave: "error", titulo: "error" },
                ]}
                nombreArchivo="inventario-con-errores.csv"
              />
            )}
          </div>
          {filasConError.length > 0 && (
            <p className="mb-2 text-xs text-amber-600">
              {filasConError.length} fila{filasConError.length === 1 ? "" : "s"} tienen algún
              problema (columna &quot;Error&quot; abajo). Descarga el archivo de arriba para verlos todos
              con el detalle, corrígelos en tu CSV original y vuelve a subirlo. Las filas sin
              nombre de producto no se importan; el resto sí se importa, usando el valor por
              defecto que se indica en cada caso.
            </p>
          )}
          <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs text-gray-400">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Categoría</th>
                  <th className="px-3 py-2">Unidad</th>
                  <th className="px-3 py-2">Cantidad</th>
                  <th className="px-3 py-2">Costo</th>
                  <th className="px-3 py-2">Precio venta</th>
                  <th className="px-3 py-2">Insumo</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filas.map((fila, i) => (
                  <tr key={i} className={fila.errores.length > 0 ? "bg-amber-50" : undefined}>
                    <td className="px-3 py-2 text-gray-900">{fila.nombre || "—"}</td>
                    <td className="px-3 py-2 text-gray-500">{fila.categoria || "—"}</td>
                    <td className="px-3 py-2 text-gray-500">{etiquetaUnidad(fila.unidad)}</td>
                    <td className="px-3 py-2 text-gray-500">{fila.cantidad}</td>
                    <td className="px-3 py-2 text-gray-500">{fila.costo}</td>
                    <td className="px-3 py-2 text-gray-500">
                      {fila.esInsumo ? "—" : fila.precioVenta}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{fila.esInsumo ? "Sí" : "No"}</td>
                    <td className="px-3 py-2 text-amber-600">
                      {fila.errores.length > 0 ? fila.errores.join(" / ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={confirmar}
              disabled={cargando || filasValidas.length === 0}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {cargando ? "Importando..." : `Confirmar carga de ${filasValidas.length} producto(s)`}
            </button>
            <button
              type="button"
              onClick={limpiar}
              disabled={cargando}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {resultado && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Listo: {resultado.creados} producto{resultado.creados === 1 ? "" : "s"} nuevo
          {resultado.creados === 1 ? "" : "s"} creado{resultado.creados === 1 ? "" : "s"}
          {resultado.actualizados > 0
            ? `, ${resultado.actualizados} existente${resultado.actualizados === 1 ? "" : "s"} actualizado${resultado.actualizados === 1 ? "" : "s"}.`
            : "."}
        </p>
      )}
    </div>
  );
}
