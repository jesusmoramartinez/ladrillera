// -----------------------------------------------------------------------------
// Inicio.jsx — Pantalla de inicio (provisoria)
// -----------------------------------------------------------------------------
// El Inicio de verdad (balance del mes, ladrillos de la semana, alerta de
// arcilla) se construye en la fase 9. Por ahora esta pantalla sirve para
// comprobar que la sesion funciona: si la ves, tu token es valido.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export function Inicio() {
  const { usuario, cerrarSesion } = useAuth();
  const [salud, setSalud] = useState(null);

  useEffect(() => {
    api
      .get('/health')
      .then(setSalud)
      .catch(() => setSalud(null));
  }, []);

  return (
    <div className="pantalla">
      <header className="cabecera">
        <div>
          <p className="texto-tenue">Sesion iniciada como</p>
          <h1 className="titulo">{usuario?.username}</h1>
        </div>
        <button className="boton-secundario" onClick={cerrarSesion}>
          Salir
        </button>
      </header>

      <section className="tarjeta">
        <h2 className="subtitulo">Estado del sistema</h2>
        <dl className="lista-datos">
          <div>
            <dt>Base de datos</dt>
            <dd>{salud?.baseDeDatos ?? 'consultando...'}</dd>
          </div>
          <div>
            <dt>Entorno</dt>
            <dd>{salud?.entorno ?? '-'}</dd>
          </div>
        </dl>
      </section>

      <section className="tarjeta">
        <h2 className="subtitulo">Proximos pasos</h2>
        <p className="texto-tenue">
          Fase 3: barra de navegacion inferior y alta de empleados.
        </p>
      </section>
    </div>
  );
}

export default Inicio;
