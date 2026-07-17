const path = require("path")
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const mongoose = require("mongoose")
const initdata = require("./data.js")
const listing = require("../Models/listing.js")
const User = require("../Models/user.js")

const initDb = async () => {
    await mongoose.connect(process.env.ATLASDB_URL)
    console.log("connected");

    // ponytail: seed listings all belong to the first user in the DB. Sign up once before seeding.
    const owner = await User.findOne();
    if (!owner) {
        console.error("No user in DB. Start the app, sign up once, then re-run: npm run seed");
        process.exit(1);
    }

    await listing.deleteMany({});
    await listing.insertMany(initdata.data.map((obj) => ({ ...obj, owner: owner._id })))
    console.log(`data was initialised (owner: ${owner.username})`);
    await mongoose.disconnect();
}

initDb().catch((err) => {
    console.log(err);
    process.exit(1);
})
