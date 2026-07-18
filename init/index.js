const path = require("path")
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const crypto = require("crypto")
const mongoose = require("mongoose")
const initdata = require("./data.js")
const listing = require("../Models/listing.js")
const User = require("../Models/user.js")

const initDb = async () => {
    if (!process.env.ATLASDB_URL) {
        console.error("Missing ATLASDB_URL. Copy .env.example to .env and fill it in.");
        process.exit(1);
    }

    await mongoose.connect(process.env.ATLASDB_URL)
    console.log("connected");

    // Seeded listings need an owner. Reuse the first user if the database
    // already has one, otherwise create a demo account so a fresh deployment
    // can be seeded without signing up through the UI first.
    let owner = await User.findOne();
    let generatedPassword = null;

    if (!owner) {
        generatedPassword = process.env.DEMO_PASSWORD || crypto.randomBytes(12).toString("base64url");
        owner = await User.register(
            new User({ email: "demo@wanderlust.app", username: "demo" }),
            generatedPassword
        );
    }

    await listing.deleteMany({});
    await listing.insertMany(initdata.data.map((obj) => ({ ...obj, owner: owner._id })))
    console.log(`data was initialised: ${initdata.data.length} listings (owner: ${owner.username})`);

    if (generatedPassword) {
        console.log("");
        console.log("  created demo account");
        console.log(`    username: ${owner.username}`);
        console.log(`    password: ${generatedPassword}`);
        console.log("  Save this now - it is not stored anywhere and cannot be recovered.");
        console.log("");
    }

    await mongoose.disconnect();
}

initDb().catch((err) => {
    console.log(err);
    process.exit(1);
})
