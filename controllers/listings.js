const Listing = require("../Models/listing.js");

// 9 per page keeps whole rows in the 3-column grid.
const PAGE_SIZE = 9;

// Search and category filter are independent and compose - either, both, or neither.
function buildListingQuery({ location, category }) {
    const query = {};
    if (category) {
        query.category = { $regex: category, $options: "i" };
    }
    if (location) {
        query.$or = [
            { location: { $regex: location, $options: "i" } },
            { country: { $regex: location, $options: "i" } },
        ];
    }
    return query;
}

async function renderListings(req, res, { location = "", category = "" }) {
    const query = buildListingQuery({ location, category });

    const total = await Listing.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    // Clamp so a hand-typed ?page=999 lands on the last page instead of an empty grid.
    const page = Math.min(Math.max(1, parseInt(req.query.page, 10) || 1), totalPages);

    const listings = await Listing.find(query)
        .sort({ _id: 1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate("owner");

    res.render("./listings/index.ejs", {
        listings,
        searchQuery: location,
        activeFilter: category,
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
    //console.log(listing);
    res.render("./listings/show.ejs", { listing })
}

module.exports.create = async (req, res, next) => {
    //let {title,description,image,price,country,location}=req.body;
    let url = req.file.path;
    let filename = req.file.filename;
    const newListing = new Listing(req.body.listing); //listing ya object hogya to apn ek saath pura object utha rhe h instead ki alag alag fields bharke add kre new listing
    newListing.owner = req.user._id;
    newListing.image = { url, filename };
    await newListing.save();
    req.flash("success", "New Listing Created!")
    res.redirect("/listings");
}

module.exports.edit = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing you requested for doesn't exist");
        return res.redirect("/listings");
    }

    let originalImageUrl = listing.image.url;
    originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250")
    res.render("./listings/edit.ejs", { listing, originalImageUrl })
}

module.exports.update = async (req, res) => {
    let { id } = req.params;
    let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });

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

