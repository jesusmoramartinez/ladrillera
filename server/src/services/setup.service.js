// -----------------------------------------------------------------------------
// setup.service.js — El asistente de configuracion inicial (plan, 5.11b)
// -----------------------------------------------------------------------------
// Es lo que pasa el dia de la entrega: el dueno abre la app por primera vez y
// el sistema le pregunta como es su fabrica. Precios, cuanto stock hay hoy en
// el patio, quienes trabajan y cuanto cobran.
//
// TRES DECISIONES QUE VALE LA PENA ENTENDER
//
// 1) TODO EN UNA SOLA TRANSACCION.
//    El asistente escribe en cinco colecciones distintas (settings, listas de
//    precio, empleados, inventario y movimientos). Si se cortara internet a la
//    mitad, el dueno quedaria con los precios cargados pero sin stock, sin
//    saber que falta ni como seguir: la pantalla ya no volveria a aparecer
//    porque... bueno, ver el punto 3. Con una transaccion, o entra todo o no
//    entra nada y puede apretar "Guardar" de nuevo.
//
// 2) NO REUSA priceList.service NI employee.service, y eso es a proposito.
//    Esos servicios abren su PROPIA transaccion adentro. Las transacciones de
//    MongoDB no se anidan: llamarlos desde aca romperia el "todo o nada" del
//    punto 1. Cuando hay que compartir una transaccion, se comparte la
//    `session` y se escribe contra los modelos. Es la misma razon por la que
//    la produccion (fase 5) usa `moverStock` y no `registrarCompra`.
//
// 3) SE PUEDE CORRER UNA SOLA VEZ.
//    Si se pudiera correr dos veces, la segunda sumaria el stock inicial otra
//    vez y el patio tendria el doble de ladrillos que la realidad. Por eso al
//    terminar queda `configuracionInicialHecha = true` y un segundo intento
//    responde 409. Todo lo que se cargo acá se corrige despues desde las
//    pantallas normales (Ajustes, Empleados, ajuste de stock), que es
//    justamente lo que dice el plan.
// -----------------------------------------------------------------------------

import { conTransaccion } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import { camionesALadrillos } from '../logic/inventory.js';
import { Employee } from '../models/Employee.js';
import { Inventory } from '../models/Inventory.js';
import { PriceList } from '../models/PriceList.js';
import { Setting } from '../models/Setting.js';
import { moverStock } from './inventory.service.js';
import { sembrar } from './seed.service.js';

/**
 * ¿Ya se configuro el sistema?
 *
 * La pantalla lo pregunta apenas entra para saber si mostrar el asistente o
 * el Inicio normal.
 */
export async function estado() {
  const config = await Setting.obtener();
  return {
    hecha: config.configuracionInicialHecha,
    unidadLena: config.unidadLena,
    ladrillosPorCamion: config.ladrillosPorCamion,
    umbralAlertaArcilla: config.umbralAlertaArcilla,
    // Las que dejo el seed, para que el asistente las muestre ya escritas y el
    // dueno solo corrija los precios en vez de tipear todo de cero.
    listasDePrecio: await PriceList.find({ deletedAt: null }).sort({
      predeterminada: -1,
      nombre: 1,
    }),
  };
}

/**
 * Guarda toda la configuracion inicial de una vez.
 *
 * @param {object} datos  ya validado por configuracionInicialSchema
 */
export async function guardar(datos) {
  // Las categorias de caja y los documentos de stock tienen que existir antes
  // de escribir nada. En un deploy nuevo puede que nadie haya corrido el seed,
  // asi que lo corremos nosotros: es idempotente, si ya estaba no hace nada.
  await sembrar({ silencioso: true });

  const config = await Setting.obtener();
  if (config.configuracionInicialHecha) {
    throw new ApiError(
      409,
      'La configuracion inicial ya se hizo. Para cambiar algo, usa Ajustes, ' +
        'Empleados o el ajuste de stock.',
    );
  }

  const { fecha, stock, empleados, listasDePrecio } = datos;

  return conTransaccion(async (session) => {
    // --- 1) Los parametros del negocio ------------------------------------
    await Setting.updateOne(
      { clave: config.clave },
      {
        unidadLena: datos.unidadLena,
        ladrillosPorCamion: datos.ladrillosPorCamion,
        umbralAlertaArcilla: datos.umbralAlertaArcilla,
        configuracionInicialHecha: true,
      },
      { session },
    );

    // --- 2) Las listas de precio ------------------------------------------
    //
    // Las del seed son inventadas ("Normal 1.000.000") y estan ahi solo para
    // que el sistema no nazca vacio. Acá el dueno dice las de verdad, asi que
    // las de antes se dan de baja y quedan las suyas.
    //
    // Darlas de baja no rompe ninguna venta vieja: la venta se guarda con una
    // COPIA del precio (fase 6), no con una referencia a la lista.
    await PriceList.updateMany(
      { deletedAt: null },
      { deletedAt: new Date() },
      { session },
    );

    const listasCreadas = await PriceList.create(
      listasDePrecio.map((lista, indice) => ({
        nombre: lista.nombre,
        precioPorMil: lista.precioPorMil,
        // La primera es la predeterminada. El sistema necesita exactamente una
        // (ver la nota de invariantes en priceList.service.js).
        predeterminada: indice === 0,
        deletedAt: null,
      })),
      { session, ordered: true },
    );

    // --- 3) Los empleados --------------------------------------------------
    const empleadosCreados = empleados.length
      ? await Employee.create(
          empleados.map((e) => ({ ...e, activo: true, deletedAt: null })),
          { session, ordered: true },
        )
      : [];

    // --- 4) El stock que hay hoy en el patio -------------------------------
    const movimientos = await registrarStockDelPatio({
      stock,
      fecha,
      ladrillosPorCamion: datos.ladrillosPorCamion,
      session,
    });

    return {
      listasDePrecio: listasCreadas,
      empleados: empleadosCreados,
      movimientos,
    };
  });
}

/**
 * Deja el stock de cada material EXACTAMENTE en lo que dijo el dueno.
 *
 * Ojo con el detalle: no suma lo que le mandan, mueve la DIFERENCIA contra lo
 * que ya hubiera. En una base recien creada es lo mismo (todo esta en cero),
 * pero si alguien probo el sistema antes de la entrega —cargar una produccion
 * de prueba, por ejemplo— sumar a ciegas dejaria un stock que no coincide con
 * el patio, y el dueno arrancaria con un numero mentiroso el primer dia.
 *
 * Es la misma idea de `registrarAjuste`: el dueno dice CUANTO HAY, no cuanto
 * sumar, porque cuanto hay es lo unico que se puede contar mirando el patio.
 */
async function registrarStockDelPatio({ stock, fecha, ladrillosPorCamion, session }) {
  const objetivos = {
    arcilla_pura: camionesALadrillos(stock.arcillaPura, ladrillosPorCamion),
    arcilla_floja: camionesALadrillos(stock.arcillaFloja, ladrillosPorCamion),
    lena: stock.lena,
    ladrillos: stock.ladrillos,
  };

  const movimientos = [];

  for (const [material, objetivo] of Object.entries(objetivos)) {
    const actual = (await Inventory.findOne({ material }).session(session))?.cantidad ?? 0;
    const diferencia = objetivo - actual;

    // Un movimiento de cero no aporta nada y el modelo directamente lo
    // rechaza. Si el material ya estaba en el numero correcto, no hay nada
    // que registrar.
    if (diferencia === 0) continue;

    movimientos.push(
      await moverStock({
        material,
        cantidad: diferencia,
        motivo: 'stock_inicial',
        fecha,
        descripcion: 'Stock inicial (configuracion del primer dia)',
        session,
      }),
    );
  }

  return movimientos;
}
