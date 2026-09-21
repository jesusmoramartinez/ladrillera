// -----------------------------------------------------------------------------
// App.jsx — El mapa de pantallas
// -----------------------------------------------------------------------------
// React Router mira la URL y decide que componente mostrar, SIN recargar la
// pagina (SPA: Single Page Application).
//
// Fijate la forma del arbol: hay UNA ruta padre que envuelve a todas las
// demas. Esa ruta padre pone la proteccion de sesion y el layout con la barra
// inferior, y las hijas se dibujan adentro del <Outlet /> del Layout.
//
// Ventaja de anidar asi (rutas anidadas):
//   - La proteccion se escribe UNA vez, no una por pantalla. Agregar una
//     pantalla nueva adentro ya la deja protegida.
//   - La barra inferior no se vuelve a montar al cambiar de pantalla.
// -----------------------------------------------------------------------------

import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { RutaProtegida } from './components/RutaProtegida.jsx';
import Caja from './pages/Caja.jsx';
import Clientes from './pages/Clientes.jsx';
import Empleados from './pages/Empleados.jsx';
import EnConstruccion from './pages/EnConstruccion.jsx';
import Inicio from './pages/Inicio.jsx';
import Login from './pages/Login.jsx';
import Produccion from './pages/Produccion.jsx';
import Mas from './pages/Mas.jsx';
import Stock from './pages/Stock.jsx';
import VentaDetalle from './pages/VentaDetalle.jsx';
import Ventas from './pages/Ventas.jsx';

export default function App() {
  return (
    <Routes>
      {/* Publica */}
      <Route path="/login" element={<Login />} />

      {/* Todo lo de adentro exige sesion y comparte el layout */}
      <Route
        element={
          <RutaProtegida>
            <Layout />
          </RutaProtegida>
        }
      >
        {/* `index` = la ruta del padre tal cual, o sea "/" */}
        <Route index element={<Inicio />} />
        <Route path="/empleados" element={<Empleados />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/produccion" element={<Produccion />} />
        <Route path="/caja" element={<Caja />} />
        <Route path="/mas" element={<Mas />} />

        <Route path="/ventas" element={<Ventas />} />
        {/* Los dos puntos marcan una parte VARIABLE de la URL. /ventas/abc123
            entra acá, y la pantalla lee ese "abc123" con useParams(). */}
        <Route path="/ventas/:id" element={<VentaDetalle />} />
        <Route path="/clientes" element={<Clientes />} />

        <Route
          path="/adelantos"
          element={
            <EnConstruccion
              titulo="Adelantos"
              fase={7}
              descripcion="Plata entregada a cuenta, con su egreso de caja al instante."
            />
          }
        />
      </Route>

      {/* Cualquier otra URL vuelve al inicio */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
