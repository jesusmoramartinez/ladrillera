// -----------------------------------------------------------------------------
// setup-global.js — Levanta un MongoDB de verdad, pero descartable
// -----------------------------------------------------------------------------
// Vitest ejecuta este archivo UNA sola vez, antes de todos los tests.
//
// mongodb-memory-server descarga el motor real de MongoDB (solo la primera
// vez) y lo corre guardando los datos en RAM. Frente a testear contra Atlas:
//   - Rapidisimo y sin internet (despues de la primera vez).
//   - Arranca VACIO en cada corrida: los tests siempre parten de lo mismo.
//   - Cero riesgo de borrar datos reales de la fabrica.
//
// Lo levantamos como "replica set" de un nodo porque MongoDB solo permite
// TRANSACCIONES en replica sets, y desde la fase 4 las vamos a necesitar
// (plan, seccion 5.1: guardar produccion es "todo o nada").
// -----------------------------------------------------------------------------

import { MongoMemoryReplSet } from 'mongodb-memory-server';

export default async function setup({ provide }) {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

  // `provide` deja el valor disponible para los tests via inject().
  // No alcanza con process.env: los tests corren en otro proceso.
  provide('mongoUri', replSet.getUri('ladrillera_test'));

  // Lo que se devuelve es la funcion de limpieza: Vitest la llama al terminar.
  return async () => {
    await replSet.stop();
  };
}
