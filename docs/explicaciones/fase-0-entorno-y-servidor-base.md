# Fase 0 — Entorno, monorepo y servidor base

> Cubre también la Fase 1 del plan (Express, `.env`, middleware de errores, `/api/health`).
> Fecha: 20/09/2026.

---

## 1. El repositorio Git

```bash
git init -b main
```

**Qué es Git.** Un sistema de control de versiones: una máquina del tiempo para el
código. Cada "commit" es una foto completa del proyecto. Si mañana rompés algo,
volvés a la foto de ayer. Si querés probar una idea arriesgada, hacés una rama
(`branch`), probás, y si no funciona la tirás sin haber tocado lo que andaba.

El `-b main` crea la rama principal llamada `main` (antes se llamaba `master`;
hoy la convención es `main`).

### `.gitignore` — qué NO se guarda

```
node_modules/
.env
dist/
```

Le dice a Git "estos archivos ni los mires". Tres motivos:

- **`node_modules/`** son las librerías descargadas: miles de archivos, cientos
  de MB. No se versionan porque se **reconstruyen** con `npm install` a partir de
  `package.json`. Subirlas sería mandar el mueble armado en vez del instructivo.
- **`.env`** tiene los secretos: la clave de la base, la clave de los tokens. Si
  eso llega a GitHub, cualquiera entra a tu base. Pasa **constantemente** en
  proyectos reales: hay bots que escanean GitHub buscando claves filtradas.
- **`dist/`** es el resultado de compilar. Igual que `node_modules`: se regenera.

### `.gitattributes` — finales de línea

Windows termina cada línea con dos caracteres invisibles (`CRLF`), Linux y Mac
con uno (`LF`). Sin este archivo, cuando el proyecto pase de Windows al servidor
Linux, Git cree que **cambiaron todas las líneas de todos los archivos** y los
diffs se vuelven ilegibles. La línea `* text=auto eol=lf` dice: "en el
repositorio, siempre LF".

### El commit

Commit inicial con 39 archivos. `server/.env` **no** entró; se verificó:

```
git check-ignore -v server/.env
.gitignore:5:.env	server/.env
```

Traducción: "la línea 5 del `.gitignore` es la que lo bloquea".

---

## 2. La estructura del monorepo

**Monorepo** = un solo repositorio con las dos mitades del sistema. La
alternativa serían dos repos separados. Con un monorepo, un cambio que toca las
dos partes (agregás un campo a "empleado" y también el input en la pantalla)
entra en **un solo commit**, y nadie puede bajar una mitad sin la otra.

```
ladrillera/
├── docs/          ← el MVP y el plan
├── server/        ← la API
├── client/        ← la pantalla
└── package.json   ← el "director de orquesta"
```

### `package.json` raíz y los *workspaces*

```json
"workspaces": ["server", "client"]
```

Una función de npm que convierte a `server` y `client` en subproyectos hermanos.
En la práctica da dos cosas:

1. **Un solo `npm install`** en la raíz instala las dependencias de los dos. Y si
   ambos usan la misma librería, npm la guarda **una sola vez**.
2. **Comandos centralizados**: `npm run dev --workspace server` ejecuta el script
   `dev` definido adentro de `server/package.json`.

El script estrella:

```json
"dev": "concurrently \"npm run dev --workspace server\" \"npm run dev --workspace client\""
```

`concurrently` corre dos comandos **a la vez** en la misma terminal, con prefijos
de color (`[SERVER]` azul, `[CLIENT]` magenta). Sin ella necesitarías dos
terminales abiertas y te olvidarías una corriendo de fondo.

### Las carpetas vacías con `.gitkeep`

**Git no versiona carpetas, solo archivos.** Una carpeta vacía no existe para
Git. Poniendo un archivo vacío adentro, la carpeta sobrevive al commit y la
estructura queda armada esperando el código de las próximas fases.

---

## 3. El servidor Express

### El viaje de un pedido

```
Celular                                                     MongoDB
   │                                                           ▲
   │ GET /api/health                                           │
   ▼                                                           │
app.js ──▶ cors ──▶ json ──▶ morgan ──▶ routes/ ──▶ controllers/
   │                                                     │
   └──────────────── respuesta JSON ◀────────────────────┘
```

### `config/env.js` — leer los secretos

El archivo `.env` es texto plano con formato `CLAVE=valor`. La librería **dotenv**
lo lee y mete cada línea en `process.env`.

Se podría escribir `process.env.MONGODB_URI` directo en cada archivo. No se hizo
por dos razones:

1. **Falla temprano y con mensaje claro.** `requerida()` chequea al arrancar que
   la variable exista. Si falta, el programa muere en el segundo 0 diciendo
   *"Falta la variable MONGODB_URI"*. Sin eso, arrancaría bien y explotaría media
   hora después con un `Cannot read property 'replace' of undefined`.
2. **Un solo lugar** donde ver toda la configuración que necesita la app.

Detalle técnico que vas a cruzarte: en módulos ES (`import`/`export`) **no existe**
la variable mágica `__dirname`. Por eso:

```js
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

`import.meta.url` es la URL de ese archivo; lo convertimos a ruta y le sacamos el
nombre. Sirve para armar la **ruta absoluta** al `.env`, así funciona sin importar
desde qué carpeta ejecutes `node`.

### `config/database.js` — la conexión a MongoDB

**Qué es MongoDB.** Una base que guarda **documentos** (parecidos a JSON) dentro
de **colecciones** (parecidas a tablas):

```json
{ "nombre": "Juan", "tarifaPorMil": 150000, "activo": true }
```

Encaja bien con este caso: una producción tiene un **array** de trabajadores
adentro, y una venta tiene arrays de pagos y entregas. En SQL serían tres tablas
más con sus JOINs.

**Qué es Mongoose.** La librería que habla con MongoDB desde Node. Además de
conectar, define la "forma" de cada documento y valida antes de guardar.

Tres decisiones del archivo:

```js
mongoose.set('strictQuery', true);
```

Si filtrás por un campo que no existe en el esquema, Mongoose lo **ignora** en vez
de traerte datos de más. Preferís no traer nada antes que traer todo.

```js
serverSelectionTimeoutMS: 10_000
```

Si la base no responde en 10 segundos, falla con error claro. Sin esto el
servidor queda colgado y no sabés si está pensando o murió.

**Los escuchadores de eventos** (`'error'`, `'disconnected'`, `'reconnected'`)
avisan por consola si la conexión se cae mientras el servidor sigue andando.
Mongoose reintenta solo, pero vos querés **enterarte**. En la fábrica, con
internet inestable, esto sirve.

> **Agregado después:** el log de conexión ahora muestra también el **host**
> (`[mongo] Conectado a "ladrillera" en 127.0.0.1`). El nombre de la base suele ser
> el mismo en desarrollo y en producción, así que sin el host es facilísimo creer
> que estás trabajando contra una base cuando en realidad estás contra otra. Esto
> se agregó justamente porque pasó (ver la nota de la Fase 2, sección 8).

### `middleware/errorHandler.js` — que los errores no ensucien

**Qué es un middleware.** Una función que Express ejecuta *en el medio del camino*
entre que llega el pedido y que sale la respuesta. Una fila de filtros: cada
pedido los atraviesa en orden, y cada uno puede modificarlo, rechazarlo o
dejarlo pasar.

Tres piezas:

- **`ApiError`**: error con código HTTP adentro. Desde cualquier servicio:
  `throw new ApiError(404, 'El empleado no existe')`.
- **`notFoundHandler`**: si el pedido recorrió toda la fila sin que ninguna ruta
  lo atendiera, responde `404` **en JSON**. Sin esto, Express devuelve HTML — y el
  celular espera JSON.
- **`errorHandler`**: atrapa *todos* los errores y responde siempre el mismo
  formato `{ ok: false, error: "..." }`. Traduce los errores típicos:

| Error | Código | Significado |
|---|---|---|
| `ZodError` | 400 | Los datos que llegaron no cumplen el esquema |
| `ValidationError` (Mongoose) | 400 | Los datos que mandaste están mal |
| `CastError` | 400 | El ID tiene formato inválido (ej. `/employees/abc`) |
| `code: 11000` | 409 | Clave duplicada, ese registro ya existe |
| cualquier otro | 500 | Bug nuestro |

**Detalle de Express que confunde a todo el mundo:** Express sabe que una función
es manejador de errores porque **recibe cuatro parámetros** (`err, req, res, next`).
Si le sacás el `next` y dejás tres, lo trata como middleware normal y nunca atrapa
nada. No es opcional aunque no lo uses.

Decisión de seguridad: el `stack` (dónde explotó el código) solo se muestra en
desarrollo. En producción es darle a un atacante un mapa de tu servidor.

### `app.js` vs `server.js` — por qué están separados

La decisión de arquitectura más importante de la fase.

- **`app.js` arma la aplicación pero no la prende.** Configura middlewares,
  engancha rutas, exporta el objeto.
- **`server.js` la prende.** Conecta la base, abre el puerto, maneja el apagado.

¿Por qué molestarse? **Porque los tests importan `app.js` y le pegan a las rutas
sin abrir ningún puerto.** Si estuviera todo junto, cada test tendría que levantar
un servidor real — lento, frágil, y dos tests en paralelo se pelearían por el puerto.

El **orden** de los middlewares importa, porque Express los ejecuta de arriba
hacia abajo:

```js
app.use(cors(...))              // 1
app.use(express.json(...))      // 2
app.use(morgan(...))            // 3
app.use('/api', apiRoutes)      // 4
app.use(notFoundHandler)        // 5
app.use(errorHandler)           // 6  ← siempre último
```

1. **CORS** (*Cross-Origin Resource Sharing*). Por seguridad, el navegador
   **bloquea** que una página de un dominio llame a otro. Tu React vive en
   `localhost:5173` y tu API en `localhost:4000`: para el navegador son dos
   orígenes distintos. Este middleware manda la cabecera que autoriza al frontend.
2. **`express.json()`**. El cuerpo de un POST llega como texto. Esto lo convierte
   en objeto y lo deja en `req.body`. **Sin este middleware, `req.body` llega
   `undefined`** — uno de los errores más comunes al empezar con Express. Límite
   de 1 MB para que nadie te tire abajo el servidor con un JSON de 500 MB.
3. **morgan**: escribe en consola cada pedido (`GET /api/health 200 3.032 ms`).
   Impagable para debuggear. Apagado durante los tests.
4. Las rutas, montadas bajo `/api`.
5. y 6. Los manejadores de error al final, porque solo se ejecutan si nada
   anterior respondió.

En `server.js`, el arranque es **secuencial a propósito**:

```js
await conectarBaseDeDatos();   // primero
app.listen(env.port, ...)      // recién después
```

Si escuchara primero, el primer pedido encontraría la base a medio conectar.

Y el **apagado ordenado**: al hacer `Ctrl+C`, el sistema manda la señal `SIGINT`.
En vez de morir de golpe, el servidor deja de aceptar pedidos nuevos, cierra la
conexión a Mongo, y recién ahí se va. Sin esto dejás conexiones colgadas — y
Atlas gratuito tiene un límite de conexiones simultáneas.

> **Agregado después:** también se maneja el error `EADDRINUSE` (puerto ocupado).
> Ver la nota de la Fase 2, sección 8: es un problema que cuesta caro cuando no
> está avisado.

### `routes/` y `controllers/` — las capas

El plan pide `route → controller → service → model`. Cada archivo con **un solo
trabajo**:

- **La ruta** solo dice *qué URL llama a qué función*. Es un índice, sin lógica.
- **El controlador** recibe el pedido y responde. No hace cuentas de negocio.
- **El servicio** tiene las reglas de negocio.
- **`logic/`** son funciones puras de cálculo: entra un número, sale un número,
  sin tocar la base. Trivialmente testeables. Ahí va a vivir el cálculo de
  sueldos, el descuento de arcilla, el redondeo de guaraníes.

Ventaja concreta: cuando cambie cómo se calcula un sueldo, tocás **un archivo en
`logic/`**, no la fórmula desparramada entre rutas y pantallas.

### El endpoint `/api/health`

```json
{
  "ok": true,
  "servicio": "api-ladrillera",
  "entorno": "development",
  "baseDeDatos": "conectado",
  "uptimeSegundos": 6,
  "hora": "2026-09-21T02:36:03.958Z"
}
```

No es decorativo:

1. **Probar de una que la API arrancó**, abriendo esa URL en el navegador.
2. **Saber si la base está conectada sin entrar a la base.**
3. **Cuando publiques**, el hosting (Render, Railway) lo va a llamar cada tanto
   para saber si la app sigue viva. Si deja de responder, la reinicia solo.

Devuelve `200` si la base está conectada y `503` (*Service Unavailable*) si no.
Esa distinción es la que le permite al hosting tomar la decisión correcta.

---

## 4. El cliente y el proxy

`client/` se armó con Vite + React (`npm create vite`), con las carpetas que pide
el plan (`pages/`, `components/`, `api/`, `utils/`), más esto en `vite.config.js`:

```js
proxy: { '/api': { target: 'http://localhost:4000' } }
```

**Qué hace.** El frontend llama a `/api/health` (su propio origen, el 5173) y Vite
reenvía el pedido al backend del 4000. El navegador nunca se entera de que hay
dos servidores.

**Por qué importa:**

- En desarrollo no hay problemas de CORS: para el navegador todo viene del mismo lugar.
- **El código de React no lleva la URL del backend escrita adentro.** Escribís
  `fetch('/api/employees')` y listo. En producción, con el backend en
  `api.tudominio.com`, no tocás ni una línea de React.

---

## 5. Cómo se verificó

**Tests automáticos** (Vitest + supertest): `/api/health` responde bien formado, y
una ruta inexistente devuelve 404 **en JSON y no en HTML**.

**La conexión real a MongoDB.** En ese momento no había MongoDB en la PC ni cuenta
de Atlas, así que se levantó una **base temporal y descartable**
(`mongodb-memory-server`) y se corrió el código real contra ella:

```
Antes de conectar   -> desconectado
[mongo] Conectado a la base "ladrillera".
Después de conectar -> conectado
GET /api/health -> 200 {"ok":true,...,"baseDeDatos":"conectado",...}
```

**El stack completo con `npm run dev`:**

```
A través del proxy de Vite -> GET localhost:5173/api/health  ->  200  conectado
Directo a la API           -> GET localhost:4000/api/health  ->  200  conectado
React (Vite)               -> GET localhost:5173/            ->  200  sirve la app
Ruta inexistente           -> 404 {"ok":false,"error":"No existe la ruta ..."}
```

**El fallo también se probó**, que es igual de importante. Con la base apagada:

```
[api] No pude arrancar: connect ECONNREFUSED 127.0.0.1:27017
[api] Revisá MONGODB_URI en server/.env y tu conexión a internet.
```

Muere rápido y dice exactamente dónde mirar.

---

## 6. Dos cambios sobre la marcha

- **Vitest 3 → 5.** `npm audit` reportó una vulnerabilidad moderada (lectura
  arbitraria de archivos) en la 3. La API que usamos (`describe`/`it`/`expect`) es
  idéntica. Ahora: `found 0 vulnerabilities`.
- **Los dos `.md` sueltos** en la raíz se movieron a `docs/`, como los ubica el plan.

---

## 7. Comandos de la fase

```bash
npm install                          # instala server y client de una vez
npm run dev                          # API (4000) + React (5173)
npm run dev:server                   # solo la API
npm run dev:client                   # solo React
npm test                             # tests del backend
npm run build                        # compila el frontend para producción
```

Verificación rápida: `http://localhost:4000/api/health` tiene que decir
`"baseDeDatos": "conectado"`.
