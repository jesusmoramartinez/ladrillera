// -----------------------------------------------------------------------------
// telefono.js — Pasar un telefono paraguayo al formato que pide WhatsApp
// -----------------------------------------------------------------------------
// El dueno va a escribir el celular como lo escribe siempre:
//
//     0981 123 456       0981123456       (0981) 123-456
//     +595 981 123 456   595981123456     0981-123456
//
// Y el link de WhatsApp necesita una sola de esas formas: **solo digitos, con
// codigo de pais y sin el +**:
//
//     https://wa.me/595981123456
//
// Esta funcion hace esa traduccion. Es pura (entra texto, sale texto), asi que
// se puede probar con los diez formatos de una sentada.
//
//
// LA REGLA DEL CERO, QUE ES LO UNICO COMPLICADO
//
// En Paraguay los celulares se escriben con un 0 adelante: 0981. Ese cero es
// el "prefijo nacional": sirve para llamar DENTRO del pais y NO forma parte
// del numero. El numero de verdad es 981 123 456, y desde afuera se marca
// +595 981 123 456.
//
// O sea que al agregar el 595 hay que SACAR el cero. Si no, quedaria
// 5950981123456, que no es el numero de nadie, y WhatsApp abriria diciendo que
// el contacto no existe. Es un error silencioso y molesto: el link "funciona",
// solo que no llega.
// -----------------------------------------------------------------------------

/** Codigo de pais de Paraguay. */
export const CODIGO_PAIS = '595';

/**
 * Convierte un telefono escrito de cualquier forma al formato de WhatsApp.
 *
 * @param {string} texto
 * @returns {string|null} solo digitos con codigo de pais, o null si no sirve
 */
export function aFormatoWhatsApp(texto) {
  if (!texto || typeof texto !== 'string') return null;

  // 1) Fuera todo lo que no sea digito: espacios, guiones, parentesis y el +.
  let digitos = texto.replace(/\D/g, '');
  if (digitos === '') return null;

  // 2) Si ya viene con el codigo de pais, se respeta.
  //
  //    Cuidado con el caso "5950981...": alguien que escribio +595 y ADEMAS
  //    dejo el cero nacional. Se le saca ese cero igual.
  if (digitos.startsWith(CODIGO_PAIS)) {
    const resto = digitos.slice(CODIGO_PAIS.length);
    digitos = CODIGO_PAIS + resto.replace(/^0+/, '');
  } else {
    // 3) Si no, se le saca el cero nacional y se le pone el codigo de pais.
    digitos = CODIGO_PAIS + digitos.replace(/^0+/, '');
  }

  // 4) Control de cordura. Un celular paraguayo completo con codigo de pais
  //    tiene 12 digitos (595 + 9). Se acepta un rango un poco mas amplio para
  //    no rechazar un numero de linea baja o un extranjero, pero se descarta
  //    lo que claramente no es un telefono (un "123" cargado por error).
  if (digitos.length < 11 || digitos.length > 15) return null;

  return digitos;
}

/**
 * Dice si un telefono sirve para mandar un WhatsApp.
 * La pantalla la usa para saber si el boton va habilitado o no.
 */
export function sirveParaWhatsApp(texto) {
  return aFormatoWhatsApp(texto) !== null;
}

/**
 * El link completo que abre WhatsApp con el mensaje ya escrito.
 *
 * IMPORTANTE, Y NO ES UN DETALLE: esto **no manda** el mensaje. Abre WhatsApp
 * con el texto puesto en el campo, y la persona toca Enviar.
 *
 * Es una limitacion de wa.me, y acá juega a favor:
 *   - No hace falta la API de WhatsApp Business, que se paga y hay que
 *     registrar.
 *   - El dueno VE el mensaje antes de que salga. Un sistema que manda
 *     mensajes solo a los celulares de sus empleados es un sistema al que hay
 *     que tenerle mucha mas confianza.
 *   - Sale desde su propio WhatsApp, asi que el empleado recibe un mensaje de
 *     su patron y no de un numero desconocido.
 *
 * @param {string} telefono
 * @param {string} mensaje
 * @returns {string|null}
 */
export function linkWhatsApp(telefono, mensaje) {
  const numero = aFormatoWhatsApp(telefono);
  if (!numero) return null;

  // encodeURIComponent convierte los espacios, saltos de linea y acentos a la
  // forma que entiende una URL. Sin esto, el mensaje llegaria cortado en el
  // primer espacio.
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
