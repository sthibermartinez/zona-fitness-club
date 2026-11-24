
import { Fragment, useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard, Users, CalendarCheck, CreditCard, Ruler,
  BarChart3, Plus, Search, CalendarDays, ChevronLeft,
  ChevronRight, ChevronDown, Check, Trash2, X,
  AlertTriangle, Tag, Pencil, RefreshCw, UserX,
  UserCheck, History, MessageCircle, Bell, Settings,
  Clock, Wallet, Menu
} from 'lucide-react'
import {
  // Conserva todos tus iconos actuales
  Moon,
  Sun
} from 'lucide-react'

import './App.css'
import { supabase } from './supabase'
// CONFIGURACIÓN DE EMAILJS
const EMAILJS_SERVICE_ID = 'service_hqfkepk'
const EMAILJS_TEMPLATE_ID = 'template_6rqaj9g'
const EMAILJS_PUBLIC_KEY = 'PMdHSL_neEKHEKyXH'

function obtenerFecha() {
  const fecha = new Date()
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
}
// Poner mayúscula inicial en cada palabra de un nombre
function convertirNombre(texto) {
  return texto.replace(/(^|\s)([a-záéíóúüñ])/g, (coincidencia, espacio, letra) =>
    espacio + letra.toUpperCase()
  )
}

// Poner mayúscula al inicio de cada oración
function convertirOraciones(texto) {
  return texto.replace(/(^\s*[a-záéíóúüñ]|[.!?]\s+[a-záéíóúüñ])/g, letra =>
    letra.toUpperCase()
  )
}
function obtenerSaludo() {
  const hora = new Date().getHours()
  if (hora >= 5 && hora < 12) return 'Buenos días'
  if (hora >= 12 && hora < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function formatearFecha(fecha) {
  if (!fecha) return ''
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

function sumarDias(fecha, cantidad) {
  if (!fecha) return ''
  const nuevaFecha = new Date(`${fecha}T12:00:00`)
  nuevaFecha.setDate(nuevaFecha.getDate() + cantidad)
  return `${nuevaFecha.getFullYear()}-${String(nuevaFecha.getMonth() + 1).padStart(2, '0')}-${String(nuevaFecha.getDate()).padStart(2, '0')}`
}

function diferenciaDias(fechaDesde, fechaHasta) {
  const desde = new Date(`${fechaDesde}T12:00:00`)
  const hasta = new Date(`${fechaHasta}T12:00:00`)
  return Math.round((hasta - desde) / 86400000)
}

function calcularVencimiento(fecha, tipo) {
  if (!fecha) return ''
  if (tipo === 'Mensual') return sumarDias(fecha, 30)
  if (tipo === 'Quincenal') return sumarDias(fecha, 15)
  return ''
}

function obtenerHistorial(cliente) {
  if (cliente.historialMembresias?.length) return cliente.historialMembresias

  return [{
    id: `inicial-${cliente.id}`,
    fechaInicio: cliente.fechaInicio,
    fechaFin: cliente.vencimiento,
    tipo: cliente.tipo,
    precio: cliente.precio,
    metodoPago: cliente.metodoPago,
    promocion: cliente.promocion || '',
    fechaPago: cliente.fechaInicio,
    modalidad: 'Inscripción inicial'
  }]
}

function obtenerUltimaMembresia(cliente) {
  const historial = obtenerHistorial(cliente)
  return historial[historial.length - 1]
}

function SelectorOpcion({ value, options, onChange, placeholder }) {
  const [abierto, setAbierto] = useState(false)
  const selectorRef = useRef(null)

  useEffect(() => {
    function detectarClickFuera(evento) {
      if (selectorRef.current && !selectorRef.current.contains(evento.target)) {
        setAbierto(false)
      }
    }
    document.addEventListener('pointerdown', detectarClickFuera)
    return () => document.removeEventListener('pointerdown', detectarClickFuera)
  }, [])

  return (
    <div className="custom-select" ref={selectorRef}>
      <button
        type="button"
        className={`custom-select-trigger ${abierto ? 'select-open' : ''}`}
        onClick={() => setAbierto(!abierto)}
      >
        <span>{value || placeholder}</span>
        <ChevronDown size={17} className={abierto ? 'select-chevron rotated' : 'select-chevron'} />
      </button>

      {abierto && (
        <div className="custom-select-options">
          {options.map(opcion => (
            <button
              type="button"
              key={opcion}
              className={`custom-select-option ${value === opcion ? 'option-selected' : ''}`}
              onClick={() => {
                onChange(opcion)
                setAbierto(false)
              }}
            >
              <span>{opcion}</span>
              {value === opcion && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SelectorFecha({ value, onChange }) {
  const anioActual = new Date().getFullYear()
  const [abierto, setAbierto] = useState(false)
  const [vista, setVista] = useState('calendario')
  const [fechaVista, setFechaVista] = useState(obtenerFecha())
  const selectorRef = useRef(null)
  const [mesVisible, setMesVisible] = useState(() => new Date().getMonth())

  useEffect(() => {
    function detectarClickFuera(evento) {
      if (selectorRef.current && !selectorRef.current.contains(evento.target)) {
        setAbierto(false)
        setVista('calendario')
      }
    }
    document.addEventListener('pointerdown', detectarClickFuera)
    return () => document.removeEventListener('pointerdown', detectarClickFuera)
  }, [])

  const nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]
  const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const primerDia = new Date(anioActual, mesVisible, 1).getDay()
  const espaciosIniciales = (primerDia + 6) % 7
  const totalDias = new Date(anioActual, mesVisible + 1, 0).getDate()
  const dias = [
    ...Array(espaciosIniciales).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1)
  ]

  function seleccionarDia(dia) {
    const fecha = `${anioActual}-${String(mesVisible + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    onChange(fecha)
    setFechaVista(fecha)
    setAbierto(false)
    setVista('calendario')
  }

  function abrirCalendario() {
    if (!abierto) {
      const fechaInicial = value || obtenerFecha()
      setFechaVista(fechaInicial)
      setMesVisible(new Date(`${fechaInicial}T12:00:00`).getMonth())
      setVista('calendario')
      setAbierto(true)
    } else {
      setAbierto(false)
    }
  }

  return (
    <div className="date-picker" ref={selectorRef}>
      <button
        type="button"
        className={`date-input ${abierto ? 'date-input-open' : ''}`}
        onClick={abrirCalendario}
      >
        <span className={value ? 'date-value' : 'date-placeholder'}>
          {value ? formatearFecha(value) : 'Seleccionar fecha'}
        </span>
        <CalendarDays size={18} />
      </button>

      {abierto && (
        <div className="calendar-popup">
          {vista === 'calendario' ? (
            <>
              <div className="calendar-header">
                <button
                  type="button"
                  className="calendar-nav"
                  disabled={mesVisible === 0}
                  onClick={() => setMesVisible(m => m - 1)}
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="calendar-heading">
                  <button
                    type="button"
                    className="calendar-month-button"
                    onClick={() => setVista('meses')}
                  >
                    {nombresMeses[mesVisible]}
                  </button>
                  <button
                    type="button"
                    className="calendar-year-button"
                    onClick={() => setVista('meses')}
                  >
                    {anioActual} <ChevronDown size={14} />
                  </button>
                </div>

                <button
                  type="button"
                  className="calendar-nav"
                  disabled={mesVisible === 11}
                  onClick={() => setMesVisible(m => m + 1)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="calendar-grid">
                {diasSemana.map(dia => (
                  <span className="calendar-weekday" key={dia}>{dia}</span>
                ))}

                {dias.map((dia, indice) => {
                  if (dia === null) return <span key={`espacio-${indice}`} />

                  const fechaDia = `${anioActual}-${String(mesVisible + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
                  const seleccionado = fechaVista === fechaDia
                  const hoy = obtenerFecha() === fechaDia

                  return (
                    <button
                      type="button"
                      key={fechaDia}
                      className={[
                        'calendar-day',
                        seleccionado ? 'selected' : '',
                        hoy ? 'today' : ''
                      ].join(' ')}
                      onClick={() => seleccionarDia(dia)}
                    >
                      {dia}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="month-selector">
              <div className="month-selector-header">
                <button
                  type="button"
                  className="calendar-nav"
                  onClick={() => setVista('calendario')}
                >
                  <ChevronLeft size={18} />
                </button>
                <div>
                  <strong>{anioActual}</strong>
                  <span>Selecciona un mes</span>
                </div>
                <span className="year-lock">Año actual</span>
              </div>

              <div className="month-grid">
                {nombresMeses.map((mes, indice) => (
                  <button
                    type="button"
                    key={mes}
                    className={`month-option ${mesVisible === indice ? 'month-selected' : ''}`}
                    onClick={() => {
                      setMesVisible(indice)
                      setVista('calendario')
                    }}
                  >
                    {mes}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="calendar-footer">
            <span>Fechas disponibles de {anioActual}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function Aplicacion({ user }) {
  const [datosCargados, setDatosCargados] = useState(false)
  const [errorDatos, setErrorDatos] = useState('')
const [mostrarConfirmacionCerrarSesion, setMostrarConfirmacionCerrarSesion] = useState(false)
  const cambiarTema = (evento) => {  const rect = evento.currentTarget.getBoundingClientRect()

  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2

  document.documentElement.style.setProperty(
    '--theme-origin-x',
    `${x}px`
  )

  document.documentElement.style.setProperty(
    '--theme-origin-y',
    `${y}px`
  )

  const actualizarTema = () => {
    setModoOscuro((anterior) => !anterior)
  }

  if (document.startViewTransition) {
    document.startViewTransition(actualizarTema)
  } else {
    actualizarTema()
  }
}
 const [modoOscuro, setModoOscuro] = useState(() => {
  return localStorage.getItem('zona-fitness-tema') === 'oscuro'
})

useEffect(() => {
  localStorage.setItem(
    'zona-fitness-tema',
    modoOscuro ? 'oscuro' : 'claro'
  )
}, [modoOscuro])
 const [seccion, setSeccion] = useState('Inicio')
 const [menuMovilAbierto, setMenuMovilAbierto] = useState(false)
  const [clientes, setClientes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [aviso, setAviso] = useState(null)

  // ESTADOS DE REPORTES
  const [reporte, setReporte] = useState({
    nombre: '',
    seccion: '',
    descripcion: ''
  })
  const [enviandoReporte, setEnviandoReporte] = useState(false)
  const [resultadoReporte, setResultadoReporte] = useState(null)

  const [clienteExpandido, setClienteExpandido] = useState(null)
  const [clienteEditando, setClienteEditando] = useState(null)
const [cobrarInscripcion, setCobrarInscripcion] = useState(false)
  const [promociones, setPromociones] = useState([
    {
      id: 1,
      nombre: 'Estudiantes',
      precio: '175',
      fechaInicio: '2026-11-01',
      fechaFin: '2026-12-31',
      aplicaA: 'Mensual'
    }
  ])

  const [promocionExpandida, setPromocionExpandida] = useState(null)
  const [mostrarFormularioPromo, setMostrarFormularioPromo] = useState(false)
  const [promocionEditando, setPromocionEditando] = useState(null)
  const [filtroMembresias, setFiltroMembresias] = useState('Todas')
  const [membresiaExpandida, setMembresiaExpandida] = useState(null)
  const [clienteRenovando, setClienteRenovando] = useState(null)

  const [configuracionAvisos, setConfiguracionAvisos] = useState([
    {
      diasAntes: 3,
      activo: true,
      mensaje: '{saludo}, {nombre}. Te recordamos que en 3 días vence tu membresía en Zona Fitness Club. Te esperamos para tu renovación.'
    },
    {
      diasAntes: 2,
      activo: true,
      mensaje: '{saludo}, {nombre}. Te recordamos que en 2 días vence tu membresía en Zona Fitness Club. Puedes acercarte a recepción para renovarla.'
    },
    {
      diasAntes: 1,
      activo: true,
      mensaje: '{saludo}, {nombre}. ¡Tu membresía vence mañana! Te esperamos en Zona Fitness Club para realizar tu renovación.'
    },
    {
      diasAntes: 0,
      activo: true,
      mensaje: '{saludo}, {nombre}. Te recordamos que hoy vence tu membresía en Zona Fitness Club. ¡Te esperamos para tu renovación!'
    },
    {
      diasAntes: -1,
      activo: true,
      mensaje: '{saludo}, {nombre}. Tu membresía venció ayer. Puedes acercarte a Zona Fitness Club para renovarla y seguir entrenando con nosotros.'
    },
    {
      diasAntes: -2,
      activo: true,
      mensaje: '{saludo}, {nombre}. Te recordamos que tu membresía lleva 2 días vencida. ¡Te esperamos en Zona Fitness Club para que puedas renovarla!'
    },
    {
      diasAntes: -3,
      activo: true,
      mensaje: '{saludo}, {nombre}. Tu membresía lleva 3 días vencida. Puedes acercarte a recepción a renovarla.'
    }
  ])
useEffect(() => {
  let activo = true

  async function cargarDatos() {
    const { data, error } = await supabase
      .from('zona_fitness_datos')
      .select('clientes, promociones, configuracion_avisos')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!activo) return

    if (error) {
      console.error('Error cargando datos:', error)
      setErrorDatos('No se pudieron cargar los datos de Supabase. Recarga la página para intentarlo de nuevo.')
      return
    }

    if (data) {
      setClientes(Array.isArray(data.clientes) ? data.clientes : [])
      setPromociones(Array.isArray(data.promociones) ? data.promociones : [])
      setConfiguracionAvisos(
        Array.isArray(data.configuracion_avisos) ? data.configuracion_avisos : []
      )
    }

    setDatosCargados(true)
  }

  cargarDatos()

  return () => {
    activo = false
  }
}, [user.id])

useEffect(() => {
  if (!datosCargados) return

  const temporizador = setTimeout(async () => {
    const { error } = await supabase
      .from('zona_fitness_datos')
      .upsert({
        user_id: user.id,
        clientes,
        promociones,
        configuracion_avisos: configuracionAvisos,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    if (error) {
      console.error('Error guardando datos:', error)
      setErrorDatos('No se pudieron guardar los cambios. Revisa tu conexión a internet.')
    } else {
      setErrorDatos('')
    }
  }, 600)

  return () => clearTimeout(temporizador)
}, [datosCargados, user.id, clientes, promociones, configuracionAvisos])
  const [mostrarConfiguracionAvisos, setMostrarConfiguracionAvisos] = useState(false)

  const formularioPromoInicial = {
    nombre: '',
    precio: '',
    fechaInicio: obtenerFecha(),
    fechaFin: '',
    aplicaA: 'Mensual'
  }

  const [formularioPromo, setFormularioPromo] = useState(formularioPromoInicial)

  const [formulario, setFormulario] = useState({
    nombre: '',
    telefono: '',
    fechaInicio: obtenerFecha(),
    tipo: 'Mensual',
    precio: '200',
    metodoPago: 'Efectivo',
    promocion: ''
  })

  const [formularioRenovacion, setFormularioRenovacion] = useState({
    modalidad: 'normal',
    tipo: 'Mensual',
    metodoPago: 'Efectivo',
    promocion: ''
  })

  const menu = [
    { nombre: 'Inicio', icono: LayoutDashboard },
    { nombre: 'Clientes', icono: Users },
    { nombre: 'Membresías', icono: CalendarCheck },
    { nombre: 'Promociones', icono: Tag },
    { nombre: 'Pagos', icono: CreditCard },
    { nombre: 'Mediciones', icono: Ruler },
    { nombre: 'Reportes', icono: BarChart3 }
  ]

  const promocionesDisponibles = promociones.filter(promo =>
    (promo.aplicaA === formulario.tipo || promo.aplicaA === 'Ambas') &&
    formulario.fechaInicio >= promo.fechaInicio &&
    formulario.fechaInicio <= promo.fechaFin
  )

  const promocionSeleccionada = promocionesDisponibles.find(
    promo => promo.nombre === formulario.promocion
  )

  const precioFinal = promocionSeleccionada
    ? promocionSeleccionada.precio
    : formulario.precio

  const fechaVencimiento = calcularVencimiento(formulario.fechaInicio, formulario.tipo)

  const clientesFiltrados = clientes.filter(cliente =>
    `${cliente.nombre} ${cliente.telefono}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  const clientesActivos = clientes.filter(cliente => cliente.vencimiento >= obtenerFecha())
  const clientesVencidos = clientes.filter(cliente => cliente.vencimiento < obtenerFecha())

  const ingresosMes = clientes.reduce((total, cliente) => {
    const historial = obtenerHistorial(cliente)
    const ingresosCliente = historial
      .filter(membresia =>
        (membresia.fechaPago || membresia.fechaInicio)?.slice(0, 7) === obtenerFecha().slice(0, 7)
      )
      .reduce((suma, membresia) => suma + Number(membresia.precio || 0), 0)
    return total + ingresosCliente
  }, 0)

  const fechaInicioRenovacion = clienteRenovando
    ? formularioRenovacion.modalidad === 'anticipado' &&
      clienteRenovando.vencimiento >= obtenerFecha()
      ? sumarDias(clienteRenovando.vencimiento, 1)
      : obtenerFecha()
    : obtenerFecha()

  const promocionesDisponiblesRenovacion = clienteRenovando
    ? promociones.filter(promo =>
        (promo.aplicaA === formularioRenovacion.tipo || promo.aplicaA === 'Ambas') &&
        fechaInicioRenovacion >= promo.fechaInicio &&
        fechaInicioRenovacion <= promo.fechaFin
      )
    : []

  const promocionRenovacion = promocionesDisponiblesRenovacion.find(
    promo => promo.nombre === formularioRenovacion.promocion
  )

  const precioRenovacion = promocionRenovacion
    ? promocionRenovacion.precio
    : formularioRenovacion.tipo === 'Mensual' ? '200' : '125'

  const fechaFinRenovacion = calcularVencimiento(
    fechaInicioRenovacion,
    formularioRenovacion.tipo
  )

  const membresiasFiltradas = clientes.filter(cliente => {
    const coincideBusqueda = `${cliente.nombre} ${cliente.telefono}`
      .toLowerCase().includes(busqueda.toLowerCase())

    const inactivo = cliente.activo === false
    const vencida = cliente.vencimiento < obtenerFecha()
    const vigente = cliente.vencimiento >= obtenerFecha()

    let coincideFiltro = true
    if (filtroMembresias === 'Activas') coincideFiltro = vigente && !inactivo
    if (filtroMembresias === 'Vencidas') coincideFiltro = vencida && !inactivo
    if (filtroMembresias === 'Inactivas') coincideFiltro = inactivo

    return coincideBusqueda && coincideFiltro
  })

  const historialPagos = clientes
    .flatMap(cliente =>
      obtenerHistorial(cliente).map(registro => ({
        ...registro,
        clienteId: cliente.id,
        nombreCliente: cliente.nombre,
        telefonoCliente: cliente.telefono
      }))
    )
    .sort((a, b) =>
      (b.fechaPago || b.fechaInicio || '').localeCompare(a.fechaPago || a.fechaInicio || '')
    )

  const clientesPorVencer = clientes
    .filter(cliente => {
      const diasRestantes = diferenciaDias(obtenerFecha(), cliente.vencimiento)
      return cliente.activo !== false && diasRestantes >= -3 && diasRestantes <= 3
    })
    .sort((a, b) => a.vencimiento.localeCompare(b.vencimiento))

  const pagosPendientes = clientes
    .filter(cliente =>
      cliente.activo !== false &&
      cliente.vencimiento <= sumarDias(obtenerFecha(), 3)
    )
    .sort((a, b) => a.vencimiento.localeCompare(b.vencimiento))

  function obtenerAvisoPendiente(cliente) {
    const diasRestantes = diferenciaDias(obtenerFecha(), cliente.vencimiento)

    const configuracion = configuracionAvisos.find(
      aviso => aviso.diasAntes === diasRestantes && aviso.activo
    )

    if (!configuracion) return null

    const clave = `${cliente.vencimiento}-${configuracion.diasAntes}`

    const yaEnviado = (cliente.recordatoriosEnviados || []).some(
      registro => registro.clave === clave
    )

    if (yaEnviado) return null
    return { ...configuracion, clave }
  }

  function prepararWhatsApp(cliente) {
    const avisoPendiente = obtenerAvisoPendiente(cliente)

    if (!avisoPendiente) {
      setAviso({
        tipo: 'fecha',
        titulo: 'No hay un aviso pendiente',
        mensaje: 'Este cliente no tiene un recordatorio programado para hoy o el aviso correspondiente ya fue registrado como enviado.'
      })
      return
    }

    if (!/^[0-9]{8}$/.test(cliente.telefono || '')) {
      setAviso({
        tipo: 'fecha',
        titulo: 'Teléfono no válido',
        mensaje: 'El número de teléfono del cliente debe tener exactamente 8 dígitos para abrir WhatsApp.'
      })
      return
    }

    const mensaje = avisoPendiente.mensaje
      .replaceAll('{saludo}', obtenerSaludo())
      .replaceAll('{nombre}', cliente.nombre)
      .replaceAll('{dias}', String(Math.abs(avisoPendiente.diasAntes)))

    const url = `https://wa.me/502${cliente.telefono}?text=${encodeURIComponent(mensaje)}`
    window.open(url, '_blank', 'noopener,noreferrer')

    setAviso({
      tipo: 'confirmarRecordatorio',
      cliente,
      clave: avisoPendiente.clave,
      diasAntes: avisoPendiente.diasAntes
    })
  }

  function confirmarRecordatorioEnviado() {
    if (!aviso?.cliente) return

    const clienteId = aviso.cliente.id
    const registro = {
      clave: aviso.clave,
      diasAntes: aviso.diasAntes,
      fechaVencimiento: aviso.cliente.vencimiento,
      fechaEnviado: obtenerFecha()
    }

    setClientes(actuales =>
      actuales.map(cliente =>
        cliente.id === clienteId
          ? {
              ...cliente,
              recordatoriosEnviados: [
                ...(cliente.recordatoriosEnviados || []).filter(item => item.clave !== registro.clave),
                registro
              ]
            }
          : cliente
      )
    )

    setAviso(null)
  }

  function actualizarConfiguracionAviso(diasAntes, campo, valor) {
    setConfiguracionAvisos(actuales =>
      actuales.map(aviso =>
        aviso.diasAntes === diasAntes
          ? { ...aviso, [campo]: valor }
          : aviso
      )
    )
  }

  function obtenerTituloAviso(diasAntes) {
    if (diasAntes === 0) return 'Aviso el día del vencimiento'
    if (diasAntes > 0) return `Aviso ${diasAntes} días antes`
    return `Aviso ${Math.abs(diasAntes)} días después`
  }

  function obtenerDescripcionAviso(diasAntes) {
    if (diasAntes === 0) return 'Se prepara el día que termina la membresía.'
    if (diasAntes > 0) return `Se prepara ${diasAntes} días antes de la fecha de vencimiento.`
    return `Se prepara ${Math.abs(diasAntes)} días después de la fecha de vencimiento.`
  }

  function cambiarTipo(tipo) {
    setFormulario(actual => ({
      ...actual,
      tipo,
      precio: tipo === 'Mensual' ? '200' : '125',
      promocion: ''
    }))
  }

  function abrirEdicionCliente(cliente) {
    setFormulario({
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      fechaInicio: cliente.fechaInicio,
      tipo: cliente.tipo,
      precio: String(cliente.precio || (cliente.tipo === 'Mensual' ? '200' : '125')),
      metodoPago: cliente.metodoPago || 'Efectivo',
      promocion: cliente.promocion || ''
    })

    setClienteEditando(cliente.id)
    setMostrarFormulario(true)
    setClienteExpandido(null)
  }

  function cancelarEdicionCliente() {
    setFormulario({
      nombre: '',
      telefono: '',
      fechaInicio: obtenerFecha(),
      tipo: 'Mensual',
      precio: '200',
      metodoPago: 'Efectivo',
      promocion: ''
    })
    setClienteEditando(null)
    setCobrarInscripcion(false)
    setClienteExpandido(null)
  }

  function guardarCliente(evento) {
    evento.preventDefault()

    if (
      !formulario.fechaInicio ||
      formulario.fechaInicio.slice(0, 4) !== String(new Date().getFullYear())
    ) {
      setAviso({
        tipo: 'fecha',
        titulo: 'Fecha no válida',
        mensaje: 'La fecha de inscripción debe pertenecer al año actual.'
      })
      return
    }

    const telefonoLimpio = formulario.telefono.trim()
    const clienteExistente = clientes.find(cliente =>
      cliente.telefono === telefonoLimpio &&
      cliente.id !== clienteEditando
    )

    if (clienteExistente) {
      setAviso({ tipo: 'duplicado', cliente: clienteExistente })
      return
    }

    if (clienteEditando) {
      const nuevoVencimiento = calcularVencimiento(formulario.fechaInicio, formulario.tipo)

      setClientes(actuales =>
        actuales.map(cliente => {
          if (cliente.id !== clienteEditando) return cliente

          const historial = obtenerHistorial(cliente)
          const historialActualizado = historial.map((registro, indice) =>
            indice === historial.length - 1
              ? {
                  ...registro,
                  fechaInicio: formulario.fechaInicio,
                  fechaFin: nuevoVencimiento,
                  tipo: formulario.tipo,
                  precio: precioCobrado,
precioMembresia: precioFinal,
inscripcion: cobrarInscripcion ? 50 : 0,
                  metodoPago: formulario.metodoPago,
                  promocion: promocionSeleccionada?.nombre || ''
                }
              : registro
          )

          return {
            ...cliente,
            nombre: formulario.nombre.trim(),
            telefono: telefonoLimpio,
            fechaInicio: formulario.fechaInicio,
            tipo: formulario.tipo,
            precio: precioFinal,
            metodoPago: formulario.metodoPago,
            promocion: promocionSeleccionada?.nombre || '',
            vencimiento: nuevoVencimiento,
            historialMembresias: historialActualizado
          }
        })
      )

      cancelarEdicionCliente()
      return
    }
const precioCobrado = Number(precioFinal) + (cobrarInscripcion ? 50 : 0)
    const nuevoCliente = {
      id: Date.now(),
      ...formulario,
      nombre: formulario.nombre.trim(),
      precio: precioFinal,
      promocion: promocionSeleccionada?.nombre || '',
      telefono: telefonoLimpio,
      vencimiento: fechaVencimiento,
      activo: true,
      recordatoriosEnviados: [],
      historialMembresias: [{
        id: Date.now() + 1,
        fechaInicio: formulario.fechaInicio,
        fechaFin: fechaVencimiento,
        tipo: formulario.tipo,
        precio: precioFinal,
        metodoPago: formulario.metodoPago,
        promocion: promocionSeleccionada?.nombre || '',
        fechaPago: obtenerFecha(),
        modalidad: 'Inscripción inicial'
      }]
    }

    setClientes(actuales => [...actuales, nuevoCliente])
    setFormulario({
      nombre: '',
      telefono: '',
      fechaInicio: obtenerFecha(),
      tipo: 'Mensual',
      precio: '200',
      metodoPago: 'Efectivo',
      promocion: ''
    })
    setMostrarFormulario(false)
  }

  function abrirRenovacion(cliente) {
    const vigente = cliente.vencimiento >= obtenerFecha()
    setClienteRenovando(cliente)

    setFormularioRenovacion({
      modalidad: vigente ? 'anticipado' : 'normal',
      tipo: obtenerUltimaMembresia(cliente)?.tipo || cliente.tipo || 'Mensual',
      metodoPago: 'Efectivo',
      promocion: ''
    })

    setMembresiaExpandida(null)
  }

  function cerrarRenovacion() {
    setClienteRenovando(null)
    setFormularioRenovacion({
      modalidad: 'normal',
      tipo: 'Mensual',
      metodoPago: 'Efectivo',
      promocion: ''
    })
  }

  function guardarRenovacion(evento) {
    evento.preventDefault()
    if (!clienteRenovando) return

    const clienteActual = clientes.find(cliente => cliente.id === clienteRenovando.id)
    if (!clienteActual) return

    const vigente = clienteActual.vencimiento >= obtenerFecha()

    if (!vigente && formularioRenovacion.modalidad === 'anticipado') {
      setAviso({
        tipo: 'fecha',
        titulo: 'Modalidad no disponible',
        mensaje: 'Este cliente ya tiene su membresía vencida. La renovación debe comenzar desde el día del pago.'
      })
      return
    }

    const fechaInicio = vigente && formularioRenovacion.modalidad === 'anticipado'
      ? sumarDias(clienteActual.vencimiento, 1)
      : obtenerFecha()

    const fechaFin = calcularVencimiento(fechaInicio, formularioRenovacion.tipo)

    const nuevoRegistro = {
      id: Date.now(),
      fechaInicio,
      fechaFin,
      tipo: formularioRenovacion.tipo,
      precio: precioRenovacion,
      metodoPago: formularioRenovacion.metodoPago,
      promocion: promocionRenovacion?.nombre || '',
      fechaPago: obtenerFecha(),
      modalidad: vigente && formularioRenovacion.modalidad === 'anticipado'
        ? 'Pago anticipado'
        : 'Renovación normal'
    }

    setClientes(actuales =>
      actuales.map(cliente => {
        if (cliente.id !== clienteActual.id) return cliente

        return {
          ...cliente,
          fechaInicio,
          tipo: formularioRenovacion.tipo,
          precio: precioRenovacion,
          metodoPago: formularioRenovacion.metodoPago,
          promocion: promocionRenovacion?.nombre || '',
          vencimiento: fechaFin,
          activo: true,
          historialMembresias: [
            ...obtenerHistorial(cliente),
            nuevoRegistro
          ]
        }
      })
    )

    cerrarRenovacion()
  }

  function cambiarEstadoCliente(cliente) {
    setClientes(actuales =>
      actuales.map(actual =>
        actual.id === cliente.id
          ? { ...actual, activo: actual.activo === false }
          : actual
      )
    )
    setMembresiaExpandida(null)
  }

  function guardarPromocion(evento) {
    evento.preventDefault()

    if (formularioPromo.fechaFin < formularioPromo.fechaInicio) {
      setAviso({
        tipo: 'fecha',
        titulo: 'Fechas incorrectas',
        mensaje: 'La fecha de finalización no puede ser anterior a la fecha de inicio.'
      })
      return
    }

    const nombreRepetido = promociones.some(promo =>
      promo.nombre.trim().toLowerCase() === formularioPromo.nombre.trim().toLowerCase() &&
      promo.id !== promocionEditando
    )

    if (nombreRepetido) {
      setAviso({
        tipo: 'fecha',
        titulo: 'Nombre repetido',
        mensaje: 'Ya existe una promoción con ese nombre. Utiliza otro nombre.'
      })
      return
    }

    const datos = {
      ...formularioPromo,
      nombre: formularioPromo.nombre.trim(),
      precio: String(Number(formularioPromo.precio))
    }

    if (promocionEditando) {
      setPromociones(actuales =>
        actuales.map(promo =>
          promo.id === promocionEditando ? { ...promo, ...datos } : promo
        )
      )
    } else {
      setPromociones(actuales => [...actuales, { id: Date.now(), ...datos }])
    }

    setFormularioPromo(formularioPromoInicial)
    setPromocionEditando(null)
    setMostrarFormularioPromo(false)
    setPromocionExpandida(null)
  }

  function editarPromocion(promo) {
    setFormularioPromo({
      nombre: promo.nombre,
      precio: promo.precio,
      fechaInicio: promo.fechaInicio,
      fechaFin: promo.fechaFin,
      aplicaA: promo.aplicaA
    })
    setPromocionEditando(promo.id)
    setMostrarFormularioPromo(true)
    setPromocionExpandida(null)
  }

  function cancelarFormularioPromo() {
    setFormularioPromo(formularioPromoInicial)
    setPromocionEditando(null)
    setMostrarFormularioPromo(false)
    setPromocionExpandida(null)
  }

  function solicitarEliminar(cliente) {
    setAviso({ tipo: 'eliminar', cliente })
  }

  function solicitarEliminarPromocion(promo) {
    setAviso({ tipo: 'eliminarPromocion', promocion: promo })
  }

  function confirmarEliminar() {
    if (!aviso) return

    if (aviso.tipo === 'eliminar' && aviso.cliente) {
      setClientes(actuales =>
        actuales.filter(cliente => cliente.id !== aviso.cliente.id)
      )
      setClienteExpandido(null)
    }

    if (aviso.tipo === 'eliminarPromocion' && aviso.promocion) {
      setPromociones(actuales =>
        actuales.filter(promo => promo.id !== aviso.promocion.id)
      )
      setPromocionExpandida(null)
    }

    setAviso(null)
  }

  function cerrarAviso() {
    setAviso(null)
  }

  function estadoPromocion(promo) {
    const hoy = obtenerFecha()
    if (hoy < promo.fechaInicio) return 'Próximamente'
    if (hoy > promo.fechaFin) return 'Vencida'
    return 'Activa'
  }

  function estadoMembresia(cliente) {
    if (cliente.activo === false) return 'Inactivo'
    if (cliente.vencimiento < obtenerFecha()) return 'Vencida'
    return 'Vigente'
  }

  function textoVencimiento(cliente) {
    const dias = diferenciaDias(obtenerFecha(), cliente.vencimiento)
    if (dias === 0) return 'Vence hoy'
    if (dias === 1) return 'Vence mañana'
    if (dias > 1) return `Vence en ${dias} días`
    return `Venció hace ${Math.abs(dias)} días`
  }

  // ENVÍO DE REPORTES POR EMAILJS
  async function enviarReporte(evento) {
    evento.preventDefault()

    if (enviandoReporte) return

    if (!reporte.seccion || !reporte.descripcion.trim()) {
      setResultadoReporte({
        tipo: 'error',
        mensaje: 'Selecciona la sección y describe el error antes de enviar.'
      })
      return
    }

    if (reporte.descripcion.trim().length < 10) {
      setResultadoReporte({
        tipo: 'error',
        mensaje: 'La descripción debe tener al menos 10 caracteres.'
      })
      return
    }

    setEnviandoReporte(true)
    setResultadoReporte(null)

    const ahora = new Date()

    const parametros = {
      reporter_name: reporte.nombre.trim() || 'No especificado',
      section: reporte.seccion,
      description: reporte.descripcion.trim(),
      report_date: ahora.toLocaleDateString('es-GT'),
      report_time: ahora.toLocaleTimeString('es-GT'),
      to_email: 'sthibermartinez280@gmail.com'
    }

    try {
      const respuesta = await fetch(
        'https://api.emailjs.com/api/v1.0/email/send',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            service_id: EMAILJS_SERVICE_ID,
            template_id: EMAILJS_TEMPLATE_ID,
            user_id: EMAILJS_PUBLIC_KEY,
            template_params: parametros
          })
        }
      )

      const detalle = await respuesta.text()

      if (!respuesta.ok) {
        throw new Error(
          `EmailJS respondió con error (${respuesta.status}): ${detalle}`
        )
      }

      setResultadoReporte({
        tipo: 'exito',
        mensaje: '¡Reporte enviado correctamente! El correo fue aceptado por EmailJS.'
      })

      setReporte({
        nombre: '',
        seccion: '',
        descripcion: ''
      })

    } catch (error) {
      console.error('Error al enviar el reporte:', error)

      setResultadoReporte({
        tipo: 'error',
        mensaje: `No se pudo enviar el reporte: ${error.message || 'Error desconocido.'}`
      })

    } finally {
      setEnviandoReporte(false)
    }
  }

  return (
  <div className={`app ${modoOscuro ? 'dark-mode' : ''}`}>
{mostrarConfirmacionCerrarSesion && (
  <div className="logout-modal-overlay">
    <div className="logout-modal">
      <div className="logout-modal-icon">
        <AlertTriangle size={26} />
      </div>

      <h3>¿Cerrar sesión?</h3>

      <p>
        ¿Estás seguro de que deseas cerrar tu sesión?
        Tendrás que ingresar nuevamente para acceder al sistema.
      </p>

      <div className="logout-modal-actions">
        <button
          type="button"
          className="logout-cancel"
          onClick={() => setMostrarConfirmacionCerrarSesion(false)}
        >
          Cancelar
        </button>

        <button
          type="button"
          className="logout-confirm"
          onClick={async () => {
            await supabase.auth.signOut()
          }}
        >
          Sí, cerrar sesión
        </button>
      </div>
    </div>
  </div>
)}
{errorDatos && (
  <div className="cloud-error">
    {errorDatos}
  </div>
)}      <aside className={`sidebar ${menuMovilAbierto ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <h2>ZONA FITNESS CLUB</h2>
          <small>Donde empieza tu cambio</small>
        </div>

        <p className="menu-title">MENÚ PRINCIPAL</p>

        <nav>
          {menu.map(item => {
            const Icono = item.icono
            return (
              <button
                key={item.nombre}
                className={seccion === item.nombre ? 'active' : ''}
                onClick={() => {
  setSeccion(item.nombre)
  setMenuMovilAbierto(false)
}}
              >
                <Icono size={19} strokeWidth={2} />
                <span>{item.nombre}</span>
              </button>
            )
          })}
        </nav>
      </aside>
<button
  type="button"
  className={`mobile-menu-backdrop ${menuMovilAbierto ? 'visible' : ''}`}
  onClick={() => setMenuMovilAbierto(false)}
  aria-label="Cerrar menú"
  tabIndex={menuMovilAbierto ? 0 : -1}
/>
      <main className="main">
        <header className="topbar">
<button
  type="button"
  className="mobile-menu-button"
  onClick={() => setMenuMovilAbierto(true)}
  aria-label="Abrir menú"
  aria-expanded={menuMovilAbierto}
>
  <Menu size={22} />
</button>
  <h1>{seccion}</h1>

  <div className="topbar-actions">
    <button
      className="theme-toggle"
onClick={cambiarTema}      title={modoOscuro ? 'Activar modo claro' : 'Activar modo oscuro'}
      aria-label={modoOscuro ? 'Activar modo claro' : 'Activar modo oscuro'}
    >
      {modoOscuro ? <Sun size={20} /> : <Moon size={20} />}
    </button>

<div className="user">
  <span>{user.email || 'Administrador'}</span>
  <div className="avatar">A</div>
<button
  type="button"
  className="logout-button"
  onClick={() => setMostrarConfirmacionCerrarSesion(true)}
  title="Cerrar sesión"
>
  Cerrar sesión
</button>
</div>
  </div>
</header>

        {/* INICIO */}
        {seccion === 'Inicio' && (
          <>
            <div className="welcome">
              <div>
                <h2>¡Bienvenido a Zona Fitness!</h2>
                <p>Este es el resumen de tu gimnasio.</p>
              </div>
              <span>● SISTEMA LOCAL</span>
            </div>

            <div className="content-card reminders-card">
              <div className="reminders-heading">
                <div>
                  <h3><Bell size={18} /> Vencimientos y recordatorios</h3>
                  <p>Clientes desde 3 días antes hasta 3 días después del vencimiento.</p>
                </div>
                <span className="promo-total">{clientesPorVencer.length} clientes</span>
              </div>

              {clientesPorVencer.length === 0 ? (
                <p className="empty">No hay clientes dentro del período de recordatorios.</p>
              ) : (
                <div className="reminder-list">
                  {clientesPorVencer.map(cliente => {
                    const avisoPendiente = obtenerAvisoPendiente(cliente)
                    const dias = diferenciaDias(obtenerFecha(), cliente.vencimiento)

                    return (
                      <div className="reminder-item" key={cliente.id}>
                        <div className="reminder-person">
                          <div className="reminder-avatar">
                            <Users size={18} />
                          </div>
                          <div>
                            <strong>{cliente.nombre}</strong>
                            <span>{cliente.telefono}</span>
                          </div>
                        </div>

                        <div className="reminder-date">
                          <strong>{textoVencimiento(cliente)}</strong>
                          <span>{formatearFecha(cliente.vencimiento)}</span>
                        </div>

                        <div className="reminder-action">
                          {avisoPendiente ? (
                            <button
                              type="button"
                              className="whatsapp-button"
                              onClick={() => prepararWhatsApp(cliente)}
                            >
                              <MessageCircle size={16} />
                              Enviar aviso
                            </button>
                          ) : (
                            <span className="reminder-status">
                              {dias < 0
                                ? 'Aviso no disponible o enviado'
                                : dias === 0
                                  ? 'Aviso no disponible o enviado'
                                  : 'Sin aviso pendiente'}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <h3 className="dashboard-section-title">Resumen general</h3>

            <div className="stats">
              <div className="stat-card">
                <p>CLIENTES REGISTRADOS</p>
                <h2>{clientes.length}</h2>
                <small>Total de clientes</small>
              </div>

              <div className="stat-card">
                <p>MEMBRESÍAS ACTIVAS</p>
                <h2>{clientesActivos.filter(cliente => cliente.activo !== false).length}</h2>
                <small>Clientes vigentes</small>
              </div>

              <div className="stat-card">
                <p>MEMBRESÍAS VENCIDAS</p>
                <h2>{clientesVencidos.filter(cliente => cliente.activo !== false).length}</h2>
                <small>Requieren renovación</small>
              </div>

              <div className="stat-card">
                <p>INGRESOS DEL MES</p>
                <h2>Q{ingresosMes.toFixed(2)}</h2>
                <small>Pagos registrados</small>
              </div>
            </div>

            <div className="content-card">
              <h3>Actividad reciente</h3>
              {historialPagos.length === 0 ? (
                <p className="empty">Todavía no hay movimientos registrados.</p>
              ) : (
                <div className="recent-activity-list">
                  {historialPagos.slice(0, 5).map(pago => (
                    <div className="recent-activity-item" key={pago.id}>
                      <div className="activity-icon"><Wallet size={17} /></div>
                      <div>
                        <strong>{pago.nombreCliente}</strong>
                        <span>{pago.modalidad || 'Pago de membresía'} · {formatearFecha(pago.fechaPago || pago.fechaInicio)}</span>
                      </div>
                      <strong>Q{Number(pago.precio || 0).toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* CLIENTES */}
        {seccion === 'Clientes' && (
          <>
            <div className="section-actions">
              <div>
                <h2>Directorio de clientes</h2>
                <p>Administra los clientes de Zona Fitness Club.</p>
              </div>
              <button
                className="primary-button"
                onClick={() => {
                  if (mostrarFormulario) {
                    cancelarEdicionCliente()
                  } else {
                    setFormulario({
                      nombre: '',
                      telefono: '',
                      fechaInicio: obtenerFecha(),
                      tipo: 'Mensual',
                      precio: '200',
                      metodoPago: 'Efectivo',
                      promocion: ''
                    })
                    setClienteEditando(null)
                    setMostrarFormulario(true)
                  }
                }}
              >
                <Plus size={18} /> Agregar cliente
              </button>
            </div>

            {mostrarFormulario && (
              <div className="content-card form-card">
                <h3>{clienteEditando ? 'Editar información del cliente' : 'Registrar nuevo cliente'}</h3>
                <p>
                  {clienteEditando
                    ? 'Modifica los datos personales y de la membresía del cliente.'
                    : 'Completa los datos personales y de su membresía.'}
                </p>

                <form onSubmit={guardarCliente}>
                  <div className="form-grid">
                    <label>
                      Nombre completo
                      <input
                        type="text"
                        placeholder="Nombre y apellidos"
                        value={formulario.nombre}
onChange={e => setFormulario({ ...formulario, nombre: convertirNombre(e.target.value) })}                        required
                      />
                    </label>

                    <label>
                      Número de celular
                      <input
                        type="tel"
                        inputMode="numeric"
                        placeholder="Ej. 55555555"
                        value={formulario.telefono}
                        onChange={e => setFormulario({
                          ...formulario,
                          telefono: e.target.value.replace(/\D/g, '').slice(0, 8)
                        })}
                        minLength={8}
                        maxLength={8}
                        pattern="[0-9]{8}"
                        title="Ingresa exactamente 8 números"
                        required
                      />
                    </label>

                    <label>
                      Fecha de inscripción
                      <SelectorFecha
                        value={formulario.fechaInicio}
                        onChange={fecha => setFormulario({ ...formulario, fechaInicio: fecha, promocion: '' })}
                      />
                    </label>

                    <label>
                      Tipo de membresía
                      <SelectorOpcion
                        value={formulario.tipo}
                        options={['Mensual', 'Quincenal']}
                        onChange={cambiarTipo}
                      />
                    </label>

                    {promocionesDisponibles.length > 0 && (
                      <label>
                        Promoción
                        <SelectorOpcion
                          value={formulario.promocion || 'Sin promoción'}
                          options={['Sin promoción', ...promocionesDisponibles.map(promo => promo.nombre)]}
                          onChange={valor => setFormulario({
                            ...formulario,
                            promocion: valor === 'Sin promoción' ? '' : valor
                          })}
                        />
                      </label>
                    )}

                    <label>
                      Precio de membresía
                      <input type="text" value={`Q${Number(precioFinal).toFixed(2)}`} readOnly />
                    </label>

{!clienteEditando && (
  <label className="inscripcion-option">
    <span>Inscripción inicial</span>
    <div>
      <input
        type="checkbox"
        checked={cobrarInscripcion}
        onChange={e => setCobrarInscripcion(e.target.checked)}
      />
      Agregar Q50 de inscripción
    </div>
  </label>
)}

<label>
  Total a cobrar
  <input
    type="text"
    value={`Q${(Number(precioFinal) + (!clienteEditando && cobrarInscripcion ? 50 : 0)).toFixed(2)}`}
    readOnly
  />
</label>

                    <label>
                      Método de pago
                      <SelectorOpcion
                        value={formulario.metodoPago}
                        options={['Efectivo', 'Transferencia']}
                        onChange={metodoPago => setFormulario({ ...formulario, metodoPago })}
                      />
                    </label>

                    <label>
                      Fecha de vencimiento
                      <input type="text" value={formatearFecha(fechaVencimiento)} readOnly />
                    </label>
                  </div>

                  <div className="form-buttons">
                    <button type="button" className="cancel-button" onClick={cancelarEdicionCliente}>
                      Cancelar
                    </button>
                    <button type="submit" className="primary-button">
                      {clienteEditando ? 'Guardar cambios' : 'Guardar cliente'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="content-card">
              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Buscar por nombre o teléfono..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                />
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>CLIENTE</th>
                      <th>TELÉFONO</th>
                      <th>MEMBRESÍA</th>
                      <th>VENCIMIENTO</th>
                      <th>ESTADO</th>
                      <th>ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesFiltrados.map(cliente => {
                      const activo = cliente.vencimiento >= obtenerFecha()
                      const expandido = clienteExpandido === cliente.id

                      return (
                        <Fragment key={cliente.id}>
                          <tr
                            className={`promo-row ${expandido ? 'promo-row-expanded' : ''}`}
                            onClick={() => setClienteExpandido(expandido ? null : cliente.id)}
                          >
                            <td>
                              <div className="promo-name-cell">
                                <strong>{cliente.nombre}</strong>
                                <ChevronDown size={15} className={`promo-expand-icon ${expandido ? 'promo-icon-open' : ''}`} />
                              </div>
                            </td>
                            <td>{cliente.telefono}</td>
                            <td>
                              {cliente.tipo}
                              {cliente.promocion && (
                                <small className="client-promo-label">{cliente.promocion}</small>
                              )}
                            </td>
                            <td>{formatearFecha(cliente.vencimiento)}</td>
                            <td>
                              <span className={
                                cliente.activo === false
                                  ? 'status-expired'
                                  : activo ? 'status-active' : 'status-expired'
                              }>
                                {cliente.activo === false ? 'Inactivo' : activo ? 'Vigente' : 'Vencida'}
                              </span>
                            </td>
                            <td>
                              {expandido && <span className="promo-expanded-indicator">Opciones</span>}
                            </td>
                          </tr>

                          {expandido && (
                            <tr className="promo-details-row">
                              <td colSpan="6">
                                <div className="promo-expanded-actions">
                                  <button
                                    type="button"
                                    className="promo-delete-expanded"
                                    onClick={() => solicitarEliminar(cliente)}
                                  >
                                    <Trash2 size={16} /> Eliminar
                                  </button>

                                  <button
                                    type="button"
                                    className="promo-edit-expanded"
                                    onClick={() => abrirEdicionCliente(cliente)}
                                  >
                                    <Pencil size={16} /> Editar cliente
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>

                {clientesFiltrados.length === 0 && (
                  <p className="empty">
                    {clientes.length === 0 ? 'Todavía no hay clientes registrados.' : 'No se encontraron clientes.'}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* MEMBRESÍAS */}
        {seccion === 'Membresías' && (
          <>
            <div className="section-actions">
              <div>
                <h2>Control de membresías</h2>
                <p>Administra vencimientos, renovaciones y clientes.</p>
              </div>
            </div>

            <div className="stats">
              <div className="stat-card">
                <p>MEMBRESÍAS VIGENTES</p>
                <h2>{clientes.filter(c => c.vencimiento >= obtenerFecha() && c.activo !== false).length}</h2>
                <small>Clientes al día</small>
              </div>
              <div className="stat-card">
                <p>MEMBRESÍAS VENCIDAS</p>
                <h2>{clientes.filter(c => c.vencimiento < obtenerFecha() && c.activo !== false).length}</h2>
                <small>Pendientes de renovación</small>
              </div>
              <div className="stat-card">
                <p>CLIENTES INACTIVOS</p>
                <h2>{clientes.filter(c => c.activo === false).length}</h2>
                <small>Marcados como inactivos</small>
              </div>
              <div className="stat-card">
                <p>TOTAL DE CLIENTES</p>
                <h2>{clientes.length}</h2>
                <small>Registros del gimnasio</small>
              </div>
            </div>

            <div className="content-card">
              <div className="promo-list-heading">
                <div>
                  <h3>Listado de membresías</h3>
                </div>
              </div>

              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Buscar por nombre o teléfono..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                />
              </div>

              <div className="membership-filter-control" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                maxWidth: '280px',
                marginBottom: '22px'
              }}>
                <span style={{
                  color: '#777',
                  fontSize: '11px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}>Mostrar:</span>
                <div style={{ flex: 1 }}>
                  <SelectorOpcion
                    value={filtroMembresias}
                    options={['Todas', 'Activas', 'Vencidas', 'Inactivas']}
                    onChange={filtro => {
                      setFiltroMembresias(filtro)
                      setMembresiaExpandida(null)
                    }}
                  />
                </div>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>CLIENTE</th>
                      <th>MEMBRESÍA</th>
                      <th>PRECIO</th>
                      <th>VENCIMIENTO</th>
                      <th>ESTADO</th>
                      <th>ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {membresiasFiltradas.map(cliente => {
                      const expandida = membresiaExpandida === cliente.id
                      const estado = estadoMembresia(cliente)

                      return (
                        <Fragment key={cliente.id}>
                          <tr
                            className="promo-row"
                            onClick={() => setMembresiaExpandida(expandida ? null : cliente.id)}
                          >
                            <td>
                              <div className="promo-name-cell">
                                <strong>{cliente.nombre}</strong>
                                <ChevronDown size={15} className={`promo-expand-icon ${expandida ? 'promo-icon-open' : ''}`} />
                              </div>
                              <small>{cliente.telefono}</small>
                            </td>
                            <td>{cliente.tipo}</td>
                            <td>Q{Number(cliente.precio).toFixed(2)}</td>
                            <td>{formatearFecha(cliente.vencimiento)}</td>
                            <td>
                              <span className={estado === 'Vigente' ? 'status-active' : 'status-expired'}>
                                {estado}
                              </span>
                            </td>
                            <td>{expandida && <span className="promo-expanded-indicator">Opciones</span>}</td>
                          </tr>

                          {expandida && (
                            <tr className="promo-details-row">
                              <td colSpan="6">
                                <div className="membership-expanded-content">
                                  <div className="promo-expanded-actions">
                                    <button
                                      type="button"
                                      className="promo-edit-expanded"
                                      onClick={() => abrirRenovacion(cliente)}
                                    >
                                      <RefreshCw size={16} /> Renovar membresía
                                    </button>

                                    {cliente.activo === false ? (
                                      <button
                                        type="button"
                                        className="promo-edit-expanded"
                                        onClick={() => cambiarEstadoCliente(cliente)}
                                      >
                                        <UserCheck size={16} /> Reactivar cliente
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className="promo-delete-expanded"
                                        onClick={() => cambiarEstadoCliente(cliente)}
                                      >
                                        <UserX size={16} /> Marcar inactivo
                                      </button>
                                    )}
                                  </div>

                                  <div className="membership-history">
                                    <h4>
                                      <History size={16} /> Historial de membresías
                                    </h4>
                                    <div className="table-container">
                                      <table style={{ minWidth: '500px' }}>
                                        <thead>
                                          <tr>
                                            <th>MEMBRESÍA Y PERÍODO</th>
                                            <th>FECHA DE PAGO</th>
                                            <th>MÉTODO Y MODALIDAD</th>
                                            <th>PRECIO</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {obtenerHistorial(cliente).slice().reverse().map((registro, indice) => (
                                            <tr key={registro.id || indice}>
                                              <td>
                                                <strong>{registro.tipo}</strong>
                                                {indice === 0 && <span className="latest-label">MÁS RECIENTE</span>}
                                                <br />
                                                <small>
                                                  {formatearFecha(registro.fechaInicio)} al {formatearFecha(registro.fechaFin)}
                                                </small>
                                              </td>
                                              <td>{formatearFecha(registro.fechaPago || registro.fechaInicio)}</td>
                                              <td>
                                                {registro.metodoPago || 'Sin especificar'}
                                                <br />
                                                <small>{registro.modalidad || 'Membresía'}</small>
                                              </td>
                                              <td><strong>Q{Number(registro.precio || 0).toFixed(2)}</strong></td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>

                {membresiasFiltradas.length === 0 && (
                  <p className="empty">
                    {clientes.length === 0 ? 'Todavía no hay clientes registrados.' : 'No se encontraron clientes en este filtro.'}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* PROMOCIONES */}
        {seccion === 'Promociones' && (
          <>
            <div className="section-actions">
              <div>
                <h2>Administración de promociones</h2>
                <p>Crea y administra los precios especiales del gimnasio.</p>
              </div>
              <button
                className="primary-button"
                onClick={() => {
                  if (mostrarFormularioPromo) {
                    cancelarFormularioPromo()
                  } else {
                    setFormularioPromo(formularioPromoInicial)
                    setPromocionEditando(null)
                    setMostrarFormularioPromo(true)
                  }
                }}
              >
                <Plus size={18} /> Agregar promoción
              </button>
            </div>

            {mostrarFormularioPromo && (
              <div className="content-card form-card">
                <h3>{promocionEditando ? 'Editar promoción' : 'Nueva promoción'}</h3>
                <p>Configura el precio y el período en el que estará disponible.</p>

                <form onSubmit={guardarPromocion}>
                  <div className="form-grid">
                    <label>
                      Nombre de la promoción
                      <input
                        type="text"
                        placeholder="Ej. Estudiantes"
                        value={formularioPromo.nombre}
                        onChange={e => setFormularioPromo({ ...formularioPromo, nombre: e.target.value })}
                        required
                      />
                    </label>
                    <label>
                      Precio promocional (Q)
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        placeholder="Ej. 175"
                        value={formularioPromo.precio}
                        onChange={e => setFormularioPromo({ ...formularioPromo, precio: e.target.value })}
                        required
                      />
                    </label>
                    <label>
                      Fecha de inicio
                      <SelectorFecha
                        value={formularioPromo.fechaInicio}
                        onChange={fecha => setFormularioPromo({ ...formularioPromo, fechaInicio: fecha })}
                      />
                    </label>
                    <label>
                      Fecha de finalización
                      <SelectorFecha
                        value={formularioPromo.fechaFin}
                        onChange={fecha => setFormularioPromo({ ...formularioPromo, fechaFin: fecha })}
                      />
                    </label>
                    <label>
                      Aplicar a membresía
                      <SelectorOpcion
                        value={formularioPromo.aplicaA}
                        options={['Mensual', 'Quincenal', 'Ambas']}
                        onChange={aplicaA => setFormularioPromo({ ...formularioPromo, aplicaA })}
                      />
                    </label>
                  </div>

                  <div className="form-buttons">
                    <button type="button" className="cancel-button" onClick={cancelarFormularioPromo}>Cancelar</button>
                    <button type="submit" className="primary-button">
                      {promocionEditando ? 'Guardar cambios' : 'Guardar promoción'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="content-card">
              <div className="promo-list-heading">
                <div><h3>Promociones registradas</h3></div>
                <span className="promo-total">{promociones.length} en total</span>
              </div>

              {promociones.length === 0 ? (
                <p className="empty">Todavía no hay promociones registradas.</p>
              ) : (
                <div className="promo-table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>PROMOCIÓN</th>
                        <th>PRECIO</th>
                        <th>MEMBRESÍA</th>
                        <th>VIGENCIA</th>
                        <th>ESTADO</th>
                        <th>ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promociones.map(promo => {
                        const estado = estadoPromocion(promo)
                        const expandida = promocionExpandida === promo.id

                        return (
                          <Fragment key={promo.id}>
                            <tr
                              className={`promo-row ${expandida ? 'promo-row-expanded' : ''}`}
                              onClick={() => setPromocionExpandida(expandida ? null : promo.id)}
                            >
                              <td>
                                <div className="promo-name-cell">
                                  <strong>{promo.nombre}</strong>
                                  <ChevronDown size={15} className={`promo-expand-icon ${expandida ? 'promo-icon-open' : ''}`} />
                                </div>
                              </td>
                              <td>Q{Number(promo.precio).toFixed(2)}</td>
                              <td>{promo.aplicaA}</td>
                              <td>
                                {formatearFecha(promo.fechaInicio)}
                                <span className="promo-date-separator"> al </span>
                                {formatearFecha(promo.fechaFin)}
                              </td>
                              <td>
                                <span className={
                                  estado === 'Activa'
                                    ? 'status-active'
                                    : estado === 'Vencida' ? 'status-expired' : 'status-upcoming'
                                }>{estado}</span>
                              </td>
                              <td>{expandida && <span className="promo-expanded-indicator">Opciones</span>}</td>
                            </tr>

                            {expandida && (
                              <tr className="promo-details-row">
                                <td colSpan="6">
                                  <div className="promo-expanded-actions">
                                    <button
                                      type="button"
                                      className="promo-delete-expanded"
                                      onClick={() => solicitarEliminarPromocion(promo)}
                                    >
                                      <Trash2 size={16} /> Eliminar
                                    </button>
                                    <button
                                      type="button"
                                      className="promo-edit-expanded"
                                      onClick={() => editarPromocion(promo)}
                                    >
                                      <Pencil size={16} /> Editar promoción
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* PAGOS */}
        {seccion === 'Pagos' && (
          <>
            <div className="section-actions">
              <div>
                <h2>Administración de pagos</h2>
                <p>Consulta los pagos registrados y administra las renovaciones.</p>
              </div>
              <button
                className="primary-button"
                onClick={() => setMostrarConfiguracionAvisos(!mostrarConfiguracionAvisos)}
              >
                <Settings size={17} />
                Configurar avisos
              </button>
            </div>

            <div className="stats payment-stats">
              <div className="stat-card">
                <p>PAGOS REGISTRADOS</p>
                <h2>{historialPagos.length}</h2>
                <small>Inscripciones y renovaciones</small>
              </div>
              <div className="stat-card">
                <p>INGRESOS DEL MES</p>
                <h2>Q{ingresosMes.toFixed(2)}</h2>
                <small>Pagos recibidos este mes</small>
              </div>
              <div className="stat-card">
                <p>RENOVACIONES PENDIENTES</p>
                <h2>{pagosPendientes.length}</h2>
                <small>Vencidos y próximos a vencer</small>
              </div>
              <div className="stat-card">
                <p>AVISOS PENDIENTES</p>
                <h2>{clientes.filter(cliente => obtenerAvisoPendiente(cliente)).length}</h2>
                <small>Recordatorios programados para hoy</small>
              </div>
            </div>

            {mostrarConfiguracionAvisos && (
              <div className="content-card reminder-settings">
                <div className="settings-heading">
                  <div>
                    <h3><Settings size={18} /> Configuración de recordatorios</h3>
                    <p>Activa los avisos y personaliza el mensaje que se prepara en WhatsApp.</p>
                  </div>
                </div>

                {configuracionAvisos.map(config => (
                  <div className="template-card" key={config.diasAntes}>
                    <div className="template-top">
                      <div>
                        <strong>{obtenerTituloAviso(config.diasAntes)}</strong>
                        <span>{obtenerDescripcionAviso(config.diasAntes)}</span>
                      </div>

                      <label className="switch-control">
                        <input
                          type="checkbox"
                          checked={config.activo}
                          onChange={e => actualizarConfiguracionAviso(config.diasAntes, 'activo', e.target.checked)}
                        />
                        <span className="switch-slider" />
                      </label>
                    </div>

                    <label className="template-message-label">
                      Mensaje de WhatsApp
                      <textarea
                        rows="3"
                        value={config.mensaje}
                        onChange={e => actualizarConfiguracionAviso(config.diasAntes, 'mensaje', e.target.value)}
                      />
                    </label>
                    <small className="template-hint">
                      Puedes utilizar <strong>{'{saludo}'}</strong> para insertar el saludo según la hora, <strong>{'{nombre}'}</strong> para insertar el nombre del cliente y <strong>{'{dias}'}</strong> para insertar la cantidad de días.
                    </small>
                  </div>
                ))}

                <div className="settings-footer">
                  <span>Los mensajes nunca se envían automáticamente.</span>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setMostrarConfiguracionAvisos(false)}
                  >
                    <Check size={16} /> Guardar configuración
                  </button>
                </div>
              </div>
            )}

            <div className="content-card">
              <div className="promo-list-heading">
                <div>
                  <h3><Clock size={17} /> Clientes pendientes de renovar</h3>
                  <p>Clientes vencidos o que vencen durante los próximos tres días.</p>
                </div>
                <span className="promo-total">{pagosPendientes.length} pendientes</span>
              </div>

              {pagosPendientes.length === 0 ? (
                <p className="empty">No hay clientes pendientes de renovación.</p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>CLIENTE</th>
                        <th>TELÉFONO</th>
                        <th>VENCIMIENTO</th>
                        <th>ESTADO</th>
                        <th>ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagosPendientes.map(cliente => (
                        <tr key={cliente.id}>
                          <td><strong>{cliente.nombre}</strong></td>
                          <td>{cliente.telefono}</td>
                          <td>
                            {formatearFecha(cliente.vencimiento)}
                            <small className="client-promo-label">{textoVencimiento(cliente)}</small>
                          </td>
                          <td>
                            <span className={cliente.vencimiento < obtenerFecha() ? 'status-expired' : 'status-upcoming'}>
                              {cliente.vencimiento < obtenerFecha() ? 'Vencida' : 'Por vencer'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="payment-renew-button"
                              onClick={() => abrirRenovacion(cliente)}
                            >
                              <RefreshCw size={15} /> Registrar renovación
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="content-card">
              <div className="promo-list-heading">
                <div>
                  <h3><History size={17} /> Historial de pagos</h3>
                  <p>Inscripciones y renovaciones registradas en el sistema.</p>
                </div>
                <span className="promo-total">{historialPagos.length} registros</span>
              </div>

              {historialPagos.length === 0 ? (
                <p className="empty">Todavía no hay pagos registrados.</p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>CLIENTE</th>
                        <th>FECHA DE PAGO</th>
                        <th>CONCEPTO</th>
                        <th>MÉTODO</th>
                        <th>PRECIO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialPagos.map((pago, indice) => (
                        <tr key={`${pago.clienteId}-${pago.id || indice}`}>
                          <td>
                            <strong>{pago.nombreCliente}</strong>
                            <small className="client-promo-label">{pago.telefonoCliente}</small>
                          </td>
                          <td>{formatearFecha(pago.fechaPago || pago.fechaInicio)}</td>
                          <td>
                            {pago.modalidad || 'Membresía'}
                            <small className="client-promo-label">
                              {pago.tipo} · hasta {formatearFecha(pago.fechaFin)}
                            </small>
                          </td>
                          <td>{pago.metodoPago || 'Sin especificar'}</td>
                          <td><strong>Q{Number(pago.precio || 0).toFixed(2)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* REPORTES */}
        {seccion === 'Reportes' && (
          <>
            <div className="section-actions">
              <div>
                <h2>Reportar un problema</h2>
                <p>Ayúdanos a mejorar Zona Fitness Club informando cualquier error que encuentres.</p>
              </div>
            </div>

            <div className="content-card form-card">
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '22px'
              }}>
                <div style={{
                  width: '45px',
                  height: '45px',
                  borderRadius: '12px',
                  background: '#fff4d6',
                  color: '#b98500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <AlertTriangle size={23} />
                </div>

                <div>
                  <h3 style={{ margin: 0 }}>Formulario de reporte</h3>
                  <p style={{ margin: '5px 0 0' }}>
                    Describe qué ocurrió para que podamos revisarlo.
                  </p>
                </div>
              </div>

              <form onSubmit={enviarReporte}>
                <div className="form-grid">
                  <label>
                    Tu nombre
                    <input
                      type="text"
                      placeholder="Escribe tu nombre (opcional)"
                      value={reporte.nombre}
                      onChange={e => {
                        setReporte({ ...reporte, nombre: e.target.value })
                        setResultadoReporte(null)
                      }}
                    />
                  </label>

                  <label>
                    ¿En qué sección ocurrió el error?
                    <SelectorOpcion
                      value={reporte.seccion}
                      placeholder="Seleccionar sección"
                      options={[
                        'Inicio',
                        'Clientes',
                        'Membresías',
                        'Promociones',
                        'Pagos',
                        'Mediciones',
                        'Reportes',
                        'Otra sección'
                      ]}
                      onChange={valor => {
                        setReporte({ ...reporte, seccion: valor })
                        setResultadoReporte(null)
                      }}
                    />
                  </label>

                  <label style={{ gridColumn: '1 / -1' }}>
                    Describe el problema
                    <textarea
                      rows="6"
                      placeholder="Explica qué estabas haciendo, qué ocurrió y qué esperabas que sucediera..."
                      value={reporte.descripcion}
                      onChange={e => {
                        setReporte({ ...reporte, descripcion: e.target.value })
                        setResultadoReporte(null)
                      }}
                      required
                      minLength={10}
                      style={{
                        width: '100%',
                        padding: '13px 14px',
                        border: '1px solid #dedede',
                        borderRadius: '9px',
                        fontFamily: 'inherit',
                        fontSize: '13px',
                        resize: 'vertical',
                        outlineColor: '#e5b400'
                      }}
                    />
                    <small style={{
                      display: 'block',
                      marginTop: '7px',
                      color: '#888',
                      fontWeight: 400
                    }}>
                      Mínimo 10 caracteres.
                    </small>
                  </label>
                </div>

                {resultadoReporte && (
                  <div
                    role="status"
                    aria-live="polite"
                    style={{
                      marginTop: '20px',
                      padding: '14px 16px',
                      borderRadius: '9px',
                      background: resultadoReporte.tipo === 'exito' ? '#eaf7ed' : '#fff0ee',
                      color: resultadoReporte.tipo === 'exito' ? '#24743b' : '#b83227',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '9px'
                    }}
                  >
                    {resultadoReporte.tipo === 'exito'
                      ? <Check size={18} />
                      : <AlertTriangle size={18} />}
                    <span>{resultadoReporte.mensaje}</span>
                  </div>
                )}

                <div className="form-buttons">
                  <button
                    type="button"
                    className="cancel-button"
                    disabled={enviandoReporte}
                    onClick={() => {
                      setReporte({
                        nombre: '',
                        seccion: '',
                        descripcion: ''
                      })
                      setResultadoReporte(null)
                    }}
                  >
                    Limpiar formulario
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={
                      enviandoReporte ||
                      !reporte.seccion ||
                      reporte.descripcion.trim().length < 10
                    }
                  >
                    {enviandoReporte ? (
                      <>
                        <RefreshCw size={17} />
                        Enviando reporte...
                      </>
                    ) : (
                      <>
                        <MessageCircle size={17} />
                        Enviar reporte
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            <div className="content-card" style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '13px'
            }}>
              <Bell size={20} color="#b98500" />
              <div>
                <h3 style={{ marginBottom: '6px' }}>¿Qué sucede al enviar un reporte?</h3>
                <p style={{
                  color: '#777',
                  fontSize: '13px',
                  lineHeight: 1.7
                }}>
                  El reporte llegará al correo del administrador con la descripción,
                  la sección donde ocurrió el problema y la fecha y hora del envío.
                </p>
              </div>
            </div>
          </>
        )}

        {/* MEDICIONES */}
        {seccion === 'Mediciones' && (
          <div className="content-card">
            <h2>Mediciones</h2>
            <p>Esta sección estará disponible próximamente.</p>
          </div>
        )}
      </main>

      {/* MODAL DE RENOVACIÓN */}
      {clienteRenovando && (
        <div className="modal-overlay">
          <div
            className="confirmation-modal renewal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="renewal-title"
          >
            <button
              type="button"
              className="modal-close"
              onClick={cerrarRenovacion}
              aria-label="Cerrar renovación"
            >
              <X size={19} />
            </button>

            <div className="modal-icon modal-icon-warning">
              <RefreshCw size={25} />
            </div>

            <h2 id="renewal-title">Renovar membresía</h2>
            <p className="modal-description">
              Registra el pago y el nuevo período de {clienteRenovando.nombre}.
            </p>

            <form onSubmit={guardarRenovacion}>
              <div className="renewal-form">
                <label>
                  Tipo de renovación
                  <SelectorOpcion
                    value={formularioRenovacion.modalidad === 'anticipado' ? 'Pago anticipado' : 'Renovación normal'}
                    options={
                      clienteRenovando.vencimiento >= obtenerFecha()
                        ? ['Pago anticipado', 'Renovación normal']
                        : ['Renovación normal']
                    }
                    onChange={valor => setFormularioRenovacion(actual => ({
                      ...actual,
                      modalidad: valor === 'Pago anticipado' ? 'anticipado' : 'normal',
                      promocion: ''
                    }))}
                  />
                </label>

                {formularioRenovacion.modalidad === 'anticipado' &&
                  clienteRenovando.vencimiento >= obtenerFecha() && (
                    <p className="renewal-note">
                      <Check size={15} />
                      Se conservarán los días que todavía tiene disponibles.
                    </p>
                  )}

                <label>
                  Tipo de membresía
                  <SelectorOpcion
                    value={formularioRenovacion.tipo}
                    options={['Mensual', 'Quincenal']}
                    onChange={tipo => setFormularioRenovacion(actual => ({
                      ...actual,
                      tipo,
                      promocion: ''
                    }))}
                  />
                </label>

                {promocionesDisponiblesRenovacion.length > 0 && (
                  <label>
                    Promoción
                    <SelectorOpcion
                      value={formularioRenovacion.promocion || 'Sin promoción'}
                      options={['Sin promoción', ...promocionesDisponiblesRenovacion.map(promo => promo.nombre)]}
                      onChange={valor => setFormularioRenovacion(actual => ({
                        ...actual,
                        promocion: valor === 'Sin promoción' ? '' : valor
                      }))}
                    />
                  </label>
                )}

                <label>
                  Método de pago
                  <SelectorOpcion
                    value={formularioRenovacion.metodoPago}
                    options={['Efectivo', 'Transferencia']}
                    onChange={metodoPago => setFormularioRenovacion(actual => ({
                      ...actual,
                      metodoPago
                    }))}
                  />
                </label>

                <label>
                  Precio a pagar
                  <input type="text" value={`Q${Number(precioRenovacion).toFixed(2)}`} readOnly />
                </label>
              </div>

              <div className="renewal-preview">
                <h4>Resumen de la nueva membresía</h4>
                <div>
                  <span>Fecha de pago</span>
                  <strong>{formatearFecha(obtenerFecha())}</strong>
                </div>
                <div>
                  <span>Inicio de la membresía</span>
                  <strong>{formatearFecha(fechaInicioRenovacion)}</strong>
                </div>
                <div>
                  <span>Fecha de vencimiento</span>
                  <strong>{formatearFecha(fechaFinRenovacion)}</strong>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="modal-cancel-button" onClick={cerrarRenovacion}>
                  Cancelar
                </button>
                <button type="submit" className="modal-primary-button">
                  Confirmar pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALES DE AVISO */}
      {aviso && (
        <div className="modal-overlay">
          <div
            className="confirmation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <button type="button" className="modal-close" onClick={cerrarAviso} aria-label="Cerrar aviso">
              <X size={19} />
            </button>

            <div className={`modal-icon ${
              aviso.tipo === 'eliminar' || aviso.tipo === 'eliminarPromocion'
                ? 'modal-icon-danger'
                : 'modal-icon-warning'
            }`}>
              {aviso.tipo === 'confirmarRecordatorio'
                ? <MessageCircle size={26} />
                : <AlertTriangle size={27} />}
            </div>

            {aviso.tipo === 'duplicado' && (
              <>
                <h2 id="modal-title">Cliente ya registrado</h2>
                <p className="modal-description">
                  No se puede registrar este número porque ya pertenece a un cliente.
                </p>
                <div className="modal-client-info">
                  <span>CLIENTE REGISTRADO</span>
                  <strong>{aviso.cliente.nombre}</strong>
                  <small>{aviso.cliente.telefono}</small>
                </div>
                <button className="modal-primary-button" onClick={cerrarAviso}>Entendido</button>
              </>
            )}

            {aviso.tipo === 'fecha' && (
              <>
                <h2 id="modal-title">{aviso.titulo}</h2>
                <p className="modal-description">{aviso.mensaje}</p>
                <button className="modal-primary-button" onClick={cerrarAviso}>Entendido</button>
              </>
            )}

            {aviso.tipo === 'confirmarRecordatorio' && (
              <>
                <h2 id="modal-title">¿Enviaste el recordatorio?</h2>
                <p className="modal-description">
                  Se abrió WhatsApp con el mensaje preparado para {aviso.cliente.nombre}.
                  Cuando hayas enviado el mensaje desde WhatsApp, confirma aquí para registrar el aviso.
                </p>
                <div className="modal-client-info">
                  <span>RECORDATORIO</span>
                  <strong>{aviso.cliente.nombre}</strong>
                  <small>{obtenerTituloAviso(aviso.diasAntes)}</small>
                </div>
                <div className="modal-actions">
                  <button className="modal-cancel-button" onClick={cerrarAviso}>
                    Todavía no
                  </button>
                  <button className="modal-primary-button" onClick={confirmarRecordatorioEnviado}>
                    <Check size={16} /> Sí, mensaje enviado
                  </button>
                </div>
              </>
            )}

            {aviso.tipo === 'eliminar' && (
              <>
                <h2 id="modal-title">¿Eliminar este cliente?</h2>
                <p className="modal-description">
                  Estás a punto de eliminar este registro. Esta acción no se puede deshacer.
                </p>
                <div className="modal-client-info">
                  <span>CLIENTE SELECCIONADO</span>
                  <strong>{aviso.cliente.nombre}</strong>
                  <small>{aviso.cliente.telefono}</small>
                </div>
                <div className="modal-actions">
                  <button className="modal-cancel-button" onClick={cerrarAviso}>Cancelar</button>
                  <button className="modal-delete-button" onClick={confirmarEliminar}>
                    <Trash2 size={16} /> Sí, eliminar
                  </button>
                </div>
              </>
            )}

            {aviso.tipo === 'eliminarPromocion' && (
              <>
                <h2 id="modal-title">¿Eliminar esta promoción?</h2>
                <p className="modal-description">
                  Los nuevos registros ya no podrán utilizar esta promoción.
                </p>
                <div className="modal-client-info">
                  <span>PROMOCIÓN SELECCIONADA</span>
                  <strong>{aviso.promocion.nombre}</strong>
                  <small>Q{Number(aviso.promocion.precio).toFixed(2)}</small>
                </div>
                <div className="modal-actions">
                  <button className="modal-cancel-button" onClick={cerrarAviso}>Cancelar</button>
                  <button className="modal-delete-button" onClick={confirmarEliminar}>
                    <Trash2 size={16} /> Sí, eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
function PantallaLogin() {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
const [modoOscuroLogin, setModoOscuroLogin] = useState(() => {
  return localStorage.getItem('zona-fitness-tema') === 'oscuro'
})

useEffect(() => {
  localStorage.setItem(
    'zona-fitness-tema',
    modoOscuroLogin ? 'oscuro' : 'claro'
  )
}, [modoOscuroLogin])

  const iniciarSesion = async (e) => {
    e.preventDefault()
    setError('')
    setCargando(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: correo,
      password: contrasena
    })

if (error) {
  console.error('Error de inicio de sesión:', error)
  setError(error.message)
}
    setCargando(false)
  }

  return (
<div className={`login-container ${modoOscuroLogin ? 'dark-mode' : ''}`}>      <form className="login-card" onSubmit={iniciarSesion}>
<button
  type="button"
  className="login-theme-toggle"
  onClick={() => setModoOscuroLogin(!modoOscuroLogin)}
  title={modoOscuroLogin ? 'Activar modo claro' : 'Activar modo oscuro'}
>
  {modoOscuroLogin ? <Sun size={20} /> : <Moon size={20} />}
</button>
        <h1>Zona Fitness Club</h1>
        <p>Inicia sesión para continuar</p>

        <label>Correo electrónico</label>
        <input
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="Tu correo electrónico"
          required
        />

        <label>Contraseña</label>
        <input
          type="password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          placeholder="Tu contraseña"
          required
        />

        {error && <p className="login-error">{error}</p>}

        <button type="submit" disabled={cargando}>
          {cargando ? 'Iniciando sesión...' : 'Iniciar sesión'}
        </button>
      </form>
    </div>
  )
}
function App() {
  const [sesion, setSesion] = useState(null)
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    let activo = true

    async function comprobarSesion() {
      const { data, error } = await supabase.auth.getSession()

      if (!activo) return

      if (error) {
        console.error('Error verificando sesión:', error)
      }

      setSesion(data?.session || null)
      setVerificando(false)
    }

    comprobarSesion()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSesion(nuevaSesion)
      setVerificando(false)
    })

    return () => {
      activo = false
      subscription.unsubscribe()
    }
  }, [])

  if (verificando) {
    return (
      <div className="auth-loading">
        Verificando acceso...
      </div>
    )
  }

  return sesion
    ? <Aplicacion user={sesion.user} />
    : <PantallaLogin />
}

export default App