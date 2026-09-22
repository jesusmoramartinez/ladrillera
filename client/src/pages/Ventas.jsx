// -----------------------------------------------------------------------------
// Ventas.jsx — La lista de ventas y el alta
// -----------------------------------------------------------------------------
// Tres pestanas y un boton. Las pestanas no son un adorno: son las tres
// preguntas que el dueno se hace de verdad.
//
//   Por cobrar   -> "quien me debe plata"
//   Por entregar -> "a quien le debo ladrillos"
//   Todas        -> el historial
//
// Las dos primeras son listas DISTINTAS y no dos filtros de la misma, porque
// una venta puede estar en las dos, en una sola o en ninguna. Un cliente que
// pago todo por adelantado no debe plata pero si espera ladrillos.
//
// EL FORMULARIO DE ALTA MUESTRA EL TOTAL EN VIVO
//
// Mientras se escribe la cantidad y se elige la lista, el total se va
// actualizando abajo. La cuenta esta duplicada: la hace esta pantalla para
// mostrarla, y la vuelve a hacer el servidor al guardar. Lo que se guarda es
// SIEMPRE lo del servidor; esto de acá es solo para que el dueno vea el precio
// antes de confirmar, sin esperar un viaje a la red por cada tecla.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BotonGrande } from '../components/BotonGrande.jsx';
import { CampoSelect } from '../components/CampoSelect.jsx';
import { CampoTexto } from '../components/CampoTexto.jsx';
import { InputEntero } from '../components/InputEntero.jsx';
import { InputGs } from '../components/InputGs.jsx';
import { listarListasPrecio } from '../api/caja.js';
import { listarClientes } from '../api/clients.js';
import { crearVenta, listarVentas } from '../api/sales.js';
import { obtenerStock } from '../api/inventory.js';
import { calcularTotales } from '../utils/ventas.js';
import { formatearFecha, formatearGs, formatearNumero, hoyISO } from '../utils/format.js';

const PESTANAS = [
  { clave: 'por-cobrar', texto: 'Por cobrar' },
  { clave: 'por-entregar', texto: 'Por entregar' },
  { clave: 'todas', texto: 'Todas' },
];

const SIN_DESCUENTO = 'ninguno';

function formularioVacio(listaPredeterminadaId) {
  return {
    fecha: hoyISO(),
    clientId: '',
    cantidad: 0,
    listaPrecioId: listaPredeterminadaId ?? '',
    tipoDescuento: SIN_DESCUENTO,
    valorDescuento: 0,
    pagadoCompleto: false,
    entregadoCompleto: false,
  };
}

export function Ventas() {
  // La pantalla de Clientes manda acá con ?cliente=<id>. Tener el filtro en la
  // URL y no en el estado tiene dos ventajas: el boton "atras" del celular
  // vuelve a la lista completa, y el link se puede guardar o compartir.
  const [parametros, setParametros] = useSearchParams();
  const clienteFiltrado = parametros.get('cliente') ?? '';

  // El Inicio (fase 9) manda acá con ?estado=por-cobrar o ?estado=por-entregar,
  // segun la tarjeta que se toco. Si llega uno de esos, se abre esa pestana.
  const estadoPedido = parametros.get('estado');
  const pestanaInicial = PESTANAS.some((p) => p.clave === estadoPedido)
    ? estadoPedido
    : // Con un cliente filtrado arrancamos en "Todas": el dueno entro a ver
      // TODO lo de esa persona, no solo lo que debe.
      clienteFiltrado
      ? 'todas'
      : 'por-cobrar';

  const [pestana, setPestana] = useState(pestanaInicial);

  const [ventas, setVentas] = useState([]);
  const [totales, setTotales] = useState({ porCobrar: 0, porEntregar: 0 });
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [recargas, setRecargas] = useState(0);

  // Datos que el formulario necesita y que no cambian seguido.
  const [clientes, setClientes] = useState([]);
  const [listas, setListas] = useState([]);
  const [stock, setStock] = useState(null);

  const [formulario, setFormulario] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState('');
  const [erroresCampo, setErroresCampo] = useState({});
  const [aviso, setAviso] = useState('');

  function recargar() {
    setCargando(true);
    setErrorCarga('');
    setRecargas((n) => n + 1);
  }

  useEffect(() => {
    let cancelado = false;

    const estado = pestana === 'todas' ? undefined : pestana;

    Promise.all([
      listarVentas({ estado, clientId: clienteFiltrado || undefined }),
      listarClientes(),
      listarListasPrecio(),
      obtenerStock(),
    ])
      .then(([lista, cls, lps, stk]) => {
        if (cancelado) return;
        setVentas(lista.ventas);
        setTotales(lista.totales);
        setClientes(cls);
        setListas(lps);
        setStock(stk);
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
  }, [pestana, recargas, clienteFiltrado]);

  function cambiarPestana(clave) {
    if (clave === pestana) return;
    setCargando(true);
    setErrorCarga('');
    setPestana(clave);
  }

  function abrirNueva() {
    const predeterminada = listas.find((l) => l.predeterminada) ?? listas[0];
    setFormulario(formularioVacio(predeterminada?.id));
    setErrorFormulario('');
    setErroresCampo({});
    setAviso('');
  }

  // --- La cuenta en vivo -----------------------------------------------------
  const listaElegida = listas.find((l) => l.id === formulario?.listaPrecioId);
  const descuento = armarDescuento(formulario);
  const cuenta = formulario
    ? calcularTotales({
        cantidad: formulario.cantidad,
        precioPorMil: listaElegida?.precioPorMil ?? 0,
        descuento,
      })
    : null;

  // El aviso de stock tambien se calcula acá, antes de guardar, para que el
  // dueno lo vea mientras escribe y no despues de confirmar.
  const libre = stock?.ladrillos?.libre ?? 0;
  const faltanLibres = formulario ? Math.max(0, formulario.cantidad - libre) : 0;

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario('');
    setErroresCampo({});
    setAviso('');

    try {
      const { aviso: avisoStock } = await crearVenta({
        fecha: formulario.fecha,
        clientId: formulario.clientId || null,
        cantidad: formulario.cantidad,
        listaPrecioId: formulario.listaPrecioId,
        descuento,
        pagadoCompleto: formulario.pagadoCompleto,
        entregadoCompleto: formulario.entregadoCompleto,
      });

      setFormulario(null);

      if (avisoStock?.aviso) {
        setAviso(
          `Venta guardada. Ojo: quedaban ${formatearNumero(avisoStock.libre)} ladrillos libres, ` +
            `asi que faltan ${formatearNumero(avisoStock.faltan)}. ` +
            'Ya estan vendidos a otros clientes; tenelos en cuenta antes de las entregas.',
        );
      }

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

  const puedeGuardar =
    formulario && formulario.cantidad > 0 && formulario.listaPrecioId && !guardando;

  const clienteDelFiltro = clientes.find((c) => c.id === clienteFiltrado);
  const resumenArriba = clienteFiltrado
    ? {
        porCobrar: clienteDelFiltro?.porCobrar ?? 0,
        porEntregar: clienteDelFiltro?.porEntregar ?? 0,
      }
    : totales;

  return (
    <div className="pantalla">
      <header className="cabecera">
        <h1 className="titulo">Ventas</h1>
        <BotonGrande onClick={abrirNueva} disabled={listas.length === 0}>
          + Nueva
        </BotonGrande>
      </header>

      {clienteFiltrado && (
        <div className="filtro-activo">
          <span>Solo {clienteDelFiltro?.nombre ?? 'un cliente'}</span>
          <button className="boton-texto" onClick={() => setParametros({})}>
            Ver todas
          </button>
        </div>
      )}

      {/* Con un cliente filtrado se muestra SU saldo, no el del sistema:
          dejar los totales generales arriba de una lista filtrada es la forma
          mas facil de leer mal un numero. */}
      <dl className="lista-datos tarjeta">
        <div>
          <dt>Por cobrar{clienteFiltrado ? '' : ' (todo)'}</dt>
          <dd className={resumenArriba.porCobrar > 0 ? 'monto-negativo' : ''}>
            {formatearGs(resumenArriba.porCobrar)}
          </dd>
        </div>
        <div>
          <dt>Por entregar{clienteFiltrado ? '' : ' (todo)'}</dt>
          <dd>{formatearNumero(resumenArriba.porEntregar)} ladrillos</dd>
        </div>
      </dl>

      {/* role="tablist" le dice al lector de pantalla que esto es un grupo de
          pestanas y no tres botones sueltos. */}
      <div className="pestanas" role="tablist" aria-label="Filtro de ventas">
        {PESTANAS.map((p) => (
          <button
            key={p.clave}
            role="tab"
            aria-selected={pestana === p.clave}
            className={`pestana${pestana === p.clave ? ' pestana--activa' : ''}`}
            onClick={() => cambiarPestana(p.clave)}
          >
            {p.texto}
          </button>
        ))}
      </div>

      {aviso && (
        <p className="alerta alerta--aviso" role="status">
          {aviso}
        </p>
      )}

      {cargando && <p className="texto-tenue">Cargando ventas...</p>}

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

      {!cargando && !errorCarga && ventas.length === 0 && (
        <div className="tarjeta">
          <h2 className="subtitulo">{vacioTitulo(pestana)}</h2>
          <p className="texto-tenue">{vacioTexto(pestana)}</p>
        </div>
      )}

      {!cargando && !errorCarga && ventas.length > 0 && (
        <ul className="lista">
          {ventas.map((venta) => (
            <li key={venta.id} className="lista-fila">
              <Link to={`/ventas/${venta.id}`} className="lista-enlace">
                <span className="lista-fila-titulo">
                  {venta.cliente?.nombre ?? 'Mostrador'}
                  <EtiquetaEstado venta={venta} />
                </span>
                <span className="texto-tenue">
                  {formatearFecha(venta.fecha)} · {formatearNumero(venta.cantidad)} ladrillos ·{' '}
                  {formatearGs(venta.montoTotal)}
                </span>
                <span className="texto-tenue">
                  {venta.porCobrar > 0
                    ? `Debe ${formatearGs(venta.porCobrar)}`
                    : 'Cobrada'}
                  {' · '}
                  {venta.porEntregar > 0
                    ? `Faltan ${formatearNumero(venta.porEntregar)} ladrillos`
                    : 'Entregada'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {formulario && (
        <div className="overlay" onClick={() => setFormulario(null)}>
          <form
            className="tarjeta overlay-panel"
            onClick={(e) => e.stopPropagation()}
            onSubmit={guardar}
          >
            <h2 className="subtitulo">Nueva venta</h2>

            <CampoSelect
              etiqueta="Cliente"
              placeholder="Mostrador (sin cliente)"
              value={formulario.clientId}
              onChange={(e) => setFormulario({ ...formulario, clientId: e.target.value })}
              opciones={clientes.map((c) => ({ valor: c.id, texto: c.nombre }))}
              error={erroresCampo.clientId}
              ayuda="Obligatorio si queda algo por cobrar o por entregar."
            />

            <InputEntero
              etiqueta="Cantidad"
              sufijo="ladrillos"
              value={formulario.cantidad}
              onChange={(n) => setFormulario({ ...formulario, cantidad: n })}
              error={erroresCampo.cantidad}
            />

            <CampoSelect
              etiqueta="Lista de precio"
              value={formulario.listaPrecioId}
              onChange={(e) => setFormulario({ ...formulario, listaPrecioId: e.target.value })}
              opciones={listas.map((l) => ({
                valor: l.id,
                texto: `${l.nombre} — ${formatearGs(l.precioPorMil)} el millar`,
              }))}
              error={erroresCampo.listaPrecioId}
              required
            />

            <CampoSelect
              etiqueta="Descuento"
              value={formulario.tipoDescuento}
              onChange={(e) =>
                setFormulario({ ...formulario, tipoDescuento: e.target.value, valorDescuento: 0 })
              }
              opciones={[
                { valor: SIN_DESCUENTO, texto: 'Sin descuento' },
                { valor: 'porcentaje', texto: 'Porcentaje (%)' },
                { valor: 'monto', texto: 'Monto fijo (Gs)' },
              ]}
            />

            {formulario.tipoDescuento === 'porcentaje' && (
              <CampoTexto
                etiqueta="Porcentaje"
                type="number"
                min="0"
                max="100"
                inputMode="decimal"
                value={String(formulario.valorDescuento)}
                onChange={(e) =>
                  setFormulario({ ...formulario, valorDescuento: Number(e.target.value) })
                }
                error={erroresCampo['descuento.valor']}
              />
            )}

            {formulario.tipoDescuento === 'monto' && (
              <InputGs
                etiqueta="Descuento en guaranies"
                value={formulario.valorDescuento}
                onChange={(n) => setFormulario({ ...formulario, valorDescuento: n })}
                error={erroresCampo['descuento.valor']}
              />
            )}

            {/* La cuenta en vivo. Se ve antes de guardar, no despues. */}
            {cuenta && formulario.cantidad > 0 && (
              <dl className="lista-datos">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatearGs(cuenta.subtotal)}</dd>
                </div>
                {cuenta.descuentoGs > 0 && (
                  <div>
                    <dt>Descuento</dt>
                    <dd className="monto-negativo">− {formatearGs(cuenta.descuentoGs)}</dd>
                  </div>
                )}
                <div className="lista-datos-total">
                  <dt>Total</dt>
                  <dd>{formatearGs(cuenta.montoTotal)}</dd>
                </div>
              </dl>
            )}

            {faltanLibres > 0 && (
              <p className="alerta alerta--aviso" role="status">
                Hay {formatearNumero(libre)} ladrillos libres: faltan{' '}
                {formatearNumero(faltanLibres)}. Se puede vender igual, pero hay que reponerlos
                antes de la entrega.
              </p>
            )}

            <label className="campo-checkbox">
              <input
                type="checkbox"
                checked={formulario.pagadoCompleto}
                onChange={(e) =>
                  setFormulario({ ...formulario, pagadoCompleto: e.target.checked })
                }
              />
              <span>
                Pagado completo
                <span className="campo-ayuda">Genera el ingreso de caja en el acto.</span>
              </span>
            </label>

            <label className="campo-checkbox">
              <input
                type="checkbox"
                checked={formulario.entregadoCompleto}
                onChange={(e) =>
                  setFormulario({ ...formulario, entregadoCompleto: e.target.checked })
                }
              />
              <span>
                Entregado completo
                <span className="campo-ayuda">Saca los ladrillos del patio en el acto.</span>
              </span>
            </label>

            <CampoTexto
              etiqueta="Fecha"
              type="date"
              value={formulario.fecha}
              onChange={(e) => setFormulario({ ...formulario, fecha: e.target.value })}
              error={erroresCampo.fecha}
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
              <BotonGrande type="submit" cargando={guardando} disabled={!puedeGuardar} ancho>
                Guardar venta
              </BotonGrande>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/** Convierte los dos campos del formulario al objeto que espera la API. */
function armarDescuento(formulario) {
  if (!formulario || formulario.tipoDescuento === SIN_DESCUENTO) return null;
  if (!formulario.valorDescuento) return null;
  return { tipo: formulario.tipoDescuento, valor: formulario.valorDescuento };
}

/** La etiqueta de estado: solo aparece si hay algo que decir. */
function EtiquetaEstado({ venta }) {
  if (venta.porCobrar === 0 && venta.porEntregar === 0) {
    return <span className="etiqueta">cerrada</span>;
  }
  if (venta.estadoPago === 'parcial' || venta.estadoEntrega === 'parcial') {
    return <span className="etiqueta etiqueta--aviso">parcial</span>;
  }
  return <span className="etiqueta etiqueta--aviso">pendiente</span>;
}

function vacioTitulo(pestana) {
  if (pestana === 'por-cobrar') return 'Nadie debe plata';
  if (pestana === 'por-entregar') return 'No hay ladrillos por entregar';
  return 'Todavia no hay ventas';
}

function vacioTexto(pestana) {
  if (pestana === 'por-cobrar') return 'Todas las ventas estan cobradas.';
  if (pestana === 'por-entregar') return 'Todas las ventas estan entregadas.';
  return 'Toca "+ Nueva" para cargar la primera. Si se cobra y se entrega en el acto, con marcar las dos casillas queda todo hecho de una.';
}

export default Ventas;
