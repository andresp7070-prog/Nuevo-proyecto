"use client";

import { useState } from "react";

export type Barra = {
  etiqueta: string;
  valor: number;
  tono?: "default" | "positivo" | "negativo" | "alerta";
};

const COLOR: Record<NonNullable<Barra["tono"]>, string> = {
  default: "#2a78d6",
  positivo: "#0ca30c",
  negativo: "#d03b3b",
  alerta: "#d03b3b",
};

function tonoAutomatico(valor: number): NonNullable<Barra["tono"]> {
  return valor < 0 ? "negativo" : "default";
}

export function GraficoBarras({
  datos,
  formatoValor,
  alto = 160,
}: {
  datos: Barra[];
  formatoValor: (v: number) => string;
  alto?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (datos.length === 0) return null;

  const anchoBarra = 48;
  const espacio = 16;
  const ancho = datos.length * (anchoBarra + espacio) + espacio;
  const maxAbs = Math.max(1, ...datos.map((d) => Math.abs(d.valor)));
  const hayNegativos = datos.some((d) => d.valor < 0);
  const baseY = hayNegativos ? alto / 2 : alto - 8;
  const escala = (hayNegativos ? alto / 2 - 20 : alto - 8 - 20) / maxAbs;

  return (
    <div className="overflow-x-auto">
      <svg
        width={ancho}
        height={alto + 24}
        role="img"
        aria-label="Gráfico de barras"
        className="min-w-full"
      >
        <line x1={0} y1={baseY} x2={ancho} y2={baseY} stroke="#c3c2b7" strokeWidth={1} />
        {datos.map((d, i) => {
          const x = espacio + i * (anchoBarra + espacio);
          const h = Math.max(Math.abs(d.valor) * escala, 1);
          const y = d.valor >= 0 ? baseY - h : baseY;
          const color = COLOR[d.tono ?? tonoAutomatico(d.valor)];
          const activo = hover === i;
          return (
            <g
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="cursor-default"
            >
              <rect
                x={x}
                y={y}
                width={anchoBarra}
                height={h}
                rx={4}
                fill={color}
                opacity={activo ? 1 : 0.85}
              />
              <text
                x={x + anchoBarra / 2}
                y={d.valor >= 0 ? y - 6 : y + h + 14}
                textAnchor="middle"
                fontSize={11}
                fill="#52514e"
              >
                {formatoValor(d.valor)}
              </text>
              <text
                x={x + anchoBarra / 2}
                y={alto + 18}
                textAnchor="middle"
                fontSize={11}
                fill="#898781"
              >
                {d.etiqueta}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function GraficoBarrasHorizontal({
  datos,
  formatoValor,
}: {
  datos: Barra[];
  formatoValor: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (datos.length === 0) return null;

  const maxAbs = Math.max(1, ...datos.map((d) => Math.abs(d.valor)));

  return (
    <div className="space-y-1.5">
      {datos.map((d, i) => {
        const ancho = (Math.abs(d.valor) / maxAbs) * 100;
        const color = COLOR[d.tono ?? tonoAutomatico(d.valor)];
        return (
          <div
            key={i}
            className="flex items-center gap-2 text-xs"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="w-36 shrink-0 truncate text-gray-600" title={d.etiqueta}>
              {d.etiqueta}
            </span>
            <div className="h-4 flex-1 rounded bg-gray-100">
              <div
                className="h-4 rounded transition-opacity"
                style={{
                  width: `${Math.max(ancho, 2)}%`,
                  backgroundColor: color,
                  opacity: hover === i ? 1 : 0.85,
                }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-gray-700">{formatoValor(d.valor)}</span>
          </div>
        );
      })}
    </div>
  );
}
