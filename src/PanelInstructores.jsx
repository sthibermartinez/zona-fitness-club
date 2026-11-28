import { useCallback, useEffect, useRef, useState } from 'react'
import { Users, Sun, Moon } from 'lucide-react'
import { supabase } from './supabase'
import './PanelInstructores.css'
import Mediciones from './Mediciones'
import RenovarRecepcion from './RenovarRecepcion'
import CajaTurno, { Visitante, nombreVisitanteValido } from './CajaTurno'

// Misma preferencia de tema que usa el panel administrativo y la pantalla de login
const CLAVE_TEMA = 'zona-fitness-tema'

function leerTemaGuardado() {
  return localStorage.getItem(CLAVE_TEMA) === 'oscuro'
}

function formatearHora(hora) {
  if (!hora) return ''
  const [h, m] = hora.split(':').map(Number)
  const sufijo = h >= 12 ? 'PM' : 'AM'
  const hora12 = h % 12 === 0 ? 12 : h % 12
  return `${hora12}:${String(m).padStart(2, '0')} ${sufijo}`
}

function formatearHoraRegistro(fechaIso) {
  if (!fechaIso) return ''
  return new Date(fechaIso).toLocaleTimeString('es-GT', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Guatemala'
  })
}

function formatearFechaCorta(fecha) {
  if (!fecha) return 'Sin fecha'
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

// Resultado de la verificación de la membresía de un cliente
function obtenerEstadoCliente(cliente) {
  if (!cliente.activo) return 'inactivo'
  if (!cliente.vencimiento) return 'pendiente'
  if (cliente.vigente) return 'vigente'
  const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Guatemala' }).format(new Date())
  return cliente.vencimiento < hoy ? 'vencida' : 'pendiente'
}

const ETIQUETAS_CLIENTE = {
  vigente: 'Vigente',
  vencida: 'Vencida',
  inactivo: 'Inactivo',
  pendiente: 'Sin vigencia actual'
}

const ETIQUETAS_ESTADO = {
  pendiente: 'Pendiente',
  abierto: 'Abierto',
  cerrado: 'Cerrado'
}

// Pantalla para cuentas sin acceso o cuando no se pudo verificar el perfil
export function PantallaAcceso({ titulo, mensaje, onReintentar }) {
  return (
    <div className={`pi-pantalla pi-centrado ${leerTemaGuardado() ? 'pi-oscuro' : ''}`}>
      <div className="pi-tarjeta pi-tarjeta-acceso">
        <p className="pi-marca">ZONA FITNESS CLUB</p>
        <h1 className="pi-titulo">{titulo}</h1>
        <p className="pi-texto">{mensaje}</p>
        <div className="pi-acciones">
          {onReintentar && (
            <button type="button" className="pi-boton pi-boton-primario" onClick={onReintentar}>
              Reintentar
            </button>
          )}
          <button
            type="button"
            className="pi-boton pi-boton-secundario"
            onClick={() => supabase.auth.signOut({ scope: 'local' })}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

// Panel exclusivo para instructores (etapa 3: abrir y cerrar turno)
function PanelInstructores({ perfil, SelectorOpcion, SelectorFecha }) {
  const [mostrarMediciones, setMostrarMediciones] = useState(false)
  const [ahora, setAhora] = useState(() => new Date())

useEffect(() => {
  const intervaloReloj = setInterval(() => {
    setAhora(new Date())
  }, 1000)

  return () => clearInterval(intervaloReloj)
}, [])
  const [turno, setTurno] = useState(null)
  const [error, setError] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [confirmandoCierre, setConfirmandoCierre] = useState(false)
  const [borradorVisita, setBorradorVisita] = useState(null)
  const [solicitudVisita, setSolicitudVisita] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [registrando, setRegistrando] = useState(false)
  const [errorAsistencia, setErrorAsistencia] = useState('')
  const [mensajeExito, setMensajeExito] = useState('')
  const solicitudBusqueda = useRef(0)
  const [modoOscuro, setModoOscuro] = useState(leerTemaGuardado)

  // Guarda el tema elegido (se conserva al recargar la página)
  useEffect(() => {
    localStorage.setItem(CLAVE_TEMA, modoOscuro ? 'oscuro' : 'claro')
  }, [modoOscuro])

  // Misma animación circular (View Transition) que el panel administrativo
  const cambiarTema = (evento) => {
    const rect = evento.currentTarget.getBoundingClientRect()

    document.documentElement.style.setProperty('--theme-origin-x', `${rect.left + rect.width / 2}px`)
    document.documentElement.style.setProperty('--theme-origin-y', `${rect.top + rect.height / 2}px`)

    const actualizarTema = () => {
      setModoOscuro((anterior) => !anterior)
    }

    if (document.startViewTransition) {
      document.startViewTransition(actualizarTema)
    } else {
      actualizarTema()
    }
  }

  const consultarTurno = useCallback(async () => {
    const { data, error: errorRpc } = await supabase.rpc('turno_actual')

    if (errorRpc) {
      console.error('Error consultando el turno:', errorRpc)
      setError('No se pudo consultar el turno. Revisa tu conexión a internet.')
      return
    }

    setError('')
    setTurno(data)
  }, [])

  useEffect(() => {
    consultarTurno()
    const intervalo = setInterval(consultarTurno, 30000)

    return () => clearInterval(intervalo)
  }, [consultarTurno])

  async function abrirTurno() {
    if (procesando) return

    setProcesando(true)
    setErrorAccion('')

    const { data, error: errorRpc } = await supabase.rpc('abrir_turno')

    if (errorRpc) {
      console.error('Error abriendo el turno:', errorRpc)
      setErrorAccion(errorRpc.message || 'No se pudo abrir el turno.')
      await consultarTurno()
    } else {
      setTurno(data)
    }

    setProcesando(false)
  }

  async function cerrarTurno() {
    if (procesando || !turno?.turno_id) return

    setProcesando(true)
    setErrorAccion('')

    const { error: errorRpc } = await supabase.rpc('cerrar_turno', {
      p_turno_id: turno.turno_id
    })

    if (errorRpc) {
      console.error('Error cerrando el turno:', errorRpc)
      setErrorAccion(errorRpc.message || 'No se pudo cerrar el turno.')
    }

    setConfirmandoCierre(false)
    await consultarTurno()
    setProcesando(false)
  }

  // Búsqueda de clientes (espera 300 ms después de escribir)
  useEffect(() => {
    const texto = busqueda.trim()

    if (texto.length < 2) {
      solicitudBusqueda.current += 1
      setResultados([])
      setBuscando(false)
      setErrorBusqueda('')
      return
    }

    solicitudBusqueda.current += 1
    const idSolicitud = solicitudBusqueda.current
    setBuscando(true)

    const temporizador = setTimeout(async () => {
      const { data, error: errorRpc } = await supabase.rpc('buscar_clientes', {
        p_texto: texto
      })

      // Ignora respuestas de búsquedas anteriores
      if (idSolicitud !== solicitudBusqueda.current) return

      if (errorRpc) {
        console.error('Error buscando clientes:', errorRpc)
        setErrorBusqueda('No se pudo buscar. Revisa tu conexión a internet.')
        setResultados([])
      } else {
        setErrorBusqueda('')
        setResultados(Array.isArray(data) ? data : [])
      }

      setBuscando(false)
    }, 300)

    return () => clearTimeout(temporizador)
  }, [busqueda])

  // El mensaje de éxito desaparece solo
  useEffect(() => {
    if (!mensajeExito) return
    const temporizador = setTimeout(() => setMensajeExito(''), 5000)
    return () => clearTimeout(temporizador)
  }, [mensajeExito])

  async function registrarAsistencia() {
    if (registrando || !seleccionado) return

    setRegistrando(true)
    setErrorAsistencia('')
    setMensajeExito('')

    const { data, error: errorRpc } = await supabase.rpc('registrar_asistencia', {
      p_cliente_id: seleccionado.id
    })

    if (errorRpc) {
      console.error('Error registrando la asistencia:', errorRpc)
      setErrorAsistencia(errorRpc.message || 'No se pudo registrar la asistencia.')
    } else {
      setMensajeExito(`Asistencia registrada: ${data?.cliente || seleccionado.nombre}`)
      setSeleccionado(null)
      setBusqueda('')
      setResultados([])
    }

    await consultarTurno()
    setRegistrando(false)
  }

  function seleccionarCliente(cliente) {
    setSeleccionado(cliente)
    setErrorAsistencia('')
    setMensajeExito('')
  }

  const estadoSeleccionado = seleccionado ? obtenerEstadoCliente(seleccionado) : null

  return (
    <div className={`pi-pantalla ${modoOscuro ? 'pi-oscuro' : ''}`}>
      <header className="pi-encabezado">
        <div>
          <p className="pi-marca">ZONA FITNESS CLUB</p>
          <small className="pi-lema">Donde empieza tu cambio</small>
        </div>
        <div className="pi-reloj">
  <span className="pi-reloj-hora">
    {ahora.toLocaleTimeString('es-GT', {
      timeZone: 'America/Guatemala',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })}
  </span>

  <span className="pi-reloj-fecha">
    {ahora.toLocaleDateString('es-GT', {
      timeZone: 'America/Guatemala',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })}
  </span>
</div>
        <div className="pi-usuario">
          <button
            type="button"
            className="pi-tema"
            onClick={cambiarTema}
            title={modoOscuro ? 'Activar modo claro' : 'Activar modo oscuro'}
            aria-label={modoOscuro ? 'Activar modo claro' : 'Activar modo oscuro'}
          >
            {modoOscuro ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <span className="pi-usuario-nombre">{perfil.nombre_completo}</span>
          <span className="pi-avatar">{perfil.nombre_completo.trim().charAt(0).toUpperCase()}</span>
          <button
            type="button"
            className="pi-boton pi-boton-secundario"
            onClick={() => supabase.auth.signOut({ scope: 'local' })}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="pi-contenido">
        <nav className="pi-navegacion" aria-label="Panel del instructor">
          <button type="button" aria-pressed={!mostrarMediciones}
            className={`pi-boton ${mostrarMediciones ? 'pi-boton-secundario' : 'pi-boton-primario'}`}
            onClick={() => setMostrarMediciones(false)}>Asistencia y caja</button>
          <button type="button" aria-pressed={mostrarMediciones}
            className={`pi-boton ${mostrarMediciones ? 'pi-boton-primario' : 'pi-boton-secundario'}`}
            onClick={() => setMostrarMediciones(true)}>Mediciones</button>
        </nav>
        <div hidden={mostrarMediciones} className="pi-operacion-turno">
        <div className="pi-pagina-titulo">
          <h1>Asistencia</h1>
          <p>Abre tu turno y registra la asistencia de los clientes.</p>
        </div>

        <section className="pi-tarjeta">
          <p className="pi-etiqueta">TURNO ACTUAL</p>

          {error && <p className="pi-error">{error}</p>}

          {!error && !turno && <p className="pi-texto">Consultando turno...</p>}

          {!error && turno?.fuera_de_horario && (
            <>
              <h1 className="pi-titulo">Fuera de horario</h1>
              <p className="pi-texto">
                El gimnasio atiende de 5:00 AM a 10:00 PM. No hay un turno activo en este momento.
              </p>
            </>
          )}

          {!error && turno && !turno.fuera_de_horario && (
            <>
              <h1 className="pi-titulo">{turno.nombre}</h1>
              <p className="pi-texto">
                {formatearHora(turno.hora_inicio)} a {formatearHora(turno.hora_fin)}
              </p>
              <span className={`pi-estado pi-estado-${turno.estado}`}>
                {ETIQUETAS_ESTADO[turno.estado] || turno.estado}
              </span>

              {errorAccion && <p className="pi-error">{errorAccion}</p>}

              {turno.estado === 'pendiente' && (
                <button
                  type="button"
                  className="pi-boton pi-boton-primario pi-boton-grande"
                  onClick={abrirTurno}
                  disabled={procesando}
                >
                  {procesando ? 'Abriendo turno...' : 'Abrir turno'}
                </button>
              )}

              {turno.estado === 'abierto' && (
                <>
                  <div className="pi-datos">
                    <div className="pi-dato">
                      <p className="pi-dato-etiqueta">ABIERTO POR</p>
                      <p className="pi-dato-valor">{turno.abierto_por}</p>
                    </div>
                    <div className="pi-dato">
                      <p className="pi-dato-etiqueta">HORA DE APERTURA</p>
                      <p className="pi-dato-valor">{formatearHoraRegistro(turno.abierto_en)}</p>
                    </div>
                    <div className="pi-dato">
                      <p className="pi-dato-etiqueta">ASISTENCIAS</p>
                      <p className="pi-dato-valor">{turno.total_asistencias}</p>
                    </div>
                  </div>

                  {turno.es_mio ? (
                    <button
                      type="button"
                      className="pi-boton pi-boton-secundario pi-boton-grande"
                      onClick={() => setConfirmandoCierre(true)}
                      disabled={procesando}
                    >
                      Cerrar turno
                    </button>
                  ) : (
                    <p className="pi-texto">
                      Este turno lo abrió {turno.abierto_por}. Solo esa persona o el administrador puede cerrarlo.
                    </p>
                  )}
                </>
              )}

              {turno.estado === 'cerrado' && (
                <div className="pi-datos">
                  <div className="pi-dato">
                    <p className="pi-dato-etiqueta">HORA DE CIERRE</p>
                    <p className="pi-dato-valor">{formatearHoraRegistro(turno.cerrado_en)}</p>
                  </div>
                  <div className="pi-dato">
                    <p className="pi-dato-etiqueta">ASISTENCIAS</p>
                    <p className="pi-dato-valor">{turno.total_asistencias}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {!error && turno && !turno.fuera_de_horario && turno.estado !== 'abierto' && (
          <section className="pi-tarjeta pi-seccion">
            <p className="pi-etiqueta">REGISTRAR ASISTENCIA</p>
            <p className="pi-texto">
              {turno.estado === 'pendiente'
                ? 'Abre el turno para comenzar a registrar asistencias.'
                : 'El turno está cerrado. Ya no se pueden registrar asistencias.'}
            </p>
          </section>
        )}

        {!error && turno?.estado === 'abierto' && (
          <section className="pi-tarjeta pi-seccion">
            <p className="pi-etiqueta">REGISTRAR ASISTENCIA</p>

            {mensajeExito && <p className="pi-exito">{mensajeExito}</p>}

            {borradorVisita ? (
              <form className="caja-visita-asistencia" onSubmit={evento => {
                evento.preventDefault()
                const nombre = borradorVisita.nombre.trim().replace(/\s+/g, ' ')
                if (!borradorVisita.id && !nombreVisitanteValido.test(nombre)) return
                setSolicitudVisita({ ...borradorVisita, nombre })
                setBorradorVisita(null)
              }}>
                <Visitante enAsistencia valor={borradorVisita} cambiar={setBorradorVisita} />
                <div className="caja-acciones-visita">
                  <button type="button" className="pi-boton pi-boton-secundario" onClick={() => setBorradorVisita(null)}>Volver a asistencia</button>
                  <button type="submit" className="pi-boton pi-boton-primario"
                    disabled={!borradorVisita.id && !nombreVisitanteValido.test(borradorVisita.nombre.trim().replace(/\s+/g, ' '))}>
                    Agregar a la cuenta
                  </button>
                </div>
              </form>
            ) : <>
              <button type="button" className="pi-boton pi-boton-primario caja-acceso-visita"
                onClick={() => setBorradorVisita({ nombre: !seleccionado && resultados.length === 0 && /\p{L}/u.test(busqueda) ? busqueda.trim() : '' })}>
                Agregar visita
              </button>

            <input
              type="search"
              className="pi-buscador"
              placeholder="Buscar por nombre, apellido o teléfono"
              value={busqueda}
              onChange={evento => {
                const campo = evento.currentTarget
                const posicion = campo.selectionStart
                const capitalizar = texto => texto.replace(/(^|[^\p{L}\p{M}\p{N}])(\p{L})/gu,
                  (_, separador, inicial) => separador + inicial.toLocaleUpperCase('es-GT'))
                const valor = capitalizar(campo.value)
                if (valor !== campo.value) {
                  const cursor = posicion === null ? null : capitalizar(campo.value.slice(0, posicion)).length
                  campo.value = valor
                  if (cursor !== null) campo.setSelectionRange(cursor, cursor)
                }
                setBusqueda(valor)
                setSeleccionado(null)
                setErrorAsistencia('')
              }}
              autoComplete="off"
            />

            {errorBusqueda && <p className="pi-error">{errorBusqueda}</p>}

            {buscando && <p className="pi-texto">Buscando...</p>}

            {!buscando && !errorBusqueda && busqueda.trim().length >= 2 && resultados.length === 0 && (
              <p className="pi-texto">No se encontraron clientes con ese dato.</p>
            )}

            {!seleccionado && resultados.length > 0 && (
              <ul className="pi-lista">
                {resultados.map(cliente => {
                  const estado = obtenerEstadoCliente(cliente)

                  return (
                    <li key={cliente.id}>
                      <button
                        type="button"
                        className="pi-cliente"
                        onClick={() => seleccionarCliente(cliente)}
                      >
                        <span className="pi-cliente-icono"><Users size={22} /></span>
                        <span className="pi-cliente-datos">
                          <strong>{cliente.nombre}</strong>
                          <small>{cliente.telefono || 'Sin teléfono'}</small>
                        </span>
                        <span className={`pi-insignia pi-insignia-${estado}`}>
                          {ETIQUETAS_CLIENTE[estado]}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {seleccionado && (
              <div className="pi-verificacion">
                <p className="pi-dato-etiqueta">VERIFICACIÓN DEL CLIENTE</p>
                <h2 className="pi-titulo pi-titulo-cliente">{seleccionado.nombre}</h2>
                <div className="pi-datos">
                  <div className="pi-dato">
                    <p className="pi-dato-etiqueta">MEMBRESÍA</p>
                    <p className="pi-dato-valor">
                      <span className={`pi-insignia pi-insignia-${estadoSeleccionado}`}>
                        {ETIQUETAS_CLIENTE[estadoSeleccionado]}
                      </span>
                    </p>
                  </div>
                  <div className="pi-dato">
                    <p className="pi-dato-etiqueta">VENCIMIENTO</p>
                    <p className="pi-dato-valor">{formatearFechaCorta(seleccionado.vencimiento)}</p>
                  </div>
                </div>

                {errorAsistencia && <p className="pi-error">{errorAsistencia}</p>}

                {estadoSeleccionado === 'vigente' ? (
                  <button
                    type="button"
                    className="pi-boton pi-boton-primario pi-boton-grande"
                    onClick={registrarAsistencia}
                    disabled={registrando}
                  >
                    {registrando ? 'Registrando...' : 'Registrar asistencia'}
                  </button>
                ) : (
                  <p className="pi-alerta">
                    {estadoSeleccionado === 'inactivo'
                      ? 'El cliente está inactivo. No se puede registrar su asistencia.'
                      : estadoSeleccionado === 'pendiente'
                        ? 'La membresía todavía no tiene vigencia. Consulta la fecha de inicio con administración.'
                        : `La membresía venció el ${formatearFechaCorta(seleccionado.vencimiento)}. Renueva la membresía para registrar su asistencia.`}
                  </p>
                )}

                {estadoSeleccionado === 'vencida' && <RenovarRecepcion key={seleccionado.id}
                  cliente={seleccionado} turno={turno.turno_id} operador={perfil.id}
                  onCobro={registro => {
                    const actualizado = { ...seleccionado, vigente: true, vencimiento: registro.fechaFin }
                    setSeleccionado(actual => actual?.id === seleccionado.id ? actualizado : actual)
                    setResultados(actuales => actuales.map(cliente => cliente.id === actualizado.id ? actualizado : cliente))
                    setMensajeExito('Pago registrado. El recibo quedó pendiente en Administración.')
                    consultarTurno()
                  }} />}

                <button
                  type="button"
                  className="pi-boton pi-boton-secundario pi-boton-grande"
                  onClick={() => setSeleccionado(null)}
                  disabled={registrando}
                >
                  Volver a los resultados
                </button>
              </div>
            )}
            </>}
          </section>
        )}
        <CajaTurno operador={perfil.id} turnoId={!error && turno?.estado === 'abierto' ? turno.turno_id : null}
          solicitud={solicitudVisita} alCobrar={consultarTurno} />
        </div>
        {mostrarMediciones && <div className={modoOscuro ? 'pi-mediciones dark-mode' : 'pi-mediciones'}>
          <Mediciones operador={perfil.id} turnoId={!error && turno?.estado === 'abierto' ? turno.turno_id : null} clientes={[]} SelectorOpcion={SelectorOpcion} SelectorFecha={SelectorFecha} />
        </div>}
      </main>

      {confirmandoCierre && (
        <div className="pi-modal-fondo">
          <div className="pi-modal" role="dialog" aria-modal="true" aria-labelledby="pi-modal-titulo">
            <h2 id="pi-modal-titulo" className="pi-titulo">¿Cerrar el turno?</h2>
            <p className="pi-texto">
              Se registrará la hora de cierre y ya no podrás registrar más asistencias en este turno.
            </p>
            <p className="pi-texto">
              Asistencias registradas: <strong>{turno?.total_asistencias ?? 0}</strong>
            </p>
            <div className="pi-acciones">
              <button
                type="button"
                className="pi-boton pi-boton-secundario"
                onClick={() => setConfirmandoCierre(false)}
                disabled={procesando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pi-boton pi-boton-primario"
                onClick={cerrarTurno}
                disabled={procesando}
              >
                {procesando ? 'Cerrando...' : 'Sí, cerrar turno'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PanelInstructores