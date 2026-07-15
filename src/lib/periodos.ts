export type Periodo =
  | "todo"
  | "7d"
  | "15d"
  | "30d"
  | "este_mes"
  | "mes_anterior"
  | "este_anio"
  | "personalizado";

export type RangoFechas = {
  desde: string; // yyyy-mm-dd, inclusive
  hasta: string; // yyyy-mm-dd, inclusive
  desdeAnterior: string;
  hastaAnterior: string;
  etiqueta: string;
};

function formatoFecha(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return formatoFecha(d);
}

function diasEntre(desde: string, hasta: string) {
  const a = new Date(`${desde}T00:00:00`);
  const b = new Date(`${hasta}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

// Calcula el rango del período elegido y, de una vez, el rango del período
// inmediatamente anterior (misma duración) para poder comparar variación.
export function calcularRango(
  periodo: Periodo,
  desdeParam?: string,
  hastaParam?: string,
): RangoFechas | null {
  if (periodo === "todo") return null;

  const hoy = new Date();
  const hoyStr = formatoFecha(hoy);

  if (periodo === "personalizado") {
    if (!desdeParam || !hastaParam) return null;
    const dias = diasEntre(desdeParam, hastaParam);
    return {
      desde: desdeParam,
      hasta: hastaParam,
      desdeAnterior: sumarDias(desdeParam, -dias),
      hastaAnterior: sumarDias(desdeParam, -1),
      etiqueta: `${desdeParam} a ${hastaParam}`,
    };
  }

  if (periodo === "7d" || periodo === "15d" || periodo === "30d") {
    const dias = periodo === "7d" ? 7 : periodo === "15d" ? 15 : 30;
    const desde = sumarDias(hoyStr, -(dias - 1));
    return {
      desde,
      hasta: hoyStr,
      desdeAnterior: sumarDias(desde, -dias),
      hastaAnterior: sumarDias(desde, -1),
      etiqueta: `Últimos ${dias} días`,
    };
  }

  if (periodo === "este_mes") {
    const desde = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
    const desdeAnterior = formatoFecha(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1));
    return {
      desde,
      hasta: hoyStr,
      desdeAnterior,
      hastaAnterior: sumarDias(desde, -1),
      etiqueta: "Este mes",
    };
  }

  if (periodo === "mes_anterior") {
    const desde = formatoFecha(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1));
    const hasta = formatoFecha(new Date(hoy.getFullYear(), hoy.getMonth(), 0));
    return {
      desde,
      hasta,
      desdeAnterior: formatoFecha(new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1)),
      hastaAnterior: sumarDias(desde, -1),
      etiqueta: "Mes anterior",
    };
  }

  if (periodo === "este_anio") {
    const desde = `${hoy.getFullYear()}-01-01`;
    return {
      desde,
      hasta: hoyStr,
      desdeAnterior: `${hoy.getFullYear() - 1}-01-01`,
      hastaAnterior: `${hoy.getFullYear() - 1}-12-31`,
      etiqueta: "Este año",
    };
  }

  return null;
}

// Variación porcentual entre dos totales — null si no hay con qué comparar.
export function variacionPorcentual(actual: number, anterior: number): number | null {
  if (anterior === 0) return actual === 0 ? 0 : null;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}
