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

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado del servicio y de la base de datos |
