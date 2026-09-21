// -----------------------------------------------------------------------------
// category.service.js — Reglas de las categorias de caja
// -----------------------------------------------------------------------------
// Casi todo acá es una sola idea repetida: las categorias de SISTEMA no se
// tocan. No se renombran, no se borran, no se eligen a mano.
//
// Por que tanto celo: el codigo las busca por su `clave` para generar los
// movimientos automaticos. Si el dueno pudiera borrar "Compra de material",
// la proxima compra fallaria con un error que no tendria nada que ver con lo
// que estaba haciendo.
// -----------------------------------------------------------------------------

import { ApiError } from '../middleware/errorHandler.js';
import { Category } from '../models/Category.js';

const VIGENTES = { deletedAt: null };

/**
 * Lista categorias.
 * @param {{ tipo?: 'ingreso'|'egreso', soloElegibles?: boolean }} opciones
 *   soloElegibles = las que el dueno puede usar al cargar un gasto
 *   (o sea: todas menos las de sistema)
 */
export async function listar({ tipo, soloElegibles = false } = {}) {
  const filtro = { ...VIGENTES };
  if (tipo) filtro.tipo = tipo;
  if (soloElegibles) filtro.sistema = false;

  return Category.find(filtro).sort({ sistema: 1, nombre: 1 });
}

export async function buscarPorId(id) {
  const categoria = await Category.findOne({ _id: id, ...VIGENTES });
  if (!categoria) throw new ApiError(404, 'La categoria no existe');
  return categoria;
}

/**
 * Crea una categoria del dueno. Nunca de sistema: esas solo las crea el seed.
 */
export async function crear({ nombre, tipo }) {
  // Evitamos duplicados por nombre (sin distinguir mayusculas). No se usa un
  // indice unico de la base porque "Nafta" borrada y "Nafta" nueva pueden
  // convivir: el indice no entiende de soft delete.
  const existente = await Category.findOne({
    ...VIGENTES,
    tipo,
    nombre: new RegExp(`^${escaparRegex(nombre)}$`, 'i'),
  });
  if (existente) throw new ApiError(409, `Ya existe la categoria "${existente.nombre}"`);

  return Category.create({ nombre, tipo, sistema: false, clave: null });
}

export async function editar(id, cambios) {
  const categoria = await buscarPorId(id);

  if (categoria.sistema) {
    throw new ApiError(400, `"${categoria.nombre}" la usa el sistema y no se puede editar`);
  }

  // El tipo no se cambia: los movimientos ya cargados con esta categoria
  // quedarian contados del lado equivocado del balance.
  if (cambios.tipo && cambios.tipo !== categoria.tipo) {
    throw new ApiError(
      400,
      'No se puede cambiar de ingreso a egreso. Crea una categoria nueva.',
    );
  }

  if (cambios.nombre) categoria.nombre = cambios.nombre;
  await categoria.save();
  return categoria;
}

/**
 * Soft delete. Los gastos viejos siguen mostrando el nombre correcto gracias
 * al snapshot `categoriaNombre` que guarda cada movimiento.
 */
export async function eliminar(id) {
  const categoria = await buscarPorId(id);

  if (categoria.sistema) {
    throw new ApiError(400, `"${categoria.nombre}" la usa el sistema y no se puede borrar`);
  }

  categoria.deletedAt = new Date();
  await categoria.save();
  return categoria;
}

/**
 * Escapa los caracteres que tienen significado especial en una expresion
 * regular. Sin esto, una categoria llamada "Gastos (varios)" romperia la
 * busqueda, y un nombre malicioso podria armar una regex que cuelgue al
 * servidor.
 */
function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
