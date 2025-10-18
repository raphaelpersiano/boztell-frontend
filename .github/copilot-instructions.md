# Boztell CRM Frontend - Copilot Instructions

## Project Overview

This is a NextJS-based CRM frontend application for managing WhatsApp Business leads and customer communications. The application includes:

- Lead Management System
- WhatsApp-like Chat Interface  
- Kanban Board for Lead Funnel Management
- Role-based User Access (Admin, Supervisor, Agent)

## Tech Stack

- Framework: Next.js 15 with App Router
- Styling: Tailwind CSS
- Language: TypeScript
- Icons: Lucide React
- State Management: React useState/useEffect
- UI Components: Custom components

## Key Development Guidelines

### Code Structure
- Use TypeScript for all new files
- Follow the established folder structure in src/
- Keep components modular and reusable
- Use proper type definitions from src/types/

### Styling Guidelines
- Use Tailwind CSS classes
- Follow the color scheme: Blue 900, White, Black, Gray tones
- Ensure responsive design (mobile-first approach)
- Use consistent spacing and typography

### Component Guidelines
- Create reusable UI components in src/components/ui/
- Keep business logic components in their respective folders
- Use proper props interfaces with TypeScript
- Follow React best practices (hooks, lifecycle, etc.)

### Naming Conventions
- Components: PascalCase (e.g., ChatWindow.tsx)
- Files: camelCase for utilities, PascalCase for components
- Variables: camelCase
- Constants: UPPER_SNAKE_CASE

### Data Handling
- Currently uses mock data for demonstration
- Data types are defined in src/types/index.ts
- Follow the established data models for Lead, Message, User, etc.

## Current Status

✅ Project successfully created and compiled
✅ All major components implemented
✅ Development server running on http://localhost:3000
✅ All pages accessible and functional

## Available Pages

- `/` - Home (redirects to /chat)
- `/chat` - Chat interface with WhatsApp-like design
- `/leads` - Lead management table
- `/funnel/stage1` - Kanban board (Cold → Warm → Hot → Paid)
- `/funnel/stage2` - Kanban board (Service → Repayment → Advocate)

## Future Development

When integrating with backend:
- Replace mock data with API calls
- Implement real-time updates via Supabase
- Add authentication and user management
- Connect WhatsApp Business API webhooks
- Add proper error handling and loading states