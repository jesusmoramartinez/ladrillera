// -----------------------------------------------------------------------------
// advance.controller.js — HTTP <-> servicio de adelantos
// -----------------------------------------------------------------------------

import * as advanceService from '../services/advance.service.js';
import { hoyEnParaguay } from '../logic/semana.js';

export async function getAdvances(req, res, next) {
  try {
    // Sin ?semana, se usa hoy (en hora de Paraguay).
    const fecha = req.datosValidados?.semana ?? hoyEnParaguay();
    res.json({ ok: true, ...(await advanceService.listarPorSemana(fecha)) });
  } catch (error) {
    next(error);
  }
}

export async function postAdvance(req, res, next) {
  try {
    const adelanto = await advanceService.crear(req.body);
    res.status(201).json({ ok: true, adelanto });
  } catch (error) {
    next(error);
  }
}

export async function deleteAdvance(req, res, next) {
  try {
    const adelanto = await advanceService.anular(req.params.id);
    res.json({ ok: true, adelanto });
  } catch (error) {
    next(error);
  }
}
