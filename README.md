# Wanderlust

A campus directory for students of **MBM University (MBM Engineering College)**,
Ratanada, Jodhpur. Hostels, PGs, messes, restaurants, stationery shops, gyms and
clinics near campus — each with its real distance from the college gate, what it
costs, when it's open, and how to contact it.

Full-stack Node.js: server-rendered EJS, MongoDB, Cloudinary for photos,
session auth via Passport, and OpenStreetMap for maps and geocoding.

## Why it exists

Google Maps knows where the restaurants are. It does not know that the mess two
gullies down does ₹2,200/month for unlimited veg thali, that a PG is boys-only,
or which hostel has 24-hour water. That knowledge lives with students, gets
passed down by word of mouth, and is lost every time a batch graduates.

This is an attempt to write it down.

## How the data works

This matters more than the code, because a directory people can't trust is
worse than no directory.

**Two sources, clearly distinguished:**

| Source | What it is | Badge |
|---|---|---|
| `osm` | Imported from OpenStreetMap. Proves a place exists and roughly where. | **Unverified** |
| `student` | Added by a student who has actually been there. | **Unverified** until a moderator approves |

**Nothing is invented.** No placeholder phone numbers, no guessed rents.
A field is either known or left empty.

**Imports must be corroborated.** A name and a map pin is not evidence — that is
how a marriage hall ends up tagged as a restaurant. An OSM entry is only
published if something backs it up: a phone number, opening hours, a website, a
street address, a known brand, or a surveyed cuisine. On the last run that took
53 candidates down to 25.

**OpenStreetMap cannot give you the important half.** It has no tag for a tiffin
service, and its "hostels" are backpacker places for tourists. Messes, PGs and
student hostels have to be added by students. That is the point of the
submission flow, not a gap in it.

**Submissions are moderated.** Entries describe real local businesses, so a
student submission stays private until an admin approves it. Approving is also
what marks an entry verified.

Place data from OpenStreetMap is © OpenStreetMap contributors, licensed
[ODbL](https://www.openstreetmap.org/copyright), and credited in the UI.

## Features

- **Directory** — browse by category, sorted by real distance from campus.
- **Search + filters** — match on name, area or landmark; filter by category or
  pure-veg. Everything composes: *Mess & Tiffin* + *Ratanada* + pure veg.
- **Submissions** — any logged-in student can add a place; a moderator approves it.
- **Moderation queue** — admin-only review, approve, reject and verify.
- **Enquiries** — ask the student who added a place; they reply, both sides see
  the thread on their profile. Not a booking system — nobody reserves a mess by
  date range, and there is no account for the actual owner.
- **Reviews** — 1–5 stars with comments.
- **Maps** — every place with coordinates shows on a map alongside the campus,
  so the distance means something. No API key required.
- **Contact** — one-tap call and WhatsApp click-to-chat.

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js |
| Server | Express 4 |
| Views | EJS + ejs-mate layouts, Bootstrap 5 |
| Database | MongoDB via Mongoose 8 |
| Auth | Passport (local) + passport-local-mongoose |
| Sessions | express-session + connect-mongo |
| Uploads | multer + multer-storage-cloudinary |
| Maps | Leaflet + OpenStreetMap tiles, Nominatim geocoding (no API key) |
| Validation | Joi (server-side), Bootstrap (client-side) |
| Tests | Jest + supertest against mongodb-memory-server |

## Quick start

No MongoDB or Cloudinary account needed — this boots a local database:

```bash
npm install
npm run dev
```

Open http://localhost:2000, and sign up. Photo upload needs Cloudinary keys;
everything else works without them.

## Full setup

**1. Configure environment**

```bash
cp .env.example .env
```

| Variable | Required | What it is |
|---|---|---|
| `ATLASDB_URL` | yes | MongoDB connection string |
| `SECRET` | yes | Session signing key. Any long random string. |
| `CLOUD_NAME` / `CLOUD_API_KEY` / `CLOUD_API_SECRET` | for photos | Cloudinary dashboard |
| `PORT` | no | Defaults to `2000` |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**2. Import the starting data**

```bash
node init/import-osm.js            # dry run - shows what it would import and why
node init/import-osm.js --write    # actually import
```

Re-running is safe: it updates unverified imports, prunes ones that no longer
meet the corroboration bar, and never touches an entry a student has verified
or edited.

**3. Make yourself an admin** so you can moderate:

```bash
node init/make-admin.js <your-username>
node init/make-admin.js --list
```

**4. Run**

```bash
npm start
```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Local MongoDB + server. Zero config. |
| `npm start` | Server only. Needs a filled-in `.env`. |
| `npm test` | Jest suite against an in-memory MongoDB. Zero config. |
| `node init/import-osm.js [--write]` | Import real places from OpenStreetMap. |
| `node init/make-admin.js <user> [--revoke]` | Grant or revoke moderation rights. |
| `node init/reset.js [--confirm]` | Delete all places, reviews and enquiries. Destructive. |

## Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/listings?location=&category=&veg=&sort=&page=` | — | Directory. All params compose. |
| GET | `/listings/new` | required | Submission form |
| POST | `/listings` | required | Submit a place (pending unless admin) |
| GET | `/listings/:id` | — | Place detail, map, reviews |
| GET | `/listings/:id/edit` | owner | Edit / correct |
| PUT | `/listings/:id` | owner | Save changes |
| DELETE | `/listings/:id` | owner | Delete |
| POST | `/listings/:id/reviews` | required | Add review |
| DELETE | `/listings/:id/reviews/:reviewId` | author | Delete review |
| POST | `/listings/:id/enquiries` | required | Ask the person who added it |
| POST | `/listings/:id/enquiries/:enquiryId/reply` | recipient | Reply |
| GET | `/admin/queue` | admin | Moderation queue |
| POST | `/admin/listings/:id/approve` \| `/reject` \| `/verify` | admin | Moderate |
| GET | `/profile` | required | Your places, reviews and enquiry threads |
| GET/POST | `/signup`, `/login`, `/logout` | — | Accounts |

## Project structure

```
app.js              Express setup, DB, session/auth wiring, error handler
dev.js              Dev-only launcher: local MongoDB
middleware.js       Guards: isLoggedIn, isOwner, isAdmin, isReviewAuthor
schema.js           Joi request schemas
CloudConfig.js      Cloudinary + multer storage
Models/             listing, review, user, enquiry
utils/              categories, campus (distance), geocoding, async wrapper
routes/             listing, review, user, enquiry, admin
controllers/        Route handlers
views/              EJS templates
init/               import-osm, make-admin, reset
tests/              Jest + supertest
```

## Tests

```bash
npm test
```

Drives the real Express app against a throwaway in-memory MongoDB — no `.env`,
no running server, and it never touches your real database. Covers the
distance maths, approved-only visibility, filters, pagination, the submission
pipeline, moderation permissions, enquiry threads, and reviews.

## Deployment

`render.yaml` is a ready-to-use Render blueprint. See the notes below it in that
file; in short: **New → Blueprint**, point at this repo, fill in the five secret
environment variables, and allowlist your host's IPs in MongoDB Atlas.

> The Atlas allowlist is the one to get right. When it is wrong the app fails
> with a TLS handshake error that never mentions IP allowlisting.

## Known limitations

- **Coverage is thin, by design.** Only corroborated places are imported, and
  hostels, PGs and messes have to be added by hand. It fills up as people use it.
- **Straight-line distances.** Computed as the crow flies, not walking distance,
  and labelled approximate.
- **Geocoding is best-effort.** Small landmarks are often missing from
  Nominatim, so it falls back to the surrounding area. It deliberately does not
  fall back to the city — a pin on the wrong side of Jodhpur would look precise
  and be wrong.
- **Two high-severity dependency advisories** remain, both from `cloudinary` v1.
  Clearing them needs the breaking v1 → v2 upgrade.
