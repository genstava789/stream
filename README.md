# Filmanesia Clone

A production-ready Next.js 14 movie streaming/database website built with the TMDB API.

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **TMDB API**
- **Lucide React** (icons)

## Features

- 🎬 Hero banner with featured movie
- 🔥 Trending, Popular, Now Playing, Top Rated movie rows
- 📺 TV Shows section with trending and popular series
- 🔍 Search with live dropdown preview
- 🎭 Genre browsing with sort options
- 🎞️ Movie detail page with trailer modal, cast, similar movies
- 📱 Fully responsive (mobile, tablet, desktop)
- 🌙 Neo Dark theme with glassmorphism and neon glow effects

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. The `.env.local` file is already configured with the TMDB API key.

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout with Navbar & Footer
│   ├── page.tsx            # Homepage
│   ├── globals.css         # Global styles
│   ├── movie/[id]/         # Movie detail page
│   ├── search/             # Search results page
│   ├── genre/[id]/         # Genre browse page
│   └── tv/                 # TV Shows page
├── components/
│   ├── Navbar.tsx
│   ├── Hero.tsx
│   ├── MovieCard.tsx
│   ├── MovieRow.tsx
│   ├── SearchBar.tsx
│   ├── Footer.tsx
│   ├── GenreFilter.tsx
│   ├── CastCard.tsx
│   ├── TrailerModal.tsx
│   ├── LoadingSpinner.tsx
│   ├── RatingBadge.tsx
│   └── BackToTop.tsx
├── lib/
│   └── tmdb.ts             # TMDB API client
└── types/
    └── tmdb.ts             # TypeScript interfaces
```

## Build for Production

```bash
npm run build
npm start
```
