import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Search,
  RefreshCw,
  History,
  RotateCcw,
  X,
  Clock,
  AlertCircle
} from 'lucide-react'
import { supabase } from './supabase'
import './AsistenciaAdmin.css'

const ZONA_HORARIA = 'America/Guatemala'
const LIMITE_REGISTROS = 500

const OPCION_DIA = 'Día seleccionado'
const OPCION_30_DIAS = 'Últimos 30 días'
const OPCION_TODO = 'Todo el historial'
const TODOS_TURNOS = 'Todos los turnos'
const TODOS_INSTRUCTORES = 'Todos los instructores'

function ahoraGuatemala() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date())

  const valor = tipo => partes.find(parte => parte.type === tipo)?.value

  return {
    fecha: `${valor('year')}-${valor('month')}-${valor('day')}`,
    minutos: Number(valor('hour')) * 60 + Number(valor('minute'))
  }
}

function aMinutos(hora) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

function restarDias(fecha, dias) {
  const nueva = new Date(`${fecha}T12:00:00`)
  nueva.setDate(nueva.getDate() - dias)
  return `${nueva.getFullYear()}-${String(nueva.getMonth() + 1).padStart(2, '0')}-${String(nueva.getDate()).padStart(2, '0')}`
}

function formatearFecha(fecha) {
  if (!fecha) return ''
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

function formatearHora(fechaIso) {
  if (!fechaIso) return '—'
  return new Date(fechaIso).toLocaleTimeString('es-GT', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: ZONA_HORARIA
  })
}

function formatearFechaHora(fechaIso) {
  if (!fechaIso) return '—'
  return new Date(fechaIso).toLocaleString('es-GT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: ZONA_HORARIA
  })
}

function escaparBusqueda(texto) {
  return texto.replace(/[\\%_]/g, caracter => `\\${caracter}`)
}

function tipoEvento(tipo) {
  if (tipo === 'apertura') return 'Apertura'
  if (tipo === 'cierre') return 'Cierre'
  if (tipo === 'reapertura') return 'Reapertura'
  return tipo || 'Movimiento'
}

function AsistenciaAdmin({ SelectorFecha, SelectorOpcion }) {
  const [fecha, setFecha] = useState(() => ahoraGuatemala().fecha)
  const [periodo, setPeriodo] = useState(OPCION_DIA)
  const [turnoFiltro, setTurnoFiltro] = useState(TODOS_TURNOS)
  const [instructorFiltro, setInstructorFiltro] = useState(TODOS_INSTRUCTORES)
  const [busqueda, setBusqueda] = useState('')
  const [busquedaAplicada, setBusquedaAplicada] = useState('')
  const [perfiles, setPerfiles] = useState([])
  const [horarios, setHorarios] = useState([])
  const [turnos, setTurnos] = useState([])
  const [asistencias, setAsistencias] = useState([])
  const [conteoAbiertos, setConteoAbiertos] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [recarga, setRecarga] = useState(0)

  const [turnoReabrir, setTurnoReabrir] = useState(null)
  const [notaReapertura, setNotaReapertura] = useState('')
  const [procesandoReapertura, setProcesandoReapertura] = useState(false)
  const [errorReapertura, setErrorReapertura] = useState('')
  const [mensajeAccion, setMensajeAccion] = useState('')

  const [turnoHistorial, setTurnoHistorial] = useState(null)
  const [eventosHistorial, setEventosHistorial] = useState([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [errorHistorial, setErrorHistorial] = useState('')

  useEffect(() => {
    let activo = true

    async function cargarBase() {
      const [respuestaPerfiles, respuestaHorarios] = await Promise.all([
        supabase.from('perfiles').select('id, nombre_completo, rol, activo').order('nombre_completo'),
        supabase.from('turnos_horario').select('numero, nombre, hora_inicio, hora_fin').order('numero')
      ])

      if (!activo) return

      if (respuestaPerfiles.error || respuestaHorarios.error) {
        console.error('Error cargando datos base:', respuestaPerfiles.error || respuestaHorarios.error)
        setError('No se pudo cargar la información de asistencia.')
        return
      }

      setPerfiles(respuestaPerfiles.data || [])
      setHorarios(respuestaHorarios.data || [])
    }

    cargarBase()
    return () => { activo = false }
  }, [])

  useEffect(() => {
    const temporizador = setTimeout(() => setBusquedaAplicada(busqueda), 300)
    return () => clearTimeout(temporizador)
  }, [busqueda])

  const instructorId = perfiles.find(perfil => perfil.nombre_completo === instructorFiltro)?.id || null

  useEffect(() => {
    let activo = true

    async function cargar() {
      setCargando(true)

      let consultaTurnos = supabase
        .from('turnos')
        .select('id, fecha, numero, estado, abierto_por, abierto_en, cerrado_por, cerrado_en, total_asistencias, apertura_extraordinaria, nota, reaperturas')

      let consultaAsistencias = supabase
        .from('asistencias')
        .select('id, cliente_id, cliente_nombre, turno_id, instructor_id, fecha, hora, autorizada_por, nota, turnos(numero)')

      if (periodo === OPCION_DIA) {
        consultaTurnos = consultaTurnos.eq('fecha', fecha)
        consultaAsistencias = consultaAsistencias.eq('fecha', fecha)
      } else if (periodo === OPCION_30_DIAS) {
        const desde = restarDias(ahoraGuatemala().fecha, 30)
        consultaTurnos = consultaTurnos.gte('fecha', desde)
        consultaAsistencias = consultaAsistencias.gte('fecha', desde)
      }

      if (instructorId) {
        consultaTurnos = consultaTurnos.eq('abierto_por', instructorId)
        consultaAsistencias = consultaAsistencias.eq('instructor_id', instructorId)
      }

      if (busquedaAplicada.trim()) {
        consultaAsistencias = consultaAsistencias.ilike(
          'cliente_nombre',
          `%${escaparBusqueda(busquedaAplicada.trim())}%`
        )
      }

      const [respuestaTurnos, respuestaAsistencias] = await Promise.all([
        consultaTurnos
          .order('fecha', { ascending: false })
          .order('numero', { ascending: true })
          .limit(LIMITE_REGISTROS),
        consultaAsistencias
          .order('hora', { ascending: false })
          .limit(LIMITE_REGISTROS)
      ])

      if (!activo) return

      if (respuestaTurnos.error || respuestaAsistencias.error) {
        console.error('Error cargando asistencia:', respuestaTurnos.error || respuestaAsistencias.error)
        setError('No se pudo cargar la información de asistencia. Revisa tu conexión a internet.')
        setCargando(false)
        return
      }

      const turnosCargados = respuestaTurnos.data || []
      const idsAbiertos = turnosCargados.filter(turno => turno.estado === 'abierto').map(turno => turno.id)
      const conteo = {}

      if (idsAbiertos.length > 0) {
        const { data: filasConteo, error: errorConteo } = await supabase
          .from('asistencias')
          .select('turno_id')
          .in('turno_id', idsAbiertos)

        if (!activo) return
        if (errorConteo) console.error('Error contando asistencias:', errorConteo)

        ;(filasConteo || []).forEach(fila => {
          conteo[fila.turno_id] = (conteo[fila.turno_id] || 0) + 1
        })
      }

      setError('')
      setTurnos(turnosCargados)
      setAsistencias(respuestaAsistencias.data || [])
      setConteoAbiertos(conteo)
      setCargando(false)
    }

    cargar()
    return () => { activo = false }
  }, [periodo, fecha, instructorId, busquedaAplicada, recarga])

  function nombreInstructor(id) {
    return perfiles.find(perfil => perfil.id === id)?.nombre_completo || 'Desconocido'
  }

  function puedeReabrir(turno) {
    if (!turno || turno.estado !== 'cerrado') return false
    const ahora = ahoraGuatemala()
    if (turno.fecha !== ahora.fecha) return false
    if (turno.apertura_extraordinaria) return true
    const horario = horarios.find(item => item.numero === turno.numero)
    return Boolean(horario && ahora.minutos < aMinutos(horario.hora_fin))
  }

  function abrirModalReapertura(turno) {
    setTurnoReabrir(turno)
    setNotaReapertura('')
    setErrorReapertura('')
    setMensajeAccion('')
  }

  async function confirmarReapertura() {
    if (!turnoReabrir || procesandoReapertura) return

    setProcesandoReapertura(true)
    setErrorReapertura('')

    const { data, error: errorRpc } = await supabase.rpc('admin_reabrir_turno', {
      p_turno_id: turnoReabrir.id,
      p_nota: notaReapertura.trim() || null
    })

    setProcesandoReapertura(false)

    if (errorRpc) {
      console.error('Error al reabrir turno:', errorRpc)
      setErrorReapertura(errorRpc.message || 'No se pudo reabrir el turno. Verifica que siga cumpliendo las condiciones.')
      return
    }

    if (data?.ok === false) {
      setErrorReapertura(data.mensaje || data.error || 'No se pudo reabrir el turno.')
      return
    }

    setTurnoReabrir(null)
    setNotaReapertura('')
    setMensajeAccion(`Turno ${turnoReabrir.numero} reabierto correctamente.`)
    setRecarga(numero => numero + 1)
  }

  async function abrirHistorial(turno) {
    setTurnoHistorial(turno)
    setEventosHistorial([])
    setErrorHistorial('')
    setCargandoHistorial(true)

    const { data, error: errorConsulta } = await supabase
      .from('turnos_eventos')
      .select('id, turno_id, tipo, usuario_id, ocurrido_en, nota')
      .eq('turno_id', turno.id)
      .order('ocurrido_en', { ascending: true })

    setCargandoHistorial(false)

    if (errorConsulta) {
      console.error('Error consultando historial del turno:', errorConsulta)
      setErrorHistorial(errorConsulta.message || 'No se pudo cargar el historial de este turno.')
      return
    }

    setEventosHistorial(data || [])
  }

  const numeroTurnoFiltro = turnoFiltro === TODOS_TURNOS ? null : Number(turnoFiltro.replace('Turno ', ''))
  const ahora = ahoraGuatemala()
  const modoDia = periodo === OPCION_DIA

  let filasTurnos = []

  if (modoDia && !instructorId) {
    filasTurnos = horarios.map(horario => {
      const turno = turnos.find(item => item.numero === horario.numero)

      if (turno) {
        return {
          clave: turno.id,
          turnoId: turno.id,
          fecha: turno.fecha,
          numero: turno.numero,
          estado: turno.estado === 'abierto' ? 'Abierto' : 'Cerrado',
          instructor: nombreInstructor(turno.abierto_por),
          cerradoPor: turno.cerrado_por && turno.cerrado_por !== turno.abierto_por
            ? nombreInstructor(turno.cerrado_por)
            : '',
          apertura: turno.abierto_en,
          cierre: turno.cerrado_en,
          asistencias: turno.estado === 'abierto'
            ? conteoAbiertos[turno.id] || 0
            : turno.total_asistencias,
          extraordinaria: turno.apertura_extraordinaria,
          reaperturas: turno.reaperturas || 0,
          puedeReabrir: puedeReabrir(turno)
        }
      }

      const yaTermino = fecha < ahora.fecha
        || (fecha === ahora.fecha && ahora.minutos >= aMinutos(horario.hora_fin))

      return {
        clave: `sin-abrir-${horario.numero}`,
        turnoId: null,
        fecha,
        numero: horario.numero,
        estado: yaTermino ? 'No abierto' : 'Pendiente',
        instructor: '—',
        cerradoPor: '',
        apertura: null,
        cierre: null,
        asistencias: 0,
        extraordinaria: false,
        reaperturas: 0,
        puedeReabrir: false
      }
    })
  } else {
    filasTurnos = turnos.map(turno => ({
      clave: turno.id,
      turnoId: turno.id,
      fecha: turno.fecha,
      numero: turno.numero,
      estado: turno.estado === 'abierto' ? 'Abierto' : 'Cerrado',
      instructor: nombreInstructor(turno.abierto_por),
      cerradoPor: turno.cerrado_por && turno.cerrado_por !== turno.abierto_por
        ? nombreInstructor(turno.cerrado_por)
        : '',
      apertura: turno.abierto_en,
      cierre: turno.cerrado_en,
      asistencias: turno.estado === 'abierto'
        ? conteoAbiertos[turno.id] || 0
        : turno.total_asistencias,
      extraordinaria: turno.apertura_extraordinaria,
      reaperturas: turno.reaperturas || 0,
      puedeReabrir: puedeReabrir(turno)
    }))
  }

  if (numeroTurnoFiltro) {
    filasTurnos = filasTurnos.filter(fila => fila.numero === numeroTurnoFiltro)
  }

  const asistenciasFiltradas = numeroTurnoFiltro
    ? asistencias.filter(asistencia => asistencia.turnos?.numero === numeroTurnoFiltro)
    : asistencias

  const turnosAbiertos = filasTurnos.filter(fila => fila.estado === 'Abierto').length
  const turnosCerrados = filasTurnos.filter(fila => fila.estado === 'Cerrado').length
  const turnosNoAbiertos = filasTurnos.filter(fila => fila.estado === 'No abierto').length
  const llegoAlLimite = asistencias.length >= LIMITE_REGISTROS

  const opcionesTurno = [TODOS_TURNOS, ...horarios.map(horario => horario.nombre)]
  const opcionesInstructor = [TODOS_INSTRUCTORES, ...perfiles.map(perfil => perfil.nombre_completo)]

  return (
    <>
      <div className="section-actions">
        <div>
          <h2>Control de asistencia</h2>
          <p>Consulta las asistencias registradas por los instructores y el estado de cada turno.</p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => setRecarga(numero => numero + 1)}
          disabled={cargando}
        >
          <RefreshCw size={17} />
          {cargando ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {error && <p className="empty">{error}</p>}
      {mensajeAccion && <p className="asistencia-mensaje-exito">{mensajeAccion}</p>}

      <div className="stats">
        <div className="stat-card">
          <p>TOTAL DE ASISTENCIAS</p>
          <h2>{asistenciasFiltradas.length}{llegoAlLimite ? '+' : ''}</h2>
          <small>Según los filtros elegidos</small>
        </div>
        <div className="stat-card">
          <p>TURNOS ABIERTOS</p>
          <h2>{turnosAbiertos}</h2>
          <small>En curso o sin cerrar</small>
        </div>
        <div className="stat-card">
          <p>TURNOS CERRADOS</p>
          <h2>{turnosCerrados}</h2>
          <small>Finalizados correctamente</small>
        </div>
        <div className="stat-card">
          <p>TURNOS NO ABIERTOS</p>
          <h2>{modoDia && !instructorId ? turnosNoAbiertos : '—'}</h2>
          <small>{modoDia && !instructorId ? 'Terminaron sin abrirse' : 'Se calcula al ver un solo día'}</small>
        </div>
      </div>

      <div className="content-card">
        <div className="asistencia-filtros">
          <div className="asistencia-campo">
            <span>PERÍODO</span>
            <SelectorOpcion value={periodo} options={[OPCION_DIA, OPCION_30_DIAS, OPCION_TODO]} onChange={setPeriodo} />
          </div>

          {modoDia && (
            <div className="asistencia-campo">
              <span>FECHA</span>
              <SelectorFecha value={fecha} fechaMaxima={ahora.fecha} onChange={setFecha} />
            </div>
          )}

          <div className="asistencia-campo">
            <span>TURNO</span>
            <SelectorOpcion value={turnoFiltro} options={opcionesTurno} onChange={setTurnoFiltro} />
          </div>

          <div className="asistencia-campo">
            <span>INSTRUCTOR</span>
            <SelectorOpcion value={instructorFiltro} options={opcionesInstructor} onChange={setInstructorFiltro} />
          </div>
        </div>

        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar asistencias por nombre de cliente..."
            value={busqueda}
            onChange={evento => setBusqueda(evento.target.value)}
          />
        </div>
      </div>

      <div className="content-card">
        <div className="promo-list-heading">
          <div>
            <h3>Turnos</h3>
            <p>Horarios de apertura y cierre, e instructor responsable de cada turno.</p>
          </div>
          <span className="promo-total">{filasTurnos.length} turnos</span>
        </div>

        {filasTurnos.length === 0 ? (
          <p className="empty">No hay turnos registrados con estos filtros.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  {!modoDia && <th>FECHA</th>}
                  <th>TURNO</th>
                  <th>ESTADO</th>
                  <th>RESPONSABLE</th>
                  <th>APERTURA</th>
                  <th>CIERRE</th>
                  <th>ASISTENCIAS</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filasTurnos.map(fila => {
                  const turnoOriginal = turnos.find(turno => turno.id === fila.turnoId)

                  return (
                    <tr key={fila.clave}>
                      {!modoDia && <td>{formatearFecha(fila.fecha)}</td>}
                      <td>
                        <strong>Turno {fila.numero}</strong>
                        {fila.extraordinaria && <small className="client-promo-label">Apertura extraordinaria</small>}
                        {fila.reaperturas > 0 && <small className="client-promo-label">Reabierto {fila.reaperturas} {fila.reaperturas === 1 ? 'vez' : 'veces'}</small>}
                      </td>
                      <td>
                        <span className={`asistencia-estado asistencia-estado-${fila.estado.replace(' ', '-').toLowerCase()}`}>
                          {fila.estado}
                        </span>
                      </td>
                      <td>
                        {fila.instructor}
                        {fila.cerradoPor && <small className="client-promo-label">Cerrado por {fila.cerradoPor}</small>}
                      </td>
                      <td>{formatearHora(fila.apertura)}</td>
                      <td>{formatearHora(fila.cierre)}</td>
                      <td><strong>{fila.asistencias}</strong></td>
                      <td>
                        {turnoOriginal && (
                          <div className="asistencia-acciones">
                            <button type="button" className="asistencia-boton-secundario" onClick={() => abrirHistorial(turnoOriginal)}>
                              <History size={15} /> Historial
                            </button>
                            {fila.puedeReabrir && (
                              <button type="button" className="asistencia-boton-reabrir" onClick={() => abrirModalReapertura(turnoOriginal)}>
                                <RotateCcw size={15} /> Reabrir
                              </button>
                            )}
                          </div>
                        )}
                        {!turnoOriginal && <span className="asistencia-sin-accion">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="content-card">
        <div className="promo-list-heading">
          <div>
            <h3>Asistencias registradas</h3>
            <p>
              {llegoAlLimite
                ? `Se muestran las ${LIMITE_REGISTROS} más recientes. Usa los filtros para acotar la búsqueda.`
                : 'Clientes que llegaron al gimnasio, con su turno e instructor.'}
            </p>
          </div>
          <span className="promo-total">{asistenciasFiltradas.length} registros</span>
        </div>

        {asistenciasFiltradas.length === 0 ? (
          <p className="empty">{cargando ? 'Cargando...' : 'No hay asistencias registradas con estos filtros.'}</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>CLIENTE</th>
                  {!modoDia && <th>FECHA</th>}
                  <th>HORA</th>
                  <th>TURNO</th>
                  <th>INSTRUCTOR</th>
                </tr>
              </thead>
              <tbody>
                {asistenciasFiltradas.map(asistencia => (
                  <tr key={asistencia.id}>
                    <td>
                      <strong>{asistencia.cliente_nombre}</strong>
                      {asistencia.autorizada_por && (
                        <small className="client-promo-label">
                          Autorizada por el administrador{asistencia.nota ? `: ${asistencia.nota}` : ''}
                        </small>
                      )}
                    </td>
                    {!modoDia && <td>{formatearFecha(asistencia.fecha)}</td>}
                    <td>{formatearHora(asistencia.hora)}</td>
                    <td>Turno {asistencia.turnos?.numero ?? '—'}</td>
                    <td>{nombreInstructor(asistencia.instructor_id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {turnoReabrir && createPortal((
        <div className="asistencia-modal-fondo" onMouseDown={evento => {
          if (evento.target === evento.currentTarget && !procesandoReapertura) setTurnoReabrir(null)
        }}>
          <div className="asistencia-modal" role="dialog" aria-modal="true" aria-labelledby="asistencia-modal-titulo">
            <div className="asistencia-modal-encabezado">
              <div className="asistencia-modal-icono"><RotateCcw size={20} /></div>
              <button type="button" className="asistencia-modal-cerrar" onClick={() => setTurnoReabrir(null)} disabled={procesandoReapertura} aria-label="Cerrar">
                <X size={19} />
              </button>
            </div>
            <h3 id="asistencia-modal-titulo">¿Reabrir este turno?</h3>
            <p className="asistencia-modal-descripcion">
              Se volverá a abrir el Turno {turnoReabrir.numero} del {formatearFecha(turnoReabrir.fecha)}. Las asistencias existentes se conservarán.
            </p>
            <label className="asistencia-modal-label" htmlFor="asistencia-nota-reapertura">Motivo o nota (opcional)</label>
            <textarea
              id="asistencia-nota-reapertura"
              value={notaReapertura}
              onChange={evento => setNotaReapertura(evento.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Escribe por qué necesitas reabrir el turno..."
              disabled={procesandoReapertura}
            />
            {errorReapertura && <p className="asistencia-modal-error"><AlertCircle size={16} /> {errorReapertura}</p>}
            <div className="asistencia-modal-acciones">
              <button type="button" className="asistencia-boton-secundario" onClick={() => setTurnoReabrir(null)} disabled={procesandoReapertura}>Cancelar</button>
              <button type="button" className="asistencia-boton-reabrir asistencia-boton-confirmar" onClick={confirmarReapertura} disabled={procesandoReapertura}>
                <RotateCcw size={16} /> {procesandoReapertura ? 'Reabriendo...' : 'Confirmar reapertura'}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {turnoHistorial && createPortal((
        <div className="asistencia-modal-fondo" onMouseDown={evento => {
          if (evento.target === evento.currentTarget) setTurnoHistorial(null)
        }}>
          <div className="asistencia-modal asistencia-modal-historial" role="dialog" aria-modal="true" aria-labelledby="asistencia-historial-titulo">
            <div className="asistencia-modal-encabezado">
              <div className="asistencia-modal-icono"><History size={20} /></div>
              <button type="button" className="asistencia-modal-cerrar" onClick={() => setTurnoHistorial(null)} aria-label="Cerrar"><X size={19} /></button>
            </div>
            <h3 id="asistencia-historial-titulo">Historial del Turno {turnoHistorial.numero}</h3>
            <p className="asistencia-modal-descripcion">{formatearFecha(turnoHistorial.fecha)} · Registro de aperturas, cierres y reaperturas.</p>

            {cargandoHistorial ? (
              <p className="asistencia-historial-vacio">Cargando historial...</p>
            ) : errorHistorial ? (
              <p className="asistencia-modal-error"><AlertCircle size={16} /> {errorHistorial}</p>
            ) : eventosHistorial.length === 0 ? (
              <p className="asistencia-historial-vacio">Este turno todavía no tiene eventos registrados.</p>
            ) : (
              <div className="asistencia-historial-lista">
                {eventosHistorial.map(evento => {
                  const perfil = perfiles.find(item => item.id === evento.usuario_id)
                  return (
                    <div className="asistencia-historial-evento" key={evento.id}>
                      <div className={`asistencia-historial-punto asistencia-historial-${evento.tipo}`} />
                      <div className="asistencia-historial-contenido">
                        <div className="asistencia-historial-titulo">
                          <strong>{tipoEvento(evento.tipo)}</strong>
                          <span><Clock size={13} /> {formatearFechaHora(evento.ocurrido_en)}</span>
                        </div>
                        <p>{perfil?.nombre_completo || 'Usuario no disponible'}{perfil?.rol ? ` · ${perfil.rol}` : ''}</p>
                        {evento.nota && <small>{evento.nota}</small>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="asistencia-modal-acciones">
<button
  type="button"
  className="asistencia-boton-historial"
  onClick={() => abrirHistorial(turnoOriginal)}
>
  <History size={15} />
  <span>Historial</span>
</button>
            </div>
          </div>
        </div>
      ), document.body)}
    </>
  )
}

export default AsistenciaAdmin
