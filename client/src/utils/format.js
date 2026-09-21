// -----------------------------------------------------------------------------
// format.js — Como se MUESTRAN los numeros y las fechas
// -----------------------------------------------------------------------------
// Todo lo visual pasa por aca. Adentro del programa, la plata siempre es un
// entero (1500000) y las fechas siempre son texto "2026-09-21". Estas funciones
// solo cambian como se ven en pantalla.
//
// Por que separar "el dato" de "como se ve": si guardaramos "1.500.000" como
// texto, cada suma tendria que limpiar los puntos primero, y tarde o temprano
// alguien se olvida.
// -----------------------------------------------------------------------------

// Intl.NumberFormat viene en el navegador, no hay que instalar nada. Con la
// configuracion de Paraguay ('es-PY') usa el punto como separador de miles:
// 1500000 -> "1.500.000"
//
// Se crea UNA sola vez, fuera de las funciones: armar un formateador es caro,
// y en una lista larga se armaria uno por fila.
const formateadorNumero = new Intl.NumberFormat('es-PY', {
  maximumFractionDigits: 0,
});

/**
 * 1500000 -> "1.500.000"
 * @param {number|null|undefined} valor
 */
export function formatearNumero(valor) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '';
  return formateadorNumero.format(valor);
}

/**
 * 1500000 -> "Gs 1.500.000"
 *
 * Se escribe el simbolo a mano en vez de usar { style: 'currency' } porque ese
 * modo agrega decimales ("Gs 1.500.000,00") y el guarani no tiene centavos.
 */
export function formatearGs(valor) {
  const numero = formatearNumero(valor);
  return numero === '' ? '' : `Gs ${numero}`;
}

/**
 * "1.500.000" (o "1500000", o "1.500.000 Gs") -> 1500000
 *
 * Saca todo lo que no sea digito. Devuelve 0 si no queda nada, asi el que la
 * llama nunca recibe NaN.
 */
export function parsearNumero(texto) {
  if (typeof texto === 'number') return Math.trunc(texto);
  if (!texto) return 0;

  const soloDigitos = String(texto).replace(/\D/g, '');
  if (soloDigitos === '') return 0;

  const numero = Number(soloDigitos);
  return Number.isSafeInteger(numero) ? numero : 0;
}

/**
 * "2026-09-21" -> "21/09/2026"
 *
 * OJO, ACA HAY UNA TRAMPA CLASICA. Uno estaria tentado de hacer:
 *
 *     new Date('2026-09-21').toLocaleDateString('es-PY')
 *
 * y esta MAL. JavaScript interpreta "2026-09-21" como medianoche en UTC.
 * Paraguay esta 3 o 4 horas atras, asi que esa medianoche UTC cae a las 20 o
 * 21 del DIA ANTERIOR, y la fecha se muestra corrida un dia.
 *
 * Como las fechas de negocio ya son texto (plan, seccion 5.4), la solucion mas
 * segura es no convertirlas a Date en ningun momento: partir el texto y listo.
 */
export function formatearFecha(fechaISO) {
  if (!fechaISO || typeof fechaISO !== 'string') return '';
  const [anio, mes, dia] = fechaISO.split('-');
  if (!anio || !mes || !dia) return fechaISO;
  return `${dia}/${mes}/${anio}`;
}

/**
 * La fecha de HOY en Paraguay, como "2026-09-21".
 *
 * El truco: el formato 'en-CA' (Canada en ingles) escribe las fechas como
 * "2026-09-21", que es exactamente el formato que necesitamos. Y `timeZone`
 * hace la conversion horaria correcta.
 *
 * Esto importa de verdad: si el dueno carga produccion a las 22 h, con la hora
 * del navegador en UTC ya seria el dia siguiente y el registro caeria en la
 * fecha equivocada.
 */
export function hoyISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Texto para una fecha completa (la que guarda Mongo en createdAt, deletedAt...).
 * "2026-09-21T03:25:14.351Z" -> "21/09/2026"
 */
export function formatearFechaHora(valorISO) {
  if (!valorISO) return '';
  const fecha = new Date(valorISO);
  if (Number.isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('es-PY', {
    timeZone: 'America/Asuncion',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(fecha);
}
