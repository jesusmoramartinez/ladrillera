// -----------------------------------------------------------------------------
// inventory.controller.js — HTTP <-> servicios de stock, caja, categorias,
// listas de precio y configuracion
// -----------------------------------------------------------------------------
// Estan juntos porque son modulos chicos y muy relacionados entre si. Si
// alguno crece, se separa en su propio archivo sin tocar nada mas: las rutas
// ya apuntan a funciones sueltas, no a un objeto.
// -----------------------------------------------------------------------------

import * as categoryService from '../services/category.service.js';
import * as inventoryService from '../services/inventory.service.js';
import * as priceListService from '../services/priceList.service.js';
import * as settingsService from '../services/settings.service.js';
import * as transactionService from '../services/transaction.service.js';

// --- Stock ------------------------------------------------------------------

export async function getInventory(req, res, next) {
  try {
    res.json({ ok: true, stock: await inventoryService.obtenerStock() });
  } catch (error) {
    next(error);
  }
}

export async function getMovimientos(req, res, next) {
  try {
    const { material, limite } = req.datosValidados ?? {};
    const movimientos = await inventoryService.listarMovimientos({ material, limite });
    res.json({ ok: true, movimientos });
  } catch (error) {
    next(error);
  }
}

export async function postCompra(req, res, next) {
  try {
    const resultado = await inventoryService.registrarCompra(req.body);
    res.status(201).json({ ok: true, ...resultado });
  } catch (error) {
    next(error);
  }
}

export async function deleteCompra(req, res, next) {
  try {
    const movimiento = await inventoryService.anularCompra(req.params.id);
    res.json({ ok: true, movimiento });
  } catch (error) {
    next(error);
  }
}

export async function postUsoLena(req, res, next) {
  try {
    const movimiento = await inventoryService.registrarUsoLena(req.body);
    res.status(201).json({ ok: true, movimiento });
  } catch (error) {
    next(error);
  }
}

export async function postAjuste(req, res, next) {
  try {
    const movimiento = await inventoryService.registrarAjuste(req.body);
    res.status(201).json({ ok: true, movimiento });
  } catch (error) {
    next(error);
  }
}

// --- Caja -------------------------------------------------------------------

export async function getTransactions(req, res, next) {
  try {
    // Si no viene el mes, se usa el mes en curso en hora de Paraguay.
    const mes = req.datosValidados?.mes ?? mesActual();
    res.json({ ok: true, ...(await transactionService.listarPorMes(mes)) });
  } catch (error) {
    next(error);
  }
}

export async function postEgreso(req, res, next) {
  try {
    const movimiento = await transactionService.crearEgresoManual(req.body);
    res.status(201).json({ ok: true, movimiento });
  } catch (error) {
    next(error);
  }
}

export async function deleteTransaction(req, res, next) {
  try {
    const movimiento = await transactionService.anularManual(req.params.id);
    res.json({ ok: true, movimiento });
  } catch (error) {
    next(error);
  }
}

// --- Categorias -------------------------------------------------------------

export async function getCategories(req, res, next) {
  try {
    const { tipo, elegibles } = req.datosValidados ?? {};
    const categorias = await categoryService.listar({
      tipo,
      soloElegibles: elegibles === 'true',
    });
    res.json({ ok: true, categorias });
  } catch (error) {
    next(error);
  }
}

export async function postCategory(req, res, next) {
  try {
    const categoria = await categoryService.crear(req.body);
    res.status(201).json({ ok: true, categoria });
  } catch (error) {
    next(error);
  }
}

export async function patchCategory(req, res, next) {
  try {
    const categoria = await categoryService.editar(req.params.id, req.body);
    res.json({ ok: true, categoria });
  } catch (error) {
    next(error);
  }
}

export async function deleteCategory(req, res, next) {
  try {
    const categoria = await categoryService.eliminar(req.params.id);
    res.json({ ok: true, categoria });
  } catch (error) {
    next(error);
  }
}

// --- Listas de precio -------------------------------------------------------

export async function getPriceLists(req, res, next) {
  try {
    res.json({ ok: true, listas: await priceListService.listar() });
  } catch (error) {
    next(error);
  }
}

export async function postPriceList(req, res, next) {
  try {
    const lista = await priceListService.crear(req.body);
    res.status(201).json({ ok: true, lista });
  } catch (error) {
    next(error);
  }
}

export async function patchPriceList(req, res, next) {
  try {
    const lista = await priceListService.editar(req.params.id, req.body);
    res.json({ ok: true, lista });
  } catch (error) {
    next(error);
  }
}

export async function deletePriceList(req, res, next) {
  try {
    const lista = await priceListService.eliminar(req.params.id);
    res.json({ ok: true, lista });
  } catch (error) {
    next(error);
  }
}

// --- Configuracion ----------------------------------------------------------

export async function getSettings(req, res, next) {
  try {
    res.json({ ok: true, config: await settingsService.obtener() });
  } catch (error) {
    next(error);
  }
}

export async function patchSettings(req, res, next) {
  try {
    const config = await settingsService.actualizar(req.body);
    res.json({ ok: true, config });
  } catch (error) {
    next(error);
  }
}

// --- Ayuda ------------------------------------------------------------------

/**
 * El mes en curso en Paraguay, como "2026-09".
 *
 * Se usa 'en-CA' porque escribe las fechas como "2026-09-21", y `timeZone`
 * hace la conversion horaria. Sin la zona, a las 22 h del 30 de septiembre el
 * servidor (que suele correr en UTC) ya diria octubre y el balance mostraria
 * el mes equivocado.
 */
function mesActual() {
  const hoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return hoy.slice(0, 7);
}
