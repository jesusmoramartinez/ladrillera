// -----------------------------------------------------------------------------
// inventory.js — Las cuentas del stock, en funciones puras
// -----------------------------------------------------------------------------
// Igual que money.js: entran numeros, salen numeros, no se toca la base.
//
// EL PROBLEMA QUE RESUELVE ESTE ARCHIVO
//
// La arcilla se compra por camion, pero se consume por ladrillo: cada 25.000
// ladrillos producidos se gasta 1 camion de arcilla pura y 1 de floja
// (plan, seccion 5.1). Producir 5.000 ladrillos gasta 0,2 camion de cada una.
//
// Si guardaramos "0,2 camiones" en la base tendriamos un problema serio. En
// JavaScript (y en casi todos los lenguajes) los decimales no son exactos:
//
//     0.1 + 0.2 === 0.30000000000000004      // true, lamentablemente
//
// Sumando y restando decimales cientos de veces, el stock se iria corriendo de
// a poquito y nadie sabria por que.
//
// LA SOLUCION: guardar la arcilla en "ladrillos-equivalentes", que son ENTEROS.
// Un camion son 25.000. En la pantalla se divide para mostrar "3,4 camiones",
// pero adentro siempre son enteros y las cuentas son exactas.
// -----------------------------------------------------------------------------

/** Los cuatro materiales que lleva el sistema (plan, seccion 4.7). */
export const MATERIALES = ['arcilla_pura', 'arcilla_floja', 'lena', 'ladrillos'];

/** Los que se miden en camiones y se guardan en ladrillos-equivalentes. */
export const MATERIALES_ARCILLA = ['arcilla_pura', 'arcilla_floja'];

/** Nombre lindo para mostrar. */
export const NOMBRES_MATERIAL = {
  arcilla_pura: 'Arcilla pura',
  arcilla_floja: 'Arcilla floja',
  lena: 'Lena',
  ladrillos: 'Ladrillos',
};

/** Por que cambio el stock (plan, seccion 4.8). */
export const MOTIVOS = [
  'compra',
  'produccion',
  'entrega',
  'uso_lena',
  'ajuste',
  'stock_inicial',
  'anulacion',
];

export function esMaterial(valor) {
  return MATERIALES.includes(valor);
}

export function esArcilla(material) {
  return MATERIALES_ARCILLA.includes(material);
}

/**
 * Camiones -> ladrillos-equivalentes (entero).
 *
 *   camionesALadrillos(1,   25000) -> 25000
 *   camionesALadrillos(0.2, 25000) ->  5000
 *   camionesALadrillos(1.5, 25000) -> 37500
 *
 * Se redondea porque el resultado tiene que ser entero si o si. Comprar
 * 0,333 camiones daria 8.325 ladrillos-equivalentes.
 *
 * @param {number} camiones
 * @param {number} ladrillosPorCamion  de settings (25.000 por defecto)
 */
export function camionesALadrillos(camiones, ladrillosPorCamion) {
  if (!Number.isFinite(camiones) || camiones < 0) {
    throw new TypeError(`Cantidad de camiones invalida: ${camiones}`);
  }
  if (!Number.isInteger(ladrillosPorCamion) || ladrillosPorCamion <= 0) {
    throw new TypeError(`ladrillosPorCamion invalido: ${ladrillosPorCamion}`);
  }
  return Math.round(camiones * ladrillosPorCamion);
}

/**
 * Ladrillos-equivalentes -> camiones, para mostrar en pantalla.
 * Devuelve decimal: 8500 / 25000 = 0,34 camiones.
 */
export function ladrillosACamiones(cantidad, ladrillosPorCamion) {
  if (!Number.isFinite(cantidad)) {
    throw new TypeError(`Cantidad invalida: ${cantidad}`);
  }
  if (!Number.isInteger(ladrillosPorCamion) || ladrillosPorCamion <= 0) {
    throw new TypeError(`ladrillosPorCamion invalido: ${ladrillosPorCamion}`);
  }
  return cantidad / ladrillosPorCamion;
}

/**
 * Arcilla disponible para producir (plan, seccion 5.5).
 *
 * Se necesitan LAS DOS arcillas al mismo tiempo, asi que lo que se puede
 * producir lo limita la que primero se acaba: es el MINIMO de las dos.
 *
 * @param {number} pura   en ladrillos-equivalentes
 * @param {number} floja  en ladrillos-equivalentes
 */
export function arcillaDisponible(pura, floja) {
  return Math.min(pura, floja);
}

/**
 * Decide si hay que mostrar la alerta roja de arcilla.
 *
 * Devuelve tambien CUAL falta, porque el aviso "comprar arcilla" sin decir
 * cual no le sirve de nada al dueno cuando va a la cantera.
 *
 * @returns {{ alerta: boolean, disponible: number, faltante: string[] }}
 */
export function alertaArcilla(pura, floja, umbral) {
  const disponible = arcillaDisponible(pura, floja);
  const alerta = disponible < umbral;

  const faltante = [];
  if (alerta) {
    // Si las dos estan por debajo, se avisan las dos.
    if (pura < umbral) faltante.push('arcilla_pura');
    if (floja < umbral) faltante.push('arcilla_floja');
  }

  return { alerta, disponible, faltante };
}

/**
 * Los tres numeros del stock de ladrillos (plan, seccion 5.7).
 *
 *   fisico       = lo que hay en el patio (producido - entregado)
 *   comprometido = suma de lo que falta entregar de todas las ventas activas
 *   libre        = fisico - comprometido   (PUEDE SER NEGATIVO, y esta bien:
 *                  significa que hay mas vendido que fabricado, y que hay que
 *                  reponer antes de las entregas)
 *
 * Hasta la fase 6 no existen las ventas, asi que comprometido llega siempre 0.
 */
export function stockLadrillos(fisico, comprometido = 0) {
  return {
    fisico,
    comprometido,
    libre: fisico - comprometido,
  };
}
