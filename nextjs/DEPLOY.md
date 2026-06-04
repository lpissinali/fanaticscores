# Deploying FanaticScores Next.js to Firebase App Hosting

## 1. Set up environment variables

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

Required values:
- `AF_API_KEY` — your api-football v3 key (same one used in Firebase Functions)
- `NEXT_PUBLIC_FIREBASE_*` — same Firebase credentials as your existing `VITE_FIREBASE_*` vars

## 2. Install dependencies

```bash
cd nextjs/
npm install
```

## 3. Test locally

```bash
npm run dev
```

Visit http://localhost:3000 — competition pages like `/en/competition/PL` will show
server-rendered HTML with real standings data.

## 4. Set up Firebase App Hosting

In Firebase Console → App Hosting → Get Started:

1. Connect your GitHub repo
2. Set the **Root directory** to `nextjs/` 
3. Set the **Live branch** to `main`
4. Firebase will detect Next.js automatically

Or via CLI:
```bash
firebase apphosting:backends:create --project fanaticscores-b6af4
```

## 5. Set the AF_API_KEY secret

```bash
firebase apphosting:secrets:set AF_API_KEY --project fanaticscores-b6af4
```

Paste your api-football API key when prompted.

## 6. Update firebase.json for the new domain

Once App Hosting is live (it gets its own subdomain like `fanaticscores-xyz.web.app`), 
update your custom domain to point to App Hosting instead of the current Hosting config.

The existing Firebase Functions (`afProxy`, `fdProxy`, `fetchMatchdayHttp`, etc.) stay
exactly as-is — they're used by the client-side Today page for real-time updates.

## What changed vs the Vite app

| Feature | Vite SPA | Next.js |
|---------|----------|---------|
| Competition pages | Client-rendered (empty HTML for Google) | Server-rendered (full standings/scorers/fixtures in HTML) |
| Team pages | Client-rendered | Server-rendered (squad, fixtures in HTML) |
| Match pages | Client-rendered + requires match cache | Server-rendered (fetches directly from api-football) |
| Today page | Real-time Firestore (unchanged) | Same — stays client-side |
| SEO tags | Set by JS (useSEO hook) | Server-rendered `<head>` via generateMetadata |
| Canonical URLs | All pages show /en/today canonical | Per-page correct canonical |
