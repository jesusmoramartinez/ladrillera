// -----------------------------------------------------------------------------
// health.routes.js — Las "puertas" del modulo health
// -----------------------------------------------------------------------------
// Un Router es un mini-Express: agrupa rutas de un mismo tema y despues se
// engancha en un prefijo (ver routes/index.js).
// La ruta solo dice QUE URL llama a QUE controlador. Nada mas.
// -----------------------------------------------------------------------------

import { Router } from 'express';
import { getHealth } from '../controllers/health.controller.js';

const router = Router();

// GET /api/health
router.get('/', getHealth);

export default router;
