// -----------------------------------------------------------------------------
// Empleados.jsx — Lista, alta, edicion y baja de empleados
// -----------------------------------------------------------------------------
// Es la primera pantalla "de verdad" del sistema, y el molde de las que vienen:
// carga datos, muestra una lista, abre un formulario y guarda.
//
// Los cuatro estados que toda pantalla que carga datos tiene que contemplar
// (y que es facilisimo olvidar):
//   1. Cargando     -> "Cargando empleados..."
//   2. Error        -> mensaje + boton "Reintentar"
//   3. Vacio        -> explicar que hacer, no dejar la pantalla en blanco
//   4. Con datos    -> la lista
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { BotonGrande } from '../components/BotonGrande.jsx';
import { CampoTexto } from '../components/CampoTexto.jsx';
import { Confirmacion } from '../components/Confirmacion.jsx';
import { InputGs } from '../components/InputGs.jsx';
import {
  crearEmpleado,
  editarEmpleado,
  eliminarEmpleado,
  listarEmpleados,
} from '../api/employees.js';
import { formatearGs } from '../utils/format.js';

const FORMULARIO_VACIO = { nombre: '', rol: '', tarifaPorMil: 0, activo: true };

export function Empleados() {
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  // null = formulario cerrado. Un objeto = formulario abierto con esos datos.
  const [formulario, setFormulario] = useState(null);
  // Si tiene id, estamos editando; si no, creando.
  const [editandoId, setEditandoId] = useState(null);
  const [errorFormulario, setErrorFormulario] = useState('');
  const [erroresCampo, setErroresCampo] = useState({});
  const [guardando, setGuardando] = useState(false);

  const [aEliminar, setAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  // Contador que dispara la recarga. Cambiarlo hace que el useEffect de abajo
  // vuelva a correr. Es mas simple que tener una funcion de carga llamada desde
  // varios lugares, y evita el bucle infinito clasico (una funcion nueva en
  // cada render como dependencia del efecto).
  const [recargas, setRecargas] = useState(0);

  /**
   * Pide los datos de nuevo.
   *
   * Fijate que el "estoy cargando" se prende ACA, en el evento que provoco la
   * recarga, y no adentro del efecto. Prender estado dentro de un efecto
   * dispara un render extra en cadena; hacerlo en el evento es lo que
   * recomienda React (y lo que marca el linter si lo haces al reves).
   */
  function recargar() {
    setCargando(true);
    setErrorCarga('');
    setRecargas((n) => n + 1);
  }

  useEffect(() => {
    // Bandera de cancelacion. Si el componente desaparece (o se dispara otra
    // recarga) antes de que llegue la respuesta, no tocamos el estado de algo
    // que ya no esta en pantalla. Ademas evita que una respuesta vieja y lenta
    // pise a una nueva que llego antes.
    let cancelado = false;

    listarEmpleados()
      .then((datos) => {
        if (!cancelado) setEmpleados(datos);
      })
      .catch((error) => {
        if (!cancelado) setErrorCarga(error.message);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [recargas]);

  function abrirNuevo() {
    setEditandoId(null);
    setFormulario(FORMULARIO_VACIO);
    setErrorFormulario('');
    setErroresCampo({});
  }

  function abrirEdicion(empleado) {
    setEditandoId(empleado.id);
    setFormulario({
      nombre: empleado.nombre,
      rol: empleado.rol ?? '',
      tarifaPorMil: empleado.tarifaPorMil,
      activo: empleado.activo,
    });
    setErrorFormulario('');
    setErroresCampo({});
  }

  function cerrarFormulario() {
    setFormulario(null);
    setEditandoId(null);
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario('');
    setErroresCampo({});

    try {
      if (editandoId) {
        await editarEmpleado(editandoId, formulario);
      } else {
        await crearEmpleado(formulario);
      }
      cerrarFormulario();
      recargar();
    } catch (error) {
      // El backend manda los errores como [{ campo, mensaje }]. Los pasamos a
      // un objeto { campo: mensaje } para mostrarlos debajo del input que
      // corresponde, en vez de un mensaje general que no dice donde mirar.
      if (error.detalles?.length) {
        const porCampo = {};
        for (const detalle of error.detalles) porCampo[detalle.campo] = detalle.mensaje;
        setErroresCampo(porCampo);
      } else {
        setErrorFormulario(error.message);
      }
    } finally {
      setGuardando(false);
    }
  }

  /** Cambia activo/inactivo sin abrir el formulario: es un toque y listo. */
  async function alternarActivo(empleado) {
    // Actualizacion "optimista": cambiamos la pantalla ANTES de que conteste el
    // servidor, asi se siente instantaneo. Si falla, volvemos atras recargando.
    setEmpleados((lista) =>
      lista.map((e) => (e.id === empleado.id ? { ...e, activo: !e.activo } : e)),
    );
    try {
      await editarEmpleado(empleado.id, { activo: !empleado.activo });
      recargar(); // recargamos para respetar el orden (activos primero)
    } catch (error) {
      setErrorCarga(error.message);
      recargar();
    }
  }

  async function confirmarEliminar() {
    setEliminando(true);
    try {
      await eliminarEmpleado(aEliminar.id);
      setAEliminar(null);
      recargar();
    } catch (error) {
      setErrorCarga(error.message);
      setAEliminar(null);
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className="pantalla">
      <header className="cabecera">
        <h1 className="titulo">Empleados</h1>
        <BotonGrande onClick={abrirNuevo}>+ Nuevo</BotonGrande>
      </header>

      {cargando && <p className="texto-tenue">Cargando empleados...</p>}

      {!cargando && errorCarga && (
        <div className="tarjeta">
          <p className="alerta" role="alert">
            {errorCarga}
          </p>
          <BotonGrande variante="secundario" onClick={recargar} ancho>
            Reintentar
          </BotonGrande>
        </div>
      )}

      {!cargando && !errorCarga && empleados.length === 0 && (
        <div className="tarjeta">
          <h2 className="subtitulo">Todavia no hay empleados</h2>
          <p className="texto-tenue">
            Carga a cada persona con su tarifa por cada 1.000 ladrillos. Despues
            vas a poder marcarlos al registrar la produccion del dia.
          </p>
          <BotonGrande onClick={abrirNuevo} ancho>
            Agregar el primero
          </BotonGrande>
        </div>
      )}

      {!cargando && !errorCarga && empleados.length > 0 && (
        <ul className="lista">
          {empleados.map((empleado) => (
            <li
              key={empleado.id}
              className={`lista-fila${empleado.activo ? '' : ' lista-fila--apagada'}`}
            >
              <div className="lista-fila-datos">
                <p className="lista-fila-titulo">
                  {empleado.nombre}
                  {!empleado.activo && <span className="etiqueta">inactivo</span>}
                </p>
                <p className="texto-tenue">
                  {empleado.rol ? `${empleado.rol} · ` : ''}
                  {formatearGs(empleado.tarifaPorMil)} por millar
                </p>
              </div>

              <div className="lista-fila-acciones">
                <button
                  className="boton-texto"
                  onClick={() => alternarActivo(empleado)}
                  aria-label={`${empleado.activo ? 'Desactivar' : 'Activar'} a ${empleado.nombre}`}
                >
                  {empleado.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  className="boton-texto"
                  onClick={() => abrirEdicion(empleado)}
                  aria-label={`Editar a ${empleado.nombre}`}
                >
                  Editar
                </button>
                <button
                  className="boton-texto boton-texto--peligro"
                  onClick={() => setAEliminar(empleado)}
                  aria-label={`Eliminar a ${empleado.nombre}`}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formulario && (
        <div className="overlay" onClick={cerrarFormulario}>
          <form
            className="tarjeta overlay-panel"
            onClick={(evento) => evento.stopPropagation()}
            onSubmit={guardar}
          >
            <h2 className="subtitulo">
              {editandoId ? 'Editar empleado' : 'Nuevo empleado'}
            </h2>

            <CampoTexto
              etiqueta="Nombre"
              value={formulario.nombre}
              onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })}
              error={erroresCampo.nombre}
              autoFocus
              required
            />

            <CampoTexto
              etiqueta="Rol (opcional)"
              value={formulario.rol}
              onChange={(e) => setFormulario({ ...formulario, rol: e.target.value })}
              error={erroresCampo.rol}
              placeholder="cortador, cargador..."
            />

            <InputGs
              etiqueta="Tarifa por cada 1.000 ladrillos"
              value={formulario.tarifaPorMil}
              onChange={(n) => setFormulario({ ...formulario, tarifaPorMil: n })}
              error={erroresCampo.tarifaPorMil}
              ayuda="Lo que cobra por mil. Si hace 500, cobra la mitad."
            />

            <label className="campo-checkbox">
              <input
                type="checkbox"
                checked={formulario.activo}
                onChange={(e) => setFormulario({ ...formulario, activo: e.target.checked })}
              />
              <span>
                Activo
                <span className="campo-ayuda">
                  Los inactivos no aparecen al cargar produccion.
                </span>
              </span>
            </label>

            {errorFormulario && (
              <p className="alerta" role="alert">
                {errorFormulario}
              </p>
            )}

            <div className="fila-botones">
              <BotonGrande variante="secundario" onClick={cerrarFormulario} ancho>
                Cancelar
              </BotonGrande>
              <BotonGrande type="submit" cargando={guardando} ancho>
                Guardar
              </BotonGrande>
            </div>
          </form>
        </div>
      )}

      {aEliminar && (
        <Confirmacion
          titulo={`Eliminar a ${aEliminar.nombre}?`}
          mensaje="Se saca de la lista, pero sus producciones y liquidaciones ya cargadas no se tocan. Si solo dejo de venir por un tiempo, conviene desactivarlo en vez de eliminarlo."
          textoConfirmar="Eliminar"
          cargando={eliminando}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setAEliminar(null)}
        />
      )}
    </div>
  );
}

export default Empleados;
