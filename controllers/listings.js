const Listing = require("../Models/listing.js");

module.exports.index = async (req, res) => {
    let listings = await Listing.find()
    res.render("./listings/index.ejs", { listings,searchQuery: "" })
}

module.exports.new = (req, res) => {
    res.render("./listings/new.ejs");
}

module.exports.show = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id).populate({ path: "reviews", populate: { path: "author" }, }).populate("owner");
    if (!listing) {
        req.flash("error", "Listing you requested for doesn't exist");
        res.redirect("/listings");
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
        res.redirect("/listings");
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

module.exports.search = async (req, res) => {
        const { location } = req.query;
        
        if (!location) {
            req.flash("error", "Please enter a location to search");
            return res.redirect("/listings");
        }
    
        const listings = await Listing.find({
            $or: [
                { location: { $regex: location, $options: 'i' } },
                { country: { $regex: location, $options: 'i' } }
            ]
        }).populate("owner").populate({ 
            path: "reviews", 
            populate: { path: "author" } 
        });
    
        res.render("./listings/index.ejs", { 
            listings,
            searchQuery: location // Pass the search term
        });
    }

    module.exports.filter = async (req, res) => {
        const { category } = req.query;
        
        if (!category) {
            req.flash("error", "Please enter a category to search");
            return res.redirect("/listings");
        }
    
        const listings = await Listing.find({ category: { $regex: category, $options: 'i' },
        }).populate("owner").populate({ 
            path: "reviews", 
            populate: { path: "author" } 
        });
    
        res.render("./listings/index.ejs", { 
            listings,
            activeFilter: category // Pass the search term
        });
    }

