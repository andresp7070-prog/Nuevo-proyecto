export const FRECUENCIAS_PAGO = [
  { valor: "contado", etiqueta: "De contado" },
  { valor: "diario", etiqueta: "Diaria" },
  { valor: "semanal", etiqueta: "Semanal" },
  { valor: "mensual", etiqueta: "Mensual" },
  { valor: "personalizado", etiqueta: "Personalizada" },
] as const;

export const DIAS_SEMANA = [
  { valor: "lunes", etiqueta: "Lunes" },
  { valor: "martes", etiqueta: "Martes" },
  { valor: "miercoles", etiqueta: "Miércoles" },
  { valor: "jueves", etiqueta: "Jueves" },
  { valor: "viernes", etiqueta: "Viernes" },
  { valor: "sabado", etiqueta: "Sábado" },
  { valor: "domingo", etiqueta: "Domingo" },
] as const;

function etiquetaDiaSemana(valor: string): string {
  return DIAS_SEMANA.find((d) => d.valor === valor)?.etiqueta ?? valor;
}

export function etiquetaFrecuenciaPago(
  frecuencia: string,
  diaSemanaPago: string | null,
  diasPersonalizado: number | null,
): string {
  if (frecuencia === "semanal" && diaSemanaPago) {
    return `Semanal, cada ${etiquetaDiaSemana(diaSemanaPago)}`;
  }
  if (frecuencia === "personalizado" && diasPersonalizado) {
    return `Cada ${diasPersonalizado} día${diasPersonalizado === 1 ? "" : "s"}`;
  }
  return FRECUENCIAS_PAGO.find((f) => f.valor === frecuencia)?.etiqueta ?? frecuencia;
}
