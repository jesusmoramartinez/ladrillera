// -----------------------------------------------------------------------------
// sales.js — Las cuentas de una venta, en funciones puras
// -----------------------------------------------------------------------------
// Igual que money.js y inventory.js: entran numeros, salen numeros. No se toca
// la base, ni la fecha de hoy, ni internet. Eso las hace faciles de testear y
// imposibles de romper desde otro lado.
//
// EL CONCEPTO CENTRAL DE ESTA FASE: DATO DERIVADO vs DATO GUARDADO
//
// Una venta tiene tres momentos independientes (plan, seccion 5.7): se cierra,
// se cobra (en una o varias veces) y se entrega (en una o varias veces).
// Entonces uno estaria tentado de guardar un campo `estado` que diga
// "parcial", "pagado", etc.
//
// Y estaria MAL. Porque si se guarda, hay que acordarse de actualizarlo en
// CADA operacion: al pagar, al anular un pago, al entregar, al anular una
// entrega... y el dia que alguien se olvida en uno solo de esos caminos, el
// sistema empieza a mentir. Una venta figura como "pagada" cuando en realidad
// le anularon el pago.
//
// La regla es: **si un dato se puede calcular a partir de otros, no se guarda,
// se calcula**. Los pagos y las entregas SI se guardan (son hechos, nadie los
// puede deducir). El estado NO: sale de sumar los pagos. Calculado desde la
// verdad, nunca puede estar desactualizado.
//
// Lo que se paga en cambio es velocidad, pero acá es una suma de cinco
// numeros: gratis.
// -----------------------------------------------------------------------------

import { montoPorMil, redondearGs } from './money.js';

/** Los dos tipos de descuento que acepta el plan (seccion 5.7). */
export const TIPOS_DESCUENTO = ['porcentaje', 'monto'];

/** Los tres estados posibles, tanto de pago como de entrega. */
export const ESTADOS = ['pendiente', 'parcial', 'pagado'];
export const ESTADOS_ENTREGA = ['pendiente', 'parcial', 'entregado'];

// ---------------------------------------------------------------------------
// El precio de la venta
// ---------------------------------------------------------------------------

/**
 * Convierte el descuento elegido a guaranies.
 *
 * El dueno puede pedir el descuento de dos formas, y las dos son comunes en la
 * practica: "hacele un 10 %" o "sacale 500.000". Se aceptan las dos y el
 * sistema traduce.
 *
 * OJO con el orden de las operaciones en el porcentaje: se multiplica ANTES de
 * dividir, por el mismo motivo que en money.js. Dividir primero arrastra el
 * error de coma flotante y el descuento puede salir corrido por un guarani.
 *
 * @param {number} subtotal    guaranies, entero
 * @param {{tipo: string, valor: number}|null} descuento
 * @returns {number} guaranies, entero, entre 0 y subtotal
 */
export function calcularDescuentoGs(subtotal, descuento) {
  if (!descuento) return 0;

  const { tipo, valor } = descuento;

  if (tipo === 'porcentaje') {
    if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
      throw new TypeError(`Porcentaje invalido: ${valor}`);
    }
    return redondearGs((subtotal * valor) / 100);
  }

  if (tipo === 'monto') {
    if (!Number.isInteger(valor) || valor < 0) {
      throw new TypeError(`Monto de descuento invalido: ${valor}`);
    }
    // Un descuento mayor al subtotal daria un total negativo, o sea que la
    // fabrica le estaria pagando al cliente por llevarse ladrillos.
    if (valor > subtotal) {
      throw new TypeError('El descuento no puede ser mayor al subtotal');
    }
    return valor;
  }

  throw new TypeError(`Tipo de descuento desconocido: ${tipo}`);
}

/**
 * Las tres cifras de una venta (plan, seccion 5.7):
 *
 *   subtotal    = cantidad / 1000 x precioPorMil     (proporcional)
 *   descuentoGs = el descuento ya convertido
 *   montoTotal  = subtotal - descuentoGs
 *
 * Ejemplo del plan: 5.000 ladrillos, lista Mayorista a 1.000.000 el millar,
 * 10 % de descuento -> subtotal 5.000.000, descuento 500.000, total 4.500.000.
 *
 * ESTA CUENTA LA HACE EL SERVIDOR, SIEMPRE. La pantalla tambien la hace, pero
 * solo para mostrarla en vivo mientras se escribe; lo que se guarda es lo que
 * calcula el servidor. Si se confiara en el numero que manda el navegador,
 * cualquiera podria mandar un total de 1 Gs con un programa cualquiera.
 *
 * @param {object} p
 * @param {number} p.cantidad      ladrillos
 * @param {number} p.precioPorMil  guaranies por cada 1.000
 * @param {{tipo: string, valor: number}|null} [p.descuento]
 * @returns {{subtotal: number, descuentoGs: number, montoTotal: number}}
 */
export function calcularTotales({ cantidad, precioPorMil, descuento = null }) {
  const subtotal = montoPorMil(cantidad, precioPorMil);
  const descuentoGs = calcularDescuentoGs(subtotal, descuento);

  return {
    subtotal,
    descuentoGs,
    montoTotal: subtotal - descuentoGs,
  };
}

// ---------------------------------------------------------------------------
// Lo cobrado y lo entregado
// ---------------------------------------------------------------------------

/**
 * Suma un campo de una lista, salteando los anulados.
 *
 * Los pagos y las entregas se anulan con SOFT DELETE: la linea sigue adentro
 * de la venta, marcada con `deletedAt`. Entonces toda suma tiene que filtrar
 * primero, o un pago anulado seguiria contando como cobrado.
 *
 * Esta funcion existe justamente para que ese filtro no se pueda olvidar: es
 * el unico lugar del sistema donde se suman estas listas.
 *
 * @param {Array<object>} lista
 * @param {string} campo  'monto' para pagos, 'cantidad' para entregas
 */
export function sumarVigentes(lista, campo) {
  if (!Array.isArray(lista)) return 0;

  return lista.reduce((total, item) => {
    if (item?.deletedAt) return total;
    const valor = item?.[campo] ?? 0;
    return total + (Number.isFinite(valor) ? valor : 0);
  }, 0);
}

/**
 * En que estado de cobro esta la venta.
 *
 * El orden de los `if` importa: primero se pregunta si esta saldada. Una venta
 * con 100 % de descuento tiene montoTotal 0 y cobrado 0; preguntando primero
 * por el cero diria "pendiente" para siempre, y quedaria eternamente en la
 * lista de deudores por una deuda de cero guaranies.
 */
export function estadoDePago(montoTotal, cobrado) {
  if (cobrado >= montoTotal) return 'pagado';
  if (cobrado <= 0) return 'pendiente';
  return 'parcial';
}

/** Lo mismo para los ladrillos. */
export function estadoDeEntrega(cantidad, entregado) {
  if (entregado >= cantidad) return 'entregado';
  if (entregado <= 0) return 'pendiente';
  return 'parcial';
}

/**
 * Todo lo derivado de una venta, de una sola pasada.
 *
 * Es la funcion que usa el modelo cada vez que convierte una venta a JSON, asi
 * que la pantalla SIEMPRE recibe estos numeros ya calculados y nunca tiene que
 * volver a sumar pagos por su cuenta.
 *
 * @param {{cantidad: number, montoTotal: number, pagos: Array, entregas: Array}} venta
 */
export function resumenVenta(venta) {
  const cobrado = sumarVigentes(venta.pagos, 'monto');
  const entregado = sumarVigentes(venta.entregas, 'cantidad');

  return {
    cobrado,
    // Math.max(0, ...) por prolijidad: las validaciones del servicio no dejan
    // cobrar de mas, pero si algun dia un bug lo permitiera, mejor mostrar
    // "por cobrar: 0" que "por cobrar: -50.000".
    porCobrar: Math.max(0, venta.montoTotal - cobrado),
    estadoPago: estadoDePago(venta.montoTotal, cobrado),

    entregado,
    porEntregar: Math.max(0, venta.cantidad - entregado),
    estadoEntrega: estadoDeEntrega(venta.cantidad, entregado),
  };
}

// ---------------------------------------------------------------------------
// Los avisos de stock (plan, seccion 5.7)
// ---------------------------------------------------------------------------
// Estos DOS casos avisan pero NO bloquean, y el motivo es distinto en cada uno:
//
//   - Vender mas que el LIBRE es una decision legitima del dueno: sabe que va
//     a producir mas antes de la fecha de entrega. Bloquearlo seria impedirle
//     tomar un pedido grande.
//
//   - Entregar mas que el FISICO significa que el numero del sistema no
//     coincide con el patio. El patio siempre gana: si los ladrillos se
//     cargaron en el camion, se cargaron. Bloquear la carga no devuelve los
//     ladrillos, solo impide registrar lo que ya paso.
//
// En los dos casos el aviso es informacion, no un permiso que hay que pedir.

/**
 * @param {number} cantidad  ladrillos que se quieren vender
 * @param {number} libre     fisico - comprometido
 * @returns {{aviso: boolean, libre: number, faltan: number}}
 */
export function avisoVentaSinStock(cantidad, libre) {
  return {
    aviso: cantidad > libre,
    libre,
    faltan: Math.max(0, cantidad - libre),
  };
}

/**
 * @param {number} cantidad  ladrillos que se quieren entregar
 * @param {number} fisico    lo que el sistema cree que hay en el patio
 */
export function avisoEntregaSinStock(cantidad, fisico) {
  return {
    aviso: cantidad > fisico,
    fisico,
    faltan: Math.max(0, cantidad - fisico),
  };
}
