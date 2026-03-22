# Findr

A school lost-and-found web platform that connects students with their missing items through a searchable catalog, direct messaging, and AI-powered item matching.

---

## The Problem

Most school lost and founds are a cardboard box in the front office that nobody checks. Items pile up with no visibility, students have no way to know if their belongings were turned in, and staff have no efficient way to manage the volume. Findr digitizes and streamlines the entire process.

---

## What It Does

- Report lost or found items with descriptions, photos, and location info
- Browse and filter a searchable item catalog
- Message item reporters directly to coordinate retrieval
- AI-powered matching that suggests potential owners for found items
- Multi-language support so non-English speakers can participate
- Full accessibility suite: text-to-speech, colorblind mode, high-contrast mode, and semantic HTML for screen readers

---

## Tech Stack

**Frontend:** Next.js, React, TypeScript, CSS3, Google Fonts

**Backend:** Node.js, Supabase, Clerk, EmailJS, MyMemory, Groq

<img width="6000" height="3375" alt="Tech Stack" src="https://github.com/user-attachments/assets/d7b3487a-af88-42b6-829c-6da011246683" />

---

## Design Decisions

- **App Router architecture** — all sensitive logic and API keys are isolated in server components and `/api` routes, never exposed to the client
- **Four context providers** — `SettingsContext`, `ItemsContext`, `ThemeProvider`, and `TTSProvider` manage global state and eliminate prop drilling across pages
- **CSS variable theming** — all four visual modes (dark, light, high-contrast, colorblind) are driven by a single variable sheet, making theme switching instant and consistent
- **Paired file structure** — every page has a co-located `.tsx` and `.css` file for clean separation of concerns

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A [Supabase](https://supabase.com/) project with the required tables set up
- A [Clerk](https://clerk.com/) application for authentication
- A [Groq](https://groq.com/) API key
- An [EmailJS](https://www.emailjs.com/) account and template

### Environment Variables

Create a `.env.local` file in the root of the project and add the following:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

GROQ_API_KEY=your_groq_api_key

NEXT_PUBLIC_EMAILJS_SERVICE_ID=your_emailjs_service_id
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your_emailjs_template_id
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your_emailjs_public_key
```

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/findr.git
cd findr

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be running at `http://localhost:3000`.

### Build for Production

```bash
npm run build
npm start
```

---

## Project Structure

```
findr/
├── app/
│   ├── api/          # Server-side API routes
│   ├── (pages)/      # App Router pages, each with paired .tsx and .css
│   └── layout.tsx    # Root layout with context providers
├── components/       # Shared UI components
├── context/          # SettingsContext, ItemsContext, ThemeProvider, TTSProvider
├── lib/              # Supabase client, utility functions
└── public/           # Static assets
```

---

## Contributors

Built by Srivatsav and Srinath Ramakrishnan — Hillcrest High School
