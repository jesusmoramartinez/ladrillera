// -----------------------------------------------------------------------------
// Clientes.jsx — Lista de clientes con su saldo
// -----------------------------------------------------------------------------
// El molde es el mismo de Empleados: cargar, listar, formulario, guardar. Lo
// que cambia es lo que se muestra al lado de cada nombre.
//
// La lista de clientes SIN los saldos no le sirve para nada al dueno: los
// nombres de sus clientes ya se los sabe. Lo que necesita saber, parado en la
// fabrica, es quien le debe y cuanto. Por eso el saldo va en la misma fila,
// grande y con color, y no escondido adentro de cada ficha.
//
// Tocar un cliente lleva a sus ventas, no a su ficha: despues de ver "debe
// 3.000.000" la pregunta que sigue es siempre "de que ventas".
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BotonGrande } from '../components/BotonGrande.jsx';
import { CampoTexto } from '../components/CampoTexto.jsx';
import { Confirmacion } from '../components/Confirmacion.jsx';
import {
  crearCliente,
  editarCliente,
  eliminarCliente,
  listarClientes,
} from '../api/clients.js';
import { formatearGs, formatearNumero } from '../utils/format.js';

const FORMULARIO_VACIO = { nombre: '', telefono: '', notas: '' };

export function Clientes() {
  const navegar = useNavigate();

  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [recargas, setRecargas] = useState(0);

  // DOS estados de error distintos, y la diferencia importa:
  //
  //   errorCarga   -> no se pudieron traer los datos. No hay lista que mostrar,
  //                   asi que la pantalla se reemplaza por el error + Reintentar.
  //
  //   errorAccion  -> los datos estan bien, pero una accion fue rechazada
  //                   ("no se puede eliminar, todavia debe plata"). La lista
  //                   TIENE que seguir ahi: el mensaje habla de una fila que el
  //                   dueno esta mirando, y hacerla desaparecer para mostrar el
  //                   aviso es dejarlo sin contexto justo cuando mas lo necesita.
  const [errorAccion, setErrorAccion] = useState('');

  const [formulario, setFormulario] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [errorFormulario, setErrorFormulario] = useState('');
  const [erroresCampo, setErroresCampo] = useState({});
  const [guardando, setGuardando] = useState(false);

  const [aEliminar, setAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  function recargar() {
    setCargando(true);
    setErrorCarga('');
    setRecargas((n) => n + 1);
  }

  useEffect(() => {
    let cancelado = false;

    listarClientes()
      .then((datos) => {
        if (!cancelado) setClientes(datos);
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

  function abrirEdicion(cliente) {
    setEditandoId(cliente.id);
    setFormulario({
      nombre: cliente.nombre,
      telefono: cliente.telefono ?? '',
      notas: cliente.notas ?? '',
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
      if (editandoId) await editarCliente(editandoId, formulario);
      else await crearCliente(formulario);

      cerrarFormulario();
      recargar();
    } catch (error) {
      if (error.detalles?.length) {
        const porCampo = {};
        for (const d of error.detalles) porCampo[d.campo] = d.mensaje;
        setErroresCampo(porCampo);
      } else {
        setErrorFormulario(error.message);
      }
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar() {
    setEliminando(true);
    setErrorAccion('');
    try {
      await eliminarCliente(aEliminar.id);
      setAEliminar(null);
      recargar();
    } catch (error) {
      // El 409 "todavia debe algo" llega por acá. No es un fallo del sistema
      // sino una regla de negocio explicandose, asi que se muestra arriba de la
      // lista y la lista se queda donde esta.
      setErrorAccion(error.message);
      setAEliminar(null);
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className="pantalla">
      <header className="cabecera">
        <h1 className="titulo">Clientes</h1>
        <BotonGrande onClick={abrirNuevo}>+ Nuevo</BotonGrande>
      </header>

      {errorAccion && (
        <p className="alerta" role="alert">
          {errorAccion}
        </p>
      )}

      {cargando && <p className="texto-tenue">Cargando clientes...</p>}

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

      {!cargando && !errorCarga && clientes.length === 0 && (
        <div className="tarjeta">
          <h2 className="subtitulo">Todavia no hay clientes</h2>
          <p className="texto-tenue">
            Solo hacen falta para las ventas que dejan algo pendiente. Una venta
            cobrada y entregada en el acto no necesita cliente.
          </p>
          <BotonGrande onClick={abrirNuevo} ancho>
            Agregar el primero
          </BotonGrande>
        </div>
      )}

      {!cargando && !errorCarga && clientes.length > 0 && (
        <ul className="lista">
          {clientes.map((cliente) => (
            <li key={cliente.id} className="lista-fila">
              <div className="lista-fila-datos">
                <button
                  className="lista-fila-titulo boton-invisible"
                  onClick={() => navegar(`/ventas?cliente=${cliente.id}`)}
                >
                  {cliente.nombre}
                </button>

                {cliente.telefono && <p className="texto-tenue">{cliente.telefono}</p>}

                {cliente.porCobrar > 0 || cliente.porEntregar > 0 ? (
                  <p className="texto-tenue">
                    {cliente.porCobrar > 0 && (
                      <span className="monto-negativo">
                        Debe {formatearGs(cliente.porCobrar)}
                      </span>
                    )}
                    {cliente.porCobrar > 0 && cliente.porEntregar > 0 && ' · '}
                    {cliente.porEntregar > 0 && (
                      <span>
                        Espera {formatearNumero(cliente.porEntregar)} ladrillos
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="texto-tenue">Sin saldo pendiente</p>
                )}

                {cliente.notas && <p className="texto-tenue">{cliente.notas}</p>}
              </div>

              <div className="lista-fila-acciones">
                <button
                  className="boton-texto"
                  onClick={() => abrirEdicion(cliente)}
                  aria-label={`Editar a ${cliente.nombre}`}
                >
                  Editar
                </button>
                <button
                  className="boton-texto boton-texto--peligro"
                  onClick={() => setAEliminar(cliente)}
                  aria-label={`Eliminar a ${cliente.nombre}`}
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
            onClick={(e) => e.stopPropagation()}
            onSubmit={guardar}
          >
            <h2 className="subtitulo">{editandoId ? 'Editar cliente' : 'Nuevo cliente'}</h2>

            <CampoTexto
              etiqueta="Nombre"
              value={formulario.nombre}
              onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })}
              error={erroresCampo.nombre}
              autoFocus
              required
            />

            <CampoTexto
              etiqueta="Telefono (opcional)"
              type="tel"
              inputMode="tel"
              value={formulario.telefono}
              onChange={(e) => setFormulario({ ...formulario, telefono: e.target.value })}
              error={erroresCampo.telefono}
              placeholder="0981 123 456"
            />

            <CampoTexto
              etiqueta="Notas (opcional)"
              value={formulario.notas}
              onChange={(e) => setFormulario({ ...formulario, notas: e.target.value })}
              error={erroresCampo.notas}
              placeholder="Paga a fin de mes, retira con camion propio..."
            />

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
          mensaje="Se saca de la lista, pero sus ventas ya cargadas no se tocan. Si todavia debe plata o le faltan ladrillos, el sistema no va a dejar."
          textoConfirmar="Eliminar"
          cargando={eliminando}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setAEliminar(null)}
        />
      )}
    </div>
  );
}

export default Clientes;
