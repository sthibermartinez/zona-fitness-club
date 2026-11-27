export const tipoPaqueteNavidad = 'Paquete navideño · 3 meses'
export const precioNavidad = '480'

export function promocionDisponible(promo, tipo, fechaInicio) {
  if (promo.aplicaA === tipoPaqueteNavidad) {
    return tipo === 'Mensual' && promo.activa !== false
  }
  return (promo.aplicaA === tipo || promo.aplicaA === 'Ambas')
    && fechaInicio >= promo.fechaInicio && fechaInicio <= promo.fechaFin
}

export function registrarPaquete(cliente, promocion, fechaPago) {
  const anterior = cliente?.vencimiento
  const fechaInicio = anterior && anterior >= fechaPago ? anterior : fechaPago
  const [anio, mes, dia] = fechaInicio.split('-').map(Number)
  const fechaDestino = new Date(Date.UTC(anio, mes + 2, 1))
  const ultimoDia = new Date(Date.UTC(fechaDestino.getUTCFullYear(), fechaDestino.getUTCMonth() + 1, 0)).getUTCDate()
  fechaDestino.setUTCDate(Math.min(dia, ultimoDia))
  return {
    tipo: tipoPaqueteNavidad,
    promocion: promocion.nombre,
    fechaInicio,
    fechaFin: fechaDestino.toISOString().slice(0, 10),
    ...(anterior ? { vigenciaAnteriorHasta: anterior } : {})
  }
}
