// -----------------------------------------------------------------------------
// Configurado.jsx — La puerta del asistente de configuracion inicial
// -----------------------------------------------------------------------------
// Se pregunta una sola cosa: ¿este sistema ya se configuro?
//
//   NO  ->  se muestra el asistente, y NADA MAS. Sin barra inferior, sin poder
//           irse a otra pantalla.
//   SI  ->  la app normal, y esta pantalla no vuelve a aparecer nunca.
//
// POR QUE NO ES UNA RUTA MAS (/configuracion)
//
// Porque entonces habria que acordarse de mandar ahi al dueno desde cada
// pantalla, y cualquiera con la URL podria salteársela. Peor: la app a medio
// configurar SI se puede abrir, y lo que muestra es todo en cero. Cargar una
// produccion sin tarifas, o una venta sin precios, deja datos rotos desde el
// primer dia.
//
// Como envoltorio, no hay forma de esquivarlo: no existe pantalla a la que ir
// hasta que la configuracion este hecha.
//
// Va DEBAJO de RutaProtegida, no arriba: primero hay que saber quien sos, y
// recien despues si tu sistema esta configurado. Al reves, la pantalla le
// pediria la configuracion a un desconocido.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { BotonGrande } from './BotonGrande.jsx';
import { Configuracion } from '../pages/Configuracion.jsx';
import { obtenerEstadoSetup } from '../api/setup.js';

export function Configurado({ children }) {
  // null = todavia no sabemos. Es distinto de true y de false, y la diferencia
  // importa: si arrancaramos en false, el asistente parpadearia en la cara del
  // dueno cada vez que abre la app.
  const [hecha, setHecha] = useState(null);
  const [error, setError] = useState('');
  const [intentos, setIntentos] = useState(0);

  function reintentar() {
    setError('');
    setIntentos((n) => n + 1);
  }

  useEffect(() => {
    let cancelado = false;

    obtenerEstadoSetup()
      .then((r) => {
        if (!cancelado) setHecha(r.hecha);
      })
      .catch((e) => {
        if (!cancelado) setError(e.message);
      });

    return () => {
      cancelado = true;
    };
  }, [intentos]);

  if (error) {
    return (
      <div className="pantalla-centrada">
        <div className="tarjeta">
          <p className="alerta" role="alert">
            {error}
          </p>
          <BotonGrande variante="secundario" onClick={reintentar} ancho>
            Reintentar
          </BotonGrande>
        </div>
      </div>
    );
  }

  if (hecha === null) {
    return (
      <div className="pantalla-centrada">
        <p className="texto-tenue">Cargando...</p>
      </div>
    );
  }

  if (!hecha) {
    // El asistente avisa cuando termino y entramos a la app sin recargar.
    return <Configuracion alTerminar={() => setHecha(true)} />;
  }

  return children;
}

export default Configurado;
