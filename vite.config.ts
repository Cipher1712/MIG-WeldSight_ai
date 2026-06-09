// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Force Nitro on so self-hosted builds (Vercel, Netlify, etc.) get a
  // proper SSR server. Nitro auto-detects the target from env vars set by
  // the host — on Vercel, `VERCEL=1` selects the `vercel` preset and
  // outputs to `.vercel/output/` per Vercel's Build Output API.
  // To force a specific target locally: `NITRO_PRESET=vercel bun run build`.
  nitro: true,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
