// -----------------------------------------------------------------------------
// CampoTexto.jsx — Campo de texto comun
// -----------------------------------------------------------------------------
// El hermano simple de InputGs: misma estructura visual (etiqueta, campo,
// ayuda, error) pero sin formateo de numeros.
//
// Tenerlo como componente evita repetir el mismo bloque de label + input +
// mensaje de error en cada pantalla, que es donde se cuelan las diferencias
// ("en una pantalla el error sale en rojo y en otra no").
// -----------------------------------------------------------------------------

import { useId } from 'react';

export function CampoTexto({ etiqueta, error, ayuda, id, ...resto }) {
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;

  return (
    <div className="campo">
      <label className="campo-etiqueta" htmlFor={idCampo}>
        {etiqueta}
      </label>

      <input
        id={idCampo}
        className={`campo-input${error ? ' campo-input--error' : ''}`}
        type="text"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${idCampo}-error` : undefined}
        {...resto}
      />

      {ayuda && !error && <p className="campo-ayuda">{ayuda}</p>}
      {error && (
        <p className="campo-error" id={`${idCampo}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export default CampoTexto;
