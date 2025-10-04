# Evaluation Planner - AI-Powered Nonprofit Program Evaluation Planning

## Overview
This is a React/TypeScript application built with Vite that helps nonprofit organizations create comprehensive evaluation plans for their programs. The application features a step-by-step wizard interface that guides users through:

1. Program Information Collection
2. Web Scraping of program URLs
3. AI-powered Program Analysis 
4. Evaluation Framework Generation
5. Plan Generation
6. HTML Report Generation

## Project Architecture

### Frontend Stack
- **React 18.3.1** with TypeScript
- **Vite 5.4.2** as build tool and dev server
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Supabase** integration for backend services

### Key Features
- Multi-step wizard interface with progress tracking
- URL extraction and web scraping capabilities
- AI-powered analysis and framework generation
- Modern, responsive design with Tailwind CSS
- Real-time processing states and loading indicators

## Development Setup
The project is configured for the Replit environment:

- **Development Server**: Runs on `0.0.0.0:5000` with strict port enforcement
- **Workflow**: `cd project && npm run dev`
- **Build Command**: `npm run build`
- **Production Server**: `npm start` (Vite preview on port 5000)

## Deployment Configuration
- **Type**: Reserved VM (full-stack deployment with frontend and email server)
- **Build**: `npm run build` (builds the React frontend)  
- **Start**: `npm start` (runs production script that starts both frontend server on port 5000 and email server on port 3001)
- **Port**: 5000 (frontend exposed to users, email server internal only)
- **Architecture**: Two-server setup with Vite proxy routing `/api/*` requests from frontend to email server
- **Fix Applied**: Switched from Autoscale to Reserved VM to support multiple processes and internal localhost connections

## Recent Changes (October 4, 2025)
- **LLM Configuration via Environment Variables**: Added support for configuring LLM models and temperatures via environment variables
  - Added `VITE_STEP3_MODEL`, `VITE_STEP3_TEMPERATURE` for Prompt 1 (Program Model Analysis)
  - Added `VITE_STEP4_MODEL`, `VITE_STEP4_TEMPERATURE` for Prompt 2 (Evaluation Framework)
  - Added `VITE_STEP5_MODEL`, `VITE_STEP5_TEMPERATURE` for Report Template (Evaluation Plan)
  - All default to `openai/gpt-5` with no temperature if not specified
  - Created `/api/config` endpoint to expose configuration to admin interface
- **Admin Interface Improvements**: Enhanced admin page with configuration visibility
  - Renamed "Available Prompts" to "Admin Options" for better clarity
  - Added read-only "Configuration" section displaying system settings
  - Shows: sent-from email address, LLM models and temperatures for all three prompts
  - Configuration values are read from environment variables and displayed for developer reference
- **Email From Address Configuration**: Hardcoded from email address to `ai@gkerr.com` in emailServer.js
  - Added FROM_EMAIL configuration constant with clear documentation
  - Supports environment variable override via RESEND_FROM_EMAIL
  - Includes detailed comments for future maintainability
  - Future improvement: Consider adding to Admin interface system settings
- **Email Delivery Template Management**: Added email delivery template to admin interface with versioning support
  - Created new `email_delivery` prompt in database with template variables ({{programName}}, {{organizationName}}, {{currentDateTime}})
  - Refactored StepSix.tsx to fetch email template from database instead of hardcoded text
  - Email content now editable through admin interface like other prompts
  - Supports version history and rollback functionality

## Previous Changes (October 3, 2025)
- **Email Service Migration**: Migrated from Replit Mail to Resend for transactional email delivery
  - Integrated Resend connector for API key management and rotation
  - Updated emailServer.js to use Resend SDK with proper authentication
  - Renamed replitmail.ts to email.ts to reflect service-agnostic design
  - Compatible with autoscale deployments (email triggered by user actions only)
- **Prompt Management System**: Implemented comprehensive admin interface for managing AI prompts with markdown editor, version history, and rollback functionality
- **Database-Driven Prompts**: Migrated hardcoded prompts to PostgreSQL database with template variable support
- **API Backend**: Created RESTful API routes for prompt CRUD operations with basic authentication
- **Admin UI**: Built admin interface with markdown editor (@uiw/react-md-editor), step selector, and version history viewer
- **Dynamic Prompt Loading**: Refactored Step components (StepThree, StepFour, StepFive) to fetch prompts from database instead of hardcoded strings
- **Password Protection**: Added simple password authentication to admin interface using ADMIN_PASSWORD environment variable with session persistence

### Admin Access
The admin interface is protected by password authentication:
- Access via "Admin" button in top-right corner of main application
- Enter the ADMIN_PASSWORD (set in environment variables)
- Authentication is session-based (requires re-login after page refresh for security)
- Logout button available in admin interface header

**Security Note**: The ADMIN_API_KEY is now dynamically fetched from the backend after successful password authentication, improving security by removing the hardcoded API key from the frontend code.

## Previous Changes (September 14, 2025)
- **Enhanced Web Scraping Error Handling**: Completely overhauled URL extraction and web scraping with robust error handling, timeout protection (10s), smart retry logic with exponential backoff, concurrent processing (3 URLs), individual retry buttons, and detailed error classification (timeout, rate limited, blocked, unsupported content)
- **Improved URL Processing**: Added URL normalization, validation, and sanitization utilities that handle dangerous schemes, trailing punctuation, www prefixes, and deduplication
- **Better User Feedback**: Enhanced scraping progress UI with real-time status updates, specific error messages, content type detection, and per-URL retry functionality
- **Added Email Delivery Option**: Enhanced initial program information form with email delivery choice, allowing users to receive HTML reports via email instead of waiting in browser window for up to 20 minutes during generation
- **Improved User Experience**: Added 20-minute processing time warning with clear delivery method options (download now vs email when complete) 
- **Enhanced Form Validation**: Added conditional email validation that requires valid email address only when email delivery method is selected

## Previous Changes (September 13, 2025)
- Configured Vite for Replit environment with proper host/port binding
- Added `strictPort: true` to prevent port conflicts
- Created production start script for deployment
- Set up frontend workflow with proper port configuration
- Verified application runs correctly in Replit environment
- **Fixed deployment directory issue**: Added root-level package.json proxy to handle Replit's auto npm detection and directory mismatch
- **Completely overhauled HTML report generation**: Replaced custom markdown parser with professional marked library, added logic model SVG diagrams, enhanced table styling, improved responsive design, and added security sanitization
- **Updated HTML report styling**: Removed navigation graphic, enabled functional print-to-PDF button, and standardized all table formatting to consistent blue theme colors
- **Enhanced URL scraping capabilities**: Increased character limit from 5,000 to 25,000 characters per URL for comprehensive program understanding and better evaluation analysis quality
- **Fixed evaluation plan generation**: Updated AI model maintaining GPT-5 model consistency across all analysis steps
- **Updated HTML report formatting**: Added specific literature search tool references and ensured all links are underlined and clearly visible

## File Structure
```
project/
├── src/
│   ├── components/
│   │   ├── StepOne.tsx through StepSix.tsx  # Evaluation wizard steps
│   │   └── PromptAdmin.tsx                   # Admin interface for prompt management
│   ├── utils/
│   │   ├── promptApi.ts                      # API utilities for fetching prompts
│   │   └── email.ts                          # Email sending utilities (Resend integration)
│   ├── App.tsx                               # Main application with step management
│   ├── main.tsx                              # React app entry point
│   └── index.css                             # Global styles
├── emailServer.js                            # Express backend (Resend email + prompt API)
├── seed-prompts.js                           # Database seed script for initial prompts
├── package.json                              # Dependencies and scripts
├── vite.config.ts                            # Vite configuration
├── tailwind.config.js                        # Tailwind CSS configuration
└── tsconfig.json                             # TypeScript configuration
```

## Dependencies
- **PostgreSQL**: Database for storing prompts and version history
- **Express.js**: Backend server for API and email functionality
- **pg**: PostgreSQL client for Node.js
- **Resend**: Transactional email service for sending evaluation reports
- **@uiw/react-md-editor**: Markdown editor component for admin interface
- **External APIs**: Uses CORS proxy for web scraping functionality
- **Lucide React**: Icon library for UI elements

## Environment Variables

### LLM Configuration
These environment variables control which AI models and settings are used for each step of the evaluation process:

- **`VITE_STEP3_MODEL`** - AI model for Prompt 1 (Program Model Analysis). Default: `openai/gpt-5`
- **`VITE_STEP3_TEMPERATURE`** - Temperature setting for Prompt 1. Default: not set (uses model default)
- **`VITE_STEP4_MODEL`** - AI model for Prompt 2 (Evaluation Framework). Default: `openai/gpt-5`
- **`VITE_STEP4_TEMPERATURE`** - Temperature setting for Prompt 2. Default: not set (uses model default)
- **`VITE_STEP5_MODEL`** - AI model for Report Template. Default: `openai/gpt-5`
- **`VITE_STEP5_TEMPERATURE`** - Temperature setting for Report Template. Default: not set (uses model default)

### Email Configuration
- **`RESEND_FROM_EMAIL`** - From email address for outgoing emails. Default: `ai@gkerr.com`

### Admin Access
- **`ADMIN_PASSWORD`** - Password for accessing the admin interface (required)
- **`ADMIN_API_KEY`** - API key for admin operations (optional, defaults to 'dev-admin-key-change-in-production' if not set)

### API Keys
- **`VITE_OPENROUTER_API_KEY`** - API key for OpenRouter (required for AI functionality)

### Configuration Visibility
All LLM and email configuration values are visible in the admin interface under the "Configuration" section (read-only). This allows developers to verify settings without editing code or environment variables directly in the UI.

## User Preferences
- None specified yet

## Prompt Management System

### Database Schema
- **prompts table**: Stores active prompts with version tracking
- **prompt_versions table**: Full version history with change notes

### Admin Interface
Access via "Admin" button in the top-right corner of the main application:
- Markdown editor for editing prompts
- Template variable support ({{programName}}, {{organizationName}}, etc.)
- Version history viewer
- Rollback to previous versions
- Change notes for tracking modifications

### Available Prompts
- **Step 3: Program Model Analysis** - Analyzes program information and extracts key data
- **Step 4: Evaluation Framework** - Generates evaluation framework based on analysis
- **Step 5: Evaluation Plan Template** - Creates comprehensive evaluation plan document
- **Email Delivery Template** - Email body sent to users when requesting email delivery

### API Endpoints
- `GET /api/prompts` - List all prompts
- `GET /api/prompts/:step` - Get specific prompt
- `POST /api/prompts/:step` - Create new version (requires auth)
- `GET /api/prompts/:step/versions` - Get version history
- `POST /api/prompts/:step/rollback/:version` - Rollback (requires auth)

### Template Variables
Prompts support dynamic variable replacement:
- `{{organizationName}}` - Organization name
- `{{programName}}` - Program name
- `{{aboutProgram}}` - Program description
- `{{scrapedContent}}` - Web scraped content
- `{{programAnalysis}}` - Step 3 analysis
- `{{evaluationFramework}}` - Step 4 framework
- `{{currentDate}}` - Current date
- `{{currentDateTime}}` - Current date and time (used in email template)
- `{{programTypePlural}}` - Program type (plural)
- `{{targetPopulation}}` - Target population

## Next Steps
- **CRITICAL**: Implement proper authentication before production deployment
- Optional: Update Browserslist database to silence development warnings
- Optional: Configure HMR client port (443) if connection issues arise in proxy environment