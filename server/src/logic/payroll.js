// -----------------------------------------------------------------------------
// payroll.js — La cuenta del sueldo semanal
// -----------------------------------------------------------------------------
// Estas cinco lineas son el corazon de la fase 8 (plan, seccion 5.9):
//
//   resultado  = bruto − adelantos − deudaAnterior
//   neto       = maximo(resultado, 0)      -> lo que se le paga el sabado
//   deudaNueva = maximo(−resultado, 0)     -> lo que queda debiendo
//
// Parece poco. La parte dificil no es la cuenta, es entender POR QUE hay dos
// resultados en vez de uno.
//
//
// POR QUE EL NETO NO PUEDE SER NEGATIVO
//
// Supongamos que un empleado hizo 600.000 de trabajo pero ya le adelantaron
// 800.000. El resultado da −200.000. Y ahi hay que decidir que significa.
//
// La respuesta ingenua seria "que devuelva 200.000". Pero eso no pasa en la
// vida real: nadie devuelve plata el sabado. Lo que pasa es que esa semana
// **no cobra nada** y esos 200.000 quedan pendientes para la semana que viene.
//
// Por eso el numero se parte en dos:
//   - el NETO, que es lo que sale de la caja (nunca negativo, porque la plata
//     solo va en una direccion),
//   - la DEUDA NUEVA, que es informacion que viaja a la semana siguiente.
//
// Y ahi esta la clave de todo el sistema: la `deudaNueva` de esta liquidacion
// es la `deudaAnterior` de la proxima. Es una cadena. Cada sabado se cierra un
// eslabon y se abre el siguiente.
//
//
// POR QUE ESTO ES UNA FUNCION PURA Y NO ESTA METIDA EN EL SERVICIO
//
// Porque es la cuenta de la que depende que a una persona le paguen bien.
// Puesta acá, aislada de la base y de HTTP, se puede probar con veinte casos
// en milisegundos, incluidos los raros que en la fabrica pasan una vez al ano.
// -----------------------------------------------------------------------------

import { esMontoGsValido } from './money.js';

export const ESTADOS_LIQUIDACION = ['borrador', 'pagada'];

/**
 * La cuenta de un empleado.
 *
 * @param {object} p
 * @param {number} p.bruto          lo que gano produciendo esta semana
 * @param {number} p.adelantos      lo que ya cobro a cuenta esta semana
 * @param {number} p.deudaAnterior  lo que quedo debiendo la semana pasada
 * @returns {{resultado: number, neto: number, deudaNueva: number}}
 */
export function calcularNeto({ bruto, adelantos = 0, deudaAnterior = 0 }) {
  for (const [nombre, valor] of Object.entries({ bruto, adelantos, deudaAnterior })) {
    if (!esMontoGsValido(valor)) {
      throw new TypeError(`${nombre} invalido: ${valor}`);
    }
  }

  const resultado = bruto - adelantos - deudaAnterior;

  return {
    // Se devuelve tambien el resultado "crudo" porque la pantalla lo necesita
    // para explicar el caso negativo: sin el, un neto de 0 y una deuda de
    // 200.000 parecen dos numeros sueltos en vez de las dos mitades de uno.
    resultado,
    neto: Math.max(resultado, 0),
    deudaNueva: Math.max(-resultado, 0),
  };
}

/**
 * Junta las producciones de un empleado en su detalle diario.
 *
 * El ticket (plan, 5.10) muestra dia por dia: fecha, ladrillos y monto. Un
 * mismo dia puede tener DOS producciones cargadas (por ejemplo si se cargo la
 * manana y despues la tarde), asi que se agrupan por fecha.
 *
 * @param {Array} producciones  documentos de Production de la semana
 * @param {string} employeeId
 * @returns {Array<{fecha: string, cantidad: number, monto: number}>}
 */
export function detalleDiario(producciones, employeeId) {
  const porFecha = new Map();

  for (const produccion of producciones) {
    const suya = produccion.trabajadores.find(
      (t) => String(t.employeeId) === String(employeeId),
    );
    if (!suya) continue;

    const actual = porFecha.get(produccion.fecha) ?? {
      fecha: produccion.fecha,
      cantidad: 0,
      monto: 0,
    };

    actual.cantidad += produccion.cantidad;
    actual.monto += suya.monto;
    porFecha.set(produccion.fecha, actual);
  }

  // Ordenado por fecha: el ticket se lee de lunes a sabado.
  return [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Arma la liquidacion completa de la semana.
 *
 * Es la unica funcion que ve todo junto, y por eso es la que se testea con los
 * casos raros: el que no trabajo, el que se adelanto de mas, el que arrastra
 * deuda de dos semanas.
 *
 * @param {object} p
 * @param {Array} p.producciones   Production de la semana, sin liquidar
 * @param {Array} p.adelantos      Advance de la semana, sin liquidar
 * @param {Map<string, number>} p.deudasAnteriores  employeeId -> deudaNueva
 * @param {Map<string, string>} p.nombres           employeeId -> nombre actual
 * @returns {{detalle: Array, totalAPagar: number}}
 */
export function armarLiquidacion({
  producciones,
  adelantos,
  deudasAnteriores = new Map(),
  nombres = new Map(),
}) {
  // 1) Quienes entran en esta liquidacion.
  //
  //    Un Set porque alguien puede aparecer en las tres listas (produjo, se
  //    adelanto Y arrastra deuda) y tiene que contarse UNA vez.
  //
  //    Ojo con el tercer grupo: el que NO trabajo esta semana pero debe de la
  //    anterior TIENE que aparecer, con bruto 0. Si se lo salteara, su deuda
  //    desapareceria del sistema sin que nadie la haya pagado.
  const ids = new Set();
  for (const p of producciones) {
    for (const t of p.trabajadores) ids.add(String(t.employeeId));
  }
  for (const a of adelantos) ids.add(String(a.employeeId));
  for (const id of deudasAnteriores.keys()) ids.add(String(id));

  const detalle = [];

  for (const employeeId of ids) {
    const diario = detalleDiario(producciones, employeeId);

    const ladrillos = diario.reduce((suma, d) => suma + d.cantidad, 0);
    const bruto = diario.reduce((suma, d) => suma + d.monto, 0);

    const suyos = adelantos.filter((a) => String(a.employeeId) === employeeId);
    const montoAdelantos = suyos.reduce((suma, a) => suma + a.monto, 0);

    const deudaAnterior = deudasAnteriores.get(employeeId) ?? 0;

    const { resultado, neto, deudaNueva } = calcularNeto({
      bruto,
      adelantos: montoAdelantos,
      deudaAnterior,
    });

    detalle.push({
      employeeId,
      // SNAPSHOT del nombre: el ticket de septiembre tiene que poder leerse en
      // marzo aunque el empleado ya no este en la lista. Misma razon que en
      // Production (ver 4.3 del plan).
      nombre: nombres.get(employeeId) ?? 'Empleado eliminado',
      ladrillos,
      bruto,
      adelantos: montoAdelantos,
      deudaAnterior,
      resultado,
      neto,
      deudaNueva,
      diario,
    });
  }

  // Ordenado por nombre para que la lista del sabado se lea siempre igual.
  detalle.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return {
    detalle,
    // Lo que de verdad sale de la caja. Suma de netos, NO de brutos: los
    // adelantos ya salieron de la caja el dia que se dieron, y contarlos de
    // nuevo seria pagarlos dos veces.
    totalAPagar: detalle.reduce((suma, e) => suma + e.neto, 0),
  };
}
