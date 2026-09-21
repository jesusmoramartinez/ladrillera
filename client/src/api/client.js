// -----------------------------------------------------------------------------
// client.js — El unico lugar del frontend que habla con el backend
// -----------------------------------------------------------------------------
// Todas las llamadas a la API pasan por aca. Ventajas de centralizarlo:
//   - El token se agrega en UN solo lugar (no hay que acordarse en cada pantalla).
//   - Los errores se traducen a una forma unica.
//   - Si la sesion vence, se detecta una sola vez y se avisa a toda la app.
//
// Fijate que las URLs son relativas ("/api/..."): gracias al proxy configurado
// en vite.config.js, en desarrollo Vite las reenvia al backend del puerto 4000.
// En produccion las sirve el mismo dominio. Asi la URL del backend no queda
// escrita adentro del codigo de React.
// -----------------------------------------------------------------------------

const CLAVE_TOKEN = 'ladrillera.token';

export function guardarToken(token) {
  localStorage.setItem(CLAVE_TOKEN, token);
}

export function leerToken() {
  return localStorage.getItem(CLAVE_TOKEN);
}

export function borrarToken() {
  localStorage.removeItem(CLAVE_TOKEN);
}

/**
 * Error con el codigo HTTP y los detalles por campo que manda el backend.
 * Asi las pantallas pueden distinguir "datos invalidos" de "sesion vencida".
 */
export class ErrorApi extends Error {
  constructor(mensaje, { status, detalles } = {}) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
    this.detalles = detalles;
  }
}

// Cuando el backend responde 401, avisamos a quien se haya suscrito (el
// AuthContext) para que cierre la sesion y vuelva a la pantalla de login.
const suscriptoresSesionVencida = new Set();

export function alVencerSesion(callback) {
  suscriptoresSesionVencida.add(callback);
  return () => suscriptoresSesionVencida.delete(callback);
}

/**
 * Hace un pedido a la API.
 * @param {string} ruta  ej. '/auth/login' (sin el /api)
 * @param {{ method?: string, body?: object, conToken?: boolean }} opciones
 */
export async function pedir(ruta, { method = 'GET', body, conToken = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = leerToken();
  if (conToken && token) {
    // Este es el formato que espera requireAuth en el backend.
    headers.Authorization = `Bearer ${token}`;
  }

  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch solo falla asi cuando no hubo respuesta: sin internet, servidor
    // apagado, DNS caido. Un 500 NO cae aca, cae mas abajo.
    throw new ErrorApi('No se pudo conectar con el servidor. Revisa tu conexion.', {
      status: 0,
    });
  }

  // 204 No Content no tiene cuerpo que parsear.
  const datos = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    if (respuesta.status === 401 && conToken && token) {
      borrarToken();
      suscriptoresSesionVencida.forEach((cb) => cb());
    }
    throw new ErrorApi(datos?.error ?? `Error ${respuesta.status}`, {
      status: respuesta.status,
      detalles: datos?.detalles,
    });
  }

  return datos;
}

export const api = {
  get: (ruta, opciones) => pedir(ruta, { ...opciones, method: 'GET' }),
  post: (ruta, body, opciones) => pedir(ruta, { ...opciones, method: 'POST', body }),
  patch: (ruta, body, opciones) => pedir(ruta, { ...opciones, method: 'PATCH', body }),
  del: (ruta, opciones) => pedir(ruta, { ...opciones, method: 'DELETE' }),
};
