// -----------------------------------------------------------------------------
// VentaDetalle.jsx — Una venta por dentro
// -----------------------------------------------------------------------------
// Es la pantalla donde de verdad pasan las cosas: se cobra y se entrega.
//
// Arriba, el resumen: cuanto se cobro y cuanto falta, cuanto se entrego y
// cuanto falta. Abajo, los dos historiales. En el medio, dos botones.
//
// DOS DETALLES DE DISENO QUE PARECEN CHICOS Y NO LO SON:
//
//   1. El monto del pago viene PRECARGADO con lo que falta cobrar. El caso
//      normal es que el cliente salde la cuenta, y en ese caso no hay que
//      escribir nada: se abre, se confirma. Cuando paga una parte, se corrige.
//      Mismo criterio con la cantidad de la entrega.
//
//   2. Cobrar y entregar son dos botones SEPARADOS, aunque casi siempre pasen
//      juntos. Si fueran uno solo, registrar un pago sin entrega (o al reves)
//      obligaria a entrar a un menu escondido, y justamente esos son los casos
//      donde mas importa no equivocarse.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BotonGrande } from '../components/BotonGrande.jsx';
import { CampoTexto } from '../components/CampoTexto.jsx';
import { Confirmacion } from '../components/Confirmacion.jsx';
import { InputEntero } from '../components/InputEntero.jsx';
import { InputGs } from '../components/InputGs.jsx';
import {
  anularEntrega,
  anularPago,
  anularVenta,
  obtenerVenta,
  registrarEntrega,
  registrarPago,
} from '../api/sales.js';
import { formatearFecha, formatearGs, formatearNumero, hoyISO } from '../utils/format.js';

export function VentaDetalle() {
  // useParams lee el :id de la URL que definimos en App.jsx.
  const { id } = useParams();
  const navegar = useNavigate();

  const [venta, setVenta] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  // Error de una ACCION rechazada, no de la carga. Se muestra arriba sin
  // borrar la venta de la pantalla: el mensaje habla de lo que el dueno esta
  // mirando. (Mismo criterio que en Clientes.jsx.)
  const [errorAccion, setErrorAccion] = useState('');
  const [recargas, setRecargas] = useState(0);

  // 'pago' | 'entrega' | null
  const [formulario, setFormulario] = useState(null);
  const [valor, setValor] = useState(0);
  const [fecha, setFecha] = useState(hoyISO);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState('');
  const [aviso, setAviso] = useState('');

  // { tipo: 'pago'|'entrega'|'venta', id?, texto }
  const [aAnular, setAAnular] = useState(null);
  const [anulando, setAnulando] = useState(false);

  function recargar() {
    setRecargas((n) => n + 1);
  }

  useEffect(() => {
    let cancelado = false;

    obtenerVenta(id)
      .then((datos) => {
        if (!cancelado) setVenta(datos);
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
  }, [id, recargas]);

  function abrirPago() {
    setFormulario('pago');
    setValor(venta.porCobrar); // precargado con lo que falta
    setFecha(hoyISO());
    setErrorFormulario('');
    setAviso('');
  }

  function abrirEntrega() {
    setFormulario('entrega');
    setValor(venta.porEntregar);
    setFecha(hoyISO());
    setErrorFormulario('');
    setAviso('');
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario('');

    try {
      if (formulario === 'pago') {
        await registrarPago(id, { fecha, monto: valor });
      } else {
        const { aviso: avisoStock } = await registrarEntrega(id, { fecha, cantidad: valor });
        if (avisoStock?.aviso) {
          setAviso(
            `Entrega guardada. Segun el sistema habia ${formatearNumero(avisoStock.fisico)} ` +
              'ladrillos en el patio. Si el numero no coincide con la realidad, conviene hacer ' +
              'un ajuste de stock.',
          );
        }
      }
      setFormulario(null);
      recargar();
    } catch (error) {
      setErrorFormulario(error.message);
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarAnular() {
    setAnulando(true);
    setErrorAccion('');
    try {
      if (aAnular.tipo === 'pago') await anularPago(id, aAnular.id);
      else if (aAnular.tipo === 'entrega') await anularEntrega(id, aAnular.id);
      else {
        await anularVenta(id);
        navegar('/ventas');
        return;
      }
      setAAnular(null);
      recargar();
    } catch (error) {
      setErrorAccion(error.message);
      setAAnular(null);
    } finally {
      setAnulando(false);
    }
  }

  if (cargando) {
    return (
      <div className="pantalla">
        <p className="texto-tenue">Cargando venta...</p>
      </div>
    );
  }

  if (errorCarga || !venta) {
    return (
      <div className="pantalla">
        <div className="tarjeta">
          <p className="alerta" role="alert">
            {errorCarga || 'No se encontro la venta'}
          </p>
          <BotonGrande variante="secundario" onClick={() => navegar('/ventas')} ancho>
            Volver a Ventas
          </BotonGrande>
        </div>
      </div>
    );
  }

  const cerrada = venta.porCobrar === 0 && venta.porEntregar === 0;
  const limpia = venta.pagos.length === 0 && venta.entregas.length === 0;

  return (
    <div className="pantalla">
      <header className="cabecera">
        <h1 className="titulo">{venta.cliente?.nombre ?? 'Venta de mostrador'}</h1>
        <Link to="/ventas" className="boton-texto">
          Volver
        </Link>
      </header>

      <section className="tarjeta">
        <p className="texto-tenue">
          {formatearFecha(venta.fecha)} · {formatearNumero(venta.cantidad)} ladrillos ·{' '}
          lista {venta.listaPrecioNombre} a {formatearGs(venta.precioPorMil)} el millar
        </p>

        <dl className="lista-datos">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatearGs(venta.subtotal)}</dd>
          </div>
          {venta.descuentoGs > 0 && (
            <div>
              <dt>
                Descuento{' '}
                {venta.descuento?.tipo === 'porcentaje' && (
                  <span className="campo-ayuda">({venta.descuento.valor} %)</span>
                )}
              </dt>
              <dd className="monto-negativo">− {formatearGs(venta.descuentoGs)}</dd>
            </div>
          )}
          <div className="lista-datos-total">
            <dt>Total</dt>
            <dd>{formatearGs(venta.montoTotal)}</dd>
          </div>
        </dl>
      </section>

      {aviso && (
        <p className="alerta alerta--aviso" role="status">
          {aviso}
        </p>
      )}

      {errorAccion && (
        <p className="alerta" role="alert">
          {errorAccion}
        </p>
      )}

      {/* --- Cobro --- */}
      <section className="tarjeta">
        <h2 className="subtitulo">Cobro</h2>
        <dl className="lista-datos">
          <div>
            <dt>Cobrado</dt>
            <dd className="monto-positivo">{formatearGs(venta.cobrado)}</dd>
          </div>
          <div>
            <dt>Por cobrar</dt>
            <dd className={venta.porCobrar > 0 ? 'monto-negativo' : ''}>
              {formatearGs(venta.porCobrar)}
            </dd>
          </div>
        </dl>

        {venta.pagos.length > 0 && (
          <ul className="lista lista--compacta">
            {venta.pagos.map((pago) => (
              <li key={pago.id} className="lista-fila">
                <div className="lista-fila-datos">
                  <p className="lista-fila-titulo">{formatearGs(pago.monto)}</p>
                  <p className="texto-tenue">{formatearFecha(pago.fecha)}</p>
                </div>
                <div className="lista-fila-acciones">
                  <button
                    className="boton-texto boton-texto--peligro"
                    onClick={() =>
                      setAAnular({
                        tipo: 'pago',
                        id: pago.id,
                        texto: `Se anula el cobro de ${formatearGs(pago.monto)} y tambien su ingreso en la caja. La venta vuelve a figurar como pendiente por ese monto.`,
                      })
                    }
                  >
                    Anular
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {venta.porCobrar > 0 && (
          <BotonGrande onClick={abrirPago} ancho>
            + Registrar cobro
          </BotonGrande>
        )}
      </section>

      {/* --- Entrega --- */}
      <section className="tarjeta">
        <h2 className="subtitulo">Entrega</h2>
        <dl className="lista-datos">
          <div>
            <dt>Entregado</dt>
            <dd>{formatearNumero(venta.entregado)} ladrillos</dd>
          </div>
          <div>
            <dt>Por entregar</dt>
            <dd className={venta.porEntregar > 0 ? 'monto-negativo' : ''}>
              {formatearNumero(venta.porEntregar)} ladrillos
            </dd>
          </div>
        </dl>

        {venta.entregas.length > 0 && (
          <ul className="lista lista--compacta">
            {venta.entregas.map((entrega) => (
              <li key={entrega.id} className="lista-fila">
                <div className="lista-fila-datos">
                  <p className="lista-fila-titulo">
                    {formatearNumero(entrega.cantidad)} ladrillos
                  </p>
                  <p className="texto-tenue">{formatearFecha(entrega.fecha)}</p>
                </div>
                <div className="lista-fila-acciones">
                  <button
                    className="boton-texto boton-texto--peligro"
                    onClick={() =>
                      setAAnular({
                        tipo: 'entrega',
                        id: entrega.id,
                        texto: `Se anula la entrega de ${formatearNumero(entrega.cantidad)} ladrillos y vuelven al patio.`,
                      })
                    }
                  >
                    Anular
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {venta.porEntregar > 0 && (
          <BotonGrande onClick={abrirEntrega} ancho>
            + Registrar entrega
          </BotonGrande>
        )}
      </section>

      {cerrada && (
        <p className="texto-tenue">Esta venta esta cobrada y entregada por completo.</p>
      )}

      {/* Anular la venta entera solo aparece si esta limpia: con pagos o
          entregas el servidor lo rechaza, asi que mostrar el boton solo
          serviria para dar un error. */}
      {limpia && (
        <BotonGrande
          variante="peligro"
          ancho
          onClick={() =>
            setAAnular({
              tipo: 'venta',
              texto:
                'Se saca de la lista y deja de comprometer ladrillos. El registro queda guardado, marcado como anulado.',
            })
          }
        >
          Anular la venta
        </BotonGrande>
      )}

      {formulario && (
        <div className="overlay" onClick={() => setFormulario(null)}>
          <form
            className="tarjeta overlay-panel"
            onClick={(e) => e.stopPropagation()}
            onSubmit={guardar}
          >
            <h2 className="subtitulo">
              {formulario === 'pago' ? 'Registrar cobro' : 'Registrar entrega'}
            </h2>

            {formulario === 'pago' ? (
              <InputGs
                etiqueta="Monto cobrado"
                value={valor}
                onChange={setValor}
                ayuda={`Falta cobrar ${formatearGs(venta.porCobrar)}.`}
              />
            ) : (
              <InputEntero
                etiqueta="Cantidad entregada"
                sufijo="ladrillos"
                value={valor}
                onChange={setValor}
                ayuda={`Falta entregar ${formatearNumero(venta.porEntregar)}.`}
              />
            )}

            <CampoTexto
              etiqueta="Fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              ayuda={
                formulario === 'pago'
                  ? 'La caja suma el cobro por esta fecha, no por la de la venta.'
                  : undefined
              }
              required
            />

            {errorFormulario && (
              <p className="alerta" role="alert">
                {errorFormulario}
              </p>
            )}

            <div className="fila-botones">
              <BotonGrande variante="secundario" onClick={() => setFormulario(null)} ancho>
                Cancelar
              </BotonGrande>
              <BotonGrande type="submit" cargando={guardando} disabled={valor <= 0} ancho>
                Guardar
              </BotonGrande>
            </div>
          </form>
        </div>
      )}

      {aAnular && (
        <Confirmacion
          titulo="Anular?"
          mensaje={aAnular.texto}
          textoConfirmar="Anular"
          cargando={anulando}
          onConfirmar={confirmarAnular}
          onCancelar={() => setAAnular(null)}
        />
      )}
    </div>
  );
}

export default VentaDetalle;
