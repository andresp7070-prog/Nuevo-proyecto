"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parsearCsv } from "@/lib/csv";
import { sinTildes } from "@/lib/texto";
import { DescargarCsv } from "@/components/descargar-csv";
import { cargarInventarioInicial, type FilaImportacion } from "./actions";

const COLUMNAS_ESPERADAS = ["nombre", "categoria", "unidad", "cantidad", "costo", "precio_venta"];

function normalizarEncabezado(valor: string) {
  return sinTildes(valor.trim());
}

export function ImportarInventarioForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [filas, setFilas] = useState<FilaImportacion[]>([]);
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

      const filasParseadas: FilaImportacion[] = filasCrudas
        .slice(1)
        .map((fila) => ({
          nombre: (fila[indice.nombre] ?? "").trim(),
          categoria: (fila[indice.categoria] ?? "").trim(),
          unidad: (fila[indice.unidad] ?? "").trim(),
          cantidad: Number(fila[indice.cantidad]) || 0,
          costo: Number(fila[indice.costo]) || 0,
          precioVenta: Number(fila[indice.precio_venta]) || 0,
        }))
        .filter((fila) => fila.nombre !== "");

      if (filasParseadas.length === 0) {
        setErrorArchivo("No se encontró ninguna fila con nombre de producto.");
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
      const resultado = await cargarInventarioInicial(filas);
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
            },
          ]}
          columnas={[
            { clave: "nombre", titulo: "nombre" },
            { clave: "categoria", titulo: "categoria" },
            { clave: "unidad", titulo: "unidad" },
            { clave: "cantidad", titulo: "cantidad" },
            { clave: "costo", titulo: "costo" },
            { clave: "precio_venta", titulo: "precio_venta" },
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
        <p>
          3. Si un producto ya existe (mismo nombre), le suma la cantidad y actualiza costo y
          precio; si no existe, lo crea.
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
          <p className="mb-2 text-sm font-medium text-gray-900">
            Vista previa ({filas.length} producto{filas.length === 1 ? "" : "s"})
          </p>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filas.map((fila, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-gray-900">{fila.nombre}</td>
                    <td className="px-3 py-2 text-gray-500">{fila.categoria || "—"}</td>
                    <td className="px-3 py-2 text-gray-500">{fila.unidad || "unidad"}</td>
                    <td className="px-3 py-2 text-gray-500">{fila.cantidad}</td>
                    <td className="px-3 py-2 text-gray-500">{fila.costo}</td>
                    <td className="px-3 py-2 text-gray-500">{fila.precioVenta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={confirmar}
              disabled={cargando}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {cargando ? "Importando..." : `Confirmar carga de ${filas.length} producto(s)`}
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
