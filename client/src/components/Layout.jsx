// -----------------------------------------------------------------------------
// Layout.jsx — El "marco" que rodea a todas las pantallas con sesion
// -----------------------------------------------------------------------------
// Todas las pantallas de adentro comparten lo mismo: el contenido arriba y la
// barra de navegacion abajo. En vez de repetir eso en cada pantalla, se pone
// una sola vez aca.
//
// <Outlet /> es de React Router: es el hueco donde se dibuja la pantalla que
// corresponda a la URL actual. Inicio, Produccion, Empleados... todas caen ahi.
//
// Ventaja concreta: la barra inferior NO se vuelve a montar al cambiar de
// pantalla. Queda quieta, como en una app nativa, en vez de parpadear.
// -----------------------------------------------------------------------------

import { Outlet } from 'react-router-dom';
import { BarraInferior } from './BarraInferior.jsx';

export function Layout() {
  return (
    <div className="layout">
      {/* <main> marca cual es el contenido principal de la pagina. */}
      <main className="layout-contenido">
        <Outlet />
      </main>

      <BarraInferior />
    </div>
  );
}

export default Layout;
