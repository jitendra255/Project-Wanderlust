const Listing = require("./Models/listing.js");
const Review = require("./Models/review.js");
const { listingschema, reviewschema } = require("./schema.js")
const ExpressError = require("./utils/ExpressError")

module.exports.isLoggedIn = (req, res, next) => {
    //console.log(req.path,".....",req.originalUrl);
    if (!req.isAuthenticated()) {
        //redirect url
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "Log in to proceed further");
        return res.redirect("/login");
    }
    next();
}

module.exports.saveRedirectUrl = (req, res, next) => {
    if (req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
}

module.exports.isOwner = async (req, res, next) => {
    let { id } = req.params;
    let listing = await Listing.findById(id);
    if (!listing.owner.equals(res.locals.currUser._id)) {
        req.flash("error", "You aren't the owner of the listing")
        return res.redirect(`/listings/${id}`);
    }
    next();
}

module.exports.validatelisting = (req, res, next) => {
    // let result=listingschema.validate(req.body);
    // console.log(result);
    let { error } = listingschema.validate(req.body);
    if (error) {
        throw new ExpressError(400, error)
    }
    else {
        next();
    }
}

module.exports.validatereview = (req, res, next) => {
    let { error } = reviewschema.validate(req.body);
    if (error) {
        throw new ExpressError(400, error)
    }
    else {
        next();
    }
}

module.exports.isReviewAuthor = async (req, res, next) => {
    let { id, reviewId } = req.params;
    let review = await Review.findById(reviewId);
    if (!review.author.equals(res.locals.currUser._id)) {
        req.flash("error", "You aren't the author of this review")
        return res.redirect(`/listings/${id}`);
    }
    next();
}