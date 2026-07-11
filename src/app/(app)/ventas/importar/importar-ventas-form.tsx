"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parsearCsv } from "@/lib/csv";
import { sinTildes } from "@/lib/texto";
import { DescargarCsv } from "@/components/descargar-csv";
import { importarVentasHistoricas, type FilaVentaHistorica } from "./actions";

const COLUMNAS_ESPERADAS = [
  "fecha",
  "cliente_nombre",
  "cliente_telefono",
  "cliente_email",
  "producto",
  "cantidad",
  "precio_unitario",
  "costo_unitario",
  "metodo_pago",
];

function normalizarEncabezado(valor: string) {
  return sinTildes(valor.trim());
}

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

export function ImportarVentasForm({ nombresProductos }: { nombresProductos: string[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [filas, setFilas] = useState<FilaVentaHistorica[]>([]);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<number | null>(null);

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
      const faltantes = ["fecha", "producto", "cantidad", "precio_unitario"].filter(
        (c) => !encabezado.includes(c),
      );
      if (faltantes.length > 0) {
        setErrorArchivo(
          `Faltan columnas en el archivo: ${faltantes.join(", ")}. Usa la plantilla tal cual, sin cambiar los títulos.`,
        );
        setFilas([]);
        return;
      }

      const indice = Object.fromEntries(COLUMNAS_ESPERADAS.map((c) => [c, encabezado.indexOf(c)]));

      const filasParseadas: FilaVentaHistorica[] = filasCrudas
        .slice(1)
        .map((fila) => {
          const fechaCruda = (fila[indice.fecha] ?? "").trim();
          const costoCrudo = (fila[indice.costo_unitario] ?? "").trim();
          return {
            fecha: fechaCruda && !fechaCruda.includes("T") ? `${fechaCruda}T12:00:00` : fechaCruda,
            clienteNombre: (fila[indice.cliente_nombre] ?? "").trim(),
            clienteTelefono: (fila[indice.cliente_telefono] ?? "").trim(),
            clienteEmail: (fila[indice.cliente_email] ?? "").trim(),
            producto: (fila[indice.producto] ?? "").trim(),
            cantidad: Number(fila[indice.cantidad]) || 0,
            precioUnitario: Number(fila[indice.precio_unitario]) || 0,
            costoUnitario: costoCrudo ? Number(costoCrudo) || null : null,
            metodoPago: (fila[indice.metodo_pago] ?? "").trim(),
          };
        })
        .filter((fila) => fila.fecha !== "" && fila.cantidad > 0);

      if (filasParseadas.length === 0) {
        setErrorArchivo("No se encontró ninguna fila válida (revisa fecha y cantidad).");
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
      const resultado = await importarVentasHistoricas(filas);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setResultado(resultado.importadas ?? 0);
      setFilas([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron importar las ventas.");
    } finally {
      setCargando(false);
    }
  }

  const productosNoEncontrados = filas.filter(
    (f) => f.producto && !nombresProductos.includes(f.producto),
  ).length;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Importar ventas</h1>
        <DescargarCsv
          filas={[
            {
              fecha: "2026-06-15",
              cliente_nombre: "María Pérez",
              cliente_telefono: "3001234567",
              cliente_email: "maria@correo.com",
              producto: "Jabón líquido para platos 500ml",
              cantidad: 3,
              precio_unitario: 6000,
              costo_unitario: 3500,
              metodo_pago: "efectivo",
            },
          ]}
          columnas={[
            { clave: "fecha", titulo: "fecha" },
            { clave: "cliente_nombre", titulo: "cliente_nombre" },
            { clave: "cliente_telefono", titulo: "cliente_telefono" },
            { clave: "cliente_email", titulo: "cliente_email" },
            { clave: "producto", titulo: "producto" },
            { clave: "cantidad", titulo: "cantidad" },
            { clave: "precio_unitario", titulo: "precio_unitario" },
            { clave: "costo_unitario", titulo: "costo_unitario" },
            { clave: "metodo_pago", titulo: "metodo_pago" },
          ]}
          nombreArchivo="plantilla-ventas.csv"
        />
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <p className="mb-2 font-medium text-gray-900">Para qué sirve esto</p>
        <p className="mb-1">
          Para subir ventas que ya pasaron (de otra herramienta, o de un cuaderno/Excel) sin
          perder el historial. Estas ventas <strong>nunca descuentan inventario</strong> ni
          afectan tu stock actual — ya pasaron de verdad, descontarlas de nuevo duplicaría el
          efecto.
        </p>
        <p className="mb-1">
          1. Descarga la plantilla, llénala. La columna <strong>producto</strong> debe llamarse
          exactamente igual que en tu catálogo de Inventario (cliente y costo son opcionales).
        </p>
        <p>2. Súbela abajo — vas a ver una vista previa antes de confirmar nada.</p>
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
            Vista previa ({filas.length} venta{filas.length === 1 ? "" : "s"})
          </p>
          {productosNoEncontrados > 0 && (
            <p className="mb-2 text-xs text-amber-600">
              {productosNoEncontrados} fila(s) tienen un producto que no coincide con ninguno de
              tu catálogo — esa venta se guarda igual, solo queda sin ligar a inventario (no
              contará en utilidad por producto).
            </p>
          )}
          <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs text-gray-400">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2">Cantidad</th>
                  <th className="px-3 py-2">Precio</th>
                  <th className="px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filas.map((fila, i) => {
                  const productoDesconocido =
                    fila.producto && !nombresProductos.includes(fila.producto);
                  return (
                    <tr key={i}>
                      <td className="px-3 py-2 text-gray-900">{fila.fecha.slice(0, 10)}</td>
                      <td className="px-3 py-2 text-gray-500">{fila.clienteNombre || "—"}</td>
                      <td
                        className={`px-3 py-2 ${productoDesconocido ? "font-medium text-amber-600" : "text-gray-500"}`}
                      >
                        {fila.producto || "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{fila.cantidad}</td>
                      <td className="px-3 py-2 text-gray-500">{formatoMoneda(fila.precioUnitario)}</td>
                      <td className="px-3 py-2 text-gray-900">
                        {formatoMoneda(fila.cantidad * fila.precioUnitario)}
                      </td>
                    </tr>
                  );
                })}
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
              {cargando ? "Importando..." : `Confirmar carga de ${filas.length} venta(s)`}
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

      {resultado !== null && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Listo: {resultado} venta{resultado === 1 ? "" : "s"} importada{resultado === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  );
}
