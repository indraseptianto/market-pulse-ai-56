// Vercel deployment: uses Nitro adapter instead of @cloudflare/vite-plugin
// TanStack Start + Nitro is the officially supported path for Vercel.
// See: https://vercel.com/docs/frameworks/full-stack/tanstack-start
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tanstackStart(),
    nitro(),
    viteReact(),
    tailwindcss(),
    tsconfigPaths(),
  ],
});
