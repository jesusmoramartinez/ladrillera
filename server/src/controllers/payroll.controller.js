// -----------------------------------------------------------------------------
// payroll.controller.js — HTTP <-> servicio de liquidaciones
// -----------------------------------------------------------------------------

import { hoyEnParaguay } from '../logic/semana.js';
import * as payrollService from '../services/payroll.service.js';

export async function getPreview(req, res, next) {
  try {
    const fecha = req.datosValidados?.semana ?? hoyEnParaguay();
    res.json({ ok: true, ...(await payrollService.preview(fecha)) });
  } catch (error) {
    next(error);
  }
}

export async function postPagar(req, res, next) {
  try {
    // La semana viene en la URL: POST /payrolls/2026-09-21/pagar
    const payroll = await payrollService.pagar(req.params.semana);
    res.status(201).json({ ok: true, payroll });
  } catch (error) {
    next(error);
  }
}

export async function getPayrolls(req, res, next) {
  try {
    res.json({ ok: true, liquidaciones: await payrollService.listar() });
  } catch (error) {
    next(error);
  }
}

export async function getTicket(req, res, next) {
  try {
    const ticket = await payrollService.ticket(req.params.id, req.params.employeeId);
    res.json({ ok: true, ...ticket });
  } catch (error) {
    next(error);
  }
}
