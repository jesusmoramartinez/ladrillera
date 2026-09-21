// -----------------------------------------------------------------------------
// sale.routes.js — Las puertas de clientes y ventas
// -----------------------------------------------------------------------------
// Dos routers chicos, cada uno con su prefijo en routes/index.js. Los dos van
// debajo de la barrera requireAuth, asi que ya nacen protegidos.
//
// FIJATE EN LA FORMA DE LAS RUTAS DE PAGOS Y ENTREGAS:
//
//   POST   /sales/:id/pagos
//   DELETE /sales/:id/pagos/:pagoId
//
// Los pagos cuelgan de la venta porque no existen fuera de ella: no tiene
// sentido pedir "el pago 7" sin decir de que venta. Esa jerarquia en la URL
// dice, sin explicar nada, como estan armados los datos por dentro.
// -----------------------------------------------------------------------------

import { Router } from 'express';
import * as c from '../controllers/sale.controller.js';
import { validate } from '../middleware/validate.js';
import {
  crearClienteSchema,
  crearEntregaSchema,
  crearPagoSchema,
  crearVentaSchema,
  editarClienteSchema,
  listarClientesSchema,
  listarVentasSchema,
} from '../validators/sale.validator.js';

// --- /api/clients -----------------------------------------------------------
export const clientRouter = Router();

clientRouter.get('/', validate(listarClientesSchema, 'query'), c.getClients);
clientRouter.post('/', validate(crearClienteSchema), c.postClient);
clientRouter.patch('/:id', validate(editarClienteSchema), c.patchClient);
clientRouter.delete('/:id', c.deleteClient);

// --- /api/sales -------------------------------------------------------------
export const saleRouter = Router();

saleRouter.get('/', validate(listarVentasSchema, 'query'), c.getSales);
saleRouter.post('/', validate(crearVentaSchema), c.postSale);

// Las rutas con :id van DESPUES de las fijas. Express prueba en orden, asi que
// si algun dia agregamos /sales/resumen tiene que estar arriba de /sales/:id;
// si no, ":id" se comeria la palabra "resumen".
saleRouter.get('/:id', c.getSale);
saleRouter.delete('/:id', c.deleteSale);

saleRouter.post('/:id/pagos', validate(crearPagoSchema), c.postPago);
saleRouter.delete('/:id/pagos/:pagoId', c.deletePago);

saleRouter.post('/:id/entregas', validate(crearEntregaSchema), c.postEntrega);
saleRouter.delete('/:id/entregas/:entregaId', c.deleteEntrega);
