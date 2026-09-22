// -----------------------------------------------------------------------------
// setup.controller.js — HTTP <-> asistente de configuracion inicial
// -----------------------------------------------------------------------------

import * as setupService from '../services/setup.service.js';

export async function getSetup(req, res, next) {
  try {
    res.json({ ok: true, ...(await setupService.estado()) });
  } catch (error) {
    next(error);
  }
}

export async function postSetup(req, res, next) {
  try {
    const resultado = await setupService.guardar(req.body);
    res.status(201).json({ ok: true, ...resultado });
  } catch (error) {
    next(error);
  }
}
