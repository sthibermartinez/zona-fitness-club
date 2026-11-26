import { Fragment, useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard, Users, CalendarCheck, CreditCard, Ruler,
  BarChart3, Plus, Search, CalendarDays, ChevronLeft,
  ChevronRight, ChevronDown, Check, Trash2, X,
  AlertTriangle, Tag, Pencil, RefreshCw, UserX,
  UserCheck, History, MessageCircle, Bell, Settings,
  Clock, Wallet, Menu, Droplet, Package, Save
} from 'lucide-react'
import {
  // Conserva todos tus iconos actuales
  Moon,
  Sun
} from 'lucide-react'

import './App.css'
import { supabase } from './supabase'
import PanelInstructores, { PantallaAcceso } from './PanelInstructores'
import AsistenciaAdmin from './AsistenciaAdmin'
import GestionEmpleados from './GestionEmpleados'
import { identificadorACorreo } from './identificadorAcceso'
// CONFIGURACIÓN DE EMAILJS
const EMAILJS_SERVICE_ID = 'service_hqfkepk'
const EMAILJS_TEMPLATE_ID = 'template_6rqaj9g'
const EMAILJS_PUBLIC_KEY = 'PMdHSL_neEKHEKyXH'

const PRODUCTOS_BASE_VENTAS = [
  { id: 'base-visitas', tipo: 'base', clave: 'visitas', nombre: 'Visitas', detalle: 'Entradas al gimnasio', precio: 15, icono: 'Users', activo: true },
  { id: 'base-agua', tipo: 'base', clave: 'agua', nombre: 'Botellas de agua', detalle: 'Unidades vendidas', precio: 8, icono: 'Package', activo: true },
  { id: 'base-proteina', tipo: 'base', clave: 'proteina', nombre: 'Scoop de proteína', detalle: 'Porciones vendidas', precio: 13, icono: 'Package', activo: true },
  { id: 'base-creatina', tipo: 'base', clave: 'creatina', nombre: 'Scoop de creatina', detalle: 'Porciones vendidas', precio: 5, icono: 'Package', activo: true }
]

function obtenerNombreCorto(nombre) {
  return String(nombre || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join(' ')
}

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
  // El día de pago cuenta como el día 1: 15 días en total = fecha de pago + 14
  if (tipo === 'Quincenal') return sumarDias(fecha, 14)
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

// RECIBOS DIGITALES DE PAGO
function obtenerSiguienteNumeroRecibo(clientes) {
  let mayor = 0

  clientes.forEach(cliente => {
    ;(cliente.historialMembresias || []).forEach(registro => {
      const numero = Number(registro.numeroRecibo)
      if (Number.isFinite(numero) && numero > mayor) mayor = numero
    })
  })

  return mayor + 1
}

function formatearNumeroRecibo(numero) {
  return String(numero).padStart(6, '0')
}

function obtenerConceptoRecibo(registro) {
  if (registro.incluyeInscripcion) {
    return `Inscripción + ${registro.tipo === 'Quincenal' ? 'Quincena' : 'Mensualidad'}`
  }
  if (registro.tipo === 'Quincenal') return 'Quincena'
  if (registro.tipo === 'Mensual') return 'Mensualidad'
  return registro.tipo || 'Membresía'
}

async function crearImagenRecibo(registro, nombreCliente) {
  const AMARILLO = '#FFD400'
  const FUENTE = 'Montserrat, Arial, sans-serif'
  const ancho = 900
  const alto = 1360

  try {
    await Promise.all([
      document.fonts.load(`800 40px ${FUENTE}`),
      document.fonts.load(`600 30px ${FUENTE}`)
    ])
  } catch {
    // Si la fuente no carga, se usa Arial y el recibo se genera igual
  }

  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const ctx = lienzo.getContext('2d')

  function texto(contenido, x, y, tamano, peso, color, alineacion = 'left', anchoMaximo = 740) {
    let tamanoFinal = tamano
    ctx.font = `${peso} ${tamanoFinal}px ${FUENTE}`
    while (ctx.measureText(contenido).width > anchoMaximo && tamanoFinal > 16) {
      tamanoFinal -= 1
      ctx.font = `${peso} ${tamanoFinal}px ${FUENTE}`
    }
    ctx.fillStyle = color
    ctx.textAlign = alineacion
    ctx.fillText(contenido, x, y)
  }

  // Fondo y barra superior
  ctx.fillStyle = '#0A0A0A'
  ctx.fillRect(0, 0, ancho, alto)
  ctx.fillStyle = AMARILLO
  ctx.fillRect(0, 0, ancho, 16)

  // Encabezado
  texto('ZONA FITNESS CLUB', ancho / 2, 150, 56, 800, AMARILLO, 'center')
  ctx.fillStyle = AMARILLO
  ctx.fillRect(ancho / 2 - 150, 185, 300, 4)
  texto('RECIBO DE PAGO', ancho / 2, 270, 38, 800, '#FFFFFF', 'center')
  texto(`RECIBO No. ${formatearNumeroRecibo(registro.numeroRecibo)}`, ancho / 2, 325, 28, 600, '#BDBDBD', 'center')

  // Datos del pago
  // Cliente nuevo: se muestra la fecha de inscripción. Renovación: la fecha de pago.
  const esInscripcion = registro.modalidad === 'Inscripción inicial'
  const filas = [
    ['CLIENTE', nombreCliente],
    ['CONCEPTO', obtenerConceptoRecibo(registro)],
    esInscripcion
      ? ['FECHA DE INSCRIPCIÓN', formatearFecha(registro.fechaInicio)]
      : ['FECHA DE PAGO', formatearFecha(registro.fechaPago || registro.fechaInicio)],
    ['VIGENCIA', `${formatearFecha(registro.fechaInicio)} al ${formatearFecha(registro.fechaFin)}`]
  ]

  filas.forEach(([etiqueta, valor], indice) => {
    const y = 420 + indice * 120
    texto(etiqueta, 80, y, 22, 600, AMARILLO)
    texto(valor, 80, y + 46, 34, 600, '#FFFFFF')
  })

  // Monto destacado
  ctx.strokeStyle = AMARILLO
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.roundRect(80, 900, 740, 170, 18)
  ctx.stroke()
  texto(`Q${Number(registro.precio || 0).toFixed(2)}`, ancho / 2, 1012, 100, 800, AMARILLO, 'center', 680)

  // Estado del pago
  ctx.fillStyle = AMARILLO
  ctx.beginPath()
  ctx.roundRect(ancho / 2 - 190, 1100, 380, 70, 35)
  ctx.fill()
  texto('PAGO RECIBIDO', ancho / 2, 1146, 30, 800, '#0A0A0A', 'center')

  // Mensaje final
  texto('Gracias por formar parte de Zona Fitness Club.', ancho / 2, 1245, 26, 600, '#FFFFFF', 'center')
  texto('Donde empieza tu cambio.', ancho / 2, 1295, 28, 800, AMARILLO, 'center')

  return new Promise((resolver, rechazar) => {
    lienzo.toBlob(
      blob => (blob ? resolver(blob) : rechazar(new Error('No se pudo crear la imagen'))),
      'image/png'
    )
  })
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


function SelectorMes({ value, onChange }) {
  const fechaActual = obtenerFecha().slice(0, 7)
  const [abierto, setAbierto] = useState(false)
  const [anioVisible, setAnioVisible] = useState(() =>
    Number((value || fechaActual).slice(0, 4))
  )
  const selectorRef = useRef(null)

  const nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]
  const mesSeleccionado = value ? Number(value.slice(5, 7)) - 1 : -1
  const nombreMes = value
    ? new Date(Number(value.slice(0, 4)), mesSeleccionado, 1)
        .toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })
    : 'Seleccionar mes'

  useEffect(() => {
    function detectarClickFuera(evento) {
      if (selectorRef.current && !selectorRef.current.contains(evento.target)) {
        setAbierto(false)
      }
    }
    document.addEventListener('pointerdown', detectarClickFuera)
    return () => document.removeEventListener('pointerdown', detectarClickFuera)
  }, [])

  function abrirSelector() {
    if (!abierto) {
      setAnioVisible(Number((value || fechaActual).slice(0, 4)))
      setAbierto(true)
    } else {
      setAbierto(false)
    }
  }

  function seleccionarMes(indice) {
    const nuevoMes = `${anioVisible}-${String(indice + 1).padStart(2, '0')}`
    if (nuevoMes > fechaActual) return
    onChange(nuevoMes)
    setAbierto(false)
  }

  return (
    <div className="date-picker report-month-picker" ref={selectorRef}>
      <button
        type="button"
        className={`date-input ${abierto ? 'date-input-open' : ''}`}
        onClick={abrirSelector}
        aria-expanded={abierto}
        aria-label="Seleccionar mes del informe"
      >
        <span className={value ? 'date-value' : 'date-placeholder'}>
          {nombreMes}
        </span>
        <CalendarDays size={18} />
      </button>

      {abierto && (
        <div className="calendar-popup report-month-popup">
          <div className="month-selector">
            <div className="month-selector-header">
              <button
                type="button"
                className="calendar-nav"
                onClick={() => setAnioVisible(anio => anio - 1)}
                aria-label="Año anterior"
              >
                <ChevronLeft size={18} />
              </button>

              <div>
                <strong>{anioVisible}</strong>
                <span>Selecciona un mes</span>
              </div>

              <button
                type="button"
                className="calendar-nav"
                onClick={() => setAnioVisible(anio => anio + 1)}
                disabled={anioVisible >= Number(fechaActual.slice(0, 4))}
                aria-label="Año siguiente"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="month-grid">
              {nombresMeses.map((mes, indice) => {
                const claveMes = `${anioVisible}-${String(indice + 1).padStart(2, '0')}`
                const esFuturo = claveMes > fechaActual
                const esSeleccionado =
                  anioVisible === Number(value?.slice(0, 4)) &&
                  indice === mesSeleccionado

                return (
                  <button
                    type="button"
                    key={mes}
                    disabled={esFuturo}
                    className={`month-option ${esSeleccionado ? 'month-selected' : ''}`}
                    onClick={() => seleccionarMes(indice)}
                  >
                    {mes.slice(0, 3)}
                  </button>
                )
              })}
            </div>

            <div className="calendar-footer">
              <span>Selecciona el período que deseas consultar</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SelectorFecha({ value, onChange, fechaMaxima }) {
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
                  const bloqueado = Boolean(fechaMaxima) && fechaDia > fechaMaxima

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
                      disabled={bloqueado}
                      style={bloqueado ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
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
  const [registrosVentas, setRegistrosVentas] = useState([])
  const [productosVenta, setProductosVenta] = useState(PRODUCTOS_BASE_VENTAS)
  const [fechaVenta, setFechaVenta] = useState(obtenerFecha())
  const [formularioVentas, setFormularioVentas] = useState({ visitas: '0', agua: '0', proteina: '0', creatina: '0', productos: {} })
  const [mostrarNuevoProducto, setMostrarNuevoProducto] = useState(false)
  const [productoAEliminar, setProductoAEliminar] = useState(null)
  const [productoEditando, setProductoEditando] = useState(null)
  const [modoEdicionCatalogo, setModoEdicionCatalogo] = useState(false)
  const [formularioProductoEdicion, setFormularioProductoEdicion] = useState({ nombre: '', precio: '' })
  const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', precio: '' })
  const [avisoVentas, setAvisoVentas] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [generandoRecibo, setGenerandoRecibo] = useState(false)
  const [errorRecibo, setErrorRecibo] = useState('')

  // ESTADOS DE REPORTES
  const [reporte, setReporte] = useState({
    nombre: '',
    seccion: '',
    descripcion: ''
  })
  const [enviandoReporte, setEnviandoReporte] = useState(false)
  const [resultadoReporte, setResultadoReporte] = useState(null)
// ESTADOS DEL RESUMEN MENSUAL
const [mesSeleccionado, setMesSeleccionado] = useState(obtenerFecha().slice(0, 7))
const [mesGenerado, setMesGenerado] = useState('')
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
      .select('clientes, promociones, configuracion_avisos, registros_ventas, productos_venta')
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
      setRegistrosVentas(Array.isArray(data.registros_ventas) ? data.registros_ventas : [])
      const catalogoGuardado = Array.isArray(data.productos_venta) ? data.productos_venta : []
      const productosBaseGuardados = catalogoGuardado.filter(producto => producto.tipo === 'base')
      const productosPersonalizados = catalogoGuardado.filter(producto => producto.tipo !== 'base')
      setProductosVenta([
        ...PRODUCTOS_BASE_VENTAS.map(productoBase => ({
          ...productoBase,
          ...(productosBaseGuardados.find(producto => producto.id === productoBase.id) || {})
        })),
        ...productosPersonalizados
      ])
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
        registros_ventas: registrosVentas,
        productos_venta: productosVenta,
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
}, [datosCargados, user.id, clientes, promociones, configuracionAvisos, registrosVentas, productosVenta])
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
    promocion: '',
    fechaPago: obtenerFecha()
  })

  const menu = [
    { nombre: 'Inicio', icono: LayoutDashboard },
    { nombre: 'Clientes', icono: Users },
    { nombre: 'Membresías', icono: CalendarCheck },
    { nombre: 'Promociones', icono: Tag },
    { nombre: 'Pagos', icono: CreditCard },
    { nombre: 'Ventas diarias', icono: Wallet },
    { nombre: 'Asistencia', icono: UserCheck },
    { nombre: 'Instructores', icono: Users },
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

  useEffect(() => {
    const registro = registrosVentas.find(item => item.fecha === fechaVenta)
    setFormularioVentas(registro ? {
      visitas: String(registro.visitas ?? 0),
      agua: String(registro.agua ?? 0),
      proteina: String(registro.proteina ?? 0),
      creatina: String(registro.creatina ?? 0),
      productos: registro.productos || {}
    } : { visitas: '0', agua: '0', proteina: '0', creatina: '0', productos: {} })
    setAvisoVentas('')
  }, [fechaVenta, registrosVentas])

  const productosActivosVenta = productosVenta.filter(producto => producto.activo !== false)
  const ingresosVentasDia = productosActivosVenta.reduce((total, producto) => {
    const cantidad = producto.tipo === 'base'
      ? Number(formularioVentas[producto.clave] || 0)
      : Number(formularioVentas.productos?.[producto.id] || 0)
    return total + cantidad * Number(producto.precio || 0)
  }, 0)

  // Ingreso total de un registro de Ventas diarias (cantidad x precio histórico).
  // Usa registro.precios; si el registro es antiguo y no tiene ese precio, usa el catálogo actual.
  function calcularIngresosRegistroVenta(registro) {
    if (!registro) return 0
    return productosVenta.reduce((suma, producto) => {
      const clave = producto.tipo === 'base' ? producto.clave : producto.id
      const cantidad = producto.tipo === 'base'
        ? Number(registro[producto.clave] || 0)
        : Number(registro.productos?.[producto.id] || 0)
      const precio = Number(registro.precios?.[clave] ?? producto.precio ?? 0)
      return suma + (Number.isFinite(cantidad) ? cantidad : 0) * (Number.isFinite(precio) ? precio : 0)
    }, 0)
  }

  function guardarVentasDia() {
    const nuevoRegistro = {
      fecha: fechaVenta,
      visitas: Math.max(0, Number(formularioVentas.visitas || 0)),
      agua: Math.max(0, Number(formularioVentas.agua || 0)),
      proteina: Math.max(0, Number(formularioVentas.proteina || 0)),
      creatina: Math.max(0, Number(formularioVentas.creatina || 0)),
      productos: Object.fromEntries(Object.entries(formularioVentas.productos || {}).map(([id, cantidad]) => [id, Math.max(0, Number(cantidad || 0))])),
      precios: Object.fromEntries(productosVenta.map(producto => [producto.tipo === 'base' ? producto.clave : producto.id, Number(producto.precio || 0)])),
      nombres: Object.fromEntries(productosVenta.map(producto => [producto.tipo === 'base' ? producto.clave : producto.id, producto.nombre]))
    }
    setRegistrosVentas(actuales => [...actuales.filter(item => item.fecha !== fechaVenta), nuevoRegistro].sort((a, b) => a.fecha.localeCompare(b.fecha)))
    setAvisoVentas('Registro del día actualizado. Se guardará automáticamente.')
  }

  function agregarProductoVenta(evento) {
    evento.preventDefault()
    const nombre = nuevoProducto.nombre.trim()
    const precio = Number(nuevoProducto.precio)
    if (!nombre || !Number.isFinite(precio) || precio <= 0) return
    const producto = { id: `producto-${Date.now()}`, nombre, precio }
    setProductosVenta(actuales => [...actuales, producto])
    setFormularioVentas(actual => ({ ...actual, productos: { ...actual.productos, [producto.id]: '0' } }))
    setNuevoProducto({ nombre: '', precio: '' })
    setMostrarNuevoProducto(false)
  }

  function abrirEdicionProductoVenta(producto) {
    setProductoEditando(producto)
    setFormularioProductoEdicion({ nombre: producto.nombre || '', precio: String(producto.precio ?? '') })
  }

  function guardarEdicionProductoVenta(evento) {
    evento.preventDefault()
    if (!productoEditando) return
    const nombre = formularioProductoEdicion.nombre.trim()
    const precio = Number(formularioProductoEdicion.precio)
    if (!nombre || !Number.isFinite(precio) || precio <= 0) return

    // Antes de cambiar precios, fijamos los precios actuales en registros antiguos
    // que todavía no tenían una copia histórica de su catálogo.
    setRegistrosVentas(actuales => actuales.map(registro => registro.precios ? registro : ({
      ...registro,
      precios: Object.fromEntries(productosVenta.map(producto => [
        producto.tipo === 'base' ? producto.clave : producto.id,
        Number(producto.precio || 0)
      ]))
    })))

    setProductosVenta(actuales => actuales.map(producto =>
      producto.id === productoEditando.id ? { ...producto, nombre, precio } : producto
    ))
    setProductoEditando(null)
    setModoEdicionCatalogo(false)
    setAvisoVentas('Producto actualizado correctamente.')
  }

  function confirmarEliminarProductoVenta() {
    if (!productoAEliminar) return
    // Se desactiva en lugar de borrarlo para conservar los importes de ventas históricas.
    setProductosVenta(actuales => actuales.map(producto =>
      producto.id === productoAEliminar.id ? { ...producto, activo: false } : producto
    ))
    setProductoAEliminar(null)
    setModoEdicionCatalogo(false)
    setAvisoVentas('Producto eliminado de la lista de ventas.')
  }

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

  // Ventas diarias del mes actual (se suman aparte de las membresías, sin duplicar)
  const ingresosVentasDiariasMes = registrosVentas
    .filter(registro => (registro.fecha || '').slice(0, 7) === obtenerFecha().slice(0, 7))
    .reduce((total, registro) => total + calcularIngresosRegistroVenta(registro), 0)

  const ingresosMesTotal = ingresosMes + ingresosVentasDiariasMes

  const fechaInicioRenovacion = clienteRenovando
    ? formularioRenovacion.modalidad === 'anticipado' &&
      clienteRenovando.vencimiento >= obtenerFecha()
      ? sumarDias(clienteRenovando.vencimiento, 1)
      : formularioRenovacion.fechaPago || obtenerFecha()
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
// DATOS DEL RESUMEN MENSUAL
const pagosDelMes = mesGenerado
  ? historialPagos.filter(pago =>
      (pago.fechaPago || pago.fechaInicio || '').slice(0, 7) === mesGenerado
    )
  : []

const fechaMesAnterior = mesGenerado
  ? (() => {
      const [anio, mes] = mesGenerado.split('-').map(Number)
      const fecha = new Date(anio, mes - 2, 1)
      return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
    })()
  : ''

const pagosMesAnterior = fechaMesAnterior
  ? historialPagos.filter(pago =>
      (pago.fechaPago || pago.fechaInicio || '').slice(0, 7) === fechaMesAnterior
    )
  : []

const registrosVentasDelMes = mesGenerado
  ? registrosVentas.filter(registro => (registro.fecha || '').slice(0, 7) === mesGenerado)
  : []

const registrosVentasMesAnterior = fechaMesAnterior
  ? registrosVentas.filter(registro => (registro.fecha || '').slice(0, 7) === fechaMesAnterior)
  : []

const ingresosMembresiasReporte = pagosDelMes.reduce(
  (total, pago) => total + Number(pago.precio || 0), 0
)

const ingresosVentasReporte = registrosVentasDelMes.reduce(
  (total, registro) => total + calcularIngresosRegistroVenta(registro), 0
)

const ingresosReporte = ingresosMembresiasReporte + ingresosVentasReporte

const ingresosMembresiasMesAnterior = pagosMesAnterior.reduce(
  (total, pago) => total + Number(pago.precio || 0), 0
)

const ingresosVentasMesAnterior = registrosVentasMesAnterior.reduce(
  (total, registro) => total + calcularIngresosRegistroVenta(registro), 0
)

const ingresosMesAnterior = ingresosMembresiasMesAnterior + ingresosVentasMesAnterior

const diferenciaIngresos = ingresosReporte - ingresosMesAnterior

const porcentajeCambio = ingresosMesAnterior > 0
  ? (diferenciaIngresos / ingresosMesAnterior) * 100
  : ingresosReporte > 0 ? 100 : 0

const nuevasInscripciones = pagosDelMes.filter(
  pago => pago.modalidad === 'Inscripción inicial'
).length

const renovacionesReporte = pagosDelMes.filter(
  pago => pago.modalidad !== 'Inscripción inicial'
).length

const pagosEfectivo = pagosDelMes.filter(
  pago => pago.metodoPago === 'Efectivo'
)

const pagosTransferencia = pagosDelMes.filter(
  pago => pago.metodoPago === 'Transferencia'
)

const diasDelMes = mesGenerado
  ? new Date(
      Number(mesGenerado.slice(0, 4)),
      Number(mesGenerado.slice(5, 7)),
      0
    ).getDate()
  : 0

const ventasDiarias = Array.from({ length: diasDelMes }, (_, indice) => {
  const dia = String(indice + 1).padStart(2, '0')
  const fecha = `${mesGenerado}-${dia}`

  const pagosDia = pagosDelMes.filter(
    pago => (pago.fechaPago || pago.fechaInicio) === fecha
  )

  const ingresosMembresiasDia = pagosDia.reduce(
    (total, pago) => total + Number(pago.precio || 0), 0
  )

  const ingresosVentasDiaReporte = registrosVentasDelMes
    .filter(registro => registro.fecha === fecha)
    .reduce((total, registro) => total + calcularIngresosRegistroVenta(registro), 0)

  return {
    dia: indice + 1,
    ingresosMembresias: ingresosMembresiasDia,
    ingresosVentas: ingresosVentasDiaReporte,
    ingresos: ingresosMembresiasDia + ingresosVentasDiaReporte,
    cantidad: pagosDia.length
  }
})

const maximoDiario = Math.max(
  0,
  ...ventasDiarias.map(dia => dia.ingresos)
)

const diaMayorIngreso = ventasDiarias.reduce(
  (mayor, dia) => dia.ingresos > mayor.ingresos ? dia : mayor,
  { dia: 0, ingresos: 0, cantidad: 0 }
)

const diaMasPagos = ventasDiarias.reduce(
  (mayor, dia) => dia.cantidad > mayor.cantidad ? dia : mayor,
  { dia: 0, ingresos: 0, cantidad: 0 }
)

const ventasSemanales = [1, 2, 3, 4, 5].map(semana => {
  const inicio = (semana - 1) * 7 + 1
  const fin = Math.min(semana * 7, diasDelMes)

  const pagosSemana = pagosDelMes.filter(pago => {
    const fecha = pago.fechaPago || pago.fechaInicio
    if (!fecha) return false

    const dia = Number(fecha.slice(8, 10))
    return dia >= inicio && dia <= fin
  })

  const ingresosMembresiasSemana = pagosSemana.reduce(
    (total, pago) => total + Number(pago.precio || 0), 0
  )

  const ingresosVentasSemana = registrosVentasDelMes
    .filter(registro => {
      const dia = Number((registro.fecha || '').slice(8, 10))
      return dia >= inicio && dia <= fin
    })
    .reduce((total, registro) => total + calcularIngresosRegistroVenta(registro), 0)

  return {
    semana,
    inicio,
    fin,
    ingresosMembresias: ingresosMembresiasSemana,
    ingresosVentas: ingresosVentasSemana,
    ingresos: ingresosMembresiasSemana + ingresosVentasSemana,
    cantidad: pagosSemana.length
  }
}).filter(semana => semana.inicio <= diasDelMes)

const maximoSemanal = Math.max(
  0,
  ...ventasSemanales.map(semana => semana.ingresos)
)

const metodosPagoReporte = [
  {
    nombre: 'Efectivo',
    cantidad: pagosEfectivo.length,
    ingresos: pagosEfectivo.reduce(
      (total, pago) => total + Number(pago.precio || 0), 0
    )
  },
  {
    nombre: 'Transferencia',
    cantidad: pagosTransferencia.length,
    ingresos: pagosTransferencia.reduce(
      (total, pago) => total + Number(pago.precio || 0), 0
    )
  },
  {
    nombre: 'Sin especificar',
    cantidad: pagosDelMes.filter(
      pago => !['Efectivo', 'Transferencia'].includes(pago.metodoPago)
    ).length,
    ingresos: pagosDelMes.filter(
      pago => !['Efectivo', 'Transferencia'].includes(pago.metodoPago)
    ).reduce((total, pago) => total + Number(pago.precio || 0), 0)
  }
]

const nombreMesReporte = mesGenerado
  ? new Date(
      Number(mesGenerado.slice(0, 4)),
      Number(mesGenerado.slice(5, 7)) - 1,
      1
    ).toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })
  : ''
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
  .replaceAll('{fecha_vencimiento}', formatearFecha(cliente.vencimiento))
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
  setMostrarFormulario(false)
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
                  precio: precioFinal,
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
    const registroInicial = {
      id: Date.now() + 1,
      numeroRecibo: obtenerSiguienteNumeroRecibo(clientes),
      fechaInicio: formulario.fechaInicio,
      fechaFin: fechaVencimiento,
      tipo: formulario.tipo,
      precio: precioCobrado,
      metodoPago: formulario.metodoPago,
      promocion: promocionSeleccionada?.nombre || '',
      fechaPago: formulario.fechaInicio,
      fechaRegistro: obtenerFecha(),
      incluyeInscripcion: cobrarInscripcion,
      modalidad: 'Inscripción inicial'
    }

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
      historialMembresias: [registroInicial]
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
    setCobrarInscripcion(false)
    setErrorRecibo('')
    setAviso({
      tipo: 'renovacionExitosa',
      cliente: nuevoCliente,
      registro: registroInicial,
      esNuevoCliente: true
    })
  }

  function abrirRenovacion(cliente) {
    const vigente = cliente.vencimiento >= obtenerFecha()
    setClienteRenovando(cliente)

    setFormularioRenovacion({
      modalidad: vigente ? 'anticipado' : 'normal',
      tipo: obtenerUltimaMembresia(cliente)?.tipo || cliente.tipo || 'Mensual',
      metodoPago: 'Efectivo',
      promocion: '',
      fechaPago: obtenerFecha()
    })

    setMembresiaExpandida(null)
  }

  function cerrarRenovacion() {
    setClienteRenovando(null)
    setFormularioRenovacion({
      modalidad: 'normal',
      tipo: 'Mensual',
      metodoPago: 'Efectivo',
      promocion: '',
      fechaPago: obtenerFecha()
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

    const fechaPagoSeleccionada = formularioRenovacion.fechaPago || obtenerFecha()

    if (fechaPagoSeleccionada > obtenerFecha()) {
      setAviso({
        tipo: 'fecha',
        titulo: 'Fecha de pago no válida',
        mensaje: 'La fecha de pago no puede ser posterior a hoy.'
      })
      return
    }

    const fechaInicio = vigente && formularioRenovacion.modalidad === 'anticipado'
      ? sumarDias(clienteActual.vencimiento, 1)
      : fechaPagoSeleccionada

    const fechaFin = calcularVencimiento(fechaInicio, formularioRenovacion.tipo)

    const nuevoRegistro = {
      id: Date.now(),
      numeroRecibo: obtenerSiguienteNumeroRecibo(clientes),
      fechaInicio,
      fechaFin,
      tipo: formularioRenovacion.tipo,
      precio: precioRenovacion,
      metodoPago: formularioRenovacion.metodoPago,
      promocion: promocionRenovacion?.nombre || '',
      fechaPago: fechaPagoSeleccionada,
      fechaRegistro: obtenerFecha(),
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
    setErrorRecibo('')
    setAviso({
      tipo: 'renovacionExitosa',
      cliente: clienteActual,
      registro: nuevoRegistro
    })
  }

  async function generarReciboYEnviarWhatsApp() {
    if (!aviso?.cliente || !aviso?.registro || generandoRecibo) return

    const { cliente, registro } = aviso

    if (!/^[0-9]{8}$/.test(cliente.telefono || '')) {
      setErrorRecibo('El número de teléfono del cliente debe tener exactamente 8 dígitos para abrir WhatsApp.')
      return
    }

    setGenerandoRecibo(true)
    setErrorRecibo('')

    try {
      const imagen = await crearImagenRecibo(registro, cliente.nombre)
      const nombreArchivo = `Recibo-${formatearNumeroRecibo(registro.numeroRecibo)}.png`

      const mensaje = `${obtenerSaludo()}, ${cliente.nombre}. Le compartimos su recibo de pago No. ${formatearNumeroRecibo(registro.numeroRecibo)} de Zona Fitness Club. ¡Gracias por su preferencia! 💪`

      // En celular: menú Compartir del teléfono con la imagen ya adjunta
      const archivoRecibo = new File([imagen], nombreArchivo, { type: 'image/png' })
      const esMovil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

      if (esMovil && navigator.canShare && navigator.canShare({ files: [archivoRecibo] })) {
        try {
          await navigator.share({ files: [archivoRecibo], text: mensaje })
          setAviso({ tipo: 'reciboGenerado', cliente, registro, compartido: true, nombreArchivo })
          return
        } catch (errorCompartir) {
          if (errorCompartir?.name === 'AbortError') return
        }
      }

      let copiado = false
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': imagen })])
        copiado = true
      } catch {
        copiado = false
      }

      if (!copiado) {
        const enlaceDescarga = document.createElement('a')
        enlaceDescarga.href = URL.createObjectURL(imagen)
        enlaceDescarga.download = nombreArchivo
        enlaceDescarga.click()
        setTimeout(() => URL.revokeObjectURL(enlaceDescarga.href), 1000)
      }

      const url = `https://wa.me/502${cliente.telefono}?text=${encodeURIComponent(mensaje)}`
      window.open(url, '_blank', 'noopener,noreferrer')

      setAviso({
        tipo: 'reciboGenerado',
        cliente,
        registro,
        copiado,
        nombreArchivo
      })
    } catch (error) {
      console.error('Error generando el recibo:', error)
      setErrorRecibo('No se pudo generar el recibo. Intenta de nuevo.')
    } finally {
      setGenerandoRecibo(false)
    }
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
                            <strong>{obtenerNombreCorto(cliente.nombre)}</strong>
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
                <h2>Q{ingresosMesTotal.toFixed(2)}</h2>
                <small>Membresías Q{ingresosMes.toFixed(2)} · Ventas Q{ingresosVentasDiariasMes.toFixed(2)}</small>
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
        <h2>Centro de reportes</h2>
        <p>Consulta el rendimiento del gimnasio y reporta cualquier problema.</p>
      </div>
    </div>

    <div className="report-tabs">
      <button
        type="button"
        className="report-tab active"
        onClick={() => setMesGenerado(mesGenerado)}
      >
        <BarChart3 size={17} />
        Resumen mensual
      </button>
      <button
        type="button"
        className="report-tab"
        onClick={() => {
          document.getElementById('formulario-reporte-problema')?.scrollIntoView({
            behavior: 'smooth'
          })
        }}
      >
        <AlertTriangle size={17} />
        Reportar un problema
      </button>
    </div>

    <div className="content-card report-period-card">
      <div>
        <h3>Generar resumen mensual</h3>
        <p>Selecciona cualquier mes para consultar sus resultados históricos.</p>
      </div>

      <div className="report-period-controls">
        <label>
          Mes del informe
          <SelectorMes
            value={mesSeleccionado}
            onChange={setMesSeleccionado}
          />
        </label>

        <button
          type="button"
          className="primary-button"
          disabled={!mesSeleccionado || mesSeleccionado > obtenerFecha().slice(0, 7)}
          onClick={() => setMesGenerado(mesSeleccionado)}
        >
          <BarChart3 size={17} />
          Generar resumen
        </button>
      </div>
    </div>

    {!mesGenerado ? (
      <div className="content-card report-empty">
        <BarChart3 size={35} />
        <h3>Tu resumen mensual aparecerá aquí</h3>
        <p>Selecciona un mes y presiona «Generar resumen» para consultar los resultados.</p>
      </div>
    ) : (
      <>
        <div className="report-heading">
          <div>
            <span>INFORME GENERADO</span>
            <h2>{nombreMesReporte.charAt(0).toUpperCase() + nombreMesReporte.slice(1)}</h2>
          </div>
          <span className="report-payment-count">
            {pagosDelMes.length} pagos registrados
          </span>
        </div>

        <div className="report-kpi-grid">
          <div className="report-kpi">
            <span>INGRESOS TOTALES</span>
            <h2>Q{ingresosReporte.toFixed(2)}</h2>
            <small>
              {diferenciaIngresos >= 0 ? '+' : ''}
              Q{diferenciaIngresos.toFixed(2)} frente al mes anterior
            </small>
            <small>
              Membresías Q{ingresosMembresiasReporte.toFixed(2)} · Ventas diarias Q{ingresosVentasReporte.toFixed(2)}
            </small>
          </div>

          <div className="report-kpi">
            <span>PAGOS REGISTRADOS</span>
            <h2>{pagosDelMes.length}</h2>
            <small>Inscripciones y renovaciones</small>
          </div>

          <div className="report-kpi">
            <span>NUEVAS INSCRIPCIONES</span>
            <h2>{nuevasInscripciones}</h2>
            <small>Clientes registrados inicialmente</small>
          </div>

          <div className="report-kpi">
            <span>RENOVACIONES</span>
            <h2>{renovacionesReporte}</h2>
            <small>Pagos de renovación</small>
          </div>
        </div>

        <div className="content-card report-comparison-card">
          <div>
            <h3>Comparación con el mes anterior</h3>
            <p>
              Ingresos de {new Date(
                Number(fechaMesAnterior.slice(0, 4)),
                Number(fechaMesAnterior.slice(5, 7)) - 1,
                1
              ).toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="report-comparison-values">
            <strong>Q{ingresosMesAnterior.toFixed(2)}</strong>
            <span className={
              diferenciaIngresos > 0
                ? 'report-positive'
                : diferenciaIngresos < 0
                  ? 'report-negative'
                  : ''
            }>
              {diferenciaIngresos > 0 ? '+' : ''}
              {porcentajeCambio.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="content-card report-chart-card">
          <div className="report-card-heading">
            <div>
              <h3>Ingresos diarios</h3>
              <p>Dinero recibido en cada día del mes.</p>
            </div>
            <span>En quetzales</span>
          </div>

          {pagosDelMes.length === 0 && ingresosVentasReporte === 0 ? (
            <p className="empty">No hay pagos registrados durante este mes.</p>
          ) : (
            <>
              <div className="report-daily-chart">
                {ventasDiarias.map(dia => (
                  <div className="report-daily-column" key={dia.dia}>
                    <div className="report-daily-bar-area">
                      <div
                        className={`report-daily-bar ${dia.ingresos === maximoDiario && dia.ingresos > 0 ? 'report-bar-highlight' : ''}`}
                        style={{
                          height: `${maximoDiario > 0 ? Math.max(dia.ingresos > 0 ? 4 : 0, (dia.ingresos / maximoDiario) * 100) : 0}%`
                        }}
                        title={`${dia.dia}: Q${dia.ingresos.toFixed(2)} · ${dia.cantidad} pagos · Ventas diarias Q${dia.ingresosVentas.toFixed(2)}`}
                      />
                    </div>
                    <span>{dia.dia % 5 === 0 || dia.dia === 1 || dia.dia === diasDelMes ? dia.dia : ''}</span>
                  </div>
                ))}
              </div>
              <div className="report-chart-legend">
                <span>Ingresos por día</span>
                <strong>Máximo: Q{maximoDiario.toFixed(2)}</strong>
              </div>
            </>
          )}
        </div>

        <div className="report-two-columns">
          <div className="content-card report-chart-card">
            <div className="report-card-heading">
              <div>
                <h3>Ventas por semana</h3>
                <p>Comparación de ingresos semanales.</p>
              </div>
            </div>

            {ventasSemanales.map(semana => (
              <div className="report-week-row" key={semana.semana}>
                <div className="report-week-info">
                  <strong>Semana {semana.semana}</strong>
                  <span>Días {semana.inicio} al {semana.fin}</span>
                </div>
                <div className="report-week-track">
                  <div
                    className="report-week-fill"
                    style={{
                      width: `${maximoSemanal > 0 ? (semana.ingresos / maximoSemanal) * 100 : 0}%`
                    }}
                  />
                </div>
                <strong>Q{semana.ingresos.toFixed(2)}</strong>
              </div>
            ))}
          </div>

          <div className="content-card report-chart-card">
            <div className="report-card-heading">
              <div>
                <h3>Métodos de pago</h3>
                <p>Distribución de los pagos recibidos.</p>
              </div>
            </div>

            {metodosPagoReporte.map(metodo => (
              <div className="report-method-row" key={metodo.nombre}>
                <div>
                  <strong>{metodo.nombre}</strong>
                  <span>{metodo.cantidad} pagos</span>
                </div>
                <strong>Q{metodo.ingresos.toFixed(2)}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="content-card report-highlights">
          <h3>Datos destacados del mes</h3>

          <div className="report-highlight-grid">
            <div>
              <span>DÍA CON MÁS INGRESOS</span>
              <strong>
                {diaMayorIngreso.ingresos > 0
                  ? `Día ${diaMayorIngreso.dia}`
                  : 'Sin registros'}
              </strong>
              <small>Q{diaMayorIngreso.ingresos.toFixed(2)} recibidos</small>
            </div>

            <div>
              <span>DÍA CON MÁS PAGOS</span>
              <strong>
                {diaMasPagos.cantidad > 0
                  ? `Día ${diaMasPagos.dia}`
                  : 'Sin registros'}
              </strong>
              <small>{diaMasPagos.cantidad} pagos registrados</small>
            </div>
          </div>

          <p className="report-disclaimer">
            Estos datos representan movimientos de pago, no asistencia.
            Para conocer qué día llegan más personas al gimnasio sería necesario
            registrar las entradas de los clientes.
          </p>
        </div>
      </>
    )}

    <div id="formulario-reporte-problema">
      <div className="section-actions report-problem-heading">
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
    </div>
  </>
)}

        {/* MEDICIONES */}
        {seccion === 'Ventas diarias' && (
          <>
            <div className="section-actions">
              <div>
                <h2>Registro de ventas y visitas</h2>
                <p>Registra las visitas y los productos vendidos cada día.</p>
              </div>
              <button type="button" className="primary-button" onClick={() => setMostrarNuevoProducto(!mostrarNuevoProducto)}>
                <Plus size={17} /> Agregar producto
              </button>
            </div>

            {mostrarNuevoProducto && (
              <div className="content-card form-card daily-product-form">
                <h3>Agregar nuevo producto</h3>
                <p>Define el nombre y el precio de venta. Luego aparecerá en el registro diario.</p>
                <form onSubmit={agregarProductoVenta}>
                  <div className="form-grid">
                    <label>Nombre del producto
                      <input value={nuevoProducto.nombre} onChange={e => setNuevoProducto(actual => ({ ...actual, nombre: e.target.value }))} placeholder="Ej. Barra de proteína" required />
                    </label>
                    <label>Precio de venta (Q)
                      <input type="number" min="0.01" step="0.01" value={nuevoProducto.precio} onChange={e => setNuevoProducto(actual => ({ ...actual, precio: e.target.value }))} placeholder="0.00" required />
                    </label>
                  </div>
                  <div className="form-buttons">
                    <button type="button" className="cancel-button" onClick={() => setMostrarNuevoProducto(false)}>Cancelar</button>
                    <button type="submit" className="primary-button"><Plus size={16} /> Guardar producto</button>
                  </div>
                </form>
              </div>
            )}

            <div className="content-card daily-sales-date-card">
              <label>Fecha del registro
                <SelectorFecha value={fechaVenta} onChange={setFechaVenta} />
              </label>
              <div className="daily-sales-total">
                <span>INGRESOS DEL DÍA</span>
                <strong>Q{ingresosVentasDia.toFixed(2)}</strong>
              </div>
            </div>

            <div className="content-card daily-sales-list-card">
              <div className="daily-sales-list-heading">
                <div className="daily-sales-heading-main">
                  <button
                    type="button"
                    className={`daily-sales-catalog-toggle ${modoEdicionCatalogo ? 'is-active' : ''}`}
                    onClick={() => setModoEdicionCatalogo(actual => !actual)}
                    aria-pressed={modoEdicionCatalogo}
                  >
                    <Pencil size={14} />
                    {modoEdicionCatalogo ? 'Terminar' : 'Editar'}
                  </button>
                  <div>
                    <h3>Detalle de ventas</h3>
                    <p>{modoEdicionCatalogo ? 'Selecciona un producto para cambiar su nombre, precio o eliminarlo.' : 'Ingresa la cantidad de visitas y productos vendidos.'}</p>
                  </div>
                </div>
                <span>IMPORTE</span>
              </div>

              <div className="daily-sales-list">
                {productosActivosVenta.map(producto => ({
                    key: producto.tipo === 'base' ? producto.clave : `producto-${producto.id}`,
                    productoId: producto.id,
                    clave: producto.clave,
                    nombre: producto.nombre,
                    detalle: producto.detalle || 'Producto adicional',
                    precio: Number(producto.precio || 0),
                    icono: producto.icono === 'Users' ? Users : Package,
                    tipo: producto.tipo === 'base' ? 'base' : 'producto'
                  }))
                  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
                  .map(item => {
                    const Icono = item.icono
                    const cantidadActual = item.tipo === 'base'
                      ? formularioVentas[item.clave]
                      : (formularioVentas.productos?.[item.productoId] ?? '0')
                    const cantidad = Number(cantidadActual || 0)
                    const actualizarCantidad = e => {
                      const valor = e.target.value
                      if (item.tipo === 'base') {
                        setFormularioVentas(actual => ({ ...actual, [item.key]: valor }))
                      } else {
                        setFormularioVentas(actual => ({
                          ...actual,
                          productos: { ...actual.productos, [item.productoId]: valor }
                        }))
                      }
                    }

                    return (
                      <div className={`daily-sales-row ${modoEdicionCatalogo ? "catalog-editing" : ""}`} key={item.key}>
                        <div className="daily-sales-row-product">
                          <span className="daily-sales-icon"><Icono size={19} /></span>
                          <div><strong>{item.nombre}</strong><small>{(item.detalle)} · Q{item.precio.toFixed(2)} c/u</small></div>
                        </div>
                        <label className="daily-sales-quantity">
                          <span>Cantidad</span>
                          <input type="number" min="0" step="1" inputMode="numeric" value={cantidadActual} onChange={actualizarCantidad} />
                        </label>
                        <strong className="daily-sales-row-total">Q{(cantidad * item.precio).toFixed(2)}</strong>
                        {modoEdicionCatalogo && (
                          <button
                            type="button"
                            className="daily-sales-edit-product"
                            onClick={() => abrirEdicionProductoVenta(productosVenta.find(producto => producto.id === item.productoId))}
                          >
                            <Pencil size={14} /> Editar
                          </button>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>

            <div className="content-card daily-sales-save-card">
              <div><h3>Total del registro</h3><p>Confirma para guardar las cantidades correspondientes a {formatearFecha(fechaVenta)}.</p></div>
              <div className="daily-sales-save-action">
                <strong>Q{ingresosVentasDia.toFixed(2)}</strong>
                <button type="button" className="primary-button" onClick={guardarVentasDia}><Save size={17} /> Guardar registro</button>
              </div>
              {avisoVentas && <p className="daily-sales-notice"><Check size={15} /> {avisoVentas}</p>}
            </div>

            <div className="content-card">
              <h3>Historial de registros</h3>
              <p>Resumen de las fechas que ya tienen ventas o visitas registradas.</p>
              {registrosVentas.length === 0 ? <p className="empty">Todavía no hay registros diarios.</p> : (
                <div className="table-container">
                  <table><thead><tr><th>FECHA</th><th>VISITAS</th><th>AGUA</th><th>PROTEÍNA</th><th>CREATINA</th><th>INGRESOS</th></tr></thead>
                    <tbody>{[...registrosVentas].sort((a, b) => b.fecha.localeCompare(a.fecha)).map(registro => {
                      const total = registro.precios
                        ? productosVenta.reduce((suma, producto) => {
                            const clave = producto.tipo === 'base' ? producto.clave : producto.id
                            const cantidad = producto.tipo === 'base'
                              ? Number(registro[producto.clave] || 0)
                              : Number(registro.productos?.[producto.id] || 0)
                            return suma + cantidad * Number(registro.precios[clave] ?? producto.precio ?? 0)
                          }, 0)
                        : Number(registro.visitas || 0) * 15 + Number(registro.agua || 0) * 8 + Number(registro.proteina || 0) * 13 + Number(registro.creatina || 0) * 5 + productosVenta.filter(producto => producto.tipo !== 'base').reduce((suma, producto) => suma + Number(registro.productos?.[producto.id] || 0) * Number(producto.precio || 0), 0)
                      return <tr key={registro.fecha}><td><strong>{formatearFecha(registro.fecha)}</strong></td><td>{registro.visitas || 0}</td><td>{registro.agua || 0}</td><td>{registro.proteina || 0}</td><td>{registro.creatina || 0}</td><td><strong>Q{total.toFixed(2)}</strong></td></tr>
                    })}</tbody>
                  </table>
                </div>
              )}
            </div>

            {productoEditando && (
              <div className="modal-overlay" onClick={() => setProductoEditando(null)}>
                <div className="confirmation-modal product-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-product-title" onClick={evento => evento.stopPropagation()}>
                  <button type="button" className="modal-close" aria-label="Cerrar" onClick={() => setProductoEditando(null)}><X size={18} /></button>
                  <span className="modal-icon"><Pencil size={24} /></span>
                  <h2 id="edit-product-title">Editar producto</h2>
                  <p className="modal-description">Modifica el nombre o el precio. Los cambios se aplicarán a los próximos registros.</p>
                  <form onSubmit={guardarEdicionProductoVenta}>
                    <div className="form-grid">
                      <label>Nombre del producto
                        <input value={formularioProductoEdicion.nombre} onChange={e => setFormularioProductoEdicion(actual => ({ ...actual, nombre: e.target.value }))} required />
                      </label>
                      <label>Precio de venta (Q)
                        <input type="number" min="0.01" step="0.01" value={formularioProductoEdicion.precio} onChange={e => setFormularioProductoEdicion(actual => ({ ...actual, precio: e.target.value }))} required />
                      </label>
                    </div>
                    <div className="modal-actions product-edit-actions">
                      <button type="button" className="modal-delete-button" onClick={() => { setProductoAEliminar(productoEditando); setProductoEditando(null) }}><Trash2 size={15} /> Eliminar</button>
                      <button type="button" className="modal-cancel-button" onClick={() => setProductoEditando(null)}>Cancelar</button>
                      <button type="submit" className="modal-primary-button"><Check size={15} /> Guardar cambios</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {productoAEliminar && (
              <div className="modal-overlay" onClick={() => setProductoAEliminar(null)}>
                <div className="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="delete-product-title" onClick={evento => evento.stopPropagation()}>
                  <button type="button" className="modal-close" aria-label="Cerrar" onClick={() => setProductoAEliminar(null)}><X size={18} /></button>
                  <span className="modal-icon modal-icon-danger"><Trash2 size={25} /></span>
                  <h2 id="delete-product-title">¿Eliminar este producto?</h2>
                  <p className="modal-description">Ya no aparecerá en los registros de ventas nuevos. Los registros anteriores conservarán sus importes.</p>
                  <div className="modal-client-info">
                    <span>PRODUCTO SELECCIONADO</span>
                    <strong>{(productoAEliminar.nombre)}</strong>
                    <small>Q{Number(productoAEliminar.precio || 0).toFixed(2)} por unidad</small>
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="modal-cancel-button" onClick={() => setProductoAEliminar(null)}>Cancelar</button>
                    <button type="button" className="modal-delete-button" onClick={confirmarEliminarProductoVenta}><Trash2 size={16} /> Sí, eliminar</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {seccion === 'Asistencia' && (
          <AsistenciaAdmin SelectorFecha={SelectorFecha} SelectorOpcion={SelectorOpcion} />
        )}

        {seccion === 'Instructores' && <GestionEmpleados />}

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
                  Fecha de pago
                  <SelectorFecha
                    value={formularioRenovacion.fechaPago}
                    fechaMaxima={obtenerFecha()}
                    onChange={fecha => setFormularioRenovacion(actual => ({
                      ...actual,
                      fechaPago: fecha,
                      promocion: ''
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
                  <strong>{formatearFecha(formularioRenovacion.fechaPago || obtenerFecha())}</strong>
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
              {aviso.tipo === 'confirmarRecordatorio' || aviso.tipo === 'reciboGenerado'
                ? <MessageCircle size={26} />
                : aviso.tipo === 'renovacionExitosa'
                  ? <Check size={27} />
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

            {aviso.tipo === 'renovacionExitosa' && (
              <>
                <h2 id="modal-title">{aviso.esNuevoCliente ? 'Cliente registrado' : 'Renovación registrada'}</h2>
                <p className="modal-description">
                  {aviso.esNuevoCliente
                    ? `${aviso.cliente.nombre} se registró correctamente.`
                    : `La renovación de ${aviso.cliente.nombre} se registró correctamente.`}
                </p>
                <div className="modal-client-info">
                  <span>RECIBO No. {formatearNumeroRecibo(aviso.registro.numeroRecibo)}</span>
                  <strong>{aviso.cliente.nombre}</strong>
                  <small>
                    Q{Number(aviso.registro.precio || 0).toFixed(2)} · Vigencia: {formatearFecha(aviso.registro.fechaInicio)} al {formatearFecha(aviso.registro.fechaFin)}
                  </small>
                </div>
                {errorRecibo && <p className="modal-description">{errorRecibo}</p>}
                <div className="modal-actions">
                  <button className="modal-cancel-button" onClick={cerrarAviso}>
                    Cerrar
                  </button>
                  <button
                    className="modal-primary-button"
                    onClick={generarReciboYEnviarWhatsApp}
                    disabled={generandoRecibo}
                  >
                    <MessageCircle size={16} />
                    {generandoRecibo ? 'Generando recibo...' : 'Generar recibo y enviar por WhatsApp'}
                  </button>
                </div>
              </>
            )}

            {aviso.tipo === 'reciboGenerado' && (
              <>
                <h2 id="modal-title">Recibo listo para enviar</h2>
                <p className="modal-description">
                  {aviso.compartido
                    ? `El recibo se envió al menú de compartir de tu teléfono. Confirma en WhatsApp que el mensaje llegó al chat de ${aviso.cliente.nombre}.`
                    : aviso.copiado
                    ? `Se abrió WhatsApp con el chat de ${aviso.cliente.nombre}. El recibo ya está copiado: presiona Ctrl + V dentro del chat para pegarlo y luego presiona Enviar.`
                    : `Se abrió WhatsApp con el chat de ${aviso.cliente.nombre}. No fue posible copiar el recibo, así que se descargó el archivo ${aviso.nombreArchivo}. Adjúntalo en el chat con el clip y presiona Enviar.`}
                </p>
                <div className="modal-client-info">
                  <span>RECIBO No. {formatearNumeroRecibo(aviso.registro.numeroRecibo)}</span>
                  <strong>{aviso.cliente.nombre}</strong>
                  <small>Q{Number(aviso.registro.precio || 0).toFixed(2)}</small>
                </div>
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
      email: identificadorACorreo(correo),
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

        <label>Correo electrónico o teléfono</label>
        <input
          type="text"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="Tu correo o número de teléfono"
          autoComplete="username"
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
  const [acceso, setAcceso] = useState(null)
  const [intentoAcceso, setIntentoAcceso] = useState(0)

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

  // Consulta el rol de la cuenta (administrador o empleado) en la tabla perfiles
  const idUsuario = sesion?.user?.id

  useEffect(() => {
    if (!idUsuario) {
      setAcceso(null)
      return
    }

    let activo = true
    setAcceso(null)

    async function cargarPerfil() {
      const { data, error } = await supabase
        .from('perfiles')
        .select('id, nombre_completo, rol, activo')
        .eq('id', idUsuario)
        .maybeSingle()

      if (!activo) return

      if (error) {
        console.error('Error verificando el perfil:', error)
        setAcceso({ idUsuario, estado: 'error', perfil: null })
        return
      }

      setAcceso({ idUsuario, estado: 'listo', perfil: data || null })
    }

    cargarPerfil()

    return () => {
      activo = false
    }
  }, [idUsuario, intentoAcceso])

  if (verificando) {
    return (
      <div className="auth-loading">
        Verificando acceso...
      </div>
    )
  }

  if (!sesion) return <PantallaLogin />

  if (!acceso || acceso.idUsuario !== sesion.user.id) {
    return (
      <div className="auth-loading">
        Verificando acceso...
      </div>
    )
  }

  if (acceso.estado === 'error') {
    return (
      <PantallaAcceso
        titulo="No se pudo verificar tu acceso"
        mensaje="Revisa tu conexión a internet e inténtalo de nuevo."
        onReintentar={() => setIntentoAcceso(numero => numero + 1)}
      />
    )
  }

  const perfil = acceso.perfil

  if (!perfil || !perfil.activo) {
    return (
      <PantallaAcceso
        titulo="Cuenta sin acceso"
        mensaje="Tu cuenta no tiene acceso al sistema. Comunícate con el administrador."
      />
    )
  }

  if (perfil.rol === 'admin') {
    return <Aplicacion user={sesion.user} />
  }

  if (perfil.rol === 'empleado') {
    return <PanelInstructores user={sesion.user} perfil={perfil} />
  }

  return (
    <PantallaAcceso
      titulo="Cuenta sin acceso"
      mensaje="Tu cuenta no tiene un rol válido. Comunícate con el administrador."
    />
  )
}

export default App