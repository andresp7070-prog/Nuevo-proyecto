function formatoMonedaCorta(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

export function VariacionBadge({
  actual,
  anterior,
}: {
  actual: number;
  anterior: number;
}) {
  const diferencia = actual - anterior;
  if (anterior === 0) {
    if (actual === 0) return null;
    return <span className="text-xs font-medium text-gray-400">Sin período anterior para comparar</span>;
  }

  const porcentaje = (diferencia / Math.abs(anterior)) * 100;
  const subio = diferencia > 0;
  const igual = diferencia === 0;

  return (
    <span
      className={`text-xs font-medium ${igual ? "text-gray-400" : subio ? "text-green-600" : "text-red-600"}`}
    >
      {igual ? "Igual" : subio ? "▲" : "▼"} {Math.abs(porcentaje).toFixed(1)}% (
      {subio ? "+" : diferencia === 0 ? "" : "-"}
      {formatoMonedaCorta(Math.abs(diferencia))}) vs. período anterior
    </span>
  );
}
