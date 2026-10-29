# Apply at Ease

A web and desktop job-search assistant designed to help you:

- Find English-language remote full-time roles and long-term contracts matching your CV and preferences.
- Check eligibility and employer application requirements.
- Tailor your CV, requested cover letters and screening answers using your career information.
- Review and approve each application before submission.
- Track saved jobs, application materials, progress and next steps.

Early development: web and desktop share an opportunity workspace with an agent conversation area, match details and application review panels. Guided onboarding saves an editable search profile locally and reads text from English PDF/DOCX CVs without uploading them. Email-code, Google and Apple sign-in follow onboarding when their providers are configured. Structured career analysis, tailoring, job discovery, agent chat and application workflows are not connected yet.

## Run locally

Requires Node.js 26.12.1, pnpm 12.16.1 and Docker.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
```

Set a local database password in both `POSTGRES_PASSWORD` and `DATABASE_URL`, and replace `AUTH_SECRET` with at least 32 random characters.

```sh
docker compose up -d --wait
pnpm db:migrate
pnpm dev:api
```

In another terminal, start either client:

```sh
pnpm dev:web
pnpm dev:desktop
```

The web app opens at `http://127.0.0.1:5173`. The desktop command downloads Electron on first use and opens the app. Both clients use the local API at `http://127.0.0.1:4310`.

## Set up your search

Choose **Set up your search profile** in the workspace, or open **Your profile**. Setup covers your goal, CV review, editable role tracks, working country, employment arrangements, scoped eligibility and optional preferences/work samples. Each question gets its own screen, with separate illustrated interludes. Searchable role and location answers use selected chips; role levels and other single choices use cards. You can go back, leave questions for later, exit and resume, or edit an individual answer from review. Confirming a profile never approves an application.

Compensation preferences keep full-time gross pay separate from contract pay before tax and expenses. Currency, pay period, private minimum and target are separate questions. Amounts use a slider and an exact editable field; typed values are retained without rounding or conversion. Large values expand the slider range. Values beyond its finite precision remain editable in the exact field with the slider disabled. Deferring compensation retains drafts but excludes them from the active preferences.

PDF and DOCX text is extracted locally. Review it against the original; column order and unsupported document features may need correction. Scanned documents need OCR, which is not available. Files are limited to 10 MB and PDFs to 40 pages. Structured career facts are not inferred from this text. The original file remains unchanged and can be downloaded from the profile.

The profile, source text and original file are stored in IndexedDB for this browser origin or desktop app, without account sync. They are not encrypted by the app. Use **Clear local profile** to remove them; clearing browser/app data also removes them. Storage failures are shown without claiming a successful save. Concurrent edits from another window require reloading the saved version.

Completing setup leads to sign-in, then your profile. It does not run a job search.

## Sign-in configuration

Configure methods in the API environment; unavailable methods stay disabled:

- **Email code:** `RESEND_API_KEY` and `AUTH_EMAIL_FROM` using a verified sending domain. Codes expire after five minutes and allow five verification attempts; requests are rate limited.
- **Google:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Register `AUTH_URL/api/auth/callback/google` as a redirect URI.
- **Apple:** `APPLE_CLIENT_ID` (Services ID) and `APPLE_CLIENT_SECRET` (signed client-secret JWT). Register `AUTH_URL/api/auth/callback/apple` using an HTTPS domain. Renew the client secret before it expires; Apple does not support localhost return URLs.

`AUTH_URL` is the API origin. Serve web `/api` requests through a same-origin proxy to the API and include the web origin in `APP_ORIGINS`. Keep provider secrets on the server.

Desktop sign-in opens the system browser and returns via `com.applyatease.app`. For a non-local installation, set `AUTH_URL` and `APP_WEB_URL` in the desktop process environment; both require HTTPS outside localhost. Packaged installers register the callback scheme.

After sign-in, the completed draft is associated with that account on this device. An existing local account profile requires an explicit choice before replacement. Signing out hides the account’s local profile; it does not erase it or synchronize it to another device. Local profiles remain unencrypted in IndexedDB. Desktop session credentials use the operating system’s encrypted storage when available and remain in memory otherwise.
