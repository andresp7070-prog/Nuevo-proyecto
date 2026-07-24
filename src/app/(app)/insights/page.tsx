import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requerirModulo } from "@/lib/empresa";
import { obtenerContextoPunto } from "@/lib/puntos";
import { primeraMayuscula } from "@/lib/texto";
import { calcularRango, type Periodo } from "@/lib/periodos";
import {
  GraficoBarras,
  GraficoBarrasHorizontal,
  GraficoBarrasAgrupadas,
  GraficoLinea,
  type Barra,
  type BarraAgrupada,
  type PuntoLinea,
} from "./graficos";
import { FiltroFecha } from "./filtro-fecha";
import { VariacionBadge } from "./variacion";

type FilaVentaDia = {
  dia: string;
  dia_semana: string;
  es_festivo: boolean;
  numero_ventas: number;
  total_vendido: number;
};

type FilaProducto = {
  item_id: string;
  nombre: string;
  ingresos: number;
  utilidad: number;
  margen_porcentaje: number;
};

type FilaMes = {
  mes: string;
  ingresos_por_ventas: number;
  utilidad_neta: number;
};

type FilaCategoria = {
  categoria: string | null;
  ingresos: number;
};

type FilaVentaItemRaw = {
  cantidad: number;
  precio_unitario: number;
  costo_unitario: number | null;
  item_id: string | null;
  nombre_libre: string | null;
  inventario_items: { nombre: string; categoria: string | null } | { nombre: string; categoria: string | null }[] | null;
  ventas: { fecha: string } | { fecha: string }[] | null;
};

// Una fila "aplanada": una línea de venta, ya con su fecha, día de la
// semana, si fue festivo y la hora — para poder recalcular cualquier
// gráfica en JS cuando hay un filtro de producto o de día de la semana
// activo (las vistas de Supabase no tienen esas columnas para filtrar).
type FilaUnificada = {
  diaStr: string;
  diaSemana: string;
  esFestivo: boolean;
  hora: number;
  itemId: string | null;
  nombre: string;
  categoria: string | null;
  ingresos: number;
  costos: number;
};

const NOMBRE_DIA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function formatoMonedaCorta(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

function etiquetaMesCorta(mes: string) {
  return primeraMayuscula(new Date(mes).toLocaleDateString("es-CO", { month: "short" }));
}

function sumarDiasIso(fecha: string, dias: number) {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Colombia no tiene horario de verano — el desfase con UTC siempre es -5.
// Una venta guardada en UTC después de las 7pm hora Colombia cae en el día
// siguiente si no se corrige esto antes de truncar a fecha — por eso el día,
// el día de la semana y si fue festivo se calculan sobre la hora Colombia,
// no sobre la hora UTC cruda.
function fechaColombia(fechaIso: string): { diaStr: string; hora: number } {
  const utc = new Date(fechaIso);
  const horaUtc = utc.getUTCHours();
  const hora = (horaUtc + 24 - 5) % 24;
  const colombia = new Date(utc.getTime() - 5 * 60 * 60 * 1000);
  return { diaStr: colombia.toISOString().slice(0, 10), hora };
}

function aplanarFilas(filas: FilaVentaItemRaw[], festivosSet: Set<string>): FilaUnificada[] {
  const resultado: FilaUnificada[] = [];
  for (const f of filas) {
    const v = Array.isArray(f.ventas) ? f.ventas[0] : f.ventas;
    const item = Array.isArray(f.inventario_items) ? f.inventario_items[0] : f.inventario_items;
    if (!v?.fecha) continue;
    const { diaStr, hora } = fechaColombia(v.fecha);
    const diaSemana = NOMBRE_DIA[new Date(`${diaStr}T00:00:00Z`).getUTCDay()];
    resultado.push({
      diaStr,
      diaSemana,
      esFestivo: festivosSet.has(diaStr),
      hora,
      itemId: f.item_id,
      nombre: item?.nombre ?? f.nombre_libre ?? "Sin nombre",
      categoria: item?.categoria ?? null,
      ingresos: f.cantidad * f.precio_unitario,
      costos: f.cantidad * (f.costo_unitario ?? 0),
    });
  }
  return resultado;
}

// A partir de las filas aplanadas, reconstruye los mismos "shapes" que usan
// las vistas de Supabase (ventasPorDia, porMes, porProducto, porCategoria,
// ventasConHora) para que el resto de la página no tenga que saber de dónde
// salieron los datos.
function derivarDesdeUnificadas(filas: FilaUnificada[]) {
  const porDiaMapa = new Map<string, { dia: string; dia_semana: string; es_festivo: boolean; total: number; n: number }>();
  const porMesMapa = new Map<string, { ingresos: number; utilidad: number }>();
  const porProductoMapa = new Map<string, { nombre: string; categoria: string | null; ingresos: number; costos: number }>();
  const ventasConHora: { fecha: string; monto: number }[] = [];

  for (const f of filas) {
    const dia = porDiaMapa.get(f.diaStr) ?? {
      dia: f.diaStr,
      dia_semana: f.diaSemana,
      es_festivo: f.esFestivo,
      total: 0,
      n: 0,
    };
    dia.total += f.ingresos;
    dia.n += 1;
    porDiaMapa.set(f.diaStr, dia);

    const mesKey = `${f.diaStr.slice(0, 7)}-01`;
    const mes = porMesMapa.get(mesKey) ?? { ingresos: 0, utilidad: 0 };
    mes.ingresos += f.ingresos;
    mes.utilidad += f.ingresos - f.costos;
    porMesMapa.set(mesKey, mes);

    // Sin item_id (venta sin catálogo) no hay una identidad estable de
    // producto para agrupar — se cuenta en día/mes/hora, pero no aquí.
    if (f.itemId) {
      const prod = porProductoMapa.get(f.itemId) ?? {
        nombre: f.nombre,
        categoria: f.categoria,
        ingresos: 0,
        costos: 0,
      };
      prod.ingresos += f.ingresos;
      prod.costos += f.costos;
      porProductoMapa.set(f.itemId, prod);
    }
  }

  // ventasConHora se usa para la gráfica por hora — una fila "sintética" por
  // línea de venta alcanza, ya que solo se usa la hora y el monto.
  for (const f of filas) {
    ventasConHora.push({ fecha: `1970-01-01T${String(f.hora).padStart(2, "0")}:00:00Z`, monto: f.ingresos });
  }

  const ventasPorDia: FilaVentaDia[] = Array.from(porDiaMapa.values()).map((d) => ({
    dia: d.dia,
    dia_semana: d.dia_semana,
    es_festivo: d.es_festivo,
    numero_ventas: d.n,
    total_vendido: d.total,
  }));

  const porMes: FilaMes[] = Array.from(porMesMapa.entries()).map(([mes, v]) => ({
    mes,
    ingresos_por_ventas: v.ingresos,
    utilidad_neta: v.utilidad,
  }));

  const porProducto: FilaProducto[] = Array.from(porProductoMapa.entries()).map(([itemId, v]) => {
    const utilidad = v.ingresos - v.costos;
    return {
      item_id: itemId,
      nombre: v.nombre,
      ingresos: v.ingresos,
      utilidad,
      margen_porcentaje: v.ingresos > 0 ? Math.round((utilidad / v.ingresos) * 1000) / 10 : 0,
    };
  });

  const porCategoriaMapa = new Map<string, number>();
  for (const p of porProductoMapa.values()) {
    const cat = p.categoria ?? "Sin categoría";
    porCategoriaMapa.set(cat, (porCategoriaMapa.get(cat) ?? 0) + p.ingresos);
  }
  const porCategoria: FilaCategoria[] = Array.from(porCategoriaMapa.entries()).map(
    ([categoria, ingresos]) => ({ categoria, ingresos }),
  );

  return { ventasPorDia, porMes, porProducto, porCategoria, ventasConHora };
}

const ORDEN_DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const ABREVIATURA_DIA: Record<string, string> = {
  Lunes: "Lun",
  Martes: "Mar",
  Miércoles: "Mié",
  Jueves: "Jue",
  Viernes: "Vie",
  Sábado: "Sáb",
  Domingo: "Dom",
};
const UMBRAL_DESVIACION_DIA = 0.2; // 20%
const UMBRAL_MARGEN_BAJO = 15; // %

async function ContenidoInsights({
  searchParams,
}: {
  searchParams: { periodo?: string; desde?: string; hasta?: string; dia_semana?: string; producto?: string };
}) {
  const { periodo = "todo", desde: desdeParam, hasta: hastaParam, dia_semana: diaSemanaFiltro = "", producto: productoFiltro = "" } =
    searchParams;
  const rango = calcularRango(periodo as Periodo, desdeParam, hastaParam);

  // Arma el enlace de una barra al hacer clic: parte de los filtros que ya
  // están activos y solo cambia la dimensión que se está fijando — así el
  // clic en una gráfica se suma a lo que ya estaba filtrado en otra, en vez
  // de reemplazarlo.
  function enlaceConFiltro(
    overrides: Partial<{ periodo: string; desde: string; hasta: string; dia_semana: string; producto: string }>,
  ) {
    const base: Record<string, string | undefined> = {
      periodo,
      desde: desdeParam,
      hasta: hastaParam,
      dia_semana: diaSemanaFiltro || undefined,
      producto: productoFiltro || undefined,
      ...overrides,
    };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(base)) {
      if (v) params.set(k, v);
    }
    return `?${params.toString()}`;
  }

  // Supabase devuelve "mes" como marca de tiempo completa (ej.
  // "2026-05-01T00:00:00+00:00"), no solo la fecha — hay que quedarse con
  // los primeros 10 caracteres antes de construir un Date con esto, si no
  // "T00:00:00" quedaba pegado dos veces y rompía el cálculo.
  function primerDiaDelMes(mesIso: string) {
    return mesIso.slice(0, 10);
  }

  function ultimoDiaDelMes(mesIso: string) {
    const d = new Date(`${mesIso.slice(0, 10)}T00:00:00`);
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return ultimo.toISOString().slice(0, 10);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id, punto_venta_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return (
      <p className="text-red-600">
        Tu usuario no tiene una empresa asignada. Pídele a un administrador que la configure.
      </p>
    );
  }
  const empresaId = perfil.empresa_id;

  // Horario real del negocio — para no mostrar comparaciones ni horas que no
  // le aplican (festivos si nunca abre esos días, horas fuera de atención).
  // Sin configurar (null / true por defecto), el comportamiento es
  // exactamente el de siempre: se asume que aplica todo.
  const { data: empresaHorario } = await supabase
    .from("empresas")
    .select("hora_apertura, hora_cierre, atiende_festivos")
    .eq("id", empresaId)
    .single();

  const horaApertura = empresaHorario?.hora_apertura
    ? Number(empresaHorario.hora_apertura.slice(0, 2))
    : null;
  const horaCierre = empresaHorario?.hora_cierre
    ? Number(empresaHorario.hora_cierre.slice(0, 2))
    : null;
  const atiendeFestivos = empresaHorario?.atiende_festivos ?? true;

  // El punto de venta se elige desde el selector de la barra lateral (una
  // sola vez para toda la sesión), no con un filtro propio de esta página —
  // así queda consistente con Ventas, Inventario y P y G.
  const { puntoSeleccionado: puntoVentaFiltro } = await obtenerContextoPunto(
    supabase,
    empresaId,
    perfil.punto_venta_id,
  );

  const { data: productosData } = await supabase
    .from("inventario_items")
    .select("id, nombre")
    .eq("empresa_id", empresaId)
    .order("nombre");

  const productos = (productosData ?? []) as { id: string; nombre: string }[];

  const sinFiltros = !rango && !diaSemanaFiltro && !productoFiltro && !puntoVentaFiltro;

  let ventasPorDia: FilaVentaDia[];
  let porMes: FilaMes[];
  let porProducto: FilaProducto[];
  let porCategoria: FilaCategoria[];
  let ventasConHora: { fecha: string; monto: number }[];

  let totalVentasActual = 0;
  let totalVentasAnterior = 0;
  let utilidadNetaAnterior = 0;
  let utilidadAnteriorTotal = 0;
  let ingresosAnteriorProductos = 0;

  if (sinFiltros) {
    const [
      { data: ventasPorDiaData },
      { data: porMesData },
      { data: porProductoData },
      { data: porCategoriaData },
      { data: ventasHoraData },
    ] = await Promise.all([
      supabase
        .from("vista_ventas_por_dia")
        .select("dia, dia_semana, es_festivo, numero_ventas, total_vendido")
        .eq("empresa_id", empresaId),
      supabase
        .from("vista_estado_resultados")
        .select("mes, ingresos_por_ventas, utilidad_neta")
        .eq("empresa_id", empresaId)
        .order("mes", { ascending: false }),
      supabase
        .from("vista_utilidad_por_producto")
        .select("item_id, nombre, ingresos, utilidad, margen_porcentaje")
        .eq("empresa_id", empresaId),
      supabase.from("vista_utilidad_por_categoria").select("categoria, ingresos").eq("empresa_id", empresaId),
      supabase.from("ventas").select("fecha, monto").eq("empresa_id", empresaId),
    ]);

    ventasPorDia = (ventasPorDiaData ?? []) as FilaVentaDia[];
    porMes = (porMesData ?? []) as FilaMes[];
    porProducto = (porProductoData ?? []) as FilaProducto[];
    porCategoria = (porCategoriaData ?? []) as FilaCategoria[];
    ventasConHora = (ventasHoraData ?? []) as { fecha: string; monto: number }[];
    totalVentasActual = ventasConHora.reduce((s, v) => s + v.monto, 0);
    utilidadNetaAnterior = 0;
  } else {
    // Con cualquier filtro activo (período, día de la semana o producto) se
    // recalcula todo desde ventas_items en crudo, porque las vistas no
    // tienen ni columna de fecha ni de producto para filtrar juntas.
    const desdeAmplio = rango ? rango.desdeAnterior : "1900-01-01";
    const hastaAmplio = rango ? rango.hasta : "2999-01-01";

    let query = supabase
      .from("ventas_items")
      .select(
        "cantidad, precio_unitario, costo_unitario, item_id, nombre_libre, inventario_items ( nombre, categoria ), ventas!inner ( fecha, empresa_id )",
      )
      .eq("ventas.empresa_id", empresaId)
      .gte("ventas.fecha", `${desdeAmplio}T00:00:00`)
      .lt("ventas.fecha", `${sumarDiasIso(hastaAmplio, 1)}T00:00:00`);

    if (productoFiltro) query = query.eq("item_id", productoFiltro);
    if (puntoVentaFiltro) query = query.eq("ventas.punto_venta_id", puntoVentaFiltro);

    const [{ data: filasRawData }, { data: festivosData }] = await Promise.all([
      query,
      supabase.from("festivos").select("fecha"),
    ]);

    const festivosSet = new Set((festivosData ?? []).map((f) => f.fecha as string));
    let todasLasFilas = aplanarFilas((filasRawData ?? []) as FilaVentaItemRaw[], festivosSet);

    if (diaSemanaFiltro) {
      todasLasFilas = todasLasFilas.filter((f) => f.diaSemana === diaSemanaFiltro);
    }

    const filasActual = rango
      ? todasLasFilas.filter((f) => f.diaStr >= rango.desde && f.diaStr <= rango.hasta)
      : todasLasFilas;
    const filasAnterior = rango ? todasLasFilas.filter((f) => f.diaStr < rango.desde) : [];

    const derivadoActual = derivarDesdeUnificadas(filasActual);
    const derivadoAnterior = derivarDesdeUnificadas(filasAnterior);

    ventasPorDia = derivadoActual.ventasPorDia;
    porMes = derivadoActual.porMes;
    porProducto = derivadoActual.porProducto;
    porCategoria = derivadoActual.porCategoria;
    ventasConHora = derivadoActual.ventasConHora;

    totalVentasActual = filasActual.reduce((s, f) => s + f.ingresos, 0);
    totalVentasAnterior = filasAnterior.reduce((s, f) => s + f.ingresos, 0);
    utilidadNetaAnterior = derivadoAnterior.porMes.reduce((s, f) => s + f.utilidad_neta, 0);
    utilidadAnteriorTotal = derivadoAnterior.porProducto.reduce((s, p) => s + p.utilidad, 0);
    ingresosAnteriorProductos = derivadoAnterior.porProducto.reduce((s, p) => s + p.ingresos, 0);
  }

  // ---- Agregados para el resumen general ----
  const porDiaSemana = ORDEN_DIAS.map((dia) => {
    const filas = ventasPorDia.filter((f) => f.dia_semana === dia);
    const totalVendido = filas.reduce((s, f) => s + f.total_vendido, 0);
    const promedio = filas.length > 0 ? totalVendido / filas.length : 0;
    return { dia, promedio, diasConVenta: filas.length };
  });

  const promedioGeneral =
    ventasPorDia.length > 0
      ? ventasPorDia.reduce((s, f) => s + f.total_vendido, 0) / ventasPorDia.length
      : 0;

  const diasConDatos = porDiaSemana.filter((d) => d.diasConVenta > 0);
  const mejorDia = diasConDatos.reduce(
    (mejor, d) => (d.promedio > (mejor?.promedio ?? -Infinity) ? d : mejor),
    null as (typeof diasConDatos)[number] | null,
  );
  const peorDia = diasConDatos.reduce(
    (peor, d) => (d.promedio < (peor?.promedio ?? Infinity) ? d : peor),
    null as (typeof diasConDatos)[number] | null,
  );
  const mejorDiaDestaca =
    promedioGeneral > 0 && mejorDia && mejorDia.promedio >= promedioGeneral * (1 + UMBRAL_DESVIACION_DIA);
  const peorDiaDestaca =
    promedioGeneral > 0 && peorDia && peorDia.promedio <= promedioGeneral * (1 - UMBRAL_DESVIACION_DIA);

  // Festivo vs. normal, día de semana por día de semana — para responder
  // directamente "lunes vs. lunes festivo, martes vs. martes festivo...".
  const festivosPorDiaSemana = ORDEN_DIAS.map((dia) => {
    const normales = ventasPorDia.filter((f) => f.dia_semana === dia && !f.es_festivo);
    const festivosDia = ventasPorDia.filter((f) => f.dia_semana === dia && f.es_festivo);
    const promedioNormalDia = normales.length > 0 ? normales.reduce((s, f) => s + f.total_vendido, 0) / normales.length : null;
    const promedioFestivoDia = festivosDia.length > 0 ? festivosDia.reduce((s, f) => s + f.total_vendido, 0) / festivosDia.length : null;
    return { dia, promedioNormalDia, promedioFestivoDia, cantidadFestivos: festivosDia.length };
  });

  const barrasAgrupadasFestivos: BarraAgrupada[] = festivosPorDiaSemana.map((d) => ({
    etiqueta: ABREVIATURA_DIA[d.dia],
    valorA: d.promedioNormalDia ?? 0,
    textoA: d.promedioNormalDia !== null ? formatoMonedaCorta(d.promedioNormalDia) : "",
    valorB: d.promedioFestivoDia,
    textoB: d.promedioFestivoDia !== null ? formatoMonedaCorta(d.promedioFestivoDia) : "",
  }));

  const festivos = ventasPorDia.filter((f) => f.es_festivo);
  const noFestivos = ventasPorDia.filter((f) => !f.es_festivo);
  const promedioFestivo =
    festivos.length > 0 ? festivos.reduce((s, f) => s + f.total_vendido, 0) / festivos.length : null;
  const promedioNoFestivo =
    noFestivos.length > 0
      ? noFestivos.reduce((s, f) => s + f.total_vendido, 0) / noFestivos.length
      : null;
  const totalPorHora = Array.from({ length: 24 }, () => 0);
  for (const v of ventasConHora) {
    const horaUtc = new Date(v.fecha).getUTCHours();
    const horaColombia = sinFiltros ? (horaUtc + 24 - 5) % 24 : horaUtc;
    totalPorHora[horaColombia] += v.monto;
  }
  // Si el negocio tiene horario configurado, la gráfica solo muestra esas
  // horas — mostrar el resto en $0 no informa nada, solo estira la gráfica
  // con horas en las que ni siquiera está abierto. Contempla el caso de un
  // negocio que cierra después de medianoche (ej. 18h a 2h).
  function dentroDelHorario(hora: number) {
    if (horaApertura === null || horaCierre === null) return true;
    if (horaApertura <= horaCierre) return hora >= horaApertura && hora <= horaCierre;
    return hora >= horaApertura || hora <= horaCierre;
  }

  const barrasHora: Barra[] = totalPorHora
    .map((total, hora) => ({ total, hora }))
    .filter(({ hora }) => dentroDelHorario(hora))
    .map(({ total, hora }) => ({
      etiqueta: `${hora}h`,
      valor: total,
      textoValor: formatoMonedaCorta(total),
    }));

  // ---- Datos para las gráficas ----
  const barrasDiaSemana: Barra[] = porDiaSemana.map((d) => ({
    etiqueta: ABREVIATURA_DIA[d.dia],
    valor: d.promedio,
    textoValor: formatoMonedaCorta(d.promedio),
    tono:
      mejorDiaDestaca && d.dia === mejorDia?.dia
        ? "positivo"
        : peorDiaDestaca && d.dia === peorDia?.dia
          ? "alerta"
          : "default",
    enlace: enlaceConFiltro({ dia_semana: d.dia }),
  }));

  const barrasMargen: Barra[] = [...porProducto]
    .filter((p) => p.ingresos > 0)
    .sort((a, b) => b.margen_porcentaje - a.margen_porcentaje)
    .slice(0, 10)
    .map((p) => ({
      etiqueta: p.nombre,
      valor: p.margen_porcentaje,
      textoValor: `${p.margen_porcentaje}%`,
      tono: p.margen_porcentaje < UMBRAL_MARGEN_BAJO ? "alerta" : "default",
      enlace: enlaceConFiltro({ producto: p.item_id }),
    }));

  const añosConVentas = new Set(
    porMes.filter((f) => f.ingresos_por_ventas > 0).map((f) => f.mes.slice(0, 4)),
  );
  const mostrarPorAnio = sinFiltros && añosConVentas.size >= 2;

  // "Rendimiento" combina ventas y utilidad en una sola gráfica protagonista
  // — ventas (la línea de arriba) y utilidad (lo que de verdad queda) una al
  // lado de la otra, mes a mes o año a año según cuántos datos haya.
  const barrasRendimientoAnio: BarraAgrupada[] = mostrarPorAnio
    ? Array.from(
        porMes.reduce((mapa, f) => {
          const anio = f.mes.slice(0, 4);
          const actual = mapa.get(anio) ?? { ingresos: 0, utilidad: 0 };
          actual.ingresos += f.ingresos_por_ventas;
          actual.utilidad += f.utilidad_neta;
          mapa.set(anio, actual);
          return mapa;
        }, new Map<string, { ingresos: number; utilidad: number }>()),
      )
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([anio, v]) => ({
          etiqueta: anio,
          valorA: v.ingresos,
          textoA: formatoMonedaCorta(v.ingresos),
          valorB: v.utilidad,
          textoB: formatoMonedaCorta(v.utilidad),
          enlace: enlaceConFiltro({ periodo: "personalizado", desde: `${anio}-01-01`, hasta: `${anio}-12-31` }),
        }))
    : [];

  const barrasRendimientoMes: BarraAgrupada[] = [...porMes]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((f) => ({
      etiqueta: etiquetaMesCorta(f.mes),
      valorA: f.ingresos_por_ventas,
      textoA: formatoMonedaCorta(f.ingresos_por_ventas),
      valorB: f.utilidad_neta,
      textoB: formatoMonedaCorta(f.utilidad_neta),
      enlace: enlaceConFiltro({ periodo: "personalizado", desde: primerDiaDelMes(f.mes), hasta: ultimoDiaDelMes(f.mes) }),
    }));

  const ventasPorDiaOrdenadas = [...ventasPorDia].sort((a, b) => a.dia.localeCompare(b.dia));
  const puntosVentasPorDia: PuntoLinea[] = ventasPorDiaOrdenadas.map((f, i) => ({
    etiqueta: new Date(f.dia).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" }),
    valor: f.total_vendido,
    textoValor: formatoMonedaCorta(f.total_vendido),
    mostrarEtiqueta: i % Math.max(1, Math.ceil(ventasPorDiaOrdenadas.length / 10)) === 0,
  }));

  const barrasCategoria: Barra[] = [...porCategoria]
    .filter((c) => c.ingresos > 0)
    .sort((a, b) => b.ingresos - a.ingresos)
    .slice(0, 10)
    .map((c) => ({
      etiqueta: c.categoria ?? "Sin categoría",
      valor: c.ingresos,
      textoValor: formatoMonedaCorta(c.ingresos),
    }));

  const barrasProductoVentas: Barra[] = [...porProducto]
    .filter((p) => p.ingresos > 0)
    .sort((a, b) => b.ingresos - a.ingresos)
    .slice(0, 10)
    .map((p) => ({
      etiqueta: p.nombre,
      valor: p.ingresos,
      textoValor: formatoMonedaCorta(p.ingresos),
      enlace: enlaceConFiltro({ producto: p.item_id }),
    }));

  const utilidadNetaActual = porMes.reduce((s, f) => s + f.utilidad_neta, 0);
  const ingresosProductosActual = porProducto.reduce((s, p) => s + p.ingresos, 0);
  const categoriaIngresosActual = porCategoria.reduce((s, c) => s + c.ingresos, 0);

  const hayComparacion = Boolean(rango);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Panel de control</h1>
        <p className="mt-1 text-sm text-gray-500">
          Primero el panorama general, y debajo lo que vale la pena señalar de tus datos reales.
        </p>
      </div>

      <FiltroFecha
        periodoActual={periodo}
        diaSemanaActual={diaSemanaFiltro}
        productoActual={productoFiltro}
        productos={productos}
      />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Resumen general</h2>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-center">
            <h3 className="text-xs font-medium text-gray-700">Utilidad neta del período</h3>
            <p className="mt-2 text-4xl font-semibold tabular-nums text-gray-900 sm:text-5xl">
              {formatoMonedaCorta(utilidadNetaActual)}
            </p>
            {hayComparacion && (
              <div className="mt-2">
                <VariacionBadge actual={utilidadNetaActual} anterior={utilidadNetaAnterior} />
              </div>
            )}
          </div>

          <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-gray-700">
                {mostrarPorAnio ? "Rendimiento por año" : "Rendimiento por mes"}
              </h3>
              {hayComparacion && <VariacionBadge actual={totalVentasActual} anterior={totalVentasAnterior} />}
            </div>
            {(mostrarPorAnio ? barrasRendimientoAnio : barrasRendimientoMes).length === 0 ? (
              <p className="text-sm text-gray-400">Aún no hay datos suficientes.</p>
            ) : (
              <GraficoBarrasAgrupadas
                datos={mostrarPorAnio ? barrasRendimientoAnio : barrasRendimientoMes}
                leyendaA="Ventas"
                leyendaB="Utilidad"
              />
            )}
          </div>

          <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-gray-700">Ventas por día</h3>
              {hayComparacion && <VariacionBadge actual={totalVentasActual} anterior={totalVentasAnterior} />}
            </div>
            {puntosVentasPorDia.length === 0 ? (
              <p className="text-sm text-gray-400">Aún no hay ventas registradas.</p>
            ) : (
              <GraficoLinea puntos={puntosVentasPorDia} compacto />
            )}
          </div>

          {atiendeFestivos && (
            <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-2">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-medium text-gray-700">Festivos vs. días normales</h3>
                {hayComparacion && <VariacionBadge actual={totalVentasActual} anterior={totalVentasAnterior} />}
              </div>
              {promedioFestivo === null && promedioNoFestivo === null ? (
                <p className="text-sm text-gray-400">Aún no hay ventas registradas.</p>
              ) : (
                <GraficoBarrasAgrupadas datos={barrasAgrupadasFestivos} leyendaA="Normal" leyendaB="Festivo" />
              )}
            </div>
          )}

          <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-gray-700">Categorías con más ventas</h3>
              {hayComparacion && (
                <VariacionBadge actual={categoriaIngresosActual} anterior={ingresosAnteriorProductos} />
              )}
            </div>
            {barrasCategoria.length === 0 ? (
              <p className="text-sm text-gray-400">Aún no hay ventas registradas.</p>
            ) : (
              <GraficoBarrasHorizontal datos={barrasCategoria} />
            )}
          </div>

          <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-gray-700">Productos con más ventas</h3>
              {hayComparacion && (
                <VariacionBadge actual={ingresosProductosActual} anterior={ingresosAnteriorProductos} />
              )}
            </div>
            {barrasProductoVentas.length === 0 ? (
              <p className="text-sm text-gray-400">Aún no hay ventas registradas.</p>
            ) : (
              <GraficoBarrasHorizontal datos={barrasProductoVentas} />
            )}
          </div>

          <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-gray-700">Ventas por día de la semana</h3>
              {hayComparacion && <VariacionBadge actual={totalVentasActual} anterior={totalVentasAnterior} />}
            </div>
            {promedioGeneral > 0 ? (
              <GraficoBarras datos={barrasDiaSemana} />
            ) : (
              <p className="text-sm text-gray-400">Aún no hay ventas registradas.</p>
            )}
          </div>

          <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-gray-700">Ventas por hora del día</h3>
              {hayComparacion && <VariacionBadge actual={totalVentasActual} anterior={totalVentasAnterior} />}
            </div>
            {ventasConHora.length === 0 ? (
              <p className="text-sm text-gray-400">Aún no hay ventas registradas.</p>
            ) : (
              <GraficoBarras datos={barrasHora} />
            )}
          </div>

          <div className="rounded-xl border-2 border-gray-200 p-4 md:col-span-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-gray-700">Margen por producto</h3>
              {hayComparacion && <VariacionBadge actual={utilidadNetaActual} anterior={utilidadAnteriorTotal} />}
            </div>
            {barrasMargen.length === 0 ? (
              <p className="text-sm text-gray-400">Aún no hay ventas registradas.</p>
            ) : (
              <GraficoBarrasHorizontal datos={barrasMargen} />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string; dia_semana?: string; producto?: string }>;
}) {
  await requerirModulo("insights");
  const params = await searchParams;
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">Cargando…</p>}>
      <ContenidoInsights searchParams={params} />
    </Suspense>
  );
}
