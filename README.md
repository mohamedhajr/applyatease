# Apply at Ease

A web and desktop job-search assistant designed to help you:

- Find English-language remote full-time roles and long-term contracts matching your CV and preferences.
- Check eligibility and employer application requirements.
- Tailor your CV, requested cover letters and screening answers using your career information.
- Review and approve each application before submission.
- Track saved jobs, application materials, progress and next steps.

Early development: web and desktop share an opportunity workspace with an agent conversation area, match details and application review panels. Sign-in, CV import, job discovery, agent chat and application workflows are not connected yet.

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
