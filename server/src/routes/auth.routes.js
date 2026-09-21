// -----------------------------------------------------------------------------
// auth.routes.js — Las puertas del modulo de autenticacion
// -----------------------------------------------------------------------------
// Fijate el orden de los middlewares en cada linea: se ejecutan de izquierda a
// derecha. En /cambiar-password primero se exige el token (requireAuth) y
// recien despues se validan los datos.
// -----------------------------------------------------------------------------

import { Router } from 'express';
import { getMe, postCambiarPassword, postLogin } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { cambiarPasswordSchema, loginSchema } from '../validators/auth.validator.js';

const router = Router();

// POST /api/auth/login  — publica: es la unica forma de conseguir un token.
router.post('/login', validate(loginSchema), postLogin);

// GET /api/auth/me  — protegida: dice quien sos segun tu token.
router.get('/me', requireAuth, getMe);

// POST /api/auth/cambiar-password — protegida.
router.post('/cambiar-password', requireAuth, validate(cambiarPasswordSchema), postCambiarPassword);

export default router;
