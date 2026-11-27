import { useEffect, useRef, useState } from 'react'
import { Package, UserRound } from 'lucide-react'
import { supabase } from './supabase'
import './CajaTurno.css'

const zona = 'America/Guatemala'
const avisoDeVenta = 'zona-fitness:venta-registrada'

function avisarVentaRegistrada() {
  // Las otras pestañas solo reciben una señal. Consultan la venta con sus propios permisos.
  try {
    localStorage.setItem(avisoDeVenta, crypto.randomUUID())
  } catch {
    // Si el navegador bloquea el almacenamiento, queda la actualización periódica.
  }
}
const fechaCaja = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date())
const todosLosTurnos = 'Todos los turnos del día'
const metodosDePago = ['Efectivo', 'Transferencia', 'Depósito', 'Tarjeta']
const horaVenta = valor => new Date(valor).toLocaleTimeString('es-GT', {
  timeZone: zona, hour: '2-digit', minute: '2-digit'
})
const dinero = valor => `Q${Number(valor).toFixed(2)}`
const palabrasBusqueda = texto => texto.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  .match(/[a-z0-9]+/g)?.map(palabra => palabra.length > 3 ? palabra.replace(/s$/, '') : palabra) || []
const partes = texto => texto.trim().replace(/\s+/g, ' ')
export const nombreVisitanteValido = /^[\p{L}][\p{L} .'’-]* [\p{L}][\p{L}.'’-]* [\p{L}][\p{L}.'’-]*$/u

export function Visitante({ valor, cambiar, enAsistencia = false }) {
  const [resultados, setResultados] = useState([])
  const [error, setError] = useState('')
  const texto = valor.nombre
  const id = valor.id

  useEffect(() => {
    if (id || texto.trim().length < 2) return
    let vigente = true
    const timer = setTimeout(async () => {
      const respuesta = await supabase.rpc('buscar_visitantes', { p_texto: partes(texto) })
      if (!vigente) return
      setResultados(respuesta.data || [])
      setError(respuesta.error ? 'No se pudo buscar el visitante. Edita el nombre para reintentar.' : '')
    }, 250)
    return () => { vigente = false; clearTimeout(timer) }
  }, [id, texto])

  return <div className="caja-visitante">
    <label>Nombre y dos apellidos
      <input className={enAsistencia ? "pi-buscador" : undefined} autoFocus={enAsistencia} value={texto} maxLength={100} required placeholder="Luis Pérez García"
        onChange={e => {
          setResultados([])
          setError('')
          cambiar({ nombre: e.target.value })
        }} />
    </label>
    {id && <small>Visitante guardado seleccionado</small>}
    {error && <p role="alert">{error}</p>}
    {!id && resultados.map(persona => (
      <button key={persona.id} type="button" onClick={() => cambiar(persona)}>
        {persona.nombre} · {persona.visitas_cobradas} visitas · {persona.id.slice(0, 8)}
      </button>
    ))}
    {!id && resultados.length > 0 && <small>Selecciona el perfil de la lista para reutilizarlo. Si dejas el nombre escrito, se creará otro perfil al cobrar.</small>}
  </div>
}

const camposArticulos = 'linea,nombre,cantidad,precio_unitario'
const camposVentaAdmin = `nombre_cajero,metodo_pago,nombre_comprador,ventas_detalle(${camposArticulos},ventas_asistencias(visitantes(nombre)))`

function ArticulosVenta({ articulos }) {
  return <ul className="caja-articulos">
    {[...articulos].sort((a, b) => a.linea - b.linea).map(linea =>
      <li key={linea.linea}>
        {linea.cantidad} × {linea.nombre} · {dinero(linea.precio_unitario)} c/u
        {linea.ventas_asistencias?.map(({ visitantes }, i) =>
          visitantes?.nombre && <small key={i}>{visitantes.nombre}</small>
        )}
      </li>
    )}
  </ul>
}

function UltimaVenta({ venta }) {
  return <details>
    <summary className="caja-recibo pi-verificacion">
      <span>{horaVenta(venta.cobrada_en)}</span>
      <strong>{dinero(venta.total)}</strong>
    </summary>
    <div className="caja-detalle">
      <p>{venta.metodo_pago}</p>
      {venta.nombre_comprador && <p>{venta.nombre_comprador}</p>}
      <ArticulosVenta articulos={venta.ventas_detalle} />
    </div>
  </details>
}

function TablaVentas({ ventas, turnos }) {
  return <div className="table-container caja-tabla" role="region" aria-label="Ventas de la hoja de caja" tabIndex={0}>
    <table>
      <thead><tr>
        <th scope="col">Hora</th>
        <th scope="col">Turno</th>
        <th scope="col">Detalle de venta</th>
        <th scope="col">Método de pago</th>
        <th scope="col">Cobrado por</th>
        <th scope="col">Importe</th>
      </tr></thead>
      <tbody>{ventas.map(venta => (
        <tr key={venta.id}>
          <td>{horaVenta(venta.cobrada_en)}</td>
          <td>{turnos.find(turno => String(turno.id) === String(venta.turno_id))?.etiqueta || '—'}</td>
          <td>
            {venta.nombre_comprador && <p>{venta.nombre_comprador}</p>}
            <ArticulosVenta articulos={venta.ventas_detalle} />
          </td>
          <td>{venta.metodo_pago}</td>
          <td>{venta.nombre_cajero}</td>
          <td><strong>{dinero(venta.total)}</strong></td>
        </tr>
      ))}</tbody>
    </table>
  </div>
}

function HistorialCaja({ revision, soloUltima, turnoFiltro, turnos }) {
  const [ventas, setVentas] = useState([])
  const [error, setError] = useState('')
  const [fecha, setFecha] = useState(fechaCaja)
  useEffect(() => {
    let vigente = true
    let consultaActual = 0
    async function leer() {
      const numeroConsulta = ++consultaActual
      const hoy = fechaCaja()
      const inicio = new Date(`${hoy}T00:00:00-06:00`)
      const fin = new Date(inicio.getTime() + 86400000)
      const registros = []
      for (let offset = 0; ; offset += 200) {
        let consulta = supabase.from('ventas')
          .select(`id,cobrada_en,total,turno_id,${soloUltima
            ? `metodo_pago,nombre_comprador,ventas_detalle(${camposArticulos})`
            : camposVentaAdmin}`)
          .order('cobrada_en', { ascending: !soloUltima }).order('id')
        consulta = soloUltima ? consulta.limit(1) : consulta
          .gte('cobrada_en', inicio.toISOString()).lt('cobrada_en', fin.toISOString()).range(offset, offset + 199)
        const { data, error } = await consulta
        if (!vigente || numeroConsulta !== consultaActual) return
        if (error) { setError('No se pudieron consultar las ventas.'); return }
        registros.push(...data)
        if (soloUltima || data.length < 200) break
      }
      setError('')
      setFecha(hoy)
      setVentas(registros)
    }
    leer()
    const timer = setInterval(leer, 30000)
    function recibirAviso(evento) {
      if (!soloUltima && evento.key === avisoDeVenta && evento.newValue) leer()
    }
    window.addEventListener('storage', recibirAviso)
    window.addEventListener('focus', leer)
    return () => {
      vigente = false
      clearInterval(timer)
      window.removeEventListener('storage', recibirAviso)
      window.removeEventListener('focus', leer)
    }
  }, [revision, soloUltima])

  const visibles = turnoFiltro ? ventas.filter(venta => String(venta.turno_id) === turnoFiltro) : ventas
  const total = visibles.reduce((suma, venta) => suma + Math.round(Number(venta.total) * 100), 0) / 100
  return <div className="caja-historial">
    <div className="caja-hoja-titulo">
      <div>
        <h3 className={soloUltima ? 'pi-etiqueta' : undefined}>{soloUltima ? 'Última venta' : 'Hoja de caja'}</h3>
        {!soloUltima && <p>{fecha.split('-').reverse().join('/')} · {turnos.find(turno => String(turno.id) === turnoFiltro)?.etiqueta || todosLosTurnos}</p>}
      </div>
      {!soloUltima && <p className="caja-total-dia"><span>Total cobrado</span><strong>{dinero(total)}</strong></p>}
    </div>
    {error && <p role="alert">{error}</p>}
    {visibles.length === 0 ? <p>Aún no hay ventas para mostrar.</p>
      : soloUltima ? <UltimaVenta venta={visibles[0]} />
      : <TablaVentas ventas={visibles} turnos={turnos} />}
  </div>
}

export default function CajaTurno({ operador, turnoId, solicitud, alCobrar, administrador = false, SelectorOpcion }) {
  const [catalogo, setCatalogo] = useState([])
  const [turnos, setTurnos] = useState([])
  const [turnoElegido, setTurnoElegido] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [mostrarPersonalizado, setMostrarPersonalizado] = useState(false)
  const [cantidades, setCantidades] = useState({})
  const [visitantes, setVisitantes] = useState([])
  const [metodo, setMetodo] = useState('Efectivo')
  const [revision, setRevision] = useState(0)
  const [carga, setCarga] = useState(0)
  const [personalizado, setPersonalizado] = useState({ nombre: '', precio: '' })
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [errorCarga, setErrorCarga] = useState('')
  const [procesando, setProcesando] = useState(false)
  const clave = `zfc-cobro-pendiente-${operador}`
  const [pendiente, setPendiente] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(clave)) } catch { return null }
  })
  const procesandoRef = useRef(false)
  const seccion = useRef(null)
  const aplicado = useRef(null)
  const visita = catalogo.find(producto => producto.es_visita)
  const opcionesTurno = turnos.map(turno => ({ ...turno, etiqueta: `Turno ${turno.numero}` }))
  const turnoSeleccionado = opcionesTurno.find(turno => String(turno.id) === turnoElegido)
  const turnoActivo = administrador
    ? (turnoSeleccionado?.estado === 'abierto' ? turnoSeleccionado.id : null)
    : turnoId

  useEffect(() => {
    let vigente = true
    const consultaTurnos = administrador
      ? supabase.from('turnos').select('id,fecha,numero,estado').eq('fecha', fechaCaja()).order('numero')
      : Promise.resolve({ data: [] })
    Promise.all([supabase.rpc('catalogo_caja'), consultaTurnos]).then(([productos, abiertos]) => {
      if (!vigente) return
      setErrorCarga(productos.error || abiertos.error ? 'No se pudo cargar la caja. Revisa la instalación o vuelve a intentar.' : '')
      setCatalogo(productos.data || [])
      setTurnos(abiertos.data || [])
    })
    return () => { vigente = false }
  }, [administrador, carga])

  useEffect(() => {
    if (!solicitud || solicitud === aplicado.current || !visita || pendiente) return
    aplicado.current = solicitud
    setVisitantes(actuales => [...actuales, solicitud])
    seccion.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [solicitud, visita, pendiente])

  const productos = catalogo.filter(producto => !producto.es_visita)
  const palabras = palabrasBusqueda(busqueda)
  const coincidencias = palabras.length ? productos.filter(producto =>
    palabras.every(palabra => palabrasBusqueda(producto.nombre).some(parte => parte.includes(palabra)))
  ) : []
  const seleccionados = productos.filter(producto => Object.hasOwn(cantidades, producto.id))

  const lineas = catalogo.flatMap(producto => {
    const cantidad = producto.es_visita ? visitantes.length : Number(cantidades[producto.id] || 0)
    if (!cantidad) return []
    const linea = { producto_id: producto.id, cantidad, precio_unitario: producto.precio }
    if (producto.es_visita) linea.asistentes = visitantes.map(persona => persona.id ? { id: persona.id } : { nombre: partes(persona.nombre) })
    return [linea]
  })
  const precioPersonalizado = Number(personalizado.precio)
  if (personalizado.nombre.trim() && precioPersonalizado > 0) {
    lineas.push({ nombre: partes(personalizado.nombre), cantidad: 1, precio_unitario: precioPersonalizado })
  }
  const total = lineas.reduce((suma, linea) => suma + linea.cantidad * Math.round(linea.precio_unitario * 100), 0) / 100

  async function cobrar(evento) {
    evento.preventDefault()
    if (procesandoRef.current) return
    setError('')
    setMensaje('')
    if (!pendiente && (!turnoActivo || !lineas.length || visitantes.some(p => !p.id && !nombreVisitanteValido.test(partes(p.nombre))))) {
      setError('Selecciona un turno abierto y revisa la cuenta. Cada visita nueva requiere nombre y dos apellidos.')
      return
    }
    if (!pendiente && Boolean(personalizado.nombre.trim()) !== Boolean(precioPersonalizado > 0)) {
      setError('Completa el nombre y el precio del producto personalizado.')
      return
    }

    const datos = pendiente || { p_operacion: crypto.randomUUID(), p_turno_id: turnoActivo, p_metodo: metodo, p_lineas: lineas }
    try {
      sessionStorage.setItem(clave, JSON.stringify(datos))
    } catch {
      setError('El navegador no pudo guardar el reintento de la cuenta. Habilita el almacenamiento de la sesión.')
      return
    }
    procesandoRef.current = true
    setProcesando(true)
    setPendiente(datos)
    try {
      const { data, error } = await supabase.rpc('cobrar_cuenta', datos)
      if (error) {
        if (/^(P0001|22\d{3}|23\d{3})$/.test(error.code || '') && !error.message.includes('clave ya corresponde')) {
          sessionStorage.removeItem(clave)
          setPendiente(null)
          setError(error.message)
          setCarga(valor => valor + 1)
        } else {
          setError('El cobro todavía no se pudo verificar. Usa Reintentar cobro para consultar o completar esa misma cuenta.')
        }
        return
      }
      sessionStorage.removeItem(clave)
      setPendiente(null)
      setCantidades({})
      setBusqueda('')
      setMostrarPersonalizado(false)
      setVisitantes([])
      setPersonalizado({ nombre: '', precio: '' })
      setMensaje(`Cobro guardado · ${dinero(data.total)}`)
      setRevision(valor => valor + 1)
      avisarVentaRegistrada()
      alCobrar?.()
    } catch {
      setError('Se perdió la conexión. Usa Reintentar cobro para conservar la misma referencia.')
    } finally {
      procesandoRef.current = false
      setProcesando(false)
    }
  }

  const campoMetodoPago = administrador ? (
    <div className="caja-metodo-campo caja-selector">
      <span>Método de pago</span>
      <SelectorOpcion value={metodo} options={metodosDePago} onChange={setMetodo} />
    </div>
  ) : <label><span className="pi-dato-etiqueta">Método de pago</span>
    <select value={metodo} onChange={e => setMetodo(e.target.value)}>
      {metodosDePago.map(opcion => <option key={opcion}>{opcion}</option>)}
    </select>
  </label>

  return <section ref={seccion} className={`caja-turno ${administrador ? 'content-card caja-admin' : 'pi-tarjeta pi-seccion'}`}>
    <div className="caja-titulo">
      <h2 className={administrador ? undefined : 'pi-etiqueta'}>Caja del turno</h2>
      {administrador && <button type="button" className="cancel-button" onClick={() => setCarga(valor => valor + 1)}>Actualizar catálogo y turnos</button>}
    </div>
    {errorCarga && <p role="alert">{errorCarga} <button type="button" onClick={() => setCarga(valor => valor + 1)}>Reintentar carga</button></p>}
    {!turnoActivo && !pendiente && <p className={administrador ? undefined : 'pi-texto'}>
      {administrador ? 'Selecciona un turno abierto para registrar un cobro.' : 'Abre el turno para comenzar a registrar ventas.'}
    </p>}
    <form onSubmit={cobrar} hidden={!administrador && !turnoActivo && !pendiente}>
      <fieldset disabled={Boolean(pendiente)} className="caja-campos">
        {administrador && <div className="caja-turno-campo caja-selector">
          <span>Turno</span>
          <SelectorOpcion value={turnoSeleccionado?.etiqueta || todosLosTurnos}
            options={[todosLosTurnos, ...opcionesTurno.map(turno => turno.etiqueta)]}
            onChange={opcion => {
              const turno = opcionesTurno.find(item => item.etiqueta === opcion)
              setTurnoElegido(turno ? String(turno.id) : '')
            }} />
        </div>}
        {administrador && campoMetodoPago}
        <div className="caja-productos">
          <label><span className={administrador ? undefined : 'pi-dato-etiqueta'}>Buscar producto</span>
            <input className={administrador ? undefined : 'pi-buscador'} type="search" value={busqueda} placeholder="Buscar por nombre del producto"
              onChange={e => setBusqueda(e.target.value)} />
          </label>
          {palabras.length > 0 && coincidencias.length === 0 && <small>No se encontraron productos.</small>}
          {coincidencias.length > 0 && <ul className="caja-resultados" aria-label="Productos encontrados">
            {coincidencias.map(producto => <li key={producto.id}>
              <button type="button" className={administrador ? undefined : "pi-cliente"} onClick={() => {
                setCantidades(actual => ({ ...actual, [producto.id]: Math.min(999, Number(actual[producto.id] || 0) + 1) }))
                setBusqueda('')
              }}>{producto.nombre} <span>{dinero(producto.precio)}</span></button>
            </li>)}
          </ul>}
          {seleccionados.map(producto => <div className={`caja-linea ${administrador ? '' : 'pi-verificacion'}`} key={producto.id}>
            <span className="caja-item"><Package size={18} aria-hidden="true" /><span><strong>{producto.nombre}</strong><small>{dinero(producto.precio)} c/u</small></span></span>
            <label>Cantidad
              <input type="number" min="1" step="1" max="999" required value={cantidades[producto.id]}
                aria-label={`Cantidad de ${producto.nombre}`}
                onChange={e => setCantidades(actual => ({ ...actual, [producto.id]: e.target.value }))} />
            </label>
            <button type="button" className={administrador ? undefined : "pi-boton pi-boton-secundario"} aria-label={`Quitar ${producto.nombre}`} onClick={() =>
              setCantidades(actual => Object.fromEntries(Object.entries(actual).filter(([id]) => id !== producto.id)))
            }>Quitar</button>
          </div>)}
          <button type="button" className={administrador ? "caja-opcional cancel-button" : "caja-opcional pi-boton pi-boton-secundario"} aria-expanded={mostrarPersonalizado}
            onClick={() => {
              if (mostrarPersonalizado) setPersonalizado({ nombre: '', precio: '' })
              setMostrarPersonalizado(actual => !actual)
            }}>{mostrarPersonalizado ? 'Quitar producto personalizado' : 'Agregar producto personalizado'}</button>
        </div>
        {mostrarPersonalizado && <>
          <label>Producto personalizado
            <input value={personalizado.nombre} maxLength={100}
              onChange={e => setPersonalizado(actual => ({ ...actual, nombre: e.target.value }))} />
          </label>
          <label>Precio personalizado (Q)
            <input type="number" min="0.01" step="0.01" value={personalizado.precio}
              onChange={e => setPersonalizado(actual => ({ ...actual, precio: e.target.value }))} />
          </label>
        </>}
        {visita && (administrador || visitantes.length > 0) && <div className="caja-visitas">
          {administrador && <button type="button" className="primary-button" onClick={() => setVisitantes(actuales => [...actuales, { nombre: '' }])}>Agregar visita · {dinero(visita.precio)}</button>}
          {visitantes.map((persona, indice) => <div className="caja-ficha" key={indice}>
            {administrador
              ? <Visitante valor={persona} cambiar={valor => setVisitantes(actuales => actuales.map((item, i) => i === indice ? valor : item))} />
              : <span className="caja-item"><UserRound size={18} aria-hidden="true" /><span><strong>{persona.nombre}</strong><small>Visita · {dinero(visita.precio)}</small></span></span>}
            <button type="button" className={administrador ? undefined : "pi-boton pi-boton-secundario"} onClick={() => setVisitantes(actuales => actuales.filter((_, i) => i !== indice))}>Quitar visita {indice + 1}</button>
          </div>)}
        </div>}
        {!administrador && campoMetodoPago}
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {mensaje && <p role="status">{mensaje}</p>}
      <div className={`caja-total ${administrador ? '' : 'pi-verificacion'}`}>
        <div><span>Total de la cuenta</span><strong>{dinero(pendiente ? pendiente.p_lineas.reduce((suma, linea) => suma + linea.cantidad * Math.round(linea.precio_unitario * 100), 0) / 100 : total)}</strong></div>
        <button type="submit" className={administrador ? 'primary-button' : 'pi-boton pi-boton-primario pi-boton-grande'}
        disabled={procesando || (!pendiente && (!turnoActivo || !total || Boolean(errorCarga)))}>
        {procesando ? 'Guardando…' : pendiente ? 'Reintentar cobro' : 'Registrar cobro'}
        </button>
      </div>
    </form>
    <HistorialCaja revision={revision} soloUltima={!administrador} turnoFiltro={turnoSeleccionado ? turnoElegido : ''} turnos={opcionesTurno} />
  </section>
}
