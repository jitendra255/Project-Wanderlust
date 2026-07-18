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
- **Search** — case-insensitive match on location or country.
- **Category filter** — 11 categories (Trending, Rooms, Castles, Pools, Camping…)
  filter the grid, with an active-filter banner and empty state.
- **Sessions** — persisted in MongoDB, so logins survive a server restart.
- **Flash messages** — success/error feedback on every action.

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
| Validation | Joi (server-side), Bootstrap (client-side) |

## Quick start

No MongoDB or Cloudinary account needed — this boots a local database and seeds it:

```bash
npm install
npm run dev
```

Open http://localhost:2000. Sign in with **`demo` / `demo1234`**, or sign up your own account.

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
middleware.js       Auth guards (isLoggedIn, isOwner, isReviewAuthor) + Joi validators
schema.js           Joi request schemas
CloudConfig.js      Cloudinary + multer storage
Models/             Mongoose schemas: listing, review, user
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
| GET | `/listings` | — | All listings |
| GET | `/listings/search?location=` | — | Search by location or country |
| GET | `/listings/filter?category=` | — | Filter listings by category |
| GET | `/listings/new` | required | New listing form |
| POST | `/listings` | required | Create listing |
| GET | `/listings/:id` | — | Listing detail + reviews |
| GET | `/listings/:id/edit` | owner | Edit form |
| PUT | `/listings/:id` | owner | Update listing |
| DELETE | `/listings/:id` | owner | Delete listing + its reviews |
| POST | `/listings/:id/reviews` | required | Add review |
| DELETE | `/listings/:id/reviews/:reviewId` | author | Delete review |
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

## Deployment notes

- The server reads `PORT` from the environment, so it works on Render, Railway, etc.
- Set `NODE_ENV=production` — `.env` loading is skipped and real environment
  variables are used instead.
- `package.json` pins `engines.node`. Update it if your host runs a different version.
- Remove `dev.js` and the `mongodb-memory-server` dependency once a real database
  is configured; neither is used in production.
