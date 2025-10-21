# Railway Deployment Playbook

This guide captures the end-to-end steps for running the Evaluation Planner on Railway using their serverless container platform. It draws directly from the official Railway docs for [Express deployments](https://docs.railway.com/guides/express) and the guide to [referencing environment variables across services](https://docs.railway.com/guides/variables#referencing-another-services-variable).

## Recommended Architecture

The feature set (background AI jobs, email delivery, Postgres-backed sessions, and admin tooling) benefits from a two-service layout:

1. **API Service (Express)** – Serves REST endpoints and the built React frontend. Deploy the `server.js` entrypoint with the default `ENABLE_JOB_PROCESSOR=true` so the API can process smaller jobs immediately.
2. **Worker Service** – Runs the long-lived job processor without an HTTP listener. Deploy the new `worker.js` entrypoint. This keeps the queue active even if the API service scales to zero and avoids tying heavy OpenRouter calls to request latency.

Railway automatically detects that each service is a Node.js app, but it will not split your project into API and worker for you. If you prefer to run everything in a single container, you can deploy only the API service and set `ENABLE_JOB_PROCESSOR=false`, but long-running jobs will then compete with HTTP traffic. For production usage the two-service layout is recommended.

Both services point to the same Railway Postgres database via the shared `DATABASE_URL` reference variable. You can disable the worker on the API instance by setting `ENABLE_JOB_PROCESSOR=false` if you prefer strict separation.

## Provision Resources

1. **Create a project** (`railway init`) following the Express guide.
2. **Add Postgres**: `railway add -d postgres` (see the Express guide's database section).
3. **Create services**:
   - `railway add` → *Empty Service* → deploy API. The repo ships with `railway.json` configured for the multi-stage Dockerfile in the project root, which compiles the frontend and bakes in the `node start-production.js` entrypoint—no dashboard overrides required.
   - `railway add` → *Empty Service* → deploy Worker. Reuse the same Docker image and set service variables `WORKER_ONLY=true` and `ENABLE_JOB_PROCESSOR=true` so the process switches into worker mode at runtime.

4. **Initialize the database** (once per environment):
   - Apply the schema: `npm run db:migrate`
   - Seed core prompts: `npm run db:seed`
   These commands rely on `DATABASE_URL`; when running locally they read `.env`, and on Railway they run with the service variables automatically.

## Environment Variables

Use the Variables guide to keep configuration in one place:

| Variable | Scope | Notes |
| --- | --- | --- |
| `DATABASE_URL=${{Postgres.DATABASE_URL}}` | API & Worker | References the managed Postgres connection string. |
| Variable | Where to set it | Notes |
| --- | --- | --- |
| `DATABASE_URL=${{Postgres.DATABASE_URL}}` | API & Worker | References the managed Postgres connection string. |
| `RESEND_API_KEY` | API & Worker | Resend API token for outgoing email. |
| `RESEND_FROM_EMAIL` | API & Worker | Verified sender address. |
| `OPENROUTER_API_KEY` | API & Worker | Needed for AI prompt generation. |
| `PROMPT*_MODEL`, `PROMPT*_TEMPERATURE`, `PROMPT*_WEB_SEARCH` | API & Worker | Optional overrides for each AI step; keep consistent across services. |
| `ENABLE_JOB_PROCESSOR` | API & Worker | Set `true` on the worker. On the API you may set `false` to ensure only the worker processes jobs. |
| `WORKER_ONLY` | Worker only | Set `true` on the worker service so it skips binding an HTTP port. Leave unset/`false` on the API. |
| `ADMIN_PASSWORD` | API only | Protects the admin UI; the worker does not need it. |

To reuse variables across services, add them once in the project and then set service variables as references (e.g. `DATABASE_URL=${{Postgres.DATABASE_URL}}` or `API_URL=https://${{ api.RAILWAY_PUBLIC_DOMAIN }}` if you later deploy a separate frontend service).

## Build & Deploy Flow

1. Install dependencies: `npm install` (root script installs the Vite frontend automatically).
2. Build the frontend: `npm run build`.
3. Deploy backend services:
   - API: `railway up --service api`
   - Worker: `railway up --service worker`

The repository includes a `railway.json` config-as-code manifest that instructs Railway to build with the root Dockerfile. That container installs dependencies, runs `npm run build` for the SPA, copies the pre-rendered `project/dist`, and sets `CMD node start-production.js`. The production launcher (`start-production.js`) inspects `WORKER_ONLY`/`RAILWAY_SERVICE_NAME` to decide between server and worker modes, so both services can reuse the same image and launch command without manual overrides in the dashboard.

## Operational Notes

- The worker relies on the Postgres job queue; monitor the `jobs` table and Railway logs for throughput concerns.
- Use Railway's shared variables if you introduce a separate static frontend in the future; reference the API's `RAILWAY_PUBLIC_DOMAIN` in the SPA via `API_URL=https://${{ api.RAILWAY_PUBLIC_DOMAIN }}` as shown in the variables guide.
- Background cleanup (session + job pruning) now runs in whichever service has `ENABLE_JOB_PROCESSOR=true`.

## Local Development

- API server: `npm run start` (after building the frontend).
- Worker: `npm run worker`.
- Development SPA: `npm run dev` (runs Vite on port 5173 by default).
- Environment variables from `.env` are loaded automatically via `dotenv`, so you do not need to `source` the file manually.
- If your `DATABASE_URL` uses `postgres.railway.internal`, that host is only reachable from within Railway. Use `railway connect`/`railway shell` to proxy the database locally or update `.env` with the public connection string shown in the Railway dashboard.
- After provisioning a fresh database locally, run `npm run db:migrate` followed by `npm run db:seed` to create required tables (`prompts`, `prompt_versions`, `sessions`, `settings`, `jobs`) and populate baseline prompts.

The `.env.example` file is annotated with these scopes so you can import the right values into each Railway service. With this layout the application behaves like a serverless architecture on Railway while preserving the long-running background work required for AI plan generation.
