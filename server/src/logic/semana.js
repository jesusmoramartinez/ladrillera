// -----------------------------------------------------------------------------
// semana.js — Las cuentas con fechas, sin que se meta ninguna zona horaria
// -----------------------------------------------------------------------------
// El plan (seccion 5.9) define la semana de trabajo asi:
//
//     LUNES a SABADO, se paga el sabado. No se trabaja domingo.
//
// Todo lo de acá son funciones puras sobre TEXTO "YYYY-MM-DD". Nunca se
// devuelve un objeto Date.
//
// POR QUE NO SE USA `new Date('2026-09-21')`
//
// Esa linea crea la medianoche en UTC. Paraguay esta 3 o 4 horas atras, asi
// que al leerla con getDate() en hora local te devuelve el DIA ANTERIOR. Es el
// bug de fechas mas comun que existe, y en este sistema significaria que la
// produccion de un dia cae en la semana equivocada y se le paga a alguien de
// menos.
//
// LO QUE SI SE USA: Date.UTC(anio, mes, dia) para construir, y los getters
// getUTC* para leer. Construyendo y leyendo siempre en UTC, la zona horaria de
// la maquina no entra nunca en la cuenta. El Date se usa solo como
// calculadora de dias, no como "momento en el tiempo".
// -----------------------------------------------------------------------------

const UN_DIA = 24 * 60 * 60 * 1000;

const FORMATO = /^\d{4}-\d{2}-\d{2}$/;

function validar(fechaISO) {
  if (typeof fechaISO !== 'string' || !FORMATO.test(fechaISO)) {
    throw new TypeError(`Fecha invalida: ${fechaISO}. Se espera "YYYY-MM-DD".`);
  }
}

/** "2026-09-21" -> numero de milisegundos UTC (solo para hacer cuentas). */
function aMilisegundos(fechaISO) {
  validar(fechaISO);
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia);
}

/** El camino de vuelta: milisegundos UTC -> "2026-09-21". */
function aTexto(ms) {
  const d = new Date(ms);
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mes}-${dia}`;
}

/**
 * Dia de la semana: 0 = domingo, 1 = lunes, ... 6 = sabado.
 * (Es la numeracion de JavaScript; se respeta para no inventar otra.)
 */
export function diaDeLaSemana(fechaISO) {
  return new Date(aMilisegundos(fechaISO)).getUTCDay();
}

export function esDomingo(fechaISO) {
  return diaDeLaSemana(fechaISO) === 0;
}

/** Suma (o resta, con negativo) dias a una fecha. */
export function sumarDias(fechaISO, dias) {
  return aTexto(aMilisegundos(fechaISO) + dias * UN_DIA);
}

/**
 * La SEMANA DE PAGO a la que pertenece una fecha: de lunes a sabado.
 *
 * El caso raro es el domingo. El plan dice que no se trabaja domingo, pero si
 * alguna vez se trabaja, el dato tiene que poder cargarse igual: la plata se
 * debe.
 *
 * DECISION: un domingo cuenta para la semana QUE EMPIEZA (el lunes siguiente),
 * no para la que termino. Motivo: la semana anterior se liquida el sabado, o
 * sea antes de ese domingo. Si el domingo cayera en la semana ya pagada, ese
 * trabajo quedaria sin cobrar o habria que reabrir una liquidacion cerrada.
 * Mandandolo hacia adelante, se paga el sabado siguiente, que es lo que
 * cualquiera esperaria.
 *
 * @param {string} fechaISO
 * @returns {{ inicio: string, fin: string }} lunes y sabado
 */
export function semanaDePago(fechaISO) {
  const dia = diaDeLaSemana(fechaISO);

  // Domingo (0): la semana arranca manana.
  // Lunes a sabado (1..6): hay que retroceder (dia - 1) dias hasta el lunes.
  const diasHastaElLunes = dia === 0 ? 1 : -(dia - 1);

  const inicio = sumarDias(fechaISO, diasHastaElLunes);
  const fin = sumarDias(inicio, 5); // lunes + 5 = sabado

  return { inicio, fin };
}

/** Atajo: solo el lunes. */
export function lunesDeLaSemana(fechaISO) {
  return semanaDePago(fechaISO).inicio;
}

/** Atajo: solo el sabado (el dia de pago). */
export function sabadoDeLaSemana(fechaISO) {
  return semanaDePago(fechaISO).fin;
}

/**
 * Los seis dias de la semana, de lunes a sabado.
 * Sirve para dibujar la grilla de la semana sin huecos.
 */
export function diasDeLaSemana(fechaISO) {
  const { inicio } = semanaDePago(fechaISO);
  return Array.from({ length: 6 }, (_, i) => sumarDias(inicio, i));
}

/**
 * Dice si una fecha esta dentro de un rango, inclusive.
 *
 * Se comparan TEXTOS, no fechas. En formato "YYYY-MM-DD" el orden alfabetico
 * coincide con el cronologico, asi que "<=" funciona tal cual. Es el mismo
 * truco que usa el balance mensual de la caja.
 */
export function estaEnRango(fechaISO, desde, hasta) {
  validar(fechaISO);
  return fechaISO >= desde && fechaISO <= hasta;
}

/** Nombre corto del dia, para las etiquetas de la pantalla. */
const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

export function nombreDelDia(fechaISO) {
  return NOMBRES_DIA[diaDeLaSemana(fechaISO)];
}
