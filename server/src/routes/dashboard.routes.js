// -----------------------------------------------------------------------------
// dashboard.routes.js — La puerta del Inicio
// -----------------------------------------------------------------------------
// Va debajo de la barrera requireAuth (routes/index.js): ya nace protegido.
// -----------------------------------------------------------------------------

import { Router } from 'express';
import { getDashboard } from '../controllers/dashboard.controller.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const dashboardSchema = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha tiene que ser YYYY-MM-DD')
    .optional(),
});

const router = Router();

router.get('/', validate(dashboardSchema, 'query'), getDashboard);

export default router;
