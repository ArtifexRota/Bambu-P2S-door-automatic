import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import path from "path";

export default defineConfig({
  root: path.join(__dirname, "src/renderer"),
  base: "./", // Perfekt! Das fixt die relativen Pfade für Electron
  plugins: [
    react(),
    electron([
      {
        // Main-Prozess (Dein Backend)
        entry: path.join(__dirname, "src/main/main.ts"),
        vite: {
          build: {
            outDir: path.join(__dirname, "dist/main"),
            rollupOptions: {
              external: ["serialport", "mqtt", "bufferutil", "utf-8-validate"],
            },
          },
        },
      },
      {
        // Preload-Skript (Die Brücke)
        entry: path.join(__dirname, "src/preload/preload.ts"),
        vite: {
          build: {
            outDir: path.join(__dirname, "dist/preload"),
          },
        },
      },
    ]),
  ],
  server: {
    // Hier startet Vite den Server für React
    port: 3000,
  },
  build: {
    // DIES IST DER FIX: Ein absoluter Pfad vom Projekt-Hauptordner aus
    outDir: path.join(__dirname, "dist/renderer"),
    emptyOutDir: true, // Sorgt dafür, dass Vite den Ordner vor jedem Build sauber macht
  },
});