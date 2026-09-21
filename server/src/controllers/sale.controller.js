// -----------------------------------------------------------------------------
// sale.controller.js — HTTP <-> servicios de clientes y ventas
// -----------------------------------------------------------------------------
// Los controladores de este proyecto son finos a proposito: sacan los datos
// del pedido, llaman al servicio y arman la respuesta. Ninguna regla de
// negocio vive acá.
//
// Por que: las reglas puestas en el controlador solo funcionan cuando la
// operacion entra por HTTP. Cuando la fase 8 (liquidacion) o el asistente de
// configuracion inicial necesiten crear una venta desde adentro, van a llamar
// al servicio directo, y ahi se saltearian todas las reglas que hubieran
// quedado acá arriba.
// -----------------------------------------------------------------------------

import * as clientService from '../services/client.service.js';
import * as saleService from '../services/sale.service.js';

// --- Clientes ---------------------------------------------------------------

export async function getClients(req, res, next) {
  try {
    const { conSaldo } = req.datosValidados ?? {};
    const clientes = await clientService.listar({ soloConSaldo: conSaldo === 'true' });
    res.json({ ok: true, clientes });
  } catch (error) {
    next(error);
  }
}

export async function postClient(req, res, next) {
  try {
    const cliente = await clientService.crear(req.body);
    res.status(201).json({ ok: true, cliente });
  } catch (error) {
    next(error);
  }
}

export async function patchClient(req, res, next) {
  try {
    const cliente = await clientService.editar(req.params.id, req.body);
    res.json({ ok: true, cliente });
  } catch (error) {
    next(error);
  }
}

export async function deleteClient(req, res, next) {
  try {
    const cliente = await clientService.eliminar(req.params.id);
    res.json({ ok: true, cliente });
  } catch (error) {
    next(error);
  }
}

// --- Ventas -----------------------------------------------------------------

export async function getSales(req, res, next) {
  try {
    const { estado, cliente } = req.datosValidados ?? {};
    const ventas = await saleService.listar({ estado, clientId: cliente });
    // Los totales van junto a la lista para que la pantalla los muestre arriba
    // sin tener que hacer un segundo pedido.
    const totales = await saleService.totalesPendientes();
    res.json({ ok: true, ventas, totales });
  } catch (error) {
    next(error);
  }
}

export async function getSale(req, res, next) {
  try {
    const venta = await saleService.buscarPorId(req.params.id);
    res.json({ ok: true, venta });
  } catch (error) {
    next(error);
  }
}

export async function postSale(req, res, next) {
  try {
    const resultado = await saleService.crear(req.body);
    res.status(201).json({ ok: true, ...resultado });
  } catch (error) {
    next(error);
  }
}

export async function deleteSale(req, res, next) {
  try {
    const venta = await saleService.anular(req.params.id);
    res.json({ ok: true, venta });
  } catch (error) {
    next(error);
  }
}

// --- Pagos y entregas -------------------------------------------------------

export async function postPago(req, res, next) {
  try {
    const venta = await saleService.registrarPago(req.params.id, req.body);
    res.status(201).json({ ok: true, venta });
  } catch (error) {
    next(error);
  }
}

export async function deletePago(req, res, next) {
  try {
    const venta = await saleService.anularPago(req.params.id, req.params.pagoId);
    res.json({ ok: true, venta });
  } catch (error) {
    next(error);
  }
}

export async function postEntrega(req, res, next) {
  try {
    const resultado = await saleService.registrarEntrega(req.params.id, req.body);
    res.status(201).json({ ok: true, ...resultado });
  } catch (error) {
    next(error);
  }
}

export async function deleteEntrega(req, res, next) {
  try {
    const venta = await saleService.anularEntrega(req.params.id, req.params.entregaId);
    res.json({ ok: true, venta });
  } catch (error) {
    next(error);
  }
}
