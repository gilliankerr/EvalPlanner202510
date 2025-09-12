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
- **Type**: Autoscale (frontend-only deployment)
- **Build**: `npm run build` (from repository root, proxies to project directory)
- **Start**: `npm start` (from repository root, proxies to project directory)
- **Port**: 5000 (strictly enforced)
- **Fix Applied**: Added root-level package.json proxy to handle Replit's auto npm detection

## Recent Changes (September 12, 2025)
- Configured Vite for Replit environment with proper host/port binding
- Added `strictPort: true` to prevent port conflicts
- Created production start script for deployment
- Set up frontend workflow with proper port configuration
- Verified application runs correctly in Replit environment
- **Fixed deployment directory issue**: Added root-level package.json proxy to handle Replit's auto npm detection and directory mismatch
- **Completely overhauled HTML report generation**: Replaced custom markdown parser with professional marked library, added logic model SVG diagrams, enhanced table styling, improved responsive design, and added security sanitization
- **Updated HTML report styling**: Removed navigation graphic, enabled functional print-to-PDF button, and standardized all table formatting to consistent blue theme colors
- **Updated application colors**: Changed accent colors throughout the app to #0085ca (primary blue) and footer background to #ed8b00 (orange)

## File Structure
```
project/
├── src/
│   ├── components/     # Step components (StepOne through StepSix)
│   ├── App.tsx        # Main application with step management
│   ├── main.tsx       # React app entry point
│   └── index.css      # Global styles
├── package.json       # Dependencies and scripts
├── vite.config.ts     # Vite configuration
├── tailwind.config.js # Tailwind CSS configuration
└── tsconfig.json      # TypeScript configuration
```

## Dependencies
- **Supabase**: Database and authentication services
- **External APIs**: Uses CORS proxy for web scraping functionality
- **Lucide React**: Icon library for UI elements

## User Preferences
- None specified yet

## Next Steps
- Optional: Update Browserslist database to silence development warnings
- Optional: Configure HMR client port (443) if connection issues arise in proxy environment
- Consider implementing proper error handling for web scraping functionality