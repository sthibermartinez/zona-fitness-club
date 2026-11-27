export const kgPorLibra = 0.45359237

export const nivelesActividad = [
  { id: 'sedentaria', etiqueta: 'Sedentaria', factor: 1.4, ayuda: 'La mayor parte del día sentado, con poco movimiento.' },
  { id: 'ligera', etiqueta: 'Ligera', factor: 1.6, ayuda: 'Día principalmente sentado, con caminatas o ejercicio ligero.' },
  { id: 'moderada', etiqueta: 'Moderada', factor: 1.75, ayuda: 'Movimiento frecuente o entrenamiento regular.' },
  { id: 'alta', etiqueta: 'Alta', factor: 2, ayuda: 'Trabajo físicamente activo o entrenamiento exigente y frecuente.' },
  { id: 'muy-alta', etiqueta: 'Muy alta', factor: 2.2, ayuda: 'Trabajo físico intenso o entrenamiento de alto volumen.' }
]

export const objetivosCalorias = [
  { id: 'deficit', etiqueta: 'Déficit · perder grasa' },
  { id: 'recomposicion', etiqueta: 'Recomposición corporal' },
  { id: 'mantenimiento', etiqueta: 'Mantenimiento' },
  { id: 'volumen', etiqueta: 'Volumen · bulk' }
]

export function calcularMediciones(datos) {
  const peso = Number(datos.peso) * (datos.unidad === 'lb' ? kgPorLibra : 1)
  const altura = Number(datos.estatura) * (datos.unidadEstatura === 'm' ? 100 : 1)
  const edad = Number(datos.edad)
  const sexo = datos.sexo
  const edadValida = Number.isInteger(edad) && edad >= 10
  const adulto = edadValida && edad >= 20
  const masculino = sexo === 'masculino'
  const sexoValido = masculino || sexo === 'femenino'
  const valido = valor => Number.isFinite(valor) && valor > 0
  const imc = edadValida && valido(peso) && valido(altura) ? peso / (altura / 100) ** 2 : null
  let reposo = null
  if (sexoValido && edadValida && valido(peso)) {
    if (edad <= 18) reposo = masculino ? 17.686 * peso + 658.2 : 13.384 * peso + 692.6
    else if (imc) reposo = 10 * peso + 6.25 * altura - 5 * edad + (masculino ? 5 : -161)
  }

  const cuello = Number(datos.cuello)
  const cintura = Number(datos.cintura)
  const cadera = Number(datos.cadera)
  const diferencia = cintura + (masculino ? 0 : cadera) - cuello
  let grasa = null
  if (adulto && sexoValido && valido(altura) && valido(cuello) && valido(cintura)
      && (masculino || valido(cadera)) && diferencia > 0) {
    const logCircunferencia = Math.log10(diferencia / 2.54)
    const logAltura = Math.log10(altura / 2.54)
    const estimado = masculino
      ? 86.010 * logCircunferencia - 70.041 * logAltura + 36.77
      : 163.205 * logCircunferencia - 97.684 * logAltura - 78.387
    if (estimado > 0 && estimado < 100) grasa = estimado
  }

  const cinturaJuvenil = Number(datos.cinturaJuvenil)
  if (edadValida && !adulto && sexoValido && valido(altura) && valido(cinturaJuvenil)) {
    const proporcion = altura / cinturaJuvenil
    const sexoRfm = masculino ? 0 : 1
    const estimado = edad <= 14 ? 74 - 22 * proporcion + 5 * sexoRfm : 64 - 20 * proporcion + 12 * sexoRfm
    if (estimado > 0 && estimado < 100) grasa = estimado
  }

  const actividad = nivelesActividad.find(nivel => nivel.id === datos.nivelActividad)?.factor ?? Number(datos.actividad)
  const mantenimiento = adulto && !datos.soloMedidas && valido(reposo) && actividad >= 1.4 && actividad <= 2.5 ? reposo * actividad : null
  const ajusteAnterior = Number(datos.deficit)
  const deficit = !datos.objetivo && mantenimiento && ajusteAnterior > 0 && mantenimiento - ajusteAnterior >= 1000
    ? mantenimiento - ajusteAnterior : null

  let meta = null
  let ajuste = null
  let aviso = ''
  if (mantenimiento !== null && datos.objetivo) {
    const base = Math.round(mantenimiento)
    switch (datos.objetivo) {
      case 'deficit': {
        const reduccion = Math.round(Math.min(base * 0.10, 500))
        if (imc < 18.5 || base - reduccion < (masculino ? 1500 : 1200)) {
          aviso = 'Con estos datos, el déficit requiere una valoración nutricional.'
        } else {
          ajuste = -reduccion
        }
        break
      }
      case 'volumen':
        ajuste = Math.round(Math.min(base * 0.05, 300))
        break
      case 'recomposicion':
      case 'mantenimiento':
        ajuste = 0
        break
    }
    if (ajuste !== null) meta = base + ajuste
  }

  return { peso, imc, grasa, reposo: valido(reposo) && !datos.soloMedidas ? reposo : null, mantenimiento, deficit, meta, ajuste, aviso }
}
