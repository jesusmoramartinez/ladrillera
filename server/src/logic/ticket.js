// -----------------------------------------------------------------------------
// ticket.js — El texto del ticket semanal
// -----------------------------------------------------------------------------
// El plan (5.10) pide "detalle dia por dia + adelantos + deuda + neto", y el
// dueno decidio que se mande por WhatsApp.
//
// Entonces el ticket tiene que ser TEXTO PLANO, y eso condiciona todo:
//
//   - Nada de tablas alineadas con espacios. WhatsApp usa una tipografia de
//     ancho variable, asi que las columnas quedan torcidas. Cada linea va con
//     su etiqueta adelante.
//   - Se usa el negrita de WhatsApp (*texto*) con cuentagotas, solo en el
//     numero que importa: el neto.
//   - Corto. Se lee en un celular, muchas veces al sol y con una mano. Todo lo
//     que no ayude a contestar "¿cuanto cobro y por que?" sobra.
//
// Un ejemplo de como sale:
//
//     *Ladrillera* — Semana del 21/09 al 26/09
//
//     Ana Benitez
//
//     Lun 21/09: 5.000 ladrillos — Gs 900.000
//     Mie 23/09: 4.000 ladrillos — Gs 720.000
//
//     Total ladrillos: 9.000
//     Bruto: Gs 1.620.000
//     Adelantos: -Gs 500.000
//
//     *A cobrar: Gs 1.120.000*
// -----------------------------------------------------------------------------

import { formatearGsSimple, formatearNumero } from './money.js';
import { nombreDelDia } from './semana.js';

/** "2026-09-21" -> "21/09" */
function diaCorto(fechaISO) {
  const [, mes, dia] = fechaISO.split('-');
  return `${dia}/${mes}`;
}

/** "2026-09-21" -> "Lun 21/09" */
function fechaConDia(fechaISO) {
  return `${nombreDelDia(fechaISO).slice(0, 3)} ${diaCorto(fechaISO)}`;
}

/**
 * Arma el texto del ticket de un empleado.
 *
 * @param {object} p
 * @param {{inicio: string, fin: string}} p.semana
 * @param {object} p.empleado  una linea del `detalle` de la liquidacion
 * @returns {string}
 */
export function textoDelTicket({ semana, empleado }) {
  const lineas = [];

  lineas.push(`*Ladrillera* — Semana del ${diaCorto(semana.inicio)} al ${diaCorto(semana.fin)}`);
  lineas.push('');
  lineas.push(empleado.nombre);
  lineas.push('');

  // --- El dia a dia ---
  if (empleado.diario.length === 0) {
    lineas.push('Sin produccion esta semana.');
  } else {
    for (const dia of empleado.diario) {
      lineas.push(
        `${fechaConDia(dia.fecha)}: ${formatearNumero(dia.cantidad)} ladrillos — ${formatearGsSimple(dia.monto)}`,
      );
    }
  }
  lineas.push('');

  // --- Las cuentas ---
  // Cada linea aparece solo si tiene algo que decir. Un "Adelantos: Gs 0" no
  // informa nada y le saca lugar a lo que si importa.
  if (empleado.ladrillos > 0) {
    lineas.push(`Total ladrillos: ${formatearNumero(empleado.ladrillos)}`);
  }
  lineas.push(`Bruto: ${formatearGsSimple(empleado.bruto)}`);

  if (empleado.adelantos > 0) {
    lineas.push(`Adelantos: -${formatearGsSimple(empleado.adelantos)}`);
  }
  if (empleado.deudaAnterior > 0) {
    lineas.push(`Saldo anterior: -${formatearGsSimple(empleado.deudaAnterior)}`);
  }

  lineas.push('');
  lineas.push(`*A cobrar: ${formatearGsSimple(empleado.neto)}*`);

  // El caso incomodo: cobra cero y ademas queda debiendo. Se dice explicito,
  // porque es EL momento en que el empleado necesita entender por que no le
  // toca plata. Un ticket que solo diga "A cobrar: Gs 0" genera una discusion
  // el sabado a la tarde.
  if (empleado.deudaNueva > 0) {
    lineas.push('');
    lineas.push(
      `Queda un saldo de ${formatearGsSimple(empleado.deudaNueva)} que se descuenta la semana que viene.`,
    );
  }

  return lineas.join('\n');
}
