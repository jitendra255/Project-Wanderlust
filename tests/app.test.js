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
    test("renders every seeded listing", async () => {
        const res = await request(app).get("/listings");
        expect(res.status).toBe(200);
        expect(cardCount(res.text)).toBe(29);
    });

    test("renders a link for all 11 category tiles", async () => {
        const res = await request(app).get("/listings");
        const links = res.text.match(/href="\/listings\/filter\?category=/g) || [];
        expect(links).toHaveLength(11);
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
        const res = await request(app)
            .get("/listings/filter")
            .query({ category });
        expect(res.status).toBe(200);
        expect(cardCount(res.text)).toBe(count);
    });

    test("category counts sum to the full catalogue", () => {
        const total = Object.values(expected).reduce((a, b) => a + b, 0);
        expect(total).toBe(29);
    });

    test("shows the active-filter banner", async () => {
        const res = await request(app).get("/listings/filter").query({ category: "Castles" });
        expect(res.text).toContain("Showing category:");
        expect(res.text).toContain("Historic Castle in Scotland");
    });

    test("a category with no matches shows the empty state", async () => {
        const res = await request(app).get("/listings/filter").query({ category: "Nonexistent" });
        expect(res.status).toBe(200);
        expect(cardCount(res.text)).toBe(0);
        expect(res.text).toContain("No listings found in this category yet.");
    });

    test("missing category redirects back to /listings", async () => {
        const res = await request(app).get("/listings/filter");
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/listings");
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

describe("error handling", () => {
    test("unknown routes render the 404 page", async () => {
        const res = await request(app).get("/no-such-page");
        expect(res.status).toBe(404);
    });
});
