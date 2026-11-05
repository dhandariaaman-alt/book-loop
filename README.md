# BookLoop

A community book-sharing platform: borrow, exchange, give away, sell and donate books within your neighbourhood.

Built with Next.js 15, Tailwind CSS 4, PostgreSQL, Prisma and Auth.js.

## Status

**Phase 1: Foundation** ✅

- Email/password sign-up and sign-in, Google sign-in (optional), sign-out
- Password reset by email link (emails print to the server console until a provider is added)
- Rate limiting on sign-in, sign-up and reset requests
- Roles: user, institution, moderator, admin, enforced in middleware and on the server
- Profiles: name, username, bio, neighbourhood, favourite genres, public profile page at `/u/<username>`
- Location permission with privacy: coordinates rounded to ~100 m, stored server-side only, never shown to others
- Light, dark and system themes, remembered per browser
- Dashboard layout with activity, reminders, discover and community sections
- Full database schema for every PRD entity (listings, requests, transactions, reservations, messages, notifications, reviews, reports, disputes, donations, audit logs)

Next: **Phase 2: Book management** (listings, image upload, nearby browse, search and filters).

## Getting started

1. **Install** [Node.js 20+](https://nodejs.org), then:

   ```bash
   npm install
   ```

2. **Create a database.** The quickest is a free PostgreSQL on [Neon](https://neon.tech). Copy its connection string.

3. **Configure.** Copy `.env.example` to `.env` and set `DATABASE_URL`. Generate `AUTH_SECRET` with `npx auth secret`.

4. **Create the tables and starter data:**

   ```bash
   npm run db:push
   npm run db:seed
   ```

5. **Run it:**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

### Google sign-in (optional)

Create an OAuth client at <https://console.cloud.google.com/apis/credentials> with redirect URI
`http://localhost:3000/api/auth/callback/google`, then set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
The Google button only appears when both are set.

### Making yourself an admin

```bash
npm run db:studio
```

Open the `User` table, change your `role` to `ADMIN`, save, then reload the app.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | Type-check |
| `npm run db:push` | Sync the schema to the database |
| `npm run db:migrate` | Create a migration (use once you have real data) |
| `npm run db:seed` | Add genres and default settings |
| `npm run db:studio` | Browse the database |

## Project layout

```
prisma/schema.prisma     All database tables
src/auth.ts              Auth.js setup (providers, sessions, role refresh)
src/auth.config.ts       Route protection rules (also used by middleware)
src/app/actions/         Server actions: auth, profile
src/app/(auth)/          Sign-in, sign-up, password reset pages
src/app/dashboard/       User dashboard
src/app/settings/profile Edit profile + location
src/app/u/[username]/    Public profile
src/app/admin/           Admin overview (ADMIN only)
src/lib/                 Prisma client, validation, geo helpers, rate limiting, mail
```

## Privacy rules in code

- `Profile.latitude/longitude` and `BookListing.latitude/longitude` are **server-only**. Never include them in a
  `select` that is sent to another user. Show `neighbourhood` and `formatDistance()` instead.
- Listing status and transaction status are separate (PRD §6).
