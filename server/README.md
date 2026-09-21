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

## Scripts

```bash
npm run dev --workspace server             # servidor con recarga automática
npm test                                   # tests (levanta un MongoDB descartable)
npm run crear-usuario --workspace server   # crea el usuario dueño
npm run seed --workspace server            # datos iniciales (categorías, listas, materiales)
```
