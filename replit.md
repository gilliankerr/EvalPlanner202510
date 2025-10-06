# Evaluation Planner - AI-Powered Nonprofit Program Evaluation Planning

## Overview
This React/TypeScript application, built with Vite, assists nonprofit organizations in creating comprehensive evaluation plans for their programs. It features a multi-step wizard guiding users through program information collection, web scraping, AI-powered analysis, evaluation framework generation, and HTML report generation. The project aims to streamline the evaluation planning process for nonprofits, offering significant market potential by providing an accessible and intelligent tool for program assessment and improvement.

## User Preferences
- None specified yet

## System Architecture

### Frontend
The application is built with React 18.3.1 and TypeScript, utilizing Vite 5.4.2 for development and building. Styling uses CSS Modules exclusively (no Tailwind), complemented by Lucide React for icons. The user interface is a multi-step wizard with progress tracking, designed to be modern and responsive.

**UI Design (October 2025)**: The application uses a clean 3-phase progress indicator instead of showing all 6 backend steps. The phases are configured in `config/workflow.ts`:
- **Phase 1: Program Setup** (steps 1-2) - User input and content extraction
- **Phase 2: AI Analysis** (steps 3-5) - AI processing and framework generation  
- **Phase 3: Your Report** (step 6) - Final report generation

This simplified design reduces visual clutter while maintaining transparency through status messages that show what the AI is currently doing (e.g., "Analyzing program model...", "Building evaluation framework..."). The workflow configuration is flexible and remix-friendly - future implementations can easily customize phase labels, groupings, and status messages by editing `config/workflow.ts`.

**CSS Architecture**: All styling uses CSS Modules (`App.module.css`, `StepProgress.module.css`, `PromptAdmin.module.css`) for scoped, maintainable styles. The modules implement a mobile-first responsive design with breakpoints at 640px (mobile), 768px (tablets), and 1024px (desktop). Color variables are defined in CSS custom properties for easy theming.

**⚠️ IMPORTANT - Styling Guidelines for Future Development**:
- **DO NOT add Tailwind CSS** - This project intentionally uses pure CSS Modules with CSS custom properties
- **DO use CSS custom properties** for theming - All colors and key values are defined as CSS variables (e.g., `--color-primary`, `--color-completed`)
- **DO edit CSS Module files** directly for styling changes - This approach is simpler, more maintainable, and easier to remix
- **Changing colors/theme**: Edit the CSS custom properties at the top of CSS Module files (particularly `App.module.css`)
- **Why no Tailwind**: The project previously had Tailwind but removed it in October 2025 because all styles were already in CSS Modules. Keeping Tailwind would create duplicate color definitions and unnecessary build complexity.

**Systematic Pre-Styling Verification Checklist**:

Before making ANY styling changes, follow this mandatory checklist:

1. **Read Project Documentation** (MANDATORY)
   - Read this replit.md file, especially the styling section above
   - Check for explicit "DO NOT" statements about CSS frameworks
   - Note any color variables or theming systems mentioned

2. **Identify Existing Patterns** (MANDATORY)
   - Search for .module.css files: `glob **/*.module.css`
   - Read 2-3 existing CSS Module files to understand:
     - How colors are defined (CSS custom properties)
     - Naming conventions (camelCase vs kebab-case)
     - Responsive patterns
   - Look at similar components to the one being modified

3. **Verify Component's Existing Styling**
   - Check if component already has a .module.css file
   - Read the component's imports to see what it's currently using
   - Look at className usage in existing code

4. **Make Changes Following Pattern**
   - Use ONLY the styling approach identified in Steps 1-3
   - For CSS Modules: create/edit .module.css file, import it, use styles.className
   - Never default to Tailwind classes

5. **Post-Change Verification**
   - Run grep to search for Tailwind patterns: `bg-`, `text-`, `flex`, `items-`, `justify-`, `p-`, `m-`, `ml-`, `rounded`, etc.
   - Check LSP diagnostics for any errors
   - Verify the component still renders correctly

**Why This Checklist Matters**: The critical mistake is jumping straight to implementation without gathering context first. This checklist forces pattern identification BEFORE making assumptions, preventing the introduction of incompatible styling approaches (like Tailwind) into a CSS Modules codebase.

### Backend and Core Functionality
The application integrates with Supabase for backend services. Key features include URL extraction and robust web scraping with error handling, retry logic, and concurrent processing. AI-powered analysis and evaluation framework generation are central to the system. Prompts for AI models are managed through a comprehensive admin interface, stored in a PostgreSQL database. Email delivery of reports is handled by Resend.

**Async Job Queue Architecture (October 2025)**:
The application uses an async job queue to handle long-running AI analysis tasks (30-60+ seconds) without browser timeout issues:

1. **Job Creation**: Frontend submits jobs to `POST /api/jobs` with job type (prompt1/prompt2/report_template), input data (including metadata: organizationName, programName), and user email
2. **Immediate Response**: Backend creates a job record in PostgreSQL and returns job ID instantly
3. **Background Processing**: Job processor picks up pending jobs, calls OpenRouter API with retry logic, and saves results
4. **Email Delivery**: When complete, results are automatically emailed using the `email_delivery` template from the database. The template fetches metadata (organizationName, programName) from the job's input_data and replaces template variables ({{programName}}, {{organizationName}}, {{currentDateTime}}) to personalize each email.
5. **Status Polling**: Frontend polls `GET /api/jobs/:id` every 3 seconds to check status and display results
6. **Browser Independence**: Users can close the browser anytime - results will still be emailed
7. **Cleanup**: Completed/failed jobs are auto-deleted after 6 hours to prevent database bloat

This architecture solves production timeout limits (2-5 min load balancer timeouts) and allows comprehensiveness over speed by supporting very long AI responses (up to 20,000 tokens for final reports). The email delivery system uses the admin-configurable `email_delivery` template, ensuring consistent, professional communication with users.

**Security Architecture - Three-Tier API Key Management (October 2025)**:
The application implements a secure three-tier architecture that keeps API keys safe and allows remixability:

1. **Backend Proxy Layer** (`server.js`):
   - All OpenRouter API calls go through the backend proxy endpoint `/api/openrouter/chat/completions`
   - API keys are NEVER exposed to the frontend code
   - Frontend components send a `step` parameter (prompt1, prompt2, or report_template) instead of model/API key
   - Backend looks up the appropriate model and temperature for that step from settings

2. **Database Settings Storage**:
   - Settings table stores OpenRouter API key and model configurations
   - Administrators can update settings through the admin UI without redeployment
   - Settings accessible via GET/PUT `/api/settings` endpoints (password-protected)

3. **Environment Variable Fallbacks**:
   - If no database setting exists, system falls back to environment variables
   - Environment variables: `OPENROUTER_API_KEY`, `PROMPT1_MODEL`, `PROMPT2_MODEL`, `REPORT_TEMPLATE_MODEL`
   - This ensures the system works immediately after forking/remixing

**Why This Architecture?**
- **Security**: API keys never touch the frontend, preventing exposure in browser dev tools
- **Remixable**: Others can fork this project and configure their own API keys via admin UI or environment variables
- **Flexible**: Administrators can change AI models and settings without code changes or redeployment

**Automatic Data Injection (Admin-Proof System)**: The system uses automatic context injection to ensure all input data flows correctly through the AI workflow, regardless of how admin users edit prompt templates. Admin users only need to write natural instructions in their prompts - the system automatically prepends all program information (organization name, program name, description, scraped web content) and previous step outputs (program analysis, evaluation framework) before the admin's instructions. This eliminates the need for admins to understand placeholder syntax like `{{variableName}}` and prevents data loss from template editing mistakes. Implementation uses `buildPromptWithContext()` helper function in `promptApi.ts` that structures context data with clear section headers before appending admin templates.

**Contextual Label Preservation**: When users provide URLs with descriptive labels (e.g., "Program info: https://example.com" or "About organization: https://example2.com"), the system preserves this contextual information throughout the scraping and AI analysis pipeline. The `extractLabeledUrls()` function in `url.ts` captures both the label and URL, scraped content is stored with its associated label in `labeledScrapedContent[]`, and `buildPromptWithContext()` formats this data with clear section headers (e.g., "--- PROGRAM INFO ---") so the AI can properly contextualize information from each source. This ensures the AI understands the purpose and context of each scraped webpage, leading to more accurate analysis.

**Naming Convention**: The application uses a consistent naming scheme across components, database identifiers, and settings keys:
- **Components**: `Prompt1.tsx`, `Prompt2.tsx`, `ReportTemplate.tsx`
- **Database identifiers**: `prompt1`, `prompt2`, `report_template`
- **Settings keys**: `prompt1_model`, `prompt2_model`, `report_template_model`, `prompt1_temperature`, `prompt2_temperature`, `report_template_temperature`
- **Environment variable fallbacks**: `PROMPT1_MODEL`, `PROMPT2_MODEL`, `REPORT_TEMPLATE_MODEL`, `OPENROUTER_API_KEY`

### Deployment and Environment
The project is configured for a Reserved VM deployment on Replit, using a unified server architecture for reliable production deployments:

**Development Mode**:
- Vite dev server runs on port 5000 (serves frontend with hot reload)
- Express.js backend runs on port 3001 (handles API requests)
- Vite proxies `/api/*` requests to the backend for seamless development

**Production/Deployed Mode** (October 2025):
- Single Express.js server runs on port 5000
- Serves built frontend static files from `project/dist`
- Handles all `/api/*` endpoints directly
- SPA fallback routing for client-side navigation
- Deployment commands: `npm run build` (builds frontend), `npm start` (runs `start-production.js`)

**Why Unified Architecture?**
- **Reliability**: No CORS issues or proxy complications in production
- **Same-Origin**: Frontend and API share the same origin, eliminating cross-origin request failures
- **Simplicity**: One server to manage in deployment means fewer failure points
- **Fix for recurring deployment bug**: Previous two-server production setup failed because Vite's dev proxy doesn't exist in production builds, causing "Analysis Failed" errors when frontend couldn't reach backend API

### Admin Interface
A secure, session-based authentication system protects the admin interface, which allows for managing AI prompts, viewing system configurations (LLM models, temperatures, web search settings, email settings), and managing email delivery templates. Prompts can be edited using a markdown editor, with support for version history and rollbacks. The configuration panel displays web search status for each prompt with clear visual indicators (🌐 Enabled/Disabled).

### HTML Report Generation
HTML reports are generated using the `marked` library, incorporating logic model SVG diagrams, enhanced table styling, and responsive design, with options for direct download or email delivery.

## External Dependencies
- **PostgreSQL**: Database for storing prompts and version history.
- **Supabase**: Backend-as-a-service for various functionalities.
- **Resend**: Transactional email service for sending evaluation reports.
- **Express.js**: Node.js framework for the backend API and email server.
- **OpenRouter**: Provides AI model access for program analysis and evaluation framework generation.
- **@uiw/react-md-editor**: Markdown editor component used in the admin interface.
- **Lucide React**: Icon library.
- **CORS proxy**: Used for web scraping functionality.