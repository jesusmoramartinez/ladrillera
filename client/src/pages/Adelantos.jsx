// -----------------------------------------------------------------------------
// Adelantos.jsx — Plata entregada a cuenta
// -----------------------------------------------------------------------------
// La pantalla mas simple del sistema: elegir empleado, escribir el monto,
// guardar. Y por eso mismo el formulario va DIRECTO en la pantalla, sin
// modal.
//
// El criterio: un modal tiene sentido cuando el formulario es largo o cuando
// interrumpe otra cosa (como el alta de ventas, que se abre desde una lista
// que el dueno estaba mirando). Acá el formulario ES la pantalla; meterlo
// adentro de un cartel agregaria un toque de mas para nada.
//
// Debajo, la semana: quien recibio cuanto. Agrupado por empleado y no solo
// como lista cronologica, porque la pregunta real del sabado es "¿cuanto le
// adelante a cada uno?", no "¿que paso el martes?".
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { BotonGrande } from '../components/BotonGrande.jsx';
import { CampoSelect } from '../components/CampoSelect.jsx';
import { CampoTexto } from '../components/CampoTexto.jsx';
import { Confirmacion } from '../components/Confirmacion.jsx';
import { InputGs } from '../components/InputGs.jsx';
import { listarEmpleados } from '../api/employees.js';
import { anularAdelanto, darAdelanto, obtenerSemana } from '../api/advances.js';
import {
  formatearFecha,
  formatearGs,
  hoyISO,
  nombreDelDia,
  rangoSemanaTexto,
  semanaDePago,
  sumarDias,
} from '../utils/format.js';

export function Adelantos() {
  const [employeeId, setEmployeeId] = useState('');
  const [monto, setMonto] = useState(0);
  const [fecha, setFecha] = useState(hoyISO);

  const [empleados, setEmpleados] = useState([]);
  const [semana, setSemana] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [recargas, setRecargas] = useState(0);

  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState('');
  const [erroresCampo, setErroresCampo] = useState({});

  // Error de una ACCION rechazada, separado del de carga: un "no se puede
  // anular, la semana ya se liquido" no tiene que borrar la lista que el
  // dueno esta mirando. (Mismo criterio que en Clientes.jsx y VentaDetalle.jsx.)
  const [errorAccion, setErrorAccion] = useState('');

  const [aAnular, setAAnular] = useState(null);
  const [anulando, setAnulando] = useState(false);

  // La semana que se esta mirando abajo. Arranca en la de hoy.
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

  function cambiarSemana(pasos) {
    setCargando(true);
    setErrorCarga('');
    setSemanaVista((actual) => sumarDias(actual, pasos * 7));
  }

  const puedeGuardar = employeeId && monto > 0 && !guardando;

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario('');
    setErroresCampo({});
    setErrorAccion('');

    try {
      await darAdelanto({ employeeId, monto, fecha });

      // Limpiamos monto y empleado, pero dejamos la fecha: si esta cargando
      // varios adelantos del mismo dia, no tiene que volver a elegirla.
      setMonto(0);
      setEmployeeId('');

      // Si el adelanto es de otra semana, saltamos ahi para que se vea.
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
    setErrorAccion('');
    try {
      await anularAdelanto(aAnular.id);
      setAAnular(null);
      recargar();
    } catch (error) {
      setErrorAccion(error.message);
      setAAnular(null);
    } finally {
      setAnulando(false);
    }
  }

  const empleadoElegido = empleados.find((e) => e.id === employeeId);

  return (
    <div className="pantalla">
      <h1 className="titulo">Adelantos</h1>

      <form className="tarjeta" onSubmit={guardar}>
        <CampoSelect
          etiqueta="Empleado"
          placeholder="Elegi a quien..."
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          opciones={empleados.map((e) => ({ valor: e.id, texto: e.nombre }))}
          error={erroresCampo.employeeId}
          ayuda={
            empleados.length === 0
              ? 'No hay empleados activos. Carga al menos uno en Mas → Empleados.'
              : undefined
          }
          required
        />

        <InputGs
          etiqueta="Monto"
          value={monto}
          onChange={setMonto}
          error={erroresCampo.monto}
        />

        <CampoTexto
          etiqueta="Fecha"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          error={erroresCampo.fecha}
          ayuda={`${nombreDelDia(fecha)} ${formatearFecha(fecha)}`}
          required
        />

        {errorFormulario && (
          <p className="alerta" role="alert">
            {errorFormulario}
          </p>
        )}

        <BotonGrande type="submit" cargando={guardando} disabled={!puedeGuardar} ancho>
          {empleadoElegido && monto > 0
            ? `Dar ${formatearGs(monto)} a ${empleadoElegido.nombre}`
            : 'Dar adelanto'}
        </BotonGrande>

        <p className="campo-ayuda">
          Sale de la caja en el acto, como egreso. El sabado se descuenta de lo
          que le toca cobrar.
        </p>
      </form>

      {errorAccion && (
        <p className="alerta" role="alert">
          {errorAccion}
        </p>
      )}

      <div className="selector-mes">
        <button
          className="boton-texto"
          onClick={() => cambiarSemana(-1)}
          aria-label="Semana anterior"
        >
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
          {semana.adelantos.length === 0 ? (
            <div className="tarjeta">
              <h2 className="subtitulo">Sin adelantos esta semana</h2>
              <p className="texto-tenue">
                Todavia no se entrego plata a cuenta en esta semana.
              </p>
            </div>
          ) : (
            <>
              <section className="tarjeta">
                <h2 className="subtitulo">Resumen de la semana</h2>
                <dl className="lista-datos">
                  {semana.resumen.porEmpleado.map((e) => (
                    <div key={e.employeeId}>
                      <dt>
                        {e.nombre}{' '}
                        <span className="campo-ayuda">
                          ({e.veces} {e.veces === 1 ? 'vez' : 'veces'})
                        </span>
                      </dt>
                      <dd>{formatearGs(e.monto)}</dd>
                    </div>
                  ))}
                  <div className="lista-datos-total">
                    <dt>Total adelantado</dt>
                    <dd className="monto-negativo">{formatearGs(semana.resumen.total)}</dd>
                  </div>
                </dl>
              </section>

              <ul className="lista">
                {semana.adelantos.map((adelanto) => (
                  <li key={adelanto.id} className="lista-fila">
                    <div className="lista-fila-datos">
                      <p className="lista-fila-titulo">
                        {formatearGs(adelanto.monto)}
                        <span className="etiqueta">{nombreDelDia(adelanto.fecha)}</span>
                      </p>
                      <p className="texto-tenue">
                        {adelanto.empleado?.nombre ?? 'Empleado eliminado'} ·{' '}
                        {formatearFecha(adelanto.fecha)}
                      </p>
                    </div>

                    <div className="lista-fila-acciones">
                      {adelanto.payrollId ? (
                        <span className="campo-ayuda">Semana ya liquidada</span>
                      ) : (
                        <button
                          className="boton-texto boton-texto--peligro"
                          onClick={() => setAAnular(adelanto)}
                        >
                          Anular
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {aAnular && (
        <Confirmacion
          titulo="Anular este adelanto?"
          mensaje={`Se anula el adelanto de ${formatearGs(aAnular.monto)} a ${
            aAnular.empleado?.nombre ?? 'el empleado'
          } y tambien su egreso en la caja. El registro queda guardado, marcado como anulado.`}
          textoConfirmar="Anular"
          cargando={anulando}
          onConfirmar={confirmarAnular}
          onCancelar={() => setAAnular(null)}
        />
      )}
    </div>
  );
}

export default Adelantos;
