// -----------------------------------------------------------------------------
// priceList.service.js — Reglas de las listas de precio
// -----------------------------------------------------------------------------
// Dos invariantes que el servicio tiene que sostener siempre:
//
//   1. Hay EXACTAMENTE UNA lista predeterminada (la que viene elegida al
//      abrir una venta nueva).
//   2. La predeterminada NO se puede desactivar. Si se pudiera, al vender no
//      habria ninguna elegida y la pantalla quedaria en un estado raro.
//
// "Invariante" es algo que tiene que ser cierto siempre, antes y despues de
// cualquier operacion. El esquema no puede garantizarlo porque involucra a
// varios documentos a la vez; por eso vive acá.
// -----------------------------------------------------------------------------

import { conTransaccion } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import { PriceList } from '../models/PriceList.js';

const VIGENTES = { deletedAt: null };

export async function listar() {
  // La predeterminada primero, despues por nombre.
  return PriceList.find(VIGENTES).sort({ predeterminada: -1, nombre: 1 });
}

export async function buscarPorId(id) {
  const lista = await PriceList.findOne({ _id: id, ...VIGENTES });
  if (!lista) throw new ApiError(404, 'La lista de precio no existe');
  return lista;
}

/** La que viene marcada al crear una venta. */
export async function obtenerPredeterminada() {
  return PriceList.findOne({ ...VIGENTES, predeterminada: true });
}

export async function crear({ nombre, precioPorMil, predeterminada = false }) {
  const existente = await PriceList.findOne({
    ...VIGENTES,
    nombre: new RegExp(`^${escaparRegex(nombre)}$`, 'i'),
  });
  if (existente) throw new ApiError(409, `Ya existe la lista "${existente.nombre}"`);

  // Si no hay ninguna todavia, la primera es la predeterminada si o si:
  // el sistema no puede quedarse sin una.
  const hayAlguna = await PriceList.countDocuments(VIGENTES);
  const seraPredeterminada = predeterminada || hayAlguna === 0;

  if (!seraPredeterminada) {
    return PriceList.create({ nombre, precioPorMil, predeterminada: false });
  }

  // Marcar una implica desmarcar la otra. Son dos escrituras que tienen que ir
  // juntas: si quedaran dos predeterminadas (o ninguna), se rompe la regla.
  return conTransaccion(async (session) => {
    await PriceList.updateMany({ predeterminada: true }, { predeterminada: false }, { session });
    const [lista] = await PriceList.create(
      [{ nombre, precioPorMil, predeterminada: true }],
      { session },
    );
    return lista;
  });
}

export async function editar(id, cambios) {
  const lista = await buscarPorId(id);

  if (cambios.nombre !== undefined) lista.nombre = cambios.nombre;
  if (cambios.precioPorMil !== undefined) lista.precioPorMil = cambios.precioPorMil;

  // Pasar a predeterminada: hay que desmarcar la anterior en la misma
  // transaccion.
  if (cambios.predeterminada === true && !lista.predeterminada) {
    return conTransaccion(async (session) => {
      await PriceList.updateMany(
        { predeterminada: true, _id: { $ne: lista._id } },
        { predeterminada: false },
        { session },
      );
      lista.predeterminada = true;
      await lista.save({ session });
      return lista;
    });
  }

  if (cambios.predeterminada === false && lista.predeterminada) {
    throw new ApiError(
      400,
      'No se puede quitar la predeterminada. Marca otra lista como predeterminada.',
    );
  }

  await lista.save();
  return lista;
}

export async function eliminar(id) {
  const lista = await buscarPorId(id);

  if (lista.predeterminada) {
    throw new ApiError(
      400,
      'No se puede desactivar la lista predeterminada. Marca otra primero.',
    );
  }

  lista.deletedAt = new Date();
  await lista.save();
  return lista;
}

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
