import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // El celular y la PC son dos "origenes" distintos para el navegador.
    // Con este proxy, el frontend llama a "/api/..." (su propio origen) y Vite
    // reenvia el pedido al backend en el 4000. Ventajas:
    //   - No hay problemas de CORS en desarrollo.
    //   - El codigo del frontend no lleva la URL del backend escrita adentro:
    //     en produccion apunta al dominio real sin tocar nada.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
