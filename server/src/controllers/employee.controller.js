// -----------------------------------------------------------------------------
// employee.controller.js — HTTP <-> servicio
// -----------------------------------------------------------------------------
// Cada funcion: saca los datos del pedido, llama al servicio, arma la respuesta.
// Si el servicio lanza, se lo pasamos al errorHandler con next(error).
// -----------------------------------------------------------------------------

import * as employeeService from '../services/employee.service.js';

export async function getEmployees(req, res, next) {
  try {
    // validate() dejo la query ya validada aca (en Express 5, req.query es de
    // solo lectura, asi que no se puede reemplazar en el lugar).
    const { activo } = req.datosValidados ?? {};
    const empleados = await employeeService.listar({ soloActivos: activo === 'true' });
    res.json({ ok: true, empleados });
  } catch (error) {
    next(error);
  }
}

export async function postEmployee(req, res, next) {
  try {
    const empleado = await employeeService.crear(req.body);
    // 201 = "Created". Es el codigo correcto cuando se crea algo nuevo; 200
    // tambien "funciona", pero 201 le dice al cliente que ahora existe un
    // recurso que antes no estaba.
    res.status(201).json({ ok: true, empleado });
  } catch (error) {
    next(error);
  }
}

export async function patchEmployee(req, res, next) {
  try {
    const empleado = await employeeService.editar(req.params.id, req.body);
    res.json({ ok: true, empleado });
  } catch (error) {
    next(error);
  }
}

export async function deleteEmployee(req, res, next) {
  try {
    const empleado = await employeeService.eliminar(req.params.id);
    // Devolvemos el empleado (ya con deletedAt) en vez de un 204 vacio: al
    // frontend le sirve para confirmar cual se elimino.
    res.json({ ok: true, empleado });
  } catch (error) {
    next(error);
  }
}
