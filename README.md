# Boztell CRM FrontendThis is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).



A modern CRM application built with Next.js for managing WhatsApp Business leads and customer communications.## Getting Started



## FeaturesFirst, run the development server:



### 🎯 **Lead Management**```bash

- Comprehensive lead tracking with customer detailsnpm run dev

- Lead status management (Cold, Warm, Hot, Paid, Service, Repayment, Advocate)# or

- Lead assignment to agentsyarn dev

- Search and filter capabilities# or

pnpm dev

### 💬 **WhatsApp-like Chat Interface**# or

- Real-time messaging interface similar to WhatsApp Webbun dev

- Support for multiple message types:```

  - Text messages

  - Images and videosOpen [http://localhost:3000](http://localhost:3000) with your browser to see the result.

  - Documents and files

  - Contact sharingYou can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

  - Location sharing

- Message status indicators (sent, delivered, read)This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

- Chat room assignment system

## Learn More

### 📊 **Kanban Funnel Board**

- **Stage 1**: Cold → Warm → Hot → PaidTo learn more about Next.js, take a look at the following resources:

- **Stage 2**: Service → Repayment → Advocate  

- Visual pipeline management- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.

- Search within each column- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.



### 👥 **User Role Management**You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

- **Admin**: Full access to all features and main inbox

- **Supervisor**: Access to main inbox and team management## Deploy on Vercel

- **Agent**: Personal inbox with assigned chats only

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

## Tech Stack

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Icons**: Lucide React
- **UI Components**: Custom components

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- VS Code (recommended)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open [http://localhost:3001](http://localhost:3001) in your browser.

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── chat/              # Chat interface page
│   ├── leads/             # Lead management page
│   ├── funnel/            # Kanban board pages
│   │   ├── stage1/        # Stage 1 funnel (Cold → Paid)
│   │   └── stage2/        # Stage 2 funnel (Service → Advocate)
├── components/            # React components
│   ├── ui/                # Basic UI components
│   ├── chat/              # Chat-related components
│   ├── leads/             # Lead management components
│   ├── kanban/            # Kanban board components
│   └── Layout.tsx         # Main application layout
├── lib/                   # Utilities and helpers
│   ├── utils.ts           # Utility functions
│   └── constants.ts       # Application constants
└── types/                 # TypeScript type definitions
    └── index.ts           # Main type definitions
```

## Pages Overview

- **/** - Home page (redirects to chat)
- **/chat** - WhatsApp-like chat interface  
- **/leads** - Lead management table
- **/funnel/stage1** - Kanban board for Cold → Paid
- **/funnel/stage2** - Kanban board for Service → Advocate

## Key Features in Detail

### Chat System
- **Main Inbox**: Accessible by admin and supervisor roles
- **Agent Inbox**: Personal inbox for each agent
- **Assignment System**: Supervisors can assign chats to agents
- **Message Types**: Support for various WhatsApp message types
- **Real-time Updates**: Designed for Supabase realtime integration

### Lead Funnel
- **Stage 1 (Sales)**: Cold → Warm → Hot → Paid
- **Stage 2 (Post-Sales)**: Service → Repayment → Advocate
- **Visual Progress**: Cards move between columns
- **Search Functionality**: Find leads within each status

### User Management
- **Role-based Access**: Different interfaces for different roles
- **Assignment Logic**: Leads can be assigned to specific agents
- **Unknown Leads**: System for handling unmatched WhatsApp contacts

## Design System

### Colors
- **Primary**: Blue 900 (#1e3a8a)
- **Secondary**: White (#ffffff)
- **Accent**: Black (#000000)
- **Gray tones**: For backgrounds and borders

## Development Notes

- **Static Data**: Currently uses mock data for demonstration
- **No Backend**: Frontend-only implementation (slicing)
- **Responsive**: Mobile-first design
- **Type-safe**: Full TypeScript implementation

## Future Integration Points

This frontend is designed to integrate with:
- **Backend API**: RESTful API for data management
- **Supabase**: Real-time database and authentication
- **WhatsApp Business API**: Message handling via webhooks
- **Authentication System**: User login and role management

## License

This project is proprietary software for Boztell CRM.