// -----------------------------------------------------------------------------
// Confirmacion.jsx — "Estas seguro?" antes de algo que no se deshace
// -----------------------------------------------------------------------------
// El plan (seccion 7) pide confirmacion antes de las acciones de dinero. Este
// componente es esa confirmacion.
//
// Se podria usar el window.confirm() del navegador, pero:
//   - No se puede estilar, y en un celular se ve como un cartel de 2005.
//   - Bloquea TODO el navegador mientras esta abierto.
//   - No permite explicar la consecuencia mas alla de una linea.
//
// Detalle de diseno: el boton peligroso NO va primero. Si el boton destructivo
// esta donde el dedo ya venia bajando, se toca de memoria sin leer.
// -----------------------------------------------------------------------------

import { useEffect } from 'react';
import { BotonGrande } from './BotonGrande.jsx';

/**
 * @param {object} props
 * @param {string} props.titulo
 * @param {string} props.mensaje
 * @param {string} [props.textoConfirmar]
 * @param {'primario'|'peligro'} [props.variante]
 * @param {() => void} props.onConfirmar
 * @param {() => void} props.onCancelar
 * @param {boolean} [props.cargando]
 */
export function Confirmacion({
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  variante = 'peligro',
  onConfirmar,
  onCancelar,
  cargando = false,
}) {
  // Cerrar con la tecla Escape. En el celular no se usa, pero en la PC es lo
  // que todo el mundo espera, y no cuesta nada.
  useEffect(() => {
    function alApretar(evento) {
      if (evento.key === 'Escape') onCancelar();
    }
    window.addEventListener('keydown', alApretar);
    // Esta funcion que se devuelve es la "limpieza": React la llama cuando el
    // componente desaparece. Sin ella, el escuchador quedaria enganchado para
    // siempre y se irian acumulando uno por cada vez que se abre el cartel.
    return () => window.removeEventListener('keydown', alApretar);
  }, [onCancelar]);

  return (
    // El fondo oscuro tambien cierra al tocarlo, que es lo que uno intenta
    // instintivamente.
    <div className="overlay" onClick={onCancelar}>
      <div
        className="tarjeta overlay-panel"
        // Sin esto, tocar DENTRO del cartel tambien lo cerraria: el click
        // "burbujea" hacia arriba hasta el fondo. stopPropagation lo corta.
        onClick={(evento) => evento.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmacion-titulo"
      >
        <h2 className="subtitulo" id="confirmacion-titulo">
          {titulo}
        </h2>
        <p className="texto-tenue">{mensaje}</p>

        <div className="fila-botones">
          <BotonGrande variante="secundario" onClick={onCancelar} ancho>
            Cancelar
          </BotonGrande>
          <BotonGrande variante={variante} onClick={onConfirmar} cargando={cargando} ancho>
            {textoConfirmar}
          </BotonGrande>
        </div>
      </div>
    </div>
  );
}

export default Confirmacion;
