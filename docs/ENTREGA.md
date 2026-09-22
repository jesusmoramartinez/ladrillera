# Entrega — lista de control

Todo lo que tiene que estar en orden **antes** de darle la app al cliente.
Marcá cada punto: los que están mal no rompen el deploy de entrada, se notan
recién cuando el dueño intenta usar algo.

---

## 1. Las dos piezas publicadas

El proyecto son **dos proyectos de Vercel separados**, no uno:

| Proyecto | Carpeta raíz | Qué es |
|---|---|---|
| Frontend | `client/` | la app que abre el dueño |
| Backend | `server/` | la API |

Están separados porque son dos cosas distintas: el frontend son archivos
estáticos que se sirven desde el borde de la red, y el backend son funciones que
corren por pedido. Si en Vercel el "Root Directory" de alguno de los dos no está
puesto, va a buildear el monorepo entero y fallar.

---

## 2. Variables de entorno

### Backend (proyecto `server`)

| Variable | Valor | Si falta… |
|---|---|---|
| `MONGODB_URI` | la cadena de Atlas, con `/ladrillera_db` al final | el proceso corta al arrancar |
| `JWT_SECRET` | larga y aleatoria | el proceso corta al arrancar |
| `CORS_ORIGIN` | **la URL exacta del frontend**, con `https://` y sin barra final | login "funciona" pero el navegador bloquea todas las respuestas |
| `NODE_ENV` | `production` | logs de desarrollo en producción |
| `TZ_NEGOCIO` | `America/Asuncion` | las fechas se corren un día |

Generar el `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> **`CORS_ORIGIN` es el que más se olvida.** El síntoma es desconcertante: el
> backend contesta bien (se ve en los logs de Vercel), pero en el celular todo
> falla con "no se pudo conectar". El navegador está descartando respuestas
> correctas porque el servidor no lo autorizó.

### Frontend (proyecto `client`)

| Variable | Valor |
|---|---|
| `VITE_API_URL` | la URL del backend, con `https://` y **sin** `/api` al final |

Ojo con esta: las variables `VITE_*` se leen **cuando se buildea**, no cuando
corre. Cambiarla en Vercel no tiene efecto hasta volver a desplegar.

Y si queda vacía, el frontend llama a `/api/...` sobre su propio dominio, donde
no hay backend: todo devuelve el `index.html` y los errores no tienen sentido.

---

## 3. MongoDB Atlas

- [ ] **Network Access**: permitir `0.0.0.0/0`. Vercel no tiene IPs fijas; sin
      esto la conexión se cuelga hasta el timeout y cada pedido tarda 10 s antes
      de fallar.
- [ ] El usuario de la base tiene permiso de **lectura y escritura** sobre
      `ladrillera_db`.
- [ ] La cadena de conexión termina en `/ladrillera_db`. Sin el nombre, Mongoose
      escribe en `test` y el día que mires Atlas no vas a encontrar nada.
- [ ] **Backups**: en el plan gratuito (M0) no hay. Si el cliente va a cargar
      meses de datos reales, conviene subir de plan o programar un `mongodump`.

---

## 4. Preparar la base antes de la entrega

Desde tu máquina, apuntando a la base **de producción**:

```bash
MONGODB_URI="<la cadena de Atlas>" npm run crear-usuario --workspace server
```

Eso crea el usuario del dueño. Es lo **único** que hay que hacer a mano: el
asistente de configuración inicial se encarga del resto (categorías, listas de
precio, stock y empleados) la primera vez que el dueño entra.

> No hace falta correr `seed`: el asistente lo llama solo.

**Elegí la contraseña con el dueño presente y que la cambie él desde Ajustes.**
Una contraseña que vos sepas es una contraseña que después hay que rotar.

---

## 5. Probar en el celular del dueño, no en la computadora

Con el teléfono que va a usar todos los días, con datos móviles (no wifi de la
oficina):

- [ ] Entra a la URL y aparece el **login**.
- [ ] Inicia sesión.
- [ ] Aparece el **asistente de configuración** (no el Inicio).
- [ ] Completa los cuatro pasos y guarda.
- [ ] Cae en el Inicio con **sus** números: su stock, su arcilla, su leña.
- [ ] Recarga la página: el asistente **no** vuelve a aparecer.
- [ ] Carga una producción de prueba y verifica que descuente la arcilla.
      Después anulala.
- [ ] El navegador ofrece **"Agregar a pantalla de inicio"**. Instalala.
- [ ] Abierta desde el ícono, **no se ve la barra del navegador**.
- [ ] El ícono en la pantalla de inicio es la pared de ladrillos, no una hoja
      en blanco.

> El punto del ícono y el de la barra son los que confirman que el service
> worker y el manifest quedaron bien. No se pueden probar en `localhost` ni
> desde una computadora: hacen falta HTTPS y un celular de verdad.

---

## 6. Lo que hay que decirle al cliente

**La app necesita internet.** No tiene modo sin conexión, y es a propósito: si
guardara datos para usarlos offline, le mostraría el saldo de ayer como si fuera
el de hoy. Usala con buena señal o con wifi.

**Es un solo usuario.** No hay pantalla de registro. Si necesita otro acceso,
hay que crearlo desde la consola.

**Todo lo que se anula deja rastro.** Nada se borra de verdad. Si anula una
compra, el sistema crea el movimiento inverso; el historial queda.

**Los sueldos se pagan el sábado.** La producción de cada día guarda la tarifa
que el empleado tenía *ese* día: cambiarle la tarifa hoy no le cambia lo que ya
trabajó.

**El ticket de sueldo se manda por WhatsApp** desde el botón verde, si el
empleado tiene el teléfono cargado. El sistema abre WhatsApp con el mensaje
escrito; **el envío lo hace él**, apretando el botón de siempre.

---

## 7. Después de la entrega

- [ ] Anotar la URL de la app y mandársela por WhatsApp (así la instala de nuevo
      si borra el ícono).
- [ ] Decirle que si algo no anda, `<la-url-del-backend>/api/health` dice si el
      problema es la base de datos.
- [ ] Acordar el **piloto de la fase 11**: una o dos semanas de uso real, y
      comparar una liquidación del sistema contra el cuaderno.
