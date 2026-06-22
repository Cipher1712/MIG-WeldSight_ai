# Frontend HTTP Polling Migration Report

## Phase 1 WebSocket Usage Audit

| File | Reference | Purpose | Can remove? | Must keep? |
| --- | --- | --- | --- | --- |
| `src/lib/stream.ts` | `WebSocket`, `new WebSocket`, `WS_LIVE_URL`, WebSocket status/reconnect timeout | Previous live telemetry transport. | Removed. | No. CSV parsing, frame mapping, and clustering helpers remain in this file. |
| `src/routes/index.tsx` | `connectStream`, `StreamHandle`, `WS_LIVE_URL`, stream lifecycle effect | Previous dashboard live data source and status indicator. | Removed/replaced. | No. Live dashboard now uses HTTP polling. |
| `src/lib/apiClient.ts` | `DEFAULT_WS_LIVE_URL`, `WS_LIVE_URL`, `VITE_WS_URL` | Previous WebSocket URL configuration. | Removed. | No. `API_URL` remains. |
| `.env.example` | `VITE_WS_URL` | Previous WebSocket environment variable. | Removed. | No. |
| `src/components/weldsight/TrainingPanel.tsx` | `parseCsvVoltage` imported from `@/lib/stream` | CSV utility import only. Not WebSocket transport. | No. | Yes. Used by training uploads. |

## Files Modified

- `.env.example`
- `src/lib/apiClient.ts`
- `src/lib/stream.ts`
- `src/lib/telemetryPolling.ts`
- `src/routes/index.tsx`
- `FRONTEND_HTTP_POLLING_MIGRATION_REPORT.md`

## Files Removed

No files were deleted.

## Remaining WebSocket References

Frontend source scan for:

```text
WebSocket
new WebSocket
ws://
wss://
WS_LIVE_URL
WS_STREAM_URL
socket
```

Result: no frontend source references remain.

Remaining `stream` references are non-WebSocket utility references:

- `src/lib/stream.ts`: CSV parsing, backend frame mapping, DBSCAN helper.
- `src/routes/index.tsx`: imports non-WebSocket helpers from `@/lib/stream`.
- `src/components/weldsight/TrainingPanel.tsx`: imports `parseCsvVoltage`.

Backend and firmware WebSocket references were not modified.

## Polling Architecture

```text
Frontend
 ↓
src/lib/telemetryPolling.ts
 ↓
GET /telemetry/latest
```

```text
Frontend
 ↓
src/lib/telemetryPolling.ts
 ↓
GET /metrics/latest
```

```text
Frontend
 ↓
src/lib/telemetryPolling.ts
 ↓
GET /events/latest
```

## Polling Intervals

```ts
const TELEMETRY_INTERVAL = 500;
const METRICS_INTERVAL = 500;
const EVENTS_INTERVAL = 1000;
```

## Runtime Behavior

- `GET /telemetry/latest` feeds live dashboard points from `latest_inference`.
- `GET /metrics/latest` feeds polling status/model readiness context.
- `GET /events/latest` feeds recent live anomaly history.
- `{}` from telemetry or metrics is treated as no data.
- `[]` from events is treated as no data.
- Request failures are not displayed as UI errors in the live dashboard.
- No fake telemetry, fake metrics, or placeholder inference frames are generated.

## Connection Status

The live dashboard now uses:

- `Connected`: last successful request was within 5 seconds and data has been received.
- `Polling`: one or more requests are currently active.
- `Disconnected`: three repeated request failures or no recent successful request.
- `No Data`: endpoints are reachable but return empty telemetry/metrics/events.

## Verification

- Project build: successful with `npm run build`.
- Dashboard transport: live tab now uses HTTP polling instead of WebSocket.
- No fake telemetry exists: dashboard appends only real `latest_inference` frames returned by the backend.
- Empty states work: the live tab displays `No live telemetry available` and `Waiting for telemetry...`.
- Backend endpoints integrated:
  - `GET /telemetry/latest`
  - `GET /metrics/latest`
  - `GET /events/latest`

## Notes

The first non-elevated build attempt failed with `spawn EPERM` while Vite/esbuild tried to spawn its local build helper. The same command succeeded when rerun with permission to spawn the build process.
