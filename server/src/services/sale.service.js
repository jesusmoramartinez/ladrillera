// -----------------------------------------------------------------------------
// sale.service.js — Reglas de las ventas
// -----------------------------------------------------------------------------
// El archivo mas grande del sistema, porque una venta es la unica operacion
// que toca TODO: la caja, el stock, los clientes y las listas de precio.
//
// LA IDEA QUE ORDENA TODO ESTE ARCHIVO: TRES MOMENTOS INDEPENDIENTES
//
// El plan (seccion 5.7) lo dice en una tabla, y conviene tenerla a mano
// mientras se lee el codigo:
//
//   Accion            Caja                      Stock
//   ----------------  ------------------------  -------------------------
//   Crear la venta    nada                      nada fisico; sube el
//                                               COMPROMETIDO
//   Registrar pago    INGRESO por ese monto     nada
//   Registrar entrega nada                      FISICO menos la cantidad
//
// Los tres son independientes: se puede cobrar sin entregar, entregar sin
// cobrar, cobrar en tres veces y entregar en dos. Por eso son tres
// operaciones distintas y no un solo campo "estado" que se va moviendo.
//
// El "comprometido" no se guarda en ningun lado: es la suma de lo que falta
// entregar de todas las ventas vigentes, y lo calcula Sale.totalComprometido()
// con una agregacion. Crear una venta lo sube sin escribir nada de stock,
// porque el stock fisico no cambio: los ladrillos siguen en el patio, pero ya
// tienen dueno.
//
// EL CASO COMUN NO TIENE QUE SER EL MAS LARGO
//
// La venta tipica se cobra y se entrega en el acto. Por eso `crear()` acepta
// los atajos `pagadoCompleto` y `entregadoCompleto`: el dueno marca dos
// casillas y el sistema hace las tres operaciones en una sola transaccion. El
// camino de las tres pantallas separadas queda para los pedidos de verdad.
// -----------------------------------------------------------------------------

import mongoose from 'mongoose';
import { conTransaccion } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import { formatearGsSimple } from '../logic/money.js';
import {
  avisoEntregaSinStock,
  avisoVentaSinStock,
  calcularTotales,
  resumenVenta,
} from '../logic/sales.js';
import { CATEGORIAS_SISTEMA } from '../models/Category.js';
import { Client } from '../models/Client.js';
import { Sale } from '../models/Sale.js';
import * as inventoryService from './inventory.service.js';
import * as priceListService from './priceList.service.js';
import * as transactionService from './transaction.service.js';

const VIGENTES = { deletedAt: null };

/** Los campos del cliente que viajan junto a la venta. */
const CLIENTE_RESUMIDO = 'nombre telefono';

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

/**
 * Lista las ventas, con los filtros de la pantalla.
 *
 * ACA HAY UNA DIFICULTAD REAL: "por cobrar" y "por entregar" NO son campos
 * guardados. Son datos derivados (ver logic/sales.js), y Mongo no puede
 * filtrar por algo que no esta en el documento.
 *
 * Hay dos salidas posibles:
 *
 *   a) Traer todas las ventas y filtrarlas en JavaScript. Simple, pero con el
 *      tiempo serian miles de documentos viajando para mostrar diez.
 *
 *   b) Pedirle a Mongo que calcule el pendiente adentro de la base (una
 *      AGREGACION), quedarse con los ids que dan mayor a cero, y despues
 *      traer solo esos.
 *
 * Elegimos (b). Son dos consultas en vez de una, pero la primera devuelve solo
 * ids y la segunda solo las ventas que se van a mostrar. Y la cuenta la hace
 * la base, que para eso esta.
 *
 * @param {{ estado?: 'por-cobrar'|'por-entregar', clientId?: string, limite?: number }} opciones
 */
export async function listar({ estado, clientId, limite = 100 } = {}) {
  const filtro = { ...VIGENTES };

  // OJO: en una agregacion, Mongo NO convierte el texto del id a ObjectId
  // solo (en find() si lo hace). Hay que convertirlo a mano o el $match no
  // encuentra nada y no avisa: simplemente devuelve cero resultados, que es el
  // tipo de bug que cuesta horas.
  if (clientId) filtro.clientId = new mongoose.Types.ObjectId(String(clientId));

  if (estado) {
    const ids = await Sale.idsConPendiente(estado, filtro);
    if (ids.length === 0) return [];
    filtro._id = { $in: ids };
  }

  return Sale.find(filtro)
    .populate('clientId', CLIENTE_RESUMIDO)
    .sort({ fecha: -1, createdAt: -1 })
    .limit(Math.min(limite, 300));
}

/** La venta lista para mostrar, con el cliente adentro. */
export async function buscarPorId(id) {
  const venta = await Sale.findOne({ _id: id, ...VIGENTES }).populate(
    'clientId',
    CLIENTE_RESUMIDO,
  );
  if (!venta) throw new ApiError(404, 'La venta no existe');
  return venta;
}

/**
 * La venta SIN populate, para modificarla.
 *
 * Es una funcion aparte a proposito. Un documento con el cliente ya cargado
 * adentro funciona igual para leer, pero guardarlo mezcla dos cosas (el
 * documento y su relacion) y es una fuente clasica de sorpresas. Para escribir
 * usamos siempre el documento crudo, y recargamos con populate al devolver.
 */
async function buscarParaEditar(id) {
  const venta = await Sale.findOne({ _id: id, ...VIGENTES });
  if (!venta) throw new ApiError(404, 'La venta no existe');
  return venta;
}

/** Totales de todo el sistema: cuanto falta cobrar y cuantos ladrillos entregar. */
export async function totalesPendientes() {
  return Sale.totalesPendientes();
}

// ---------------------------------------------------------------------------
// Piezas internas: agregar un pago / agregar una entrega
// ---------------------------------------------------------------------------
// Las usan tanto `crear()` (para los atajos) como `registrarPago()` y
// `registrarEntrega()`. Estan escritas una sola vez para que el pago hecho
// desde el atajo y el pago hecho desde la pantalla de detalle sean
// EXACTAMENTE la misma cosa: mismo ingreso de caja, mismo origen, mismo todo.
//
// Las dos reciben la `session` y NO guardan la venta: eso lo hace quien las
// llama, cuando ya termino de tocarla. Asi una venta creada con los dos atajos
// se guarda una vez y no tres.

/** Texto que va a leer el dueno en la pantalla de Caja. */
function textoDeVenta(venta, nombreCliente) {
  const base = `Venta de ${venta.cantidad} ladrillos`;
  return nombreCliente ? `${base} a ${nombreCliente}` : base;
}

async function agregarPago(venta, { fecha, monto, nombreCliente }, session) {
  // push() devuelve el largo, no el subdocumento, asi que lo tomamos del final
  // del array. Mongoose ya le puso su _id al crearlo.
  venta.pagos.push({ fecha, monto });
  const pago = venta.pagos[venta.pagos.length - 1];

  const ingreso = await transactionService.crearIngresoDeSistema(
    {
      claveCategoria: CATEGORIAS_SISTEMA.VENTA,
      monto,
      fecha,
      descripcion: `Cobro ${formatearGsSimple(monto)} — ${textoDeVenta(venta, nombreCliente)}`,
      origenTipo: 'pago_venta',
      // El ingreso apunta al PAGO, no a la venta: una venta puede tener varios
      // pagos, y al anular uno hay que saber cual de los ingresos anular.
      origenId: pago._id,
    },
    session,
  );

  pago.transactionId = ingreso._id;
  return { pago, ingreso };
}

async function agregarEntrega(venta, { fecha, cantidad, nombreCliente }, session) {
  venta.entregas.push({ fecha, cantidad });
  const entrega = venta.entregas[venta.entregas.length - 1];

  // Los ladrillos salen del patio. El comprometido baja SOLO, porque se
  // calcula como "cantidad - entregado": al sumar una entrega, baja.
  const movimiento = await inventoryService.moverStock({
    material: 'ladrillos',
    cantidad: -cantidad,
    motivo: 'entrega',
    fecha,
    origen: { tipo: 'entrega_venta', id: entrega._id },
    descripcion: `Entrega de ${cantidad} — ${textoDeVenta(venta, nombreCliente)}`,
    session,
  });

  entrega.movimientoId = movimiento._id;
  return { entrega, movimiento };
}

/** El nombre del cliente, solo para los textos. Devuelve '' si no hay cliente. */
async function nombreDelCliente(clientId, session) {
  if (!clientId) return '';
  const cliente = await Client.findById(clientId).select('nombre').session(session ?? null);
  return cliente?.nombre ?? '';
}

// ---------------------------------------------------------------------------
// Crear la venta
// ---------------------------------------------------------------------------

/**
 * @param {object} p
 * @param {string} p.fecha
 * @param {string|null} [p.clientId]
 * @param {number} p.cantidad
 * @param {string} p.listaPrecioId
 * @param {{tipo: string, valor: number}|null} [p.descuento]
 * @param {boolean} [p.pagadoCompleto]
 * @param {boolean} [p.entregadoCompleto]
 */
export async function crear({
  fecha,
  clientId = null,
  cantidad,
  listaPrecioId,
  descuento = null,
  pagadoCompleto = false,
  entregadoCompleto = false,
}) {
  // 1) La lista de precio, que da el precio del snapshot.
  const lista = await priceListService.buscarPorId(listaPrecioId); // 404 si no existe

  // 2) Las cuentas, HECHAS ACA. La pantalla tambien las hace para mostrarlas
  //    en vivo, pero lo que se guarda es esto: el navegador puede mandar
  //    cualquier cosa, y un total que viene de afuera no es un total, es una
  //    sugerencia.
  let totales;
  try {
    totales = calcularTotales({ cantidad, precioPorMil: lista.precioPorMil, descuento });
  } catch (error) {
    // logic/ lanza TypeError; acá lo traducimos a un 400 con el texto del
    // problema, que es lo que tiene que ver el usuario.
    throw new ApiError(400, error.message);
  }

  // 3) Cliente obligatorio si queda algo pendiente (plan, seccion 5.7).
  //
  //    Fijate que se mira el resultado DESPUES de los atajos: una venta de
  //    mostrador cobrada y entregada en el acto no necesita cliente. En cuanto
  //    queda un peso sin cobrar o un ladrillo sin entregar, si: hay que saber
  //    a quien reclamarle.
  const quedaPorCobrar = pagadoCompleto ? 0 : totales.montoTotal;
  const quedaPorEntregar = entregadoCompleto ? 0 : cantidad;

  if ((quedaPorCobrar > 0 || quedaPorEntregar > 0) && !clientId) {
    throw new ApiError(
      400,
      'Esta venta deja algo pendiente, asi que hay que elegir el cliente.',
    );
  }

  const nombreCliente = clientId
    ? (await Client.findOne({ _id: clientId, ...VIGENTES }).select('nombre'))?.nombre
    : '';

  if (clientId && !nombreCliente) throw new ApiError(404, 'El cliente no existe');

  // 4) El aviso de stock, ANTES de guardar. Avisa, no bloquea (plan 5.7): el
  //    dueno puede estar tomando un pedido que va a producir la semana que
  //    viene. El aviso viaja en la respuesta y la pantalla lo muestra.
  const stockPrevio = await inventoryService.obtenerStock();
  const aviso = avisoVentaSinStock(cantidad, stockPrevio.ladrillos.libre);

  const venta = await conTransaccion(async (session) => {
    const [doc] = await Sale.create(
      [
        {
          fecha,
          clientId: clientId || null,
          cantidad,
          listaPrecioId: lista._id,
          listaPrecioNombre: lista.nombre, // snapshot
          precioPorMil: lista.precioPorMil, // snapshot
          ...totales,
          descuento,
        },
      ],
      { session },
    );

    // Los atajos. El pago se saltea si el total es cero (una venta 100 %
    // bonificada ya nace saldada, y un pago de 0 Gs no significa nada).
    if (pagadoCompleto && totales.montoTotal > 0) {
      await agregarPago(doc, { fecha, monto: totales.montoTotal, nombreCliente }, session);
    }
    if (entregadoCompleto) {
      await agregarEntrega(doc, { fecha, cantidad, nombreCliente }, session);
    }

    // Una sola escritura, aunque se hayan usado los dos atajos.
    if (pagadoCompleto || entregadoCompleto) await doc.save({ session });

    return doc;
  });

  return {
    venta: await buscarPorId(venta._id),
    aviso,
    stock: await inventoryService.obtenerStock(),
  };
}

// ---------------------------------------------------------------------------
// Pagos
// ---------------------------------------------------------------------------

/**
 * Registra un cobro. Genera el ingreso de caja del mismo monto y con la FECHA
 * DEL PAGO, no la de la venta.
 *
 * Eso ultimo no es un detalle: el balance del mes suma por fecha de pago (plan,
 * 5.7). Una venta de septiembre cobrada en octubre entra en octubre, porque es
 * cuando realmente entro la plata a la caja.
 */
export async function registrarPago(saleId, { fecha, monto }) {
  const venta = await buscarParaEditar(saleId);
  const { porCobrar } = resumenVenta(venta);

  // ESTA validacion SI bloquea (plan, 5.7). No es una opinion sobre el stock:
  // cobrar mas de lo que se debe es directamente un error de tipeo, y dejarlo
  // pasar ensuciaria la caja con plata que nunca entro.
  if (porCobrar <= 0) {
    throw new ApiError(409, 'Esta venta ya esta cobrada por completo.');
  }
  if (monto > porCobrar) {
    throw new ApiError(
      400,
      `No se puede cobrar mas de lo que falta: quedan ${formatearGsSimple(porCobrar)}.`,
    );
  }

  const nombreCliente = await nombreDelCliente(venta.clientId);

  await conTransaccion(async (session) => {
    await agregarPago(venta, { fecha, monto, nombreCliente }, session);
    await venta.save({ session });
  });

  return buscarPorId(saleId);
}

/**
 * Anula un pago: lo marca y anula su ingreso de caja.
 *
 * No se borra la linea. Queda adentro de la venta con `deletedAt`, y
 * `sumarVigentes()` la saltea al calcular lo cobrado. La plata "vuelve a
 * deberse" sola, sin tocar ningun total.
 */
export async function anularPago(saleId, pagoId) {
  const venta = await buscarParaEditar(saleId);

  // .id() de Mongoose busca un subdocumento por su _id adentro del array.
  const pago = venta.pagos.id(pagoId);
  if (!pago || pago.deletedAt) {
    throw new ApiError(404, 'El pago no existe o ya fue anulado');
  }

  await conTransaccion(async (session) => {
    pago.deletedAt = new Date();
    await transactionService.anularPorOrigen(
      { tipo: 'pago_venta', movimientoId: pago._id },
      session,
    );
    await venta.save({ session });
  });

  return buscarPorId(saleId);
}

// ---------------------------------------------------------------------------
// Entregas
// ---------------------------------------------------------------------------

/**
 * Registra una entrega: saca los ladrillos del patio.
 *
 * DOS VALIDACIONES QUE SE PARECEN Y SON OPUESTAS:
 *
 *   - Entregar mas de lo VENDIDO: bloquea. Es imposible por definicion; si el
 *     cliente se lleva mas, eso es otra venta.
 *
 *   - Entregar mas de lo que hay en el patio: NO bloquea, avisa. El numero del
 *     sistema puede estar desactualizado y el patio siempre tiene razon: si el
 *     camion ya cargo, ya cargo. Bloquear no devuelve los ladrillos, solo
 *     impide registrar lo que ya paso. El stock queda en negativo y eso es una
 *     senal clara de que hay que hacer un ajuste.
 */
export async function registrarEntrega(saleId, { fecha, cantidad }) {
  const venta = await buscarParaEditar(saleId);
  const { porEntregar } = resumenVenta(venta);

  if (porEntregar <= 0) {
    throw new ApiError(409, 'Esta venta ya se entrego por completo.');
  }
  if (cantidad > porEntregar) {
    throw new ApiError(
      400,
      `No se puede entregar mas de lo que falta: quedan ${porEntregar} ladrillos.`,
    );
  }

  const stockPrevio = await inventoryService.obtenerStock();
  const aviso = avisoEntregaSinStock(cantidad, stockPrevio.ladrillos.fisico);
  const nombreCliente = await nombreDelCliente(venta.clientId);

  await conTransaccion(async (session) => {
    await agregarEntrega(venta, { fecha, cantidad, nombreCliente }, session);
    await venta.save({ session });
  });

  return {
    venta: await buscarPorId(saleId),
    aviso,
    stock: await inventoryService.obtenerStock(),
  };
}

/** Anula una entrega: los ladrillos vuelven al patio. */
export async function anularEntrega(saleId, entregaId) {
  const venta = await buscarParaEditar(saleId);

  const entrega = venta.entregas.id(entregaId);
  if (!entrega || entrega.deletedAt) {
    throw new ApiError(404, 'La entrega no existe o ya fue anulada');
  }

  await conTransaccion(async (session) => {
    // Movimiento INVERSO, con la cantidad tomada de la entrega y no
    // recalculada: misma regla que en las compras y las producciones.
    await inventoryService.moverStock({
      material: 'ladrillos',
      cantidad: +entrega.cantidad,
      motivo: 'anulacion',
      fecha: entrega.fecha,
      origen: { tipo: 'anulacion_entrega', id: entrega._id },
      descripcion: `Anulacion de entrega de ${entrega.cantidad} ladrillos`,
      session,
    });

    entrega.deletedAt = new Date();
    await venta.save({ session });
  });

  return buscarPorId(saleId);
}

// ---------------------------------------------------------------------------
// Anular la venta entera
// ---------------------------------------------------------------------------

/**
 * Solo se puede anular una venta LIMPIA: sin pagos ni entregas vigentes
 * (plan, seccion 5.11).
 *
 * Se podria hacer que anulara todo en cascada, y seria mas comodo. Pero anular
 * una venta cobrada y entregada son tres cosas distintas pasando a la vez
 * (sale plata de la caja, vuelven ladrillos al patio, desaparece el pedido) y
 * conviene que el dueno las vea de a una y confirme cada una. Un boton que
 * deshace media jornada de un toque es un boton peligroso.
 */
export async function anular(saleId) {
  const venta = await buscarParaEditar(saleId);
  const { cobrado, entregado } = resumenVenta(venta);

  if (cobrado > 0 || entregado > 0) {
    const partes = [];
    if (cobrado > 0) partes.push('pagos');
    if (entregado > 0) partes.push('entregas');

    throw new ApiError(
      409,
      `Esta venta tiene ${partes.join(' y ')} registrados. ` +
        'Anulalos primero y despues anula la venta.',
    );
  }

  venta.deletedAt = new Date();
  await venta.save();
  return venta;
}
