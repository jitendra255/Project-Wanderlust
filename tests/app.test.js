const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;
let app;
let Listing;
let User;
let castleId;

// Number of listing cards rendered on an index page.
const cardCount = (html) => (html.match(/listing-card/g) || []).length;

// Ids of the listings linked from an index page.
const listingIds = (html) =>
    [...html.matchAll(/href="\/listings\/([a-f0-9]{24})"/g)].map((m) => m[1]);

const PAGE_SIZE = 9;
const TOTAL = 29;
const LAST_PAGE = Math.ceil(TOTAL / PAGE_SIZE); // 4

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    // Must be set before app.js is required - it reads them at module load.
    process.env.NODE_ENV = "test";
    process.env.ATLASDB_URL = mongod.getUri("wanderlust_test");
    process.env.SECRET = "test-only-secret";

    app = require("../app.js");
    Listing = require("../Models/listing.js");
    User = require("../Models/user.js");

    await mongoose.connection.asPromise();

    const owner = await User.register(
        new User({ email: "tester@example.com", username: "tester" }),
        "testpass123"
    );
    const { data } = require("../init/data.js");
    await Listing.insertMany(data.map((o) => ({ ...o, owner: owner._id })));

    castleId = (await Listing.findOne({ category: "Castles" }))._id.toString();
}, 120000);

afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
});

describe("listings index", () => {
    test("renders the first page of listings", async () => {
        const res = await request(app).get("/listings");
        expect(res.status).toBe(200);
        expect(cardCount(res.text)).toBe(PAGE_SIZE);
        expect(res.text).toContain(`Page 1 of ${LAST_PAGE}`);
    });

    test("renders a link for all 11 category tiles", async () => {
        const res = await request(app).get("/listings");
        const links = res.text.match(/href="\/listings\?category=/g) || [];
        expect(links).toHaveLength(11);
    });
});

describe("pagination", () => {
    test("a middle page returns a full slice", async () => {
        const res = await request(app).get("/listings").query({ page: 2 });
        expect(cardCount(res.text)).toBe(PAGE_SIZE);
        expect(res.text).toContain(`Page 2 of ${LAST_PAGE}`);
    });

    test("the last page returns the remainder", async () => {
        const res = await request(app).get("/listings").query({ page: LAST_PAGE });
        expect(cardCount(res.text)).toBe(TOTAL - PAGE_SIZE * (LAST_PAGE - 1));
        expect(res.text).toContain(`Page ${LAST_PAGE} of ${LAST_PAGE}`);
    });

    test("pages neither overlap nor drop a listing", async () => {
        const seen = new Set();
        for (let page = 1; page <= LAST_PAGE; page++) {
            const res = await request(app).get("/listings").query({ page });
            listingIds(res.text).forEach((id) => seen.add(id));
        }
        expect(seen.size).toBe(TOTAL);
    });

    test("an out-of-range page clamps to the last page", async () => {
        const res = await request(app).get("/listings").query({ page: 999 });
        expect(res.status).toBe(200);
        expect(res.text).toContain(`Page ${LAST_PAGE} of ${LAST_PAGE}`);
    });

    test("a non-numeric page falls back to the first", async () => {
        const res = await request(app).get("/listings").query({ page: "abc" });
        expect(res.status).toBe(200);
        expect(res.text).toContain(`Page 1 of ${LAST_PAGE}`);
    });

    test("no pager is rendered when results fit on one page", async () => {
        const res = await request(app).get("/listings").query({ category: "Castles" });
        expect(res.text).not.toContain("Page 1 of");
    });
});

describe("category filter", () => {
    // Every category must be reachable AND return results - the bug this suite guards.
    const expected = {
        Trending: 3,
        Rooms: 3,
        "Mountain Cities": 2,
        "Iconic Cities": 5,
        Castles: 1,
        Pools: 3,
        Camping: 5,
        Farms: 2,
        Arctic: 2,
        Domes: 1,
        Boats: 2,
    };

    test.each(Object.entries(expected))("%s returns %i listing(s)", async (category, count) => {
        const res = await request(app).get("/listings").query({ category });
        expect(res.status).toBe(200);
        expect(cardCount(res.text)).toBe(count);
    });

    test("category counts sum to the full catalogue", () => {
        const total = Object.values(expected).reduce((a, b) => a + b, 0);
        expect(total).toBe(TOTAL);
    });

    test("shows the active-filter banner", async () => {
        const res = await request(app).get("/listings").query({ category: "Castles" });
        expect(res.text).toContain("Showing category:");
        expect(res.text).toContain("Historic Castle in Scotland");
    });

    test("a category with no matches shows the empty state", async () => {
        const res = await request(app).get("/listings").query({ category: "Nonexistent" });
        expect(res.status).toBe(200);
        expect(cardCount(res.text)).toBe(0);
        expect(res.text).toContain("No listings found");
    });

    test("the legacy /listings/filter route still works", async () => {
        const res = await request(app).get("/listings/filter").query({ category: "Castles" });
        expect(res.status).toBe(200);
        expect(cardCount(res.text)).toBe(1);
        expect(res.text).toContain("Historic Castle in Scotland");
    });

    test("missing category redirects back to /listings", async () => {
        const res = await request(app).get("/listings/filter");
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/listings");
    });
});

describe("search and filter compose", () => {
    test("category + location narrows to the intersection", async () => {
        const res = await request(app).get("/listings").query({ category: "Pools", location: "Bali" });
        expect(res.status).toBe(200);
        expect(cardCount(res.text)).toBe(1);
        expect(res.text).toContain("Beachfront Bungalow in Bali");
    });

    test("category + country narrows to the intersection", async () => {
        const res = await request(app).get("/listings").query({ category: "Camping", location: "United States" });
        expect(res.status).toBe(200);
        expect(cardCount(res.text)).toBe(4);
    });

    test("a combination with no overlap yields nothing", async () => {
        const res = await request(app).get("/listings").query({ category: "Castles", location: "Bali" });
        expect(res.status).toBe(200);
        expect(cardCount(res.text)).toBe(0);
        expect(res.text).toContain("No listings found");
    });

    test("the banner reflects both filters at once", async () => {
        const res = await request(app).get("/listings").query({ category: "Pools", location: "Bali" });
        expect(res.text).toContain("Showing category:");
        expect(res.text).toContain("Pools");
        expect(res.text).toContain("Bali");
    });

    test("the legacy search route still composes with a category", async () => {
        const res = await request(app)
            .get("/listings/search")
            .query({ location: "United States", category: "Camping" });
        expect(res.status).toBe(200);
        expect(cardCount(res.text)).toBe(4);
    });
});

describe("search", () => {
    test("matches on location", async () => {
        const res = await request(app).get("/listings/search").query({ location: "Malibu" });
        expect(res.status).toBe(200);
        expect(res.text).toContain("Cozy Beachfront Cottage");
    });

    test("matches on country, case-insensitively", async () => {
        const res = await request(app).get("/listings/search").query({ location: "italy" });
        expect(res.status).toBe(200);
        expect(res.text).toContain("Historic Villa in Tuscany");
    });

    test("missing location redirects back to /listings", async () => {
        const res = await request(app).get("/listings/search");
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/listings");
    });
});

describe("listing detail", () => {
    test("renders an existing listing", async () => {
        const res = await request(app).get(`/listings/${castleId}`);
        expect(res.status).toBe(200);
        expect(res.text).toContain("Historic Castle in Scotland");
    });

    test("redirects for a well-formed id that does not exist", async () => {
        const ghost = new mongoose.Types.ObjectId().toString();
        const res = await request(app).get(`/listings/${ghost}`);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/listings");
    });
});

describe("auth guards", () => {
    test.each([
        ["GET", "/listings/new"],
        ["POST", "/listings"],
    ])("%s %s redirects anonymous users to /login", async (method, path) => {
        const res = await request(app)[method.toLowerCase()](path);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/login");
    });

    test("posting a review anonymously redirects to /login", async () => {
        const res = await request(app)
            .post(`/listings/${castleId}/reviews`)
            .type("form")
            .send({ "review[rating]": 5, "review[comment]": "nice" });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/login");
    });
});

describe("accounts", () => {
    test("signup creates a user and logs them in", async () => {
        const res = await request(app)
            .post("/signup")
            .type("form")
            .send({ username: "newcomer", email: "newcomer@example.com", password: "hunter2hunter2" });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/listings");
        expect(await User.findOne({ username: "newcomer" })).not.toBeNull();
    });

    test("duplicate signup is rejected back to /signup", async () => {
        const res = await request(app)
            .post("/signup")
            .type("form")
            .send({ username: "tester", email: "tester@example.com", password: "testpass123" });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/signup");
    });

    test("login with correct credentials succeeds", async () => {
        const res = await request(app)
            .post("/login")
            .type("form")
            .send({ username: "tester", password: "testpass123" });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/listings");
    });

    test("login with a bad password bounces to /login", async () => {
        const res = await request(app)
            .post("/login")
            .type("form")
            .send({ username: "tester", password: "wrong-password" });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/login");
    });
});

describe("listing map", () => {
    test("every seeded listing carries a valid GeoJSON point", async () => {
        const all = await Listing.find({});
        expect(all).toHaveLength(TOTAL);
        for (const listing of all) {
            expect(listing.geometry.type).toBe("Point");
            const [lng, lat] = listing.geometry.coordinates;
            expect(lng).toBeGreaterThanOrEqual(-180);
            expect(lng).toBeLessThanOrEqual(180);
            expect(lat).toBeGreaterThanOrEqual(-90);
            expect(lat).toBeLessThanOrEqual(90);
        }
    });

    test("the show page renders a map container with coordinates", async () => {
        const res = await request(app).get(`/listings/${castleId}`);
        expect(res.status).toBe(200);
        expect(res.text).toContain('id="listing-map"');
        expect(res.text).toContain("Where you'll be");
        // Scottish Highlands
        expect(res.text).toContain('data-lat="57.4778"');
        expect(res.text).toContain('data-lng="-4.2026"');
    });

    test("a listing without coordinates renders no map", async () => {
        const owner = await User.findOne({ username: "tester" });
        const mapless = await Listing.create({
            title: "Listing With No Coordinates",
            description: "No geometry on purpose",
            image: { url: "https://example.com/x.jpg", filename: "x" },
            price: 100,
            location: "Nowhere",
            country: "Nowhereland",
            owner: owner._id,
        });

        const res = await request(app).get(`/listings/${mapless._id}`);
        expect(res.status).toBe(200);
        expect(res.text).toContain("Listing With No Coordinates");
        expect(res.text).not.toContain('id="listing-map"');

        await Listing.findByIdAndDelete(mapless._id);
    });
});

describe("profile page", () => {
    const loginAs = async (username, password) => {
        const agent = request.agent(app);
        await agent.post("/login").type("form").send({ username, password });
        return agent;
    };

    test("redirects anonymous users to /login", async () => {
        const res = await request(app).get("/profile");
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/login");
    });

    test("lists the listings the user owns", async () => {
        const agent = await loginAs("tester", "testpass123");
        const res = await agent.get("/profile");

        expect(res.status).toBe(200);
        expect(res.text).toContain("tester@example.com");
        // The seed makes tester the owner of every listing.
        expect(res.text).toContain("Historic Castle in Scotland");
    });

    test("shows a review the user wrote, linked back to its listing", async () => {
        const agent = await loginAs("tester", "testpass123");

        await agent
            .post(`/listings/${castleId}/reviews`)
            .type("form")
            .send({ "review[rating]": 4, "review[comment]": "Draughty but magnificent" });

        const res = await agent.get("/profile");
        expect(res.text).toContain("Draughty but magnificent");
        expect(res.text).toContain(`/listings/${castleId}`);
    });

    test("a brand new user sees both empty states", async () => {
        const agent = request.agent(app);
        await agent.post("/signup").type("form").send({
            username: "emptyuser",
            email: "empty@example.com",
            password: "emptypass123",
        });

        const res = await agent.get("/profile");
        expect(res.status).toBe(200);
        expect(res.text).toContain("You haven't published any listings yet.");
        expect(res.text).toContain("You haven't reviewed any stays yet.");
    });
});

describe("bookings", () => {
    const Booking = require("../Models/booking.js");

    // Dates relative to today so the suite never rots.
    const dayOffset = (n) => {
        const now = new Date();
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        d.setUTCDate(d.getUTCDate() + n);
        return d.toISOString().slice(0, 10);
    };

    let guestAgent;
    let bookableId;

    beforeAll(async () => {
        // tester owns every seeded listing, so bookings need a different user.
        guestAgent = request.agent(app);
        await guestAgent.post("/signup").type("form").send({
            username: "traveller",
            email: "traveller@example.com",
            password: "travelpass123",
        });
        bookableId = (await Listing.findOne({ category: "Domes" }))._id.toString();
    });

    beforeEach(async () => {
        await Booking.deleteMany({ listing: bookableId });
    });

    const book = (agent, checkIn, checkOut, guests = 1) =>
        agent
            .post(`/listings/${bookableId}/bookings`)
            .type("form")
            .send({ "booking[checkIn]": checkIn, "booking[checkOut]": checkOut, "booking[guests]": guests });

    test("anonymous users are sent to /login", async () => {
        const res = await book(request(app), dayOffset(1), dayOffset(3));
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/login");
    });

    test("a valid booking is confirmed and priced by nights", async () => {
        const res = await book(guestAgent, dayOffset(1), dayOffset(4));
        expect(res.status).toBe(302);

        const booking = await Booking.findOne({ listing: bookableId });
        expect(booking).not.toBeNull();
        expect(booking.status).toBe("confirmed");

        const listing = await Listing.findById(bookableId);
        expect(booking.totalPrice).toBe(listing.price * 3); // 3 nights
    });

    test("an owner cannot book their own listing", async () => {
        const owner = request.agent(app);
        await owner.post("/login").type("form").send({ username: "tester", password: "testpass123" });

        await book(owner, dayOffset(1), dayOffset(3));
        expect(await Booking.countDocuments({ listing: bookableId })).toBe(0);
    });

    test("check-out must be after check-in", async () => {
        await book(guestAgent, dayOffset(5), dayOffset(5));
        await book(guestAgent, dayOffset(6), dayOffset(4));
        expect(await Booking.countDocuments({ listing: bookableId })).toBe(0);
    });

    test("check-in cannot be in the past", async () => {
        await book(guestAgent, dayOffset(-3), dayOffset(2));
        expect(await Booking.countDocuments({ listing: bookableId })).toBe(0);
    });

    test("malformed dates are rejected", async () => {
        await book(guestAgent, "not-a-date", dayOffset(3));
        expect(await Booking.countDocuments({ listing: bookableId })).toBe(0);
    });

    describe("overlap detection", () => {
        // An existing stay occupying days 10 -> 15.
        beforeEach(async () => {
            await book(guestAgent, dayOffset(10), dayOffset(15));
        });

        test.each([
            ["identical range", 10, 15],
            ["fully inside", 11, 14],
            ["straddling the start", 8, 12],
            ["straddling the end", 13, 18],
            ["fully containing", 5, 20],
        ])("rejects a booking %s", async (_label, from, to) => {
            await book(guestAgent, dayOffset(from), dayOffset(to));
            expect(await Booking.countDocuments({ listing: bookableId })).toBe(1);
        });

        test("allows a stay that starts exactly on the previous checkout day", async () => {
            await book(guestAgent, dayOffset(15), dayOffset(18));
            expect(await Booking.countDocuments({ listing: bookableId })).toBe(2);
        });

        test("allows a stay that ends exactly on the existing check-in day", async () => {
            await book(guestAgent, dayOffset(7), dayOffset(10));
            expect(await Booking.countDocuments({ listing: bookableId })).toBe(2);
        });

        test("cancelling frees the dates for someone else", async () => {
            const existing = await Booking.findOne({ listing: bookableId });

            const cancel = await guestAgent
                .post(`/listings/${bookableId}/bookings/${existing._id}?_method=Delete`)
                .send();
            expect(cancel.status).toBe(302);
            expect((await Booking.findById(existing._id)).status).toBe("cancelled");

            await book(guestAgent, dayOffset(10), dayOffset(15));
            expect(await Booking.countDocuments({ listing: bookableId, status: "confirmed" })).toBe(1);
        });
    });

    test("a guest cannot cancel someone else's booking", async () => {
        await book(guestAgent, dayOffset(20), dayOffset(22));
        const booking = await Booking.findOne({ listing: bookableId });

        const intruder = request.agent(app);
        await intruder.post("/signup").type("form").send({
            username: "intruder",
            email: "intruder@example.com",
            password: "intruderpass123",
        });

        await intruder.post(`/listings/${bookableId}/bookings/${booking._id}?_method=Delete`).send();
        expect((await Booking.findById(booking._id)).status).toBe("confirmed");
    });

    test("the listing page shows already-booked ranges", async () => {
        await book(guestAgent, dayOffset(30), dayOffset(33));
        const res = await request(app).get(`/listings/${bookableId}`);
        expect(res.text).toContain("Already booked:");
        expect(res.text).toContain(dayOffset(30));
    });

    test("the trip appears on the guest's profile", async () => {
        await book(guestAgent, dayOffset(40), dayOffset(42));
        const res = await guestAgent.get("/profile");
        expect(res.text).toContain("My trips");
        expect(res.text).toContain("Upcoming");
    });

    test("the owner sees incoming bookings on their listings", async () => {
        await book(guestAgent, dayOffset(50), dayOffset(52));

        const owner = request.agent(app);
        await owner.post("/login").type("form").send({ username: "tester", password: "testpass123" });
        const res = await owner.get("/profile");

        expect(res.text).toContain("Bookings on my listings");
        expect(res.text).toContain("@traveller");
    });
});

describe("error handling", () => {
    test("unknown routes render the 404 page", async () => {
        const res = await request(app).get("/no-such-page");
        expect(res.status).toBe(404);
    });
});
