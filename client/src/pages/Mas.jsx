// -----------------------------------------------------------------------------
// Mas.jsx — El menu con el resto de las pantallas
// -----------------------------------------------------------------------------
// La barra inferior tiene lugar para cinco destinos. Los cuatro de uso diario
// (Inicio, Produccion, Ventas, Caja) van ahi directo; todo lo demas vive aca.
//
// Lo que todavia no existe se muestra igual, apagado y con la fase en la que
// llega. Asi el dueno ve a donde va el sistema, y de paso sirve de recordatorio
// de lo que falta.
// -----------------------------------------------------------------------------

import { Link } from 'react-router-dom';
import { BotonGrande } from '../components/BotonGrande.jsx';
import { useAuth } from '../context/useAuth.js';

const secciones = [
  { a: '/empleados', texto: 'Empleados', detalle: 'Nombres, roles y tarifas' },
  { a: '/stock', texto: 'Stock', detalle: 'Arcilla, lena y ladrillos' },
  { texto: 'Clientes', detalle: 'Lista y saldos', fase: 6 },
  { texto: 'Adelantos', detalle: 'Plata entregada a cuenta', fase: 7 },
  { texto: 'Liquidacion', detalle: 'Sueldos de la semana', fase: 8 },
  { texto: 'Ajustes', detalle: 'Listas de precio, categorias, contrasena', fase: 10 },
];

export function Mas() {
  const { usuario, cerrarSesion } = useAuth();

  return (
    <div className="pantalla">
      <h1 className="titulo">Mas</h1>

      <ul className="lista">
        {secciones.map((seccion) =>
          seccion.a ? (
            <li key={seccion.texto} className="lista-fila">
              <Link to={seccion.a} className="lista-enlace">
                <span className="lista-fila-titulo">{seccion.texto}</span>
                <span className="texto-tenue">{seccion.detalle}</span>
              </Link>
            </li>
          ) : (
            <li key={seccion.texto} className="lista-fila lista-fila--apagada">
              <div className="lista-fila-datos">
                <p className="lista-fila-titulo">
                  {seccion.texto}
                  <span className="etiqueta">fase {seccion.fase}</span>
                </p>
                <p className="texto-tenue">{seccion.detalle}</p>
              </div>
            </li>
          ),
        )}
      </ul>

      <div className="tarjeta">
        <p className="texto-tenue">Sesion iniciada como</p>
        <p className="lista-fila-titulo">{usuario?.username}</p>
        <BotonGrande variante="secundario" onClick={cerrarSesion} ancho>
          Cerrar sesion
        </BotonGrande>
      </div>
    </div>
  );
}

export default Mas;
