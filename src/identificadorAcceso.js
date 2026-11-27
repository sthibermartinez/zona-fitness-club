// La función gestionar-empleados usa el mismo dominio y el mismo prefijo.
export const DOMINIO_TELEFONO = 'instructores.zonafitness.app'

export function telefonoACorreo(telefono) {
  return `502${telefono}@${DOMINIO_TELEFONO}`
}

export function usuarioACorreo(texto) {
  const usuario = String(texto ?? '').trim().toLowerCase()
  if (usuario.length < 3 || usuario.length > 32 || !/^[a-z][a-z0-9]*([._-][a-z0-9]+)*$/.test(usuario)) return null
  return `u-${usuario}@${DOMINIO_TELEFONO}`
}

export function esCorreoInterno(texto) {
  return /^(502[0-9]{8}|u-[a-z0-9._-]+)@instructores\.zonafitness\.app$/i.test(texto || '')
}

export function identificadorACorreo(texto) {
  const valor = String(texto ?? '').trim()
  if (valor.includes('@')) return esCorreoInterno(valor) ? null : valor
  const telefono = valor.replace(/[\s-]/g, '')
  if (/^[0-9]{8}$/.test(telefono)) return telefonoACorreo(telefono)
  return usuarioACorreo(valor)
}
