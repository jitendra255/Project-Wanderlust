const Booking = require("../Models/booking.js");
const Listing = require("../Models/listing.js");
const { parseDay, todayUtc, nightsBetween } = require("../utils/dates.js");

module.exports.create = async (req, res) => {
    const { id } = req.params;
    const backToListing = () => res.redirect(`/listings/${id}`);

    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing you requested for doesn't exist");
        return res.redirect("/listings");
    }

    if (listing.owner.equals(req.user._id)) {
        req.flash("error", "You can't book your own listing");
        return backToListing();
    }

    const submitted = req.body.booking || {};
    const checkIn = parseDay(submitted.checkIn);
    const checkOut = parseDay(submitted.checkOut);

    if (!checkIn || !checkOut) {
        req.flash("error", "Please choose valid check-in and check-out dates");
        return backToListing();
    }
    if (checkOut <= checkIn) {
        req.flash("error", "Check-out must be after check-in");
        return backToListing();
    }
    if (checkIn < todayUtc()) {
        req.flash("error", "Check-in can't be in the past");
        return backToListing();
    }

    const guests = Math.max(1, Number.parseInt(submitted.guests, 10) || 1);

    const conflict = await Booking.findConflict(id, checkIn, checkOut);
    if (conflict) {
        req.flash("error", "Sorry, those dates are already booked. Please pick another range.");
        return backToListing();
    }

    const nights = nightsBetween(checkIn, checkOut);

    await Booking.create({
        listing: id,
        guest: req.user._id,
        checkIn,
        checkOut,
        guests,
        totalPrice: nights * listing.price,
    });

    req.flash("success", `Booked ${nights} night${nights === 1 ? "" : "s"}!`);
    return backToListing();
}

module.exports.cancel = async (req, res) => {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
        req.flash("error", "That booking no longer exists");
        return res.redirect("/profile");
    }

    if (booking.status === "cancelled") {
        req.flash("error", "That booking is already cancelled");
        return res.redirect("/profile");
    }

    // Cancelling frees the dates rather than deleting the record, so the trip
    // still shows in the guest's history.
    booking.status = "cancelled";
    await booking.save();

    req.flash("success", "Booking cancelled");
    return res.redirect("/profile");
}
