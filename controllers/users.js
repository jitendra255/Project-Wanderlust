const User = require("../Models/user.js");
const Listing = require("../Models/listing.js");
const Review = require("../Models/review.js");
const Booking = require("../Models/booking.js");
const { todayUtc } = require("../utils/dates.js");

module.exports.renderSignupForm = (req, res) => {
    res.render("./users/signup.ejs")
}

module.exports.signup = async (req, res, next) => {
    try {
        let { username, email, password } = req.body;
        const newUser = new User({ email, username });
        const registeredUser = await User.register(newUser, password);
        req.login(registeredUser, (err) => {
            if (err) {
                return next(err)
            }
            req.flash("success", "Login Successful!!");
            res.redirect("/listings");
        })
    } catch (error) {
        req.flash("error", error.message);
        res.redirect("/signup");
    }

}

module.exports.renderLoginForm = (req, res) => {
    res.render("./users/login.ejs")
}

module.exports.login = async (req, res) => {
    try {
        req.flash("success", "Login Successful!!");
        let redirectUrl = res.locals.redirectUrl || "/listings";
        res.redirect(redirectUrl);
    } catch (error) {
        req.flash("error", error.message)
        res.redirect("/login")
    }

}

module.exports.profile = async (req, res) => {
    const userId = req.user._id;

    const listings = await Listing.find({ owner: userId }).sort({ _id: -1 });
    const reviews = await Review.find({ author: userId }).sort({ createdAt: -1 });

    // Review has no back-reference to its listing, so resolve the mapping from
    // the owning side instead of migrating the schema.
    const reviewIds = reviews.map((review) => review._id);
    const reviewedListings = await Listing.find({ reviews: { $in: reviewIds } })
        .select("title image reviews");

    const listingByReview = new Map();
    for (const listing of reviewedListings) {
        for (const reviewId of listing.reviews) {
            listingByReview.set(reviewId.toString(), listing);
        }
    }

    // Stays this user has booked.
    const trips = await Booking.find({ guest: userId })
        .sort({ checkIn: -1 })
        .populate("listing", "title image location country");

    // Stays other people have booked on this user's listings.
    const incomingBookings = await Booking.find({
        listing: { $in: listings.map((listing) => listing._id) },
        status: "confirmed",
    })
        .sort({ checkIn: 1 })
        .populate("listing", "title")
        .populate("guest", "username");

    res.render("./users/profile.ejs", {
        listings,
        reviews,
        listingByReview,
        trips,
        incomingBookings,
        today: todayUtc(),
    });
}

module.exports.logout =(req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.flash("success", "Logged out successfully");
        res.redirect("/listings")
    })
}