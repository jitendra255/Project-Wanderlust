// Grant or revoke admin rights, which gate the moderation queue.
//
//   node init/make-admin.js <username>            # grant
//   node init/make-admin.js <username> --revoke   # revoke
//   node init/make-admin.js --list                # show current admins
const path = require("path")
require("dotenv").config({ path: path.join(__dirname, "..", ".env") })
const mongoose = require("mongoose")
const User = require("../Models/user.js");

(async () => {
    if (!process.env.ATLASDB_URL) {
        console.error("Missing ATLASDB_URL");
        process.exit(1);
    }
    await mongoose.connect(process.env.ATLASDB_URL);

    const args = process.argv.slice(2);

    if (args.includes("--list") || args.length === 0) {
        const admins = await User.find({ isAdmin: true }).select("username email");
        console.log(admins.length ? "admins:" : "no admins yet");
        for (const a of admins) console.log(`  ${a.username} <${a.email}>`);
        if (args.length === 0) {
            console.log("\nusage: node init/make-admin.js <username> [--revoke]");
        }
        await mongoose.disconnect();
        return;
    }

    const username = args[0];
    const revoke = args.includes("--revoke");

    const user = await User.findOne({ username });
    if (!user) {
        console.error(`No user called "${username}". Sign up through the site first.`);
        process.exit(1);
    }

    user.isAdmin = !revoke;
    await user.save();

    console.log(`${revoke ? "Revoked admin from" : "Granted admin to"} ${user.username}`);
    await mongoose.disconnect();
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
