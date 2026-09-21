import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Se ejecuta UNA vez, antes de todo: levanta el MongoDB descartable.
    globalSetup: ['./tests/setup-global.js'],
    // Se ejecuta antes de CADA archivo de test: conecta Mongoose y deja la
    // base limpia entre test y test.
    setupFiles: ['./tests/setup-por-archivo.js'],
    // Los archivos de test comparten la misma base, asi que corren de a uno
    // por vez. Si corrieran en paralelo, la limpieza de uno borraria los datos
    // que otro acaba de crear.
    fileParallelism: false,
    // La primera corrida descarga el motor de MongoDB (~90 MB), puede tardar.
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
