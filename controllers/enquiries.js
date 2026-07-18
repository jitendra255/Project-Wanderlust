const Enquiry = require("../Models/enquiry.js");
const Listing = require("../Models/listing.js");

module.exports.create = async (req, res) => {
    const { id } = req.params;
    const backToListing = () => res.redirect(`/listings/${id}`);

    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "That place no longer exists");
        return res.redirect("/listings");
    }

    if (!listing.owner) {
        req.flash("error", "Nobody is available to answer questions about this place yet");
        return backToListing();
    }

    if (listing.owner.equals(req.user._id)) {
        req.flash("error", "You added this place - there's nobody to ask but yourself");
        return backToListing();
    }

    const message = (req.body.enquiry && req.body.enquiry.message || "").trim();
    if (message.length < 5) {
        req.flash("error", "Please write a slightly longer question");
        return backToListing();
    }

    await Enquiry.create({
        listing: id,
        from: req.user._id,
        to: listing.owner,
        message,
    });

    req.flash("success", "Question sent. You'll see the reply on your profile.");
    return backToListing();
}

module.exports.reply = async (req, res) => {
    const { enquiryId } = req.params;

    const enquiry = await Enquiry.findById(enquiryId);
    if (!enquiry) {
        req.flash("error", "That question no longer exists");
        return res.redirect("/profile");
    }

    // Only the person it was addressed to can answer it.
    if (!enquiry.to.equals(req.user._id)) {
        req.flash("error", "That question wasn't addressed to you");
        return res.redirect("/profile");
    }

    const reply = (req.body.enquiry && req.body.enquiry.reply || "").trim();
    if (!reply) {
        req.flash("error", "Please write a reply");
        return res.redirect("/profile");
    }

    enquiry.reply = reply;
    enquiry.repliedAt = new Date();
    await enquiry.save();

    req.flash("success", "Reply sent");
    res.redirect("/profile");
}
