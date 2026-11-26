# CafeNora

سامانه سفارش کافه — a multi-tenant SaaS for cafés. Guests scan a QR code at their table, order from the menu, and staff manage orders and checkout from a single screen.

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (Base UI flavor, Nova preset)
- **PostgreSQL 16** (Docker in dev) + **Drizzle ORM**
- **Argon2id** password hashing, cookie-based staff sessions
- **Server-Sent Events** for the live staff order feed
- **Nodemailer** (console mailer in dev, SMTP in prod)
- **sharp** for menu image re-encoding
- Farsi / RTL, Toman currency

## Requirements

- Node 20+
- Docker + Docker Compose (for Postgres)
- npm

## Getting started

```bash
# 1. install deps
npm install

# 2. copy env and fill in a session secret
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# paste the output into .env as SESSION_SECRET=

# 3. start Postgres
docker compose up -d
docker compose ps          # db should be healthy

# 4. run the app
npm run dev