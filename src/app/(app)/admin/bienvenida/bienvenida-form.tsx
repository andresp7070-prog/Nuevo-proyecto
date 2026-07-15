"use client";

import { useState } from "react";
import { enviarBienvenida } from "./actions";

export function BienvenidaForm() {
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  async function enviar() {
    setError(null);
    setExito(false);

    if (!nombreEmpresa.trim() || !correo.trim() || !contrasena.trim()) {
      setError("Completa los tres campos.");
      return;
    }

    setEnviando(true);
    try {
      const resultado = await enviarBienvenida({ nombreEmpresa, correo, contrasena });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setExito(true);
      setNombreEmpresa("");
      setCorreo("");
      setContrasena("");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-1 text-lg font-semibold text-gray-900">Enviar correo de bienvenida</h1>
      <p className="mb-6 text-sm text-gray-500">
        Para usar después de crear el usuario del cliente en Supabase (auth + perfil + empresa).
        Esto solo envía el correo con sus datos de acceso, no crea nada en la base de datos.
      </p>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre de la empresa</label>
          <input
            value={nombreEmpresa}
            onChange={(e) => setNombreEmpresa(e.target.value)}
            placeholder="Ej. Distribuidora de aseo JM"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Correo del cliente</label>
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="cliente@correo.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Contraseña temporal</label>
          <input
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            placeholder="La misma que pusiste en Supabase"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {exito && (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Correo enviado correctamente.
        </p>
      )}

      <button
        type="button"
        onClick={enviar}
        disabled={enviando}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {enviando ? "Enviando..." : "Enviar bienvenida"}
      </button>
    </div>
  );
}
