const Listing = require("../Models/listing.js");

module.exports.queue = async (req, res) => {
    const [pending, recentlyRejected, unverified] = await Promise.all([
        Listing.find({ status: "pending" }).sort({ createdAt: 1 }).populate("owner"),
        Listing.find({ status: "rejected" }).sort({ createdAt: -1 }).limit(10).populate("owner"),
        Listing.countDocuments({ status: "approved", verified: false }),
    ]);

    res.render("./admin/queue.ejs", { pending, recentlyRejected, unverified });
}

module.exports.approve = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "That submission no longer exists");
        return res.redirect("/admin/queue");
    }

    // Approving is also the moment a human vouched for the details.
    listing.status = "approved";
    listing.verified = true;
    listing.verifiedAt = new Date();
    await listing.save();

    req.flash("success", `Approved "${listing.title}"`);
    res.redirect("/admin/queue");
}

module.exports.reject = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "That submission no longer exists");
        return res.redirect("/admin/queue");
    }

    // Kept rather than deleted, so the submitter can see what happened and the
    // same bad entry does not get re-submitted unnoticed.
    listing.status = "rejected";
    await listing.save();

    req.flash("success", `Rejected "${listing.title}"`);
    res.redirect("/admin/queue");
}

// Flip an approved-but-unverified entry (an OSM import, typically) to verified
// once someone has actually checked it on the ground.
module.exports.verify = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "That place no longer exists");
        return res.redirect("/listings");
    }

    listing.verified = true;
    listing.verifiedAt = new Date();
    await listing.save();

    req.flash("success", `Marked "${listing.title}" as verified`);
    res.redirect(`/listings/${id}`);
}
