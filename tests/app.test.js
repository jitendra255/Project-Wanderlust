const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { distanceFromCampus } = require("../utils/campus.js");

let mongod;
let app;
let Listing;
let User;
let Review;
let Enquiry;

// Number of place cards rendered on an index page.
const cardCount = (html) => (html.match(/listing-card/g) || []).length;

const PAGE_SIZE = 9;

// Fixtures live near campus so distances are realistic. [lng, lat].
const NEAR_CAMPUS = [73.0348015, 26.2708162];
const A_KM_AWAY = [73.0448015, 26.2758162];

// Everything the app needs to consider a place publishable.
const place = (overrides = {}) => ({
    title: "Test Place",
    description: "A place used in tests.",
    category: "Mess & Tiffin",
    location: "Ratanada",
    country: "India",
    geometry: { type: "Point", coordinates: NEAR_CAMPUS },
    source: "student",
    status: "approved",
    verified: true,
    ...overrides,
});

const login = async (username, password) => {
    const agent = request.agent(app);
    await agent.post("/login").type("form").send({ username, password });
    return agent;
};

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    // Must be set before app.js is required - it reads them at module load.
    process.env.NODE_ENV = "test";
    process.env.ATLASDB_URL = mongod.getUri("campus_test");
    process.env.SECRET = "test-only-secret";

    app = require("../app.js");
    Listing = require("../Models/listing.js");
    User = require("../Models/user.js");
    Review = require("../Models/review.js");
    Enquiry = require("../Models/enquiry.js");

    await mongoose.connection.asPromise();
}, 120000);

afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
});

// A clean slate per test keeps ordering assumptions out of the suite.
beforeEach(async () => {
    await Promise.all([
        Listing.deleteMany({}),
        Review.deleteMany({}),
        Enquiry.deleteMany({}),
        User.deleteMany({}),
    ]);
});

const makeUser = (username, { admin = false } = {}) =>
    User.register(new User({ email: `${username}@mbm.ac.in`, username, isAdmin: admin }), "testpass123");

describe("campus distance", () => {
    test("is measured from the campus, not stored blindly", () => {
        expect(distanceFromCampus(NEAR_CAMPUS)).toBe(0);
        expect(distanceFromCampus(A_KM_AWAY)).toBeGreaterThan(500);
        expect(distanceFromCampus(A_KM_AWAY)).toBeLessThan(2000);
    });

    test("is null when a place has no coordinates", () => {
        expect(distanceFromCampus(undefined)).toBeNull();
        expect(distanceFromCampus([1])).toBeNull();
    });

    test("is recomputed on save so it cannot drift from the coordinates", async () => {
        const owner = await makeUser("owner");
        const doc = await Listing.create(place({ owner: owner._id }));
        expect(doc.distanceFromCampus).toBe(0);

        doc.geometry = { type: "Point", coordinates: A_KM_AWAY };
        await doc.save();
        expect(doc.distanceFromCampus).toBeGreaterThan(500);
    });
});

describe("directory listing", () => {
    test("shows approved places", async () => {
        const owner = await makeUser("owner");
        await Listing.create(place({ title: "Sharma Mess", owner: owner._id }));

        const res = await request(app).get("/listings");
        expect(res.status).toBe(200);
        expect(res.text).toContain("Sharma Mess");
        expect(cardCount(res.text)).toBe(1);
    });

    test("hides pending and rejected submissions", async () => {
        const owner = await makeUser("owner");
        await Listing.create(place({ title: "Approved Place", owner: owner._id }));
        await Listing.create(place({ title: "Pending Place", status: "pending", owner: owner._id }));
        await Listing.create(place({ title: "Rejected Place", status: "rejected", owner: owner._id }));

        const res = await request(app).get("/listings");
        expect(res.text).toContain("Approved Place");
        expect(res.text).not.toContain("Pending Place");
        expect(res.text).not.toContain("Rejected Place");
        expect(cardCount(res.text)).toBe(1);
    });

    test("orders by distance from campus by default", async () => {
        const owner = await makeUser("owner");
        await Listing.create(place({ title: "Far Place", geometry: { type: "Point", coordinates: A_KM_AWAY }, owner: owner._id }));
        await Listing.create(place({ title: "Near Place", owner: owner._id }));

        const res = await request(app).get("/listings");
        expect(res.text.indexOf("Near Place")).toBeLessThan(res.text.indexOf("Far Place"));
    });

    test("renders a tile for every category", async () => {
        const { CATEGORY_LABELS } = require("../utils/categories.js");
        const res = await request(app).get("/listings");
        const links = res.text.match(/href="\/listings\?category=/g) || [];
        expect(links).toHaveLength(CATEGORY_LABELS.length);
    });

    test("survives a place with no price and no photo", async () => {
        const owner = await makeUser("owner");
        // Exactly the shape of an OSM import - this combination used to 500.
        await Listing.create(place({
            title: "No Price No Photo",
            price: undefined,
            image: { url: "", filename: "" },
            source: "osm",
            verified: false,
            owner: owner._id,
        }));

        const res = await request(app).get("/listings");
        expect(res.status).toBe(200);
        expect(res.text).toContain("Price not listed yet");
    });
});

describe("filters", () => {
    beforeEach(async () => {
        const owner = await makeUser("owner");
        await Listing.create(place({ title: "Veg Mess", category: "Mess & Tiffin", vegOnly: true, owner: owner._id }));
        await Listing.create(place({ title: "Mixed Restaurant", category: "Restaurant", vegOnly: false, owner: owner._id }));
        await Listing.create(place({ title: "Boys Hostel", category: "Hostel", gender: "Boys", owner: owner._id }));
    });

    test("filters by category", async () => {
        const res = await request(app).get("/listings").query({ category: "Hostel" });
        expect(cardCount(res.text)).toBe(1);
        expect(res.text).toContain("Boys Hostel");
    });

    test("filters to pure veg only", async () => {
        const res = await request(app).get("/listings").query({ veg: "1" });
        expect(cardCount(res.text)).toBe(1);
        expect(res.text).toContain("Veg Mess");
    });

    test("search matches the name", async () => {
        const res = await request(app).get("/listings").query({ location: "Boys" });
        expect(res.text).toContain("Boys Hostel");
        expect(cardCount(res.text)).toBe(1);
    });

    test("category and search compose", async () => {
        const res = await request(app).get("/listings")
            .query({ category: "Mess & Tiffin", location: "Ratanada" });
        expect(cardCount(res.text)).toBe(1);
        expect(res.text).toContain("Veg Mess");
    });

    test("a category with nothing in it shows the empty state", async () => {
        const res = await request(app).get("/listings").query({ category: "Laundry" });
        expect(res.status).toBe(200);
        expect(cardCount(res.text)).toBe(0);
        expect(res.text).toContain("No listings found");
    });

    test("the legacy /listings/filter route still works", async () => {
        const res = await request(app).get("/listings/filter").query({ category: "Hostel" });
        expect(res.status).toBe(200);
        expect(res.text).toContain("Boys Hostel");
    });
});

describe("pagination", () => {
    beforeEach(async () => {
        const owner = await makeUser("owner");
        await Listing.insertMany(
            Array.from({ length: PAGE_SIZE + 3 }, (_, i) =>
                place({ title: `Place ${String(i).padStart(2, "0")}`, owner: owner._id })
            )
        );
    });

    test("fills the first page", async () => {
        const res = await request(app).get("/listings");
        expect(cardCount(res.text)).toBe(PAGE_SIZE);
        expect(res.text).toContain("Page 1 of 2");
    });

    test("the last page holds the remainder", async () => {
        const res = await request(app).get("/listings").query({ page: 2 });
        expect(cardCount(res.text)).toBe(3);
    });

    test("an out-of-range page clamps instead of rendering empty", async () => {
        const res = await request(app).get("/listings").query({ page: 999 });
        expect(res.status).toBe(200);
        expect(cardCount(res.text)).toBe(3);
    });
});

describe("place detail", () => {
    test("renders a place with its distance and contact", async () => {
        const owner = await makeUser("owner");
        const doc = await Listing.create(place({
            title: "Gupta Tiffin",
            phone: "9000000000",
            whatsapp: "9000000000",
            timings: "7am-10pm",
            price: 2400,
            priceUnit: "per month",
            owner: owner._id,
        }));

        const res = await request(app).get(`/listings/${doc._id}`);
        expect(res.status).toBe(200);
        expect(res.text).toContain("Gupta Tiffin");
        expect(res.text).toContain("from MBM");
        expect(res.text).toContain("2,400");
        expect(res.text).toContain("7am-10pm");
        expect(res.text).toContain("wa.me/919000000000"); // 10-digit gets +91
        expect(res.text).toContain('id="listing-map"');
    });

    test("an unverified import is labelled as such", async () => {
        const owner = await makeUser("owner");
        const doc = await Listing.create(place({
            title: "Imported Place", source: "osm", verified: false, owner: owner._id,
        }));

        const res = await request(app).get(`/listings/${doc._id}`);
        expect(res.text).toContain("Unverified");
        expect(res.text).toContain("Imported from OpenStreetMap");
    });

    test("a place without coordinates renders without a map", async () => {
        const owner = await makeUser("owner");
        const doc = await Listing.create(place({
            title: "Mapless", geometry: undefined, owner: owner._id,
        }));

        const res = await request(app).get(`/listings/${doc._id}`);
        expect(res.status).toBe(200);
        expect(res.text).not.toContain('id="listing-map"');
    });

    test("redirects for an id that does not exist", async () => {
        const ghost = new mongoose.Types.ObjectId().toString();
        const res = await request(app).get(`/listings/${ghost}`);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/listings");
    });
});

describe("submitting a place", () => {
    const submission = {
        "listing[title]": "New Mess",
        "listing[category]": "Mess & Tiffin",
        "listing[description]": "Somewhere to eat near campus.",
        "listing[location]": "Ratanada",
        "listing[price]": "2200",
        "listing[priceUnit]": "per month",
        "listing[vegOnly]": "on",
        "listing[amenities]": "unlimited roti, tiffin delivery",
    };

    test("anonymous users are sent to /login", async () => {
        const res = await request(app).post("/listings").type("form").send(submission);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/login");
    });

    test("a student submission lands pending and stays private", async () => {
        await makeUser("student");
        const agent = await login("student", "testpass123");

        await agent.post("/listings").type("form").send(submission);

        const doc = await Listing.findOne({ title: "New Mess" });
        expect(doc).not.toBeNull();
        expect(doc.status).toBe("pending");
        expect(doc.source).toBe("student");
        expect(doc.verified).toBe(false);

        const res = await request(app).get("/listings");
        expect(res.text).not.toContain("New Mess");
    });

    test("an admin submission is published straight away", async () => {
        await makeUser("boss", { admin: true });
        const agent = await login("boss", "testpass123");

        await agent.post("/listings").type("form").send(submission);

        const doc = await Listing.findOne({ title: "New Mess" });
        expect(doc.status).toBe("approved");
        expect(doc.verified).toBe(true);
    });

    test("checkbox and comma-separated facilities are normalised", async () => {
        await makeUser("student");
        const agent = await login("student", "testpass123");

        await agent.post("/listings").type("form").send(submission);

        const doc = await Listing.findOne({ title: "New Mess" });
        expect(doc.vegOnly).toBe(true);
        expect(doc.amenities).toEqual(["unlimited roti", "tiffin delivery"]);
        expect(doc.price).toBe(2200);
    });

    test("empty number fields do not become NaN", async () => {
        await makeUser("student");
        const agent = await login("student", "testpass123");

        await agent.post("/listings").type("form")
            .send({ ...submission, "listing[price]": "", "listing[deposit]": "" });

        const doc = await Listing.findOne({ title: "New Mess" });
        expect(doc.price).toBeUndefined();
        expect(doc.deposit).toBeUndefined();
    });

    test("an unknown category is rejected", async () => {
        await makeUser("student");
        const agent = await login("student", "testpass123");

        const res = await agent.post("/listings").type("form")
            .send({ ...submission, "listing[category]": "Nightclub" });

        expect(res.status).toBe(400);
        expect(await Listing.countDocuments()).toBe(0);
    });
});

describe("moderation", () => {
    let pendingId;

    beforeEach(async () => {
        const student = await makeUser("student");
        await makeUser("boss", { admin: true });
        const doc = await Listing.create(place({
            title: "Pending Place", status: "pending", verified: false, owner: student._id,
        }));
        pendingId = doc._id.toString();
    });

    test("the queue is closed to anonymous users", async () => {
        const res = await request(app).get("/admin/queue");
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/login");
    });

    test("the queue is closed to ordinary students", async () => {
        const agent = await login("student", "testpass123");
        const res = await agent.get("/admin/queue");
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/listings");
    });

    test("an admin sees what is waiting", async () => {
        const agent = await login("boss", "testpass123");
        const res = await agent.get("/admin/queue");
        expect(res.status).toBe(200);
        expect(res.text).toContain("Pending Place");
        expect(res.text).toContain("awaiting review");
    });

    test("approving publishes and marks it verified", async () => {
        const agent = await login("boss", "testpass123");
        await agent.post(`/admin/listings/${pendingId}/approve`);

        const doc = await Listing.findById(pendingId);
        expect(doc.status).toBe("approved");
        expect(doc.verified).toBe(true);
        expect(doc.verifiedAt).toBeInstanceOf(Date);

        const res = await request(app).get("/listings");
        expect(res.text).toContain("Pending Place");
    });

    test("rejecting keeps the record but never publishes it", async () => {
        const agent = await login("boss", "testpass123");
        await agent.post(`/admin/listings/${pendingId}/reject`);

        const doc = await Listing.findById(pendingId);
        expect(doc).not.toBeNull();
        expect(doc.status).toBe("rejected");

        const res = await request(app).get("/listings");
        expect(res.text).not.toContain("Pending Place");
    });

    test("a student cannot approve their own submission", async () => {
        const agent = await login("student", "testpass123");
        await agent.post(`/admin/listings/${pendingId}/approve`);

        const doc = await Listing.findById(pendingId);
        expect(doc.status).toBe("pending");
    });
});

describe("enquiries", () => {
    let listingId;

    beforeEach(async () => {
        const senior = await makeUser("senior");
        await makeUser("junior");
        const doc = await Listing.create(place({
            title: "Senior's PG", category: "PG", source: "student", owner: senior._id,
        }));
        listingId = doc._id.toString();
    });

    test("anonymous users are sent to /login", async () => {
        const res = await request(app).post(`/listings/${listingId}/enquiries`)
            .type("form").send({ "enquiry[message]": "How is the wifi there?" });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/login");
    });

    test("a question reaches the person who added the place", async () => {
        const agent = await login("junior", "testpass123");
        await agent.post(`/listings/${listingId}/enquiries`)
            .type("form").send({ "enquiry[message]": "How is the wifi there?" });

        const enquiry = await Enquiry.findOne().populate("from").populate("to");
        expect(enquiry).not.toBeNull();
        expect(enquiry.from.username).toBe("junior");
        expect(enquiry.to.username).toBe("senior");
        expect(enquiry.reply).toBeUndefined();
    });

    test("you cannot ask about a place you added yourself", async () => {
        const agent = await login("senior", "testpass123");
        await agent.post(`/listings/${listingId}/enquiries`)
            .type("form").send({ "enquiry[message]": "Talking to myself here" });

        expect(await Enquiry.countDocuments()).toBe(0);
    });

    test("a too-short question is rejected", async () => {
        const agent = await login("junior", "testpass123");
        await agent.post(`/listings/${listingId}/enquiries`)
            .type("form").send({ "enquiry[message]": "hi" });

        expect(await Enquiry.countDocuments()).toBe(0);
    });

    test("the recipient can reply, and both sides see it", async () => {
        const junior = await login("junior", "testpass123");
        await junior.post(`/listings/${listingId}/enquiries`)
            .type("form").send({ "enquiry[message]": "How is the water supply?" });

        const enquiry = await Enquiry.findOne();
        const senior = await login("senior", "testpass123");
        await senior.post(`/listings/${listingId}/enquiries/${enquiry._id}/reply`)
            .type("form").send({ "enquiry[reply]": "Water is fine, 24 hours." });

        const updated = await Enquiry.findById(enquiry._id);
        expect(updated.reply).toBe("Water is fine, 24 hours.");
        expect(updated.repliedAt).toBeInstanceOf(Date);

        const seniorProfile = await senior.get("/profile");
        expect(seniorProfile.text).toContain("Water is fine");

        const juniorProfile = await junior.get("/profile");
        expect(juniorProfile.text).toContain("Water is fine");
    });

    test("only the recipient can reply", async () => {
        const junior = await login("junior", "testpass123");
        await junior.post(`/listings/${listingId}/enquiries`)
            .type("form").send({ "enquiry[message]": "How is the water supply?" });

        const enquiry = await Enquiry.findOne();
        await junior.post(`/listings/${listingId}/enquiries/${enquiry._id}/reply`)
            .type("form").send({ "enquiry[reply]": "answering my own question" });

        const updated = await Enquiry.findById(enquiry._id);
        expect(updated.reply).toBeUndefined();
    });

    test("imported places offer no ask form - nobody is behind them", async () => {
        const owner = await makeUser("importer");
        const imported = await Listing.create(place({
            title: "Imported Cafe", source: "osm", verified: false, owner: owner._id,
        }));

        const res = await request(app).get(`/listings/${imported._id}`);
        expect(res.text).not.toContain("Ask about this place");
    });
});

describe("profile", () => {
    test("redirects anonymous users to /login", async () => {
        const res = await request(app).get("/profile");
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/login");
    });

    test("shows what the user added, including pending status", async () => {
        const student = await makeUser("student");
        await Listing.create(place({ title: "My Pending Mess", status: "pending", owner: student._id }));

        const agent = await login("student", "testpass123");
        const res = await agent.get("/profile");

        expect(res.status).toBe(200);
        expect(res.text).toContain("My Pending Mess");
        expect(res.text).toContain("Awaiting review");
    });

    test("a new user sees the empty states", async () => {
        await makeUser("fresher");
        const agent = await login("fresher", "testpass123");
        const res = await agent.get("/profile");

        expect(res.text).toContain("You haven't added any places yet.");
        expect(res.text).toContain("You haven't reviewed any place yet.");
    });
});

describe("reviews", () => {
    test("require login", async () => {
        const owner = await makeUser("owner");
        const doc = await Listing.create(place({ owner: owner._id }));

        const res = await request(app).post(`/listings/${doc._id}/reviews`)
            .type("form").send({ "review[rating]": 5, "review[comment]": "great" });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/login");
    });

    test("appear on the place once posted", async () => {
        const owner = await makeUser("owner");
        await makeUser("eater");
        const doc = await Listing.create(place({ owner: owner._id }));

        const agent = await login("eater", "testpass123");
        await agent.post(`/listings/${doc._id}/reviews`)
            .type("form").send({ "review[rating]": 4, "review[comment]": "Good thali, bit oily" });

        const res = await request(app).get(`/listings/${doc._id}`);
        expect(res.text).toContain("Good thali, bit oily");
        expect(res.text).toContain("@eater");
    });
});

describe("review widget", () => {
    test("renders five required stars, highest first", async () => {
        const owner = await makeUser("owner");
        await makeUser("eater");
        const doc = await Listing.create(place({ owner: owner._id }));

        const agent = await login("eater", "testpass123");
        const res = await agent.get(`/listings/${doc._id}`);

        const block = res.text.match(/<div class="star-input">[\s\S]*?<\/div>/)[0];
        const values = [...block.matchAll(/value="(\d)"/g)].map((m) => m[1]);

        // Reversed so `input:checked ~ label` can colour the stars to the left.
        expect(values).toEqual(["5", "4", "3", "2", "1"]);
        expect(block.match(/required/g)).toHaveLength(5);
        expect(block.match(/fa-star/g)).toHaveLength(5);
    });

    test("the old sprite widget is gone", async () => {
        const owner = await makeUser("owner");
        const doc = await Listing.create(place({ owner: owner._id }));
        const res = await request(app).get(`/listings/${doc._id}`);
        expect(res.text).not.toContain("starability");
    });

    test("an existing rating renders as filled and empty stars", async () => {
        const owner = await makeUser("owner");
        await makeUser("eater");
        const doc = await Listing.create(place({ owner: owner._id }));

        const agent = await login("eater", "testpass123");
        await agent.post(`/listings/${doc._id}/reviews`)
            .type("form").send({ "review[rating]": 3, "review[comment]": "Decent" });

        const res = await request(app).get(`/listings/${doc._id}`);
        const display = res.text.match(/<p class="star-display[\s\S]*?<\/p>/)[0];
        expect(display.match(/star-empty/g)).toHaveLength(2); // 3 of 5 filled
    });
});

describe("photo placeholder", () => {
    test("a place without a photo gets its category colour, not a broken image", async () => {
        const owner = await makeUser("owner");
        const doc = await Listing.create(place({
            category: "Gym", image: { url: "", filename: "" }, owner: owner._id,
        }));

        const { categoryMeta } = require("../utils/categories.js");
        const res = await request(app).get(`/listings/${doc._id}`);

        expect(res.text).toContain("place-thumb");
        expect(res.text).toContain(categoryMeta("Gym").tint);
        expect(res.text).toContain("Add a photo");
        expect(res.text).not.toContain('<img src=""');
    });

    test("a place with a photo shows the photo instead", async () => {
        const owner = await makeUser("owner");
        const doc = await Listing.create(place({
            image: { url: "https://example.com/real.jpg", filename: "real" }, owner: owner._id,
        }));

        const res = await request(app).get(`/listings/${doc._id}`);
        expect(res.text).toContain("https://example.com/real.jpg");
        expect(res.text).not.toContain("No photo yet");
    });

    test("every category defines its own tint and icon", () => {
        const { CATEGORIES } = require("../utils/categories.js");
        const tints = CATEGORIES.map((c) => c.tint);
        expect(tints.every((t) => /^#[0-9A-Fa-f]{6}$/.test(t))).toBe(true);
        expect(CATEGORIES.every((c) => c.icon.startsWith("fa-"))).toBe(true);
        expect(new Set(tints).size).toBe(CATEGORIES.length); // all distinct
    });
});

describe("error handling", () => {
    test("unknown routes render the 404 page", async () => {
        const res = await request(app).get("/no-such-page");
        expect(res.status).toBe(404);
    });
});
