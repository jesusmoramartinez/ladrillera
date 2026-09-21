// -----------------------------------------------------------------------------
// seed.service.js — Los datos con los que el sistema nace
// -----------------------------------------------------------------------------
// "Seed" (semilla) son los datos que tienen que existir si o si para que el
// sistema funcione: las categorias que usa el codigo, una lista de precio, los
// documentos de stock en cero y la configuracion.
//
// Regla de oro: TIENE QUE PODER CORRERSE VARIAS VECES sin romper nada
// (en ingles, ser "idempotente"). Si lo corres dos veces no se duplica nada,
// y si agregamos una categoria nueva en la fase 7, volver a correrlo la crea
// sin tocar lo que ya habia.
//
// Por eso cada insercion usa `updateOne` con `upsert` y `$setOnInsert`:
//   upsert        -> si no existe, crealo
//   $setOnInsert  -> estos valores se aplican SOLO al crear
// Asi, si el dueno le cambio el precio a "Normal", volver a correr el seed NO
// se lo pisa.
// -----------------------------------------------------------------------------

import { MATERIALES } from '../logic/inventory.js';
import { Category, CATEGORIAS_SISTEMA } from '../models/Category.js';
import { Inventory } from '../models/Inventory.js';
import { PriceList } from '../models/PriceList.js';
import { Setting } from '../models/Setting.js';

/**
 * Las que usa el propio sistema. La `clave` es el identificador estable con el
 * que las busca el codigo; el `nombre` es solo para mostrar.
 */
const CATEGORIAS_DE_SISTEMA = [
  { clave: CATEGORIAS_SISTEMA.VENTA, nombre: 'Venta', tipo: 'ingreso' },
  { clave: CATEGORIAS_SISTEMA.COMPRA_MATERIAL, nombre: 'Compra de material', tipo: 'egreso' },
  { clave: CATEGORIAS_SISTEMA.ADELANTO, nombre: 'Adelanto', tipo: 'egreso' },
  { clave: CATEGORIAS_SISTEMA.SUELDOS, nombre: 'Sueldos', tipo: 'egreso' },
];

/** Las del MVP, que el dueno puede renombrar o desactivar. */
const CATEGORIAS_DEL_DUENO = [
  { nombre: 'Combustible', tipo: 'egreso' },
  { nombre: 'Flete', tipo: 'egreso' },
  { nombre: 'Herramientas', tipo: 'egreso' },
  { nombre: 'Mantenimiento', tipo: 'egreso' },
  { nombre: 'Otro', tipo: 'egreso' },
];

/** Plan, seccion 1: "Normal", "Mayorista", "Promocion". */
const LISTAS_DE_PRECIO = [
  { nombre: 'Normal', precioPorMil: 1_000_000, predeterminada: true },
  { nombre: 'Mayorista', precioPorMil: 900_000, predeterminada: false },
  { nombre: 'Promocion', precioPorMil: 850_000, predeterminada: false },
];

export async function sembrar({ silencioso = false } = {}) {
  const log = silencioso ? () => {} : console.log;
  const resumen = { categorias: 0, listas: 0, materiales: 0 };

  // 1) Configuracion. obtener() ya la crea si falta.
  await Setting.obtener();
  log('[seed] Configuracion lista.');

  // 2) Categorias de sistema, buscadas por clave.
  for (const categoria of CATEGORIAS_DE_SISTEMA) {
    const r = await Category.updateOne(
      { clave: categoria.clave },
      { $setOnInsert: { ...categoria, sistema: true, deletedAt: null } },
      { upsert: true },
    );
    if (r.upsertedCount) resumen.categorias += 1;
  }

  // 3) Categorias del dueno, buscadas por nombre + tipo (no tienen clave).
  for (const categoria of CATEGORIAS_DEL_DUENO) {
    const r = await Category.updateOne(
      { nombre: categoria.nombre, tipo: categoria.tipo, sistema: false },
      { $setOnInsert: { ...categoria, sistema: false, clave: null, deletedAt: null } },
      { upsert: true },
    );
    if (r.upsertedCount) resumen.categorias += 1;
  }
  log(`[seed] Categorias: ${resumen.categorias} nueva(s).`);

  // 4) Listas de precio.
  for (const lista of LISTAS_DE_PRECIO) {
    const r = await PriceList.updateOne(
      { nombre: lista.nombre },
      { $setOnInsert: { ...lista, deletedAt: null } },
      { upsert: true },
    );
    if (r.upsertedCount) resumen.listas += 1;
  }
  log(`[seed] Listas de precio: ${resumen.listas} nueva(s).`);

  // 5) Un documento de stock por material, arrancando en cero.
  //    Tenerlos creados evita casos raros mas adelante ("el material existe
  //    pero su documento no").
  for (const material of MATERIALES) {
    const r = await Inventory.updateOne(
      { material },
      { $setOnInsert: { material, cantidad: 0 } },
      { upsert: true },
    );
    if (r.upsertedCount) resumen.materiales += 1;
  }
  log(`[seed] Materiales: ${resumen.materiales} nuevo(s).`);

  return resumen;
}

export { CATEGORIAS_DE_SISTEMA, CATEGORIAS_DEL_DUENO, LISTAS_DE_PRECIO };
