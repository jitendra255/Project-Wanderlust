// Clears the demo Airbnb data so the directory can be rebuilt from real places.
// Destructive: run deliberately.
//
//   node init/reset.js              # show what would be deleted
//   node init/reset.js --confirm    # actually delete
const path = require("path")
require("dotenv").config({ path: path.join(__dirname, "..", ".env") })
const mongoose = require("mongoose")
const Listing = require("../Models/listing.js")
const Review = require("../Models/review.js")
const Enquiry = require("../Models/enquiry.js");

(async () => {
    const confirmed = process.argv.includes("--confirm");

    if (!process.env.ATLASDB_URL) {
        console.error("Missing ATLASDB_URL");
        process.exit(1);
    }
    await mongoose.connect(process.env.ATLASDB_URL);

    const counts = {
        listings: await Listing.countDocuments(),
        reviews: await Review.countDocuments(),
        enquiries: await Enquiry.countDocuments(),
    };

    console.log("current contents:");
    for (const [name, n] of Object.entries(counts)) console.log(`  ${name.padEnd(10)} ${n}`);
    console.log("  (user accounts are kept)");

    if (!confirmed) {
        console.log("\nDry run. Re-run with --confirm to delete.");
        await mongoose.disconnect();
        return;
    }

    // Reviews and enquiries all point at listings, so they go too.
    await Review.deleteMany({});
    await Enquiry.deleteMany({});
    await Listing.deleteMany({});

    console.log("\ndeleted. remaining:");
    console.log(`  listings   ${await Listing.countDocuments()}`);
    console.log(`  reviews    ${await Review.countDocuments()}`);
    console.log(`  enquiries  ${await Enquiry.countDocuments()}`);

    await mongoose.disconnect();
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
