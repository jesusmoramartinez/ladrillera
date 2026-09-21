// -----------------------------------------------------------------------------
// Produccion.jsx — La pantalla que mas se va a usar
// -----------------------------------------------------------------------------
// Es la carga de todos los dias: un numero, unos checkboxes y Guardar.
// Justamente por eso es la que mas merece que el camino sea corto.
//
// Tres decisiones de diseno:
//
//   1. La fecha viene puesta en HOY. En el 95 % de los casos es la correcta,
//      y cambiarla es un toque.
//
//   2. Mientras se marcan empleados, se muestra EN VIVO cuanto cobra cada uno.
//      El dueno ve el costo del dia antes de guardar, no despues.
//
//   3. Los empleados se marcan con checkbox, no se escriben. El plan
//      (seccion 7) lo pide: escribir parado en la fabrica es lento y se
//      cometen errores.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { BotonGrande } from '../components/BotonGrande.jsx';
import { Confirmacion } from '../components/Confirmacion.jsx';
import { InputEntero } from '../components/InputEntero.jsx';
import { listarEmpleados } from '../api/employees.js';
import { anularProduccion, cargarProduccion, obtenerSemana } from '../api/productions.js';
import {
  formatearFecha,
  formatearGs,
  formatearNumero,
  hoyISO,
  nombreDelDia,
  rangoSemanaTexto,
  semanaDePago,
  sumarDias,
} from '../utils/format.js';

/** Cuanto cobra alguien por N ladrillos. La misma cuenta que hace el servidor. */
function montoPorMil(cantidad, tarifaPorMil) {
  return Math.round((cantidad * tarifaPorMil) / 1000);
}

export function Produccion() {
  const [fecha, setFecha] = useState(hoyISO);
  const [cantidad, setCantidad] = useState(0);
  const [marcados, setMarcados] = useState(() => new Set());

  const [empleados, setEmpleados] = useState([]);
  const [semana, setSemana] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [recargas, setRecargas] = useState(0);

  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState('');
  const [erroresCampo, setErroresCampo] = useState({});
  const [aviso, setAviso] = useState('');

  const [aAnular, setAAnular] = useState(null);
  const [anulando, setAnulando] = useState(false);

  // La semana que se esta mirando abajo. Arranca en la de la fecha elegida.
  const [semanaVista, setSemanaVista] = useState(() => semanaDePago(hoyISO()).inicio);

  function recargar() {
    setRecargas((n) => n + 1);
  }

  useEffect(() => {
    let cancelado = false;

    Promise.all([listarEmpleados({ soloActivos: true }), obtenerSemana(semanaVista)])
      .then(([emps, sem]) => {
        if (cancelado) return;
        setEmpleados(emps);
        setSemana(sem);
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
  }, [semanaVista, recargas]);

  function alternar(id) {
    // Un Set nuevo en cada cambio: React compara por referencia, asi que
    // mutar el que ya existe no dispararia un re-render.
    setMarcados((actual) => {
      const copia = new Set(actual);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });
  }

  function cambiarSemana(pasos) {
    setCargando(true);
    setErrorCarga('');
    setSemanaVista((actual) => sumarDias(actual, pasos * 7));
  }

  const seleccionados = empleados.filter((e) => marcados.has(e.id));
  const manoDeObra = seleccionados.reduce(
    (suma, e) => suma + montoPorMil(cantidad, e.tarifaPorMil),
    0,
  );
  const puedeGuardar = cantidad > 0 && seleccionados.length > 0 && !guardando;

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario('');
    setErroresCampo({});
    setAviso('');

    try {
      const { stock } = await cargarProduccion({
        fecha,
        cantidad,
        employeeIds: [...marcados],
      });

      // Limpiamos para la proxima carga, pero dejamos la fecha: si esta
      // cargando varios dias atrasados, la va a querer mover de a uno.
      setCantidad(0);
      setMarcados(new Set());

      // El plan (5.7) pide avisar, no bloquear. El servidor ya guardo; acá
      // solo contamos como quedo.
      //
      // El disponible puede ser NEGATIVO: significa que se produjo mas de lo
      // que el sistema creia que habia. Decir "queda arcilla para -108.000
      // ladrillos" no se entiende, asi que el mensaje cambia segun el caso.
      const disponible = stock?.alertaArcilla?.disponible;
      if (stock?.alertaArcilla?.alerta) {
        setAviso(
          disponible < 0
            ? `Guardado. Ojo: el sistema quedo con arcilla en negativo (${formatearNumero(
                disponible,
              )}). O falta cargar una compra, o hay que hacer un ajuste de stock.`
            : `Guardado. Atencion: queda arcilla para ${formatearNumero(
                disponible,
              )} ladrillos. Conviene comprar.`,
        );
      }

      // Si se cargo un dia de otra semana, saltamos a esa semana para que se
      // vea lo que se acaba de guardar.
      const suSemana = semanaDePago(fecha).inicio;
      if (suSemana !== semanaVista) setSemanaVista(suSemana);
      else recargar();
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
      await anularProduccion(aAnular.id);
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
      <h1 className="titulo">Produccion</h1>

      <form className="tarjeta" onSubmit={guardar}>
        <div className="campo">
          <label className="campo-etiqueta" htmlFor="fecha-produccion">
            Dia
          </label>
          <input
            id="fecha-produccion"
            className={`campo-input${erroresCampo.fecha ? ' campo-input--error' : ''}`}
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
          <p className="campo-ayuda">
            {nombreDelDia(fecha)} {formatearFecha(fecha)}
          </p>
          {erroresCampo.fecha && <p className="campo-error">{erroresCampo.fecha}</p>}
        </div>

        <InputEntero
          etiqueta="Ladrillos producidos"
          sufijo="ladrillos"
          value={cantidad}
          onChange={setCantidad}
          error={erroresCampo.cantidad}
        />

        <div className="campo">
          <span className="campo-etiqueta">Quienes trabajaron</span>

          {empleados.length === 0 ? (
            <p className="campo-ayuda">
              No hay empleados activos. Carga al menos uno en Mas → Empleados.
            </p>
          ) : (
            <ul className="lista-checks">
              {empleados.map((empleado) => {
                const marcado = marcados.has(empleado.id);
                return (
                  <li key={empleado.id}>
                    <label className="campo-checkbox">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternar(empleado.id)}
                      />
                      <span className="check-contenido">
                        <span className="check-nombre">{empleado.nombre}</span>
                        {/* El calculo en vivo: se ve antes de guardar, no despues. */}
                        <span className={marcado && cantidad > 0 ? 'check-monto' : 'campo-ayuda'}>
                          {marcado && cantidad > 0
                            ? formatearGs(montoPorMil(cantidad, empleado.tarifaPorMil))
                            : `${formatearGs(empleado.tarifaPorMil)} por millar`}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {erroresCampo.employeeIds && (
            <p className="campo-error">{erroresCampo.employeeIds}</p>
          )}
        </div>

        {seleccionados.length > 0 && cantidad > 0 && (
          <dl className="lista-datos">
            <div className="lista-datos-total">
              <dt>Mano de obra del dia</dt>
              <dd>{formatearGs(manoDeObra)}</dd>
            </div>
          </dl>
        )}

        {errorFormulario && (
          <p className="alerta" role="alert">
            {errorFormulario}
          </p>
        )}

        <BotonGrande type="submit" cargando={guardando} disabled={!puedeGuardar} ancho>
          Guardar produccion
        </BotonGrande>

        <p className="campo-ayuda">
          Descuenta arcilla pura y floja, y suma los ladrillos al patio. Los
          sueldos se pagan el sabado, en la liquidacion.
        </p>
      </form>

      {aviso && (
        <p className="alerta alerta--aviso" role="status">
          {aviso}
        </p>
      )}

      <div className="selector-mes">
        <button className="boton-texto" onClick={() => cambiarSemana(-1)} aria-label="Semana anterior">
          ‹
        </button>
        <span className="selector-mes-texto">
          {semana ? rangoSemanaTexto(semana.semana) : '...'}
        </span>
        <button
          className="boton-texto"
          onClick={() => cambiarSemana(1)}
          aria-label="Semana siguiente"
          disabled={semana ? semana.semana.inicio >= semanaDePago(hoyISO()).inicio : true}
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

      {!cargando && !errorCarga && semana && (
        <>
          <section className="tarjeta">
            <h2 className="subtitulo">Resumen de la semana</h2>
            <dl className="lista-datos">
              <div>
                <dt>Ladrillos</dt>
                <dd>{formatearNumero(semana.resumen.totalLadrillos)}</dd>
              </div>
              <div>
                <dt>Mano de obra</dt>
                <dd>{formatearGs(semana.resumen.totalManoObra)}</dd>
              </div>
            </dl>

            {semana.resumen.porEmpleado.length > 0 && (
              <dl className="lista-datos">
                {semana.resumen.porEmpleado.map((e) => (
                  <div key={e.employeeId}>
                    <dt>
                      {e.nombre}{' '}
                      <span className="campo-ayuda">
                        ({e.dias} {e.dias === 1 ? 'dia' : 'dias'})
                      </span>
                    </dt>
                    <dd>{formatearGs(e.monto)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          {semana.producciones.length === 0 ? (
            <div className="tarjeta">
              <h2 className="subtitulo">Sin produccion esta semana</h2>
              <p className="texto-tenue">
                Todavia no se cargo ningun dia de esta semana.
              </p>
            </div>
          ) : (
            <ul className="lista">
              {semana.producciones.map((p) => (
                <li key={p.id} className="lista-fila">
                  <div className="lista-fila-datos">
                    <p className="lista-fila-titulo">
                      {formatearNumero(p.cantidad)} ladrillos
                      <span className="etiqueta">{nombreDelDia(p.fecha)}</span>
                    </p>
                    <p className="texto-tenue">
                      {formatearFecha(p.fecha)} ·{' '}
                      {p.trabajadores.map((t) => t.nombre).join(', ')}
                    </p>
                    <p className="texto-tenue">
                      Mano de obra:{' '}
                      {formatearGs(p.trabajadores.reduce((s, t) => s + t.monto, 0))}
                    </p>
                  </div>

                  <div className="lista-fila-acciones">
                    {p.payrollId ? (
                      <span className="campo-ayuda">Semana ya liquidada</span>
                    ) : (
                      <button
                        className="boton-texto boton-texto--peligro"
                        onClick={() => setAAnular(p)}
                      >
                        Anular
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {aAnular && (
        <Confirmacion
          titulo="Anular esta produccion?"
          mensaje={`Se devuelven ${formatearNumero(aAnular.cantidad)} de arcilla pura y floja al stock, y se sacan ${formatearNumero(aAnular.cantidad)} ladrillos del patio. El registro queda guardado, marcado como anulado.`}
          textoConfirmar="Anular"
          cargando={anulando}
          onConfirmar={confirmarAnular}
          onCancelar={() => setAAnular(null)}
        />
      )}
    </div>
  );
}

export default Produccion;
