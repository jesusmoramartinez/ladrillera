// -----------------------------------------------------------------------------
// dashboard.service.js — Los numeros de la pantalla de Inicio
// -----------------------------------------------------------------------------
// Esta fase no inventa ninguna regla de negocio. Junta las que ya existen en
// un solo lugar, para que el dueno abra la app y en dos segundos sepa como
// viene el mes.
//
//
// POR QUE ES UN ENDPOINT SOLO Y NO CINCO
//
// La pantalla necesita cinco cosas: balance del mes, ladrillos de la semana,
// stock, alerta de arcilla y totales pendientes. Se podrian pedir con cinco
// llamadas desde el navegador, y seria un error en un celular:
//
//   - Cada pedido paga el viaje de ida y vuelta. Con buena señal son 100 ms,
//     pero con la señal de una fabrica pueden ser 800. Cinco pedidos son cinco
//     esperas.
//   - La pantalla tendria cinco estados de carga y cinco de error, y podria
//     quedar a medio dibujar: el balance ya cargado y el stock todavia no.
//
// Con UN pedido, el celular espera una vez y la pantalla tiene un solo estado.
//
//
// Y POR QUE ADENTRO SE PIDE TODO A LA VEZ
//
// Las cinco consultas son independientes: ninguna necesita el resultado de
// otra. Entonces van con Promise.all, que las dispara juntas y espera a la mas
// lenta, en vez de una atras de otra.
//
//   en fila:      120 + 80 + 150 + 90 + 60  = 500 ms
//   con Promise.all:  max(120, 80, 150, ...) = 150 ms
//
// Es la diferencia entre cumplir el criterio del plan ("Inicio muestra datos
// reales en < 2 s") con comodidad o con lo justo.
// -----------------------------------------------------------------------------

import { hoyEnParaguay, semanaDePago } from '../logic/semana.js';
import { Production } from '../models/Production.js';
import { Sale } from '../models/Sale.js';
import * as inventoryService from './inventory.service.js';
import * as transactionService from './transaction.service.js';

/**
 * Todo lo que muestra el Inicio (plan, seccion 5.12).
 *
 * @param {string} [fechaISO]  el "hoy" a usar. Se puede pasar para testear sin
 *   depender de que dia sea cuando corran los tests.
 */
export async function obtener(fechaISO = hoyEnParaguay()) {
  const mes = fechaISO.slice(0, 7);
  const semana = semanaDePago(fechaISO);

  // "Ladrillos producidos en la semana en curso (lunes a HOY)", dice el plan.
  // No hasta el sabado: el sabado todavia no paso. Mostrar el total de la
  // semana entera daria siempre el mismo numero que ya se ve en Produccion, y
  // lo que el dueno quiere saber un miercoles es cuanto lleva ACUMULADO.
  //
  // Si la fecha es domingo, semanaDePago() devuelve la semana que EMPIEZA
  // manana (decision de la fase 5), asi que `inicio` seria posterior a `hoy` y
  // el rango quedaria al reves. En ese caso el resultado correcto es cero, y
  // Mongo ya lo devuelve solo: no hay ninguna fecha entre el lunes y el
  // domingo anterior.
  const hastaHoy = fechaISO < semana.inicio ? semana.inicio : fechaISO;

  const [balance, produccion, stock, pendientes] = await Promise.all([
    transactionService.balanceDelMes(mes),
    Production.ladrillosEntre(semana.inicio, hastaHoy),
    inventoryService.obtenerStock(),
    Sale.totalesPendientes(),
  ]);

  return {
    fecha: fechaISO,
    mes,
    semana,

    // Ingresos y egresos van los DOS, no solo el resultado (plan 5.12). Un
    // resultado de 500.000 no dice lo mismo si se movieron 600.000 que si se
    // movieron 20.000.000.
    balance,

    produccion: {
      ladrillos: produccion.ladrillos,
      dias: produccion.dias,
      desde: semana.inicio,
      hasta: hastaHoy,
    },

    // Los tres numeros de los ladrillos + la alerta roja de arcilla. Vienen
    // del mismo lugar que la pantalla de Stock, asi que no pueden discrepar.
    ladrillos: stock.ladrillos,
    arcilla: {
      alerta: stock.alertaArcilla,
      pura: stock.arcilla_pura,
      floja: stock.arcilla_floja,
    },
    lena: stock.lena,

    // Lo que falta cobrar y lo que falta entregar, en todo el sistema.
    pendientes,
  };
}
