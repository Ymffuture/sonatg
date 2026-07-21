import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  plugins: [
    // Must come before viteReact() — this is what makes __root.tsx's
    // shellComponent/<Scripts/> actually work. Without it, Vite has no
    // idea how to build the app's HTML entry (which is why a stray
    // index.html + missing src/main.tsx caused the Vercel build to fail —
    // TanStack Start generates its own entry, it was never supposed to
    // need either of those files).
    tanstackStart({
      // Points at the existing SSR error-wrapper entry already in the repo.
      start: { entry: "./src/start.ts" },
    }),
    viteReact(),
    // Tailwind v4 uses its own Vite plugin, not the old PostCSS-plugin
    // approach — styles.css already uses v4's `@import "tailwindcss"`
    // syntax, so this must be this plugin, not `postcss: { plugins: [...] }`.
    tailwindcss(),
  ],
});
