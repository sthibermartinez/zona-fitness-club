import { useCallback, useEffect, useState } from 'react'
import { Plus, UserX, UserCheck, X, AlertTriangle } from 'lucide-react'
import { supabase } from './supabase'
import './GestionEmpleados.css'

const FORMULARIO_VACIO = { nombre: '', telefono: '', contrasena: '' }

function formatearFechaCreacion(fechaIso) {
  if (!fechaIso) return '—'
  return new Date(fechaIso).toLocaleDateString('es-GT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Guatemala'
  })
}

// Llama a la función segura del servidor y devuelve un mensaje de error claro
async function llamarFuncion(cuerpo) {
  const { data, error } = await supabase.functions.invoke('gestionar-empleados', { body: cuerpo })

  if (error) {
    let mensaje = 'No se pudo comunicar con el servidor. Verifica que la función "gestionar-empleados" esté desplegada.'

    try {
      const detalle = await error.context.json()
      if (detalle?.error) mensaje = detalle.error
    } catch {
      // Se conserva el mensaje general
    }

    throw new Error(mensaje)
  }

  if (data?.error) throw new Error(data.error)

  return data
}

// Sección "Instructores" del panel administrativo
function GestionEmpleados() {
  const [empleados, setEmpleados] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO)
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [empleadoEstado, setEmpleadoEstado] = useState(null)
  const [empleadoContrasena, setEmpleadoContrasena] = useState(null)
  const [nuevaContrasena, setNuevaContrasena] = useState('')

  const cargarEmpleados = useCallback(async () => {
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre_completo, telefono, correo, activo, creado_en')
      .eq('rol', 'empleado')
      .order('nombre_completo')

    if (error) {
      console.error('Error cargando instructores:', error)
      setMensaje({ tipo: 'error', texto: 'No se pudo cargar la lista de instructores.' })
    } else {
      setEmpleados(data || [])
    }

    setCargando(false)
  }, [])

  useEffect(() => {
    cargarEmpleados()
  }, [cargarEmpleados])

  function cerrarFormulario() {
    setMostrarFormulario(false)
    setFormulario(FORMULARIO_VACIO)
  }

  async function crearEmpleado(evento) {
    evento.preventDefault()

    if (procesando) return

    if (!/^[0-9]{8}$/.test(formulario.telefono)) {
      setMensaje({ tipo: 'error', texto: 'El número de teléfono debe tener exactamente 8 dígitos.' })
      return
    }

    setProcesando(true)
    setMensaje(null)

    try {
      await llamarFuncion({
        accion: 'crear',
        nombre: formulario.nombre,
        telefono: formulario.telefono,
        contrasena: formulario.contrasena
      })

      setMensaje({
        tipo: 'exito',
        texto: `Cuenta creada para ${formulario.nombre.trim()}. Entrégale su número de teléfono y su contraseña inicial.`
      })
      cerrarFormulario()
      await cargarEmpleados()
    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message })
    }

    setProcesando(false)
  }

  async function confirmarCambioEstado() {
    if (procesando || !empleadoEstado) return

    setProcesando(true)
    setMensaje(null)

    try {
      const respuesta = await llamarFuncion({
        accion: 'cambiar_estado',
        id: empleadoEstado.id,
        activo: !empleadoEstado.activo
      })

      setMensaje({
        tipo: respuesta?.aviso ? 'error' : 'exito',
        texto: respuesta?.aviso || (empleadoEstado.activo
          ? `${empleadoEstado.nombre_completo} fue desactivado y ya no puede iniciar sesión.`
          : `${empleadoEstado.nombre_completo} fue activado nuevamente.`)
      })
      await cargarEmpleados()
    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message })
    }

    setEmpleadoEstado(null)
    setProcesando(false)
  }

  async function confirmarNuevaContrasena(evento) {
    evento.preventDefault()

    if (procesando || !empleadoContrasena) return

    setProcesando(true)
    setMensaje(null)

    try {
      await llamarFuncion({
        accion: 'restablecer',
        id: empleadoContrasena.id,
        contrasena: nuevaContrasena
      })

      setMensaje({
        tipo: 'exito',
        texto: `Se cambió la contraseña de ${empleadoContrasena.nombre_completo}. Entrégale la nueva contraseña.`
      })
      setEmpleadoContrasena(null)
      setNuevaContrasena('')
    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message })
    }

    setProcesando(false)
  }

  return (
    <>
      <div className="section-actions">
        <div>
          <h2>Instructores</h2>
          <p>Crea las cuentas de los instructores y controla quién puede iniciar sesión.</p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => (mostrarFormulario ? cerrarFormulario() : setMostrarFormulario(true))}
        >
          <Plus size={17} />
          Nuevo instructor
        </button>
      </div>

      {mensaje && (
        <p className={`empleados-mensaje empleados-mensaje-${mensaje.tipo}`}>{mensaje.texto}</p>
      )}

      {mostrarFormulario && (
        <div className="content-card form-card">
          <h3>Crear cuenta de instructor</h3>
          <p>El instructor iniciará sesión con su número de teléfono y esta contraseña inicial.</p>

          <form onSubmit={crearEmpleado}>
            <div className="form-grid">
              <label>
                Nombre completo
                <input
                  type="text"
                  placeholder="Nombre y apellidos"
                  value={formulario.nombre}
                  onChange={evento => setFormulario({ ...formulario, nombre: evento.target.value })}
                  required
                />
              </label>

              <label>
                Número de teléfono
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="8 dígitos"
                  maxLength={8}
                  value={formulario.telefono}
                  onChange={evento => setFormulario({
                    ...formulario,
                    telefono: evento.target.value.replace(/[^0-9]/g, '')
                  })}
                  required
                />
              </label>

              <label>
                Contraseña inicial
                <input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={formulario.contrasena}
                  onChange={evento => setFormulario({ ...formulario, contrasena: evento.target.value })}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
            </div>

            <div className="form-buttons">
              <button type="button" className="cancel-button" onClick={cerrarFormulario}>
                Cancelar
              </button>
              <button type="submit" className="primary-button" disabled={procesando}>
                {procesando ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="content-card">
        <div className="promo-list-heading">
          <div>
            <h3>Cuentas de instructores</h3>
            <p>Un instructor desactivado no puede iniciar sesión ni usar el panel.</p>
          </div>
          <span className="promo-total">{empleados.length} cuentas</span>
        </div>

        {cargando ? (
          <p className="empty">Cargando instructores...</p>
        ) : empleados.length === 0 ? (
          <p className="empty">Todavía no hay instructores registrados.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>INSTRUCTOR</th>
                  <th>TELÉFONO</th>
                  <th>CREADA</th>
                  <th>ESTADO</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {empleados.map(empleado => (
                  <tr key={empleado.id}>
                    <td><strong>{empleado.nombre_completo}</strong></td>
                    <td>{empleado.telefono || empleado.correo || '—'}</td>
                    <td>{formatearFechaCreacion(empleado.creado_en)}</td>
                    <td>
                      <span className={empleado.activo ? 'status-active' : 'status-expired'}>
                        {empleado.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="empleados-acciones">
                        <button
                          type="button"
                          className="cancel-button"
                          onClick={() => setEmpleadoEstado(empleado)}
                        >
                          {empleado.activo ? <UserX size={16} /> : <UserCheck size={16} />}
                          {empleado.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          className="cancel-button"
                          onClick={() => {
                            setEmpleadoContrasena(empleado)
                            setNuevaContrasena('')
                          }}
                        >
                          Cambiar contraseña
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {empleadoEstado && (
        <div className="modal-overlay">
          <div
            className="confirmation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-empleado-estado"
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setEmpleadoEstado(null)}
              aria-label="Cerrar"
            >
              <X size={19} />
            </button>

            <div className={`modal-icon ${empleadoEstado.activo ? 'modal-icon-danger' : 'modal-icon-warning'}`}>
              <AlertTriangle size={27} />
            </div>

            <h2 id="modal-empleado-estado">
              {empleadoEstado.activo ? '¿Desactivar este instructor?' : '¿Activar este instructor?'}
            </h2>
            <p className="modal-description">
              {empleadoEstado.activo
                ? `${empleadoEstado.nombre_completo} ya no podrá iniciar sesión ni registrar asistencias. Sus registros anteriores se conservan.`
                : `${empleadoEstado.nombre_completo} podrá iniciar sesión nuevamente.`}
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-cancel-button"
                onClick={() => setEmpleadoEstado(null)}
                disabled={procesando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="modal-primary-button"
                onClick={confirmarCambioEstado}
                disabled={procesando}
              >
                {procesando ? 'Procesando...' : empleadoEstado.activo ? 'Sí, desactivar' : 'Sí, activar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {empleadoContrasena && (
        <div className="modal-overlay">
          <div
            className="confirmation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-empleado-contrasena"
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setEmpleadoContrasena(null)}
              aria-label="Cerrar"
            >
              <X size={19} />
            </button>

            <h2 id="modal-empleado-contrasena">Cambiar contraseña</h2>
            <p className="modal-description">
              Escribe la nueva contraseña de {empleadoContrasena.nombre_completo}.
            </p>

            <form onSubmit={confirmarNuevaContrasena}>
              <label className="empleados-campo-modal">
                Nueva contraseña
                <input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={nuevaContrasena}
                  onChange={evento => setNuevaContrasena(evento.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-cancel-button"
                  onClick={() => setEmpleadoContrasena(null)}
                  disabled={procesando}
                >
                  Cancelar
                </button>
                <button type="submit" className="modal-primary-button" disabled={procesando}>
                  {procesando ? 'Guardando...' : 'Guardar contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default GestionEmpleados
