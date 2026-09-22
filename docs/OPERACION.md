# Cómo seguir a partir de acá

El sistema está entregado y el cliente lo está mirando. Este documento es lo que
viene después: cómo recibir sus cambios, cómo tocar el código sin romper nada,
cómo no perder los datos, y qué mirar si esto crece.

> Está escrito para leerlo en orden la primera vez, y después volver a la
> sección que haga falta.

---

## 0. Lo que cambió el día de la entrega

Una sola cosa, pero cambia todo lo demás:

> **La base de datos ya no es tuya. Tiene la plata de una fábrica de verdad.**

Hasta ayer, si rompías algo en `ladrillera_db` no pasaba nada: eran datos de
prueba tuyos. Desde que el cliente cargó su primera producción real, esa base es
su contabilidad. Perderla no es "volver a cargar unos datos": es que no sepa
cuánto le deben.

De ahí salen las dos reglas nuevas del proyecto:

1. **Nunca más desarrolles apuntando a la base real.** Ni "una prueba rápida".
2. **Respaldá antes de tocar nada.** Atlas gratis no hace respaldos.

Todo lo que sigue es consecuencia de esas dos.

---

## 1. El piloto (fase 11): qué mirar durante estos días

El plan pide una o dos semanas. Lo que vos ya tenés anotado —"un par de
modificaciones"— es exactamente el resultado esperado del piloto, no una señal
de que algo salió mal.

### El criterio que define si el sistema sirve

Del plan, fase 11: **"Una liquidación real coincide con el cuaderno."**

Ese es *el* test. No es un test automático: es que el sábado, el dueño calcule
los sueldos como siempre en su cuaderno, después mire lo que dice el sistema, y
que dé lo mismo. Si da lo mismo, el sistema le sirve. Si no, hay una regla de su
negocio que el sistema entendió mal, y eso es más importante que cualquier
pantalla.

**Pedile que no tire el cuaderno durante el piloto.** Que use los dos en
paralelo una semana. Es la única forma de comparar.

### Qué preguntarle (y qué no)

No sirve "¿te gustó?". Ya te dijo que sí. Lo que sirve:

- **"¿Qué hiciste hoy que te dio fastidio?"** — la fricción real, no la opinión.
- **"¿Hubo algo que no encontraste?"** — problemas de ubicación, no de
  funcionalidad.
- **"¿Algún número te pareció raro?"** — esto es lo más importante de todo. Un
  número que no cuadra es un bug de lógica, y son los únicos que hacen daño de
  verdad.
- **"¿Qué seguís anotando en papel?"** — eso es lo que el sistema todavía no
  cubre, dicho sin que él tenga que imaginarse una pantalla.

Esa última pregunta es la mejor. La gente no sabe pedir software, pero sabe
perfectamente qué sigue escribiendo a mano.

### Anotá también lo que NO usó

Si en una semana no abrió Clientes ni una vez, eso es información. Puede ser que
no le haga falta, o que no encuentre para qué sirve. Las dos respuestas cambian
qué hacés después, y ninguna aparece si solo escuchás lo que te pide.

---

## 2. Qué hacer con lo que el cliente pide

Acá es donde se pierden los proyectos. El cliente va a pedir cosas, vos las vas
a querer hacer todas, y en tres semanas el sistema va a tener veinte pantallas
que nadie usa y un bug que nadie encuentra.

**Clasificá cada pedido en uno de cuatro cajones, antes de tocar código:**

| Cajón | Qué es | Cuándo se hace |
|---|---|---|
| **Un número está mal** | el sistema calcula distinto al cuaderno | **ya**, antes que todo lo demás |
| **Fricción** | hace lo correcto pero cuesta: tres toques donde debería ser uno | en el orden en que le molesta |
| **Falta algo** | una función que no existe | después del piloto, junta |
| **No** | le cambiaría el modelo al sistema | se conversa, no se codea |

### Por qué los errores de cálculo van primero, siempre

Un botón mal puesto es incómodo. Un número mal calculado se le mete en la
contabilidad y **se queda ahí**. Si el sistema le liquidó mal un sueldo el
sábado, ese error ya está en un comprobante pagado, congelado (fase 8), y
arreglarlo después es mucho más caro que arreglarlo antes.

### El cajón "No" no es maleducado

Hay pedidos que suenan chicos y no lo son. Ejemplos reales que te van a llegar:

- *"¿Se puede usar sin internet?"* — es la decisión que ya tomaste, y por buenas
  razones (le mostraría el saldo de ayer como si fuera de hoy). La respuesta no
  es "no se puede", es **"no conviene, y te explico por qué"**.
- *"¿Puedo cambiar una producción de la semana pasada?"* — el sistema anula y
  registra el inverso, no edita. Es a propósito: así el historial explica los
  números. Editar hacia atrás haría que el stock de hoy dependa de algo que se
  puede reescribir.
- *"¿Puede entrar mi hijo con otro usuario?"* — esto sí es razonable, pero no es
  chico: hay que agregar usuarios, roles y decidir quién ve la caja. Es un
  proyecto, no un cambio.

**Decir "eso es para más adelante, anotémoslo" es parte del trabajo.** Un
sistema que hace ocho cosas bien vale más que uno que hace veinte a medias.

### Dónde anotar

No en un cuaderno tuyo. En el repo, para que quede con el código:

```bash
docs/PENDIENTES.md
```

Con tres cosas por pedido: qué pidió, **en qué cajón lo pusiste**, y por qué.
El "por qué" es el que te va a servir en dos meses cuando no te acuerdes.

---

## 3. Cómo hacer un cambio sin romper nada

Este es el flujo. Vale para un cambio de una línea y para uno de cien.

### 3.1. Antes de empezar: respaldá

```bash
npm run respaldar --workspace server
```

Con el `.env` apuntando a la base real. Deja un archivo en `server/respaldos/`.
Dos minutos que un día te van a salvar.

### 3.2. Rama aparte

```bash
git switch -c arreglo-tarifa-redondeo
```

Nunca directo en `main`. `main` es lo que está publicado y lo que el cliente
está usando **en este momento**.

### 3.3. Base descartable para probar

Levantás un MongoDB de prueba y arrancás pasando la variable **por delante**,
sin tocar tu `.env`:

```bash
MONGODB_URI="mongodb://127.0.0.1:27017/ladrillera_prueba" npm run dev --workspace server
```

Funciona porque `dotenv.config()` no pisa lo que ya está en el entorno: la
variable de afuera gana. Así no hay ningún momento en que tu `.env` apunte al
lugar equivocado, que es justo cuando pasan los accidentes.

> Si el cambio toca algo con transacciones (ventas, liquidación, producción,
> compras), un Mongo suelto no alcanza: las transacciones necesitan un *replica
> set*. Los tests ya levantan uno solos; para probar a mano, usá
> `mongod --replSet rs0` o pedime que te arme el script.

### 3.4. Escribí el test PRIMERO si es un número mal calculado

Si el cliente dice "esto me da 4.500.000 y tendría que dar 4.600.000":

1. Escribí un test con esos números exactos. **Tiene que fallar.**
2. Arreglá el código hasta que pase.

Al revés no sirve: si arreglás primero y el test lo escribís después, estás
escribiendo un test que confirma lo que acabás de hacer, no lo que el cliente
necesita. Y si el test no falló nunca, no sabés si prueba algo.

Los cálculos viven en `server/src/logic/` y son funciones puras: entran números,
salen números, no hay base de datos. Son las más fáciles de testear del
proyecto.

### 3.5. Antes de publicar, las cuatro cosas

```bash
npm test                          # 336 tests
npm run lint --workspace client
npm run build --workspace client
npm audit --omit=dev
```

Si alguna falla, no se publica. Sin excepciones: el cliente está usando `main`.

### 3.6. Probalo publicado ANTES de que lo vea el cliente

Vercel crea una **URL de preview** por cada rama que subís. Esa URL corre el
código nuevo pero —ojo— **contra la misma base que configuraste en las
variables del proyecto**, que es la real.

Entonces, para probar en serio sin riesgo, en Vercel:

1. Creá un tercer proyecto (o un entorno de "Preview") con su propia
   `MONGODB_URI`, apuntando a **otra base de Atlas** (`ladrillera_pruebas`).
2. Probá ahí, desde el celular.
3. Recién después, `merge` a `main`.

Es media hora de configuración, una sola vez, y es lo que separa "probé en mi
compu" de "probé como lo va a usar él".

### 3.7. Mergear y avisar

```bash
git switch main && git merge arreglo-tarifa-redondeo && git push
```

Vercel publica solo. Y **decile al cliente que recargue la app**: el service
worker trae la versión nueva en la siguiente recarga (por eso tiene
`skipWaiting`), pero si la tiene abierta desde ayer, sigue con la vieja.

---

## 4. Respaldos

**El riesgo más grande del proyecto, por lejos.** Atlas M0 (gratis) no hace
respaldos. Ninguno. No hay "restaurar a ayer".

### Los dos scripts

```bash
npm run respaldar --workspace server
npm run restaurar --workspace server -- server/respaldos/ARCHIVO.ejson
```

El respaldo queda en `server/respaldos/`, que está en `.gitignore`: son datos
reales del cliente y **no van a Git nunca**.

Guardan en EJSON (JSON con los tipos anotados) y no en JSON común a propósito:
JSON no sabe de `ObjectId` ni de `Date`. Guardaría los identificadores como
texto, y al restaurar las ventas quedarían apuntando al texto `"6ab1..."` en vez
de al `ObjectId` — todas las relaciones entre colecciones, rotas, en silencio.
Probé la vuelta completa: `ObjectId`, `Date`, booleanos y el hash de la
contraseña sobreviven intactos.

### Cada cuánto

| Cuándo | Por qué |
|---|---|
| **Antes de cada cambio que publiques** | es el momento en que vos podés romper algo |
| **Todos los sábados, después de liquidar** | es el dato más caro de la semana |
| **Antes de tocar cualquier cosa en Atlas** | cambiar un plan, un usuario, la red |

### Lo que casi nadie hace y hay que hacer

**Sacá el respaldo de tu computadora.** Drive, Dropbox, un pendrive, mandátelo
por mail a vos mismo. Un respaldo que vive en el mismo disco que se puede quemar
no es un respaldo, es una copia.

**Y probá restaurar una vez, ahora, antes de necesitarlo.** Contra una base
descartable:

```bash
MONGODB_URI="mongodb://127.0.0.1:27017/prueba_restore" \
  npm run restaurar --workspace server -- server/respaldos/ARCHIVO.ejson
```

La primera vez que alguien necesita restaurar es el peor momento posible para
descubrir que el script no funciona.

### Cuando el cliente pague un plan

Atlas M10 en adelante trae respaldos automáticos con *point-in-time recovery*
(volver a cualquier minuto de los últimos días). Cuando la fábrica tenga unos
meses de datos adentro, eso deja de ser un lujo. Hasta entonces, los scripts.

---

## 5. Mantenimiento

### Dependencias

Hoy: **0 vulnerabilidades**. Para que siga así, una vez por mes:

```bash
npm audit --omit=dev      # lo que importa: lo que corre en producción
npm outdated
```

Regla: **los parches y menores se actualizan tranquilo; los mayores, nunca antes
de un cambio que vayas a probar igual.** Hoy hay tres mayores esperando
(`mongoose` 9, `dotenv` 18, `concurrently` 10). Mongoose 9 es el que puede
doler: cambia cosas del comportamiento por defecto. No lo toques porque salió;
tocalo cuando tengas una tarde y ganas de correr los 336 tests.

### Node

El proyecto corre en Node 24. Vercel usa la versión que le digas; fijala en el
proyecto para que no te cambie sola un día. Node tiene soporte por unos dos años
por versión par: cuando la tuya se acerque al final, es un cambio de una línea
más los tests.

### Qué mirar cada tanto

| Dónde | Qué |
|---|---|
| Vercel → Logs | errores 500. Cada uno es un bug que alguien vivió |
| `<backend>/api/health` | si la base está conectada |
| Atlas → Metrics | cuánto espacio queda del medio giga |

### El health check es tu mejor herramienta de soporte

Cuando el cliente te escriba "no me anda", abrí esa URL antes de preguntar nada:

- **Contesta `ok: true`** → el backend y la base están bien. El problema es de
  él (señal, sesión vencida) o del frontend.
- **Contesta 503** → la base. Mirá Atlas.
- **No contesta** → el backend. Mirá Vercel.

Tres segundos y ya sabés dónde mirar, en vez de media hora de ida y vuelta.

---

## 6. Dos cosas del hosting que conviene saber ahora

### Vercel Hobby es para uso no comercial

El plan gratuito de Vercel, en sus términos, es para proyectos **personales y no
comerciales**. Un sistema que le facturás a un cliente y que usa una empresa para
gestionar su producción es, sin vueltas, uso comercial.

No te van a apagar la app mañana. Pero es un riesgo que no controlás, apoyado
sobre el sistema con el que una fábrica lleva sus sueldos. El plan Pro son unos
20 USD al mes.

**Dicho de otra forma:** vos dijiste que pagarías hosting "si escala el
proyecto". Esto no es una cuestión de escala, es una de términos de uso. Vale la
pena tenerlo en el radar antes de que sea urgente, y es un costo que se le pasa
al cliente sin problema: es menos de lo que gasta en combustible en un día.

### Los arranques en frío

En serverless no hay un servidor prendido: cada pedido puede caer en un proceso
recién creado, que tiene que conectarse a Mongo antes de contestar. El primer
pedido después de un rato de inactividad tarda más — uno o dos segundos.

Tu `config/database.js` ya lo maneja bien (guarda la conexión y la reusa), así
que solo lo paga el primero. Pero sabelo, porque el cliente lo va a notar cuando
abra la app a la mañana y te lo va a reportar como "a veces tarda".

**Ojo con una cosa:** el límite de duración de una función en el plan gratuito
es corto, y tu `serverSelectionTimeoutMS` está en 10 segundos. Si Atlas tarda en
responder en un arranque en frío, la función se puede morir justo en el borde,
con un error que no dice nada. Si ves 500 raros y salteados en los logs, es por
ahí: bajar ese timeout a 5 segundos hace que falle rápido y con mensaje claro,
en vez de agonizar.

---

## 7. Escalabilidad: qué se rompe primero (y cuándo)

Seamos concretos, porque "escalar" suele ser una preocupación mal dirigida.

### Una fábrica de ladrillos no va a estresar esto nunca

Hagamos la cuenta. Con carga diaria, seis días por semana:

| Colección | Por año | En 10 años |
|---|---|---|
| Producciones | ~300 | ~3.000 |
| Ventas | ~1.000 | ~10.000 |
| Movimientos de stock | ~3.000 | ~30.000 |
| Liquidaciones | 52 | 520 |

MongoDB maneja millones de documentos por colección sin transpirar. **Diez años
de esta fábrica entran cómodos en el medio giga del plan gratuito.** Los índices
ya están puestos (16, uno por cada consulta que hace el sistema), así que las
pantallas no se van a poner lentas por volumen.

Si alguna vez te preocupa: el dashboard responde en 20 ms hoy. Con cien veces
más datos, seguiría respondiendo en menos de medio segundo.

### Lo que sí se rompe, y no tiene nada que ver con el volumen

**1. Un solo usuario.** Es el límite real. Hoy hay un login y punto. El día que
el dueño quiera que el encargado cargue la producción pero **no vea la caja**,
hay que construir:

- usuarios y roles (`dueño`, `encargado`),
- un `requireRol` al lado del `requireAuth` que ya existe,
- y decidir qué esconde cada pantalla.

Es la ampliación más probable y la más grande. La barrera de `routes/index.js`
te deja el lugar hecho para engancharlo.

**2. Una sola fábrica.** Todo el sistema asume que hay una. Si mañana abre otra
sucursal, no es agregar un campo: es que **cada consulta del sistema** tiene que
filtrar por sucursal, y olvidarse en una sola mezcla los números de las dos. Si
esto aparece, se piensa de cero.

**3. El mes cerrado.** La caja calcula el balance del mes sumando todos los
movimientos, cada vez. Con diez años de datos sigue siendo rápido, pero el día
que el dueño quiera "cerrar" un mes y que no se pueda tocar más, eso es un
concepto nuevo (como las liquidaciones de la fase 8, que se congelan).

### Lo que NO hay que hacer "por si escala"

- **No agregues caché.** No hay problema de rendimiento que resolver. Un caché
  mal invalidado le muestra plata que no es, y ese sí es un problema.
- **No dividas en microservicios.** Es un sistema para una fábrica.
- **No agregues una cola de trabajos.** No hay nada que procesar en segundo
  plano.

Cada una de esas cosas agrega una forma nueva de fallar, y ninguna resuelve algo
que hoy exista.

---

## 8. Seguridad: lo razonable para el tamaño que tiene

Lo que ya está bien: contraseñas hasheadas con bcrypt, token firmado, la barrera
que deja todo protegido por defecto, y ninguna ruta pública que escriba.

Lo que conviene revisar:

- **La sesión dura 30 días.** Está bien para el celular del dueño. Si alguna vez
  entra desde una computadora compartida, es mucho. Se cambia con
  `JWT_EXPIRES_IN`.
- **La contraseña la elegiste vos.** Que la cambie él desde Ajustes, si todavía
  no lo hizo. Una que vos sepas es una que hay que rotar.
- **Si sospechás que se filtró el token**, cambiá `JWT_SECRET` en Vercel: eso
  invalida todas las sesiones de golpe y obliga a entrar de nuevo.
- **`server/.env` nunca a Git.** Está en `.gitignore` y así tiene que quedar. Si
  alguna vez se sube por accidente, no alcanza con borrarlo en el commit
  siguiente: hay que **rotar las credenciales de Atlas y el `JWT_SECRET`**,
  porque quedaron en el historial.

---

## 9. El orden en el que yo haría las cosas

Si mañana te sentás a trabajar en esto, así:

1. **Respaldá la base.** Ahora, antes que nada. Y probá restaurar una vez.
2. **Anotá los pedidos del cliente en `docs/PENDIENTES.md`**, cada uno con su
   cajón.
3. **Arreglá los errores de cálculo, si hay alguno.** Con un test que falle
   primero.
4. **Armá la base de pruebas en Atlas** (`ladrillera_pruebas`) y el entorno de
   preview en Vercel. Media hora, una vez, y cambia cómo trabajás para siempre.
5. **Esperá el sábado** y comparé la liquidación del sistema con el cuaderno.
   Ese es el criterio de la fase 11.
6. **Recién ahí** las mejoras de comodidad, en el orden en que le molestan a él.
7. **Después**, la conversación sobre Vercel Pro y si va a hacer falta más de un
   usuario.

---

## 10. Y una cosa que no es técnica

El cliente te dijo que le gustó y te pidió unos cambios. Eso es el mejor
resultado posible de una entrega: significa que **lo usó**, no que lo miró.

Los cambios que te pidió van a hacer el sistema mejor de lo que vos podías
haberlo diseñado solo, porque él sabe cosas de su fábrica que no están en ningún
plan. Escuchá los pedidos como información sobre el negocio, no como una lista
de tareas.

Y cuando la liquidación del sábado le dé igual que el cuaderno, decíselo. Ese es
el momento en que el sistema deja de ser tuyo y pasa a ser de él.

---

Ver también:
[`ENTREGA.md`](ENTREGA.md) (la lista de control del deploy) ·
[`explicaciones/`](explicaciones/) (cómo funciona cada parte y por qué) ·
[`PLAN_IMPLEMENTACION.md`](PLAN_IMPLEMENTACION.md) (el plan original).
