// -----------------------------------------------------------------------------
// Liquidacion.jsx — El sabado a la tarde
// -----------------------------------------------------------------------------
// Es la pantalla mas delicada del sistema, porque de acá sale la plata que
// cobra cada persona. Todo lo de abajo esta pensado para que sea muy dificil
// apretar el boton equivocado.
//
// TRES DECISIONES:
//
//   1. Cada empleado muestra la cuenta ENTERA, no solo el neto. Bruto,
//      adelantos y deuda anterior, cada uno en su linea. Si el empleado
//      pregunta "¿por que cobro esto?", la respuesta esta en la pantalla y no
//      hay que reconstruirla de memoria.
//
//   2. "Marcar pagado" pide confirmacion Y dice el total en guaranies. Es una
//      accion que no se puede deshacer: despues de pagarla, las producciones y
//      los adelantos de esa semana quedan trabados para siempre.
//
//   3. Una vez pagada, la pantalla cambia de tono: desaparece el boton y
//      aparecen los tickets. Ya no hay nada que decidir, solo algo que
//      repartir.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { BotonGrande } from '../components/BotonGrande.jsx';
import { Confirmacion } from '../components/Confirmacion.jsx';
import { Ticket } from '../components/Ticket.jsx';
import { marcarPagada, obtenerPreview } from '../api/payrolls.js';
import {
  formatearGs,
  formatearNumero,
  hoyISO,
  rangoSemanaTexto,
  semanaDePago,
  sumarDias,
} from '../utils/format.js';

export function Liquidacion() {
  const [semanaVista, setSemanaVista] = useState(() => semanaDePago(hoyISO()).inicio);

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [errorAccion, setErrorAccion] = useState('');
  const [recargas, setRecargas] = useState(0);

  const [confirmando, setConfirmando] = useState(false);
  const [pagando, setPagando] = useState(false);

  // El empleado cuyo ticket se esta mirando, o null.
  const [ticketDe, setTicketDe] = useState(null);

  function recargar() {
    setRecargas((n) => n + 1);
  }

  useEffect(() => {
    let cancelado = false;

    obtenerPreview(semanaVista)
      .then((r) => {
        if (!cancelado) setDatos(r);
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
    setErrorAccion('');
    setSemanaVista((actual) => sumarDias(actual, pasos * 7));
  }

  async function confirmarPago() {
    setPagando(true);
    setErrorAccion('');
    try {
      await marcarPagada(semanaVista);
      setConfirmando(false);
      recargar();
    } catch (error) {
      setErrorAccion(error.message);
      setConfirmando(false);
    } finally {
      setPagando(false);
    }
  }

  const pagada = datos?.estado === 'pagada';
  const hayAlgo = (datos?.detalle?.length ?? 0) > 0;

  return (
    <div className="pantalla">
      <h1 className="titulo">Liquidacion</h1>

      <div className="selector-mes">
        <button
          className="boton-texto"
          onClick={() => cambiarSemana(-1)}
          aria-label="Semana anterior"
        >
          ‹
        </button>
        <span className="selector-mes-texto">
          {datos ? rangoSemanaTexto(datos.semana) : '...'}
        </span>
        <button
          className="boton-texto"
          onClick={() => cambiarSemana(1)}
          aria-label="Semana siguiente"
          disabled={datos ? datos.semana.inicio >= semanaDePago(hoyISO()).inicio : true}
        >
          ›
        </button>
      </div>

      {errorAccion && (
        <p className="alerta" role="alert">
          {errorAccion}
        </p>
      )}

      {cargando && <p className="texto-tenue">Calculando la semana...</p>}

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

      {!cargando && !errorCarga && !hayAlgo && (
        <div className="tarjeta">
          <h2 className="subtitulo">Nada que liquidar</h2>
          <p className="texto-tenue">
            En esta semana no hay produccion cargada, ni adelantos, ni deudas
            arrastradas de semanas anteriores.
          </p>
        </div>
      )}

      {!cargando && !errorCarga && hayAlgo && (
        <>
          {pagada && (
            <p className="alerta alerta--pagada" role="status">
              Semana liquidada. Las producciones y los adelantos de estos dias
              ya no se pueden anular.
            </p>
          )}

          <ul className="lista">
            {datos.detalle.map((e) => (
              <li key={e.employeeId} className="tarjeta tarjeta--empleado">
                <div className="cabecera">
                  <h2 className="subtitulo">{e.nombre}</h2>
                  {pagada && (
                    <button
                      className="boton-texto"
                      onClick={() => setTicketDe(e)}
                      aria-label={`Ver el ticket de ${e.nombre}`}
                    >
                      Ticket
                    </button>
                  )}
                </div>

                {/* La cuenta entera, no solo el resultado. Si el empleado
                    pregunta "¿por que cobro esto?", esta todo a la vista. */}
                <dl className="lista-datos">
                  <div>
                    <dt>
                      Produccion{' '}
                      <span className="campo-ayuda">
                        ({formatearNumero(e.ladrillos)} ladrillos)
                      </span>
                    </dt>
                    <dd>{formatearGs(e.bruto)}</dd>
                  </div>

                  {e.adelantos > 0 && (
                    <div>
                      <dt>Adelantos</dt>
                      <dd className="monto-negativo">− {formatearGs(e.adelantos)}</dd>
                    </div>
                  )}

                  {e.deudaAnterior > 0 && (
                    <div>
                      <dt>Saldo anterior</dt>
                      <dd className="monto-negativo">− {formatearGs(e.deudaAnterior)}</dd>
                    </div>
                  )}

                  <div className="lista-datos-total">
                    <dt>A cobrar</dt>
                    <dd className={e.neto > 0 ? 'monto-positivo' : ''}>
                      {formatearGs(e.neto)}
                    </dd>
                  </div>
                </dl>

                {/* El caso incomodo, explicado. Un "A cobrar: Gs 0" sin
                    explicacion genera una discusion el sabado a la tarde. */}
                {e.deudaNueva > 0 && (
                  <p className="campo-ayuda">
                    Queda un saldo de {formatearGs(e.deudaNueva)} que se
                    descuenta la semana que viene.
                  </p>
                )}
              </li>
            ))}
          </ul>

          <div className="tarjeta">
            <dl className="lista-datos">
              <div className="lista-datos-total">
                <dt>Total a pagar</dt>
                <dd>{formatearGs(datos.totalAPagar)}</dd>
              </div>
            </dl>

            {pagada ? (
              <p className="campo-ayuda">
                Ya salio de la caja como egreso de sueldos. Toca "Ticket" en
                cada uno para mandarle el detalle por WhatsApp.
              </p>
            ) : (
              <>
                <BotonGrande onClick={() => setConfirmando(true)} ancho>
                  Marcar pagado
                </BotonGrande>
                <p className="campo-ayuda">
                  Genera el egreso de sueldos y cierra la semana. Los adelantos
                  no se suman: esa plata ya salio de la caja cuando se dio.
                </p>
              </>
            )}
          </div>
        </>
      )}

      {confirmando && (
        <Confirmacion
          titulo={`Pagar ${formatearGs(datos.totalAPagar)}?`}
          mensaje={`Se registra el egreso de sueldos por ${formatearGs(
            datos.totalAPagar,
          )} y la semana queda cerrada. Despues de esto, las producciones y los adelantos de estos dias ya no se pueden anular.`}
          textoConfirmar="Marcar pagado"
          variante="primario"
          cargando={pagando}
          onConfirmar={confirmarPago}
          onCancelar={() => setConfirmando(false)}
        />
      )}

      {ticketDe && (
        <Ticket
          payrollId={datos.payrollId}
          empleado={ticketDe}
          onCerrar={() => setTicketDe(null)}
        />
      )}
    </div>
  );
}

export default Liquidacion;
