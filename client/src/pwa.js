// -----------------------------------------------------------------------------
// pwa.js — Instala el service worker (lo que hace instalable a la app)
// -----------------------------------------------------------------------------
// Que hace y que NO hace el service worker esta explicado en public/sw.js.
// Resumen de una linea: sirve para instalar la app y para que arranque rapido.
// NO guarda datos, y no hay modo sin conexion.
//
// Dos cuidados que tiene este archivo:
//
//   1. SOLO EN PRODUCCION. En desarrollo, un service worker cacheando archivos
//      pelea con la recarga en caliente de Vite y termina en el clasico
//      "cambie el codigo y no pasa nada". Cuesta horas darse cuenta.
//
//   2. SI FALLA, NO PASA NADA. El registro va con .catch() vacio a proposito:
//      que no se pueda instalar el service worker (navegador viejo, sin HTTPS)
//      no es razon para que la app no abra. Sin el, simplemente no se puede
//      instalar en la pantalla de inicio; todo lo demas anda igual.
// -----------------------------------------------------------------------------

export function registrarServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  // Se espera al load para no competir por la conexion con los archivos que la
  // app necesita AHORA para dibujarse.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // A proposito en silencio. Ver el punto 2 de arriba.
    });
  });
}
