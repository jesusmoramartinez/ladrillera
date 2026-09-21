// -----------------------------------------------------------------------------
// Caja.jsx — Balance del mes y movimientos
// -----------------------------------------------------------------------------
// El plan (seccion 1) decidio que la caja muestre SOLO el balance del mes: sin
// saldo inicial ni acumulado. Es lo que el dueno realmente quiere saber:
// "este mes, ¿gane o perdi?".
//
// Los ingresos van a empezar a aparecer solos con los pagos de ventas (fase 6).
// Por ahora lo unico que entra a mano son los gastos.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { BotonGrande } from '../components/BotonGrande.jsx';
import { CampoSelect } from '../components/CampoSelect.jsx';
import { CampoTexto } from '../components/CampoTexto.jsx';
import { Confirmacion } from '../components/Confirmacion.jsx';
import { InputGs } from '../components/InputGs.jsx';
import {
  anularMovimiento,
  crearCategoria,
  listarCategorias,
  obtenerCaja,
  registrarEgreso,
} from '../api/caja.js';
import {
  desplazarMes,
  formatearFecha,
  formatearGs,
  formatearMes,
  hoyISO,
  mesActualISO,
} from '../utils/format.js';

const NUEVA = '__nueva__';

export function Caja() {
  const [mes, setMes] = useState(mesActualISO);
  const [datos, setDatos] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [recargas, setRecargas] = useState(0);

  const [formulario, setFormulario] = useState(null);
  const [nombreCategoriaNueva, setNombreCategoriaNueva] = useState('');
  const [erroresCampo, setErroresCampo] = useState({});
  const [errorFormulario, setErrorFormulario] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [aAnular, setAAnular] = useState(null);
  const [anulando, setAnulando] = useState(false);

  function recargar() {
    setCargando(true);
    setErrorCarga('');
    setRecargas((n) => n + 1);
  }

  function cambiarMes(pasos) {
    setCargando(true);
    setErrorCarga('');
    setMes((actual) => desplazarMes(actual, pasos));
  }

  useEffect(() => {
    let cancelado = false;

    Promise.all([obtenerCaja(mes), listarCategorias({ tipo: 'egreso', elegibles: true })])
      .then(([caja, cats]) => {
        if (cancelado) return;
        setDatos(caja);
        setCategorias(cats);
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
    // Se recarga tanto al cambiar de mes como al pedir una recarga explicita.
  }, [mes, recargas]);

  function abrirGasto() {
    setFormulario({ categoriaId: '', monto: 0, descripcion: '', fecha: hoyISO() });
    setNombreCategoriaNueva('');
    setErroresCampo({});
    setErrorFormulario('');
  }

  function cerrar() {
    setFormulario(null);
    setNombreCategoriaNueva('');
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErroresCampo({});
    setErrorFormulario('');

    try {
      let categoriaId = formulario.categoriaId;

      // "+ Nueva categoria" dentro del mismo formulario: el plan (seccion 7)
      // lo pide ahi mismo para no obligar a salir a Ajustes y volver.
      if (categoriaId === NUEVA) {
        const creada = await crearCategoria({
          nombre: nombreCategoriaNueva,
          tipo: 'egreso',
        });
        categoriaId = creada.id;
      }

      await registrarEgreso({ ...formulario, categoriaId });
      cerrar();
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

  async function confirmarAnular() {
    setAnulando(true);
    try {
      await anularMovimiento(aAnular.id);
      setAAnular(null);
      recargar();
    } catch (error) {
      setErrorCarga(error.message);
      setAAnular(null);
    } finally {
      setAnulando(false);
    }
  }

  return (
    <div className="pantalla">
      <header className="cabecera">
        <h1 className="titulo">Caja</h1>
        <BotonGrande onClick={abrirGasto}>− Gasto</BotonGrande>
      </header>

      <div className="selector-mes">
        <button
          className="boton-texto"
          onClick={() => cambiarMes(-1)}
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <span className="selector-mes-texto">{formatearMes(mes)}</span>
        <button
          className="boton-texto"
          onClick={() => cambiarMes(1)}
          aria-label="Mes siguiente"
          // No tiene sentido mirar el futuro: todavia no paso nada.
          disabled={mes >= mesActualISO()}
        >
          ›
        </button>
      </div>

      {cargando && <p className="texto-tenue">Cargando...</p>}

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

      {!cargando && !errorCarga && datos && (
        <>
          <section className="tarjeta">
            <h2 className="subtitulo">Balance del mes</h2>
            <dl className="lista-datos">
              <div>
                <dt>Ingresos</dt>
                <dd className="monto-positivo">{formatearGs(datos.balance.ingresos)}</dd>
              </div>
              <div>
                <dt>Egresos</dt>
                <dd className="monto-negativo">{formatearGs(datos.balance.egresos)}</dd>
              </div>
              <div className="lista-datos-total">
                <dt>Resultado</dt>
                <dd className={datos.balance.resultado >= 0 ? 'monto-positivo' : 'monto-negativo'}>
                  {formatearGs(datos.balance.resultado)}
                </dd>
              </div>
            </dl>
          </section>

          {datos.movimientos.length === 0 ? (
            <div className="tarjeta">
              <h2 className="subtitulo">Sin movimientos</h2>
              <p className="texto-tenue">
                No hay nada cargado en {formatearMes(mes).toLowerCase()}. Los
                ingresos van a aparecer solos cuando se cobren las ventas.
              </p>
            </div>
          ) : (
            <ul className="lista">
              {datos.movimientos.map((m) => (
                <li key={m.id} className="lista-fila">
                  <div className="lista-fila-datos">
                    <p className="lista-fila-titulo">
                      <span className={m.tipo === 'ingreso' ? 'monto-positivo' : 'monto-negativo'}>
                        {m.tipo === 'ingreso' ? '+' : '−'} {formatearGs(m.monto)}
                      </span>
                    </p>
                    <p className="texto-tenue">
                      {m.categoriaNombre} · {formatearFecha(m.fecha)}
                    </p>
                    {m.descripcion && <p className="texto-tenue">{m.descripcion}</p>}
                  </div>

                  {/* Solo los cargados a mano se pueden anular desde acá. Los
                      automaticos se anulan desde la operacion que los genero,
                      asi el stock y la caja nunca quedan desfasados. */}
                  {m.origen?.tipo === 'manual' && (
                    <div className="lista-fila-acciones">
                      <button
                        className="boton-texto boton-texto--peligro"
                        onClick={() => setAAnular(m)}
                      >
                        Anular
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {formulario && (
        <div className="overlay" onClick={cerrar}>
          <form
            className="tarjeta overlay-panel"
            onClick={(e) => e.stopPropagation()}
            onSubmit={guardar}
          >
            <h2 className="subtitulo">Nuevo gasto</h2>

            <CampoSelect
              etiqueta="Categoria"
              placeholder="Elegi una..."
              value={formulario.categoriaId}
              onChange={(e) => setFormulario({ ...formulario, categoriaId: e.target.value })}
              opciones={[
                ...categorias.map((c) => ({ valor: c.id, texto: c.nombre })),
                { valor: NUEVA, texto: '+ Nueva categoria' },
              ]}
              error={erroresCampo.categoriaId}
              required
            />

            {formulario.categoriaId === NUEVA && (
              <CampoTexto
                etiqueta="Nombre de la categoria nueva"
                value={nombreCategoriaNueva}
                onChange={(e) => setNombreCategoriaNueva(e.target.value)}
                error={erroresCampo.nombre}
                autoFocus
                required
              />
            )}

            <InputGs
              etiqueta="Monto"
              value={formulario.monto}
              onChange={(n) => setFormulario({ ...formulario, monto: n })}
              error={erroresCampo.monto}
            />

            <CampoTexto
              etiqueta="Fecha"
              type="date"
              value={formulario.fecha}
              onChange={(e) => setFormulario({ ...formulario, fecha: e.target.value })}
              error={erroresCampo.fecha}
            />

            <CampoTexto
              etiqueta="Nota (opcional)"
              value={formulario.descripcion}
              onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })}
              error={erroresCampo.descripcion}
            />

            {errorFormulario && (
              <p className="alerta" role="alert">
                {errorFormulario}
              </p>
            )}

            <div className="fila-botones">
              <BotonGrande variante="secundario" onClick={cerrar} ancho>
                Cancelar
              </BotonGrande>
              <BotonGrande type="submit" cargando={guardando} ancho>
                Guardar
              </BotonGrande>
            </div>
          </form>
        </div>
      )}

      {aAnular && (
        <Confirmacion
          titulo="Anular este gasto?"
          mensaje={`Se va a sacar ${formatearGs(aAnular.monto)} de ${aAnular.categoriaNombre} del balance. El registro queda guardado, marcado como anulado.`}
          textoConfirmar="Anular"
          cargando={anulando}
          onConfirmar={confirmarAnular}
          onCancelar={() => setAAnular(null)}
        />
      )}
    </div>
  );
}

export default Caja;
