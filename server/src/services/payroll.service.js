// -----------------------------------------------------------------------------
// payroll.service.js — La liquidacion del sabado
// -----------------------------------------------------------------------------
// Acá se juntan tres fases: la produccion (5) da el bruto, los adelantos (7)
// dan lo que ya cobro, y la liquidacion anterior da la deuda arrastrada.
//
//
// LAS DOS OPERACIONES, Y POR QUE SON DISTINTAS
//
//   preview(semana)  -> calcula y NO guarda nada. Se puede llamar mil veces.
//   pagar(semana)    -> calcula OTRA VEZ, y esa vez si guarda.
//
// Fijate que `pagar()` no recibe el resultado del preview: lo recalcula desde
// cero. Podria parecer trabajo repetido y es a proposito.
//
// Entre que el dueno mira la pantalla y toca "Marcar pagado" pueden pasar
// minutos, y en el medio alguien pudo cargar una produccion o un adelanto. Si
// se guardara lo que el navegador tiene en pantalla, se pagaria una foto
// vieja. Recalculando al momento de pagar, lo que se guarda es lo que era
// cierto en el instante en que salio la plata.
//
// Es el mismo principio que en las ventas: **lo que se guarda lo decide el
// servidor, no la pantalla.**
//
//
// "REINICIAR CONTADORES" NO EXISTE
//
// El MVP hablaba de un boton para reiniciar los contadores cada semana. No
// hace falta y seria peligroso: los totales SIEMPRE se calculan por rango de
// fechas, asi que el lunes arrancan en cero solos. No hay nada que reiniciar,
// y por lo tanto no hay ningun boton que pueda borrar una semana por error.
// -----------------------------------------------------------------------------

import { conTransaccion } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import { formatearGsSimple } from '../logic/money.js';
import { armarLiquidacion } from '../logic/payroll.js';
import { semanaDePago } from '../logic/semana.js';
import { textoDelTicket } from '../logic/ticket.js';
import { aFormatoWhatsApp } from '../logic/telefono.js';
import { Advance } from '../models/Advance.js';
import { CATEGORIAS_SISTEMA } from '../models/Category.js';
import { Employee } from '../models/Employee.js';
import { Payroll } from '../models/Payroll.js';
import { Production } from '../models/Production.js';
import * as transactionService from './transaction.service.js';

const VIGENTES = { deletedAt: null };

// ---------------------------------------------------------------------------
// El calculo
// ---------------------------------------------------------------------------

/**
 * Junta todo lo que hace falta para liquidar una semana y hace la cuenta.
 *
 * NO guarda nada. La usan tanto `preview()` como `pagar()`, para que las dos
 * hagan exactamente la misma cuenta y no puedan separarse con el tiempo.
 *
 * @param {string} fechaISO  cualquier dia de la semana
 * @param {import('mongoose').ClientSession} [session]
 */
async function calcular(fechaISO, session) {
  const semana = semanaDePago(fechaISO);
  const rango = { $gte: semana.inicio, $lte: semana.fin };

  // Solo lo que NO se liquido todavia (payrollId: null). Si la semana se
  // pagara dos veces, la segunda no encontraria nada que pagar, que es
  // exactamente lo correcto.
  const [producciones, adelantos, deudasAnteriores] = await Promise.all([
    Production.find({ ...VIGENTES, payrollId: null, fecha: rango })
      .sort({ fecha: 1 })
      .session(session ?? null),
    Advance.find({ ...VIGENTES, payrollId: null, fecha: rango })
      .sort({ fecha: 1 })
      .session(session ?? null),
    Payroll.deudasAnterioresA(semana.inicio),
  ]);

  // Los nombres ACTUALES de todos los que aparecen. Se buscan una sola vez, en
  // una consulta, y no de a uno adentro del bucle (el problema N+1 de la
  // fase 6).
  const ids = new Set([
    ...producciones.flatMap((p) => p.trabajadores.map((t) => String(t.employeeId))),
    ...adelantos.map((a) => String(a.employeeId)),
    ...deudasAnteriores.keys(),
  ]);

  const empleados = await Employee.find({ _id: { $in: [...ids] } })
    .select('nombre telefono')
    .session(session ?? null);

  const nombres = new Map(empleados.map((e) => [String(e._id), e.nombre]));
  const telefonos = new Map(empleados.map((e) => [String(e._id), e.telefono ?? '']));

  const { detalle, totalAPagar } = armarLiquidacion({
    producciones,
    adelantos,
    deudasAnteriores,
    nombres,
  });

  return { semana, detalle, totalAPagar, producciones, adelantos, telefonos };
}

// ---------------------------------------------------------------------------
// Preview (plan: GET /payrolls/preview?semana=...)
// ---------------------------------------------------------------------------

/**
 * La liquidacion de la semana, sin guardar nada.
 *
 * Si la semana YA se pagó, devuelve la guardada en vez de recalcular: los
 * numeros de una semana pagada son un comprobante y no se vuelven a calcular
 * nunca (ver el comentario grande de Payroll.js).
 */
export async function preview(fechaISO) {
  const semana = semanaDePago(fechaISO);

  const pagada = await Payroll.findOne({
    ...VIGENTES,
    semanaInicio: semana.inicio,
    estado: 'pagada',
  });

  if (pagada) {
    return {
      semana,
      estado: 'pagada',
      detalle: pagada.detalle,
      totalAPagar: pagada.totalAPagar,
      pagadaEn: pagada.pagadaEn,
      payrollId: pagada._id,
    };
  }

  const { detalle, totalAPagar } = await calcular(fechaISO);

  return { semana, estado: 'borrador', detalle, totalAPagar, payrollId: null };
}

// ---------------------------------------------------------------------------
// Marcar pagado (plan: POST /payrolls/:semana/pagar)
// ---------------------------------------------------------------------------

/**
 * Cierra la semana. En UNA transaccion:
 *
 *   1. guarda la liquidacion con todos los numeros congelados
 *   2. crea el egreso de caja `sueldos` por el total neto
 *   3. marca con `payrollId` todas las producciones y adelantos de la semana
 *
 * El paso 3 es el que activa las protecciones que ya estaban escritas desde
 * las fases 5 y 7: a partir de ahora esas producciones y adelantos no se
 * pueden anular. Nunca hubo que tocar esos archivos; solo faltaba que alguien
 * completara el campo.
 */
export async function pagar(fechaISO) {
  const semana = semanaDePago(fechaISO);

  const yaExiste = await Payroll.findOne({ ...VIGENTES, semanaInicio: semana.inicio });
  if (yaExiste?.estado === 'pagada') {
    throw new ApiError(409, `La semana del ${semana.inicio} ya fue liquidada.`);
  }

  return conTransaccion(async (session) => {
    // Se recalcula ACA ADENTRO, no se usa lo que vino del preview.
    const { detalle, totalAPagar, producciones, adelantos } = await calcular(fechaISO, session);

    if (detalle.length === 0) {
      throw new ApiError(
        400,
        'No hay nada que liquidar en esta semana: ni produccion, ni adelantos, ni deudas.',
      );
    }

    // 1) La liquidacion.
    const [payroll] = await Payroll.create(
      [
        {
          semanaInicio: semana.inicio,
          semanaFin: semana.fin,
          estado: 'pagada',
          detalle,
          totalAPagar,
          pagadaEn: new Date(),
        },
      ],
      { session },
    );

    // 2) El egreso de caja.
    //
    //    Solo si hay algo que pagar. Si TODOS se adelantaron mas de lo que
    //    ganaron, el total es cero: no sale plata de la caja (ya salio con
    //    cada adelanto) y un movimiento de 0 Gs no significa nada. La
    //    liquidacion igual se guarda, porque las deudas nuevas tienen que
    //    viajar a la semana siguiente.
    if (totalAPagar > 0) {
      const egreso = await transactionService.crearEgresoDeSistema(
        {
          claveCategoria: CATEGORIAS_SISTEMA.SUELDOS,
          monto: totalAPagar,
          // La fecha del SABADO, que es el dia de pago, y no la de hoy: si el
          // dueno liquida el lunes siguiente, la plata igual corresponde a esa
          // semana.
          fecha: semana.fin,
          descripcion: `Sueldos semana ${semana.inicio} al ${semana.fin} — ${formatearGsSimple(totalAPagar)} (${detalle.length} empleados)`,
          origenTipo: 'liquidacion',
          origenId: payroll._id,
        },
        session,
      );

      payroll.transactionId = egreso._id;
      await payroll.save({ session });
    }

    // 3) Marcar lo liquidado. Es lo que traba las anulaciones de aca en mas.
    const idsProducciones = producciones.map((p) => p._id);
    const idsAdelantos = adelantos.map((a) => a._id);

    if (idsProducciones.length > 0) {
      await Production.updateMany(
        { _id: { $in: idsProducciones } },
        { payrollId: payroll._id },
        { session },
      );
    }
    if (idsAdelantos.length > 0) {
      await Advance.updateMany(
        { _id: { $in: idsAdelantos } },
        { payrollId: payroll._id },
        { session },
      );
    }

    return payroll;
  });
}

// ---------------------------------------------------------------------------
// Historial
// ---------------------------------------------------------------------------

/** Las semanas ya liquidadas, de la mas nueva a la mas vieja. */
export async function listar({ limite = 52 } = {}) {
  return Payroll.find(VIGENTES)
    .sort({ semanaInicio: -1 })
    .limit(Math.min(limite, 200));
}

export async function buscarPorId(id) {
  const payroll = await Payroll.findOne({ _id: id, ...VIGENTES });
  if (!payroll) throw new ApiError(404, 'La liquidacion no existe');
  return payroll;
}

// ---------------------------------------------------------------------------
// Tickets (plan: GET /payrolls/:id/ticket/:employeeId)
// ---------------------------------------------------------------------------

/**
 * El ticket de un empleado: el detalle guardado + el texto listo para mandar
 * y el link de WhatsApp si tiene celular cargado.
 *
 * El texto lo arma el SERVIDOR y no la pantalla. Asi el ticket que se ve, el
 * que se manda y el que quedaria en un futuro PDF son siempre el mismo, y el
 * dia que haya que cambiar una linea se cambia en un solo lugar.
 */
export async function ticket(payrollId, employeeId) {
  const payroll = await buscarPorId(payrollId);

  const empleado = payroll.detalle.find((d) => String(d.employeeId) === String(employeeId));
  if (!empleado) {
    throw new ApiError(404, 'Ese empleado no figura en esta liquidacion');
  }

  const semana = { inicio: payroll.semanaInicio, fin: payroll.semanaFin };
  const texto = textoDelTicket({ semana, empleado });

  // El telefono se lee AHORA, del empleado, y no del snapshot de la
  // liquidacion. Es lo correcto: si cambio de numero despues de que se le
  // pago, el ticket tiene que ir al numero nuevo. El telefono no es parte del
  // comprobante, es la forma de hacerselo llegar.
  const persona = await Employee.findById(employeeId).select('nombre telefono');
  const telefono = persona?.telefono ?? '';
  const numeroWhatsApp = aFormatoWhatsApp(telefono);

  return {
    semana,
    estado: payroll.estado,
    empleado,
    texto,
    telefono,
    // La pantalla usa esto para saber si el boton va habilitado, y si no,
    // explicar por que.
    puedeWhatsApp: numeroWhatsApp !== null,
    numeroWhatsApp,
  };
}
