# MSME Sentinel

MSME Sentinel helps small and medium businesses spot early financial distress, understand the main risk drivers, and act before a warning becomes a crisis.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/msme-sentinel run dev` — run the web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/msme-sentinel/src/App.tsx` — responsive Sentinel workspace and state-driven screens
- `artifacts/msme-sentinel/src/index.css` — shared visual language, light/dark tokens, and print styles
- `artifacts/api-server/src/routes/sentinel.ts` — dataset validation, transparent risk scoring, warnings, recommendations, history, and reports
- `lib/api-spec/openapi.yaml` — source of truth for the typed API contract

## Architecture decisions

- The web app is a React/Vite artifact and the shared Express API owns risk assessment behavior.
- Uploads are parsed in the browser, then sent as structured rows to the API so the validation preview and API response stay aligned.
- Demo data is clearly labeled and includes a small labeled benchmark; unlabeled uploads use a transparent risk scorecard rather than fabricated model accuracy.
- Risk thresholds are application-defined bands: LOW through 25%, MEDIUM through 50%, HIGH through 75%, and CRITICAL above 75%.

## Product

Users can load the labeled demo dataset or upload a CSV, review validation quality, run an assessment, inspect failure probability and health score, understand contributing risk factors, review early warnings and recommendations, browse prediction history, and open a print-friendly report.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The Vite build expects workflow-provided `PORT` and `BASE_PATH`; the managed web workflow supplies both.
- Uploaded datasets must include the required MSME indicators or one of the supported aliases before an assessment can run.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
# MSME Sentinel

MSME Sentinel helps small and medium businesses spot early financial distress, understand the main risk drivers, and act before a warning becomes a crisis.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/msme-sentinel run dev` — run the web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/msme-sentinel/src/App.tsx` — responsive Sentinel workspace and state-driven screens
- `artifacts/msme-sentinel/src/index.css` — shared visual language, light/dark tokens, and print styles
- `artifacts/api-server/src/routes/sentinel.ts` — dataset validation, transparent risk scoring, warnings, recommendations, history, and reports
- `lib/api-spec/openapi.yaml` — source of truth for the typed API contract

## Architecture decisions

- The web app is a React/Vite artifact and the shared Express API owns risk assessment behavior.
- Uploads are parsed in the browser, then sent as structured rows to the API so the validation preview and API response stay aligned.
- Demo data is clearly labeled and includes a small labeled benchmark; unlabeled uploads use a transparent risk scorecard rather than fabricated model accuracy.
- Risk thresholds are application-defined bands: LOW through 25%, MEDIUM through 50%, HIGH through 75%, and CRITICAL above 75%.

## Product

Users can load the labeled demo dataset or upload a CSV, review validation quality, run an assessment, inspect failure probability and health score, understand contributing risk factors, review early warnings and recommendations, browse prediction history, and open a print-friendly report.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The Vite build expects workflow-provided `PORT` and `BASE_PATH`; the managed web workflow supplies both.
- Uploaded datasets must include the required MSME indicators or one of the supported aliases before an assessment can run.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
