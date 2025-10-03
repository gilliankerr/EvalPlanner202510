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

## Recent Changes (October 3, 2025)
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
- Session persists until logout or browser storage is cleared
- Logout button available in admin interface header

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
│   │   └── promptApi.ts                      # API utilities for fetching prompts
│   ├── App.tsx                               # Main application with step management
│   ├── main.tsx                              # React app entry point
│   └── index.css                             # Global styles
├── emailServer.js                            # Express backend (email + prompt API)
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
- **@uiw/react-md-editor**: Markdown editor component for admin interface
- **External APIs**: Uses CORS proxy for web scraping functionality
- **Lucide React**: Icon library for UI elements

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
- `{{programTypePlural}}` - Program type (plural)
- `{{targetPopulation}}` - Target population

## Next Steps
- **CRITICAL**: Implement proper authentication before production deployment
- Optional: Update Browserslist database to silence development warnings
- Optional: Configure HMR client port (443) if connection issues arise in proxy environment