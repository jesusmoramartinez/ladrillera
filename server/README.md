# server — API de la ladrillera

Node.js + Express + MongoDB (Mongoose).

## Cómo corre un pedido por dentro

```
Celular  ──▶  app.js (cors, json, logs)  ──▶  routes/  ──▶  controllers/
                                                                  │
                                                                  ▼
                                        models/  ◀──  services/  (reglas de negocio)
                                                          │
                                                          ▼
                                                      logic/  (cuentas puras)
```

Cada capa tiene un solo trabajo:

| Carpeta | Responsabilidad |
|---|---|
| `config/` | Leer el `.env` y conectar MongoDB |
| `models/` | La "forma" de cada documento (esquemas Mongoose) |
| `routes/` | Qué URL llama a qué controlador |
| `controllers/` | Recibir el pedido y responder |
| `services/` | Reglas de negocio (producción, liquidación…) |
| `logic/` | Funciones puras de cálculo, fáciles de testear |
| `middleware/` | Autenticación y manejo de errores |
| `tests/` | Tests con Vitest |

`app.js` arma la aplicación; `server.js` la conecta a la base y la prende.
Separarlas permite testear la API sin base de datos ni puerto abierto.

## Variables de entorno

Ver `.env.example`. El archivo `.env` real no se versiona.

## Endpoints

Todo lo que cuelga de `/api` requiere token, salvo `/api/health` y
`/api/auth/login` (ver la "barrera" en `src/routes/index.js`).

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado del servicio y de la base de datos |
| POST | `/api/auth/login` | Inicio de sesión, devuelve el token |
| GET | `/api/auth/me` | Datos del usuario del token |
| POST | `/api/auth/cambiar-password` | Cambio de contraseña |
| GET | `/api/employees` | Listar (`?activo=true` filtra) |
| POST | `/api/employees` | Crear |
| PATCH | `/api/employees/:id` | Editar los campos que se manden |
| DELETE | `/api/employees/:id` | Soft delete |
| GET | `/api/inventory` | Stock de los cuatro materiales + alerta de arcilla |
| GET | `/api/inventory/movimientos` | Historial de stock |
| POST | `/api/inventory/compras` | Compra: suma stock y genera el egreso |
| DELETE | `/api/inventory/compras/:id` | Anular compra (revierte todo) |
| POST | `/api/inventory/uso-lena` | Registrar leña quemada |
| POST | `/api/inventory/ajustes` | Corregir el stock (se manda cuánto HAY) |
| GET | `/api/transactions?mes=YYYY-MM` | Movimientos de caja + balance |
| POST | `/api/transactions/egreso` | Gasto manual |
| DELETE | `/api/transactions/:id` | Anular (solo gastos manuales) |
| GET/POST | `/api/categories` | Categorías de caja |
| PATCH/DELETE | `/api/categories/:id` | Renombrar / desactivar (no las de sistema) |
| GET/POST | `/api/price-lists` | Listas de precio |
| PATCH/DELETE | `/api/price-lists/:id` | Editar / desactivar |
| GET/PATCH | `/api/settings` | Configuración |
| GET | `/api/productions?semana=YYYY-MM-DD` | Producción de la semana + resumen |
| POST | `/api/productions` | Cargar el día (descuenta arcilla, suma ladrillos) |
| DELETE | `/api/productions/:id` | Anular (revierte el stock) |
| GET | `/api/clients` | Clientes con su saldo (`?conSaldo=true` filtra) |
| POST | `/api/clients` | Crear |
| PATCH/DELETE | `/api/clients/:id` | Editar / soft delete (bloqueado si debe algo) |
| GET | `/api/sales` | Ventas + totales (`?estado=por-cobrar\|por-entregar`, `?cliente=`) |
| GET | `/api/sales/:id` | Una venta con sus pagos y entregas |
| POST | `/api/sales` | Crear venta (atajos `pagadoCompleto` / `entregadoCompleto`) |
| DELETE | `/api/sales/:id` | Anular (solo si no tiene pagos ni entregas) |
| POST | `/api/sales/:id/pagos` | Registrar cobro (genera el ingreso de caja) |
| DELETE | `/api/sales/:id/pagos/:pagoId` | Anular cobro (anula su ingreso) |
| POST | `/api/sales/:id/entregas` | Registrar entrega (saca ladrillos del patio) |
| DELETE | `/api/sales/:id/entregas/:entregaId` | Anular entrega (los devuelve) |
| GET | `/api/advances?semana=YYYY-MM-DD` | Adelantos de la semana + resumen por empleado |
| POST | `/api/advances` | Dar adelanto (genera el egreso de caja) |
| DELETE | `/api/advances/:id` | Anular (anula su egreso) |
| GET | `/api/payrolls/preview?semana=YYYY-MM-DD` | Liquidación de la semana (no guarda nada) |
| POST | `/api/payrolls/:semana/pagar` | Cerrar la semana: egreso de sueldos + marca lo liquidado |
| GET | `/api/payrolls` | Historial de semanas liquidadas |
| GET | `/api/payrolls/:id/ticket/:employeeId` | Ticket + texto y número listos para WhatsApp |
| GET | `/api/dashboard` | Todos los datos del Inicio en un solo pedido |
| GET | `/api/setup` | Si la configuración inicial ya se hizo |
| POST | `/api/setup` | Guardar toda la configuración inicial (una sola vez) |

## Scripts

```bash
npm run dev --workspace server             # servidor con recarga automática
npm test                                   # tests (levanta un MongoDB descartable)
npm run crear-usuario --workspace server   # crea el usuario dueño
npm run seed --workspace server            # datos iniciales (categorías, listas, materiales)
npm run respaldar --workspace server       # copia de toda la base a server/respaldos/
npm run restaurar --workspace server -- <archivo>   # vuelve la base a un respaldo
```

Para preparar la base de producción y entregarle el sistema al cliente, ver
[`../docs/ENTREGA.md`](../docs/ENTREGA.md). Resumen: lo único que hay que correr
a mano es `crear-usuario`; el resto lo hace el asistente de configuración
inicial la primera vez que el dueño entra.

Para trabajar sobre el sistema ya entregado —recibir cambios, publicarlos sin
romper nada, respaldos y mantenimiento— ver
[`../docs/OPERACION.md`](../docs/OPERACION.md).

> **Atlas gratuito (M0) no hace respaldos.** Desde que la base tiene datos
> reales del cliente, `respaldar` va antes de cada cambio que publiques y todos
> los sábados después de liquidar. La carpeta `server/respaldos/` está en
> `.gitignore`: son datos del cliente y no van a Git.
