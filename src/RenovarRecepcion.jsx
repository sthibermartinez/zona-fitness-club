import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { avisarVentaRegistrada } from './CajaTurno'

const fecha = valor => valor.split('-').reverse().join('/')
const moneda = valor => `Q${Number(valor).toFixed(2)}`

export default function RenovarRecepcion({ cliente, turno, operador, onCobro }) {
  const [abierto, setAbierto] = useState(false)
  const [tipo, setTipo] = useState('Mensual')
  const [promocion, setPromocion] = useState(false)
  const [previa, setPrevia] = useState(null)
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const clave = `zfc-renovacion:${operador}:${cliente.id}`
  const [pendiente, setPendiente] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(clave)) } catch { return null }
  })
  const ocupado = useRef(false)

  useEffect(() => {
    if (!abierto || pendiente) return
    let activo = true
    setPrevia(null)
    setError('')
    supabase.rpc('renovar_en_recepcion', { p_cliente: String(cliente.id), p_tipo: tipo, p_promocion: promocion })
      .then(({ data, error }) => {
        if (!activo) return
        if (error) setError(error.message)
        else setPrevia(data)
      })
    return () => { activo = false }
  }, [abierto, cliente.id, tipo, promocion, pendiente])

  async function cobrar() {
    if (ocupado.current || (!pendiente && (!previa || !turno))) return
    const datos = pendiente || { p_operacion: crypto.randomUUID(), p_cliente: String(cliente.id), p_tipo: tipo,
      p_promocion: promocion, p_turno: turno, p_previa: previa }
    try { sessionStorage.setItem(clave, JSON.stringify(datos)) } catch {
      setError('Habilita el almacenamiento de esta pestaña para poder confirmar el cobro.')
      return
    }
    ocupado.current = true
    setConfirmando(true)
    setPendiente(datos)
    setError('')
    try {
      const { data, error } = await supabase.rpc('renovar_en_recepcion', datos)
      if (error) {
        if (error.code === 'P0001' || error.code === 'PGRST202') {
          sessionStorage.removeItem(clave)
          setPendiente(null)
          setAbierto(false)
          setError(error.message)
          return
        }
        throw error
      }
      sessionStorage.removeItem(clave)
      setPendiente(null)
      setAbierto(false)
      onCobro(data)
      avisarVentaRegistrada(true)
    } catch {
      setError('No se pudo confirmar el cobro. Reintenta esta misma operación.')
    } finally {
      ocupado.current = false
      setConfirmando(false)
    }
  }

  const cotizacion = pendiente?.p_previa || previa
  return <div className="pi-verificacion">
    {!abierto && !pendiente ? <button type="button" className="pi-boton pi-boton-primario"
      onClick={() => setAbierto(true)}>Renovar membresía</button> : <>
      {!pendiente && <>
        <label>Plan <select value={tipo} onChange={e => { setTipo(e.target.value); setPromocion(false) }}>
          <option>Mensual</option><option>Quincenal</option>
        </select></label>
        {tipo === 'Mensual' && (previa?.navidadDisponible || promocion) &&
          <label><input type="checkbox" checked={promocion} onChange={e => setPromocion(e.target.checked)} /> Promoción navideña</label>}
      </>}
      {cotizacion && <>
        <p>Pago en efectivo · <strong>{moneda(cotizacion.precio)}</strong></p>
        <p>Fecha del pago · {fecha(cotizacion.fechaPago)}</p>
        <p>Vigencia · {fecha(cotizacion.fechaInicio)} al {fecha(cotizacion.fechaFin)}</p>
      </>}
      <button type="button" className="pi-boton pi-boton-primario" disabled={confirmando || (!pendiente && (!previa || !turno))}
        onClick={cobrar}>{confirmando ? 'Confirmando…' : pendiente ? 'Reintentar cobro' : 'Confirmar pago en efectivo'}</button>
      {!pendiente && <button type="button" className="pi-boton pi-boton-secundario" onClick={() => setAbierto(false)}>Cancelar</button>}
    </>}
    {error && <p className="pi-error" role="alert">{error}</p>}
  </div>
}
