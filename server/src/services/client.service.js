// -----------------------------------------------------------------------------
// client.service.js — Reglas de negocio de clientes
// -----------------------------------------------------------------------------
// Casi todo es un CRUD igual al de empleados. Lo unico interesante es `listar`,
// que no devuelve solo los clientes: les pega al lado cuanto deben y cuantos
// ladrillos esperan.
//
// POR QUE EL SALDO SE CALCULA Y NO SE GUARDA
//
// Seria comodo tener un campo `saldo` en el cliente e irlo sumando y restando
// con cada pago. Es exactamente lo que NO hay que hacer: ese numero tendria
// que actualizarse en seis lugares distintos (crear venta, pagar, anular pago,
// entregar, anular entrega, anular venta), y el dia que uno de esos caminos se
// olvide, el sistema le reclama plata a alguien que ya pago.
//
// Calculandolo desde las ventas, el saldo no puede estar mal: es la definicion
// misma de "lo que debe".
// -----------------------------------------------------------------------------

import { ApiError } from '../middleware/errorHandler.js';
import { Client } from '../models/Client.js';
import { Sale } from '../models/Sale.js';

const VIGENTES = { deletedAt: null };

/**
 * Los clientes con su saldo.
 *
 * Son DOS consultas, no una por cliente. La diferencia importa: con 40
 * clientes, preguntar el saldo de a uno serian 41 viajes a la base (el
 * problema clasico "N+1"). Acá se traen los clientes de una, los saldos de
 * otra, y se juntan en memoria con un Map.
 *
 * @param {{ soloConSaldo?: boolean }} opciones
 */
export async function listar({ soloConSaldo = false } = {}) {
  const [clientes, resumenes] = await Promise.all([
    Client.find(VIGENTES).sort({ nombre: 1 }),
    Sale.resumenPorCliente(),
  ]);

  // Un Map en vez de buscar con .find() adentro del bucle: con .find() serian
  // clientes x ventas comparaciones; con el Map, una busqueda directa.
  const porCliente = new Map(resumenes.map((r) => [String(r._id), r]));

  const conSaldo = clientes.map((cliente) => {
    const resumen = porCliente.get(String(cliente._id));
    return {
      // toJSON() para que salga con `id` en vez de `_id`, igual que en el
      // resto de la API.
      ...cliente.toJSON(),
      porCobrar: resumen?.porCobrar ?? 0,
      porEntregar: resumen?.porEntregar ?? 0,
      ventasPendientes: resumen?.ventasPendientes ?? 0,
    };
  });

  if (!soloConSaldo) return conSaldo;
  return conSaldo.filter((c) => c.porCobrar > 0 || c.porEntregar > 0);
}

export async function buscarPorId(id) {
  const cliente = await Client.findOne({ _id: id, ...VIGENTES });
  if (!cliente) throw new ApiError(404, 'El cliente no existe');
  return cliente;
}

export async function crear(datos) {
  return Client.create(datos);
}

export async function editar(id, cambios) {
  const cliente = await buscarPorId(id);
  Object.assign(cliente, cambios);
  await cliente.save();
  return cliente;
}

/**
 * Soft delete, con una proteccion.
 *
 * A un empleado se lo puede eliminar sin mas, porque sus producciones
 * guardaron su nombre adentro (snapshot). Con un cliente es distinto: la venta
 * lo APUNTA (ver el comentario de Sale.js sobre snapshot vs referencia). Si se
 * eliminara un cliente con una venta a medio cobrar, esa deuda desapareceria
 * de la lista de deudores sin que nadie haya pagado nada.
 *
 * Asi que se bloquea, y el mensaje dice exactamente que falta.
 */
export async function eliminar(id) {
  const cliente = await buscarPorId(id);

  const [resumen] = (await Sale.resumenPorCliente()).filter(
    (r) => String(r._id) === String(cliente._id),
  );

  if (resumen) {
    const partes = [];
    if (resumen.porCobrar > 0) partes.push(`debe ${resumen.porCobrar} Gs`);
    if (resumen.porEntregar > 0) partes.push(`espera ${resumen.porEntregar} ladrillos`);

    throw new ApiError(
      409,
      `No se puede eliminar a ${cliente.nombre}: ${partes.join(' y ')}. ` +
        'Cerra esas ventas primero.',
    );
  }

  cliente.deletedAt = new Date();
  await cliente.save();
  return cliente;
}
