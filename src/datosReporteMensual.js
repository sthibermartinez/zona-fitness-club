import { supabase } from './supabase'

const fechaGuatemala = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit'
})

async function leerPaginas(consulta) {
  const filas = []
  const limite = 200
  for (let inicio = 0; ; inicio += limite) {
    const { data, error } = await consulta().order('id').range(inicio, inicio + limite - 1)
    if (error) throw error
    filas.push(...data)
    if (data.length < limite) return filas
  }
}

export async function cargarReporteMensual(mes, anterior) {
  const [anio, numero] = mes.split('-').map(Number)
  const siguiente = new Date(Date.UTC(anio, numero, 1)).toISOString().slice(0, 10)
  const [ventas, asistencias] = await Promise.all([
    leerPaginas(() => supabase.from('ventas')
      .select('id,cobrada_en,total,metodo_pago,ventas_detalle(nombre,cantidad,subtotal)')
      .gte('cobrada_en', `${anterior}-01T00:00:00-06:00`).lt('cobrada_en', `${siguiente}T00:00:00-06:00`)),
    leerPaginas(() => supabase.from('asistencias')
      .select('id,fecha,turnos(numero)').gte('fecha', `${mes}-01`).lt('fecha', siguiente))
  ])

  return {
    ventas: ventas.map(venta => ({ ...venta, fecha: fechaGuatemala.format(new Date(venta.cobrada_en)) })),
    asistencias
  }
}

export function resumirAsistencia(asistencias) {
  const porDia = new Map()
  const porTurno = new Map()
  for (const { fecha, turnos } of asistencias) {
    if (fecha) porDia.set(fecha, (porDia.get(fecha) || 0) + 1)
    const numero = turnos?.numero
    if (numero != null) porTurno.set(numero, (porTurno.get(numero) || 0) + 1)
  }
  const ranking = conteos => [...conteos].sort(([a, n], [b, m]) => m - n || String(a).localeCompare(String(b), 'es', { numeric: true }))
  return { dias: ranking(porDia), turnos: ranking(porTurno) }
}
