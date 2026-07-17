// ponytail: dev-only local MongoDB so the app runs without installing mongod.
// Delete this file (and the mongodb-memory-server devDependency) once a real
// MongoDB is available - then just fill in ATLASDB_URL in .env and `npm start`.
const path = require("path")
const fs = require("fs")
const { MongoMemoryServer } = require("mongodb-memory-server")
const mongoose = require("mongoose")

const dbPath = path.join(__dirname, ".mongo-data")

async function seedIfEmpty() {
    const Listing = require("./Models/listing.js")
    const User = require("./Models/user.js")
    const initdata = require("./init/data.js")

    if (await Listing.countDocuments() > 0) return;

    let owner = await User.findOne();
    if (!owner) {
        owner = await User.register(new User({ email: "demo@wanderlust.dev", username: "demo" }), "demo1234");
        console.log("seeded demo user -> username: demo / password: demo1234");
    }
    await Listing.insertMany(initdata.data.map((o) => ({ ...o, owner: owner._id })))
    console.log(`seeded ${initdata.data.length} listings`);
}

async function dev() {
    fs.mkdirSync(dbPath, { recursive: true });
    const mongod = await MongoMemoryServer.create({
        instance: { dbName: "wanderlust", dbPath, storageEngine: "wiredTiger" },
    });

    // dotenv does not override already-set vars, so these win over .env
    process.env.ATLASDB_URL = mongod.getUri("wanderlust");
    process.env.SECRET = process.env.SECRET || "dev-only-insecure-secret";

    await mongoose.connect(process.env.ATLASDB_URL);
    await seedIfEmpty();

    require("./app.js");

    const stop = async () => { await mongod.stop(); process.exit(0); };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
}

dev().catch((err) => { console.error(err); process.exit(1); })
