"use client";

import { useState } from "react";

// Input con formato de pesos ($ + separador de miles) sin etiqueta propia —
// para usar suelto (ej. una celda de tabla) o como base de CampoMoneda.
export function EntradaMoneda({
  id,
  value,
  onChange,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [enfocado, setEnfocado] = useState(false);

  const mostrado =
    !enfocado && value && !Number.isNaN(Number(value))
      ? Number(value).toLocaleString("es-CO")
      : value;

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
        $
      </span>
      <input
        id={id}
        value={mostrado}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        inputMode="numeric"
        className={
          className ??
          "w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm focus:border-gray-500 focus:outline-none"
        }
      />
    </div>
  );
}

export function CampoMoneda({
  value,
  onChange,
  label,
  required,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
  id?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required ? " *" : ""}
      </label>
      <EntradaMoneda id={id} value={value} onChange={onChange} />
    </div>
  );
}
