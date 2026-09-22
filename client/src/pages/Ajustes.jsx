// -----------------------------------------------------------------------------
// Ajustes.jsx — Todo lo que se configura una vez y casi no se toca
// -----------------------------------------------------------------------------
// Es la contracara del asistente de configuracion inicial: ahi se carga todo
// junto el primer dia, acá se corrige de a una cosa cuando hace falta.
//
// Que hay adentro, en este orden:
//   1. Precios de venta — lo unico que cambia seguido (inflacion).
//   2. Parametros de la fabrica — ladrillos por camion, unidad de lena, alerta.
//   3. Categorias de gasto — para que los gastos de caja digan algo util.
//   4. Contrasena.
//
// El orden es por cuantas veces al ano se toca cada cosa, de mas a menos. La
// contrasena va ultima porque se cambia una vez cada mucho, y porque es la
// unica que no tiene vuelta atras desde la app.
//
// TRES AVISOS QUE ESTA PANTALLA TIENE QUE DAR SI O SI, y que estan escritos
// en la pantalla y no solo en este comentario:
//   - Cambiar un precio NO cambia las ventas ya hechas (guardan una copia).
//   - Cambiar ladrillosPorCamion NO recalcula el stock que ya hay.
//   - Las categorias y listas no se borran, se dan de baja: la historia queda.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { BotonGrande } from '../components/BotonGrande.jsx';
import { CampoTexto } from '../components/CampoTexto.jsx';
import { Confirmacion } from '../components/Confirmacion.jsx';
import { InputEntero } from '../components/InputEntero.jsx';
import { InputGs } from '../components/InputGs.jsx';
import { cambiarPassword } from '../api/auth.js';
import {
  crearCategoria,
  crearListaPrecio,
  editarListaPrecio,
  eliminarCategoria,
  eliminarListaPrecio,
  guardarConfig,
  listarCategorias,
  listarListasPrecio,
  obtenerConfig,
} from '../api/caja.js';
import { formatearGs } from '../utils/format.js';

export function Ajustes() {
  const [config, setConfig] = useState(null);
  const [listas, setListas] = useState([]);
  const [categorias, setCategorias] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [errorAccion, setErrorAccion] = useState('');
  const [aviso, setAviso] = useState('');
  const [recargas, setRecargas] = useState(0);

  function recargar() {
    setCargando(true);
    setErrorCarga('');
    setRecargas((n) => n + 1);
  }

  useEffect(() => {
    let cancelado = false;

    Promise.all([obtenerConfig(), listarListasPrecio(), listarCategorias({ elegibles: true })])
      .then(([c, l, cat]) => {
        if (cancelado) return;
        setConfig(c);
        setListas(l);
        setCategorias(cat);
      })
      .catch((e) => {
        if (!cancelado) setErrorCarga(e.message);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [recargas]);

  /** Envuelve una accion: limpia mensajes, la corre, y recarga si salio bien. */
  async function accion(trabajo, mensajeOk) {
    setErrorAccion('');
    setAviso('');
    try {
      await trabajo();
      setAviso(mensajeOk);
      recargar();
    } catch (e) {
      setErrorAccion(e.message);
    }
  }

  if (cargando) {
    return (
      <div className="pantalla">
        <h1 className="titulo">Ajustes</h1>
        <p className="texto-tenue">Cargando...</p>
      </div>
    );
  }

  if (errorCarga) {
    return (
      <div className="pantalla">
        <h1 className="titulo">Ajustes</h1>
        <div className="tarjeta">
          <p className="alerta" role="alert">
            {errorCarga}
          </p>
          <BotonGrande variante="secundario" onClick={recargar} ancho>
            Reintentar
          </BotonGrande>
        </div>
      </div>
    );
  }

  return (
    <div className="pantalla">
      <h1 className="titulo">Ajustes</h1>

      {errorAccion && (
        <p className="alerta" role="alert">
          {errorAccion}
        </p>
      )}
      {aviso && <p className="campo-ayuda">{aviso}</p>}

      <Precios listas={listas} accion={accion} />
      <ParametrosFabrica config={config} accion={accion} />
      <Categorias categorias={categorias} accion={accion} />
      <Password />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Precios de venta
// ---------------------------------------------------------------------------

function Precios({ listas, accion }) {
  const [editando, setEditando] = useState(null); // { id, nombre, precioPorMil }
  const [nueva, setNueva] = useState(null);
  const [aEliminar, setAEliminar] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(trabajo, mensaje) {
    setGuardando(true);
    await accion(trabajo, mensaje);
    setGuardando(false);
    setEditando(null);
    setNueva(null);
  }

  return (
    <section className="tarjeta">
      <h2 className="subtitulo">Precios de venta</h2>
      <p className="campo-ayuda">
        Cambiar un precio no toca las ventas que ya hiciste: cada venta guarda
        el precio que tenia el dia que se hizo.
      </p>

      <ul className="lista">
        {listas.map((lista) => (
          <li key={lista.id} className="lista-fila">
            <div className="lista-fila-datos">
              <p className="lista-fila-titulo">
                {lista.nombre}
                {lista.predeterminada && <span className="etiqueta">predeterminada</span>}
              </p>
              <p className="texto-tenue">{formatearGs(lista.precioPorMil)} por mil</p>
            </div>

            <div className="fila-acciones">
              <button
                type="button"
                className="boton-texto"
                onClick={() =>
                  setEditando({
                    id: lista.id,
                    nombre: lista.nombre,
                    precioPorMil: lista.precioPorMil,
                  })
                }
              >
                Cambiar
              </button>

              {/* La predeterminada NO se puede dar de baja: el sistema
                  necesita siempre una elegida para abrir una venta. */}
              {!lista.predeterminada && (
                <>
                  <button
                    type="button"
                    className="boton-texto"
                    onClick={() =>
                      guardar(
                        () => editarListaPrecio(lista.id, { predeterminada: true }),
                        `"${lista.nombre}" ahora viene elegida al vender.`,
                      )
                    }
                  >
                    Usar por defecto
                  </button>
                  <button
                    type="button"
                    className="boton-texto boton-texto--peligro"
                    onClick={() => setAEliminar(lista)}
                  >
                    Dar de baja
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {editando && (
        <div className="tarjeta tarjeta--anidada">
          <CampoTexto
            etiqueta="Nombre"
            value={editando.nombre}
            onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
            maxLength={40}
          />
          <InputGs
            etiqueta="Precio por mil ladrillos"
            value={editando.precioPorMil}
            onChange={(n) => setEditando({ ...editando, precioPorMil: n })}
          />
          <div className="acciones">
            <BotonGrande variante="secundario" onClick={() => setEditando(null)} ancho>
              Cancelar
            </BotonGrande>
            <BotonGrande
              cargando={guardando}
              onClick={() =>
                guardar(
                  () =>
                    editarListaPrecio(editando.id, {
                      nombre: editando.nombre.trim(),
                      precioPorMil: editando.precioPorMil,
                    }),
                  'Precio guardado.',
                )
              }
              ancho
            >
              Guardar
            </BotonGrande>
          </div>
        </div>
      )}

      {nueva ? (
        <div className="tarjeta tarjeta--anidada">
          <CampoTexto
            etiqueta="Nombre"
            value={nueva.nombre}
            onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
            ayuda="Por ejemplo: Mayorista."
            maxLength={40}
          />
          <InputGs
            etiqueta="Precio por mil ladrillos"
            value={nueva.precioPorMil}
            onChange={(n) => setNueva({ ...nueva, precioPorMil: n })}
          />
          <div className="acciones">
            <BotonGrande variante="secundario" onClick={() => setNueva(null)} ancho>
              Cancelar
            </BotonGrande>
            <BotonGrande
              cargando={guardando}
              disabled={!nueva.nombre.trim() || nueva.precioPorMil <= 0}
              onClick={() =>
                guardar(
                  () =>
                    crearListaPrecio({
                      nombre: nueva.nombre.trim(),
                      precioPorMil: nueva.precioPorMil,
                    }),
                  'Precio agregado.',
                )
              }
              ancho
            >
              Agregar
            </BotonGrande>
          </div>
        </div>
      ) : (
        <BotonGrande
          variante="secundario"
          onClick={() => setNueva({ nombre: '', precioPorMil: 0 })}
          ancho
        >
          + Agregar precio
        </BotonGrande>
      )}

      {aEliminar && (
        <Confirmacion
          titulo={`Dar de baja "${aEliminar.nombre}"`}
          mensaje="No vas a poder elegirla en ventas nuevas. Las ventas viejas quedan como estan."
          textoConfirmar="Dar de baja"
          onCancelar={() => setAEliminar(null)}
          onConfirmar={async () => {
            await guardar(
              () => eliminarListaPrecio(aEliminar.id),
              `"${aEliminar.nombre}" dada de baja.`,
            );
            setAEliminar(null);
          }}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. Parametros de la fabrica
// ---------------------------------------------------------------------------

function ParametrosFabrica({ config, accion }) {
  const [borrador, setBorrador] = useState({
    unidadLena: config.unidadLena,
    ladrillosPorCamion: config.ladrillosPorCamion,
    umbralAlertaArcilla: config.umbralAlertaArcilla,
  });
  const [guardando, setGuardando] = useState(false);

  const cambio =
    borrador.unidadLena !== config.unidadLena ||
    borrador.ladrillosPorCamion !== config.ladrillosPorCamion ||
    borrador.umbralAlertaArcilla !== config.umbralAlertaArcilla;

  return (
    <section className="tarjeta">
      <h2 className="subtitulo">Tu fabrica</h2>

      <CampoTexto
        etiqueta="Unidad de lena"
        value={borrador.unidadLena}
        onChange={(e) => setBorrador({ ...borrador, unidadLena: e.target.value })}
        maxLength={20}
      />

      <InputEntero
        etiqueta="Ladrillos por camion de arcilla"
        value={borrador.ladrillosPorCamion}
        onChange={(n) => setBorrador({ ...borrador, ladrillosPorCamion: n })}
        ayuda="Solo cambia las cuentas de ahora en adelante: el stock que ya hay no se recalcula."
      />

      <InputEntero
        etiqueta="Avisar cuando la arcilla alcance para menos de"
        sufijo="ladrillos"
        value={borrador.umbralAlertaArcilla}
        onChange={(n) => setBorrador({ ...borrador, umbralAlertaArcilla: n })}
      />

      <BotonGrande
        cargando={guardando}
        disabled={!cambio || !borrador.unidadLena.trim() || borrador.ladrillosPorCamion <= 0}
        onClick={async () => {
          setGuardando(true);
          await accion(
            () => guardarConfig({ ...borrador, unidadLena: borrador.unidadLena.trim() }),
            'Configuracion guardada.',
          );
          setGuardando(false);
        }}
        ancho
      >
        Guardar
      </BotonGrande>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3. Categorias de gasto
// ---------------------------------------------------------------------------

function Categorias({ categorias, accion }) {
  const [nombre, setNombre] = useState('');
  const [aEliminar, setAEliminar] = useState(null);
  const [guardando, setGuardando] = useState(false);

  return (
    <section className="tarjeta">
      <h2 className="subtitulo">Categorias de gasto</h2>
      <p className="campo-ayuda">
        Son las opciones que aparecen al cargar un gasto en Caja. Las que usa el
        sistema solo (Venta, Sueldos, Adelanto, Compra de material) no se
        muestran acá porque se ponen solas.
      </p>

      <ul className="lista">
        {categorias.map((categoria) => (
          <li key={categoria.id} className="lista-fila">
            <div className="lista-fila-datos">
              <p className="lista-fila-titulo">{categoria.nombre}</p>
            </div>
            <button
              type="button"
              className="boton-texto boton-texto--peligro"
              onClick={() => setAEliminar(categoria)}
            >
              Dar de baja
            </button>
          </li>
        ))}
      </ul>

      <CampoTexto
        etiqueta="Agregar categoria"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        ayuda="Por ejemplo: Flete, Combustible."
        maxLength={40}
      />
      <BotonGrande
        variante="secundario"
        cargando={guardando}
        disabled={!nombre.trim()}
        onClick={async () => {
          setGuardando(true);
          await accion(
            () => crearCategoria({ nombre: nombre.trim(), tipo: 'egreso' }),
            'Categoria agregada.',
          );
          setNombre('');
          setGuardando(false);
        }}
        ancho
      >
        Agregar
      </BotonGrande>

      {aEliminar && (
        <Confirmacion
          titulo={`Dar de baja "${aEliminar.nombre}"`}
          mensaje="No vas a poder elegirla en gastos nuevos. Los gastos viejos la siguen mostrando."
          textoConfirmar="Dar de baja"
          onCancelar={() => setAEliminar(null)}
          onConfirmar={async () => {
            await accion(
              () => eliminarCategoria(aEliminar.id),
              `"${aEliminar.nombre}" dada de baja.`,
            );
            setAEliminar(null);
          }}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4. Contrasena
// ---------------------------------------------------------------------------

function Password() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState('');
  const [listo, setListo] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Pedirla dos veces no es burocracia: si se escribe mal una sola vez y nadie
  // la repite, el dueno queda afuera de su propio sistema y hay que entrar por
  // consola a arreglarlo.
  const coinciden = nueva === repetida;
  const puede = actual && nueva.length >= 8 && coinciden;

  async function guardar() {
    setGuardando(true);
    setError('');
    setListo('');
    try {
      await cambiarPassword(actual, nueva);
      setListo('Contrasena cambiada.');
      setActual('');
      setNueva('');
      setRepetida('');
    } catch (e) {
      setError(e.message);
    }
    setGuardando(false);
  }

  return (
    <section className="tarjeta">
      <h2 className="subtitulo">Contrasena</h2>

      <CampoTexto
        etiqueta="Contrasena actual"
        type="password"
        value={actual}
        onChange={(e) => setActual(e.target.value)}
        autoComplete="current-password"
      />
      <CampoTexto
        etiqueta="Contrasena nueva"
        type="password"
        value={nueva}
        onChange={(e) => setNueva(e.target.value)}
        ayuda="Al menos 8 caracteres."
        autoComplete="new-password"
      />
      <CampoTexto
        etiqueta="Repetir la nueva"
        type="password"
        value={repetida}
        onChange={(e) => setRepetida(e.target.value)}
        error={repetida && !coinciden ? 'No coincide con la anterior.' : ''}
        autoComplete="new-password"
      />

      {error && (
        <p className="alerta" role="alert">
          {error}
        </p>
      )}
      {listo && <p className="campo-ayuda">{listo}</p>}

      <BotonGrande cargando={guardando} disabled={!puede} onClick={guardar} ancho>
        Cambiar contrasena
      </BotonGrande>
    </section>
  );
}

export default Ajustes;
