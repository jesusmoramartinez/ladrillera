// -----------------------------------------------------------------------------
// dashboard.controller.js — HTTP <-> servicio del Inicio
// -----------------------------------------------------------------------------

import * as dashboardService from '../services/dashboard.service.js';

export async function getDashboard(req, res, next) {
  try {
    // Se acepta ?fecha= para poder probar un dia distinto sin cambiar la hora
    // del servidor. Sin el, se usa hoy en Paraguay.
    const datos = await dashboardService.obtener(req.datosValidados?.fecha);
    res.json({ ok: true, ...datos });
  } catch (error) {
    next(error);
  }
}
