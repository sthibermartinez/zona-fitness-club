import { useEffect, useRef, useState } from 'react'
import { Folder, Plus, Ruler, Save } from 'lucide-react'
import { supabase } from './supabase'
import { calcularMediciones, kgPorLibra, nivelesActividad, objetivosCalorias } from './calcularMediciones'
import './Mediciones.css'

const circunferencias = [
  ['cuello', 'Cuello'], ['hombros', 'Hombros (contorno completo)'],
  ['brazo', 'Brazo (bíceps)'], ['cintura', 'Cintura'],
  ['cadera', 'Cadera'], ['pierna', 'Pierna (muslo)'],
  ['pantorrilla', 'Pantorrilla'], ['pecho', 'Pecho']
]
const guia = {
  cuello: 'Mira al frente. Coloca la cinta justo debajo de la nuez, sin apretar.',
  hombros: 'Con los brazos sueltos, rodea la parte más ancha de ambos hombros, pasando por delante y por la espalda sin levantar los hombros.',
  brazo: 'Marca el punto medio entre el hombro y el codo. Deja el brazo derecho colgando, con el bíceps relajado, y rodea ese punto.',
  cintura: 'Para la fórmula de grasa en adultos, mide al nivel del ombligo en hombres y en la parte más estrecha de la cintura en mujeres. Lee al terminar una exhalación normal.',
  cadera: 'Junta los pies y rodea la parte más ancha de los glúteos. Revisa que la cinta quede horizontal.',
  pierna: 'Usa el muslo derecho. Marca el punto medio entre el pliegue de la ingle y la parte superior de la rótula. Mide con la pierna relajada.',
  pantorrilla: 'De pie y con el peso repartido, desliza la cinta hasta encontrar la parte más ancha de la pantorrilla derecha.',
  pecho: 'Rodea el pecho a la altura media. Baja los brazos y lee al terminar una exhalación normal, con la cinta a la misma altura por delante y por la espalda.'
}
const inicial = { unidad: 'kg', unidadEstatura: 'cm', sexo: '' }
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const mostrar = (valor, unidad, cifras = 1) => valor === null ? '—' : `${valor.toFixed(cifras)} ${unidad}`
const estados = 'id,fecha,datos'

async function leerMediciones(consulta) {
  const filas = []
  for (let inicio = 0; ; inicio += 200) {
    const { data, error } = await consulta().range(inicio, inicio + 199)
    if (error) throw error
    filas.push(...data)
    if (data.length < 200) return filas
  }
}

const formatoMes = new Intl.DateTimeFormat('es-GT', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const tituloMedicion = fecha => `Medición de ${formatoMes.format(new Date(`${fecha}T12:00:00Z`))}`

const mostrarAjuste = ajuste => ajuste === null ? '—' : `${ajuste > 0 ? '+' : ''}${ajuste} kcal/día`

function SelectorMedicion({ SelectorOpcion, etiqueta, opciones, valor, alCambiar }) {
  return <div className="mediciones-selector">
    <span>{etiqueta}</span>
    <SelectorOpcion value={opciones.find(opcion => opcion.id === valor)?.etiqueta || ''}
      placeholder="Seleccionar" options={opciones.map(opcion => opcion.etiqueta)}
      onChange={nombre => alCambiar(opciones.find(opcion => opcion.etiqueta === nombre).id)} />
  </div>
}

export default function Mediciones({ clientes, SelectorOpcion, SelectorFecha }) {
  const [nueva, setNueva] = useState(false)
  const [persona, setPersona] = useState({ nombre: '', telefono: '' })
  const carpetaNueva = useRef(null)
  const [clienteId, setClienteId] = useState('')
  const [datos, setDatos] = useState(inicial)
  const [fecha, setFecha] = useState(hoy)
  const [carpetas, setCarpetas] = useState([])
  const [errorCarpetas, setErrorCarpetas] = useState('')
  const [historial, setHistorial] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [errorHistorial, setErrorHistorial] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [detalle, setDetalle] = useState(null)
  const enCurso = useRef(false)
  const intento = useRef(null)
  const perfiles = carpetas.map(fila => {
    const anterior = clientes.find(item => String(item.id) === fila.cliente_id)
    return {
      id: fila.cliente_id,
      nombre: fila.nombre_persona || anterior?.nombre || 'Persona sin nombre guardado',
      telefono: fila.telefono_persona || anterior?.telefono || '',
      datosGuardados: Boolean(fila.nombre_persona)
    }
  })
  const cliente = perfiles.find(item => item.id === clienteId)
  const mostrarFicha = nueva || Boolean(cliente)
  const fichaJuvenil = Number(datos.edad) >= 10 && Number(datos.edad) < 20
  const resultado = calcularMediciones(datos)
  const nivelElegido = nivelesActividad.find(nivel => nivel.id === datos.nivelActividad)
  const detalleResultados = detalle ? calcularMediciones(detalle.datos) : null
  const actualizar = (campo, valor) => setDatos(actual => ({ ...actual, [campo]: valor }))

  useEffect(() => {
    let vigente = true
    leerMediciones(() => supabase.from('mediciones_corporales')
      .select('cliente_id,nombre_persona,telefono_persona').order('creado_en', { ascending: false }).order('id'))
      .then(filas => {
        if (!vigente) return
        setCarpetas(actual => {
          const porId = new Map()
          for (const fila of [...actual, ...filas]) {
            const anterior = porId.get(fila.cliente_id)
            if (!anterior || (!anterior.nombre_persona && fila.nombre_persona)) porId.set(fila.cliente_id, fila)
          }
          return [...porId.values()]
        })
      })
      .catch(() => { if (vigente) setErrorCarpetas('No se pudieron consultar las carpetas guardadas.') })
    return () => { vigente = false }
  }, [])

  useEffect(() => {
    if (!clienteId) return
    let vigente = true
    leerMediciones(() => supabase.from('mediciones_corporales').select(estados)
      .eq('cliente_id', clienteId).order('fecha', { ascending: false }).order('creado_en', { ascending: false }).order('id'))
      .then(filas => {
        if (!vigente) return
        setHistorial(actual => [...actual, ...filas.filter(fila => !actual.some(item => item.id === fila.id))]
          .sort((a, b) => b.fecha.localeCompare(a.fecha)))
      })
      .catch(() => { if (vigente) setErrorHistorial('No se pudo consultar el historial de mediciones.') })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [clienteId])

  function elegir(id, iniciarNueva = false) {
    intento.current = null
    setClienteId(id)
    setNueva(iniciarNueva)
    setPersona({ nombre: '', telefono: '' })
    carpetaNueva.current = iniciarNueva ? crypto.randomUUID() : null
    setHistorial([])
    setDetalle(null)
    setDatos(inicial)
    setFecha(hoy())
    setMensaje('')
    setError('')
    setErrorHistorial('')
    setCargando(Boolean(id))
  }

  async function guardar(evento) {
    evento.preventDefault()
    if (!mostrarFicha || enCurso.current) return
    const nombre = persona.nombre.trim().replace(/\s+/g, ' ')
    if (nueva && (!/^[\p{L}][\p{L} .’'-]* [\p{L}][\p{L}.’'-]* [\p{L}][\p{L}.’'-]*$/u.test(nombre) || !/^\d{8}$/.test(persona.telefono))) {
      setError('Escribe un nombre y dos apellidos, y un teléfono de 8 dígitos.')
      return
    }
    enCurso.current = true
    setGuardando(true)
    setError('')
    setMensaje('')
    try {
      const carpeta = {
        cliente_id: nueva ? carpetaNueva.current : clienteId,
        nombre_persona: nueva ? nombre : cliente.datosGuardados ? cliente.nombre : null,
        telefono_persona: nueva ? persona.telefono : cliente.datosGuardados ? cliente.telefono : null
      }
      const contenido = JSON.stringify({ ...carpeta, fecha, datos })
      if (intento.current?.contenido !== contenido) intento.current = { contenido, id: crypto.randomUUID() }
      const id = intento.current.id
      let { data, error } = await supabase.from('mediciones_corporales')
        .insert({ id, ...JSON.parse(contenido) }).select(estados).single()
      if (error?.code === '23505') {
        ({ data, error } = await supabase.from('mediciones_corporales').select(estados).eq('id', id).single())
      }
      if (error) throw error
      intento.current = null
      setHistorial(actual => [data, ...actual.filter(item => item.id !== data.id)].sort((a, b) => b.fecha.localeCompare(a.fecha)))
      setCarpetas(actual => actual.some(item => item.cliente_id === carpeta.cliente_id) ? actual : [carpeta, ...actual])
      if (nueva) {
        setCargando(true)
        setClienteId(carpeta.cliente_id)
        setNueva(false)
      }
      setMensaje('Medición guardada en la carpeta del cliente.')
    } catch {
      setError('No se pudo confirmar el guardado. Puedes reintentar con los mismos datos.')
    } finally {
      enCurso.current = false
      setGuardando(false)
    }
  }

  function campo(id, etiqueta, limites = {}) {
    return <label key={id}>{etiqueta}
      <input type="number" inputMode="decimal" min="0.01" step="0.01" value={datos[id] ?? ''}
        {...limites} onChange={evento => actualizar(id, evento.target.value)} />
    </label>
  }

  return <div className="mediciones-pagina">
    <div className="section-actions"><div><h2><Ruler size={20} /> Mediciones corporales</h2>
      <p>Registra mediciones de miembros y visitantes.</p></div>
      {!mostrarFicha && <button type="button" className="primary-button" onClick={() => elegir('', true)}>
        <Plus size={16} /> Agregar medición
      </button>}
    </div>
    {mostrarFicha && <div className="content-card section-actions">
      <strong>{nueva ? 'Medición nueva' : cliente.nombre}</strong>
      <button type="button" className="cancel-button" disabled={guardando} onClick={() => elegir('')}>Volver a carpetas</button>
    </div>}

    {!mostrarFicha && <div className="content-card">
      <h3>Carpetas de mediciones</h3>
      {errorCarpetas && <p role="alert">{errorCarpetas}</p>}
      <ul className="form-grid">
        {perfiles
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-GT')).map(item => (
            <li key={item.id} style={{ listStyle: 'none' }}>
              <button type="button" className="cancel-button" onClick={() => elegir(String(item.id))}>
                <Folder size={16} aria-hidden="true" /> {item.nombre}{item.telefono ? ` · ${item.telefono}` : ''}
              </button>
            </li>
          ))}
      </ul>
    </div>}

    {mostrarFicha && <>
      <div className="content-card form-card">
        <form className="mediciones-formulario" onSubmit={guardar}>
          {nueva && <section className="mediciones-bloque">
            <h3>Datos de la persona</h3>
            <div className="form-grid">
              <label>Nombre y dos apellidos
                <input required maxLength={100} autoCapitalize="words" value={persona.nombre} disabled={guardando}
                  onChange={e => setPersona(actual => ({ ...actual, nombre: e.target.value.replace(/(^|\s)(\p{L})/gu,
                    (_, espacio, inicial) => espacio + inicial.toLocaleUpperCase('es-GT')) }))} />
              </label>
              <label>Teléfono
                <input type="tel" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} required value={persona.telefono} disabled={guardando}
                  onChange={e => setPersona(actual => ({ ...actual, telefono: e.target.value }))} />
              </label>
            </div>
          </section>}
          <section className="mediciones-bloque">
          <h3>Datos de la medición</h3>
          <div className="form-grid">
            <div className="mediciones-selector"><span>Fecha de medición</span><SelectorFecha value={fecha} onChange={setFecha} fechaMaxima={hoy()} /></div>
            {campo('edad', 'Edad (años)', { min: 10, max: 120, step: 1, required: true })}
            <label>Sexo para el cálculo
              <SelectorOpcion value={datos.sexo === 'masculino' ? 'Masculino' : datos.sexo === 'femenino' ? 'Femenino' : ''}
                placeholder="Seleccionar" options={['Masculino', 'Femenino']} onChange={valor => actualizar('sexo', valor.toLowerCase())} />
            </label>
            {campo('peso', `Peso (${datos.unidad})`, { required: true })}
            <label>Unidad de peso
              <SelectorOpcion value={datos.unidad} options={['kg', 'lb']} onChange={unidad => setDatos(actual => ({
                ...actual, unidad, peso: unidad === actual.unidad || !actual.peso ? actual.peso : (Number(actual.peso) * (unidad === 'kg' ? kgPorLibra : 1 / kgPorLibra)).toFixed(2)
              }))} />
            </label>
            {resultado.peso > 0 && <p>{mostrar(resultado.peso, 'kg', 2)} · {mostrar(resultado.peso / kgPorLibra, 'lb', 2)}</p>}
            {campo('estatura', `Estatura (${datos.unidadEstatura})`, { required: true, step: datos.unidadEstatura === 'm' ? '0.0001' : '0.01' })}
            <label>Unidad de estatura
              <SelectorOpcion value={datos.unidadEstatura} options={['cm', 'm']} onChange={unidadEstatura => setDatos(actual => ({
                ...actual, unidadEstatura, estatura: unidadEstatura === actual.unidadEstatura || !actual.estatura ? actual.estatura : (Number(actual.estatura) * (unidadEstatura === 'cm' ? 100 : 0.01)).toFixed(unidadEstatura === 'cm' ? 2 : 4)
              }))} />
            </label>
          </div>

          </section>
          <section className="mediciones-bloque">
            <h3>Circunferencias en centímetros</h3>
            <details className="mediciones-guia">
              <summary>Cómo tomar las medidas</summary>
              <p>Usa una cinta flexible que no se estire. Mide con el cuerpo relajado, sin flexionar el músculo, sin meter el abdomen y sin apretar la piel. Evita prendas gruesas.</p>
              <dl>{circunferencias.map(([id, etiqueta]) => <div key={id}>
                <dt>{etiqueta}</dt><dd>{guia[id]}</dd>
              </div>)}</dl>
              <p>Para comparar avances, mide siempre el mismo lado, en el mismo punto y con la misma postura. Repite la medición si la cinta se movió.</p>
            </details>
            <div className="form-grid">
              {circunferencias.map(([id, etiqueta]) => campo(id, etiqueta))}
              {fichaJuvenil && campo('cinturaJuvenil', 'Cintura sobre el hueso de la cadera (cm)')}
            </div>
            {fichaJuvenil && <p>Para la grasa corporal juvenil, rodea la cintura con la cinta horizontal justo encima del borde superior del hueso derecho de la cadera. Lee al terminar una exhalación normal, sin apretar.</p>}
          </section>

          <section className="mediciones-bloque">
            <h3>Calorías y recomposición</h3>
            {Number(datos.edad) >= 10 && Number(datos.edad) < 20 ? (
              <p>La ficha juvenil muestra el gasto en reposo. Las metas de calorías requieren una valoración que tome en cuenta el crecimiento.</p>
            ) : <>
            <div className="form-grid">
              <SelectorMedicion SelectorOpcion={SelectorOpcion} etiqueta="Objetivo" opciones={objetivosCalorias}
                valor={datos.objetivo} alCambiar={valor => actualizar('objetivo', valor)} />
              <SelectorMedicion SelectorOpcion={SelectorOpcion} etiqueta="Nivel de actividad" opciones={nivelesActividad}
                valor={datos.nivelActividad} alCambiar={valor => actualizar('nivelActividad', valor)} />
            </div>
            {nivelElegido && <p>{nivelElegido.ayuda}</p>}
            <label className="mediciones-casilla">
              <input type="checkbox" checked={Boolean(datos.soloMedidas)} onChange={e => actualizar('soloMedidas', e.target.checked)} />
              Omitir calorías por embarazo, lactancia o indicación profesional
            </label>
            </>}
          </section>

          <section className="mediciones-bloque">
            <h3>Resultados estimados</h3>
            <div className="report-kpi-grid mediciones-resultados">
              {[
                ['IMC', resultado.imc, 'kg/m²', 1],
                ['Grasa corporal', resultado.grasa, '%', 1],
                ['Gasto en reposo', resultado.reposo, 'kcal/día', 0],
                ['Mantenimiento', resultado.mantenimiento, 'kcal/día', 0],
                ['Meta de calorías', resultado.meta, 'kcal/día', 0]
              ].map(([etiqueta, valor, unidad, cifras]) => <div className="report-kpi" key={etiqueta}>
                <span>{etiqueta}</span><h3>{mostrar(valor, unidad, cifras)}</h3>
                {etiqueta === 'Meta de calorías' && resultado.ajuste !== null &&
                  <small>Ajuste sobre mantenimiento · {mostrarAjuste(resultado.ajuste)}</small>}
              </div>)}
            </div>
            {resultado.aviso && <p role="status">{resultado.aviso}</p>}
            {Number(datos.edad) >= 10 && Number(datos.edad) < 20 && (
              <p>El IMC juvenil se interpreta por edad y sexo. Para estimar la grasa, completa la estatura, el sexo y la medida de cintura sobre el hueso de la cadera.</p>
            )}
          </section>
          <div className="form-buttons"><button type="submit" className="primary-button" disabled={guardando}>
            <Save size={16} /> {guardando ? 'Guardando…' : 'Guardar medición'}
          </button></div>
          {mensaje && <p role="status">{mensaje}</p>}
          {error && <p role="alert">{error}</p>}
        </form>
      </div>
      {cliente && <div className="content-card">
        <h3>Carpeta de {cliente.nombre}</h3>
        {errorHistorial && <p role="alert">{errorHistorial}</p>}
        {cargando && <p role="status">Cargando mediciones…</p>}
        {!cargando && !errorHistorial && historial.length === 0 && <p>Este cliente todavía no tiene mediciones.</p>}
        {historial.length > 0 && <div className="table-container"><table>
          <thead><tr><th>Fecha</th><th>Peso</th><th>IMC</th><th>Grasa estimada</th><th>Acción</th></tr></thead>
          <tbody>{historial.map(fila => {
            const calculo = calcularMediciones(fila.datos)
            return <tr key={fila.id}><td><strong>{tituloMedicion(fila.fecha)}</strong><br />{fila.fecha.split('-').reverse().join('/')}</td>
              <td>{mostrar(calculo.peso, 'kg', 2)}</td><td>{mostrar(calculo.imc, 'kg/m²')}</td>
              <td>{mostrar(calculo.grasa, '%')}</td>
              <td><button type="button" className="cancel-button" aria-expanded={detalle?.id === fila.id}
                onClick={() => setDetalle(detalle?.id === fila.id ? null : fila)}>Ver medidas</button></td></tr>
          })}</tbody>
        </table></div>}
        {detalle && <div className="form-grid">
          <p>Medición del {detalle.fecha.split('-').reverse().join('/')}</p>
          <p>Edad {detalle.datos.edad} años · {detalle.datos.sexo || 'Sexo sin seleccionar'}</p>
          <p>Estatura {detalle.datos.estatura} {detalle.datos.unidadEstatura}</p>
          {circunferencias.map(([id, etiqueta]) => <p key={id}>{etiqueta} · {detalle.datos[id] ? `${detalle.datos[id]} cm` : '—'}</p>)}
          {detalle.datos.cinturaJuvenil && <p>Cintura sobre el hueso de la cadera · {detalle.datos.cinturaJuvenil} cm</p>}
          <p>Gasto en reposo · {mostrar(detalleResultados.reposo, 'kcal/día', 0)}</p>
          <p>Mantenimiento · {mostrar(detalleResultados.mantenimiento, 'kcal/día', 0)}</p>
          {detalle.datos.objetivo ? <>
            <p>Objetivo · {objetivosCalorias.find(opcion => opcion.id === detalle.datos.objetivo)?.etiqueta}</p>
            <p>Actividad · {nivelesActividad.find(nivel => nivel.id === detalle.datos.nivelActividad)?.etiqueta || '—'}</p>
            <p>Meta · {mostrar(detalleResultados.meta, 'kcal/día', 0)} · {mostrarAjuste(detalleResultados.ajuste)}</p>
          </> : <p>Con déficit · {mostrar(detalleResultados.deficit, 'kcal/día', 0)}</p>}
        </div>}
      </div>}
    </>}
  </div>
}
