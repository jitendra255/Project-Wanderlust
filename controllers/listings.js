const Listing = require("../Models/listing.js");
const Booking = require("../Models/booking.js");
const { geocodePlace } = require("../utils/geocode.js");
const { distanceFromCampus } = require("../utils/campus.js");

// 9 per page keeps whole rows in the 3-column grid.
const PAGE_SIZE = 9;

// Search and category filter are independent and compose - either, both, or neither.
// Only approved entries are ever public; pending submissions live in the admin queue.
function buildListingQuery({ location, category, vegOnly, gender }) {
    const query = { status: "approved" };

    if (category) {
        query.category = { $regex: category, $options: "i" };
    }
    if (location) {
        query.$or = [
            { title: { $regex: location, $options: "i" } },
            { location: { $regex: location, $options: "i" } },
            { landmark: { $regex: location, $options: "i" } },
        ];
    }
    if (vegOnly) {
        query.vegOnly = true;
    }
    if (gender) {
        query.gender = gender;
    }
    return query;
}

// Nearest-first is the only sensible default for a campus directory.
const SORTS = {
    distance: { distanceFromCampus: 1 },
    priceLow: { price: 1 },
    priceHigh: { price: -1 },
    newest: { createdAt: -1 },
};

async function renderListings(req, res, { location = "", category = "" }) {
    const vegOnly = req.query.veg === "1";
    const gender = req.query.gender || "";
    const sortKey = SORTS[req.query.sort] ? req.query.sort : "distance";

    const query = buildListingQuery({ location, category, vegOnly, gender });

    const total = await Listing.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    // Clamp so a hand-typed ?page=999 lands on the last page instead of an empty grid.
    const page = Math.min(Math.max(1, parseInt(req.query.page, 10) || 1), totalPages);

    const listings = await Listing.find(query)
        .sort(SORTS[sortKey])
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate("owner");

    res.render("./listings/index.ejs", {
        listings,
        searchQuery: location,
        activeFilter: category,
        vegOnly,
        gender,
        sortKey,
        pagination: { page, totalPages, total, pageSize: PAGE_SIZE },
    });
}

module.exports.index = async (req, res) => {
    const { location = "", category = "" } = req.query;
    await renderListings(req, res, { location, category });
}

module.exports.new = (req, res) => {
    res.render("./listings/new.ejs");
}

module.exports.show = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id).populate({ path: "reviews", populate: { path: "author" }, }).populate("owner");
    if (!listing) {
        req.flash("error", "Listing you requested for doesn't exist");
        return res.redirect("/listings");
    }
    res.render("./listings/show.ejs", { listing })
}

// Form values need tidying before they hit the schema: facilities arrive as one
// comma-separated string, the checkbox arrives as "on" or not at all, and empty
// number inputs arrive as "" which Mongoose would cast to NaN.
function normalizeSubmission(body = {}) {
    const data = { ...body };

    if (typeof data.amenities === "string") {
        data.amenities = data.amenities
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }

    data.vegOnly = Boolean(data.vegOnly);

    for (const field of ["price", "deposit"]) {
        if (data[field] === "" || data[field] === undefined || data[field] === null) {
            delete data[field];
        }
    }

    return data;
}

module.exports.create = async (req, res, next) => {
    const newListing = new Listing(normalizeSubmission(req.body.listing));
    newListing.owner = req.user._id;
    newListing.source = "student";

    // A photo is optional - plenty of good messes have nothing to photograph.
    if (req.file) {
        newListing.image = { url: req.file.path, filename: req.file.filename };
    }

    // Best-effort: no coordinates just means the page renders without a map.
    const point = await geocodePlace({
        landmark: newListing.landmark,
        location: newListing.location,
    });
    if (point) newListing.geometry = point;

    // Entries describe real businesses, so a human checks them before they go
    // public. Admins are trusted and skip the queue.
    const trusted = req.user.isAdmin === true;
    newListing.status = trusted ? "approved" : "pending";
    newListing.verified = trusted;
    if (trusted) newListing.verifiedAt = new Date();

    await newListing.save();

    if (trusted) {
        req.flash("success", "Place added.");
        return res.redirect(`/listings/${newListing._id}`);
    }

    req.flash("success", "Thanks! Your submission is pending review and will appear once approved.");
    res.redirect("/listings");
}

module.exports.edit = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing you requested for doesn't exist");
        return res.redirect("/listings");
    }

    // Imported entries have no photo, so guard rather than assume a URL.
    const originalImageUrl = (listing.image && listing.image.url)
        ? listing.image.url.replace("/upload", "/upload/w_250")
        : "";

    res.render("./listings/edit.ejs", { listing, originalImageUrl })
}

module.exports.update = async (req, res) => {
    let { id } = req.params;
    const submitted = normalizeSubmission(req.body.listing);

    // findByIdAndUpdate returns the pre-update document, which lets us tell
    // whether the address actually changed before spending a geocode call.
    let listing = await Listing.findByIdAndUpdate(id, submitted);

    if (submitted.location !== listing.location || submitted.landmark !== listing.landmark) {
        const point = await geocodePlace({
            landmark: submitted.landmark,
            location: submitted.location,
        });
        if (point) {
            await Listing.findByIdAndUpdate(id, {
                geometry: point,
                distanceFromCampus: distanceFromCampus(point.coordinates),
            });
        }
    }

    if (typeof req.file !== "undefined") {
        let url = req.file.path;
        let filename = req.file.filename;
        listing.image = { url, filename }
        await listing.save();
    }


    req.flash("success", "Listing Updated Successfully")
    res.redirect(`/listings/${id}`);
}

module.exports.delete = async (req, res) => {
    let { id } = req.params;
    await Listing.findByIdAndDelete(id);
    req.flash("success", "Listing Deleted Successfully")
    res.redirect("/listings");
}

// Kept as a distinct route for backwards compatibility - /listings?location=
// does the same thing, and also composes with ?category=.
module.exports.search = async (req, res) => {
    const { location, category = "" } = req.query;

    if (!location) {
        req.flash("error", "Please enter a location to search");
        return res.redirect("/listings");
    }

    await renderListings(req, res, { location, category });
}

// As above: /listings?category= is the canonical form.
module.exports.filter = async (req, res) => {
    const { category, location = "" } = req.query;

    if (!category) {
        req.flash("error", "Please enter a category to search");
        return res.redirect("/listings");
    }

    await renderListings(req, res, { category, location });
}

