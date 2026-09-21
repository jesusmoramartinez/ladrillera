# Sistema de Gestión Ladrillera

Monorepo con el backend (API) y el frontend (PWA) del sistema de gestión para la
fábrica de ladrillos.

- `docs/` — MVP y plan de implementación.
- `server/` — API REST: Node.js + Express + MongoDB (Mongoose).
- `client/` — Interfaz mobile-first: React + Vite.

## Requisitos

- Node.js 20 o superior (`node --version`)
- Una base MongoDB: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (plan
  gratuito) o un MongoDB instalado en la PC.

## Puesta en marcha

```bash
npm install                       # instala server y client de una vez
cp server/.env.example server/.env   # y completar MONGODB_URI
npm run dev                       # levanta API (4000) y React (5173)
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta backend y frontend juntos |
| `npm run dev:server` | Solo la API, en `http://localhost:4000` |
| `npm run dev:client` | Solo React, en `http://localhost:5173` |
| `npm test` | Tests del backend (Vitest) |
| `npm run build` | Compila el frontend para producción |

Verificación rápida de que todo anda: `http://localhost:4000/api/health`.

## Estado

Fase 0 completa (entorno, monorepo, servidor Express con conexión a MongoDB).
Ver `docs/PLAN_IMPLEMENTACION.md`, sección 8, para las fases siguientes.
