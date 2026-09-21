// -----------------------------------------------------------------------------
// Sale.js — Las ventas / pedidos (plan, seccion 4.6c)
// -----------------------------------------------------------------------------
// El documento mas rico del sistema. Una venta guarda QUE se vendio, A CUANTO,
// y adentro lleva dos listas: los pagos que se fueron cobrando y las entregas
// que se fueron haciendo.
//
//
// 1) SNAPSHOT vs REFERENCIA: cuando copiar un dato y cuando apuntarlo
//
// Fijate que la venta hace las dos cosas, y la diferencia no es un capricho:
//
//   precioPorMil, listaPrecioNombre  -> COPIA (snapshot)
//   clientId                         -> REFERENCIA (apunta al cliente)
//
// La pregunta que decide cual usar es: **si el original cambia manana, esta
// venta tendria que cambiar tambien?**
//
//   - El precio: NO. Si en octubre sube la lista Mayorista, la venta de
//     septiembre se hizo al precio de septiembre. Cambiarla seria falsear el
//     pasado. -> se copia.
//
//   - El nombre del cliente: SI. Si se cargo "Juan Peres" y era "Juan Perez",
//     corregirlo tiene que corregir todas sus ventas. -> se apunta.
//
// Copiar cuando habia que apuntar deja datos viejos desparramados que ya nadie
// puede corregir. Apuntar cuando habia que copiar reescribe la historia. Los
// dos errores son silenciosos, y por eso conviene pensarlo campo por campo.
//
//
// 2) LOS SUBDOCUMENTOS DE ACA SI LLEVAN _id
//
// En Production los trabajadores van con `_id: false`, porque nadie los
// referencia de a uno. Acá es al reves: la API tiene rutas como
// `DELETE /sales/:id/pagos/:pagoId`, o sea que cada pago necesita un nombre
// propio para poder anularlo. Por eso llevan su `_id` (que Mongoose pone solo).
//
//
// 3) LO QUE NO ESTA GUARDADO
//
// No hay campo `estado`, ni `cobrado`, ni `porEntregar`. Todo eso se calcula
// desde los pagos y las entregas cada vez que la venta se convierte a JSON
// (ver el transform de abajo y logic/sales.js). Un dato calculado no puede
// quedar desactualizado, y en esta fase eso es justo lo que mas importa.
// -----------------------------------------------------------------------------

import mongoose from 'mongoose';
import { MONTO_MAXIMO } from '../logic/money.js';
import { TIPOS_DESCUENTO, resumenVenta } from '../logic/sales.js';

const fechaDeNegocio = {
  type: String,
  required: true,
  match: [/^\d{4}-\d{2}-\d{2}$/, 'La fecha tiene que ser YYYY-MM-DD'],
};

// ---------------------------------------------------------------------------
// Sub-esquemas
// ---------------------------------------------------------------------------

/** Un cobro. Cada uno genero un ingreso de caja, y por eso lo apunta. */
const pagoSchema = new mongoose.Schema({
  fecha: fechaDeNegocio,
  monto: {
    type: Number,
    required: true,
    min: [1, 'El pago tiene que ser mayor a cero'],
    max: MONTO_MAXIMO,
    validate: { validator: Number.isInteger, message: 'El monto tiene que ser entero' },
  },
  // El movimiento de caja que se creo al registrar el pago. Al anular el pago
  // hay que anular ese movimiento, y sin este campo habria que adivinar cual
  // era.
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null,
  },
  deletedAt: { type: Date, default: null },
});

/** Una entrega de ladrillos. */
const entregaSchema = new mongoose.Schema({
  fecha: fechaDeNegocio,
  cantidad: {
    type: Number,
    required: true,
    min: [1, 'La entrega tiene que ser de al menos un ladrillo'],
    validate: { validator: Number.isInteger, message: 'La cantidad tiene que ser entera' },
  },
  // El movimiento de stock que saco los ladrillos del patio. Mismo motivo que
  // transactionId en los pagos.
  movimientoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryMovement',
    default: null,
  },
  deletedAt: { type: Date, default: null },
});

/**
 * El descuento elegido, tal cual lo pidio el dueno ("10 %" o "500.000").
 *
 * Se guarda ADEMAS de descuentoGs (que es el resultado en guaranies) para
 * poder contestar "por que esta venta salio 4.500.000?" un ano despues. Si
 * solo guardaramos el resultado, el "10 %" se perderia.
 */
const descuentoSchema = new mongoose.Schema(
  {
    tipo: { type: String, required: true, enum: TIPOS_DESCUENTO },
    valor: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

// ---------------------------------------------------------------------------
// El esquema principal
// ---------------------------------------------------------------------------

const saleSchema = new mongoose.Schema(
  {
    fecha: fechaDeNegocio,

    // null = venta de mostrador, cobrada y entregada en el acto. En cuanto
    // queda algo pendiente pasa a ser obligatorio, porque hay que saber a
    // quien reclamarle (esa regla la hace cumplir el servicio: depende de los
    // pagos y entregas, que el esquema no puede mirar).
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
    },

    cantidad: {
      type: Number,
      required: [true, 'La cantidad es obligatoria'],
      min: [1, 'Tiene que venderse al menos un ladrillo'],
      validate: {
        validator: Number.isInteger,
        message: 'La cantidad tiene que ser un numero entero de ladrillos',
      },
    },

    // --- SNAPSHOT de la lista de precio ---
    listaPrecioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PriceList',
      required: true,
    },
    listaPrecioNombre: { type: String, required: true, trim: true },
    precioPorMil: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'El precio tiene que ser entero' },
    },

    // --- Las tres cifras, calculadas por el servidor (logic/sales.js) ---
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      max: MONTO_MAXIMO,
      validate: { validator: Number.isInteger, message: 'El subtotal tiene que ser entero' },
    },
    descuento: { type: descuentoSchema, default: null },
    descuentoGs: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger, message: 'El descuento tiene que ser entero' },
    },
    montoTotal: {
      type: Number,
      required: true,
      min: 0,
      max: MONTO_MAXIMO,
      validate: { validator: Number.isInteger, message: 'El total tiene que ser entero' },
    },

    pagos: { type: [pagoSchema], default: [] },
    entregas: { type: [entregaSchema], default: [] },

    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        // Los derivados se calculan con las listas COMPLETAS: sumarVigentes ya
        // saltea los anulados por su cuenta. Tiene que ir ANTES de limpiar.
        Object.assign(ret, resumenVenta(ret));

        ret.pagos = soloVigentes(ret.pagos);
        ret.entregas = soloVigentes(ret.entregas);

        // Si la consulta uso .populate('clientId'), acá adentro no hay un id
        // sino el cliente entero. Lo separamos en dos campos para que la
        // pantalla no tenga que preguntarse que le llego.
        //
        // OJO con la comprobacion: un ObjectId de Mongo TIENE una propiedad
        // `.id` (es el buffer crudo), asi que `ret.clientId.id` daria algo
        // aunque no este populado. Por eso se pregunta por `.nombre`, que solo
        // existe si de verdad vino el cliente.
        if (ret.clientId?.nombre) {
          ret.cliente = ret.clientId;
          ret.clientId = ret.cliente.id ?? null;
        } else {
          ret.cliente = null;
        }

        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

/** Saca los anulados y les pone `id` en vez de `_id`, igual que a la venta. */
function soloVigentes(lineas) {
  if (!Array.isArray(lineas)) return [];
  return lineas
    .filter((linea) => !linea.deletedAt)
    .map(({ _id, ...resto }) => ({ id: _id, ...resto }));
}

// ---------------------------------------------------------------------------
// Consultas que resumen TODA la coleccion (agregaciones)
// ---------------------------------------------------------------------------
// Van como "statics" del modelo y no en un servicio, por un motivo concreto:
// quien las necesita es inventory.service (para el comprometido) y
// client.service (para los saldos). Si vivieran en sale.service, tendriamos
// inventory.service -> sale.service -> inventory.service: una importacion
// CIRCULAR, que en JavaScript no explota pero deja a medio cargar uno de los
// dos modulos y produce errores rarisimos de encontrar.
//
// Colgandolas del modelo, la flecha va siempre en la misma direccion
// (servicios -> modelos) y no hay ciclo posible.

/**
 * Construye la expresion de agregacion "suma este campo de esta lista,
 * salteando los anulados". Es la version en lenguaje de Mongo de
 * `sumarVigentes()` de logic/sales.js.
 *
 * Por que no traer las ventas y sumarlas en JavaScript: con mil ventas serian
 * mil documentos viajando por la red para devolver UN numero. La agregacion
 * hace la cuenta adentro de la base y devuelve solo el resultado.
 */
function sumaDeVigentes(lista, campo) {
  return {
    $sum: {
      $map: {
        input: {
          $filter: {
            input: { $ifNull: [`$${lista}`, []] },
            as: 'linea',
            cond: { $eq: [{ $ifNull: ['$$linea.deletedAt', null] }, null] },
          },
        },
        as: 'linea',
        in: `$$linea.${campo}`,
      },
    },
  };
}

const POR_COBRAR = {
  $max: [0, { $subtract: ['$montoTotal', sumaDeVigentes('pagos', 'monto')] }],
};

const POR_ENTREGAR = {
  $max: [0, { $subtract: ['$cantidad', sumaDeVigentes('entregas', 'cantidad')] }],
};

/**
 * Ladrillos COMPROMETIDOS: la suma de lo que falta entregar de todas las
 * ventas vigentes (plan, seccion 5.7).
 *
 * Recibe la `session` porque el stock se lee dentro de transacciones abiertas
 * por otros servicios, y una lectura fuera de la transaccion podria no ver lo
 * que esa misma transaccion acaba de escribir.
 */
saleSchema.statics.totalComprometido = async function totalComprometido(session) {
  const consulta = this.aggregate([
    { $match: { deletedAt: null } },
    { $project: { porEntregar: POR_ENTREGAR } },
    { $group: { _id: null, total: { $sum: '$porEntregar' } } },
  ]);

  if (session) consulta.session(session);

  const [fila] = await consulta;
  return fila?.total ?? 0;
};

/**
 * Cuanto debe y cuantos ladrillos espera cada cliente. Lo usa la pantalla de
 * Clientes para mostrar el saldo al lado de cada nombre.
 *
 * @returns {Promise<Array<{clientId, porCobrar, porEntregar, ventasPendientes}>>}
 */
saleSchema.statics.resumenPorCliente = async function resumenPorCliente() {
  return this.aggregate([
    { $match: { deletedAt: null, clientId: { $ne: null } } },
    { $project: { clientId: 1, porCobrar: POR_COBRAR, porEntregar: POR_ENTREGAR } },
    // Solo interesan las ventas que dejan algo pendiente; una venta cerrada y
    // entregada no aporta nada al saldo.
    { $match: { $or: [{ porCobrar: { $gt: 0 } }, { porEntregar: { $gt: 0 } }] } },
    {
      $group: {
        _id: '$clientId',
        porCobrar: { $sum: '$porCobrar' },
        porEntregar: { $sum: '$porEntregar' },
        ventasPendientes: { $sum: 1 },
      },
    },
  ]);
};

/**
 * Los ids de las ventas que tienen algo pendiente: plata por cobrar o
 * ladrillos por entregar.
 *
 * Sirve para las pestanas "Por cobrar" y "Por entregar" de la pantalla de
 * Ventas. Como esos numeros no estan guardados, Mongo no puede filtrarlos con
 * un find() comun: primero los calcula ($project), despues filtra por el
 * resultado ($match) y devuelve solo los ids.
 *
 * @param {'por-cobrar'|'por-entregar'} tipo
 * @param {object} [filtro]  condiciones extra ya listas para $match
 */
saleSchema.statics.idsConPendiente = async function idsConPendiente(tipo, filtro = {}) {
  const pendiente = tipo === 'por-cobrar' ? POR_COBRAR : POR_ENTREGAR;

  const filas = await this.aggregate([
    { $match: { deletedAt: null, ...filtro } },
    { $project: { pendiente } },
    { $match: { pendiente: { $gt: 0 } } },
  ]);

  return filas.map((fila) => fila._id);
};

/**
 * Los totales que van en el Inicio (fase 9) y arriba de la lista de ventas:
 * cuanta plata falta cobrar y cuantos ladrillos faltan entregar, en todo el
 * sistema.
 */
saleSchema.statics.totalesPendientes = async function totalesPendientes() {
  const [fila] = await this.aggregate([
    { $match: { deletedAt: null } },
    { $project: { porCobrar: POR_COBRAR, porEntregar: POR_ENTREGAR } },
    {
      $group: {
        _id: null,
        porCobrar: { $sum: '$porCobrar' },
        porEntregar: { $sum: '$porEntregar' },
      },
    },
  ]);

  return { porCobrar: fila?.porCobrar ?? 0, porEntregar: fila?.porEntregar ?? 0 };
};

// "Las ventas vigentes, de la mas nueva a la mas vieja".
saleSchema.index({ deletedAt: 1, fecha: -1 });
// "Las ventas de este cliente".
saleSchema.index({ clientId: 1, deletedAt: 1 });

export const Sale = mongoose.model('Sale', saleSchema);
export default Sale;
