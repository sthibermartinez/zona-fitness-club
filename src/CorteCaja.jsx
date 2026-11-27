import { useEffect, useRef, useState } from 'react'
import { Copy, MessageCircle } from 'lucide-react'
import { supabase } from './supabase'

const campos = [
  { id: 'sencillo', etiqueta: 'Sencillo que dejé', mensaje: 'Sencillo' },
  { id: 'retirado', etiqueta: 'Dinero que saqué', mensaje: 'Saqué' },
  { id: 'guardado', etiqueta: 'Dinero que guardé', mensaje: 'Guardé' }
]
const vacio = { sencillo: '', retirado: '', guardado: '' }
const quetzales = monto => `Q${Number(monto).toFixed(2)}`
const zonaGuatemala = 'America/Guatemala'
const fechaCorte = new Intl.DateTimeFormat('es-GT', {
  timeZone: zonaGuatemala, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
})
const horaCorte = new Intl.DateTimeFormat('es-GT', {
  timeZone: zonaGuatemala, hour: 'numeric', minute: '2-digit', hour12: true
})

function textoCorte(datos) {
  const instante = datos.creado_en ? new Date(datos.creado_en) : new Date()
  const { weekday, day, month, year } = Object.fromEntries(
    fechaCorte.formatToParts(instante).map(({ type, value }) => [type, value])
  )
  return [
    `${weekday[0].toLocaleUpperCase('es-GT') + weekday.slice(1)} ${day} de ${month} de ${year}`,
    `Hora ${horaCorte.format(instante)}`,
    ...campos.map(({ id, mensaje }) => `${mensaje} ${quetzales(datos[id])}`)
  ].join('\n')
}

const enlaceWhatsApp = datos => `https://wa.me/?text=${encodeURIComponent(textoCorte(datos))}`

function AccionCorte({ corte, accion, cerrar, alGuardar }) {
  const [montos, setMontos] = useState(() => Object.fromEntries(
    campos.map(({ id }) => [id, Number(corte[id]).toFixed(2)])
  ))
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [procesando, setProcesando] = useState(false)
  const ocupado = useRef(false)
  const editar = accion === 'editar'

  async function confirmar(evento) {
    evento.preventDefault()
    if (ocupado.current) return
    ocupado.current = true
    setProcesando(true)
    setError('')
    try {
      const { data, error } = await supabase.rpc('modificar_corte_privado', {
        p_id: corte.id, p_accion: accion, p_pin: pin,
        ...(editar ? { p_sencillo: Number(montos.sencillo), p_retirado: Number(montos.retirado), p_guardado: Number(montos.guardado) } : {})
      })
      if (error) throw error
      alGuardar(data, accion)
    } catch (fallo) {
      setPin('')
      setError(fallo.code === 'P0001' ? fallo.message : 'No se pudo confirmar el cambio. Revisa tu conexión.')
    } finally {
      ocupado.current = false
      setProcesando(false)
    }
  }

  return <div className="content-card form-card">
    <h3>{editar ? 'Editar corte' : 'Confirmar eliminación'}</h3>
    <p>{new Date(corte.creado_en).toLocaleString('es-GT', { timeZone: zonaGuatemala })}</p>
    {!editar && <p>Se eliminará este corte de tu historial de caja.</p>}
    <form onSubmit={confirmar}>
      <div className="form-grid">
        {editar && campos.map(({ id, etiqueta }) => <label key={id}>{etiqueta}
          <input type="number" min="0" max="9999999999.99" step="0.01" required disabled={procesando}
            value={montos[id]} onChange={e => setMontos({ ...montos, [id]: e.target.value })} />
        </label>)}
        <label>Contraseña del corte
          <input type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{9}" maxLength={9}
            required value={pin} disabled={procesando} onChange={e => setPin(e.target.value)} />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="form-buttons">
        <button type="button" className="cancel-button" disabled={procesando} onClick={cerrar}>Cancelar</button>
        <button type="submit" className="primary-button" disabled={procesando}>
          {procesando ? 'Procesando…' : editar ? 'Guardar cambios' : 'Eliminar corte'}
        </button>
      </div>
    </form>
  </div>
}

export default function CorteCaja() {
  const [montos, setMontos] = useState(vacio)
  const [cortes, setCortes] = useState([])
  const [accionCorte, setAccionCorte] = useState(null)
  const [estado, setEstado] = useState('')
  const [error, setError] = useState('')
  const [errorHistorial, setErrorHistorial] = useState('')
  const [enlaceGuardado, setEnlaceGuardado] = useState('')
  const [guardando, setGuardando] = useState(false)
  const pendiente = useRef(null)
  const ocupado = useRef(false)
  const vistaPrevia = useRef(null)
  const valido = campos.every(({ id }) => /^\d{1,10}(\.\d{1,2})?$/.test(montos[id]))

  useEffect(() => {
    let vigente = true
    supabase.from('cortes_caja').select('id,creado_en,sencillo,retirado,guardado')
      .order('creado_en', { ascending: false }).limit(20)
      .then(({ data, error }) => {
        if (!vigente) return
        if (error) setErrorHistorial('No se pudieron cargar los últimos cortes.')
        else setCortes(actuales => [...actuales, ...data.filter(corte => !actuales.some(item => item.id === corte.id))].slice(0, 20))
      })
    return () => { vigente = false }
  }, [])

  async function copiar(datos) {
    setEstado('')
    setError('')
    try {
      await navigator.clipboard.writeText(textoCorte(datos))
      setEstado('Mensaje copiado.')
    } catch {
      if (datos === montos) {
        vistaPrevia.current?.focus()
        vistaPrevia.current?.select()
      }
      setError('El navegador no permitió copiar el mensaje.')
    }
  }

  async function guardar(evento) {
    evento.preventDefault()
    if (!valido || ocupado.current) return
    ocupado.current = true
    setGuardando(true)
    setError('')
    setEstado('')
    setEnlaceGuardado('')
    let ventana
    try {
      const registro = pendiente.current || { id: crypto.randomUUID(), ...montos }
      pendiente.current = registro
      try {
        ventana = window.open('about:blank', '_blank')
        if (ventana) ventana.opener = null
      } catch {
        ventana = null
      }
      const camposLectura = 'id,creado_en,sencillo,retirado,guardado'
      let respuesta = await supabase.from('cortes_caja').insert(registro).select(camposLectura).single()
      if (respuesta.error?.code === '23505') {
        respuesta = await supabase.from('cortes_caja').select(camposLectura).eq('id', registro.id).single()
      }
      if (respuesta.error) throw respuesta.error
      setCortes(actuales => [respuesta.data, ...actuales.filter(corte => corte.id !== registro.id)].slice(0, 20))
      pendiente.current = null
      setMontos(vacio)
      const enlace = enlaceWhatsApp(respuesta.data)
      setEnlaceGuardado(enlace)
      setEstado('Corte guardado. Elige el grupo en WhatsApp y pulsa Enviar.')
      if (ventana && !ventana.closed) {
        try { ventana.location.replace(enlace) } catch { ventana.close() }
      }
    } catch {
      ventana?.close()
      setError('No se pudo confirmar el guardado. Pulsa Guardar corte y abrir WhatsApp para reintentar.')
    } finally {
      ocupado.current = false
      setGuardando(false)
    }
  }

  return <>
    <div className="section-actions">
      <div><h2>Corte de caja</h2><p>Registra los montos en quetzales. La meta de sencillo es Q200.</p></div>
    </div>
    <div className="content-card form-card">
      <form onSubmit={guardar}>
        <div className="form-grid">
          {campos.map(({ id, etiqueta }) => <label key={id}>{etiqueta}
            <input type="number" inputMode="decimal" min="0" max="9999999999.99" step="0.01"
              value={montos[id]} required disabled={guardando || Boolean(pendiente.current)}
              onChange={evento => setMontos(actuales => ({ ...actuales, [id]: evento.target.value }))} />
          </label>)}
          {valido && <label>Mensaje del corte
            <textarea ref={vistaPrevia} rows={5} readOnly value={textoCorte(montos)} />
          </label>}
        </div>
        <div className="form-buttons">
          <button type="button" className="cancel-button" disabled={!valido} onClick={() => copiar(montos)}><Copy size={16} /> Copiar mensaje</button>
          <button type="submit" className="primary-button" disabled={!valido || guardando}><MessageCircle size={16} /> {guardando ? 'Guardando…' : 'Guardar corte y abrir WhatsApp'}</button>
        </div>
      </form>
      {estado && <p role="status">{estado}</p>}
      {enlaceGuardado && <a className="cancel-button" href={enlaceGuardado} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>}
      {error && <p role="alert">{error}</p>}
    </div>
    {accionCorte && <AccionCorte key={`${accionCorte.corte.id}-${accionCorte.accion}`} {...accionCorte}
      cerrar={() => setAccionCorte(null)} alGuardar={(corte, accion) => {
        setCortes(actuales => accion === 'eliminar' ? actuales.filter(item => item.id !== corte.id)
          : actuales.map(item => item.id === corte.id ? corte : item))
        setAccionCorte(null)
        setEnlaceGuardado('')
        setError('')
        setEstado(accion === 'eliminar' ? 'Corte eliminado.' : 'Corte actualizado.')
      }} />}
    <div className="content-card">
      <h3>Últimos cortes</h3>
      {errorHistorial && <p role="alert">{errorHistorial}</p>}
      {!errorHistorial && cortes.length === 0 && <p>Aún no hay cortes guardados.</p>}
      {cortes.length > 0 && <div className="table-container"><table>
        <thead><tr><th>Fecha</th><th>Sencillo</th><th>Saqué</th><th>Guardé</th><th>Acciones</th></tr></thead>
        <tbody>{cortes.map(corte => <tr key={corte.id}>
          <td>{new Date(corte.creado_en).toLocaleString('es-GT', { timeZone: zonaGuatemala })}</td>
          {campos.map(({ id }) => <td key={id}>{quetzales(corte[id])}</td>)}
          <td><div className="form-buttons">
            <button type="button" className="cancel-button" onClick={() => copiar(corte)}>Copiar mensaje</button>
            <button type="button" className="cancel-button" disabled={Boolean(accionCorte)} onClick={() => setAccionCorte({ corte, accion: 'editar' })}>Editar</button>
            <button type="button" className="cancel-button" disabled={Boolean(accionCorte)} onClick={() => setAccionCorte({ corte, accion: 'eliminar' })}>Eliminar</button>
          </div></td>
        </tr>)}</tbody>
      </table></div>}
    </div>
  </>
}
