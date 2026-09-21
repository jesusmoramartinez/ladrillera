// -----------------------------------------------------------------------------
// CampoSelect.jsx — Lista desplegable
// -----------------------------------------------------------------------------
// El plan (seccion 7) pide "selects/checkboxes en vez de escribir". Tiene
// sentido: escribir en un celular, parado en la fabrica, es lento y se cometen
// errores; elegir de una lista no.
//
// Se usa el <select> nativo del navegador a proposito, en vez de armar un
// desplegable propio. En el celular, el <select> nativo abre la rueda de
// opciones del sistema operativo: mas grande, mas comoda y ya conocida. Un
// desplegable hecho a mano nunca queda tan bien y hay que resolverle el teclado,
// el foco y el scroll a mano.
// -----------------------------------------------------------------------------

import { useId } from 'react';

/**
 * @param {object} props
 * @param {string} props.etiqueta
 * @param {Array<{ valor: string, texto: string }>} props.opciones
 * @param {string} props.value
 * @param {(e: Event) => void} props.onChange
 * @param {string} [props.placeholder]  texto de la opcion vacia inicial
 */
export function CampoSelect({
  etiqueta,
  opciones,
  value,
  onChange,
  error,
  ayuda,
  placeholder,
  id,
  ...resto
}) {
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;

  return (
    <div className="campo">
      <label className="campo-etiqueta" htmlFor={idCampo}>
        {etiqueta}
      </label>

      <select
        id={idCampo}
        className={`campo-input campo-select${error ? ' campo-input--error' : ''}`}
        value={value}
        onChange={onChange}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${idCampo}-error` : undefined}
        {...resto}
      >
        {/* La opcion vacia se deshabilita despues de elegir, para que no se
            pueda volver a "nada" sin querer. */}
        {placeholder && (
          <option value="" disabled={Boolean(value)}>
            {placeholder}
          </option>
        )}
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>

      {ayuda && !error && <p className="campo-ayuda">{ayuda}</p>}
      {error && (
        <p className="campo-error" id={`${idCampo}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export default CampoSelect;
