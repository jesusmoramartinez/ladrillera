// -----------------------------------------------------------------------------
// advance.routes.js — Las puertas del modulo de adelantos
// -----------------------------------------------------------------------------
// Va debajo de la barrera requireAuth (routes/index.js), asi que ya nace
// protegido.
// -----------------------------------------------------------------------------

import { Router } from 'express';
import {
  deleteAdvance,
  getAdvances,
  postAdvance,
} from '../controllers/advance.controller.js';
import { validate } from '../middleware/validate.js';
import {
  crearAdelantoSchema,
  listarAdelantosSchema,
} from '../validators/advance.validator.js';

const router = Router();

router.get('/', validate(listarAdelantosSchema, 'query'), getAdvances);
router.post('/', validate(crearAdelantoSchema), postAdvance);
router.delete('/:id', deleteAdvance);

export default router;
