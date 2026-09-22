// -----------------------------------------------------------------------------
// Configuracion.jsx — El asistente del primer dia (plan, 5.11b)
// -----------------------------------------------------------------------------
// Esta pantalla se ve UNA sola vez en la vida del sistema: el dia de la
// entrega, cuando el dueno abre la app por primera vez. Despues no vuelve a
// aparecer nunca.
//
// POR QUE ESTA EN PASOS Y NO ES UN FORMULARIO LARGO
//
// Son unos veinte campos. Todos juntos en un celular son una pared de casillas
// vacias: intimida, se pierde el hilo y es facil saltearse uno. En cuatro
// pasos, cada pantalla hace UNA pregunta entendible ("¿cuanto stock tenes hoy
// en el patio?") y se ve el avance.
//
// PERO SE GUARDA UNA SOLA VEZ, AL FINAL.
//
// Los pasos son de la PANTALLA, no del guardado. Si cada paso guardara por su
// cuenta y se cortara internet en el tercero, el dueno quedaria con los precios
// cargados, sin stock y sin forma de darse cuenta. Acá se junta todo y se manda
// en un unico pedido que el backend mete en una sola transaccion: o entra todo
// o no entra nada, y se puede volver a intentar.
//
// Por eso tampoco hay "Guardar" en cada paso: hay "Siguiente", y un solo
// "Guardar y empezar" al final, con el resumen de todo a la vista.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { BotonGrande } from '../components/BotonGrande.jsx';
import { CampoTexto } from '../components/CampoTexto.jsx';
import { InputCantidad } from '../components/InputCantidad.jsx';
import { InputEntero } from '../components/InputEntero.jsx';
import { InputGs } from '../components/InputGs.jsx';
import { guardarConfiguracionInicial, obtenerEstadoSetup } from '../api/setup.js';
import { formatearCantidad, formatearGs, formatearNumero, hoyISO } from '../utils/format.js';

const PASOS = ['Tu fabrica', 'Precios', 'Stock de hoy', 'Empleados'];

/** Una fila de empleado vacia, lista para completar. */
function empleadoVacio() {
  return { nombre: '', rol: '', telefono: '', tarifaPorMil: 0 };
}

/**
 * @param {object} props
 * @param {() => void} props.alTerminar  avisa que ya se configuro, para que la
 *                                      app muestre el Inicio de una vez
 */
export function Configuracion({ alTerminar }) {
  const [paso, setPaso] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // Paso 1
  const [unidadLena, setUnidadLena] = useState('carga');
  const [ladrillosPorCamion, setLadrillosPorCamion] = useState(25_000);
  const [umbralAlertaArcilla, setUmbralAlertaArcilla] = useState(25_000);

  // Paso 2 — arranca con una lista sola. Es lo minimo que pide el backend y
  // lo que tiene la mayoria: un precio, y listo.
  const [listas, setListas] = useState([{ nombre: 'Normal', precioPorMil: 0 }]);

  // Paso 3
  const [stock, setStock] = useState({
    arcillaPura: 0,
    arcillaFloja: 0,
    lena: 0,
    ladrillos: 0,
  });

  // Paso 4
  const [empleados, setEmpleados] = useState([empleadoVacio()]);

  // Si el seed dejo listas cargadas, las mostramos ya escritas: corregir un
  // precio es mas rapido que tipear el nombre y el precio de cero.
  useEffect(() => {
    obtenerEstadoSetup()
      .then((r) => {
        if (r.listasDePrecio?.length) {
          setListas(
            r.listasDePrecio.map((l) => ({ nombre: l.nombre, precioPorMil: l.precioPorMil })),
          );
        }
        if (r.unidadLena) setUnidadLena(r.unidadLena);
        if (r.ladrillosPorCamion) setLadrillosPorCamion(r.ladrillosPorCamion);
        if (r.umbralAlertaArcilla) setUmbralAlertaArcilla(r.umbralAlertaArcilla);
      })
      .catch(() => {
        // Si falla, no pasa nada: se arranca con los valores por defecto.
      });
  }, []);

  // --- Validacion de cada paso ---------------------------------------------
  //
  // Se valida acá para poder APAGAR el boton "Siguiente", que es mejor que
  // dejarlo apretar y contestar con un error. La validacion de verdad igual
  // esta en el backend (setup.validator.js).

  const problemas = {
    0:
      !unidadLena.trim()
        ? 'Falta decir como se mide la lena.'
        : ladrillosPorCamion <= 0
          ? 'Falta cuantos ladrillos salen de un camion.'
          : '',
    1: listas.some((l) => !l.nombre.trim() || l.precioPorMil <= 0)
      ? 'Cada lista necesita un nombre y un precio.'
      : '',
    2: '', // El stock puede ser todo cero: hay fabricas que arrancan vacias.
    3: empleados.some((e) => e.nombre.trim() && e.tarifaPorMil <= 0)
      ? 'Los empleados cargados necesitan su tarifa por mil.'
      : '',
  };

  const problemaActual = problemas[paso];
  const esUltimo = paso === PASOS.length - 1;

  async function guardar() {
    setGuardando(true);
    setError('');

    // Las filas de empleado que quedaron vacias no se mandan: son las que el
    // dueno agrego "por las dudas" y no llego a completar.
    const empleadosCargados = empleados
      .filter((e) => e.nombre.trim())
      .map((e) => ({
        nombre: e.nombre.trim(),
        rol: e.rol.trim(),
        telefono: e.telefono.trim(),
        tarifaPorMil: e.tarifaPorMil,
      }));

    try {
      await guardarConfiguracionInicial({
        fecha: hoyISO(),
        unidadLena: unidadLena.trim(),
        ladrillosPorCamion,
        umbralAlertaArcilla,
        listasDePrecio: listas.map((l) => ({
          nombre: l.nombre.trim(),
          precioPorMil: l.precioPorMil,
        })),
        stock,
        empleados: empleadosCargados,
      });
      alTerminar();
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  }

  return (
    <div className="pantalla">
      <header>
        <p className="texto-tenue">
          Paso {paso + 1} de {PASOS.length}
        </p>
        <h1 className="titulo">{PASOS[paso]}</h1>
        <ol className="pasos" aria-label="Avance de la configuracion">
          {PASOS.map((nombre, i) => (
            <li
              key={nombre}
              className={`pasos-punto${i <= paso ? ' pasos-punto--hecho' : ''}`}
              aria-current={i === paso ? 'step' : undefined}
            >
              <span className="visualmente-oculto">{nombre}</span>
            </li>
          ))}
        </ol>
      </header>

      {paso === 0 && (
        <PasoFabrica
          unidadLena={unidadLena}
          setUnidadLena={setUnidadLena}
          ladrillosPorCamion={ladrillosPorCamion}
          setLadrillosPorCamion={setLadrillosPorCamion}
          umbralAlertaArcilla={umbralAlertaArcilla}
          setUmbralAlertaArcilla={setUmbralAlertaArcilla}
        />
      )}

      {paso === 1 && <PasoPrecios listas={listas} setListas={setListas} />}

      {paso === 2 && (
        <PasoStock
          stock={stock}
          setStock={setStock}
          unidadLena={unidadLena}
          ladrillosPorCamion={ladrillosPorCamion}
        />
      )}

      {paso === 3 && (
        <PasoEmpleados
          empleados={empleados}
          setEmpleados={setEmpleados}
          listas={listas}
          stock={stock}
          unidadLena={unidadLena}
        />
      )}

      {problemaActual && <p className="campo-ayuda">{problemaActual}</p>}

      {error && (
        <p className="alerta" role="alert">
          {error}
        </p>
      )}

      <div className="acciones">
        {paso > 0 && (
          <BotonGrande variante="secundario" onClick={() => setPaso(paso - 1)} ancho>
            Atras
          </BotonGrande>
        )}

        {esUltimo ? (
          <BotonGrande
            onClick={guardar}
            cargando={guardando}
            disabled={Boolean(problemaActual)}
            ancho
          >
            Guardar y empezar
          </BotonGrande>
        ) : (
          <BotonGrande
            onClick={() => setPaso(paso + 1)}
            disabled={Boolean(problemaActual)}
            ancho
          >
            Siguiente
          </BotonGrande>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paso 1 — como es la fabrica
// ---------------------------------------------------------------------------

function PasoFabrica({
  unidadLena,
  setUnidadLena,
  ladrillosPorCamion,
  setLadrillosPorCamion,
  umbralAlertaArcilla,
  setUmbralAlertaArcilla,
}) {
  return (
    <div className="tarjeta">
      <p className="texto-tenue">
        Estos tres numeros son los que hacen que las cuentas del sistema den
        igual que las tuyas. Se pueden cambiar despues desde Ajustes.
      </p>

      <CampoTexto
        etiqueta="Como le decis a la unidad de lena"
        value={unidadLena}
        onChange={(e) => setUnidadLena(e.target.value)}
        ayuda='Por ejemplo: carga, camion, metro. Se va a usar en todas las pantallas.'
        maxLength={20}
      />

      <InputEntero
        etiqueta="Ladrillos que salen de un camion de arcilla"
        value={ladrillosPorCamion}
        onChange={setLadrillosPorCamion}
        ayuda="Con esto el sistema descuenta la arcilla sola cuando cargas la produccion."
      />

      <InputEntero
        etiqueta="Avisar cuando la arcilla alcance para menos de"
        sufijo="ladrillos"
        value={umbralAlertaArcilla}
        onChange={setUmbralAlertaArcilla}
        ayuda="Debajo de ese numero aparece la alerta roja en el Inicio."
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paso 2 — a cuanto vende
// ---------------------------------------------------------------------------

function PasoPrecios({ listas, setListas }) {
  function cambiar(indice, campo, valor) {
    setListas(listas.map((l, i) => (i === indice ? { ...l, [campo]: valor } : l)));
  }

  return (
    <>
      <div className="tarjeta">
        <p className="texto-tenue">
          El precio va <strong>por mil ladrillos</strong>, que es como se habla
          en la fabrica. Si tenes un precio para el que compra mucho, agregalo
          como otra lista: al vender vas a poder elegir.
        </p>
        <p className="campo-ayuda">
          La primera de la lista es la que viene elegida al abrir una venta.
        </p>
      </div>

      {listas.map((lista, i) => (
        <div className="tarjeta" key={i}>
          <div className="fila-entre">
            <h2 className="subtitulo">
              {i === 0 ? 'Precio principal' : `Otro precio ${i}`}
            </h2>
            {listas.length > 1 && (
              <button
                type="button"
                className="boton-texto boton-texto--peligro"
                onClick={() => setListas(listas.filter((_, j) => j !== i))}
              >
                Quitar
              </button>
            )}
          </div>

          <CampoTexto
            etiqueta="Nombre"
            value={lista.nombre}
            onChange={(e) => cambiar(i, 'nombre', e.target.value)}
            ayuda={i === 0 ? 'Por ejemplo: Normal.' : 'Por ejemplo: Mayorista.'}
            maxLength={40}
          />

          <InputGs
            etiqueta="Precio por mil ladrillos"
            value={lista.precioPorMil}
            onChange={(n) => cambiar(i, 'precioPorMil', n)}
          />
        </div>
      ))}

      {listas.length < 10 && (
        <BotonGrande
          variante="secundario"
          onClick={() => setListas([...listas, { nombre: '', precioPorMil: 0 }])}
          ancho
        >
          + Agregar otro precio
        </BotonGrande>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Paso 3 — que hay hoy en el patio
// ---------------------------------------------------------------------------

function PasoStock({ stock, setStock, unidadLena, ladrillosPorCamion }) {
  function cambiar(campo, valor) {
    setStock({ ...stock, [campo]: valor });
  }

  // Le mostramos la cuenta hecha para que confirme que el numero de camiones
  // que puso significa lo que el cree.
  const alcanzaPara = Math.min(stock.arcillaPura, stock.arcillaFloja) * ladrillosPorCamion;

  return (
    <div className="tarjeta">
      <p className="texto-tenue">
        Salí al patio y contá lo que hay <strong>hoy</strong>. No hace falta que
        sea exacto al ladrillo: despues se corrige desde Stock cuando quieras.
      </p>

      <InputCantidad
        etiqueta="Arcilla pura"
        unidad="camiones"
        value={stock.arcillaPura}
        onChange={(n) => cambiar('arcillaPura', n)}
        ayuda="Se puede poner con coma: 2,5 camiones."
      />

      <InputCantidad
        etiqueta="Arcilla floja"
        unidad="camiones"
        value={stock.arcillaFloja}
        onChange={(n) => cambiar('arcillaFloja', n)}
      />

      {alcanzaPara > 0 && (
        <p className="campo-ayuda">
          Con esa arcilla alcanza para {formatearNumero(Math.round(alcanzaPara))} ladrillos.
        </p>
      )}

      <InputEntero
        etiqueta="Lena"
        sufijo={unidadLena}
        value={stock.lena}
        onChange={(n) => cambiar('lena', n)}
      />

      <InputEntero
        etiqueta="Ladrillos en el patio"
        sufijo="ladrillos"
        value={stock.ladrillos}
        onChange={(n) => cambiar('ladrillos', n)}
        ayuda="Los que estan hechos y todavia no se entregaron."
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paso 4 — quienes trabajan, y el resumen final
// ---------------------------------------------------------------------------

function PasoEmpleados({ empleados, setEmpleados, listas, stock, unidadLena }) {
  function cambiar(indice, campo, valor) {
    setEmpleados(empleados.map((e, i) => (i === indice ? { ...e, [campo]: valor } : e)));
  }

  const cargados = empleados.filter((e) => e.nombre.trim());

  return (
    <>
      <div className="tarjeta">
        <p className="texto-tenue">
          La tarifa tambien va <strong>por mil ladrillos</strong>. Con eso el
          sistema calcula solo cuanto cobra cada uno el sabado.
        </p>
        <p className="campo-ayuda">
          El telefono es opcional, pero si lo cargas vas a poder mandarle el
          ticket del sueldo por WhatsApp.
        </p>
      </div>

      {empleados.map((empleado, i) => (
        <div className="tarjeta" key={i}>
          <div className="fila-entre">
            <h2 className="subtitulo">{empleado.nombre.trim() || `Empleado ${i + 1}`}</h2>
            {empleados.length > 1 && (
              <button
                type="button"
                className="boton-texto boton-texto--peligro"
                onClick={() => setEmpleados(empleados.filter((_, j) => j !== i))}
              >
                Quitar
              </button>
            )}
          </div>

          <CampoTexto
            etiqueta="Nombre"
            value={empleado.nombre}
            onChange={(e) => cambiar(i, 'nombre', e.target.value)}
            maxLength={60}
          />

          <CampoTexto
            etiqueta="Rol (opcional)"
            value={empleado.rol}
            onChange={(e) => cambiar(i, 'rol', e.target.value)}
            ayuda="Por ejemplo: ponedor, hornero."
            maxLength={40}
          />

          <InputGs
            etiqueta="Tarifa por mil ladrillos"
            value={empleado.tarifaPorMil}
            onChange={(n) => cambiar(i, 'tarifaPorMil', n)}
          />

          <CampoTexto
            etiqueta="Telefono (opcional)"
            value={empleado.telefono}
            onChange={(e) => cambiar(i, 'telefono', e.target.value)}
            type="tel"
            inputMode="tel"
            ayuda="Como lo tenes agendado: 0981 123 456."
            maxLength={30}
          />
        </div>
      ))}

      {empleados.length < 50 && (
        <BotonGrande
          variante="secundario"
          onClick={() => setEmpleados([...empleados, empleadoVacio()])}
          ancho
        >
          + Agregar otro empleado
        </BotonGrande>
      )}

      {/* El resumen antes de guardar. Es la ultima oportunidad de ver un cero
          de mas, y en la pantalla de un celular los pasos anteriores ya no se
          ven. */}
      <div className="tarjeta">
        <h2 className="subtitulo">Antes de empezar</h2>
        <dl className="lista-datos">
          <div>
            <dt>Precio principal</dt>
            <dd>{listas[0]?.precioPorMil ? formatearGs(listas[0].precioPorMil) : '—'}</dd>
          </div>
          {/* Con las etiquetas puestas, igual que en el Inicio: "2,5 y 1,5
              camiones" no dice cual es cual, y si una de las dos esta mal
              cargada el dueno no tiene como notarlo en este resumen. */}
          <div>
            <dt>Arcilla pura</dt>
            <dd>{formatearCantidad(stock.arcillaPura)} camiones</dd>
          </div>
          <div>
            <dt>Arcilla floja</dt>
            <dd>{formatearCantidad(stock.arcillaFloja)} camiones</dd>
          </div>
          <div>
            <dt>Lena</dt>
            <dd>
              {formatearNumero(stock.lena)} {unidadLena}
            </dd>
          </div>
          <div>
            <dt>Ladrillos</dt>
            <dd>{formatearNumero(stock.ladrillos)}</dd>
          </div>
          <div className="lista-datos-total">
            <dt>Empleados</dt>
            <dd>{cargados.length}</dd>
          </div>
        </dl>
      </div>
    </>
  );
}

export default Configuracion;
