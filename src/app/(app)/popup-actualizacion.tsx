"use client";

import { useState } from "react";
import { marcarActualizacionVista } from "./actualizaciones-actions";

type Actualizacion = { id: string; titulo: string; contenido: string };

export function PopupActualizacion({ actualizacion }: { actualizacion: Actualizacion }) {
  const [visible, setVisible] = useState(true);
  const [cerrando, setCerrando] = useState(false);

  if (!visible) return null;

  async function cerrar() {
    setCerrando(true);
    await marcarActualizacionVista(actualizacion.id);
    setVisible(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-accent">Novedades</p>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{actualizacion.titulo}</h2>
        <p className="mb-6 whitespace-pre-line text-sm text-gray-600">{actualizacion.contenido}</p>
        <button
          type="button"
          onClick={cerrar}
          disabled={cerrando}
          className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
