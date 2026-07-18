# Wanderlust

An accommodation listing platform for travellers. Users can browse and search stays,
publish their own listings with photos, and leave star-rated reviews.

Full-stack Node.js project: server-rendered EJS views, MongoDB for storage,
Cloudinary for image hosting, and session-based auth via Passport.

## Features

- **Listings** — full CRUD. Only the owner can edit or delete their own listing.
- **Auth** — signup, login, logout. Passwords hashed and salted by `passport-local-mongoose`.
- **Reviews** — 1–5 star ratings with comments. Only the author can delete a review.
  Deleting a listing cascades to its reviews.
- **Image upload** — listing photos stored on Cloudinary via `multer`.
- **Bookings** — instant-book with real availability checking. Owners can't book
  their own listing, overlapping stays are rejected, and guests can cancel.
- **Search + category filter** — case-insensitive match on location or country,
  across 11 categories. The two compose: filter by *Pools* **in** *Bali*.
- **Pagination** — 9 per page with a windowed pager that preserves active filters.
- **Maps** — every listing shows its location on a map. No API key required.
- **Profile** — your listings, your reviews, your trips, and bookings other
  people have made on your listings.
- **Sessions** — persisted in MongoDB, so logins survive a server restart.
- **Flash messages** — success/error feedback on every action.

### How availability works

A stay is the half-open interval `[checkIn, checkOut)`, so a guest may arrive on
the day the previous guest leaves. Two stays conflict when each starts before the
other ends. Cancelling frees the dates while keeping the trip in the guest's
history. Dates are pinned to UTC midnight, so a stay means the same nights
regardless of the server's timezone.

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js |
| Server | Express 4 |
| Views | EJS + ejs-mate layouts, Bootstrap 5 |
| Database | MongoDB via Mongoose 8 |
| Auth | Passport (local strategy) + passport-local-mongoose |
| Sessions | express-session + connect-mongo |
| Uploads | multer + multer-storage-cloudinary |
| Maps | Leaflet + OpenStreetMap tiles, Nominatim geocoding (no API key) |
| Validation | Joi (server-side), Bootstrap (client-side) |
| Tests | Jest + supertest against mongodb-memory-server |

## Quick start

No MongoDB or Cloudinary account needed — this boots a local database and seeds it:

```bash
npm install
npm run dev
```

Open http://localhost:2000. Sign in with **`demo` / `demo1234`**, or sign up your own account.
(That password is local-only — a deployed instance gets a generated one, see [Deployment](#deployment).)

`npm run dev` runs MongoDB through `mongodb-memory-server` (a dev-only dependency),
seeds 29 sample listings on first run, and persists data to `.mongo-data/` so it
survives restarts. Image upload will not work in this mode without Cloudinary keys —
everything else does.

## Full setup

For a real database and working image uploads:

**1. Configure environment**

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Required | What it is |
|---|---|---|
| `ATLASDB_URL` | yes | MongoDB connection string. Atlas (`mongodb+srv://...`) or local (`mongodb://127.0.0.1:27017/wanderlust`). |
| `SECRET` | yes | Session signing/encryption key. Any long random string. |
| `CLOUD_NAME` | for uploads | Cloudinary cloud name. |
| `CLOUD_API_KEY` | for uploads | Cloudinary API key. |
| `CLOUD_API_SECRET` | for uploads | Cloudinary API secret. |
| `PORT` | no | Defaults to `2000`. |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

A free MongoDB Atlas cluster is at [cloud.mongodb.com](https://cloud.mongodb.com) —
remember to allowlist your IP. Cloudinary credentials are all on the dashboard at
[cloudinary.com](https://cloudinary.com).

**2. Run**

```bash
npm start
```

**3. Seed sample data (optional)**

Sample listings need an owner, so sign up once through the UI first, then:

```bash
npm run seed
```

This wipes the listings collection and inserts 29 samples owned by the first user
in the database.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Local MongoDB + auto-seed + server. Zero config. |
| `npm start` | Server only. Needs a filled-in `.env`. |
| `npm run seed` | Reset listings to the 29 samples. Needs an existing user. |
| `npm test` | Run the Jest suite against an in-memory MongoDB. Zero config. |

## Project structure

```
app.js              Express setup, DB connection, session/auth wiring, error handler
dev.js              Dev-only launcher: local MongoDB + auto-seed
middleware.js       Auth guards (isLoggedIn, isOwner, isReviewAuthor, isBookingGuest)
schema.js           Joi request schemas
CloudConfig.js      Cloudinary + multer storage
Models/             Mongoose schemas: listing, review, user, booking
utils/              categories (single source of truth), dates, geocoding, async wrapper
routes/             Express routers: listing, review, user
controllers/        Route handlers
views/              EJS templates (listings, users, includes, layouts)
public/             Static CSS and client JS
init/               Seed script and sample data
tests/              Jest + supertest route tests
```

## Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/listings?location=&category=&page=` | — | Listings, with optional search, category filter and page. All three compose. |
| GET | `/listings/search?location=` | — | Alias for the `location` query above |
| GET | `/listings/filter?category=` | — | Alias for the `category` query above |
| GET | `/listings/new` | required | New listing form |
| POST | `/listings` | required | Create listing |
| GET | `/listings/:id` | — | Listing detail + reviews |
| GET | `/listings/:id/edit` | owner | Edit form |
| PUT | `/listings/:id` | owner | Update listing |
| DELETE | `/listings/:id` | owner | Delete listing + its reviews |
| POST | `/listings/:id/reviews` | required | Add review |
| DELETE | `/listings/:id/reviews/:reviewId` | author | Delete review |
| POST | `/listings/:id/bookings` | required | Book a stay (rejects overlaps) |
| DELETE | `/listings/:id/bookings/:bookingId` | guest | Cancel a booking |
| GET | `/profile` | required | Your listings, reviews, trips and incoming bookings |
| GET/POST | `/signup` | — | Register |
| GET/POST | `/login` | — | Log in |
| GET | `/logout` | — | Log out |

## Tests

```bash
npm test
```

Jest + supertest drive the real Express app against a throwaway in-memory MongoDB —
no `.env` and no running server required. The suite covers every category filter,
search, auth guards, the signup/login flows, and error handling.

## Known limitations

- **Dependency vulnerabilities.** Two high-severity advisories remain, both rooted in
  `cloudinary` v1. Clearing them requires the breaking v1 → v2 upgrade, which also
  affects `multer-storage-cloudinary`.
- **Image upload needs Cloudinary keys.** Without them, creating a listing with a
  photo fails; every other feature works.

## Deployment

`render.yaml` in the repo root is a ready-to-use Render blueprint.

**1. Push the repo to GitHub.**

**2. Render → New → Blueprint**, point it at the repo. It reads `render.yaml`
and creates the web service with the right build and start commands.

**3. Fill in the environment variables** when prompted. They are marked
`sync: false` in the blueprint so they are never committed:

| Variable | Value |
|---|---|
| `ATLASDB_URL` | Your Atlas connection string |
| `SECRET` | A long random string |
| `CLOUD_NAME` / `CLOUD_API_KEY` / `CLOUD_API_SECRET` | From the Cloudinary dashboard |

`NODE_ENV=production` is set by the blueprint, which skips `.env` loading and
uses real environment variables instead.

**4. Allowlist Render's IPs in Atlas.** Network Access → add Render's outbound
addresses, or `0.0.0.0/0` if you are just demoing. Without this the app boots
but every request fails on a TLS handshake.

**5. Seed the production database** (once):

```bash
ATLASDB_URL="<your atlas url>" npm run seed
```

On an empty database this also creates a `demo` account and prints a generated
password once. Set `DEMO_PASSWORD` beforehand to choose your own.

### Notes

- The server reads `PORT` from the environment; Render sets it automatically.
- The build skips devDependencies, so `mongodb-memory-server` never downloads
  its MongoDB binary in production.
- `dev.js` and `mongodb-memory-server` are local-only. Neither runs in production,
  but you can delete both once you no longer need the zero-config local mode.
