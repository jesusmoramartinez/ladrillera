// -----------------------------------------------------------------------------
// setup.routes.js — Las puertas del asistente de configuracion inicial
// -----------------------------------------------------------------------------
// Va debajo de la barrera requireAuth (routes/index.js). Podria parecer que el
// asistente tendria que ser publico "porque es lo primero que se usa", pero no:
// el dueno ya tiene su usuario creado desde la consola antes de la entrega, y
// una ruta publica que escribe precios y stock seria un regalo para cualquiera
// que encuentre la direccion.
// -----------------------------------------------------------------------------

import { Router } from 'express';
import { getSetup, postSetup } from '../controllers/setup.controller.js';
import { validate } from '../middleware/validate.js';
import { configuracionInicialSchema } from '../validators/setup.validator.js';

const router = Router();

router.get('/', getSetup);
router.post('/', validate(configuracionInicialSchema), postSetup);

export default router;
