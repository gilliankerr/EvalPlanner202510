# Evaluation Planner - AI-Powered Nonprofit Program Evaluation Planning

## Overview
This React/TypeScript application, built with Vite, assists nonprofit organizations in creating comprehensive evaluation plans for their programs. It features a multi-step wizard guiding users through program information collection, web scraping, AI-powered analysis, evaluation framework generation, and HTML report generation. The project aims to streamline the evaluation planning process for nonprofits, offering significant market potential by providing an accessible and intelligent tool for program assessment and improvement.

## User Preferences
- None specified yet

## System Architecture

### Frontend
The application is built with React 18.3.1 and TypeScript, utilizing Vite 5.4.2 for development and building. Tailwind CSS is used for styling, complemented by Lucide React for icons. The user interface is a multi-step wizard with progress tracking, designed to be modern and responsive.

### Backend and Core Functionality
The application integrates with Supabase for backend services. Key features include URL extraction and robust web scraping with error handling, retry logic, and concurrent processing. AI-powered analysis and evaluation framework generation are central to the system, configurable via environment variables for LLM models and temperatures. Prompts for AI models are managed through a comprehensive admin interface, stored in a PostgreSQL database, and support versioning and template variables. Email delivery of reports is handled by Resend.

### Deployment and Environment
The project is configured for a Reserved VM deployment on Replit, running a two-server setup. The frontend serves on port 5000, and an internal Express.js server handles API requests and email functionality on port 3001, with Vite proxying `/api/*` requests.

### Admin Interface
A secure, session-based authentication system protects the admin interface, which allows for managing AI prompts, viewing system configurations (LLM models, temperatures, email settings), and managing email delivery templates. Prompts can be edited using a markdown editor, with support for version history and rollbacks.

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