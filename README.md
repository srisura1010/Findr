# Findr

A school lost-and-found web platform that connects students with their missing items through a searchable catalog, direct messaging, AI-powered matching, and a multi-school system. This is our submission to the 2026 Congressional App Challenge for District UT-3.

Live at [finderfbla.com](https://finderfbla.com)

---

## The Problem

Most school lost and founds are a cardboard box in the front office that nobody checks. Items pile up with no visibility, students have no way to know if their belongings were turned in, and staff have no efficient way to manage the volume or resolve disputes. Findr digitizes and streamlines the entire process, from reporting to claim to handoff.

---

## What It Does

- Report lost or found items with descriptions, photos (with in-app cropping), location, category, and date
- Browse and filter a searchable item catalog, or use AI Search to find items by meaning instead of exact keywords
- Submit proof-based claims and message the finder directly to coordinate a handoff
- Dispute a handoff if something goes wrong, with admin moderation to resolve it
- AI-powered duplicate detection that flags a possible match before you finish posting
- **Schools system** — any school can register, get a fully branded board (logo, colors, background), and run its own closed-loop lost and found with its own admins, leaderboard, and claim workflow
- XP and achievement system that rewards returning items, tracked per user and per school
- Full moderation suite: item reports, user reports, ban/suspension management, and a super admin panel that reviews admin and school applications
- Real-time in-app messaging, so users never have to exchange personal contact info
- Multi-language support across 20 languages
- Full accessibility suite: 14 preset themes (including color-blindness variants), adjustable fonts/sizing, text-to-speech, aria tags, and keyboard navigation

---

## Tech Stack

**Frontend:** Next.js, React, TypeScript, CSS3, Tailwind (utility classes), Google Fonts, Leaflet/OpenStreetMap, Chart.js, react-easy-crop, Lucide icons

**Backend:** Node.js, Supabase (PostgreSQL + Row-Level Security), Clerk (auth), Groq (AI search/tagging/chat), Resend (transactional email), Nominatim (geocoding), Google Translate (i18n)

**Deployment:** Vercel

<img width="6000" height="3375" alt="Findr NLC Tech Stack (2)" src="https://github.com/user-attachments/assets/9ab0966f-5611-4f04-8205-6a326d539f60" />

---

## Design Decisions

- **App Router architecture** — all sensitive logic and API keys stay server-side in `/api` routes; the browser only ever touches Supabase through the scoped anon key, filtered by RLS
- **Clerk + Supabase without a shared session** — Clerk handles auth, and the Clerk user ID is stored as a plain text column (`author_id`, `claimant_id`, etc.) that RLS policies check against on every query
- **Four context providers** — `SettingsContext`, `ItemsContext`, `ThemeProvider`, and `TTSProvider` manage global state and eliminate prop drilling
- **CSS variable theming** — all 14+ themes are driven by one variable sheet at the root, so switching themes updates the entire app instantly with no per-page CSS
- **Paired file structure** — every page has a co-located `.tsx` and `.css` file for clean separation of concerns
- **School-scoped duplicate tables** — rather than filtering one shared table by `school_id`, school features (items, claims, disputes, chat, etc.) use their own dedicated tables, keeping school-scoped queries simple at the cost of some duplicated structure
- **One dynamic route, infinite pages** — `items/[id]/page.tsx` and `schools/[schoolId]/board/page.tsx` are single files that render a different item or a fully different school's branded board depending on the URL param, with zero new code needed per item or per school

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [npm](https://www.npmjs.com/)
- A [Supabase](https://supabase.com/) project with the schema set up (27 tables — see docs)
- A [Clerk](https://clerk.com/) application for authentication
- Up to 4 [Groq](https://groq.com/) API keys (semantic search, tagging, recommendations, and chat each use a separate key to spread rate limits)
- A [Resend](https://resend.com/) account for transactional email

### Environment Variables

Create a `.env.local` file in the root of the project:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

GROQ_API_KEY=your_groq_api_key
GROQ_API_KEY_2=your_groq_api_key_2
GROQ_API_KEY_3=your_groq_api_key_3
GROQ_API_KEY_4=your_groq_api_key_4

RESEND_API_KEY=your_resend_api_key

NEXT_PUBLIC_SUPER_ADMINS=comma_separated_admin_emails
```

### Installation

```bash
# Clone the repository
git clone https://github.com/Srixath/Finder.git
cd Finder/lost-and-found

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
src/
├── app/
│   ├── api/          # 28 server-side routes (19 distinct + 9 transactional email)
│   ├── dashboard/     # Main dashboard (items, claims, XP, admin)
│   ├── schools/       # Schools feature (register, join, branded boards)
│   ├── items/[id]/    # Dynamic item detail page
│   └── ...
├── context/           # SettingsContext, ItemsContext, ThemeProvider, TTSProvider, GlobalChatContext
├── components/        # Shared UI (Navbar, MessagingSystem, LocationMap, etc.)
└── lib/                # Supabase client, theme engine, shared helpers
```

---

## Documentation

Full technical documentation — including database schema, API route reference, RLS policies, AI architecture, and version history — is available in this repo.

---

## Contributors

Built by Srivatsav Sura and Srinath Ramakrishnan — Hillcrest High School, Midvale, Utah, USA.

Questions, bugs, or interested in bringing Findr to your school? Reach us at fbla.finder.support@gmail.com.
