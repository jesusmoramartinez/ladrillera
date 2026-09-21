// -----------------------------------------------------------------------------
// routes/index.js — Indice de toda la API
// -----------------------------------------------------------------------------
// Aca se juntan los routers de cada modulo. Este router se monta con el prefijo
// /api en app.js, asi que todo lo de abajo queda colgando de /api.
//
// IMPORTANTE — la "barrera" de seguridad:
// A mitad del archivo hay un `router.use(requireAuth)`. Como Express ejecuta
// los middlewares en el orden en que se registran, TODO lo que se agregue
// DEBAJO de esa linea queda protegido automaticamente. No hay que acordarse de
// poner requireAuth en cada modulo nuevo: si te olvidas, igual esta protegido.
// Es "seguro por defecto", que es justo al reves del error tipico de olvidarse
// de proteger una ruta.
// -----------------------------------------------------------------------------

import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import employeeRoutes from './employee.routes.js';
import {
  categoryRouter,
  inventoryRouter,
  priceListRouter,
  settingsRouter,
  transactionRouter,
} from './inventory.routes.js';
import productionRoutes from './production.routes.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// ---------------------------------------------------------------------------
// Rutas PUBLICAS (no piden token)
// ---------------------------------------------------------------------------

// /api/health — el hosting la llama para saber si la app esta viva, asi que no
// puede pedir token.
router.use('/health', healthRoutes);

// /api/auth — adentro, solo /login es publica; /me y /cambiar-password llevan
// requireAuth en su propia linea.
router.use('/auth', authRoutes);

// ---------------------------------------------------------------------------
// BARRERA: de aca para abajo, todo exige token
// ---------------------------------------------------------------------------
router.use(requireAuth);

router.use('/employees', employeeRoutes);
router.use('/inventory', inventoryRouter);
router.use('/transactions', transactionRouter);
router.use('/categories', categoryRouter);
router.use('/price-lists', priceListRouter);
router.use('/settings', settingsRouter);
router.use('/productions', productionRoutes);

// Proximas fases (ya nacen protegidas):
// router.use('/sales', salesRoutes);               // fase 6
// router.use('/advances', advancesRoutes);         // fase 7
// router.use('/payrolls', payrollsRoutes);         // fase 8

export default router;
