// -----------------------------------------------------------------------------
// BotonGrande.jsx — El boton de toda la app
// -----------------------------------------------------------------------------
// Existe para que los botones sean IGUALES en todas las pantallas sin tener que
// acordarse de las clases CSS cada vez. Si manana el plan pide botones mas
// altos, se cambia aca y cambian todos.
//
// El plan (seccion 7) pide al menos 48 px de alto: la app se usa parado en la
// fabrica, con las manos sucias y a veces con guantes.
//
// Los "props" son los parametros de un componente de React. `children` es
// especial: es lo que va ADENTRO de la etiqueta.
//   <BotonGrande>Guardar</BotonGrande>   ->   children = "Guardar"
// -----------------------------------------------------------------------------

/**
 * @param {object} props
 * @param {'primario'|'secundario'|'peligro'|'whatsapp'} [props.variante]
 * @param {boolean} [props.cargando]  muestra "..." y bloquea el boton
 * @param {boolean} [props.ancho]     ocupa todo el ancho disponible
 */
export function BotonGrande({
  children,
  variante = 'primario',
  cargando = false,
  ancho = false,
  disabled = false,
  type = 'button',
  ...resto
}) {
  const clases = ['boton', `boton--${variante}`];
  if (ancho) clases.push('boton--ancho');

  return (
    <button
      // type="button" por defecto A PROPOSITO. En HTML, un <button> adentro de
      // un <form> es type="submit" salvo que digas lo contrario, asi que un
      // boton "Cancelar" enviaria el formulario sin querer.
      type={type}
      className={clases.join(' ')}
      disabled={disabled || cargando}
      // {...resto} pasa al <button> cualquier otro prop (onClick, aria-label...)
      // sin tener que enumerarlos uno por uno.
      {...resto}
    >
      {cargando ? 'Guardando...' : children}
    </button>
  );
}

export default BotonGrande;
