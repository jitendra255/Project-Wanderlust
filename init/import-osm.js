// Imports real, openly-licensed POI data from OpenStreetMap (Overpass API) as a
// starting skeleton for the directory.
//
// Everything imported is marked source:"osm" and verified:false, because OSM
// tells us a place exists and roughly where - not its rent, its mess rate, or
// whether it is any good. Students verify and enrich from there.
//
// OSM data is ODbL-licensed; the UI credits OpenStreetMap contributors.
//
//   node init/import-osm.js            # dry run, prints what it would import
//   node init/import-osm.js --write    # actually write to the database
const path = require("path")
require("dotenv").config({ path: path.join(__dirname, "..", ".env") })
const mongoose = require("mongoose")
const Listing = require("../Models/listing.js")
const User = require("../Models/user.js")
const { CAMPUS, distanceFromCampus, formatDistance } = require("../utils/campus.js")

const RADIUS_M = 2500;
const [LON, LAT] = CAMPUS.coordinates;

// OSM tag -> our category. Anything not listed here is skipped deliberately:
// tourist hotels and backpacker hostels are noise for a student directory.
const TAG_MAP = {
    "amenity=restaurant": "Restaurant",
    "amenity=fast_food": "Restaurant",
    "amenity=food_court": "Restaurant",
    "amenity=cafe": "Cafe & Snacks",
    "amenity=ice_cream": "Cafe & Snacks",
    "amenity=pharmacy": "Medical",
    "amenity=clinic": "Medical",
    "amenity=doctors": "Medical",
    "amenity=hospital": "Medical",
    "amenity=bank": "Bank & ATM",
    "amenity=atm": "Bank & ATM",
    "shop=stationery": "Stationery & Xerox",
    "shop=copyshop": "Stationery & Xerox",
    "shop=books": "Stationery & Xerox",
    "shop=laundry": "Laundry",
    "shop=supermarket": "Grocery",
    "shop=convenience": "Grocery",
    "shop=general": "Grocery",
    "shop=bakery": "Cafe & Snacks",
    "leisure=fitness_centre": "Gym",
};

const OVERPASS_QUERY = `
[out:json][timeout:90];
(
  nwr["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream|pharmacy|clinic|doctors|hospital|bank|atm)$"](around:${RADIUS_M},${LAT},${LON});
  nwr["shop"~"^(stationery|books|copyshop|laundry|supermarket|convenience|general|bakery)$"](around:${RADIUS_M},${LAT},${LON});
  nwr["leisure"="fitness_centre"](around:${RADIUS_M},${LAT},${LON});
);
out center tags;
`;

// A name and a map pin is not evidence that a place exists, is still open, or
// is what OSM says it is - that is how a marriage hall ends up tagged as a
// restaurant and a tailor ends up in the food list.
//
// We publish an imported entry only when something corroborates it: someone
// recorded a phone, hours, a website, a street address, a brand, or surveyed
// the cuisine. Everything else is left out for students to add properly.
const CORROBORATING_TAGS = [
    ["phone", (t) => t.phone || t["contact:phone"]],
    ["hours", (t) => t.opening_hours],
    ["website", (t) => t.website || t["contact:website"]],
    ["address", (t) => t["addr:street"] || t["addr:housenumber"]],
    ["brand", (t) => t.brand || t.operator],
    ["cuisine", (t) => t.cuisine],
];

function signalsFor(tags) {
    return CORROBORATING_TAGS.filter(([, has]) => has(tags)).map(([name]) => name);
}

function categoryFor(tags) {
    for (const [key, category] of Object.entries(TAG_MAP)) {
        const [k, v] = key.split("=");
        if (tags[k] === v) return category;
    }
    return null;
}

function coordsOf(element) {
    if (typeof element.lat === "number" && typeof element.lon === "number") {
        return [element.lon, element.lat];
    }
    if (element.center) return [element.center.lon, element.center.lat];
    return null;
}

function addressOf(tags) {
    const parts = [
        tags["addr:housenumber"],
        tags["addr:street"],
        tags["addr:suburb"] || tags["addr:neighbourhood"],
    ].filter(Boolean);
    return parts.join(", ") || CAMPUS.area;
}

// The public Overpass instances are free and frequently overloaded - 429 and
// 504 are routine, not bugs. Try the mirrors with a backoff before giving up.
const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchFromOverpass(attempts = 3) {
    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        for (const endpoint of OVERPASS_ENDPOINTS) {
            try {
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "User-Agent": "MBM-campus-directory/1.0 (student project)",
                    },
                    body: "data=" + encodeURIComponent(OVERPASS_QUERY),
                });

                if (res.ok) {
                    const host = new URL(endpoint).host;
                    console.log(`  served by ${host}`);
                    return (await res.json()).elements || [];
                }

                lastError = new Error(`${new URL(endpoint).host} returned ${res.status}`);
                console.log(`  ${lastError.message}, trying next mirror...`);
            } catch (err) {
                lastError = err;
                console.log(`  ${new URL(endpoint).host} failed: ${err.message}`);
            }
        }

        if (attempt < attempts) {
            const wait = attempt * 5000;
            console.log(`  all mirrors busy, waiting ${wait / 1000}s before retry ${attempt + 1}/${attempts}...`);
            await sleep(wait);
        }
    }

    throw lastError || new Error("Overpass unavailable");
}

function toListing(element, ownerId) {
    const tags = element.tags || {};
    if (!tags.name) return null; // an unnamed POI is useless in a directory

    const category = categoryFor(tags);
    if (!category) return null;

    const coordinates = coordsOf(element);
    if (!coordinates) return null;

    const signals = signalsFor(tags);
    if (signals.length === 0) return null; // nothing corroborates it - skip

    const phone = tags.phone || tags["contact:phone"] || undefined;

    return {
        _signals: signals,
        title: tags.name,
        description:
            `${category} near ${CAMPUS.shortName}. Imported from OpenStreetMap ` +
            `(corroborated by: ${signals.join(", ")}) but not checked on the ground. ` +
            `Know this place? Help by correcting it.`,
        category,
        location: addressOf(tags),
        landmark: tags["addr:street"] || undefined,
        country: "India",
        phone,
        whatsapp: undefined,
        timings: tags.opening_hours || undefined,
        vegOnly: tags["diet:vegetarian"] === "only",
        image: {
            // No photo yet - the UI falls back to a category placeholder.
            url: "",
            filename: "",
        },
        geometry: { type: "Point", coordinates },
        distanceFromCampus: distanceFromCampus(coordinates),
        source: "osm",
        osmId: `${element.type}/${element.id}`,
        verified: false,
        // Visible immediately but clearly badged unverified; the moderation queue
        // is for student submissions, not for this skeleton.
        status: "approved",
        owner: ownerId,
    };
}

(async () => {
    const write = process.argv.includes("--write");

    console.log(`Querying OpenStreetMap within ${RADIUS_M}m of ${CAMPUS.shortName}...`);
    const elements = await fetchFromOverpass();
    console.log(`  Overpass returned ${elements.length} elements`);

    if (!process.env.ATLASDB_URL) {
        console.error("Missing ATLASDB_URL");
        process.exit(1);
    }
    await mongoose.connect(process.env.ATLASDB_URL);

    let owner = await User.findOne({ isAdmin: true }) || await User.findOne();
    if (!owner) {
        console.error("No user in the database. Run `npm run seed` first.");
        process.exit(1);
    }

    const candidates = elements
        .map((el) => toListing(el, owner._id))
        .filter(Boolean);

    // Same place can appear twice in OSM (a node and an enclosing way).
    const byName = new Map();
    for (const c of candidates) {
        const key = `${c.title.toLowerCase()}|${c.category}`;
        const existing = byName.get(key);
        if (!existing || (c.distanceFromCampus ?? 1e9) < (existing.distanceFromCampus ?? 1e9)) {
            byName.set(key, c);
        }
    }
    const unique = [...byName.values()].sort(
        (a, b) => (a.distanceFromCampus ?? 1e9) - (b.distanceFromCampus ?? 1e9)
    );

    const counts = {};
    for (const c of unique) counts[c.category] = (counts[c.category] || 0) + 1;

    console.log(`\n  usable after filtering + dedupe: ${unique.length}`);
    console.log("  by category:");
    for (const [cat, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${cat.padEnd(20)} ${n}`);
    }
    console.log("\n  kept (nearest first) - with what corroborates each:");
    for (const c of unique) {
        console.log(
            `    ${formatDistance(c.distanceFromCampus).padStart(7)}  [${c.category.padEnd(18)}] ` +
            `${c.title.slice(0, 42).padEnd(42)} ${c._signals.join(",")}`
        );
    }

    if (!write) {
        console.log("\nDry run. Re-run with --write to import.");
        await mongoose.disconnect();
        return;
    }

    const keepIds = unique.map((d) => d.osmId);

    // Drop previously imported entries that no longer meet the bar. Verified
    // entries and anything a student has taken over are never touched.
    const pruned = await Listing.deleteMany({
        source: "osm",
        verified: false,
        osmId: { $nin: keepIds },
    });

    let inserted = 0;
    let updated = 0;
    for (const doc of unique) {
        delete doc._signals; // reporting only, not part of the schema

        const existing = await Listing.findOne({ osmId: doc.osmId });
        if (existing) {
            // Never clobber details a student has corrected.
            if (existing.source === "osm" && !existing.verified) {
                await Listing.findByIdAndUpdate(existing._id, doc);
                updated++;
            }
        } else {
            await Listing.create(doc);
            inserted++;
        }
    }

    console.log(`\nImported: ${inserted} new, ${updated} refreshed, ${pruned.deletedCount} pruned.`);
    await mongoose.disconnect();
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
