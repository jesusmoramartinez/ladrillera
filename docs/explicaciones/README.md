# Explicaciones por fase

Una nota por fase, escrita para leer sin conocer las herramientas de antemano:
qué se construyó, **para qué sirve cada pieza** y por qué se eligió así.

| Fase | Archivo | Tema |
|---|---|---|
| 0 | [fase-0-entorno-y-servidor-base.md](fase-0-entorno-y-servidor-base.md) | Git, monorepo, Express, conexión a MongoDB |
| 2 | [fase-2-login.md](fase-2-login.md) | Contraseñas hasheadas, tokens JWT, rutas protegidas |
| 3 | [fase-3-layout-y-empleados.md](fase-3-layout-y-empleados.md) | Barra inferior, componentes base, formato de guaraníes, CRUD con soft delete |
| 4 | [fase-4-stock-y-caja.md](fase-4-stock-y-caja.md) | Transacciones de MongoDB, stock, caja, categorías, seed |
| 5 | [fase-5-produccion.md](fase-5-produccion.md) | Snapshot de tarifas, semana de pago, descuento de arcilla |
| 6 | [fase-6-ventas.md](fase-6-ventas.md) | Dato derivado vs guardado, pagos y entregas parciales, físico/comprometido/libre, agregaciones |
| 7 | [fase-7-adelantos.md](fase-7-adelantos.md) | Reutilizar piezas ya hechas, copiar vs apuntar (otra vez), lo que a propósito no se valida |

> La Fase 1 del plan (Express, `.env`, middleware de errores, `/api/health`) quedó
> cubierta dentro de la nota de la Fase 0.

El plan general está en [../PLAN_IMPLEMENTACION.md](../PLAN_IMPLEMENTACION.md).
