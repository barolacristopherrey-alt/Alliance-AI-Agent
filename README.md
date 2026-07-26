# Alliance AI Agent Portal — Web Deployment

A standalone, deployable version of the Alliance AI Agent Portal (originally a Claude Cowork
live artifact), built to run on **Vercel + GitHub** so it can be shared with anyone via a real
URL, not just inside Cowork.

Open the link, use the portal — no sign-in, no account required.

## What changed from the Cowork version

The pipeline logic, Word/Excel export, DOCX upload parsing, TOC-compliance checker, and every
prompt are **unchanged**. Only the two things that only exist inside a live Cowork session were
replaced:

| Cowork-only bridge | Replaced with |
|---|---|
| `window.cowork.askClaude(...)` | `POST /api/generate` — a Vercel serverless function that calls the real Anthropic API using a server-side key |
| `window.cowork.callMcpTool(...)` (Gmail draft creation) | Dropped for this version. The existing `mailto:` fallback in the "Send draft" modal is used instead — no code changed, since that fallback already existed for when the Gmail call failed |

That's it — no accounts, no database, nothing else to configure.

## Cost note

Your Claude Pro/Max subscription does **not** cover this. The `/api/generate` function calls
the Anthropic API directly, which is billed separately, per token, through
[console.anthropic.com](https://console.anthropic.com).

## Deploy steps

### 1. Push this folder to GitHub
```
cd alliance-portal-web
git init
git add .
git commit -m "Initial deploy: Alliance AI Agent Portal"
git branch -M main
git remote add origin https://github.com/YOUR-ORG/alliance-ai-agent-portal.git
git push -u origin main
```

### 2. Get an Anthropic API key
1. [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key.
2. Keep it somewhere safe — you'll paste it into Vercel in the next step, never into this repo.

### 3. Deploy to Vercel
1. [vercel.com](https://vercel.com) → Add New → Project → import the GitHub repo you pushed.
2. Framework preset: **Other** (this is a static site + serverless functions, no framework
   build step needed — `vercel.json` already tells Vercel where things are).
3. Before the first deploy, go to **Environment Variables** and add:
   - `ANTHROPIC_API_KEY` = the key from step 2
   - `ANTHROPIC_MODEL` (optional) = leave blank to use the default (`claude-sonnet-5`)
4. Deploy. Vercel gives you a `*.vercel.app` URL — that's the link to share with your boss (or
   attach a custom domain under Project Settings → Domains).

### 4. Try it
Open the URL — the portal loads directly, no sign-in step. Run through Generate → Review →
Download. Anyone you send the link to gets the same, immediately.

## Local development
```
npm install -g vercel   # once, if you don't have it
cd alliance-portal-web
vercel dev
```
This serves `public/index.html` and runs `api/generate.js` locally. You'll be prompted to link
a Vercel project and can pull your env vars with `vercel env pull` first.

## Project structure
```
alliance-portal-web/
├── api/
│   └── generate.js       # Serverless function: proxies to the real Claude API
├── public/
│   └── index.html        # The portal itself (adapted from the Cowork artifact)
├── supabase/
│   └── schema.sql         # Not used by the app anymore — kept in case you want accounts +
│                            saved-proposal persistence back later (see below)
├── .env.example
├── .gitignore
├── package.json
├── vercel.json
└── README.md
```

## Known gaps / natural next steps
- **No accounts, no persistence.** Anyone with the link can use the portal, and nothing is
  saved between visits — each session is its own clean run, same as the Cowork version. An
  earlier iteration of this deployment had Supabase email sign-in plus a "save proposal /
  reopen later" panel; it was removed because the sign-in flow (magic links) was unreliable in
  practice — corporate email security scanners can silently burn one-time links before a person
  clicks them, and cross-device/cross-browser link clicks fail without explanation. `supabase/
  schema.sql` is still in this repo if you want to reintroduce accounts + persistence later,
  ideally via a login method less fragile than email links (a password, or an OAuth provider
  like Google/Microsoft).
- Gmail draft creation was intentionally dropped for this version (see table above) — the
  `mailto:` fallback covers "send the draft," just without the one-click Gmail-draft step.
- Since there's no login, there's also no per-person access control — anyone with the URL has
  full use of the portal. Keep that in mind before sharing the link outside the people who
  should have it.
