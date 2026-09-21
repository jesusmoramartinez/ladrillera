// -----------------------------------------------------------------------------
// routes/index.js — Indice de toda la API
// -----------------------------------------------------------------------------
// Aca se juntan los routers de cada modulo. Cuando agreguemos empleados,
// producciones, ventas, etc., cada uno se suma con una linea:
//
//   router.use('/employees', employeesRoutes);
//
// Este router se monta con el prefijo /api en app.js, asi que todo lo de abajo
// queda colgando de /api (ej: /api/health).
// -----------------------------------------------------------------------------

import { Router } from 'express';
import healthRoutes from './health.routes.js';

const router = Router();

router.use('/health', healthRoutes);

export default router;
