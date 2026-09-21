# Fase 2 — Login: contraseñas, tokens y rutas protegidas

> Criterio del plan: **"Sin login no se accede a nada."**
> Fecha: 21/09/2026.

---

## 0. Resumen de lo que ahora existe

**Backend**

| Archivo | Para qué |
|---|---|
| `server/src/models/User.js` | La forma del usuario y el hasheo de la contraseña |
| `server/src/validators/auth.validator.js` | Qué datos son aceptables (Zod) |
| `server/src/middleware/validate.js` | Aplica un esquema de Zod a un pedido |
| `server/src/services/auth.service.js` | Las reglas: verificar clave, firmar token |
| `server/src/controllers/auth.controller.js` | Traduce entre HTTP y el servicio |
| `server/src/routes/auth.routes.js` | `/login`, `/me`, `/cambiar-password` |
| `server/src/middleware/requireAuth.js` | El portero de las rutas protegidas |
| `server/scripts/crear-usuario.js` | Crea el usuario dueño desde la consola |
| `server/tests/auth.test.js` | 19 tests contra una base MongoDB real |

**Frontend**

| Archivo | Para qué |
|---|---|
| `client/src/api/client.js` | El único lugar que habla con el backend |
| `client/src/api/auth.js` | Una función por endpoint de auth |
| `client/src/context/AuthContext.jsx` | El estado "quién está logueado" |
| `client/src/components/RutaProtegida.jsx` | Manda al login si no hay sesión |
| `client/src/pages/Login.jsx` | La pantalla de login |
| `client/src/pages/Inicio.jsx` | Pantalla provisoria post-login |
| `client/src/App.jsx` | El mapa de pantallas (React Router) |
| `client/src/index.css` | Estilos base mobile-first |

> **Dos carpetas nuevas respecto al boceto del plan:** `server/src/validators/`
> (esquemas de Zod) y `client/src/context/` (estado compartido de React). El plan
> lista las carpetas principales con un "←" a modo de croquis, no como contrato
> cerrado; estas dos no encajaban en ninguna de las existentes sin mezclar
> responsabilidades.

---

## 1. Concepto central: nunca se guarda la contraseña

Esta es la idea más importante de toda la fase.

En la base **no se guarda** `"miClave123"`. Se guarda su **hash**:

```
$2b$12$GjJkTC26Euh8vKq.../nR4lZKqKp2mNvXyW8bQdEf1hGiJkLmNo
```

**Qué es un hash.** El resultado de una cuenta que va en **una sola dirección**:
de `"miClave123"` se puede sacar el hash, pero del hash **no** se puede volver a
`"miClave123"`. Si te roban la base, no se llevan las contraseñas.

**Entonces, ¿cómo se verifica el login?** No se "desencripta" nada. Se vuelve a
hashear lo que la persona escribió y se compara con el hash guardado. Si las dos
cuentas dan lo mismo, la contraseña era correcta.

### Las dos protecciones de bcrypt

**El "salt".** bcrypt agrega unos caracteres al azar, distintos para cada
contraseña, antes de hacer la cuenta. Consecuencia: **dos personas con la misma
contraseña tienen hashes distintos.** Sin salt, un atacante podría usar una tabla
gigante de hashes ya calculados (una *rainbow table*) y buscar coincidencias.

Está verificado en un test:

```js
it('dos usuarios con la MISMA contrasena tienen hashes distintos (salt)', ...)
```

**El costo.** `BCRYPT_ROUNDS = 12` define cuántas vueltas de cálculo hace. Cada
`+1` **duplica** el tiempo. Con 12 tarda ~250 ms en una PC normal.

Es lento **a propósito**. Para vos, 250 ms una vez por día es nada. Para alguien
que robó la base y quiere probar millones de contraseñas, son años. Ese es
exactamente el objetivo: hacer que la fuerza bruta no valga la pena.

### El campo escondido

```js
passwordHash: { type: String, required: true, select: false }
```

`select: false` significa que **por defecto las consultas no traen ese campo**. Si
el día de mañana alguien escribe `res.json(usuario)`, el hash no se escapa. Para
traerlo hay que pedirlo explícitamente:

```js
User.findOne({ username }).select('+passwordHash')
```

Es "seguro por defecto": para filtrarlo tenés que equivocarte activamente.

Además, el `toJSON` del modelo borra `passwordHash` y `__v`, y renombra `_id` a
`id`. Hay un test que revisa que la respuesta del login **nunca** contenga `$2b$`.

---

## 2. Concepto central: el token JWT

Problema a resolver: HTTP **no tiene memoria**. Cada pedido llega solo, sin saber
nada de los anteriores. Si el celular pide `/api/employees`, el servidor no tiene
forma de saber que hace dos minutos alguien se logueó.

La solución: después del login, el servidor entrega un **token** (un "pase"), y el
celular lo manda en cada pedido siguiente.

### Cómo es por dentro

Un JWT (JSON Web Token) es un texto con tres partes separadas por puntos:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 . eyJzdWIiOiI2YWIwYTM5YS...In0 . imXiVVswGRJzwM29R1qK0a5rODDI
└──────── cabecera ────────────────┘   └──────── contenido ──────┘   └────────── firma ──────────┘
```

**Las dos primeras partes NO son secretas.** Están en base64, que es una forma de
escribir, no de encriptar. Cualquiera las puede leer. En la verificación de esta
fase se decodificó el token a mano y salió esto:

```json
{
  "sub": "6ab0a39a18ed3cc9f2d963e5",
  "username": "dueno",
  "iat": 1789961290,
  "exp": 1792553290
}
```

- `sub` = *subject*, de quién es el token (el id del usuario).
- `iat` = *issued at*, cuándo se emitió.
- `exp` = cuándo vence.

**Por eso adentro va solo el id, nunca la contraseña.** Si pusiéramos algo secreto
ahí, estaría a la vista de cualquiera.

### Dónde está la seguridad: la firma

La tercera parte se calcula con `JWT_SECRET`, una clave que **solo conoce el
servidor**. La propiedad clave es:

> Cualquiera puede **leer** el token, pero nadie puede **fabricar** uno válido sin
> conocer el secreto.

Si alguien cambia el contenido (por ejemplo, pone el id de otro usuario), la firma
deja de coincidir y `jwt.verify()` lo rechaza. Verificado en la prueba end-to-end:

```
8. Token MANIPULADO     401 "Token invalido."
```

Y en un test: un token firmado con `'secreto-del-atacante'` también da 401.

### El secreto

Se generó con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

48 bytes al azar, en `server/.env` (que no se sube a Git). Si algún día
sospechás que se filtró, lo cambiás y **todos los tokens emitidos dejan de valer
al instante** — no hace falta tocar la base.

`JWT_EXPIRES_IN=30d`: la sesión dura 30 días. Es un equilibrio. Más corto es más
seguro pero obliga a escribir la clave seguido; para un solo dueño en su propio
celular, 30 días es razonable.

---

## 3. El portero: `requireAuth`

Es el middleware que protege las rutas. Hace cuatro cosas:

1. **Busca el token** en la cabecera `Authorization: Bearer <token>`.
   "Bearer" significa "portador": quien tenga este token, es el usuario. Es el
   formato estándar (RFC 6750).
2. **Verifica la firma y el vencimiento** con `jwt.verify()`.
3. **Confirma que el usuario siga existiendo** en la base. Este paso se olvida
   seguido: aunque la firma sea válida, el usuario pudo haber sido borrado
   después de que se emitió el token.
4. **Lo deja en `req.usuario`** y llama a `next()` para que siga el camino.

Si algo falla, responde 401 y el pedido **nunca llega al controlador**.

Los mensajes son distintos según el caso, porque el celular necesita distinguirlos:

| Situación | Respuesta |
|---|---|
| Sin cabecera | `401 "Falta el token de sesion. Inicia sesion de nuevo."` |
| Token vencido | `401 "Tu sesion vencio. Inicia sesion de nuevo."` |
| Firma inválida | `401 "Token invalido."` |
| Usuario borrado | `401 "El usuario de esta sesion ya no existe."` |

---

## 4. La barrera: "sin login no se accede a nada"

En `server/src/routes/index.js`:

```js
// PUBLICAS
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

// ───── BARRERA ─────
router.use(requireAuth);

// Todo lo de acá para abajo ya nace protegido:
// router.use('/employees', employeesRoutes);     // fase 3
// router.use('/productions', productionsRoutes); // fase 5
```

Como Express ejecuta los middlewares **en el orden en que se registran**, todo lo
que se agregue debajo de esa línea queda protegido **automáticamente**.

**Por qué es mejor que poner `requireAuth` en cada módulo:** si te olvidás de
ponerlo en un módulo nuevo, con este diseño igual queda protegido. El olvido
falla hacia el lado seguro. Con el otro diseño, el olvido deja una puerta abierta
y nadie se entera hasta que es tarde.

Verificado:

```
9.  GET /api/employees SIN token   401 "Falta el token de sesion..."
10. GET /api/employees CON token   404 "No existe la ruta GET /api/employees"
```

Fijate el detalle: **sin token no te dice ni siquiera si la ruta existe.** Con
token sí, porque ya sos de confianza. A un desconocido no le damos el mapa de la
API. Ese comportamiento cambió un test de la Fase 0 que esperaba 404 — se
actualizó para reflejar lo nuevo.

---

## 5. Detalles de seguridad que parecen menores y no lo son

### El mensaje de error del login es siempre el mismo

```js
const credencialesInvalidas = new ApiError(401, 'Usuario o contrasena incorrectos');
```

Si dijéramos *"ese usuario no existe"*, un atacante podría ir probando nombres
hasta encontrar el válido, y recién ahí concentrarse en la contraseña. Con un
mensaje único no aprende nada. Verificado:

```
2. Login con clave INCORRECTA   401 "Usuario o contrasena incorrectos"
3. Login usuario INEXISTENTE    401 "Usuario o contrasena incorrectos"
```

### El hasheo "al pedo" cuando el usuario no existe

```js
if (!user) {
  await User.hashearPassword(password);   // ← parece inútil, no lo es
  throw credencialesInvalidas;
}
```

Sin esta línea, el caso "usuario inexistente" respondería en 5 ms (no hay nada que
comparar) y el caso "contraseña incorrecta" en 250 ms (bcrypt tarda eso). Un
atacante que mide el tiempo de respuesta descubre qué usuarios existen, aunque el
mensaje sea idéntico. Eso se llama **timing attack**. Hasheando igual, los dos
casos tardan lo mismo.

### `.trim()` y `.toLowerCase()` en el usuario

En el esquema de Zod. "DUENO", " dueno " y "dueno" son el mismo usuario. Evita el
clásico "pero si la escribí bien" cuando el teclado del celular puso mayúscula
automática o quedó un espacio al copiar. Verificado:

```
5. Login OK (mayusculas + espacios)   200 token: eyJhbGciOiJIUzI1NiIsIn...
```

### No hay pantalla de registro

El plan dice: un solo usuario, creado con un script (sección 4.1). Y tiene todo el
sentido: si hubiera una pantalla de registro pública, cualquiera que encuentre la
URL podría crearse una cuenta y ver la plata de la fábrica.

---

## 6. Zod: validar antes de tocar la base

```js
export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Escribi tu usuario').toLowerCase(),
  password: z.string().min(1, 'Escribi tu contrasena'),
});
```

**¿Por qué validar, si Mongoose también valida?** Porque validan en momentos
distintos: Mongoose valida al **guardar**; Zod valida **antes de tocar la base**.

Y sobre todo: **nunca confíes en lo que manda el cliente.** Tu pantalla de React
puede tener todas las validaciones del mundo, pero cualquiera puede mandar un
pedido con Postman salteándose la pantalla entera. La validación del frontend es
comodidad; la del backend es la real.

El middleware `validate()` usa `safeParse`, que no lanza excepción sino que
devuelve `{ success, data }` o `{ success, error }`. Si está bien, **reemplaza
`req.body` por la versión ya limpia** (con el trim y el lowercase aplicados). Si
está mal, corta con un 400 y el detalle por campo:

```
4. Login SIN password (Zod)   400 [{"campo":"password","mensaje":"La contrasena es obligatoria"}]
```

Ese formato `{ campo, mensaje }` es a propósito: le permite al frontend pintar el
error justo debajo del input que corresponde.

---

## 7. El frontend

### `api/client.js` — el único lugar que habla con el backend

Todas las llamadas pasan por acá. Ventajas de centralizarlo:

- El token se agrega en **un solo lugar**. No hay que acordarse en cada pantalla.
- Los errores se traducen a una forma única (`ErrorApi`, con `status` y `detalles`).
- Si la sesión vence, se detecta una vez y se avisa a toda la app.

Un detalle que confunde al principio:

```js
try {
  respuesta = await fetch(...);
} catch {
  throw new ErrorApi('No se pudo conectar con el servidor...', { status: 0 });
}
```

**`fetch` solo entra al `catch` cuando no hubo respuesta**: sin internet, servidor
apagado, DNS caído. Un error 500 del servidor **no** cae ahí — para `fetch` eso es
una respuesta perfectamente válida, solo que con un código feo. Por eso hay que
chequear `respuesta.ok` aparte.

### Dónde se guarda el token: `localStorage`

`localStorage` es un almacén del navegador que sobrevive al cierre de la pestaña.
Por eso el dueño no tiene que escribir la clave cada vez que abre la app.

**La contra, dicha sin vueltas:** si alguien lograra inyectar JavaScript malicioso
en la página (un ataque XSS), podría leer `localStorage` y robarse el token. La
alternativa más segura es una cookie `httpOnly`, que el JavaScript no puede leer.

Se eligió `localStorage` porque en este caso concreto —un solo usuario, su propio
celular, sin contenido de terceros en la página— el riesgo es bajo y la
simplicidad vale. Si en el futuro la app crece, es el primer punto a revisar.

### `AuthContext` — el estado de la sesión

**Problema que resuelve:** la pantalla de Login necesita guardar el usuario, y la
barra de navegación necesita leerlo. Pasarlo por props de componente en componente
("prop drilling") es un dolor de cabeza.

Un **Context** de React es una variable compartida a la que cualquier componente de
adentro accede con un hook, sin recibirla por props.

Tres cosas que hace, y por qué:

**1. Al abrir la app, pregunta si el token guardado sigue valiendo.**

```js
const { usuario } = await authApi.obtenerSesion();   // GET /api/auth/me
```

Para eso existe `/api/auth/me`: *"este token que tengo guardado, ¿sirve?"*. Así la
sesión sobrevive a cerrar y abrir la app.

**2. El estado `cargando` arranca en `true`.**

Mientras se verifica el token no sabemos si hay sesión. Sin este estado, el dueño
vería **un parpadeo del login** cada vez que abre la app, antes de entrar. Detalle
chico, diferencia grande en cómo se siente.

**3. Si cualquier llamada devuelve 401, cierra la sesión sola.**

El `client.js` avisa (`alVencerSesion`) y el context reacciona. Así, cuando el
token venza en 30 días, la app va al login sola en vez de mostrar pantallas rotas.

### `RutaProtegida` — y por qué NO es seguridad

```jsx
if (!usuario) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
```

**Esto no es seguridad de verdad.** Cualquiera puede abrir las herramientas del
navegador y saltearlo. La seguridad real es la del backend (`requireAuth`): aunque
alguien fuerce la pantalla, la API no le devuelve ni un dato sin token válido.

`RutaProtegida` es **comodidad de uso**, no una barrera. Es importante tener clara
la diferencia: el error clásico es confiar en la protección del frontend y dejar
un endpoint abierto.

Dos detalles:

- `state={{ desde: ... }}` recuerda a dónde quería ir, para volver ahí después del
  login.
- `replace` evita que el botón Atrás lo devuelva a la pantalla protegida.

### La pantalla de Login

Sigue las pautas del plan (sección 7): botones de 52 px de alto (el mínimo
recomendado es 48), texto base de 17 px, alto contraste porque se usa al sol.

Detalles que valen la pena:

- **`evento.preventDefault()`** en el submit. Sin esto el navegador **recarga la
  página entera**, que es el comportamiento HTML de toda la vida. En una SPA no lo
  queremos.
- **`font-size: 1.05rem` en los inputs.** Si es menor a 16 px, iOS hace zoom
  automático al tocar el campo y descoloca toda la pantalla.
- **Botón "Ver" para la contraseña.** En un teclado de celular, escribir una clave
  a ciegas es la principal causa de "no me deja entrar".
- **Al fallar se borra la contraseña pero se conserva el usuario.** Es casi
  siempre la contraseña lo que estuvo mal.
- **`role="alert"`** en el mensaje de error: los lectores de pantalla lo anuncian
  solos.

---

## 8. Un problema real que apareció, y qué se aprendió

Durante la verificación, el login por HTTP devolvía 401 **con la contraseña
correcta**. Pero:

- los tests automáticos pasaban;
- llamando al servicio directamente, funcionaba;
- levantando la app en otro proceso, funcionaba.

Solo fallaba contra el servidor que estaba corriendo.

**La causa:** ese servidor estaba conectado a **otra base de datos** (la de Atlas,
donde todavía no existe ningún usuario), no a la base temporal de prueba. Se
confirmó mirando las conexiones de red del proceso.

**Por qué costó tanto encontrarlo:** el log decía

```
[mongo] Conectado a la base "ladrillera".
```

…y las dos bases se llaman igual. El mensaje era cierto y completamente inútil.

**Los dos arreglos que quedaron en el código:**

1. **El log ahora incluye el host**:
   `[mongo] Conectado a "ladrillera" en 127.0.0.1.`
   De un vistazo sabés contra qué base estás trabajando.

2. **Se maneja el error `EADDRINUSE`** (puerto ocupado) en `server.js`:

   ```
   [api] El puerto 4000 ya esta ocupado.
   [api] Seguramente hay otro servidor corriendo. Cerralo, o
   [api] cambia PORT en server/.env.
   ```

   Sin ese aviso el síntoma es traicionero: le pegás a `localhost:4000` y te
   contesta el servidor **viejo**, con la configuración vieja, y jurarías que tus
   cambios no se aplican.

**La lección, que vale para todo el proyecto:** cuando algo "imposible" pasa,
sospechá primero de *contra qué* estás corriendo (qué base, qué proceso, qué
archivo de configuración) antes que de la lógica. Y si un log no te deja
responder esa pregunta, ese log está incompleto.

Hay un tercer detalle que salió a la luz: como el error se crea una sola vez y se
reusa en dos `throw` distintos, el *stack trace* apunta siempre a la línea donde
se **creó**, no a la que lo lanzó. Es una decisión consciente (evita filtrar cuál
de los dos casos ocurrió), pero conviene saberlo para no perder tiempo leyendo mal
un stack.

---

## 9. Los tests

`npm test` corre **23 tests** contra un **MongoDB real pero descartable**.

### Por qué no se testea contra Atlas

- Es **rapidísimo** y no necesita internet.
- Arranca **vacío** en cada corrida: los tests siempre parten de lo mismo.
- **Cero riesgo** de borrar datos reales de la fábrica.

`tests/setup-global.js` lo levanta una vez, como **replica set** de un nodo.
¿Por qué replica set? Porque MongoDB solo permite **transacciones** en replica
sets, y desde la fase 4 las vamos a necesitar (plan 5.1: guardar una producción
es "todo o nada").

### La limpieza entre tests

```js
afterEach(async () => {
  // borra todas las colecciones
});
```

Así cada test es **independiente**: no importa el orden en que corran ni qué hizo
el anterior. Un test que pasa solo pero falla en grupo casi siempre es por falta
de esta limpieza.

### Qué cubren

| Grupo | Casos |
|---|---|
| Login | token correcto, mayúsculas, clave mala, usuario inexistente con el mismo mensaje, campos faltantes, nunca devuelve el hash |
| Rutas protegidas | sin token, token inventado, token firmado con otro secreto, token vencido, usuario borrado, token válido |
| Rutas inexistentes | 401 sin token, 404 con token |
| Cambiar contraseña | funciona y la vieja deja de servir, rechaza clave actual incorrecta, rechaza clave nueva corta |
| Modelo User | hashea de verdad, el salt hace hashes distintos, no permite usuarios duplicados |

Resultado:

```
Test Files  2 passed (2)
     Tests  23 passed (23)
```

---

## 10. Cómo se verificó a mano

Contra el servidor corriendo, con una base temporal (Atlas quedó intacta):

```
1.  GET /auth/me SIN token             401 "Falta el token de sesion. Inicia sesion de nuevo."
2.  Login con clave INCORRECTA         401 "Usuario o contrasena incorrectos"
3.  Login usuario INEXISTENTE          401 "Usuario o contrasena incorrectos"
4.  Login SIN password (Zod)           400 [{"campo":"password","mensaje":"La contrasena es obligatoria"}]
5.  Login OK (mayusculas + espacios)   200 token: eyJhbGciOiJIUzI1NiIsIn...
6.  Contenido legible del token        {"sub":"6ab0a39a...","username":"dueno","iat":...,"exp":...}
7.  GET /auth/me CON token             200 {"username":"dueno","id":"6ab0a39a..."}
8.  Token MANIPULADO                   401 "Token invalido."
9.  /api/employees SIN token           401 "Falta el token de sesion..."
10. /api/employees CON token           404 "No existe la ruta GET /api/employees"
```

Y en el navegador, a 375 px de ancho (tamaño de un celular):

| Prueba | Resultado |
|---|---|
| Entrar a `/` sin sesión | redirige a `/login` |
| Clave incorrecta | muestra el error, borra la clave, conserva el usuario |
| Clave correcta | entra a Inicio, muestra "dueno" y consulta `/api/health` con el token |
| Recargar la página | la sesión se mantiene (token en `localStorage`) |
| Botón "Salir" | borra el token y vuelve a `/login` |
| Token falsificado a mano | lo detecta, lo borra y vuelve a `/login` |

---

## 11. Lo que tenés que hacer vos

Crear tu usuario real en Atlas. **Elegí vos la contraseña** — no quedó ninguna
creada en tu base de producción.

```bash
npm run crear-usuario --workspace server
```

Te pregunta usuario y contraseña (la contraseña no se ve mientras la escribís; el
mismo truco que usa `sudo` en Linux). Pide mínimo 8 caracteres y la hace repetir
para evitar errores de tipeo.

Si el usuario ya existe, pregunta si querés cambiarle la contraseña en vez de
romper con un error.

Después:

```bash
npm run dev
```

y entrá a `http://localhost:5173`.

---

## 12. Dependencias que se sumaron

| Paquete | Dónde | Para qué |
|---|---|---|
| `bcrypt` | server | Hashear y verificar contraseñas |
| `jsonwebtoken` | server | Firmar y verificar los tokens |
| `zod` | server | Validar lo que llega del celular |
| `mongodb-memory-server` | server (dev) | La base descartable de los tests |
| `react-router-dom` | client | Las pantallas y las redirecciones |

`npm audit`: **0 vulnerabilidades**.

---

## 13. Estado del plan

Fase 2 completa, con su criterio cumplido y verificado: **sin login no se accede a
nada**, ni en el backend ni en el frontend.

Además quedaron listas dos cosas que el plan pide para más adelante:

- **`POST /api/auth/cambiar-password`**, que la pantalla de Ajustes de la fase 10
  va a usar tal cual.
- **La infraestructura de tests con base real**, que desde la fase 4 hace falta sí
  o sí para probar transacciones.

**Siguiente: Fase 3** — barra de navegación inferior, componentes base
(`BotonGrande`, `InputGs`), `utils/format.js` para los guaraníes, y el ABM de
empleados con soft delete.
