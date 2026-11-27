import { useCallback, useEffect, useState } from 'react'
import { Plus, UserX, UserCheck, X, AlertTriangle } from 'lucide-react'
import { supabase } from './supabase'
import { esCorreoInterno, usuarioACorreo } from './identificadorAcceso'
import './GestionEmpleados.css'

const FORMULARIO_VACIO = { usuario: '', contrasena: '', nombre: '', telefono: '', correo: '' }

const AYUDA_USUARIO = 'De 3 a 32 caracteres. Empieza con una letra. Usa letras sin tilde, números y, entre ellos, punto, guion o guion bajo.'

function CampoUsuario({ valor, alCambiar, enFormulario = false }) {
  return (
    <label className={enFormulario ? undefined : "empleados-campo-modal"}>
      Nombre de usuario
      <input type="text" value={valor} onChange={evento => alCambiar(evento.target.value)}
        placeholder="Ej. yeni.garcia" maxLength={32} minLength={3} required
        autoCapitalize="none" autoComplete="off" spellCheck={false} />
      <small>{AYUDA_USUARIO}</small>
    </label>
  )
}

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
  const [empleadoUsuario, setEmpleadoUsuario] = useState(null)
  const [nuevoUsuario, setNuevoUsuario] = useState('')
  const [errorUsuario, setErrorUsuario] = useState('')
  const [empleadoEstado, setEmpleadoEstado] = useState(null)
  const [empleadoContrasena, setEmpleadoContrasena] = useState(null)
  const [nuevaContrasena, setNuevaContrasena] = useState('')

  const cargarEmpleados = useCallback(async () => {
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre_completo, usuario, telefono, correo, activo, creado_en')
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

    if (!usuarioACorreo(formulario.usuario)) {
      setMensaje({ tipo: 'error', texto: AYUDA_USUARIO })
      return
    }
    if (formulario.telefono && !/^[0-9]{8}$/.test(formulario.telefono)) {
      setMensaje({ tipo: 'error', texto: 'El número de teléfono debe tener exactamente 8 dígitos.' })
      return
    }

    setProcesando(true)
    setMensaje(null)

    try {
      await llamarFuncion({
        accion: 'crear',
        usuario: formulario.usuario.trim().toLowerCase(),
        correo: formulario.correo,
        nombre: formulario.nombre,
        telefono: formulario.telefono,
        contrasena: formulario.contrasena
      })

      setMensaje({
        tipo: 'exito',
        texto: `Cuenta creada. El instructor puede entrar con el usuario ${formulario.usuario.trim().toLowerCase()} y su contraseña inicial.`
      })
      cerrarFormulario()
      await cargarEmpleados()
    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message })
    }

    setProcesando(false)
  }

  async function guardarUsuario(evento) {
    evento.preventDefault()
    if (procesando || !empleadoUsuario) return
    if (!usuarioACorreo(nuevoUsuario)) {
      setErrorUsuario(AYUDA_USUARIO)
      return
    }

    setProcesando(true)
    setErrorUsuario('')
    setMensaje(null)
    try {
      const { usuario } = await llamarFuncion({
        accion: 'asignar_usuario', id: empleadoUsuario.id, usuario: nuevoUsuario.trim().toLowerCase()
      })
      setMensaje({ tipo: 'exito', texto: `Usuario guardado para ${empleadoUsuario.nombre_completo}: ${usuario}. Conserva su contraseña.` })
      setEmpleadoUsuario(null)
      await cargarEmpleados()
    } catch (error) {
      setErrorUsuario(error.message)
    } finally {
      setProcesando(false)
    }
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
          <p>Para crear la cuenta solo necesitas un usuario y una contraseña inicial.</p>

          <form onSubmit={crearEmpleado}>
            <div className="form-grid empleados-alta-grid">
              <CampoUsuario enFormulario valor={formulario.usuario} alCambiar={usuario => setFormulario({ ...formulario, usuario })} />
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
              <label>
                Nombre completo (opcional)
                <input
                  type="text"
                  placeholder="Nombre y apellidos"
                  value={formulario.nombre}
                  onChange={evento => setFormulario({ ...formulario, nombre: evento.target.value })}
                />
              </label>

              <label>
                Teléfono de contacto (opcional)
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
                />
              </label>

              <label>
                Correo de contacto (opcional)
                <input type="email" value={formulario.correo} placeholder="correo@ejemplo.com"
                  onChange={evento => setFormulario({ ...formulario, correo: evento.target.value })} />
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
                  <th>USUARIO</th>
                  <th>CONTACTO</th>
                  <th>CREADA</th>
                  <th>ESTADO</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {empleados.map(empleado => (
                  <tr key={empleado.id}>
                    <td><strong>{empleado.nombre_completo}</strong></td>
                    <td>{empleado.usuario || 'Por asignar'}</td>
                    <td>
                      <div>{empleado.telefono || '—'}</div>
                      {empleado.correo && !esCorreoInterno(empleado.correo) && <div>{empleado.correo}</div>}
                    </td>
                    <td>{formatearFechaCreacion(empleado.creado_en)}</td>
                    <td>
                      <span className={empleado.activo ? 'status-active' : 'status-expired'}>
                        {empleado.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="empleados-acciones">
                        <button type="button" className="cancel-button"
                          onClick={() => {
                            setEmpleadoUsuario(empleado)
                            setNuevoUsuario(empleado.usuario || '')
                            setErrorUsuario('')
                          }}>
                          {empleado.usuario ? 'Cambiar usuario' : 'Asignar usuario'}
                        </button>
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

      {empleadoUsuario && (
        <div className="modal-overlay">
          <div className="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="titulo-usuario">
            <button type="button" className="modal-close" aria-label="Cerrar" disabled={procesando} onClick={() => setEmpleadoUsuario(null)}>
              <X size={19} />
            </button>
            <h2 id="titulo-usuario">{empleadoUsuario.usuario ? 'Cambiar usuario' : 'Asignar usuario'}</h2>
            <p className="modal-description">{empleadoUsuario.nombre_completo} usará este usuario con su contraseña actual.</p>
            <form onSubmit={guardarUsuario}>
              <CampoUsuario valor={nuevoUsuario} alCambiar={setNuevoUsuario} />
              {errorUsuario && <p className="empleados-mensaje empleados-mensaje-error" role="alert">{errorUsuario}</p>}
              <div className="modal-actions">
                <button type="button" className="modal-cancel-button" disabled={procesando} onClick={() => setEmpleadoUsuario(null)}>Cancelar</button>
                <button type="submit" className="modal-primary-button" disabled={procesando}>{procesando ? 'Guardando...' : 'Guardar usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
