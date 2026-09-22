// -----------------------------------------------------------------------------
// sw.js — El service worker. LEER ESTO ANTES DE TOCARLO.
// -----------------------------------------------------------------------------
// Un service worker es un programita que el navegador deja instalado y que se
// mete en el medio de TODOS los pedidos que hace la pagina. Es lo que permite
// que una web se instale como app en el celular.
//
// QUE HACE ESTE, Y QUE NO HACE
//
// Hace dos cosas, nada mas:
//   1. Existir, para que el celular ofrezca "Agregar a pantalla de inicio" y la
//      app se abra sin la barra del navegador.
//   2. Guardar los archivos del programa (JavaScript y CSS) para que la segunda
//      vez que se abre arranque al toque, sin volver a bajarlos.
//
// NO GUARDA DATOS, Y ESO ES UNA DECISION, NO UN OLVIDO.
//
// El dueno pidio expresamente que NO haya modo sin conexion. Tiene sentido:
// esta app maneja plata y stock. Un "modo offline" mostraria el saldo de ayer
// como si fuera el de hoy, y aceptaria cargas que quedarian esperando en una
// cola invisible. Que el dueno cobre mal un sueldo por un numero viejo es
// muchisimo peor que ver "no hay internet" y esperar treinta segundos.
//
// En concreto: todo lo que vaya a /api/ pasa DERECHO a la red. Este archivo ni
// lo mira. Si no hay senal, la pantalla dice que no hay senal. Es lo correcto.
//
// Tampoco hay pagina de "estas sin conexion": el navegador ya muestra la suya,
// y una nuestra solo agregaria una pantalla mas que mantener.
// -----------------------------------------------------------------------------

// El nombre lleva version. Cambiarlo es la forma de tirar todo lo viejo cuando
// se publica una version nueva.
const CACHE = 'ladrillera-v1';

// Lo minimo para que la app abra. El resto (los .js y .css con nombre unico que
// genera el build) se van guardando solos a medida que se usan.
const BASICOS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(BASICOS))
      // skipWaiting: la version nueva toma el control sin esperar a que se
      // cierren todas las pestanas. Sin esto, despues de publicar una
      // correccion el dueno seguiria con la version vieja hasta cerrar la app
      // del todo, y "ya lo arregle" no seria cierto para el.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  const url = new URL(pedido.url);

  // 1) Todo lo que no sea un GET (guardar una venta, un pago, un adelanto) va
  //    a la red y punto. Un POST no se cachea nunca.
  if (pedido.method !== 'GET') return;

  // 2) Otro dominio: no es asunto nuestro.
  if (url.origin !== self.location.origin) return;

  // 3) LA API NO SE TOCA. Ver la nota de arriba: datos viejos serian peor que
  //    no tener datos.
  if (url.pathname.startsWith('/api/')) return;

  // 4) Navegar a una pantalla: siempre a la red, para que despues de publicar
  //    una version nueva se vea la nueva. Si no hay internet, el navegador
  //    muestra su propio aviso, que es justamente lo que queremos.
  if (pedido.mode === 'navigate') {
    evento.respondWith(fetch(pedido));
    return;
  }

  // 5) Archivos del programa. El build les pone un nombre unico segun su
  //    contenido (app-4f2c1a.js), asi que un archivo guardado NUNCA puede
  //    estar desactualizado: si cambia el contenido, cambia el nombre y el
  //    navegador pide uno distinto. Por eso acá el cache es seguro.
  evento.respondWith(
    caches.match(pedido).then((guardado) => {
      if (guardado) return guardado;

      return fetch(pedido).then((respuesta) => {
        // Solo guardamos respuestas completas y propias. Una respuesta parcial
        // (206) o un error guardado dejaria la app rota hasta la proxima
        // version.
        if (respuesta.ok && respuesta.type === 'basic') {
          const copia = respuesta.clone();
          caches.open(CACHE).then((cache) => cache.put(pedido, copia));
        }
        return respuesta;
      });
    }),
  );
});
