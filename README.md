# Evaluation Planner – AI-Powered Nonprofit Program Evaluation Planning

## Overview
Evaluation Planner is a full-stack application that helps nonprofit organizations build rigorous program evaluation plans. The tool walks practitioners through gathering program context, enriching it with web scraping, orchestrating AI-assisted analysis, and exporting polished evaluation reports. The goal is to make evidence-based planning accessible while keeping administration lightweight for remixers and self-hosters.

## Highlights
- **Guided multi-step wizard:** A React/TypeScript SPA leads users through Program Setup, AI Analysis, and Your Report phases with clear progress indicators.
- **AI-first workflow:** Automatic context injection combines user inputs, scraped sources, and prior AI outputs so that administrators can manage prompt templates without losing situational awareness.
- **Robust background processing:** Long-running OpenRouter calls run in a PostgreSQL-backed job queue, preventing browser timeouts and allowing work to continue after the tab closes.
- **Secure admin tooling:** Password-protected admin pages manage AI prompts, LLM model settings, and email templates with version history.
- **Shareable HTML reports:** The `marked` pipeline renders responsive, email-ready reports complete with logic model diagrams and enhanced tables.

## System Architecture
### Frontend
- Built with React and TypeScript using Vite (`project/` directory).
- Styling uses CSS Modules exclusively, with custom properties for theming—no Tailwind.
- The stepper workflow is configured in `src/config/workflow.ts`, driving the three-phase progress indicator.
- Lucide React powers icons, and the UI is mobile-first with responsive media queries baked into each module.

### Backend & Core Services
- An Express server (`server.js`) serves the compiled SPA, exposes REST APIs, and proxies all OpenRouter traffic through `/api/openrouter/chat/completions` to keep API keys out of the browser.
- Supabase provides authentication and storage; PostgreSQL stores prompts, versions, session data, settings, and queued jobs.
- Resend handles transactional email delivery for finalized reports.
- Settings cascade from the database to environment variables, giving remixers a safe fallback when the admin UI is not yet configured.

### AI Workflow
- Prompt templates live in the database and are referenced consistently across UI components (e.g., `Prompt1.tsx` ⇔ `prompt1_model`).
- Context from program inputs, scraped pages, and previous AI responses is automatically prepended to each prompt to maintain continuity.
- Administrators can toggle model, temperature, and web-search flags per prompt either through the settings table or environment variables.

## Background Job Processing & Worker Mode
- Jobs submit via `POST /api/jobs` and are processed asynchronously to avoid tying browser latency to LLM execution.
- `ENABLE_JOB_PROCESSOR` controls whether a process consumes jobs; set `WORKER_ONLY=true` to launch a dedicated worker with no HTTP port.
- The shared PostgreSQL queue ensures that long-running tasks continue even if the API container scales down.

## Deployment on Railway
### Recommended Architecture
1. **API Service (Express):** Runs `start-production.js`, serves the built frontend, and can optionally handle lightweight jobs.
2. **Worker Service:** Uses the same container image but runs purely as a queue processor with `WORKER_ONLY=true` and `ENABLE_JOB_PROCESSOR=true`.

This split keeps heavy OpenRouter calls off the request path while ensuring the queue stays active even if the API service scales to zero.

### Provisioning Steps
1. Create a Railway project (`railway init`) following the Express guide.
2. Add a managed Postgres database (`railway add -d postgres`).
3. Add two empty services:
   - **api** – default settings, runs the Express server.
   - **worker** – reuse the same image, but set `WORKER_ONLY=true` and `ENABLE_JOB_PROCESSOR=true`.
4. Reference the shared Postgres connection with `DATABASE_URL=${{ Postgres.DATABASE_URL }}` on both services.
5. After the first deploy, initialize the database:
   - Apply schema: `npm run db:migrate`
   - Seed baseline prompts: `npm run db:seed`

### Optional automatic migrations at startup

Set environment variable `RUN_DB_MIGRATIONS=true` to automatically run `npm run db:migrate` during container startup. This is useful for simple deployments or CI-run containers. The migration script uses a Postgres advisory lock to avoid concurrent migrations across replicas. Use this option with caution—manual migrations during deployment give more control in production.

Notes on configuration and production safety:
- The advisory lock key is configurable via `DB_MIGRATE_ADVISORY_LOCK` (defaults to `1234567890`). Change this value if multiple apps share the same database to avoid lock collisions.
- Automatic migrations run synchronously and can delay or block container startup if migrations take a long time. For production-grade workflows prefer running migrations as a separate CI/CD job or a one-off migration service.
- The migration script waits for DB readiness by retrying up to `DB_MIGRATE_MAX_RETRIES` times with `DB_MIGRATE_SLEEP_SECONDS` between attempts. Defaults are 12 retries and 5 seconds (≈60s total). Adjust these via env vars as needed.

### Build & Deploy Flow
1. Install dependencies: `npm install` (installs root and frontend packages via the `postinstall` hook).
2. Build the frontend: `npm run build` (Vite output is copied into the production image automatically).
3. Deploy services:
   - API: `railway up --service api`
   - Worker: `railway up --service worker`

`railway.json` and the root `Dockerfile` bake these steps into the container image so the dashboard needs no overrides.

## Environment Configuration
Evaluation Planner uses a three-tier key management strategy:
1. **Proxy layer:** All browser-facing requests hit Express, which forwards OpenRouter calls server-side.
2. **Database settings table:** Preferred source for models, temperatures, and API keys via the admin UI.
3. **Environment variable fallback:** If a setting is absent in the database, the corresponding environment variable is used.

Set the following variables in local `.env` files or Railway project variables:

| Variable | Scope | Description |
| --- | --- | --- |
| `DATABASE_URL=${{ Postgres.DATABASE_URL }}` | API & Worker | Connection string for the shared PostgreSQL instance. |
| `OPENROUTER_API_KEY` | API & Worker | Required for AI prompt generation via OpenRouter. |
| `PROMPT*_MODEL` / `PROMPT*_TEMPERATURE` / `PROMPT*_WEB_SEARCH` | API & Worker | Optional overrides for each AI prompt stage. Keep them consistent across services. |
| `ENABLE_JOB_PROCESSOR` | API & Worker | Set `true` on the worker. On the API, toggle `false` if you want strict separation. |
| `WORKER_ONLY` | Worker only | Set `true` so the process skips binding an HTTP listener. Leave unset for the API. |
| `RESEND_API_KEY` | API & Worker | Token for outgoing email via Resend. |
| `RESEND_FROM_EMAIL` | API & Worker | Verified sender address for delivered reports. |
| `ADMIN_PASSWORD` | API only | Protects the admin interface. |

> Tip: When running locally, create a `.env` file in the repository root so Node scripts and Vite can read the configuration through `dotenv`.

## Local Development
1. Ensure Node.js 18+ and Postgres are available locally.
2. Clone the repository, then install dependencies from the project root: `npm install`.
3. Start the Vite dev server for the SPA: `npm run dev` (runs in watch mode on port 5173).
4. In another terminal, launch the Express backend after building the SPA: `npm run build` followed by `npm run start`.
5. To process jobs alongside the API, run `npm run worker` in a separate terminal. Alternatively, set `ENABLE_JOB_PROCESSOR=true` before starting the API to let it process lightweight jobs directly.

### Database Setup (Local)
- Make sure `DATABASE_URL` in your `.env` points to a reachable Postgres instance.
- Apply schema migrations: `npm run db:migrate`.
- Seed baseline prompts and settings: `npm run db:seed`.
- Railway-managed databases using the `postgres.railway.internal` host require invoking `railway connect` or updating `.env` with the public connection string when running locally.

## Available Scripts
Root-level scripts (run from the repository root):
- `npm run build` – Compiles the frontend via Vite.
- `npm run start` – Launches `start-production.js`, which decides between server and worker modes based on environment variables.
- `npm run dev` – Runs the frontend development server (`project/`).
- `npm run worker` – Starts the dedicated job processor (`worker.js`).
- `npm run db:migrate` – Applies database migrations via `scripts/db-migrate.sh`.
- `npm run db:seed` – Seeds core prompt data (`seed-prompts.js`).

Inside `project/`:
- `npm run dev` – Vite development server.
- `npm run build` – Produces the production SPA bundle.
- `npm run preview` / `npm run start` – Serves the built bundle for local preview.
- `npm run lint` – Runs ESLint against the frontend codebase.

## Project Structure
- `server.js` – Express entry point that serves the SPA and exposes REST APIs.
- `worker.js` – Background job processor for long-running AI tasks.
- `start-production.js` – Smart launcher that selects server or worker roles at runtime.
- `project/` – React/Vite SPA with CSS Modules-driven UI components.
- `db/` – SQL schema and seed data for prompts.
- `scripts/db-migrate.sh` – Convenience wrapper for applying schema migrations.
- `attached_assets/` – Sample generated evaluation reports.

## Additional Resources
- `RAILWAY_DEPLOYMENT.md` – In-depth deployment instructions for Railway, including configuration-as-code.
- `CODEBASE_EFFICIENCY_REVIEW.md` & `FINAL_TEST_REPORT.md` – Historical analyses and testing metrics.

For questions or contributions, feel free to open issues or pull requests. Happy planning!
