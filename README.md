# WeldSight AI - Frontend Dashboard

A real-time MIG welding quality monitoring dashboard built with React 19, TanStack Start, and Tailwind CSS v4. Polls a FastAPI backend running on Render, visualises live voltage telemetry from an ESP32, and surfaces AI-derived weld quality metrics, physics-based diagnoses, and anomaly events.

**Live app:** `https://mig-weld-sight-ai.vercel.app`  
**Backend API:** `https://backend-mig-weldsight-ai.onrender.com`  
**Backend repo:** `https://github.com/Cipher1712/BACKEND_MIG_WeldSight_AI`

---

## System Context

This repo is the frontend layer of a three-tier IoT + AI system:

```
ESP32 (750 Hz voltage sampling)
        │
        │ HTTPS POST /api/infer
        ▼
Render Backend (FastAPI + PyTorch VAE + Isolation Forest)
https://backend-mig-weldsight-ai.onrender.com
        │
        │ HTTP polling (500 ms / 1000 ms intervals)
        ▼
Vercel Frontend (TanStack Start + React 19)
https://mig-weld-sight-ai.vercel.app
```

The frontend has **no WebSocket connections** - it migrated fully to HTTP polling in the current version. See [`FRONTEND_HTTP_POLLING_MIGRATION_REPORT.md`](./FRONTEND_HTTP_POLLING_MIGRATION_REPORT.md) for the full migration audit.

---

## Tech Stack

| Layer | Technology / Version |
|---|---|
| Framework | TanStack Start 1.167 (SSR via Nitro) |
| Router | TanStack Router 1.168 (file-based, type-safe) |
| React | React 19.2 |
| Build tool | Vite 7.3 + `@lovable.dev/vite-tanstack-config` |
| SSR server | Nitro (Vercel preset auto-detected via `VERCEL=1`) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| UI primitives | Radix UI (full suite - see `package.json`) |
| Charts | Recharts 2.15 |
| Animation | Framer Motion 12.40 |
| Data fetching | TanStack Query 5.83 |
| Forms | React Hook Form 7.71 + Zod 3.24 + `@hookform/resolvers` |
| Notifications | Sonner 2.0 |
| Language | TypeScript 5.8 (strict) |
| Linting | ESLint 9 + `typescript-eslint` + Prettier 3.7 |
| Package manager | npm (lockfile present); Bun also supported (`bunfig.toml`) |

---

## Repository Structure

```
.
├── src/
│   ├── router.tsx                        # TanStack Router instance
│   ├── routeTree.gen.ts                  # Auto-generated route tree (do not edit)
│   ├── server.ts                         # SSR entry point / error wrapper (Nitro)
│   ├── start.ts                          # Client hydration entry
│   ├── styles.css                        # Global styles + Tailwind v4 directives
│   │
│   ├── components/
│   │   ├── ui/                           # Full shadcn/ui component library
│   │   │   ├── chart.tsx                 # Recharts wrapper with theme tokens
│   │   │   ├── sidebar.tsx               # Collapsible sidebar primitive
│   │   │   └── ... (50+ components)
│   │   │
│   │   └── weldsight/                    # Domain-specific dashboard widgets
│   │       ├── RawVoltageChart.tsx       # Live voltage waveform (Recharts)
│   │       ├── QualityIndexCard.tsx      # AI quality score (0–100) with risk badge
│   │       ├── PhysicsInsightPanel.tsx   # Physics-derived diagnosis display
│   │       ├── PhysicsEventsTimeline.tsx # Scrollable anomaly event timeline
│   │       ├── RecentEventsTable.tsx     # Tabular anomaly history with severity
│   │       ├── HistoricalAnalytics.tsx   # Trend charts and session summaries
│   │       ├── ProcessSetupPanel.tsx     # Material / thickness profile config
│   │       └── TrainingPanel.tsx         # CSV upload → baseline model training
│   │
│   ├── hooks/
│   │   └── use-mobile.tsx                # Responsive breakpoint hook
│   │
│   ├── lib/
│   │   ├── config.server.ts              # Server-side environment config
│   │   ├── error-capture.ts              # Client error capture utilities
│   │   ├── error-page.ts                 # Error page helpers
│   │   ├── lovable-error-reporting.ts    # Lovable platform error reporting
│   │   ├── physicsClassifier.ts          # Client-side physics rule engine
│   │   ├── profiles.ts                   # Weld profile definitions (material/thickness)
│   │   ├── qualityIndex.ts               # Quality index display helpers
│   │   ├── stream.ts                     # CSV parsing, frame mapping, DBSCAN clustering
│   │   ├── telemetryPolling.ts           # HTTP polling orchestration (500 ms / 1 s)
│   │   ├── utils.ts                      # cn() and general utilities
│   │   └── api/
│   │       └── example.functions.ts      # TanStack Start server function examples
│   │
│   └── routes/
│       ├── __root.tsx                    # Root layout, providers, HTML shell
│       ├── index.tsx                     # Main dashboard page (live + historical tabs)
│       └── README.md                     # Route-level notes
│
├── firmware/                             # ESP32 C++ firmware source
├── backend/                              # Backend reference copy (see dedicated repo)
├── public/                               # Static assets
│
├── vite.config.ts                        # Vite config (Nitro SSR + Vercel preset)
├── vercel.json                           # Vercel build config (vite build / npm install)
├── tsconfig.json                         # TypeScript config
├── components.json                       # shadcn/ui config
├── .env.example                          # Environment variable template
├── .prettierrc                           # Prettier config
└── FRONTEND_HTTP_POLLING_MIGRATION_REPORT.md
```

---

## Dashboard Components

### `RawVoltageChart.tsx`
Live scrolling voltage waveform rendered with Recharts. Appends only real `latest_inference` frames returned by the backend - no synthetic/placeholder data is ever generated. Displays `Waiting for telemetry...` when the buffer is empty.

### `QualityIndexCard.tsx`
Renders the AI quality score (0–100) with a colour-coded risk badge: **Normal** (green) / **Watch** (yellow) / **Warning** (orange) / **Critical** (red). Derived from the backend's adaptive threshold fusion output.

### `PhysicsInsightPanel.tsx`
Displays the active physics-based diagnosis from the backend inference pipeline - arc instability, burn-through risk, cold arc risk, or transfer irregularity - alongside the stability score and EWMA-smoothed anomaly value.

### `PhysicsEventsTimeline.tsx`
Scrollable timeline of anomaly events fetched from `GET /events/latest`. Distinguishes in-memory events from persisted DB events via the backend's fallback behaviour.

### `RecentEventsTable.tsx`
Tabular view of recent anomaly/risk events with timestamp, severity, voltage snapshot, and physics label. Sortable by severity.

### `HistoricalAnalytics.tsx`
Session-level trend charts: quality index over time, anomaly frequency histogram, voltage envelope statistics.

### `ProcessSetupPanel.tsx`
UI for selecting `material` and `thickness_mm` profile before starting a weld session. Values are sent as metadata in the first telemetry frame.

### `TrainingPanel.tsx`
CSV upload interface that POSTs voltage trace files to `POST /api/train` to establish a new baseline model for a given material/thickness profile. Uses `parseCsvVoltage` from `src/lib/stream.ts`.

---

## HTTP Polling Architecture

The dashboard replaced WebSocket live streaming with three independent polling loops managed by `src/lib/telemetryPolling.ts`:

| Poll | Endpoint | Interval | Purpose |
|---|---|---|---|
| Telemetry | `GET /telemetry/latest` | 500 ms | Raw voltage packet + latest inference frame |
| Metrics | `GET /metrics/latest` | 500 ms | Quality index, stability, anomaly score, risk label, model readiness |
| Events | `GET /events/latest` | 1000 ms | Recent anomaly/risk events |

**Connection state machine:**

| State | Condition |
|---|---|
| `Connected` | Last successful request within 5 s and data received |
| `Polling` | One or more requests currently in-flight |
| `Disconnected` | Three repeated failures or no recent successful request |
| `No Data` | Endpoints reachable but returning `{}` / `[]` |

Request failures are logged silently - they are not surfaced as UI errors on the live dashboard.

---

## Client-Side Physics Classifier

`src/lib/physicsClassifier.ts` runs a lightweight rule engine in the browser that mirrors a subset of the backend's physics logic. This enables instant local pre-classification of uploaded CSV files (in `TrainingPanel`) before the data is submitted for full server-side inference, giving immediate feedback without a round-trip.

---

## Build & Deployment

### Vercel (production)

The app is deployed to Vercel via `vercel.json`:

```json
{
  "buildCommand": "vite build",
  "installCommand": "npm install",
  "framework": null
}
```

Vite builds through Nitro with the Vercel preset. Nitro auto-detects `VERCEL=1` and outputs to `.vercel/output/` per Vercel's Build Output API, enabling SSR via Vercel Edge Functions.

To force a specific Nitro preset locally:
```bash
NITRO_PRESET=vercel bun run build
```

### Local Development

```bash
# Clone and install
git clone https://github.com/Cipher1712/MIG-WeldSight_ai.git
cd MIG-WeldSight_ai
npm install

# Configure environment
cp .env.example .env
# Edit .env if pointing to a local backend instance

# Start dev server
npm run dev
```

The dev server runs with HMR. TanStack Router's route tree (`routeTree.gen.ts`) is regenerated automatically on file changes in `src/routes/`.

### Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production SSR build via Nitro |
| `npm run build:dev` | Development mode build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint (TypeScript + React Hooks rules) |
| `npm run format` | Prettier write |

---

## Environment Variables

```env
# Required - URL of the FastAPI backend
VITE_API_URL=https://backend-mig-weldsight-ai.onrender.com
```

Only one variable is required. All `VITE_*` variables are injected at build time by Vite and inlined into the client bundle. Server-side config is loaded via `src/lib/config.server.ts`.

For local development against the live Render backend, no changes to `.env` are needed - the default value in `.env.example` points directly to the production API.

---

## Firmware

The `firmware/` directory contains the ESP32 C++ source that samples arc voltage at 750 Hz and POSTs telemetry packets to `POST /api/infer` on the Render backend. The ESP32 is the sole producer of telemetry; the frontend is read-only.

---

## Languages

| Language | Share |
|---|---|
| TypeScript | 88.8% |
| Python | 7.3% (backend reference + scripts) |
| CSS | 2.1% |
| C++ | 1.2% (ESP32 firmware) |

---

## Related Repositories

| | URL |
|---|---|
| Backend (FastAPI + AI) | https://github.com/Cipher1712/BACKEND_MIG_WeldSight_AI |
| Frontend (this repo) | https://github.com/Cipher1712/MIG-WeldSight_ai |

---

## License

Centre of Excellence in Advanced Manufacturing Technology, Indian Institute of Technology Kharagpur
