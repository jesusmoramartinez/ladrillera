// -----------------------------------------------------------------------------
// employee.routes.js — Las puertas del modulo de empleados
// -----------------------------------------------------------------------------
// Este router se monta DEBAJO de la barrera requireAuth (ver routes/index.js),
// asi que todas estas rutas ya exigen token sin tener que repetirlo aca.
// -----------------------------------------------------------------------------

import { Router } from 'express';
import {
  deleteEmployee,
  getEmployees,
  patchEmployee,
  postEmployee,
} from '../controllers/employee.controller.js';
import { validate } from '../middleware/validate.js';
import {
  crearEmpleadoSchema,
  editarEmpleadoSchema,
  listarEmpleadosSchema,
} from '../validators/employee.validator.js';

const router = Router();

router.get('/', validate(listarEmpleadosSchema, 'query'), getEmployees);
router.post('/', validate(crearEmpleadoSchema), postEmployee);
router.patch('/:id', validate(editarEmpleadoSchema), patchEmployee);
router.delete('/:id', deleteEmployee);

export default router;
