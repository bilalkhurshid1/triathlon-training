# Training Coach

> i signed up for a triathalon even though i'm an unatheltic fuck and i cant even swim. so i vibecoded this bullshit

Local-first triathlon training log and LLM coach. The app tracks workouts, race details, profile context, and coach chat history in a local SQLite database.

would like to add it to snappify or vercel at some point

## Stack

- Next.js 16 App Router
- React 19, TypeScript, Tailwind CSS 4
- Prisma 7 with SQLite and `better-sqlite3`
- AI SDK with Anthropic or OpenAI providers

## Setup

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npx prisma generate
npx tsx prisma/seed.ts
npm run dev
```

Open `http://localhost:3000`.

## Environment

`.env.example` contains the expected local shape:

```bash
DATABASE_URL="file:./dev.db"
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

`DATABASE_URL` defaults to local SQLite. Add the API key for the provider selected in `/settings`.

## Commands

```bash
npm run dev     # start local dev server
npm run build   # production build
npm run start   # serve production build
npm run lint    # run ESLint
npm test         # run importer tests
```

Database helpers:

```bash
npx prisma migrate dev       # apply local migrations
npx prisma generate          # generate Prisma client into src/generated/prisma
npx tsx prisma/seed.ts       # seed local profile/settings/race data
npx tsx scripts/import-diary.ts [path]  # import diary text, defaults to training-diary.txt
```

## App Map

- `/` dashboard and recent training summary
- `/workouts` workout list and manual entry flow
- `/coach` LLM coach chat
- `/coach/debug` coach context/debug view
- `/profile` athlete profile
- `/race` primary race details
- `/integrations` local data imports, including GarminDB SQLite sync
- `/settings` model/provider settings

## Notes

Local runtime artifacts are ignored by git, including `.env`, `dev.db`, `.next`, and the generated Prisma client at `src/generated/prisma`.
