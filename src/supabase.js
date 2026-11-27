import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const claveSesion = `zona-fitness-sesion:${supabaseUrl}`
// Supabase usa storageKey también para el canal de eventos. Una clave por carga
// separa esos eventos, mientras sessionStorage conserva la sesión al recargar.
const claveEventos = `${claveSesion}:${crypto.randomUUID()}`
const claveEnPestana = clave => clave.replace(claveEventos, claveSesion)

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storageKey: claveEventos,
    storage: {
      getItem: clave => sessionStorage.getItem(claveEnPestana(clave)),
      setItem: (clave, valor) => sessionStorage.setItem(claveEnPestana(clave), valor),
      removeItem: clave => sessionStorage.removeItem(claveEnPestana(clave))
    }
  }
})
