// -----------------------------------------------------------------------------
// money.js — Todas las cuentas de plata, en un solo lugar
// -----------------------------------------------------------------------------
// Esta carpeta (logic/) guarda FUNCIONES PURAS: reciben numeros, devuelven
// numeros, y no tocan la base ni internet ni la fecha de hoy. Eso las hace
// trivialmente testeables y, sobre todo, imposibles de romper por accidente
// desde otro lado.
//
// Regla del plan (seccion 5.3): el guarani NO tiene centavos, asi que TODO el
// dinero se guarda como ENTERO. Los redondeos se hacen en un unico lugar: este.
//
// Por que importa tener un solo lugar: si cada pantalla redondeara por su
// cuenta, la suma de las partes podria no dar el total. Con una sola funcion,
// todo el sistema redondea igual.
// -----------------------------------------------------------------------------

/**
 * El entero mas grande que JavaScript maneja con exactitud:
 * 9.007.199.254.740.991. En guaranies son nueve mil billones: sobra de sobra.
 * Mas alla de ese numero, JS empieza a perder precision en silencio, que es la
 * peor clase de error con plata.
 */
export const MONTO_MAXIMO = Number.MAX_SAFE_INTEGER;

/**
 * Redondea al guarani mas cercano.
 *
 * Math.round redondea 0,5 para arriba (2,5 -> 3). Es lo que espera cualquiera
 * que haga la cuenta a mano, asi que no lo cambiamos.
 *
 * @param {number} valor
 * @returns {number} entero
 */
export function redondearGs(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new TypeError(`No es un monto valido: ${valor}`);
  }
  return Math.round(valor);
}

/**
 * Calcula cuanto corresponde por una cantidad, dado un precio "por cada 1.000".
 *
 * Se usa en dos lugares del sistema:
 *   - Produccion: cuanto cobra un empleado por los ladrillos del dia
 *     (cantidad x tarifaPorMil / 1000).
 *   - Ventas: el subtotal segun la lista de precios.
 *
 * Es PROPORCIONAL tambien para menos de 1.000, como pide el plan (5.7):
 *   500 ladrillos a 800.000 el millar -> 400.000
 *
 * @param {number} cantidad      ladrillos
 * @param {number} precioPorMil  guaranies por cada 1.000 ladrillos
 * @returns {number} entero en guaranies
 */
export function montoPorMil(cantidad, precioPorMil) {
  if (!Number.isFinite(cantidad) || cantidad < 0) {
    throw new TypeError(`Cantidad invalida: ${cantidad}`);
  }
  if (!Number.isFinite(precioPorMil) || precioPorMil < 0) {
    throw new TypeError(`Precio invalido: ${precioPorMil}`);
  }
  // Multiplicamos ANTES de dividir. Al reves (cantidad / 1000 primero) se
  // arrastra el error de coma flotante de JavaScript y el resultado puede
  // diferir en un guarani.
  return redondearGs((cantidad * precioPorMil) / 1000);
}

/**
 * Dice si un valor sirve como monto en guaranies para guardar en la base:
 * entero, no negativo y dentro del rango exacto de JavaScript.
 *
 * @param {unknown} valor
 * @returns {boolean}
 */
export function esMontoGsValido(valor) {
  return Number.isSafeInteger(valor) && valor >= 0;
}
