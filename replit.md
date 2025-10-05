# Evaluation Planner - AI-Powered Nonprofit Program Evaluation Planning

## Overview
This React/TypeScript application, built with Vite, assists nonprofit organizations in creating comprehensive evaluation plans for their programs. It features a multi-step wizard guiding users through program information collection, web scraping, AI-powered analysis, evaluation framework generation, and HTML report generation. The project aims to streamline the evaluation planning process for nonprofits, offering significant market potential by providing an accessible and intelligent tool for program assessment and improvement.

## User Preferences
- None specified yet

## System Architecture

### Frontend
The application is built with React 18.3.1 and TypeScript, utilizing Vite 5.4.2 for development and building. Styling uses a combination of Tailwind CSS (for main application) and CSS Modules (for admin interface mobile responsiveness), complemented by Lucide React for icons. The user interface is a multi-step wizard with progress tracking, designed to be modern and responsive.

**Admin Interface Mobile Responsiveness** (October 2025): The PromptAdmin component uses CSS Modules (`PromptAdmin.module.css`) for responsive design, implementing a mobile-first approach with breakpoints at 768px (tablets) and 1024px (desktop). On mobile devices, the layout stacks vertically with smaller padding and icon-only buttons. On desktop, it displays a side-by-side layout with a 300px sidebar and full button text labels.

### Backend and Core Functionality
The application integrates with Supabase for backend services. Key features include URL extraction and robust web scraping with error handling, retry logic, and concurrent processing. AI-powered analysis and evaluation framework generation are central to the system, configurable via environment variables for LLM models, temperatures, and web search capabilities. Prompts for AI models are managed through a comprehensive admin interface, stored in a PostgreSQL database. Email delivery of reports is handled by Resend.

**Automatic Data Injection (Admin-Proof System)**: The system uses automatic context injection to ensure all input data flows correctly through the AI workflow, regardless of how admin users edit prompt templates. Admin users only need to write natural instructions in their prompts - the system automatically prepends all program information (organization name, program name, description, scraped web content) and previous step outputs (program analysis, evaluation framework) before the admin's instructions. This eliminates the need for admins to understand placeholder syntax like `{{variableName}}` and prevents data loss from template editing mistakes. Implementation uses `buildPromptWithContext()` helper function in `promptApi.ts` that structures context data with clear section headers before appending admin templates.

**Contextual Label Preservation**: When users provide URLs with descriptive labels (e.g., "Program info: https://example.com" or "About organization: https://example2.com"), the system preserves this contextual information throughout the scraping and AI analysis pipeline. The `extractLabeledUrls()` function in `url.ts` captures both the label and URL, scraped content is stored with its associated label in `labeledScrapedContent[]`, and `buildPromptWithContext()` formats this data with clear section headers (e.g., "--- PROGRAM INFO ---") so the AI can properly contextualize information from each source. This ensures the AI understands the purpose and context of each scraped webpage, leading to more accurate analysis.

**Naming Convention**: The application uses a consistent naming scheme across components, database identifiers, and environment variables:
- **Components**: `Prompt1.tsx`, `Prompt2.tsx`, `ReportTemplate.tsx`
- **Database identifiers**: `prompt1`, `prompt2`, `report_template`
- **Environment variables**: 
  - `VITE_PROMPT1_MODEL`, `VITE_PROMPT1_TEMPERATURE`, `VITE_PROMPT1_WEB_SEARCH`
  - `VITE_PROMPT2_MODEL`, `VITE_PROMPT2_TEMPERATURE`, `VITE_PROMPT2_WEB_SEARCH`
  - `VITE_REPORT_TEMPLATE_MODEL`, `VITE_REPORT_TEMPLATE_TEMPERATURE`, `VITE_REPORT_TEMPLATE_WEB_SEARCH`

**Web Search Configuration**: Each prompt can independently enable or disable web search to find additional information about similar programs and best practices:
- Prompt 1 (Program Model Analysis): Web search enabled by default
- Prompt 2 (Evaluation Framework): Web search enabled by default  
- Report Template: Web search disabled by default (uses already-gathered information)

Environment variables control web search: `VITE_PROMPT1_WEB_SEARCH`, `VITE_PROMPT2_WEB_SEARCH`, `VITE_REPORT_TEMPLATE_WEB_SEARCH` (set to `true` or `false`).

### Deployment and Environment
The project is configured for a Reserved VM deployment on Replit, running a two-server setup. The frontend serves on port 5000, and an internal Express.js server handles API requests and email functionality on port 3001, with Vite proxying `/api/*` requests.

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