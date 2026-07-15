"use client";

import { generarCsv, type ColumnaCsv } from "@/lib/csv";

export function DescargarCsv({
  filas,
  columnas,
  nombreArchivo,
  etiqueta = "Descargar CSV",
}: {
  filas: Record<string, string | number | null>[];
  columnas: ColumnaCsv[];
  nombreArchivo: string;
  etiqueta?: string;
}) {
  function descargar() {
    const csv = generarCsv(filas, columnas);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={descargar}
      disabled={filas.length === 0}
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {etiqueta}
    </button>
  );
}
