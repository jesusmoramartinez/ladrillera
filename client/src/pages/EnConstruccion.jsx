// -----------------------------------------------------------------------------
// EnConstruccion.jsx — Pantalla provisoria de los modulos que faltan
// -----------------------------------------------------------------------------
// La barra inferior ya tiene los cinco destinos porque forma parte del layout
// de la fase 3. Pero Produccion, Ventas y Caja llegan en las fases 5, 6 y 4.
//
// Mostrar "esto llega en la fase N" es mejor que una pantalla en blanco (parece
// roto) o que esconder el boton (despues hay que acordarse de agregarlo).
// -----------------------------------------------------------------------------

export function EnConstruccion({ titulo, fase, descripcion }) {
  return (
    <div className="pantalla">
      <h1 className="titulo">{titulo}</h1>

      <div className="tarjeta">
        <h2 className="subtitulo">Todavia no esta</h2>
        <p className="texto-tenue">{descripcion}</p>
        <p className="texto-tenue">Se construye en la fase {fase} del plan.</p>
      </div>
    </div>
  );
}

export default EnConstruccion;

// Nota: desde la fase 8 no hay ninguna ruta usando este componente — todas las
// pantallas de la barra inferior y del menu "Mas" ya existen de verdad. Queda
// para la fase 10 (Ajustes), que es el ultimo modulo que falta.
