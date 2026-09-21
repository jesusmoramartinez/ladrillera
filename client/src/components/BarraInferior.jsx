// -----------------------------------------------------------------------------
// BarraInferior.jsx — La navegacion principal
// -----------------------------------------------------------------------------
// Va ABAJO y no arriba por una razon practica: el plan (seccion 7) pide que se
// alcance con el pulgar. En un celular grande, la parte de arriba de la pantalla
// obliga a acomodar la mano; la de abajo no.
//
// Cinco destinos: Inicio, Produccion, Ventas, Caja y "Mas" (que abre el resto).
// Cinco es el maximo razonable: con mas, cada boton queda demasiado angosto
// para el dedo.
//
// Los iconos son SVG escritos a mano. Podriamos instalar una libreria de
// iconos, pero son cinco dibujos simples y una dependencia menos es una cosa
// menos que actualizar y que pese en el celular.
// -----------------------------------------------------------------------------

import { NavLink } from 'react-router-dom';

// `currentColor` hace que el icono tome el color del texto de alrededor.
// Asi, con solo cambiar el color en el CSS, el icono acompana.
const iconos = {
  inicio: (
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  ),
  produccion: (
    <path d="M3 8h8v5H3zM13 8h8v5h-8zM3 15h8v5H3zM13 15h8v5h-8zM7 3h10v3H7z" />
  ),
  ventas: (
    <path d="M6 4h12l2 5H4zM5 10h14v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zm4 3h6v2H9z" />
  ),
  caja: (
    <path d="M3 7h18v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zm2-3h14v2H5zm10 8h4v2h-4z" />
  ),
  mas: (
    <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
  ),
};

const destinos = [
  { a: '/', icono: 'inicio', texto: 'Inicio', exacto: true },
  { a: '/produccion', icono: 'produccion', texto: 'Produccion' },
  { a: '/ventas', icono: 'ventas', texto: 'Ventas' },
  { a: '/caja', icono: 'caja', texto: 'Caja' },
  { a: '/mas', icono: 'mas', texto: 'Mas' },
];

export function BarraInferior() {
  return (
    // <nav> en vez de <div>: le dice al navegador y a los lectores de pantalla
    // que esto es la navegacion del sitio, no un bloque cualquiera.
    <nav className="barra-inferior" aria-label="Navegacion principal">
      {destinos.map(({ a, icono, texto, exacto }) => (
        <NavLink
          key={a}
          to={a}
          // `end` significa "marcar como activo solo si la URL es exactamente
          // esta". Sin el, "/" estaria activo en TODAS las pantallas, porque
          // todas las rutas empiezan con "/".
          end={exacto}
          // NavLink le pasa a la funcion si el link esta activo. Lo usamos para
          // pintar el destino en el que estamos.
          className={({ isActive }) =>
            `barra-item${isActive ? ' barra-item--activo' : ''}`
          }
        >
          <svg
            className="barra-icono"
            viewBox="0 0 24 24"
            fill="currentColor"
            // El icono es decorativo: al lado esta el texto. Si no lo
            // escondieramos, el lector de pantalla leeria el dibujo y el texto.
            aria-hidden="true"
          >
            {iconos[icono]}
          </svg>
          <span className="barra-texto">{texto}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default BarraInferior;
