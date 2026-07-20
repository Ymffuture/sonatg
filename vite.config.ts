import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "tailwindcss";

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  css: {
    postcss: {
      plugins: [tailwindcss],
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
      },
    },
  },
});
