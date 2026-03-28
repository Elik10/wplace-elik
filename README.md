# gplace

![gplace banner](banner.png)

`gplace` is a self-hosted multiplayer pixel map based on the openplace codebase and customized for a direct username/password flow.

## What You Get

- A backend API for auth, painting, moderation, notifications, and user data
- A Nuxt frontend for login, register, and account flows
- A static map client served through the backend
- HTTPS support for local and production-style environments through Caddy

## Stack

- Node.js 22+
- MariaDB / MySQL
- Prisma
- Nuxt 4
- Caddy

## Local Setup

1. Clone the repository with submodules:

```bash
git clone --recurse-submodules https://github.com/Elik10/wplace-elik.git
cd wplace-elik
```

2. Install root dependencies:

```bash
npm install
```

3. Install the Nuxt frontend dependencies:

```bash
cd frontend2
npm install
cd ..
```

4. Create your environment file:

```bash
copy .env.example .env
```

5. Update the important values inside `.env`:

- `EXTERNAL_URL`
- `DATABASE_URL`
- `SHADOW_DATABASE_URL` for Prisma development
- `JWT_SECRET`

6. Apply the database schema:

```bash
npm run db:push
```

## Run Locally

Start the backend and Caddy from the project root:

```bash
npm run exec
```

Start the Nuxt frontend in a second terminal:

```bash
cd frontend2
npm run dev
```

Default local services:

- `https://localhost:8080` -> main app through Caddy
- `http://localhost:8000` -> alternate local entry
- `http://localhost:3000` -> backend
- `http://localhost:3001` -> Nuxt frontend

## Important Notes

- Use `https://localhost:8080` in the browser. The app is expected to run over HTTPS.
- `Caddyfile` routes `/login`, `/beta`, `/_nuxt`, and related frontend paths to `frontend2`.
- The rest of the traffic goes to the backend on port `3000`.
- Discord-related environment variables are optional if you only want local username/password auth.

## Project Layout

- `src/` -> backend server code
- `frontend/` -> static frontend bundle/submodule
- `frontend2/` -> Nuxt frontend source
- `prisma/` -> Prisma schema and migrations
- `scripts/` -> maintenance and utility scripts

## Useful Commands

```bash
npm run build
npm run lint
npm run db:push
npm run db:generate
```

Nuxt frontend:

```bash
cd frontend2
npm run build
npm run lint
```

## Customization

This fork is branded as `gplace`. If you plan to deploy it publicly, review:

- `.env`
- `Caddyfile`
- visible brand strings in `frontend/` and `frontend2/`
- any upstream links you want replaced with your own

## License

Apache License 2.0. See [LICENSE.md](LICENSE.md).
