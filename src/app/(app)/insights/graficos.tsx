"use client";

import { useEffect, useRef, useState } from "react";

// Mide el ancho real disponible del contenedor (vía ResizeObserver) para que
// las gráficas de barras puedan estirar el espacio entre barras y llenar el
// espacio asignado, sin engordar el grosor de cada barra — ese se mantiene
// fijo, solo crece el aire entre una y otra.
function useAnchoContenedor() {
  const ref = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entradas) => setAncho(entradas[0].contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, ancho] as const;
}

export type Barra = {
  etiqueta: string;
  valor: number;
  textoValor: string;
  tono?: "default" | "positivo" | "negativo" | "alerta";
  // Si viene, la barra se puede hacer clic y navega ahí — así se arma un
  // filtro (por mes, por día de la semana, por producto...) haciendo clic
  // directo en la gráfica, sumándose a cualquier otro filtro ya activo.
  enlace?: string;
};

const COLOR: Record<NonNullable<Barra["tono"]>, string> = {
  default: "#1a1b33",
  positivo: "#9c6900",
  negativo: "#7f2525",
  alerta: "#7f2525",
};

function tonoAutomatico(valor: number): NonNullable<Barra["tono"]> {
  return valor < 0 ? "negativo" : "default";
}

export function GraficoBarras({
  datos,
  alto = 160,
}: {
  datos: Barra[];
  alto?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [contenedorRef, anchoDisponible] = useAnchoContenedor();

  if (datos.length === 0) return null;

  const anchoBarra = 48;
  const espacioMinimo = 16;
  // El espacio entre barras crece para llenar el ancho disponible, pero solo
  // hasta este tope — con pocos datos (ej. 2-3 meses) las barras quedan
  // juntas en vez de perdidas en un espacio vacío; a medida que hay más
  // datos, se van distribuyendo hasta llenar el espacio de verdad.
  const espacioMaximo = 40;
  // Aire fijo a los lados — sin esto, la etiqueta de la primera o última
  // barra (ej. "$678,8 k") puede sobresalir del ancho del SVG y quedar
  // cortada en vez de solo apretada.
  const margen = 28;
  const anchoNatural = datos.length * (anchoBarra + espacioMinimo) + espacioMinimo;
  const anchoMaximo = datos.length * (anchoBarra + espacioMaximo) + espacioMaximo;
  const interior = Math.min(Math.max(anchoNatural, anchoDisponible - margen * 2), anchoMaximo);
  const espacio = (interior - datos.length * anchoBarra) / (datos.length + 1);
  const ancho = interior + margen * 2;
  const maxAbs = Math.max(1, ...datos.map((d) => Math.abs(d.valor)));
  const hayNegativos = datos.some((d) => d.valor < 0);
  const baseY = hayNegativos ? alto / 2 : alto - 8;
  const escala = (hayNegativos ? alto / 2 - 20 : alto - 8 - 20) / maxAbs;

  return (
    <div ref={contenedorRef} className="flex w-full justify-center overflow-x-auto">
      <svg
        width={ancho}
        height={alto + 24}
        role="img"
        aria-label="Gráfico de barras"
      >
        <line x1={0} y1={baseY} x2={ancho} y2={baseY} stroke="#c3c2b7" strokeWidth={1} />
        {datos.map((d, i) => {
          const x = margen + espacio + i * (anchoBarra + espacio);
          const h = Math.max(Math.abs(d.valor) * escala, 1);
          const y = d.valor >= 0 ? baseY - h : baseY;
          const color = COLOR[d.tono ?? tonoAutomatico(d.valor)];
          const activo = hover === i;
          const contenido = (
            <g
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className={d.enlace ? "cursor-pointer" : "cursor-default"}
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
                {d.textoValor}
              </text>
              <text
                x={x + anchoBarra / 2}
                y={alto + 18}
                textAnchor="middle"
                fontSize={11}
                fill={d.enlace ? color : "#898781"}
                textDecoration={d.enlace ? "underline" : undefined}
              >
                {d.etiqueta}
              </text>
            </g>
          );
          return d.enlace ? (
            <a key={i} href={d.enlace} aria-label={`Filtrar por ${d.etiqueta}`}>
              {contenido}
            </a>
          ) : (
            <g key={i}>{contenido}</g>
          );
        })}
      </svg>
    </div>
  );
}

export type PuntoLinea = {
  etiqueta: string;
  valor: number;
  textoValor: string;
  mostrarEtiqueta?: boolean;
};

// Curva suave que pasa por todos los puntos (Catmull-Rom convertida a
// Bézier cúbica), en vez de segmentos rectos entre cada punto.
function trazoSuave(coords: { x: number; y: number }[]) {
  if (coords.length < 2) return coords.length === 1 ? `M${coords[0].x},${coords[0].y}` : "";
  let d = `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? i : i - 1];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2 < coords.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export function GraficoLinea({
  puntos,
  alto = 160,
  compacto = false,
}: {
  puntos: PuntoLinea[];
  alto?: number;
  // En modo compacto, todos los puntos se ajustan al ancho disponible
  // (sin barra de desplazamiento) en vez de crecer con la cantidad de datos.
  compacto?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (puntos.length === 0) return null;

  const pasoX = 28;
  const margen = 16;
  const anchoNatural = (puntos.length - 1) * pasoX + margen * 2;
  const ancho = compacto ? 480 : anchoNatural;
  const ejeY = alto - 24;
  const max = Math.max(1, ...puntos.map((p) => p.valor));
  const escala = (ejeY - 16) / max;
  const pasoXCompacto = (ancho - margen * 2) / Math.max(1, puntos.length - 1);

  const coords = puntos.map((p, i) => ({
    x: margen + i * (compacto ? pasoXCompacto : pasoX),
    y: ejeY - p.valor * escala,
  }));

  const path = trazoSuave(coords);

  return (
    <div className={compacto ? "flex justify-center" : "flex justify-center overflow-x-auto"}>
      <svg
        viewBox={compacto ? `0 0 ${ancho} ${alto}` : undefined}
        width={compacto ? "100%" : ancho}
        height={alto}
        preserveAspectRatio={compacto ? "none" : undefined}
        style={compacto ? { maxWidth: ancho } : undefined}
        role="img"
        aria-label="Gráfico de línea"
      >
        <line x1={margen} y1={ejeY} x2={ancho - margen} y2={ejeY} stroke="#e1e0d9" strokeWidth={1} />
        <path d={path} fill="none" stroke="#1a1b33" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <g
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className="cursor-default"
          >
            <rect
              x={c.x - (compacto ? pasoXCompacto : pasoX) / 2}
              y={0}
              width={compacto ? pasoXCompacto : pasoX}
              height={alto}
              fill="transparent"
            />
            <circle cx={c.x} cy={c.y} r={hover === i ? 5 : 3} fill="#1a1b33" />
            {puntos[i].mostrarEtiqueta && (
              <text x={c.x} y={alto - 6} textAnchor="middle" fontSize={10} fill="#898781">
                {puntos[i].etiqueta}
              </text>
            )}
            {hover === i && (
              <g>
                <rect
                  x={c.x - 28}
                  y={Math.max(c.y - 26, 0)}
                  width={56}
                  height={18}
                  rx={4}
                  fill="#0b0b0b"
                />
                <text
                  x={c.x}
                  y={Math.max(c.y - 26, 0) + 13}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#ffffff"
                >
                  {puntos[i].textoValor}
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function GraficoBarrasHorizontal({ datos }: { datos: Barra[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (datos.length === 0) return null;

  const maxAbs = Math.max(1, ...datos.map((d) => Math.abs(d.valor)));

  return (
    <div className="space-y-1.5">
      {datos.map((d, i) => {
        const ancho = (Math.abs(d.valor) / maxAbs) * 100;
        const color = COLOR[d.tono ?? tonoAutomatico(d.valor)];
        const Elemento = d.enlace ? "a" : "div";
        return (
          <Elemento
            key={i}
            {...(d.enlace ? { href: d.enlace, "aria-label": `Filtrar por ${d.etiqueta}` } : {})}
            className={`flex items-center gap-2 text-xs ${d.enlace ? "cursor-pointer hover:opacity-80" : ""}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className={`w-36 shrink-0 truncate ${d.enlace ? "text-gray-900 underline" : "text-gray-600"}`}
              title={d.etiqueta}
            >
              {d.etiqueta}
            </span>
            <div className="h-4 flex-1 rounded-lg bg-gray-100">
              <div
                className="h-4 rounded-lg transition-opacity"
                style={{
                  width: `${Math.max(ancho, 2)}%`,
                  backgroundColor: color,
                  opacity: hover === i ? 1 : 0.85,
                }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-gray-700">{d.textoValor}</span>
          </Elemento>
        );
      })}
    </div>
  );
}

export type BarraAgrupada = {
  etiqueta: string;
  valorA: number;
  textoA: string;
  // null = no hay dato para esa categoría (ej. ese día de la semana no tuvo
  // ningún festivo en el período) — no se dibuja ninguna barra, en vez de
  // dibujar una barra en cero.
  valorB: number | null;
  textoB: string;
  // Si viene, el grupo completo se puede hacer clic y navega ahí — mismo
  // patrón que Barra.enlace en GraficoBarras.
  enlace?: string;
};

export function GraficoBarrasAgrupadas({
  datos,
  leyendaA,
  leyendaB,
  colorA = "#1a1b33",
  colorB = "#9c6900",
  alto = 170,
}: {
  datos: BarraAgrupada[];
  leyendaA: string;
  leyendaB: string;
  colorA?: string;
  colorB?: string;
  alto?: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [contenedorRef, anchoDisponible] = useAnchoContenedor();

  if (datos.length === 0) return null;

  const anchoBarra = 26;
  const espacioBarras = 4;
  const espacioGrupoMinimo = 22;
  // Mismo criterio que GraficoBarras: el espacio entre grupos crece para
  // llenar el ancho disponible, pero con un tope — así con pocos meses los
  // grupos quedan juntos en vez de perdidos, y solo se separan de verdad a
  // medida que hay más datos.
  const espacioGrupoMaximo = 48;
  // Aire fijo a los lados para que la etiqueta del primer o último grupo no
  // se corte contra el borde del SVG.
  const margen = 28;
  const grupoAncho = anchoBarra * 2 + espacioBarras;
  const anchoNatural = datos.length * (grupoAncho + espacioGrupoMinimo) + espacioGrupoMinimo;
  const anchoMaximo = datos.length * (grupoAncho + espacioGrupoMaximo) + espacioGrupoMaximo;
  const interior = Math.min(Math.max(anchoNatural, anchoDisponible - margen * 2), anchoMaximo);
  const espacioGrupo = (interior - datos.length * grupoAncho) / (datos.length + 1);
  const ancho = interior + margen * 2;
  const maxAbs = Math.max(1, ...datos.map((d) => Math.max(d.valorA, d.valorB ?? 0)));
  const baseY = alto - 8;
  const escala = (alto - 8 - 28) / maxAbs;

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colorA }} />
          {leyendaA}
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colorB }} />
          {leyendaB}
        </span>
      </div>
      <div ref={contenedorRef} className="flex w-full justify-center overflow-x-auto">
        <svg width={ancho} height={alto + 24} role="img" aria-label="Gráfico de barras agrupadas">
          <line x1={0} y1={baseY} x2={ancho} y2={baseY} stroke="#c3c2b7" strokeWidth={1} />
          {datos.map((d, i) => {
            const xGrupo = margen + espacioGrupo + i * (grupoAncho + espacioGrupo);
            const hA = d.valorA > 0 ? Math.max(d.valorA * escala, 2) : 0;
            const yA = baseY - hA;
            const hB = d.valorB !== null && d.valorB > 0 ? Math.max(d.valorB * escala, 2) : 0;
            const yB = baseY - hB;
            const xB = xGrupo + anchoBarra + espacioBarras;

            const contenido = (
              <g
                onMouseEnter={() => setHover(`${i}g`)}
                onMouseLeave={() => setHover(null)}
                className={d.enlace ? "cursor-pointer" : "cursor-default"}
              >
                <rect
                  x={xGrupo}
                  y={yA}
                  width={anchoBarra}
                  height={hA}
                  rx={3}
                  fill={colorA}
                  opacity={hover === `${i}g` ? 1 : 0.85}
                />
                {hA > 0 && (
                  <text x={xGrupo + anchoBarra / 2} y={yA - 4} textAnchor="middle" fontSize={9} fill="#52514e">
                    {d.textoA}
                  </text>
                )}
                {d.valorB !== null && (
                  <>
                    <rect
                      x={xB}
                      y={yB}
                      width={anchoBarra}
                      height={hB}
                      rx={3}
                      fill={colorB}
                      opacity={hover === `${i}g` ? 1 : 0.85}
                    />
                    {hB > 0 && (
                      <text x={xB + anchoBarra / 2} y={yB - 4} textAnchor="middle" fontSize={9} fill="#52514e">
                        {d.textoB}
                      </text>
                    )}
                  </>
                )}
                <text
                  x={xGrupo + grupoAncho / 2}
                  y={alto + 18}
                  textAnchor="middle"
                  fontSize={11}
                  fill={d.enlace ? "#1a1b33" : "#898781"}
                  textDecoration={d.enlace ? "underline" : undefined}
                >
                  {d.etiqueta}
                </text>
              </g>
            );
            return d.enlace ? (
              <a key={i} href={d.enlace} aria-label={`Filtrar por ${d.etiqueta}`}>
                {contenido}
              </a>
            ) : (
              <g key={i}>{contenido}</g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
