# IMovies

IMovies is a responsive cinema discovery and ticket reservation application. Visitors can browse films and showtimes, select seats, and review confirmed reservations. Administrators can manage movies, cinemas, showtimes, and booking records.

> IMovies records seat reservations but does not process online payments.

## Features

- Dark, responsive movie catalogue with title search and genre filters.
- Movie details and live showtime availability from the API.
- Registration, login, and signed JWT authentication.
- Seat selection with server checked availability and atomic duplicate-seat protection.
- Booking confirmation and authenticated booking history, including cancellation.
- Administrator-only catalogue, cinema, showtime, and sales tools.
- Seed data and a repeatable Movie text-index migration for MongoDB Atlas.

## Tech stack

- Frontend: React, Vite, React Router, Bootstrap 5, custom CSS, Axios.
- Backend: Node.js, Express, Mongoose, JSON Web Tokens, bcrypt.
- Database: MongoDB Atlas or a local MongoDB replica set.
- Hosting: Vercel for the frontend, Render for the API, Atlas for MongoDB.

## Screenshots

Add current product screenshots here before publishing, for example:

| Home | Movie details | Seat selection |
| --- | --- | --- |
| `docs/screenshots/home.png` | `docs/screenshots/movie-details.png` | `docs/screenshots/seats.png` |

## Project structure

```text
IMovies/
├── client/                 # React/Vite application
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   ├── tests/
│   └── vercel.json
├── server/                 # Express/Mongoose API
│   ├── scripts/            # Seed and index migration commands
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── models/
│   │   └── routes/
│   └── tests/
├── scripts/dev.js          # Starts frontend and backend together
├── render.yaml             # Render service configuration
├── DEPLOYMENT.md
└── README.md
```

## Requirements and local setup

Use Node.js 22.12 or newer and npm. From the project root:

```sh
npm --prefix client ci
npm --prefix server ci
```

Create local environment files (PowerShell):

```powershell
Copy-Item client/.env.example client/.env
Copy-Item server/.env.example server/.env
```

Set the values described below. `.env` files are ignored by Git; keep the real values there and never add them to commits.

Start both services from the project root:

```sh
npm run dev
```

The Vite frontend runs at `http://localhost:5173`; the API defaults to `http://localhost:5000`. The API waits for MongoDB before listening. Its health endpoint is `GET /api/health`.

You can start either service separately with `npm run dev:client` or `npm run dev:server`.

## Environment variables

### Frontend (`client/.env`)

| Name | Required | Purpose | Local example |
| --- | --- | --- | --- |
| `VITE_API_URL` | No | API base URL, including `/api` | `http://localhost:5000/api` |

Vite variables are public build-time configuration. Never put credentials or secrets in a `VITE_` variable.

### Backend (`server/.env`)

| Name | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string; keep credentials private and URL-encode reserved password characters. |
| `JWT_SECRET` | Yes | Private signing secret, at least 32 characters. |
| `CLIENT_URL` | Recommended | Exact allowed browser origin; comma-separate multiple origins. |
| `PORT` | No | API port; defaults to `5000` locally and is supplied by Render in production. |
| `NODE_ENV` | No | Use `development` locally and `production` when deployed. |
| `JWT_EXPIRES_IN` | No | Token lifetime; defaults to `7d`. |
| `DNS_SERVERS` | No | Comma-separated DNS resolver IPs for Atlas SRV lookup; defaults to `1.1.1.1,8.8.8.8`. |
| `ADMIN_NAME` | Seed only | Name for a new development administrator. |
| `ADMIN_EMAIL` | Seed only | Email for a new development administrator. |
| `ADMIN_PASSWORD` | Seed only | Password for a new development administrator (12+ characters). |

The committed `.env.example` files contain placeholders only. The seed command is development-only and inserts records without overwriting existing seed records. Do not run it in production.

## Database setup

Create a MongoDB Atlas database user with least-privilege access to the application database and allow the API host in Atlas Network Access. Put the Atlas URI in `server/.env` as `MONGODB_URI`; never paste it into source files or documentation.

To insert development movies, cinemas, showtimes, and the configured admin account:

```sh
npm --prefix server run seed
```

The seed script is insert-only for existing sample records and refuses to run when `NODE_ENV=production`.

To apply the language-neutral Movie text index definition to an existing database:

```sh
npm --prefix server run migrate:movie-text-index
```

The migration inspects indexes and only replaces the matching Movie title text index. It does not change Movie documents or other indexes. Review the output before running it against a production database.

## API overview

All API routes are under `/api`.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | API liveness check |
| `POST` | `/auth/register`, `/auth/login` | Public, rate-limited | Create an account or obtain a JWT |
| `GET` | `/auth/me` | Signed in | Current user profile |
| `GET` | `/movies`, `/movies/:slug` | Public | Movie catalogue, details, and related shows |
| `GET` | `/cinemas` | Public | Active cinemas |
| `GET` | `/shows`, `/shows/:id/availability` | Public | Scheduled shows and current seat inventory |
| `POST` | `/bookings` | Signed in | Reserve seats after server-side availability checks |
| `GET` | `/bookings/my`, `/bookings/:id` | Owner | Booking history and booking detail |
| `POST` | `/bookings/:id/cancel` | Owner | Cancel an eligible reservation |
| Movie/cinema/show write routes | `/movies`, `/cinemas`, `/shows` | Administrator | Manage catalogue and schedule |
| `GET` | `/bookings/admin/all` | Administrator | Review recent bookings |

Private API calls use `Authorization: Bearer <token>`. The backend determines ticket prices, roles, and seat availability; it does not trust client-submitted values for those fields.

## Checks and tests

From the project root:

```sh
npm test                       # Backend API, model, and migration tests
npm run test:client            # Frontend seat-selection tests
npm run lint                   # Frontend ESLint
npm run build                  # Production frontend build
```

Backend JavaScript syntax checks (PowerShell):

```powershell
Get-ChildItem server/src, server/scripts -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

## Deployment architecture

Vercel serves the static React/Vite application. Render runs the Express API, which connects to MongoDB Atlas. Configure the API URL in Vercel and the exact frontend origin in Render’s `CLIENT_URL`; see [DEPLOYMENT.md](DEPLOYMENT.md) for the deployment sequence and environment settings. No production service URLs are committed in this repository.

## Future improvements

- Add online payment processing and payment reconciliation.
- Add API contract and browser end-to-end tests.
- Add persistent distributed rate limiting and structured observability.
- Add movie release dates and cinema selection to support richer discovery filters.
- Add booking emails and administrator audit history.
