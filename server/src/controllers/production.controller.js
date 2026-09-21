// -----------------------------------------------------------------------------
// production.controller.js — HTTP <-> servicio de produccion
// -----------------------------------------------------------------------------

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

/**
 * El dia de hoy en Paraguay, como "2026-09-21".
 *
 * El formato 'en-CA' escribe las fechas asi, y `timeZone` hace la conversion.
 * Sin la zona, el servidor (que suele correr en UTC) a las 22 h ya estaria en
 * el dia siguiente y devolveria la semana equivocada.
 */
function hoyEnParaguay() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
