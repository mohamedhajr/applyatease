# Apply at Ease

A web and desktop job-search assistant for English-language remote full-time roles and long-term contracts.

Import your CV, review source-linked career details, set search preferences, discover opportunities and prepare application materials. Assessments keep eligibility, qualifications and unknowns separate. Application filling and submission are unavailable.

## Run locally

Use the runtime version in `.node-version` and the package manager version in `package.json`. A local container runtime is required for the development database.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
```

Set matching local database credentials in `POSTGRES_PASSWORD` and `DATABASE_URL`. Set `AUTH_SECRET` to at least 32 random characters.

```sh
docker compose up -d --wait
pnpm db:migrate
pnpm dev:api
```

Start a client in another terminal:

```sh
pnpm dev:web
pnpm dev:desktop
```

The web client uses `http://127.0.0.1:5173` and the API uses `http://127.0.0.1:4310`. `API_PROXY_TARGET` selects a different development API; include the client origin in `APP_ORIGINS`.

## Profile and documents

Set up your search profile or edit individual details in **Your profile**. Current experience and desired career directions remain separate. Country-specific authorization requires explicit answers; residence does not establish eligibility.

Compensation preferences retain exact amounts, currency, pay period and employment basis. A target cannot be below the private minimum. Changing units preserves draft amounts and requires confirmation. Private search limits are separate from application salary answers.

PDF and DOCX text is extracted on-device. Files are limited to 10 MB and PDFs to 40 pages. Scanned documents require unavailable text-recognition capabilities. The original stays unchanged and can be downloaded. Optional analysis sends extracted text to the configured analysis connection after you choose to analyze. Missing access and extraction limitations remain visible.

Profiles and original documents are stored locally without encryption or account synchronization. Clearing the profile removes its local copy; it does not remove separate opportunity history or information retained by an analysis provider.

## Sign in

Configure supported authentication methods through the API environment. Unavailable methods remain disabled. Serve web `/api` requests through a same-origin proxy, keep authentication secrets on the server and include client origins in `APP_ORIGINS`.

Desktop sign-in opens the system browser and returns through the registered application callback. Non-local `AUTH_URL` and `APP_WEB_URL` values require HTTPS.

After sign-in, the completed draft is associated with the selected account on this device. Replacing an existing account profile requires an explicit choice. Signing out hides the local account profile without deleting it.

## Discover and review

Choose target roles, create a search plan and run discovery in **All opportunities**. You can also import a public HTTPS employer posting. Search results remain leads until their sources are inspected. Save or dismiss an opportunity independently of any application.

Inspect the actual application destination before preparing materials. Inspection reads accessible static HTML and remains partial: conditional pages, login requirements and dynamically rendered fields can hide requirements.

Preparation evaluates the whole supplied CV and returns exact edit proposals and drafted answers for observed questions. It does not edit or render a replacement document. Consequential declarations remain unanswered until the actual applicant responds. Local review never approves transmission.

Profile and source changes mark dependent results stale. Regenerating preparation archives earlier user-written answers with their prior context. Archived wording is retained for inspection and is not silently assigned to the new package. Interrupted operations preserve earlier results. After an API restart, refresh source captures and application requirements before another analysis operation.

Separate local research profiles retain public-source material without applicant confirmations. Public availability does not grant permission to represent a CV owner. Research profiles cannot approve, upload, fill or submit applications.

## Checks

```sh
pnpm check
pnpm test:integration
pnpm test:web
```

Integration checks require a dedicated test database. Their global setup initializes its schema before the test suites start. Native development and packaged checks use `pnpm test:desktop` and `pnpm test:desktop:packaged`.
