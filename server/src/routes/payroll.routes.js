// -----------------------------------------------------------------------------
// payroll.routes.js — Las puertas del modulo de liquidaciones
// -----------------------------------------------------------------------------
// Va debajo de la barrera requireAuth (routes/index.js), asi que ya nace
// protegido.
// -----------------------------------------------------------------------------

import { Router } from 'express';
import {
  getPayrolls,
  getPreview,
  getTicket,
  postPagar,
} from '../controllers/payroll.controller.js';
import { validate } from '../middleware/validate.js';
import { previewSchema } from '../validators/payroll.validator.js';

const router = Router();

// /preview va ANTES que /:id, porque Express prueba en orden y ":id" se
// comeria la palabra "preview".
router.get('/preview', validate(previewSchema, 'query'), getPreview);
router.get('/', getPayrolls);

router.post('/:semana/pagar', postPagar);
router.get('/:id/ticket/:employeeId', getTicket);

export default router;
