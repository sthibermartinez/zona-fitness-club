// Los instructores inician sesión con su número de teléfono (8 dígitos).
// Por dentro, Supabase guarda ese número como un correo interno que nadie ve.
// IMPORTANTE: este dominio debe ser EXACTAMENTE el mismo que usa la función
// "gestionar-empleados" (constante DOMINIO_TELEFONO en ese archivo).
export const DOMINIO_TELEFONO = 'instructores.zonafitness.app'

export function telefonoACorreo(telefono) {
  return `502${telefono}@${DOMINIO_TELEFONO}`
}

// Si el texto es un número de 8 dígitos lo convierte al correo interno.
// Si no, se trata como un correo normal (por ejemplo, el del administrador).
export function identificadorACorreo(texto) {
  const limpio = String(texto || '').trim()
  const soloDigitos = limpio.replace(/[\s-]/g, '')

  if (/^[0-9]{8}$/.test(soloDigitos)) {
    return telefonoACorreo(soloDigitos)
  }

  return limpio
}
