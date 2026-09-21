// -----------------------------------------------------------------------------
// Ticket.jsx — El comprobante del empleado, y el boton de WhatsApp
// -----------------------------------------------------------------------------
// Muestra el ticket tal cual le va a llegar al empleado, y abajo el boton para
// mandarselo.
//
//
// QUE HACE EXACTAMENTE EL BOTON (y que NO hace)
//
// Abre WhatsApp con el mensaje YA ESCRITO en el campo de texto, en la
// conversacion con ese empleado. El dueno toca "Enviar". **El sistema no manda
// el mensaje solo.**
//
// Es una limitacion del link wa.me, y acá juega a favor por tres motivos:
//
//   1. No hace falta la API de WhatsApp Business, que se paga, hay que
//      registrar una empresa y aprobar plantillas de mensaje. Esto funciona
//      hoy, gratis, desde el celular del dueno.
//
//   2. El dueno VE el mensaje antes de que salga. Un sistema que manda
//      mensajes solo a los celulares de sus empleados es un sistema al que hay
//      que tenerle mucha mas confianza, y con razon.
//
//   3. Sale desde el WhatsApp del dueno, asi que el empleado recibe un mensaje
//      de su patron y no de un numero desconocido que le habla de plata.
//
//
// POR QUE EL TEXTO LO ARMA EL SERVIDOR
//
// El texto llega hecho desde la API. Podria armarlo esta pantalla, y seria un
// error: el ticket que se ve, el que se manda y el que algun dia se imprima
// tienen que ser el mismo. Armandolo en un solo lugar, el dia que haya que
// cambiar una linea se cambia una sola vez.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { BotonGrande } from './BotonGrande.jsx';
import { obtenerTicket } from '../api/payrolls.js';

/**
 * @param {object} props
 * @param {string} props.payrollId
 * @param {{employeeId: string, nombre: string}} props.empleado
 * @param {() => void} props.onCerrar
 */
export function Ticket({ payrollId, empleado, onCerrar }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let cancelado = false;

    obtenerTicket(payrollId, empleado.employeeId)
      .then((r) => {
        if (!cancelado) setDatos(r);
      })
      .catch((e) => {
        if (!cancelado) setError(e.message);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [payrollId, empleado.employeeId]);

  // Cerrar con Escape, igual que Confirmacion.
  useEffect(() => {
    function alApretar(evento) {
      if (evento.key === 'Escape') onCerrar();
    }
    window.addEventListener('keydown', alApretar);
    return () => window.removeEventListener('keydown', alApretar);
  }, [onCerrar]);

  function abrirWhatsApp() {
    // El link se arma acá y no en el servidor porque el texto puede ser largo
    // y no tiene sentido mandarlo dos veces por la red. La conversion del
    // telefono SI la hizo el servidor (logic/telefono.js), que es donde estan
    // los tests.
    const url = `https://wa.me/${datos.numeroWhatsApp}?text=${encodeURIComponent(datos.texto)}`;

    // _blank para que la app quede abierta atras: despues de mandar el de Ana
    // hay que volver y mandar el de Juan.
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(datos.texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // El portapapeles puede estar bloqueado (sin HTTPS, o permiso negado).
      // No es grave: el texto esta a la vista y se puede seleccionar a mano.
      setError('No se pudo copiar. Selecciona el texto de arriba a mano.');
    }
  }

  return (
    <div className="overlay" onClick={onCerrar}>
      <div
        className="tarjeta overlay-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-titulo"
      >
        <h2 className="subtitulo" id="ticket-titulo">
          Ticket de {empleado.nombre}
        </h2>

        {cargando && <p className="texto-tenue">Armando el ticket...</p>}

        {!cargando && error && (
          <p className="alerta" role="alert">
            {error}
          </p>
        )}

        {!cargando && datos && (
          <>
            {/* <pre> conserva los saltos de linea y los espacios tal cual.
                Con un <p> comun, todo el ticket saldria en un solo parrafo. */}
            <pre className="ticket-texto">{datos.texto}</pre>

            {datos.puedeWhatsApp ? (
              <>
                <BotonGrande variante="whatsapp" onClick={abrirWhatsApp} ancho>
                  <IconoWhatsApp />
                  Enviar por WhatsApp
                </BotonGrande>
                <p className="campo-ayuda">
                  Abre WhatsApp con el mensaje escrito para {datos.telefono}.
                  Vos tocas Enviar.
                </p>
              </>
            ) : (
              <p className="alerta alerta--aviso" role="status">
                {empleado.nombre} no tiene celular cargado. Agregaselo en
                Mas → Empleados para poder mandarle el ticket.
              </p>
            )}

            <div className="fila-botones">
              <BotonGrande variante="secundario" onClick={copiar} ancho>
                {copiado ? 'Copiado' : 'Copiar texto'}
              </BotonGrande>
              <BotonGrande variante="secundario" onClick={onCerrar} ancho>
                Cerrar
              </BotonGrande>
            </div>
          </>
        )}

        {!cargando && error && (
          <BotonGrande variante="secundario" onClick={onCerrar} ancho>
            Cerrar
          </BotonGrande>
        )}
      </div>
    </div>
  );
}

/** El logo de WhatsApp, dibujado a mano para no sumar una dependencia. */
function IconoWhatsApp() {
  return (
    <svg
      className="boton-icono"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.004c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m0 1.67c2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.25 8.24a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.26-8.24M8.53 7.33c-.16 0-.43.06-.65.31-.22.24-.87.85-.87 2.07 0 1.22.89 2.39 1 2.56.14.17 1.72 2.62 4.16 3.68.58.25 1.03.4 1.39.51.58.19 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.05.14-1.16-.06-.1-.22-.16-.46-.28-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.78.97-.15.17-.29.19-.53.07-.25-.13-1.06-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.14-.24-.02-.37.1-.5.11-.11.25-.29.37-.44.12-.14.16-.25.24-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42-.14 0-.3-.02-.47-.02" />
    </svg>
  );
}

export default Ticket;
