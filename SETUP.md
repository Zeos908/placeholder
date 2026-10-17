# placeholder: setup

Status: Phases 0 and 1 are done locally. The database is live on Supabase (project
`bilaaiamuychuquvuwuw`) with the seed data, and all 16 RLS tests pass. Not deployed to Vercel yet.

Windows note: this PC blocks PowerShell scripts, so in PowerShell type `npx.cmd` instead of `npx`.

## 1. Install
```
npm install
```

## 2. Supabase
1. Project Settings → **Data API**: the base Project URL (`https://<ref>.supabase.co`, with nothing after `.co`).
2. Project Settings → **API Keys**: the publishable (anon) key and the secret (service_role) key.
3. Link and push the schema + seed data:
   ```
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push --include-seed
   ```

## 3. Fill in `.env.local`
Copy `.env.example` to `.env.local`, then fill in the three Supabase values and `NVIDIA_API_KEY`
(build.nvidia.com → your profile → API Keys; starts with `nvapi-`). Leave `IMAGE_MODEL` empty.

Privacy: student profiles and chats are sent to NVIDIA's hosted API. Check NVIDIA's API terms
for how prompts are logged, and mention it in the app's privacy policy (§14.3).

## 3b. Supabase Auth settings (dashboard)
1. **Authentication → URL Configuration**: Site URL `http://localhost:3000`; add
   `http://localhost:3000/**` under Redirect URLs (add your Vercel URL later too).
2. **Email confirmation**: Supabase's built-in email sender only allows a few emails per hour.
   While developing, turn off **Confirm email** (Authentication → Sign In / Providers → Email).
   Before launch, turn it back on and connect a real SMTP provider (Authentication → Emails → SMTP).
3. **Google sign-in**: in Google Cloud Console create an OAuth client (type "Web application")
   with the redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`, then paste its
   Client ID and Secret into Authentication → Sign In / Providers → Google and enable it.

## 4. Check it
```
npm run dev            # terminal shows "[ai] CHAT_MODEL found on NIM: ..."
npm run test:rls       # Phase 1 RLS tests against your Supabase project
npm run test:e2e       # API checks against the running dev server (real mode) + Supabase
npm run typecheck
```
Open http://localhost:3000 (wordmark) and http://localhost:3000/api/health (model check).

## 5. Deploy to Vercel
Import the folder/repo in Vercel, add the same env vars (set `APP_URL` to the Vercel URL), deploy,
then open `/api/health` on the deployed URL.

## Notes from the build
- **AI provider is NVIDIA NIM, not OpenRouter** (changed 2026-10-16 at the owner's request).
  Same model: `nvidia/nemotron-3-ultra-550b-a55b` at `https://integrate.api.nvidia.com/v1`.
  The client is `lib/ai.ts`. 429, 503 and 504 responses are all treated as "busy" (§6.1).
- **JSON output**: enrichment asks for JSON in the prompt and validates it with zod
  (`chatJson` in `lib/ai.ts`), so it doesn't depend on `response_format` support.
- **Images**: none yet. OpenRouter had no free image model on 2026-10-16. NIM image models use
  separate per-model endpoints and are evaluated in Phase 6. Until then, posts use the gradient
  placeholder.
- **Spec deviations** (small, for safety):
  - Other users read profiles through the `public_profiles` view; the `profiles` table itself is
    owner-only, so zip, coordinates and settings never leak.
  - `ai_usage` is read-only for users; the cap is enforced by `consume_chat_message()`, so it
    can't be reset from the browser.
  - Expired listings stay readable to users who saved them, so Saved and chat keep working.
  - Friend/block helper functions only answer about the signed-in user, so nobody can probe
    whether two other people are friends.
- **Age gate**: email/password sign-up has no 13+ check; consider adding one before launch (§14.4).
- **Web push + reminders cron** (F8): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and
  `CRON_SECRET` were generated into `.env.local`; copy them to Vercel too. Reminders are sent by
  `GET /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET`. It needs to run every 5
  minutes after deploy: Vercel Hobby cron only runs daily, so schedule it from Supabase
  (`pg_cron` + `pg_net` calling the deployed URL) or an external cron.
- **Chat** runs with Nemotron's thinking off (`reasoning: false`) so answers start streaming
  quickly; tool calls (`create_reminder`, `create_checklist`) are validated server-side, then the
  model gets one more round to say what it did. The student's zip and coordinates are never sent.
- **Sign-in links** also work in Supabase's `token_hash` form (`/auth/callback?token_hash=…&type=…`).
