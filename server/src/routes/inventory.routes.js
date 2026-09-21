// -----------------------------------------------------------------------------
// inventory.routes.js — Las puertas de stock, caja, categorias, listas y config
// -----------------------------------------------------------------------------
// Se exportan cinco routers chicos en vez de uno grande, para que cada uno se
// monte en su propio prefijo en routes/index.js. Todos quedan debajo de la
// barrera requireAuth.
// -----------------------------------------------------------------------------

import { Router } from 'express';
import * as c from '../controllers/inventory.controller.js';
import { validate } from '../middleware/validate.js';
import {
  ajusteSchema,
  compraSchema,
  crearCategoriaSchema,
  crearListaPrecioSchema,
  editarCategoriaSchema,
  editarListaPrecioSchema,
  editarSettingsSchema,
  egresoManualSchema,
  listarCategoriasSchema,
  listarMovimientosSchema,
  listarTransaccionesSchema,
  usoLenaSchema,
} from '../validators/inventory.validator.js';

// --- /api/inventory ---------------------------------------------------------
export const inventoryRouter = Router();

inventoryRouter.get('/', c.getInventory);
inventoryRouter.get(
  '/movimientos',
  validate(listarMovimientosSchema, 'query'),
  c.getMovimientos,
);
inventoryRouter.post('/compras', validate(compraSchema), c.postCompra);
inventoryRouter.delete('/compras/:id', c.deleteCompra);
inventoryRouter.post('/uso-lena', validate(usoLenaSchema), c.postUsoLena);
inventoryRouter.post('/ajustes', validate(ajusteSchema), c.postAjuste);

// --- /api/transactions ------------------------------------------------------
export const transactionRouter = Router();

transactionRouter.get('/', validate(listarTransaccionesSchema, 'query'), c.getTransactions);
transactionRouter.post('/egreso', validate(egresoManualSchema), c.postEgreso);
transactionRouter.delete('/:id', c.deleteTransaction);

// --- /api/categories --------------------------------------------------------
export const categoryRouter = Router();

categoryRouter.get('/', validate(listarCategoriasSchema, 'query'), c.getCategories);
categoryRouter.post('/', validate(crearCategoriaSchema), c.postCategory);
categoryRouter.patch('/:id', validate(editarCategoriaSchema), c.patchCategory);
categoryRouter.delete('/:id', c.deleteCategory);

// --- /api/price-lists -------------------------------------------------------
export const priceListRouter = Router();

priceListRouter.get('/', c.getPriceLists);
priceListRouter.post('/', validate(crearListaPrecioSchema), c.postPriceList);
priceListRouter.patch('/:id', validate(editarListaPrecioSchema), c.patchPriceList);
priceListRouter.delete('/:id', c.deletePriceList);

// --- /api/settings ----------------------------------------------------------
export const settingsRouter = Router();

settingsRouter.get('/', c.getSettings);
settingsRouter.patch('/', validate(editarSettingsSchema), c.patchSettings);
