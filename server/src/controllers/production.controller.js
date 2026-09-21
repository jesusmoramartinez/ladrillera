// -----------------------------------------------------------------------------
// production.controller.js — HTTP <-> servicio de produccion
// -----------------------------------------------------------------------------

import { hoyEnParaguay } from '../logic/semana.js';
import * as productionService from '../services/production.service.js';

export async function getProductions(req, res, next) {
  try {
    // Sin ?semana, se usa hoy (en hora de Paraguay).
    const fecha = req.datosValidados?.semana ?? hoyEnParaguay();
    res.json({ ok: true, ...(await productionService.listarPorSemana(fecha)) });
  } catch (error) {
    next(error);
  }
}

export async function postProduction(req, res, next) {
  try {
    const resultado = await productionService.crear(req.body);
    res.status(201).json({ ok: true, ...resultado });
  } catch (error) {
    next(error);
  }
}

export async function deleteProduction(req, res, next) {
  try {
    const produccion = await productionService.anular(req.params.id);
    res.json({ ok: true, produccion });
  } catch (error) {
    next(error);
  }
}
