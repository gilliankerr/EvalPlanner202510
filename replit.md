# Evaluation Planner - AI-Powered Nonprofit Program Evaluation Planning

## Overview
This React/TypeScript application helps nonprofit organizations create comprehensive evaluation plans. It guides users through program information collection, web scraping, AI-powered analysis, evaluation framework generation, and HTML report generation. The project aims to streamline evaluation planning for nonprofits, offering an accessible and intelligent tool for program assessment and improvement.

## User Preferences
- None specified yet

## System Architecture

### Frontend
The application is a multi-step wizard built with React and TypeScript, using Vite for development. Styling exclusively uses CSS Modules with custom properties for theming, complemented by Lucide React for icons. The UI features a 3-phase progress indicator (Program Setup, AI Analysis, Your Report) for clarity, configured in `config/workflow.ts`. Styling adheres to a mobile-first responsive design, and Tailwind CSS is explicitly not used to maintain a pure CSS Modules approach.

### Backend and Core Functionality
The application integrates with Supabase for backend services. Key features include robust web scraping with error handling, AI-powered analysis, and evaluation framework generation. AI prompts are managed via an admin interface and stored in a PostgreSQL database. Report emails are delivered via Resend.

An async job queue handles long-running AI tasks (30-60+ seconds) to prevent browser timeouts. Jobs are submitted to `POST /api/jobs`, processed in the background, and their status can be polled by the frontend. Final reports are emailed to users, allowing browser independence.

A three-tier API key management system ensures security and remixability:
1.  **Backend Proxy Layer**: All OpenRouter API calls are proxied through `/api/openrouter/chat/completions`, keeping API keys out of the frontend.
2.  **Database Settings Storage**: API keys and model configurations are stored in a settings table, editable via a password-protected admin UI.
3.  **Environment Variable Fallbacks**: The system falls back to environment variables (`OPENROUTER_API_KEY`, `PROMPT1_MODEL`, etc.) if database settings are not present, aiding remixing.

Automatic context injection ensures all input data (organization name, program description, scraped content, previous AI outputs) is consistently prepended to AI prompts, simplifying prompt template management for administrators. Contextual labels from URLs (e.g., "Program info: https://example.com") are preserved throughout scraping and AI analysis to enhance contextual understanding.

The application uses a consistent naming convention across components, database identifiers, and settings keys (e.g., `Prompt1.tsx`, `prompt1`, `prompt1_model`).

### Deployment and Environment
The project is configured for a Reserved VM deployment on Replit. In production, a single Express.js server runs, serving static frontend files and handling all API endpoints. This unified architecture ensures reliability and resolves CORS issues. A PostgreSQL-backed background job queue continuously processes AI tasks, providing browser independence and resilience, essential for Reserved VM deployments.

### Admin Interface
A secure, session-based admin interface allows management of AI prompts (with a markdown editor and version history), viewing system configurations (LLM models, temperatures, web search, email settings), and managing email delivery templates.

### HTML Report Generation
HTML reports are generated using the `marked` library, featuring logic model SVG diagrams, enhanced table styling, and responsive design, with options for direct download or email delivery.

## External Dependencies
-   **PostgreSQL**: Database for prompts, version history, and job queue.
-   **Supabase**: Backend-as-a-service.
-   **Resend**: Transactional email service.
-   **Express.js**: Node.js framework for the backend.
-   **OpenRouter**: AI model access.
-   **@uiw/react-md-editor**: Markdown editor component.
-   **Lucide React**: Icon library.
-   **CORS proxy**: For web scraping.