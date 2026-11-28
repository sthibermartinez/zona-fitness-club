import { useEffect, useRef, useState } from 'react'
import { calcularMediciones, kgPorLibra, nivelesActividad, objetivosCalorias } from './calcularMediciones'

export function dibujarFichaMedicion(lienzo, ficha, medidas) {
  const { datos, nombre, fecha } = ficha
  const r = calcularMediciones(datos)
  const objetivo = objetivosCalorias.find(item => item.id === datos.objetivo)?.etiqueta
  const nivel = nivelesActividad.find(item => item.id === datos.nivelActividad)?.etiqueta
  const valor = (n, unidad, decimales = 0) => Number.isFinite(n) && n > 0 ? `${n.toFixed(decimales)} ${unidad}` : '—'
  const titulos = [
    ['IMC', valor(r.imc, 'kg/m²', 1)],
    ['Grasa corporal estimada', valor(r.grasa, '%', 1)],
    ['Gasto en reposo', valor(r.reposo, 'kcal/día')],
    ['Mantenimiento estimado', valor(r.mantenimiento, 'kcal/día')]
  ]
  const contornos = datos.cinturaJuvenil
    ? [...medidas, ['cinturaJuvenil', 'Cintura sobre la cadera']] : medidas
  const filas = Math.ceil(contornos.length / 2)
  const objetivosY = 810 + filas * 84
  const alto = objetivosY + 258
  lienzo.width = 1000
  lienzo.height = alto
  const ctx = lienzo.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar la imagen.')
  const amarillo = '#f5c400'
  const blanco = '#fafafa'
  const gris = '#c8c8c8'

  function texto(contenido, x, y, tamano, color = blanco, peso = 500, maximo = 888) {
    do {
      ctx.font = `${peso} ${tamano}px Montserrat, Arial, sans-serif`
      tamano -= 1
    } while (ctx.measureText(contenido).width > maximo && tamano >= 16)
    ctx.fillStyle = color
    ctx.fillText(contenido, x, y, maximo)
  }

  function fondo(x, y, ancho, altura, color) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(x, y, ancho, altura, 18)
    ctx.fill()
  }

  ctx.fillStyle = '#101010'
  ctx.fillRect(0, 0, 1000, alto)
  ctx.fillStyle = amarillo
  ctx.fillRect(0, 0, 1000, 12)
  texto('ZONA FITNESS CLUB', 56, 88, 32, amarillo, 800)
  texto('Resultados de medición', 56, 166, 58, blanco, 800)
  texto(nombre, 56, 258, 46, blanco, 700)
  const fechaLarga = new Intl.DateTimeFormat('es-GT', { dateStyle: 'long', timeZone: 'UTC' })
    .format(new Date(`${fecha}T12:00:00Z`))
  texto(fechaLarga, 56, 310, 27, gris)
  texto(`Edad ${datos.edad || '—'} · Peso ${valor(r.peso, 'kg', 2)} / ${valor(r.peso / kgPorLibra, 'lb', 2)}`, 56, 359, 26, gris)
  texto(`Estatura ${datos.estatura || '—'} ${datos.unidadEstatura || 'cm'} · Sexo ${datos.sexo || '—'}`, 56, 401, 26, gris)

  titulos.forEach(([titulo, dato], i) => {
    const x = 56 + (i % 2) * 456
    const y = 447 + Math.floor(i / 2) * 136
    fondo(x, y, 432, 110, '#222222')
    texto(titulo, x + 20, y + 36, 24, amarillo, 700, 390)
    texto(dato, x + 20, y + 85, 38, blanco, 800, 390)
  })

  texto('Circunferencias en centímetros', 56, 764, 35, blanco, 750)
  contornos.forEach(([id, etiqueta], i) => {
    const x = 56 + (i % 2) * 456
    const y = 792 + Math.floor(i / 2) * 84
    fondo(x, y, 432, 64, '#222222')
    texto(etiqueta, x + 15, y + 41, 24, gris, 600, 285)
    texto(valor(Number(datos[id]), 'cm', 1), x + 307, y + 41, 24, blanco, 700, 110)
  })

  fondo(56, objetivosY, 888, 143, '#222222')
  texto(`Objetivo  ${objetivo || '—'}`, 76, objetivosY + 40, 27, amarillo, 700)
  texto(`Actividad  ${nivel || '—'}`, 76, objetivosY + 79, 24, gris)
  texto(`Meta diaria  ${valor(r.meta ?? r.deficit, 'kcal/día')}`, 76, objetivosY + 118, 28, blanco, 750)
  texto('Resultados estimados · Donde empieza tu cambio.', 56, alto - 51, 23, gris)
}

export default function FichaMedicion({ ficha, medidas, cerrar }) {
  const [archivo, setArchivo] = useState(null)
  const [error, setError] = useState('')
  const [vista, setVista] = useState('')
  const panel = useRef(null)

  useEffect(() => { panel.current?.scrollIntoView({ block: 'start' }) }, [])
  useEffect(() => {
    let activa = true
    let url
    async function preparar() {
      try {
        await document.fonts?.ready
        if (!activa) return
        const lienzo = document.createElement('canvas')
        dibujarFichaMedicion(lienzo, ficha, medidas)
        lienzo.toBlob(blob => {
          if (!activa) return
          if (!blob) { setError('No se pudo generar la imagen. Vuelve a abrir la ficha.'); return }
          url = URL.createObjectURL(blob)
          setArchivo(new File([blob], `Medicion-${ficha.fecha}.png`, { type: 'image/png' }))
          setVista(url)
        }, 'image/png')
      } catch {
        if (activa) setError('No se pudo generar la imagen. Vuelve a abrir la ficha.')
      }
    }
    preparar()
    return () => { activa = false; if (url) URL.revokeObjectURL(url) }
  }, [ficha, medidas])

  const admiteCompartir = archivo && navigator.canShare?.({ files: [archivo] })
  const telefono = String(ficha.telefono || '').replace(/\D/g, '')
  const destino = /^\d{8}$/.test(telefono) ? `502${telefono}` : ''
  const mensaje = `Hola, ${ficha.nombre}. Te compartimos tu ficha de medición de Zona Fitness Club.`
  const whatsapp = `https://wa.me/${destino}?text=${encodeURIComponent(mensaje)}`

  async function compartir() {
    try {
      await navigator.share({ files: [archivo], text: mensaje })
    } catch (fallo) {
      if (fallo.name !== 'AbortError') setError('Puedes descargar la ficha y adjuntarla en WhatsApp.')
    }
  }

  return <section ref={panel} className="content-card mediciones-envio" aria-label="Confirmar envío de resultados">
    <h3>Confirmar envío de resultados</h3>
    <p>Revisa la ficha de <strong>{ficha.nombre}</strong> antes de compartirla.</p>
    {vista ? <img className="mediciones-vista-ficha" src={vista} alt={`Resultados de medición de ${ficha.nombre}`} />
      : !error && <p role="status">Preparando la ficha…</p>}
    {error && <p role="alert">{error}</p>}
    <div className="form-buttons mediciones-acciones-ficha">
      <button type="button" className="cancel-button" onClick={cerrar}>Enviar después</button>
      {vista && <a className="cancel-button" href={vista} download={archivo.name}>Descargar ficha</a>}
      {admiteCompartir ? <button type="button" className="primary-button" onClick={compartir}>
        Compartir ficha por WhatsApp
      </button> : vista && <a className="primary-button" href={whatsapp} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>}
    </div>
    {vista && <small>{admiteCompartir ? 'Elige WhatsApp y confirma el destinatario.' : 'Descarga la ficha y adjúntala en el chat antes de enviar.'}</small>}
  </section>
}
