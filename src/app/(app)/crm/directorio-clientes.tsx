"use client";

import { useState } from "react";
import Link from "next/link";
import { sinTildes } from "@/lib/texto";
import { DescargarCsv } from "@/components/descargar-csv";

type Contacto = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  etapa_id: string | null;
  empresa_cliente: string | null;
};

type Etapa = { id: string; nombre: string; orden: number };

export function DirectorioClientes({
  contactos,
  etapas,
  mostrarConfigEtapas,
}: {
  contactos: Contacto[];
  etapas: Etapa[];
  mostrarConfigEtapas: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [etapaFiltro, setEtapaFiltro] = useState("todas");

  const nombrePorEtapa = new Map(etapas.map((etapa) => [etapa.id, etapa.nombre]));

  const filtrados = contactos.filter((contacto) => {
    const coincideEtapa = etapaFiltro === "todas" || contacto.etapa_id === etapaFiltro;
    const q = sinTildes(busqueda.trim());
    const coincideTexto =
      !q ||
      sinTildes(contacto.nombre).includes(q) ||
      sinTildes(contacto.empresa_cliente ?? "").includes(q);
    return coincideEtapa && coincideTexto;
  });

  const filasCsv = filtrados.map((contacto) => ({
    nombre: contacto.nombre,
    telefono: contacto.telefono ?? "",
    email: contacto.email ?? "",
    etapa: (contacto.etapa_id && nombrePorEtapa.get(contacto.etapa_id)) ?? "—",
    empresa: contacto.empresa_cliente ?? "",
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">CRM</h1>
        <div className="flex gap-2">
          <DescargarCsv
            filas={filasCsv}
            columnas={[
              { clave: "nombre", titulo: "Nombre" },
              { clave: "telefono", titulo: "Teléfono" },
              { clave: "email", titulo: "Correo" },
              { clave: "etapa", titulo: "Etapa" },
              { clave: "empresa", titulo: "Empresa" },
            ]}
            nombreArchivo="clientes.csv"
          />
          {mostrarConfigEtapas && (
            <Link
              href="/crm/etapas"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Configurar etapas
            </Link>
          )}
          <Link
            href="/crm/nuevo"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Agregar cliente
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o empresa"
          className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <select
          value={etapaFiltro}
          onChange={(e) => setEtapaFiltro(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        >
          <option value="todas">Todas</option>
          {etapas.map((etapa) => (
            <option key={etapa.id} value={etapa.id}>
              {etapa.nombre}
            </option>
          ))}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-gray-400">No hay clientes que coincidan.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
          {filtrados.map((contacto) => (
            <li key={contacto.id}>
              <Link
                href={`/crm/${contacto.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{contacto.nombre}</p>
                  <p className="text-xs text-gray-400">
                    {contacto.empresa_cliente ? `${contacto.empresa_cliente} · ` : ""}
                    {contacto.telefono ?? "Sin teléfono"}
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                  {(contacto.etapa_id && nombrePorEtapa.get(contacto.etapa_id)) ?? "—"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
