// -----------------------------------------------------------------------------
// production.js — Las cuentas de la produccion diaria
// -----------------------------------------------------------------------------
// Funciones puras: entran datos, salen datos. Nada de base ni de HTTP.
//
// LA REGLA CLAVE DE LA FASE (plan, seccion 1):
//
//   El dueno carga UN numero por dia (los ladrillos que salieron) y marca QUE
//   EMPLEADOS trabajaron. Esa cantidad se le asigna A CADA UNO de ellos, y
//   cada uno cobra segun SU tarifa.
//
// O sea: NO se reparte la cantidad entre los que trabajaron. Si salieron 5.000
// ladrillos y trabajaron tres personas, cada una cobra por 5.000, no por 1.666.
// Es contraintuitivo la primera vez que se lee, pero es como se paga en la
// fabrica: el equipo entero hizo esos 5.000.
// -----------------------------------------------------------------------------

import { montoPorMil } from './money.js';

/**
 * Arma la lista de trabajadores de una produccion, con el monto de cada uno.
 *
 * Fijate que se copian `nombre` y `tarifaPorMil` adentro. Eso es un SNAPSHOT
 * (plan, seccion 4.3): una foto del empleado en el momento de la produccion.
 *
 * Por que importa: si en octubre el dueno le sube la tarifa a alguien, las
 * producciones de septiembre siguen calculadas con la tarifa vieja. Sin el
 * snapshot, subir una tarifa cambiaria hacia atras lo que ya se pago, y los
 * tickets viejos dejarian de coincidir con el cuaderno.
 *
 * @param {number} cantidad   ladrillos del dia
 * @param {Array<{_id: any, nombre: string, tarifaPorMil: number}>} empleados
 * @returns {Array<{employeeId: any, nombre: string, tarifaPorMil: number, monto: number}>}
 */
export function armarTrabajadores(cantidad, empleados) {
  return empleados.map((empleado) => ({
    employeeId: empleado._id,
    nombre: empleado.nombre,
    tarifaPorMil: empleado.tarifaPorMil,
    monto: montoPorMil(cantidad, empleado.tarifaPorMil),
  }));
}

/**
 * Cuanto cuesta la mano de obra de una produccion: la suma de lo que cobran
 * todos los que trabajaron ese dia.
 *
 * OJO, esto NO sale de la caja acá. Los sueldos se pagan el sabado, en la
 * liquidacion semanal (fase 8). Este numero es informativo: sirve para que el
 * dueno vea en el momento cuanto le costo el dia.
 */
export function totalManoDeObra(trabajadores) {
  return trabajadores.reduce((suma, t) => suma + t.monto, 0);
}

/**
 * Resume una lista de producciones: totales y cuanto le corresponde a cada
 * empleado en el periodo.
 *
 * Es el germen de la liquidacion semanal de la fase 8, pero sin adelantos ni
 * deudas: solo el bruto.
 *
 * @param {Array} producciones
 */
export function resumirProducciones(producciones) {
  let totalLadrillos = 0;
  let totalManoObra = 0;

  // Map en vez de un objeto comun porque las claves son ids de Mongo y un Map
  // no se confunde con propiedades heredadas ni ordena las claves solo.
  const porEmpleado = new Map();

  for (const produccion of producciones) {
    totalLadrillos += produccion.cantidad;

    for (const trabajador of produccion.trabajadores) {
      totalManoObra += trabajador.monto;

      const clave = String(trabajador.employeeId);
      const actual = porEmpleado.get(clave) ?? {
        employeeId: clave,
        nombre: trabajador.nombre,
        ladrillos: 0,
        monto: 0,
        dias: 0,
      };

      actual.ladrillos += produccion.cantidad;
      actual.monto += trabajador.monto;
      actual.dias += 1;
      // Nos quedamos con el nombre mas reciente que aparezca, por si cambio.
      actual.nombre = trabajador.nombre;

      porEmpleado.set(clave, actual);
    }
  }

  return {
    totalLadrillos,
    totalManoObra,
    porEmpleado: [...porEmpleado.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)),
  };
}
