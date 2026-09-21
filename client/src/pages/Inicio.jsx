// -----------------------------------------------------------------------------
// Inicio.jsx — Pantalla de inicio (todavia provisoria)
// -----------------------------------------------------------------------------
// El Inicio de verdad (balance del mes, ladrillos de la semana, alerta roja de
// arcilla, por cobrar, por entregar) se arma en la fase 9, cuando ya existan
// los datos que tiene que mostrar.
//
// Por ahora muestra el estado del sistema, que sirve para confirmar de un
// vistazo que la sesion y la base estan bien.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/useAuth.js';
import { formatearFecha, hoyISO } from '../utils/format.js';

export function Inicio() {
  const { usuario } = useAuth();
  const [salud, setSalud] = useState(null);

  useEffect(() => {
    api
      .get('/health')
      .then(setSalud)
      .catch(() => setSalud(null));
  }, []);

  return (
    <div className="pantalla">
      <header>
        <p className="texto-tenue">Hola, {usuario?.username}</p>
        <h1 className="titulo">{formatearFecha(hoyISO())}</h1>
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
        <h2 className="subtitulo">Lo que ya podes hacer</h2>
        <p className="texto-tenue">
          Cargar a los empleados con su tarifa por millar. Es lo que necesita la
          produccion diaria para calcular cuanto cobra cada uno.
        </p>
        <Link to="/empleados" className="enlace">
          Ir a Empleados
        </Link>
      </section>

      <section className="tarjeta">
        <h2 className="subtitulo">Proximo paso</h2>
        <p className="texto-tenue">
          Fase 4: stock de arcilla, lena y ladrillos, compras de material y caja.
        </p>
      </section>
    </div>
  );
}

export default Inicio;
