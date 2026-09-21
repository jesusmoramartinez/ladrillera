// -----------------------------------------------------------------------------
// production.routes.js — Las puertas del modulo de produccion
// -----------------------------------------------------------------------------
// Va debajo de la barrera requireAuth (routes/index.js), asi que ya nace
// protegido.
// -----------------------------------------------------------------------------

import { Router } from 'express';
import {
  deleteProduction,
  getProductions,
  postProduction,
} from '../controllers/production.controller.js';
import { validate } from '../middleware/validate.js';
import {
  crearProduccionSchema,
  listarProduccionesSchema,
} from '../validators/production.validator.js';

const router = Router();

router.get('/', validate(listarProduccionesSchema, 'query'), getProductions);
router.post('/', validate(crearProduccionSchema), postProduction);
router.delete('/:id', deleteProduction);

export default router;
