# Alliance AI Agent Portal — Web Deployment

A standalone, deployable version of the Alliance AI Agent Portal (originally a Claude Cowork
live artifact), built to run on **Vercel + GitHub + Supabase** so it can be shared with anyone
via a real URL, not just inside Cowork.

## What changed from the Cowork version

The pipeline logic, Word/Excel export, DOCX upload parsing, TOC-compliance checker, and every
prompt are **unchanged**. Only the two things that only exist inside a live Cowork session were
replaced:

| Cowork-only bridge | Replaced with |
|---|---|
| `window.cowork.askClaude(...)` | `POST /api/generate` — a Vercel serverless function that calls the real Anthropic API using a server-side key |
| `window.cowork.callMcpTool(...)` (Gmail draft creation) | Dropped for this version. The existing `mailto:` fallback in the "Send draft" modal is used instead — no code changed, since that fallback already existed for when the Gmail call failed |

New in this version, since a real multi-user deployment needs accounts:
- **Supabase auth** — email magic-link sign-in gates the whole app.
- **Save proposal / My proposals** — a finished draft (plus its Compliance Review and Red Team
  output) can be saved to a `proposals` table and reopened later, from any device. Only the
  final draft is persisted this way for now; earlier pipeline stages (Client Brief, Solution
  Design, Commercial Approach) still only live in the current browser session — a natural
  next step if you want full state persisted too.

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

### 2. Create a Supabase project
1. [supabase.com](https://supabase.com) → New project.
2. Once it's up, go to **SQL Editor → New query**, paste the contents of `supabase/schema.sql`,
   and run it. This creates the `proposals` table with row-level security so each signed-in
   user only ever sees their own saved proposals.
3. Go to **Project Settings → API** and copy two values: the **Project URL** and the
   **anon / public key**.
4. Open `public/index.html`, find these two lines near the top of the final `<script>` block:
   ```js
   const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
   const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
   ```
   and replace them with the values from step 3. The anon key is meant to be public/client-side —
   the row-level security policies in `schema.sql` are what actually protect the data.
5. Commit and push that change.
6. **Set your Site URL once you have a real deploy URL** (do this after step 4 below): go to
   **Authentication → URL Configuration** and set **Site URL** to your Vercel URL (e.g.
   `https://alliance-ai-agent-portal.vercel.app`), and add that same URL under **Redirect
   URLs**. New Supabase projects default this to `http://localhost:3000` — if you skip this
   step, sign-in links will try to redirect to localhost and fail for everyone except you,
   on your own machine, while a local dev server happens to be running.
7. **Make the 6-digit sign-in code visible in the email** — the portal's sign-in screen shows
   a code-entry fallback (more reliable than the clickable link — corporate email security
   scanners often "click" links automatically to check them, which burns the one-time link
   before a person ever sees it, and clicking a link in a different browser than the one that
   requested it also fails silently). The code exists either way, but by default Supabase's
   email template doesn't display it. Go to **Authentication → Email Templates → Magic Link**
   and add `{{ .Token }}` somewhere in the template body, e.g.:
   ```html
   <p>Or enter this code: {{ .Token }}</p>
   ```

### 3. Get an Anthropic API key
1. [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key.
2. Keep it somewhere safe — you'll paste it into Vercel in the next step, never into this repo.

### 4. Deploy to Vercel
1. [vercel.com](https://vercel.com) → Add New → Project → import the GitHub repo you pushed.
2. Framework preset: **Other** (this is a static site + serverless functions, no framework
   build step needed — `vercel.json` already tells Vercel where things are).
3. Before the first deploy, go to **Environment Variables** and add:
   - `ANTHROPIC_API_KEY` = the key from step 3
   - `ANTHROPIC_MODEL` (optional) = leave blank to use the default (`claude-sonnet-5`)
4. Deploy. Vercel gives you a `*.vercel.app` URL — that's the link to share with your boss (or
   attach a custom domain under Project Settings → Domains).

### 5. Try it
Open the URL, sign in with a work email (you'll get a magic link), and run through Generate →
Review → Save proposal. Anyone else you want using this should sign in the same way — each
person only sees their own saved proposals.

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
│   └── schema.sql         # proposals table + row-level security policies
├── .env.example
├── .gitignore
├── package.json
├── vercel.json
└── README.md
```

## Known gaps / natural next steps
- Only the **final** draft + reviews are saved to Supabase, not every intermediate pipeline
  stage (RFP Analyst output, Client Brief, Solution Design, Commercial Approach). Extending
  `proposals` with those columns and wiring up autosave through the pipeline is a reasonable v2.
- Gmail draft creation was intentionally dropped for this version (see table above) — the
  `mailto:` fallback covers "send the draft," just without the one-click Gmail-draft step.
- No role/permission tiers yet — every signed-in user has the same access. If you need
  view-only accounts for some people, that would need a `role` column on a profiles table plus
  matching RLS policies.
